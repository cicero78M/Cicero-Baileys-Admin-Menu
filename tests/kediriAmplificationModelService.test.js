import { jest } from '@jest/globals';
const query = jest.fn();
const reports = jest.fn().mockResolvedValue([{ user_id: 'a', facebook_link: 'AMP_LINK' }, { user_id: 'o', facebook_link: 'OP_LINK' }]);
const shortcodes = jest.fn().mockResolvedValue(['abc']);
jest.unstable_mockModule('../src/repository/db.js', () => ({ query }));
jest.unstable_mockModule('../src/model/linkReportModel.js', () => ({ getReportsTodayByClient: reports, getReportsYesterdayByClient: reports }));
jest.unstable_mockModule('../src/model/instaPostModel.js', () => ({ getShortcodesTodayByClient: shortcodes, getShortcodesYesterdayByClient: shortcodes }));
const service = await import('../src/service/oprReportService.js');
const special = await import('../src/model/linkReportKhususModel.js');
const original = process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
afterAll(() => { if (original === undefined) delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED; else process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = original; });
beforeEach(() => { jest.clearAllMocks(); process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = 'true'; });
test.each(['generateDailyAmplificationReport', 'generateYesterdayAmplificationReport'])('%s uses only active amplifier report authors', async (method) => {
  query.mockResolvedValueOnce({ rows: [{ user_id: 'a' }] }).mockResolvedValueOnce({ rows: [{ nama: 'KEDIRI' }] });
  const result = await service[method]('KEDIRI');
  expect(query.mock.calls[0][0]).toContain('u.status = true');
  expect(query.mock.calls[0][1]).toEqual(['KEDIRI', 'amplifier']);
  expect(result).toContain('AMP_LINK');
  expect(result).not.toContain('OP_LINK');
});
test('no fallback when gated roster is empty', async () => {
  query.mockResolvedValueOnce({ rows: [] });
  expect(await service.generateDailyAmplificationReport('KEDIRI')).toBeNull();
  expect(query).toHaveBeenCalledTimes(1);
});
test('non-target and gate off keep operator', async () => {
  query.mockResolvedValue({ rows: [] });
  await service.generateDailyAmplificationReport('KEDIRI KOTA');
  delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
  await service.generateDailyAmplificationReport('KEDIRI');
  expect(query.mock.calls.map((c) => c[1])).toEqual([['KEDIRI KOTA', 'operator'], ['KEDIRI', 'operator']]);
});
test.each(['getReportsTodayByClient', 'getReportsTodayByShortcode'])('%s honors only whitelisted amplifier flag', async (method) => {
  query.mockResolvedValue({ rows: [] });
  await (method === 'getReportsTodayByClient' ? special[method]('KEDIRI', 'amplifier') : special[method]('KEDIRI', 'abc', 'amplifier'));
  expect(query.mock.calls[0][0]).toContain("LOWER(ro.role_name) = 'amplifier'");
  query.mockClear();
  await expect(method === 'getReportsTodayByClient' ? special[method]('KEDIRI', "amplifier' OR 1=1 --") : special[method]('KEDIRI', 'abc', "amplifier' OR 1=1 --")).rejects.toThrow('role tidak valid');
  expect(query).not.toHaveBeenCalled();
});
test('special rekap binds amplifier role', async () => {
  query.mockResolvedValueOnce({ rows: [{ jumlah_post: 1 }] }).mockResolvedValueOnce({ rows: [] });
  await special.getRekapLinkByClient('KEDIRI', 'harian', null, 'amplifier', { userRoleFilter: 'amplifier' });
  expect(query.mock.calls[1][0]).toContain('LOWER(r.role_name) = LOWER(');
  expect(query.mock.calls[1][1]).toContain('amplifier');
});
test.each(['getReportsTodayByClient', 'getReportsTodayByShortcode'])('%s aliases missing or legacy operator role to amplifier after switch', async (method) => {
  const invoke = (role) => method === 'getReportsTodayByClient'
    ? special[method]('KEDIRI', role) : special[method]('KEDIRI', 'abc', role);
  query.mockResolvedValue({ rows: [] });
  await invoke(null);
  await invoke('operator');
  for (const [sql] of query.mock.calls) {
    expect(sql).toContain("LOWER(ro.role_name) = 'amplifier'");
    expect(sql).toContain('u.status = true');
  }
});
test('special rekap constrains KEDIRI users even if client is a directorate', async () => {
  query.mockResolvedValueOnce({ rows: [{ jumlah_post: 1 }] }).mockResolvedValueOnce({ rows: [] });
  await special.getRekapLinkByClient('KEDIRI', 'semua');
  const [sql, params] = query.mock.calls[1];
  expect(sql).toContain('u.client_id = $1 OR');
  expect(sql).toContain('AND u.client_id = $');
  expect(params).toContain('KEDIRI');
  expect(sql).toContain("LOWER(karole.role_name) = 'amplifier'");
});
