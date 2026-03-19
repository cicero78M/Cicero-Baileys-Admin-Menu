import { jest } from '@jest/globals';

const mockWithTransaction = jest.fn();

jest.unstable_mockModule('../src/repository/db.js', () => ({
  query: jest.fn(),
  withTransaction: mockWithTransaction,
}));

let deletePostByShortcode;

beforeAll(async () => {
  ({ deletePostByShortcode } = await import('../src/model/instaPostModel.js'));
});

beforeEach(() => {
  mockWithTransaction.mockReset();
});

test('deletePostByShortcode retries delete after enabling replica identity on tasks', async () => {
  const selectResult = { rowCount: 1, rows: [{ shortcode: 'abc123' }] };
  const deleteAuditResult = { rowCount: 0, rows: [] };
  const deleteError = new Error(
    'cannot delete from table "tasks" because it does not have a replica identity and publishes deletes'
  );
  const setReplicaIdentityResult = { rowCount: null, rows: [] };
  const retryDeleteResult = { rowCount: 1, rows: [] };

  const client = {
    query: jest
      .fn()
      .mockResolvedValueOnce(selectResult)
      .mockResolvedValueOnce(deleteAuditResult)
      .mockRejectedValueOnce(deleteError)
      .mockResolvedValueOnce(setReplicaIdentityResult)
      .mockResolvedValueOnce(retryDeleteResult),
  };

  mockWithTransaction.mockImplementation(async (callback) => callback(client));

  const result = await deletePostByShortcode('abc123', 'DITBINMAS');

  expect(result).toBe(1);
  expect(client.query).toHaveBeenCalledWith(
    expect.stringContaining('ALTER TABLE tasks REPLICA IDENTITY FULL')
  );
  expect(client.query).toHaveBeenNthCalledWith(
    5,
    expect.stringContaining('DELETE FROM insta_post'),
    ['abc123']
  );
});
