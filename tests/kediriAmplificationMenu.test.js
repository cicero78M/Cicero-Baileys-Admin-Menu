import { jest } from '@jest/globals';
const rows = [{ user_id: 'a', facebook_link: 'AMP_LINK' }, { user_id: 'o', facebook_link: 'OP_LINK' }];
const today = jest.fn().mockResolvedValue(rows);
const yesterday = jest.fn().mockResolvedValue(rows);
const post = jest.fn().mockResolvedValue(rows);
const shortcodes = jest.fn().mockResolvedValue(['abc']);
jest.unstable_mockModule('../src/model/linkReportModel.js', () => ({ getReportsTodayByClient: today, getReportsYesterdayByClient: yesterday, getReportsTodayByShortcode: post }));
jest.unstable_mockModule('../src/model/linkReportKhususModel.js', () => ({ getReportsTodayByClient: today, getReportsTodayByShortcode: post }));
jest.unstable_mockModule('../src/model/instaPostModel.js', () => ({ getShortcodesTodayByClient: shortcodes, getShortcodesYesterdayByClient: shortcodes, getInstagramOperationalDateSql: jest.fn() }));
jest.unstable_mockModule('../src/model/instaPostKhususModel.js', () => ({ getShortcodesTodayByClient: shortcodes }));
jest.unstable_mockModule('../src/middleware/debugHandler.js', () => ({ sendDebug: jest.fn(), sendConsoleDebug: jest.fn() }));
jest.unstable_mockModule('../src/service/whatsappStatusChangeService.js', () => ({ applyWhatsAppStatusChange: jest.fn(), isWhatsAppStatusHistoryEnabled: jest.fn() }));
const { oprRequestHandlers } = await import('../src/handler/menu/oprRequestHandlers.js');
const original = process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
afterAll(() => { if (original === undefined) delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED; else process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = original; });
beforeEach(() => { process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = 'true'; jest.clearAllMocks(); });
const userModel = { getUsersByClientAndRole: jest.fn().mockResolvedValue([{ user_id: 'a' }]), getUsersByClient: jest.fn().mockResolvedValue([{ user_id: 'o' }]) };
test.each(['rekapLink', 'rekapLinkKemarin', 'rekapLinkKhusus', 'rekapLinkPerPost_action', 'rekapLinkKhususPerPost_action'])('%s filters reports to the KEDIRI amplifier roster', async (action) => {
  const session = { selected_client_id: 'KEDIRI', rekapShortcodes: ['abc'] };
  const wa = { sendMessage: jest.fn() };
  const pool = { query: jest.fn().mockResolvedValue({ rows: [{ nama: 'POLRES KEDIRI' }] }) };
  await oprRequestHandlers[action](session, '6281@s.whatsapp.net', '1', wa, pool, userModel);
  expect(userModel.getUsersByClientAndRole).toHaveBeenCalledWith('KEDIRI', 'amplifier');
  const output = wa.sendMessage.mock.calls.map((call) => call[1]).join('\n');
  expect(output).toContain('AMP_LINK');
  expect(output).not.toContain('OP_LINK');
  if (action === 'rekapLinkKhusus') expect(today).toHaveBeenCalledWith('KEDIRI', 'amplifier');
  if (action === 'rekapLinkKhususPerPost_action') expect(post).toHaveBeenCalledWith('KEDIRI', 'abc', 'amplifier');
});
test('empty amplifier roster fails closed', async () => {
  userModel.getUsersByClientAndRole.mockResolvedValueOnce([]);
  const wa = { sendMessage: jest.fn() };
  const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  await oprRequestHandlers.rekapLink({ selected_client_id: 'KEDIRI' }, '6281', '', wa, pool, userModel);
  expect(wa.sendMessage.mock.calls.map((call) => call[1]).join('\n')).not.toContain('OP_LINK');
  expect(userModel.getUsersByClient).not.toHaveBeenCalled();
});
test('NONAKTIF dual-role user explicitly removes amplifier only', async () => {
  const session = { selected_client_id: 'KEDIRI' };
  const wa = { sendMessage: jest.fn() };
  const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const model = {
    findUserByIdAndClient: jest.fn().mockResolvedValue({ user_id: '1', client_id: 'KEDIRI', status: true }),
    findUserById: jest.fn().mockResolvedValue({ user_id: '1', client_id: 'KEDIRI', status: true }),
    getUserRoles: jest.fn().mockResolvedValueOnce(['operator', 'amplifier']).mockResolvedValue(['operator']),
    deactivateRoleOrUser: jest.fn().mockResolvedValue({ user_id: '1', status: true }),
  };
  await oprRequestHandlers.updateStatus_nrp(session, '6281', '1', wa, pool, model);
  await oprRequestHandlers.updateStatus_value(session, '6281', '2', wa, pool, model);
  expect(model.deactivateRoleOrUser).not.toHaveBeenCalled();
  expect(session.step).toBe('updateStatus_chooseRole');
  await oprRequestHandlers.updateStatus_chooseRole(session, '6281', '2', wa, pool, model);
  expect(model.deactivateRoleOrUser).toHaveBeenCalledWith('1', 'amplifier');
  expect(model.deactivateRoleOrUser).not.toHaveBeenCalledWith('1', 'operator');
});
test('NONAKTIF rejects role change after target moves outside KEDIRI', async () => {
  const session = { selected_client_id: 'KEDIRI', updateStatusNRP: '1', updateStatusRoles: ['operator', 'amplifier'] };
  const wa = { sendMessage: jest.fn() };
  const model = { findUserById: jest.fn().mockResolvedValue({ user_id: '1', client_id: 'OTHER' }), deactivateRoleOrUser: jest.fn() };
  await oprRequestHandlers.updateStatus_chooseRole(session, '6281', '2', wa, {}, model);
  expect(model.deactivateRoleOrUser).not.toHaveBeenCalled();
});
