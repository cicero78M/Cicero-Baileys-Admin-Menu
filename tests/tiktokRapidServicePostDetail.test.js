import { jest } from '@jest/globals';

const mockAxiosGet = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: { get: mockAxiosGet }
}));

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'test-key';

let fetchTiktokPostDetail;

beforeAll(async () => {
  ({ fetchTiktokPostDetail } = await import('../src/service/tiktokRapidService.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('fetchTiktokPostDetail parses deeply nested JSON-string payloads', async () => {
  const nestedPayload = {
    data: JSON.stringify({
      detail: {
        aweme_detail: {
          aweme_id: '7609321329384312084',
          caption: 'from nested payload',
          like_count: 15,
          comment_count: 3
        }
      }
    })
  };

  mockAxiosGet.mockResolvedValueOnce({ data: nestedPayload });

  const detail = await fetchTiktokPostDetail('7609321329384312084');

  expect(detail.video_id).toBe('7609321329384312084');
  expect(detail.desc).toBe('from nested payload');
  expect(detail.stats.diggCount).toBe(15);
  expect(detail.stats.commentCount).toBe(3);
});

test('fetchTiktokPostDetail throws clear error for unsupported payload', async () => {
  mockAxiosGet.mockResolvedValueOnce({ data: { data: { status_code: 0, message: 'ok' } } });

  await expect(fetchTiktokPostDetail('7609321329384312084')).rejects.toThrow(
    'Response detail TikTok tidak memiliki data post yang valid.'
  );
});
