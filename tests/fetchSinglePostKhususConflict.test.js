import { jest } from '@jest/globals';

const mockFetchInstagramPostInfo = jest.fn();
const mockSavePostWithMedia = jest.fn();
const mockFindKhususPostByShortcode = jest.fn();
const mockUpsertInstaPostKhusus = jest.fn();
const mockUpsertInstaPost = jest.fn();

jest.unstable_mockModule('../src/service/instagramApi.js', () => ({
  fetchInstagramPosts: jest.fn(),
  fetchInstagramPostInfo: mockFetchInstagramPostInfo,
}));

jest.unstable_mockModule('../src/model/instaPostExtendedModel.js', () => ({
  savePostWithMedia: mockSavePostWithMedia,
}));

jest.unstable_mockModule('../src/model/instaPostKhususModel.js', () => ({
  findPostByShortcode: mockFindKhususPostByShortcode,
  upsertInstaPost: mockUpsertInstaPostKhusus,
}));

jest.unstable_mockModule('../src/model/instaPostModel.js', () => ({
  upsertInstaPost: mockUpsertInstaPost,
}));

jest.unstable_mockModule('../src/db/index.js', () => ({
  query: jest.fn(),
}));

jest.unstable_mockModule('../src/middleware/debugHandler.js', () => ({
  sendDebug: jest.fn(),
}));

const { fetchSinglePostKhusus } = await import('../src/handler/fetchpost/instaFetchPost.js');

describe('fetchSinglePostKhusus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects when shortcode already belongs to another client in insta_post_khusus', async () => {
    mockFindKhususPostByShortcode.mockResolvedValue({
      shortcode: 'abc123',
      client_id: 'POLRES_A',
    });

    await expect(
      fetchSinglePostKhusus('https://www.instagram.com/p/abc123/', 'POLRES_B')
    ).rejects.toThrow(
      'Link tugas khusus sudah diinput dan digunakan oleh Polres lain. Upload konten pada akun khusus milik satker Anda kemudian upload link tersebut sebagai tugas khusus.'
    );

    expect(mockFetchInstagramPostInfo).not.toHaveBeenCalled();
    expect(mockUpsertInstaPostKhusus).not.toHaveBeenCalled();
    expect(mockUpsertInstaPost).not.toHaveBeenCalled();
  });

  test('continues fetch when shortcode belongs to same client', async () => {
    mockFindKhususPostByShortcode.mockResolvedValue({
      shortcode: 'abc123',
      client_id: 'POLRES_A',
    });

    mockFetchInstagramPostInfo.mockResolvedValue({
      caption: { text: 'caption' },
      comment_count: 2,
      thumbnail_url: 'thumb',
      is_video: false,
      image_versions: { items: [{ url: 'image' }] },
      carousel_media: null,
      taken_at: 1700000000,
    });

    await fetchSinglePostKhusus('https://www.instagram.com/p/abc123/', 'polres_a');

    expect(mockFetchInstagramPostInfo).toHaveBeenCalledWith('abc123');
    expect(mockUpsertInstaPostKhusus).toHaveBeenCalledTimes(1);
    expect(mockUpsertInstaPost).toHaveBeenCalledTimes(1);
    expect(mockSavePostWithMedia).toHaveBeenCalledTimes(1);
  });
});
