import { jest } from '@jest/globals';
const report = jest.fn().mockResolvedValue([]);
jest.unstable_mockModule('../src/model/linkReportModel.js', () => ({ getReportsThisMonthByClient: report }));
jest.unstable_mockModule('../src/model/userModel.js', () => ({ findUserById: jest.fn() }));
jest.unstable_mockModule('../src/service/waService.js', () => ({ default: {}, waitForWaReady: jest.fn() }));
jest.unstable_mockModule('../src/service/amplifyExportService.js', () => ({ generateLinkReportExcelBuffer: jest.fn().mockReturnValue(Buffer.from('test')) }));
const { downloadMonthlyLinkReportExcel } = await import('../src/controller/linkReportController.js');
const saved = process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED;
afterAll(() => { if (saved === undefined) delete process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED; else process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = saved; });
beforeEach(() => { jest.clearAllMocks(); process.env.KEDIRI_AMPLIFIER_ROLE_ENABLED = 'true'; });
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn(), send: jest.fn() });
test('denies token without KEDIRI scope even with spoofed query', async () => {
  const response = res();
  await downloadMonthlyLinkReportExcel({ query: { client_id: 'KEDIRI', role: 'KEDIRI' }, user: { client_id: 'OTHER' } }, response, jest.fn());
  expect(response.status).toHaveBeenCalledWith(403);
  expect(report).not.toHaveBeenCalled();
});
test('allows explicitly authorized multi-client token', async () => {
  const response = res();
  await downloadMonthlyLinkReportExcel({ query: { client_id: 'KEDIRI' }, user: { client_id: 'OTHER', client_ids: ['OTHER', 'kediri'] } }, response, jest.fn());
  expect(response.status).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith('KEDIRI');
});
