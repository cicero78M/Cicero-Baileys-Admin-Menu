import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/repository/db.js', () => ({
  query: mockQuery
}));

let addTaskPostExclusion;
let getTaskPostExclusionSet;

beforeAll(async () => {
  const mod = await import('../src/model/taskPostExclusionModel.js');
  addTaskPostExclusion = mod.addTaskPostExclusion;
  getTaskPostExclusionSet = mod.getTaskPostExclusionSet;
});

beforeEach(() => {
  mockQuery.mockReset();
});

test('task post exclusion bootstraps table once, upserts, and reads exclusion set', async () => {
  mockQuery
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ content_id: ' CODE1 ' }, { content_id: 'CODE2' }, { content_id: '' }] });

  await addTaskPostExclusion({
    clientId: ' POLRES-A ',
    platform: 'Instagram',
    contentId: ' ABC123 ',
    sourceLink: 'https://www.instagram.com/p/ABC123/'
  });

  const result = await getTaskPostExclusionSet({
    clientId: 'POLRES-A',
    platform: 'tiktok'
  });

  const createTableCalls = mockQuery.mock.calls.filter(([sql]) => sql.includes('CREATE TABLE IF NOT EXISTS task_post_exclusions'));
  const createIndexCalls = mockQuery.mock.calls.filter(([sql]) => sql.includes('CREATE INDEX IF NOT EXISTS idx_task_post_exclusions_client_platform'));

  expect(createTableCalls).toHaveLength(1);
  expect(createIndexCalls).toHaveLength(1);
  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('INSERT INTO task_post_exclusions'),
    ['polres-a', 'instagram', 'ABC123', 'https://www.instagram.com/p/ABC123/']
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    4,
    expect.stringContaining('FROM task_post_exclusions'),
    ['polres-a', 'tiktok']
  );
  expect(result).toEqual(new Set(['CODE1', 'CODE2']));
});

test('addTaskPostExclusion rejects unsupported platform', async () => {
  await expect(
    addTaskPostExclusion({
      clientId: 'polres-a',
      platform: 'x',
      contentId: 'ABC123'
    })
  ).rejects.toThrow('Platform tidak didukung untuk penghapusan post tugas.');
});
