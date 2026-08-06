import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockGetUsersByClient = jest.fn();
const mockGetUsersByDirektorat = jest.fn();
const mockGetPostsTodayByClient = jest.fn();
const mockGetPostsOperationalTodayByClient = jest.fn();
const mockGetCommentsByVideoId = jest.fn();
const mockSendDebug = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../src/model/userModel.js', () => ({
  getUsersByClient: mockGetUsersByClient,
  getUsersByDirektorat: mockGetUsersByDirektorat,
  getClientsByRole: jest.fn(),
}));
jest.unstable_mockModule('../src/model/tiktokPostModel.js', () => ({
  getPostsTodayByClient: mockGetPostsTodayByClient,
  getPostsOperationalTodayByClient: mockGetPostsOperationalTodayByClient,
  findPostByVideoId: jest.fn(),
  deletePostByVideoId: jest.fn(),
}));
jest.unstable_mockModule('../src/model/tiktokCommentModel.js', () => ({
  getCommentsByVideoId: mockGetCommentsByVideoId,
  deleteCommentsByVideoId: jest.fn(),
}));
jest.unstable_mockModule('../src/middleware/debugHandler.js', () => ({
  sendDebug: mockSendDebug,
}));

let absensiKomentar;

beforeAll(async () => {
  ({ absensiKomentar } = await import('../src/handler/fetchabsensi/tiktok/absensiKomentarTiktok.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('uses getUsersByDirektorat when roleFlag is a directorate', async () => {
  mockQuery.mockResolvedValueOnce({ rows: [{ nama: 'POLRES ABC', client_tiktok: '@abc', client_type: 'org' }] });
  mockGetUsersByDirektorat.mockResolvedValueOnce([]);
  mockGetPostsOperationalTodayByClient.mockResolvedValueOnce([]);

  await absensiKomentar('POLRES', { roleFlag: 'ditbinmas' });

  expect(mockGetUsersByDirektorat).toHaveBeenCalledWith('ditbinmas');
  expect(mockGetUsersByClient).not.toHaveBeenCalled();
});

test('operator attendance uses the same Jakarta calendar-day posts as Tugas Hari Ini', async () => {
  mockQuery.mockResolvedValueOnce({
    rows: [{ nama: 'POLRES ABC', client_tiktok: '@abc', client_type: 'org' }],
  });
  mockGetUsersByClient.mockResolvedValueOnce([]);
  mockGetPostsTodayByClient.mockResolvedValueOnce([
    { video_id: '1' },
    { video_id: '2' },
    { video_id: '3' },
    { video_id: '4' },
    { video_id: '5' },
    { video_id: '6' },
  ]);
  mockGetCommentsByVideoId.mockResolvedValue({ comments: [] });

  const message = await absensiKomentar('POLRES', {
    mode: 'kurang_belum',
    roleFlag: 'operator',
  });

  expect(mockGetPostsTodayByClient).toHaveBeenCalledWith('POLRES');
  expect(mockGetPostsOperationalTodayByClient).not.toHaveBeenCalled();
  expect(message).toContain('*Jumlah Konten:* 6');
  expect(message).toContain('https://www.tiktok.com/@abc/video/6');
});
