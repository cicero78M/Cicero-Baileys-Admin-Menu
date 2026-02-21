import { jest } from '@jest/globals';

const mockQuery = jest.fn();
jest.unstable_mockModule('../src/repository/db.js', () => ({
  query: mockQuery
}));

let findByClientId;
let getShortcodesTodayByClient;
let getShortcodesYesterdayByClient;
let countPostsByClient;
let upsertInstaPost;
beforeAll(async () => {
  ({
    findByClientId,
    getShortcodesTodayByClient,
    getShortcodesYesterdayByClient,
    countPostsByClient,
    upsertInstaPost
  } = await import('../src/model/instaPostModel.js'));
});

beforeEach(() => {
  mockQuery.mockReset();
});

test('findByClientId uses DISTINCT ON to avoid duplicates', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await findByClientId('c1');
  expect(mockQuery).toHaveBeenCalledWith(
    expect.stringContaining('DISTINCT ON (shortcode)'),
    ['c1']
  );
});

test('getShortcodesTodayByClient filters by client for non-direktorat', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'instansi' }] })
    .mockResolvedValueOnce({ rows: [] });
  await getShortcodesTodayByClient('C1');
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('LOWER(client_id) = LOWER($1)');
  expect(sql).toContain("(fetched_at AT TIME ZONE 'Asia/Jakarta')::date");
  expect(sql).not.toContain('insta_post_roles');
});

test('getShortcodesTodayByClient uses role filter for directorate', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'direktorat' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  await getShortcodesTodayByClient('DITA');
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('insta_post_roles');
  expect(sql).toContain('LOWER(pr.role_name) = LOWER($1)');
  expect(sql).not.toContain('source_type');
  expect(sql).toContain("(p.fetched_at AT TIME ZONE 'Asia/Jakarta')::date");
});

test('getShortcodesTodayByClient falls back to client filter when directorate role returns empty', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'direktorat' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ shortcode: 'abc' }] });

  const result = await getShortcodesTodayByClient('DITA');

  expect(mockQuery).toHaveBeenCalledTimes(3);
  const fallbackSql = mockQuery.mock.calls[2][0];
  expect(fallbackSql).toContain('LOWER(client_id) = LOWER($1)');
  expect(fallbackSql).not.toContain('insta_post_roles');
  expect(result).toEqual(['abc']);
});

test('getShortcodesTodayByClient uses role+client fallback for Ditbinmas', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'direktorat' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  await getShortcodesTodayByClient('DITBINMAS');
  const sql = mockQuery.mock.calls[1][0];
  const fallbackSql = mockQuery.mock.calls[2][0];
  expect(sql).toContain('insta_post_roles');
  expect(fallbackSql).toContain('LOWER(client_id) = LOWER($1)');
});

test('getShortcodesTodayByClient orders by fetched_at and shortcode for client filter', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'instansi' }] })
    .mockResolvedValueOnce({ rows: [] });
  await getShortcodesTodayByClient('C1');
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toMatch(/ORDER BY\s+fetched_at\s+ASC,\s+shortcode\s+ASC/i);
});

test('getShortcodesTodayByClient falls back to role when client not found', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  await getShortcodesTodayByClient('unknown');
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('insta_post_roles');
  expect(sql).toContain('LOWER(pr.role_name) = LOWER($1)');
});

test('getShortcodesTodayByClient orders by fetched_at and shortcode for role filter', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'direktorat' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  await getShortcodesTodayByClient('DITA');
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toMatch(/ORDER BY\s+fetched_at\s+ASC,\s+shortcode\s+ASC/i);
});

test('getShortcodesYesterdayByClient filters by client for non-direktorat', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'instansi' }] })
    .mockResolvedValueOnce({ rows: [] });
  await getShortcodesYesterdayByClient('C1');
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('LOWER(client_id) = LOWER($1)');
  expect(sql).not.toContain('insta_post_roles');
});

test('getShortcodesYesterdayByClient uses role filter for directorate', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'direktorat' }] })
    .mockResolvedValueOnce({ rows: [] });
  await getShortcodesYesterdayByClient('DITA');
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('insta_post_roles');
  expect(sql).toContain('LOWER(pr.role_name) = LOWER($1)');
});

test('countPostsByClient filters by client_id when no scope supplied', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'instansi' }] })
    .mockResolvedValueOnce({ rows: [{ jumlah_post: '3' }] });

  const result = await countPostsByClient('C1', 'harian', undefined, undefined, undefined, {});

  expect(mockQuery).toHaveBeenCalledTimes(2);
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('COUNT(DISTINCT p.shortcode)');
  expect(sql).toContain('LOWER(TRIM(p.client_id)) = LOWER($1)');
  expect(result).toBe(3);
});

test('countPostsByClient applies role join for directorate scope', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'direktorat' }] })
    .mockResolvedValueOnce({ rows: [{ jumlah_post: '2' }] });

  await countPostsByClient('DITA', 'harian', undefined, undefined, undefined, {
    role: 'dita',
    scope: 'direktorat'
  });

  expect(mockQuery).toHaveBeenCalledTimes(2);
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('JOIN insta_post_roles pr ON pr.shortcode = p.shortcode');
  expect(sql).toContain('LOWER(TRIM(pr.role_name)) = LOWER($1)');
});

test('countPostsByClient filters by regional_id when provided', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ client_type: 'instansi' }] })
    .mockResolvedValueOnce({ rows: [{ jumlah_post: '1' }] });

  await countPostsByClient('C1', 'harian', undefined, undefined, undefined, {
    regionalId: 'jatim'
  });

  expect(mockQuery).toHaveBeenCalledTimes(2);
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('JOIN clients c ON c.client_id = p.client_id');
  expect(sql).toContain('UPPER(c.regional_id) = $2');
});


test('upsertInstaPost persists like_count in insert and update payload', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [] });

  await upsertInstaPost({
    client_id: 'C1',
    shortcode: 'abc123',
    caption: 'tes',
    comment_count: 4,
    like_count: 88,
    created_at: '2026-01-01T10:00:00+07:00',
  });

  const [sql, params] = mockQuery.mock.calls[0];
  expect(sql).toContain('INSERT INTO insta_post (client_id, shortcode, caption, comment_count, like_count');
  expect(sql).toContain('like_count = EXCLUDED.like_count');
  expect(params[4]).toBe(88);
});
