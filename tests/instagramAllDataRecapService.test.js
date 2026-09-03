import { jest } from '@jest/globals';
import { unlink } from 'fs/promises';
import XLSX from 'xlsx';

process.env.TZ = 'Asia/Jakarta';

const mockGetRekapLikesByClient = jest.fn();
const mockFindAllClientsByType = jest.fn();

jest.unstable_mockModule('../src/model/instaLikeModel.js', () => ({
  getRekapLikesByClient: mockGetRekapLikesByClient,
}));
jest.unstable_mockModule('../src/service/clientService.js', () => ({
  findAllClientsByType: mockFindAllClientsByType,
}));
const { generateInstagramAllDataRecap } = await import(
  '../src/service/instagramAllDataRecapService.js'
);

describe('generateInstagramAllDataRecap', () => {
  beforeEach(() => {
    mockGetRekapLikesByClient.mockReset();
    mockFindAllClientsByType.mockReset();
    mockFindAllClientsByType.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('builds recap spanning from previous September when before September', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-07-15T00:00:00Z'));
    mockGetRekapLikesByClient.mockResolvedValue({
      rows: [{ client_name: 'POLRES RANGE', jumlah_like: 1 }],
      totalKonten: 1,
    });

    const { filePath } = await generateInstagramAllDataRecap({
      clientId: 'DITBINMAS',
      roleFlag: 'ditbinmas',
    });
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Instagram All Data'];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const monthHeaders = aoa[2].slice(1, -1);

    expect(monthHeaders[0]).toBe('September 2023');
    expect(monthHeaders.at(-1)).toBe('Juli 2024');
    expect(monthHeaders).toHaveLength(11);

    await unlink(filePath);
  });

  test('aggregates likes per polres with monthly and grand totals', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-10-05T00:00:00Z'));
    mockGetRekapLikesByClient.mockImplementation(async (_client, _period, monthKey) => {
      if (monthKey === '2024-09') {
        return {
          rows: [
            { client_id: 'POLRES_A', client_name: 'POLRES A', jumlah_like: 10 },
            { client_id: 'POLRES_B', client_name: 'POLRES B', jumlah_like: 5 },
          ],
          totalKonten: 0,
        };
      }
      if (monthKey === '2024-10') {
        return {
          rows: [{ client_id: 'POLRES_A', client_name: 'POLRES A', jumlah_like: 1 }],
          totalKonten: 0,
        };
      }
      return { rows: [], totalKonten: 0 };
    });
    mockFindAllClientsByType.mockResolvedValue([
      { client_id: 'POLRES_A', nama: 'POLRES A', client_type: 'org' },
      { client_id: 'POLRES_B', nama: 'POLRES B', client_type: 'org' },
      { client_id: 'POLRES_C', nama: 'POLRES C', client_type: 'org' },
    ]);

    const { filePath } = await generateInstagramAllDataRecap({
      clientId: 'DITBINMAS',
    });
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Instagram All Data'];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    expect(aoa[2].slice(1, -1)).toEqual(['September 2024', 'Oktober 2024']);
    expect(aoa[2][0]).toBe('Polres');
    expect(aoa[3]).toEqual(['POLRES A', 10, 1, 11]);
    expect(aoa[4]).toEqual(['POLRES B', 5, 0, 5]);
    expect(aoa[5]).toEqual(['POLRES C', 0, 0, 0]);
    expect(aoa[6]).toEqual(['TOTAL', 15, 1, 16]);
    expect(workbook.SheetNames).toEqual(['Instagram All Data']);

    await unlink(filePath);
  });

  test('forces Ditbinmas scope even when caller session role is operator', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-09-05T00:00:00Z'));
    mockGetRekapLikesByClient.mockResolvedValue({
      rows: [{ client_id: 'NGAWI', client_name: 'POLRES NGAWI', jumlah_like: 7 }],
      totalKonten: 1,
    });

    const { filePath } = await generateInstagramAllDataRecap({
      clientId: 'DITBINMAS',
      roleFlag: 'operator',
    });

    expect(mockGetRekapLikesByClient).toHaveBeenCalledWith(
      'DITBINMAS',
      'bulanan',
      '2024-09',
      null,
      null,
      'ditbinmas',
      { regionalId: undefined }
    );

    await unlink(filePath);
  });
});
