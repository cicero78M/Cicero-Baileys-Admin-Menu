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

test('upsertInstaPost stores created_at using UTC contract', async () => {
  await upsertInstaPost({
    client_id: 'C1',
    shortcode: 'utc123',
    created_at: '2026-01-02T06:30:00+07:00',
  });

  const [sql, params] = mockQuery.mock.calls[0];
  expect(sql).toContain("($13::timestamptz AT TIME ZONE 'UTC')");
  expect(params[12]).toBe('2026-01-01T23:30:00.000Z');
});
