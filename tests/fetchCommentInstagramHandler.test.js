import { jest } from '@jest/globals';

process.env.TZ = 'Asia/Jakarta';

const mockQuery = jest.fn();
const mockSendDebug = jest.fn();
const mockFetchAllInstagramComments = jest.fn();
const mockInsertIgPostComments = jest.fn();
const mockUpsertIgUser = jest.fn();
const mockFindClientById = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../src/middleware/debugHandler.js', () => ({ sendDebug: mockSendDebug }));
jest.unstable_mockModule('../src/service/instagramApi.js', () => ({
  fetchAllInstagramComments: mockFetchAllInstagramComments,
}));
jest.unstable_mockModule('../src/model/igPostCommentModel.js', () => ({
  insertIgPostComments: mockInsertIgPostComments,
}));
jest.unstable_mockModule('../src/model/instaPostExtendedModel.js', () => ({
  upsertIgUser: mockUpsertIgUser,
}));
jest.unstable_mockModule('../src/service/clientService.js', () => ({
  findClientById: mockFindClientById,
}));

let handleFetchKomentarInstagram;

beforeAll(async () => {
  ({ handleFetchKomentarInstagram } = await import('../src/handler/fetchengagement/fetchCommentInstagram.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFindClientById.mockResolvedValue({ nama: 'Client A' });
});

afterEach(() => {
  jest.useRealTimers();
});

test('uses Jakarta date filter SQL and keeps posts at UTC 23:30 in Jakarta today window', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T23:30:00.000Z'));

  mockQuery.mockResolvedValueOnce({ rows: [] });
  const waClient = { sendMessage: jest.fn().mockResolvedValue(undefined) };

  await handleFetchKomentarInstagram(waClient, 'chat1', 'clientA');

  const [sql, params] = mockQuery.mock.calls[0];
  expect(sql).toContain("(((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date) = $2::date");
  expect(params[1]).toBe('2026-01-02');
  expect(waClient.sendMessage).toHaveBeenCalledWith(
    'chat1',
    expect.stringContaining('Tidak ada konten IG hari ini untuk client Client A.'),
  );
});
