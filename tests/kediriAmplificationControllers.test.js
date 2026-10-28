import { jest } from '@jest/globals';
const normal = jest.fn().mockResolvedValue([]);
const special = jest.fn().mockResolvedValue([]);
jest.unstable_mockModule('../src/model/linkReportModel.js', () => ({ getRekapLinkByClient: normal }));
jest.unstable_mockModule('../src/model/linkReportKhususModel.js', () => ({ getRekapLinkByClient: special }));
jest.unstable_mockModule('../src/middleware/debugHandler.js', () => ({ sendConsoleDebug: jest.fn() }));
const { getAmplifyRekap } = await import('../src/controller/amplifyController.js');
const { getAmplifyKhususRekap } = await import('../src/controller/amplifyKhususController.js');
const saved = process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
afterAll(() => { if (saved === undefined) delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED; else process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = saved; });
beforeEach(() => { jest.clearAllMocks(); process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = 'true'; });
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
test.each([[getAmplifyRekap, normal], [getAmplifyKhususRekap, special]])('standard operator API switches roster (%p)', async (fn, model) => {
  const response = res();
  await fn({ query: { client_id: 'KEDIRI', scope: 'org', role: 'operator' }, user: { client_id: 'KEDIRI', client_ids: ['KEDIRI'] } }, response);
  expect(response.status).not.toHaveBeenCalled();
  expect(model).toHaveBeenCalled();
  expect(model.mock.calls[0].at(-1)).toEqual(expect.objectContaining({ userClientId: 'KEDIRI', userRoleFilter: 'amplifier' }));
});
test.each([[getAmplifyRekap, normal], [getAmplifyKhususRekap, special]])('legacy API also filters; cross-client or scope escalation fails (%p)', async (fn, model) => {
  await fn({ query: { client_id: 'KEDIRI' }, user: { client_id: 'KEDIRI', client_ids: ['KEDIRI'] } }, res());
  expect(model.mock.calls[0].at(-1)).toEqual(expect.objectContaining({ userRoleFilter: 'amplifier' }));
  model.mockClear();
  const denied = res();
  await fn({ query: { client_id: 'KEDIRI', role: 'KEDIRI', scope: 'org' }, user: { client_id: 'KEDIRI', client_ids: ['OTHER'] } }, denied);
  expect(denied.status).toHaveBeenCalledWith(403);
  expect(model).not.toHaveBeenCalled();
  const scopeDenied = res();
  await fn({ query: { client_id: 'KEDIRI', role: 'operator', scope: 'direktorat' }, user: { client_id: 'KEDIRI', client_ids: ['KEDIRI'] } }, scopeDenied);
  expect(scopeDenied.status).toHaveBeenCalledWith(403);
});
test.each([[getAmplifyRekap, normal], [getAmplifyKhususRekap, special]])('default-off keeps operator (%p)', async (fn, model) => {
  delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
  await fn({ query: { client_id: 'KEDIRI', role: 'operator', scope: 'org' }, user: { client_id: 'KEDIRI', client_ids: ['KEDIRI'] } }, res());
  expect(model.mock.calls[0].at(-1)).toEqual(expect.objectContaining({ userRoleFilter: 'operator' }));
});

test.each([[getAmplifyRekap, normal], [getAmplifyKhususRekap, special]])('multi-client claim authorizes KEDIRI with another primary client (%p)', async (fn, model) => {
  const response = res();
  await fn({ query: { client_id: 'KEDIRI', role: 'operator', scope: 'org' }, user: { client_id: 'OTHER', client_ids: ['other', 'kediri'] } }, response);
  expect(response.status).not.toHaveBeenCalled();
  expect(model.mock.calls[0].at(-1)).toEqual(expect.objectContaining({ userClientId: 'KEDIRI', userRoleFilter: 'amplifier' }));
});
