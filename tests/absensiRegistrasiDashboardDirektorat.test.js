import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({ query: mockQuery }));

const { absensiRegistrasiDashboardDirektorat } = await import(
  '../src/handler/fetchabsensi/dashboard/absensiRegistrasiDashboardDirektorat.js'
);

beforeEach(() => {
  mockQuery.mockClear();
});

test('menu 11 only counts selected directorate client_id with client_type direktorat', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM roles')) return { rows: [{ role_id: 10 }] };
    if (sql.includes('FROM clients') && sql.includes('LIMIT 1')) {
      return {
        rows: [{ client_id: 'DITINTELKAM', nama: 'Direktorat Intelkam', client_type: 'direktorat' }],
      };
    }
    if (sql.includes('COUNT(DISTINCT du.dashboard_user_id) AS dashboard_user')) {
      return { rows: [{ dashboard_user: 3 }] };
    }
    if (sql.includes('COUNT(DISTINCT du.dashboard_user_id) AS operator')) {
      return { rows: [{ operator: 1 }] };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('DITINTELKAM');

  expect(mockQuery).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining("LOWER(TRIM(c.client_type)) = 'direktorat'"),
    ['ditintelkam', 'DITINTELKAM']
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    4,
    expect.stringContaining("LOWER(TRIM(c.client_type)) = 'direktorat'"),
    ['ditintelkam', 'DITINTELKAM', expect.any(Date)]
  );
  expect(mockQuery).toHaveBeenCalledTimes(4);
  expect(msg).toMatch(/DIREKTORAT INTELKAM : 3 Direktorat \(1 absensi web\)/);
  expect(msg).toMatch(/hanya menghitung user dashboard dengan client_id yang sama dengan Direktorat terpilih/);
  expect(msg).not.toMatch(/client ORG/i);
});

test('fails fast when directorate role mapping is missing', async () => {
  await expect(absensiRegistrasiDashboardDirektorat('CUSTOM_DIT')).rejects.toThrow(
    'Role mapping untuk client Direktorat "CUSTOM_DIT" belum terdaftar.'
  );
  expect(mockQuery).toHaveBeenCalledTimes(0);
});

test('fails fast when mapped role is missing from roles table', async () => {
  mockQuery.mockResolvedValue({ rows: [] });

  await expect(absensiRegistrasiDashboardDirektorat('DITLANTAS')).rejects.toThrow(
    'Konfigurasi role belum sinkron antara mapping aplikasi dan database.'
  );

  expect(mockQuery).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('FROM roles'),
    ['ditlantas']
  );
  expect(mockQuery).toHaveBeenCalledTimes(1);
});

test('fails fast when selected client_id is not found in clients table', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM roles') && sql.includes('LIMIT 1')) {
      return { rows: [{ role_id: 5 }] };
    }
    if (sql.includes('FROM clients') && sql.includes('LIMIT 1')) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  await expect(absensiRegistrasiDashboardDirektorat('DITBINMAS')).rejects.toThrow(
    'Client Direktorat "DITBINMAS" tidak ditemukan pada tabel clients.'
  );
});

test('fails fast when selected client is not tipe direktorat', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM roles')) return { rows: [{ role_id: 6 }] };
    if (sql.includes('FROM clients') && sql.includes('LIMIT 1')) {
      return { rows: [{ client_id: 'DITBINMAS', nama: 'Dit Binmas', client_type: 'org' }] };
    }
    return { rows: [] };
  });

  await expect(absensiRegistrasiDashboardDirektorat('DITBINMAS')).rejects.toThrow(
    'Client "DITBINMAS" bukan tipe direktorat'
  );
});
