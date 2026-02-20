import { jest } from '@jest/globals';

const mockQuery = jest.fn();
jest.unstable_mockModule('../src/repository/db.js', () => ({
  query: mockQuery,
}));

let findByClientId;
let getPostsByClientAndDateRange;
let upsertInstaPost;
beforeAll(async () => {
  ({
    findByClientId,
    getPostsByClientAndDateRange,
    upsertInstaPost,
  } = await import('../src/model/instaPostKhususModel.js'));
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

test('getPostsByClientAndDateRange supports days option', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await getPostsByClientAndDateRange('c1', { days: 7 });
  const sql = mockQuery.mock.calls[0][0];
  expect(sql).toContain("created_at >= NOW() - INTERVAL '7 days'");
  expect(mockQuery.mock.calls[0][1]).toEqual(['c1']);
});

test('getPostsByClientAndDateRange supports start and end dates', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await getPostsByClientAndDateRange('c1', {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  });
  const sql = mockQuery.mock.calls[0][0];
  expect(sql).toContain('created_at::date >= $2');
  expect(sql).toContain('created_at::date <= $3');
  expect(mockQuery.mock.calls[0][1]).toEqual([
    'c1',
    '2024-01-01',
    '2024-01-31',
  ]);
});


test('upsertInstaPost khusus persists like_count in insert and update payload', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [] });

  await upsertInstaPost({
    client_id: 'C1',
    shortcode: 'abc123',
    caption: 'tes',
    comment_count: 1,
    like_count: 15,
    created_at: '2026-01-01T10:00:00+07:00',
  });

  const [sql, params] = mockQuery.mock.calls[0];
  expect(sql).toContain('INSERT INTO insta_post_khusus (client_id, shortcode, caption, comment_count, like_count');
  expect(sql).toContain('like_count = EXCLUDED.like_count');
  expect(params[4]).toBe(15);
});
