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
    .mockResolvedValueOnce({ rows: [{ has_column: true, data_type: 'timestamp with time zone' }] })
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

test('uses operational date filter SQL with fetched_at priority', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T23:30:00.000Z'));

  mockQuery
    .mockResolvedValueOnce({ rows: [{ has_column: true, data_type: 'timestamp with time zone' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValue({ rows: [] });

  await handleFetchLikesInstagram(null, null, 'clientA');

  const queryCall = mockQuery.mock.calls.find((call) =>
    call[0].includes('FROM insta_post') && call[0].includes('WHERE client_id = $1'),
  );
  const [sql, params] = queryCall;
  expect(sql).toContain("COALESCE((fetched_at AT TIME ZONE 'Asia/Jakarta')");
  expect(sql).toContain("- INTERVAL '17 hours')::date) = $2::date");
  expect(params[1]).toBe('2026-01-01');
});


test('manual daily menu query filters manual source types consistently', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ has_column: true, data_type: 'timestamp with time zone' }] })
    .mockResolvedValueOnce({ rows: [{ shortcode: 'sc_manual' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValue({});

  mockFetchAllInstagramLikes.mockResolvedValueOnce([]);

  await handleFetchLikesInstagram(null, null, 'clientA', { sourceType: 'manual_input' });

  const [sql, params] = mockQuery.mock.calls.find((call) =>
    call[0].includes('FROM insta_post') && call[0].includes('WHERE client_id = $1'),
  );
  expect(sql).toContain("$3::boolean = false OR");
  expect(sql).toContain("IN ('manual_input', 'manual_fetch')");
  expect(params[2]).toBe(true);
});

test('operationalDate option overrides filterDate and logs date-source diagnostics', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ has_column: true, data_type: 'timestamp with time zone' }] })
    .mockResolvedValueOnce({ rows: [{ shortcode: 'sc1', date_source: 'fetched_at' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValue({});
  mockFetchAllInstagramLikes.mockResolvedValueOnce(['user1']);

  await handleFetchLikesInstagram(null, null, 'clientA', {
    operationalDate: '2026-01-10',
    filterDate: '2026-01-01',
  });

  const [, params] = mockQuery.mock.calls.find((call) =>
    call[0].includes('FROM insta_post') && call[0].includes('WHERE client_id = $1'),
  );
  expect(params[1]).toBe('2026-01-10');
  expect(mockSendDebug).toHaveBeenCalledWith(
    expect.objectContaining({
      tag: 'IG FETCH LIKES FILTER',
      msg: expect.stringContaining('date_source_mode=fetched_at_then_created_at'),
    }),
  );
});

test('supports cross-cutoff operational date explicitly before/after 17:00 WIB', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [{ has_column: true, data_type: 'timestamp with time zone' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValue({ rows: [] });

  await handleFetchLikesInstagram(null, null, 'clientA', {
    filterDate: '2026-01-10',
  });

  const firstParams = mockQuery.mock.calls.find((call) =>
    call[0].includes('FROM insta_post') && call[0].includes('WHERE client_id = $1'),
  )[1];
  expect(firstParams[1]).toBe('2026-01-10');

  mockQuery.mockClear();
  mockQuery
    .mockResolvedValueOnce({ rows: [{ has_column: true, data_type: 'timestamp with time zone' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValue({ rows: [] });

  await handleFetchLikesInstagram(null, null, 'clientA', {
    filterDate: '2026-01-11',
  });

  const secondParams = mockQuery.mock.calls.find((call) =>
    call[0].includes('FROM insta_post') && call[0].includes('WHERE client_id = $1'),
  )[1];
  expect(secondParams[1]).toBe('2026-01-11');
});
