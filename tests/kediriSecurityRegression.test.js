import { jest } from '@jest/globals';
const query = jest.fn();
const find = jest.fn();
jest.unstable_mockModule('../src/repository/db.js', () => ({ query }));
jest.unstable_mockModule('../src/model/userModel.js', () => ({ findUserById: find }));
const { authorizeReportMutation } = await import('../src/utils/reportMutationAuthorization.js');
const saved = process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
afterAll(() => { if (saved === undefined) delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED; else process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = saved; });
beforeEach(() => { jest.clearAllMocks(); process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = 'true'; find.mockResolvedValue({ user_id: 'a', client_id: 'KEDIRI', status: true, amplifier: true }); query.mockResolvedValue({ rows: [{ client_id: 'KEDIRI' }] }); });
const req = (user, body = { user_id: 'a', shortcode: 'p' }) => ({ user, body, params: { shortcode: 'p' } });
test('person may not impersonate another person', async () => {
  await expect(authorizeReportMutation(req({ role: 'user', user_id: 'b' }), { create: true })).rejects.toMatchObject({ statusCode: 403 });
  expect(query).not.toHaveBeenCalled();
});
test('operator must be authorized for target tenant and post tenant', async () => {
  await expect(authorizeReportMutation(req({ role: 'operator', client_id: 'OTHER' }), { create: true })).rejects.toMatchObject({ statusCode: 403 });
  query.mockResolvedValue({ rows: [{ client_id: 'OTHER' }] });
  await expect(authorizeReportMutation(req({ role: 'operator', client_id: 'KEDIRI' }), { create: true })).rejects.toMatchObject({ statusCode: 403 });
});
test('scope and body client cannot be spoofed, disabled membership denied', async () => {
  const user = { role: 'operator', client_id: 'KEDIRI', client_ids: ['OTHER'] };
  await expect(authorizeReportMutation(req(user), { special: true, create: true })).rejects.toMatchObject({ statusCode: 403 });
  await expect(authorizeReportMutation(req({ role: 'operator', client_id: 'KEDIRI' }, { user_id: 'a', client_id: 'OTHER' }), { special: true, create: true })).rejects.toMatchObject({ statusCode: 403 });
  find.mockResolvedValue({ user_id: 'a', client_id: 'KEDIRI', status: true, amplifier: false });
  await expect(authorizeReportMutation(req({ role: 'user', user_id: 'a' }), { create: true })).rejects.toMatchObject({ statusCode: 403 });
});
test('self and authorized scoped operator can submit', async () => {
  await expect(authorizeReportMutation(req({ role: 'user', user_id: 'a' }), { create: true })).resolves.toMatchObject({ user_id: 'a' });
  await expect(authorizeReportMutation(req({ role: 'operator', client_id: 'OTHER', client_ids: ['KEDIRI'] }), { special: true, create: true })).resolves.toMatchObject({ user_id: 'a' });
});
