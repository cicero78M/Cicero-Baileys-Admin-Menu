import { jest } from '@jest/globals';

const query = jest.fn();
const users = jest.fn();
const operators = jest.fn();
const byRole = jest.fn();
const shortcodes = jest.fn();
const reports = jest.fn();
const perPost = jest.fn();
jest.unstable_mockModule('../src/db/index.js', () => ({ query }));
jest.unstable_mockModule('../src/model/userModel.js', () => ({
  getUsersByClient: users, getOperatorsByClient: operators,
  getUsersByClientAndRole: byRole, getUsersByDirektorat: jest.fn(),
}));
jest.unstable_mockModule('../src/model/instaPostModel.js', () => ({ getShortcodesTodayByClient: shortcodes }));
jest.unstable_mockModule('../src/model/instaPostKhususModel.js', () => ({ getShortcodesTodayByClient: shortcodes }));
for (const model of ['linkReportModel', 'linkReportKhususModel']) {
  jest.unstable_mockModule(`../src/model/${model}.js`, () => ({
    getReportsTodayByClient: reports, getReportsTodayByShortcode: perPost,
  }));
}
const routine = await import('../src/handler/fetchabsensi/link/absensiLinkAmplifikasi.js');
const special = await import('../src/handler/fetchabsensi/link/absensiLinkKhusus.js');
const saved = process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
afterAll(() => { if (saved === undefined) delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED; else process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = saved; });
beforeEach(() => {
  jest.clearAllMocks();
  process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = 'true';
  query.mockResolvedValue({ rows: [{ nama: 'POLRES KEDIRI', client_type: 'org' }] });
  byRole.mockResolvedValue([{ user_id: 'a', nama: 'AMPLIFIER', divisi: 'A' }]);
  operators.mockResolvedValue([{ user_id: 'o', nama: 'OPERATOR', divisi: 'B' }]);
  users.mockResolvedValue([{ user_id: 'o', nama: 'OPERATOR', divisi: 'B' }]);
  shortcodes.mockResolvedValue(['abc']);
  const rows = [{ user_id: 'a', facebook_link: 'AMP' }, { user_id: 'o', facebook_link: 'OP' }];
  reports.mockResolvedValue(rows); perPost.mockResolvedValue(rows);
});
test.each([
  ['routine', routine.absensiLink], ['routine per post', routine.absensiLinkPerPost],
  ['special', special.absensiLinkKhusus], ['special per post', special.absensiLinkKhususPerPost],
])('%s uses only the gated roster and counts its reports', async (_label, fn) => {
  const result = await fn('KEDIRI', { roleFlag: 'operator' });
  expect(byRole).toHaveBeenCalledWith('KEDIRI', 'amplifier');
  expect(result).toContain('AMPLIFIER');
  expect(result).not.toContain('OPERATOR');
  expect(result).toMatch(/Jumlah Total Link dari 5 Platform Sosial Media\s*:\s*1/);
});
test('gated special queries request amplifier role', async () => {
  await special.absensiLinkKhusus('KEDIRI', { roleFlag: 'operator' });
  await special.absensiLinkKhususPerPost('KEDIRI', { roleFlag: 'operator' });
  expect(reports).toHaveBeenCalledWith('KEDIRI', 'amplifier');
  expect(perPost).toHaveBeenCalledWith('KEDIRI', 'abc', 'amplifier');
});
test.each(['false', 'TRUE', '1', ''])('gate %s defaults off', async (value) => {
  process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = value;
  await routine.absensiLink('KEDIRI');
  expect(operators).toHaveBeenCalledWith('KEDIRI');
  expect(byRole).not.toHaveBeenCalled();
});
test.each(['KEDIRI KOTA', 'POLRES_KEDIRI', 'OTHER'])('does not switch %s', async (id) => {
  await special.absensiLinkKhusus(id, { roleFlag: 'operator' });
  expect(operators).toHaveBeenCalledWith(id);
  expect(byRole).not.toHaveBeenCalled();
});
test('empty amplifier roster never falls back to operator', async () => {
  byRole.mockResolvedValue([]);
  const result = await routine.absensiLink('KEDIRI');
  expect(operators).not.toHaveBeenCalled();
  expect(result).not.toContain('OPERATOR');
});
test('rejects a conflicting client override rather than expanding the roster', async () => {
  await expect(routine.absensiLink('KEDIRI', { clientFilter: 'OTHER' })).rejects.toThrow('clientFilter tidak diizinkan');
  expect(byRole).not.toHaveBeenCalled();
});
test('dashboard daily report filters to the gated roster', async () => {
  const { rekapLink } = await import('../src/handler/fetchabsensi/link/rekapLink.js');
  const result = await rekapLink('KEDIRI');
  expect(result).toContain('AMP');
  expect(result).not.toContain('OP\n');
  expect(byRole).toHaveBeenCalledWith('KEDIRI', 'amplifier');
});
test.each([
  ['routine', routine.absensiLink], ['routine per post', routine.absensiLinkPerPost],
  ['special', special.absensiLinkKhusus], ['special per post', special.absensiLinkKhususPerPost],
])('%s also switches an opr-type KEDIRI client', async (_label, fn) => {
  query.mockResolvedValue({ rows: [{ nama: 'POLRES KEDIRI', client_type: 'opr' }] });
  await fn('KEDIRI', { roleFlag: 'operator' });
  expect(byRole).toHaveBeenCalledWith('KEDIRI', 'amplifier');
});
