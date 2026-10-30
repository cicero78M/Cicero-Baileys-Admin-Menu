import { jest } from '@jest/globals';
const query = jest.fn();
jest.unstable_mockModule('../src/repository/db.js', () => ({ query, withTransaction: (fn) => fn({ query }) }));
const users = await import('../src/model/userModel.js');
const reports = await import('../src/model/linkReportModel.js');
const original = process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
afterAll(() => { if (original === undefined) delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED; else process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = original; });
beforeEach(() => { jest.clearAllMocks(); process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = 'true'; });
test('roster amplifier is exact client-scoped and active', async () => {
  query.mockResolvedValue({ rows: [] });
  await users.getUsersByClient('KEDIRI', 'amplifier');
  expect(query.mock.calls[0][0]).toContain('LOWER(u.client_id) = LOWER($1)');
  expect(query.mock.calls[0][0]).toContain('status = true');
  expect(query.mock.calls[0][1]).toEqual(['KEDIRI', 'amplifier']);
  await expect(users.getUsersByClient('KEDIRI', 'amplifer')).rejects.toThrow();
});
test.each([true, false])('membership update %s scopes role and client', async (enabled) => {
  query.mockResolvedValueOnce({ rows: [{ client_id: 'KEDIRI', status: true, operator: true }] }).mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: '1' }] }).mockResolvedValueOnce({ rows: [{ amplifier: enabled }] });
  await users.setKediriAmplifierRole('1', 'KEDIRI', enabled);
  expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
  const [sql, params] = query.mock.calls[1];
  expect(sql).toContain("LOWER(r.role_name) = 'amplifier'");
  expect(sql).not.toContain('operator');
  expect(params).toEqual(['1']);
});
test('generic update rejects SQL field injection and amplifier before writes', async () => {
  await expect(users.updateUser('1', { 'nama = NULL --': 'x' })).rejects.toThrow('Field tidak diizinkan');
  await expect(users.updateUser('1', { amplifier: true })).rejects.toThrow('Field tidak diizinkan');
  expect(query).not.toHaveBeenCalled();
});
test.each(['getReportsThisMonthByClient', 'getReportsPrevMonthByClient'])('%s filters current membership without changing historical records', async (name) => {
  query.mockResolvedValue({ rows: [] });
  await reports[name]('KEDIRI');
  const sql = query.mock.calls[0][0];
  expect(sql).toContain("LOWER(ro.role_name) = 'amplifier'");
  expect(sql).toContain('u.status = true');
  expect(sql).toContain('LOWER(u.client_id) = LOWER($1)');
  expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT)\b/i);
  query.mockClear();
  await reports[name]('OTHER');
  expect(query.mock.calls[0][0]).not.toContain("LOWER(ro.role_name) = 'amplifier'");
});

test('role assignment checks tenant under row lock before writing', async () => {
  query.mockResolvedValueOnce({ rows: [{ client_id: 'OTHER' }] });
  await expect(users.setKediriAmplifierRole('1', 'KEDIRI', true)).rejects.toThrow('client_id tidak diizinkan');
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
});

test.each([
  ['inactive operator', { client_id: 'KEDIRI', status: false, operator: true }],
  ['active non-operator', { client_id: 'KEDIRI', status: true, operator: false }],
])('grant rejects %s before writing', async (_label, row) => {
  query.mockResolvedValueOnce({ rows: [row] });
  await expect(users.setKediriAmplifierRole('1', 'KEDIRI', true))
    .rejects.toThrow('Role amplifier hanya untuk operator KEDIRI yang sudah aktif');
  expect(query.mock.calls.every(([sql]) => !/^(INSERT|DELETE|UPDATE)/.test(sql))).toBe(true);
});
