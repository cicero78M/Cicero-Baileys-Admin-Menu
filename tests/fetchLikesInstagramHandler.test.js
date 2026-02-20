import { jest } from '@jest/globals';

process.env.TZ = 'Asia/Jakarta';

const mockQuery = jest.fn();
const mockFetchAllInstagramLikes = jest.fn();
const mockFetchAllInstagramComments = jest.fn();
const mockGetAllExceptionUsers = jest.fn();
const mockSendDebug = jest.fn();
const mockSaveLikeSnapshotAudit = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../src/service/instagramApi.js', () => ({
  fetchAllInstagramLikes: mockFetchAllInstagramLikes,
  fetchAllInstagramComments: mockFetchAllInstagramComments,
}));
jest.unstable_mockModule('../src/model/userModel.js', () => ({
  getAllExceptionUsers: mockGetAllExceptionUsers,
}));
jest.unstable_mockModule('../src/model/instaLikeModel.js', () => ({
  saveLikeSnapshotAudit: mockSaveLikeSnapshotAudit,
}));
jest.unstable_mockModule('../src/middleware/debugHandler.js', () => ({
  sendDebug: mockSendDebug,
}));

let handleFetchLikesInstagram;

beforeAll(async () => {
  ({ handleFetchLikesInstagram } = await import('../src/handler/fetchengagement/fetchLikesInstagram.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveLikeSnapshotAudit.mockResolvedValue(1);
  mockFetchAllInstagramComments.mockResolvedValue([]);
  mockGetAllExceptionUsers.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

test('adds missing exception usernames to likes result', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ shortcode: 'sc1' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValue({});

  mockFetchAllInstagramLikes.mockResolvedValueOnce(['user1']);
  mockGetAllExceptionUsers.mockResolvedValueOnce([{ insta: '@user2' }]);

  await handleFetchLikesInstagram(null, null, 'clientA');

  const upsertCall = mockQuery.mock.calls.find((call) =>
    call[0].includes('INSERT INTO insta_like'),
  );
  const likesJson = upsertCall[1][1];
  const likes = JSON.parse(likesJson);
  expect(likes).toEqual(expect.arrayContaining(['user1', 'user2']));
});

test('uses Jakarta date filter SQL and resolves UTC 23:30 as next Jakarta day', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T23:30:00.000Z'));

  mockQuery.mockResolvedValueOnce({ rows: [] });

  await handleFetchLikesInstagram(null, null, 'clientA');

  const [sql, params] = mockQuery.mock.calls[0];
  expect(sql).toContain("(((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date) = $2::date");
  expect(params[1]).toBe('2026-01-02');
});


test('manual daily menu query filters manual source types consistently', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ shortcode: 'sc_manual' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValue({});

  mockFetchAllInstagramLikes.mockResolvedValueOnce([]);

  await handleFetchLikesInstagram(null, null, 'clientA', { sourceType: 'manual_input' });

  const [sql, params] = mockQuery.mock.calls[0];
  expect(sql).toContain("$3::boolean = false OR");
  expect(sql).toContain("IN ('manual_input', 'manual_fetch')");
  expect(params[2]).toBe(true);
});
