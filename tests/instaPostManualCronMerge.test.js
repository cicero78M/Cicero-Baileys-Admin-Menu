import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/repository/db.js', () => ({
  query: mockQuery,
}));

let upsertInstaPost;

beforeAll(async () => {
  ({ upsertInstaPost } = await import('../src/model/instaPostModel.js'));
});

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
});

test('manual then cron flow uses non-destructive conflict merge clauses', async () => {
  await upsertInstaPost({
    client_id: 'CLIENT_A',
    shortcode: 'abc123',
    source_type: 'manual_input',
    created_at: '2026-01-02T03:00:00+07:00',
    original_created_at: '2026-01-01T20:00:00.000Z',
  });

  await upsertInstaPost({
    client_id: 'CLIENT_A',
    shortcode: 'abc123',
    source_type: 'cron_fetch',
    created_at: '2026-01-02T05:00:00+07:00',
    original_created_at: null,
  });

  const [sqlFirst] = mockQuery.mock.calls[0];
  const [sqlSecond] = mockQuery.mock.calls[1];

  expect(sqlFirst).toContain("source_type = CASE");
  expect(sqlFirst).toContain("COALESCE(insta_post.source_type, 'cron_fetch') = 'manual_input'");
  expect(sqlFirst).toContain("OR EXCLUDED.source_type = 'manual_input'");
  expect(sqlFirst).toContain("created_at = CASE");
  expect(sqlFirst).toContain('THEN insta_post.created_at');
  expect(sqlFirst).toContain('original_created_at = COALESCE(EXCLUDED.original_created_at, insta_post.original_created_at)');
  expect(sqlSecond).toContain("source_type = CASE");
});

test('cron then manual flow keeps manual marker idempotent and keeps publish-time fallback contract in SQL', async () => {
  await upsertInstaPost({
    client_id: 'CLIENT_A',
    shortcode: 'def456',
    source_type: 'cron_fetch',
    created_at: '2026-01-02T05:00:00+07:00',
    original_created_at: '2026-01-01T21:00:00.000Z',
  });

  await upsertInstaPost({
    client_id: 'CLIENT_A',
    shortcode: 'def456',
    source_type: 'manual_fetch',
    created_at: '2026-01-02T06:00:00+07:00',
    original_created_at: null,
  });

  const [, secondParams] = mockQuery.mock.calls[1];
  const [sql] = mockQuery.mock.calls[1];

  expect(secondParams[11]).toBe('manual_input');
  expect(sql).toContain("THEN 'manual_input'");
  expect(sql).toContain('original_created_at = COALESCE(EXCLUDED.original_created_at, insta_post.original_created_at)');
});
