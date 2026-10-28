import { jest } from '@jest/globals';
const query = jest.fn();
jest.unstable_mockModule('../src/repository/db.js', () => ({ query }));
const routine = await import('../src/model/linkReportModel.js');
const special = await import('../src/model/linkReportKhususModel.js');
beforeEach(() => { jest.clearAllMocks(); query.mockResolvedValue({ rows: [] }); });
test('paginated routine raw list filters KEDIRI with correct count params', async () => {
  await routine.getLinkReports({ userId: 'u1', kediriVisibility: true });
  const [select, count] = query.mock.calls;
  for (const [sql] of [select, count]) {
    expect(sql).toContain("LOWER(ku.client_id) = 'kediri'");
    expect(sql).toContain("LOWER(kr.role_name) = 'amplifier'");
    expect(sql).toContain('ku.status = true');
    expect(sql).toContain('FROM insta_post kp');
  }
  expect(select[1]).toEqual(['u1', 20, 0]);
  expect(count[1]).toEqual(['u1']);
});
test.each([[routine, 'routine'], [special, 'special']])('%s raw report visibility fails closed without KEDIRI access', async (model) => {
  await model.getLinkReports({ kediriVisibility: false });
  expect(query.mock.calls[0][0]).toContain("LOWER(ku.client_id) = 'kediri'");
  expect(query.mock.calls[0][0]).not.toContain('LOWER(kr.role_name)');
  query.mockClear();
  await model.findLinkReportByShortcode('abc', '1', { kediriVisibility: true });
  expect(query.mock.calls[0][0]).toContain("LOWER(kr.role_name) = 'amplifier'");
  expect(query.mock.calls[0][1]).toEqual(['abc', '1']);
});
