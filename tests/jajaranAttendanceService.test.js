import { jest } from '@jest/globals';

const mockFindClientById = jest.fn();
const mockFindAllClientsByType = jest.fn();
const mockGetClientsByRole = jest.fn();
const mockGetUsersByDirektorat = jest.fn();
const mockGetShortcodesTodayByClient = jest.fn();
const mockGetLikesSets = jest.fn();
const mockGetPostsTodayByClient = jest.fn();
const mockGetCommentsByVideoId = jest.fn();
const mockExtractUsernamesFromComments = jest.fn();

jest.unstable_mockModule('../src/service/clientService.js', () => ({
  findClientById: mockFindClientById,
  findAllClientsByType: mockFindAllClientsByType,
}));
jest.unstable_mockModule('../src/model/userModel.js', () => ({
  getClientsByRole: mockGetClientsByRole,
  getUsersByDirektorat: mockGetUsersByDirektorat,
}));
jest.unstable_mockModule('../src/model/instaPostModel.js', () => ({
  getShortcodesTodayByClient: mockGetShortcodesTodayByClient,
}));
jest.unstable_mockModule('../src/model/tiktokPostModel.js', () => ({
  getPostsTodayByClient: mockGetPostsTodayByClient,
}));
jest.unstable_mockModule('../src/utils/likesHelper.js', () => ({
  getLikesSets: mockGetLikesSets,
  normalizeUsername: (username) => (username || '').toString().trim().replace(/^@/, '').toLowerCase(),
}));
jest.unstable_mockModule('../src/model/tiktokCommentModel.js', () => ({
  getCommentsByVideoId: mockGetCommentsByVideoId,
}));
jest.unstable_mockModule('../src/handler/fetchabsensi/tiktok/absensiKomentarTiktok.js', () => ({
  extractUsernamesFromComments: mockExtractUsernamesFromComments,
  normalizeUsername: (username) => (username || '').toString().trim().replace(/^@/, '').toLowerCase(),
}));

let collectInstagramJajaranAttendance;
let collectTiktokJajaranAttendance;
let formatInstagramJajaranReport;
let formatTiktokJajaranReport;

beforeAll(async () => {
  ({
    collectInstagramJajaranAttendance,
    collectTiktokJajaranAttendance,
    formatInstagramJajaranReport,
    formatTiktokJajaranReport,
  } = await import('../src/service/jajaranAttendanceService.js'));
});

beforeEach(() => {
  mockFindClientById.mockReset();
  mockFindAllClientsByType.mockReset();
  mockGetClientsByRole.mockReset();
  mockGetUsersByDirektorat.mockReset();
  mockGetShortcodesTodayByClient.mockReset();
  mockGetLikesSets.mockReset();
  mockGetPostsTodayByClient.mockReset();
  mockGetCommentsByVideoId.mockReset();
  mockExtractUsernamesFromComments.mockReset();
});

describe('Instagram Jajaran Attendance', () => {
  test('throws error for non-direktorat client', async () => {
    mockFindClientById.mockResolvedValueOnce({
      client_id: 'POLRES01',
      nama: 'POLRES Test',
      client_type: 'org',
    });

    await expect(
      collectInstagramJajaranAttendance('POLRES01', null)
    ).rejects.toThrow('hanya tersedia untuk client bertipe Direktorat');
  });

  test('throws error when no Instagram posts today', async () => {
    mockFindClientById.mockResolvedValueOnce({
      client_id: 'DITBINMAS',
      nama: 'Direktorat Binmas',
      client_type: 'direktorat',
    });
    mockGetShortcodesTodayByClient.mockResolvedValueOnce([]);

    await expect(
      collectInstagramJajaranAttendance('DITBINMAS', null)
    ).rejects.toThrow('Tidak ada konten untuk tanggal operasional');
  });

  test('collects and sorts data correctly', async () => {
    // Setup direktorat client
    mockFindClientById
      .mockResolvedValueOnce({
        client_id: 'DITBINMAS',
        nama: 'Direktorat Binmas',
        client_type: 'direktorat',
      })
      // For each client in the loop
      .mockResolvedValueOnce({
        client_id: 'DITBINMAS',
        nama: 'Direktorat Binmas',
        client_type: 'direktorat',
      })
      .mockResolvedValueOnce({
        client_id: 'POLRES01',
        nama: 'Polres ABC',
        client_type: 'org',
      })
      .mockResolvedValueOnce({
        client_id: 'POLRES02',
        nama: 'Polres XYZ',
        client_type: 'org',
      });

    mockGetShortcodesTodayByClient.mockResolvedValueOnce(['sc1', 'sc2']);
    mockGetLikesSets.mockResolvedValueOnce([
      new Set(['user1', 'user2']),
      new Set(['user1']),
    ]);
    mockGetClientsByRole.mockResolvedValueOnce(['POLRES01', 'POLRES02']);
    mockFindAllClientsByType.mockResolvedValueOnce([
      { client_id: 'POLRES01' },
      { client_id: 'POLRES02' },
    ]);

    // Users for different clients
    mockGetUsersByDirektorat.mockResolvedValueOnce([
      // Direktorat users
      {
        user_id: 'u0',
        client_id: 'DITBINMAS',
        nama: 'Admin',
        insta: '@admin',
        status: true,
        divisi: 'BAG',
      },
      // POLRES01 users (high execution %)
      {
        user_id: 'u1',
        client_id: 'POLRES01',
        nama: 'User 1',
        insta: '@user1',
        status: true,
        divisi: 'BAG',
      },
      {
        user_id: 'u2',
        client_id: 'POLRES01',
        nama: 'User 2',
        insta: '@user2',
        status: true,
        divisi: 'BAG',
      },
      // POLRES02 users (low execution %)
      {
        user_id: 'u3',
        client_id: 'POLRES02',
        nama: 'User 3',
        insta: '@user3',
        status: true,
        divisi: 'BAG',
      },
      {
        user_id: 'u4',
        client_id: 'POLRES02',
        nama: 'User 4',
        insta: '',
        status: true,
        divisi: 'BAG',
      },
    ]);

    const result = await collectInstagramJajaranAttendance('DITBINMAS', null);

    expect(result.reportEntries).toBeDefined();
    expect(result.reportEntries.length).toBeGreaterThan(0);
    
    // Check that direktorat is first
    expect(result.reportEntries[0].clientType).toBe('direktorat');
    
    // Check sorting: higher percentage should come before lower
    const orgEntries = result.reportEntries.filter(e => e.clientType === 'org');
    if (orgEntries.length > 1) {
      expect(orgEntries[0].persenPelaksanaan).toBeGreaterThanOrEqual(
        orgEntries[1].persenPelaksanaan
      );
    }
  });


  test('uses selected client content source when roleFlag mismatches', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockFindClientById
      .mockResolvedValueOnce({
        client_id: 'DITINTELKAM',
        nama: 'Direktorat Intelkam',
        client_type: 'direktorat',
      })
      .mockResolvedValueOnce({
        client_id: 'DITINTELKAM',
        nama: 'Direktorat Intelkam',
        client_type: 'direktorat',
      });

    mockGetShortcodesTodayByClient.mockResolvedValueOnce(['intelSc1']);
    mockGetLikesSets.mockResolvedValueOnce([new Set(['inteluser'])]);
    mockGetClientsByRole.mockResolvedValueOnce([]);
    mockFindAllClientsByType.mockResolvedValueOnce([]);
    mockGetUsersByDirektorat.mockResolvedValueOnce([
      {
        user_id: 'u1',
        client_id: 'DITINTELKAM',
        nama: 'Intel User',
        insta: '@inteluser',
        status: true,
        divisi: 'BAG',
      },
    ]);

    const result = await collectInstagramJajaranAttendance('DITINTELKAM', 'superadmin');

    expect(result.kontenLinks).toContain('https://www.instagram.com/p/intelSc1');
    expect(mockGetShortcodesTodayByClient).toHaveBeenCalledWith('DITINTELKAM');
    expect(mockGetUsersByDirektorat).toHaveBeenCalledWith('ditintelkam', ['DITINTELKAM']);
    expect(warnSpy).toHaveBeenCalledWith(
      '[JAJARAN_ATTENDANCE] roleFlag mismatch for direktorat scope',
      expect.objectContaining({
        selectedClientId: 'DITINTELKAM',
        expectedRole: 'ditintelkam',
        providedRoleFlag: 'superadmin',
        fallbackRole: 'ditintelkam',
      })
    );

    warnSpy.mockRestore();
  });
  test('calculates execution percentage correctly', async () => {
    mockFindClientById
      .mockResolvedValueOnce({
        client_id: 'DITBINMAS',
        nama: 'Direktorat Binmas',
        client_type: 'direktorat',
      })
      .mockResolvedValueOnce({
        client_id: 'DITBINMAS',
        nama: 'Direktorat Binmas',
        client_type: 'direktorat',
      });

    mockGetShortcodesTodayByClient.mockResolvedValueOnce(['sc1', 'sc2']);
    mockGetLikesSets.mockResolvedValueOnce([
      new Set(['user1']),
      new Set(['user1']),
    ]);
    mockGetClientsByRole.mockResolvedValueOnce([]);
    mockFindAllClientsByType.mockResolvedValueOnce([]);

    mockGetUsersByDirektorat.mockResolvedValueOnce([
      {
        user_id: 'u1',
        client_id: 'DITBINMAS',
        nama: 'User 1',
        insta: '@user1',
        status: true,
        divisi: 'BAG',
      },
      {
        user_id: 'u2',
        client_id: 'DITBINMAS',
        nama: 'User 2',
        insta: '@user2',
        status: true,
        divisi: 'BAG',
      },
    ]);

    const result = await collectInstagramJajaranAttendance('DITBINMAS', null);

    expect(result.reportEntries[0].totalPersonil).toBe(2);
    expect(result.reportEntries[0].sudahInputUsername).toBe(2);
    expect(result.reportEntries[0].sudahMelaksanakan).toBe(1);
    expect(result.reportEntries[0].melaksanakanKurangLengkap).toBe(0);
    expect(result.reportEntries[0].belumMelaksanakan).toBe(1);
    expect(result.reportEntries[0].persenPelaksanaan).toBe(50);
  });
});

describe('TikTok Jajaran Attendance', () => {
  test('throws error for non-direktorat client', async () => {
    mockFindClientById.mockResolvedValueOnce({
      client_id: 'POLRES01',
      nama: 'POLRES Test',
      client_type: 'org',
    });

    await expect(
      collectTiktokJajaranAttendance('POLRES01', null)
    ).rejects.toThrow('hanya tersedia untuk client bertipe Direktorat');
  });

  test('throws error when no TikTok posts today', async () => {
    mockFindClientById.mockResolvedValueOnce({
      client_id: 'DITBINMAS',
      nama: 'Direktorat Binmas',
      client_type: 'direktorat',
    });
    mockGetPostsTodayByClient.mockResolvedValueOnce([]);

    await expect(
      collectTiktokJajaranAttendance('DITBINMAS', null)
    ).rejects.toThrow('Tidak ada konten pada akun Official TikTok');
  });

  test('collects and sorts data correctly', async () => {
    // Setup direktorat client
    mockFindClientById
      .mockResolvedValueOnce({
        client_id: 'DITBINMAS',
        nama: 'Direktorat Binmas',
        client_type: 'direktorat',
      })
      .mockResolvedValueOnce({
        client_id: 'DITBINMAS',
        nama: 'Direktorat Binmas',
        client_type: 'direktorat',
      })
      .mockResolvedValueOnce({
        client_id: 'POLRES01',
        nama: 'Polres ABC',
        client_type: 'org',
      });

    mockGetPostsTodayByClient.mockResolvedValueOnce([
      { video_id: 'vid1', link: 'https://tiktok.com/vid1' },
      { video_id: 'vid2', link: 'https://tiktok.com/vid2' },
    ]);
    mockGetCommentsByVideoId
      .mockResolvedValueOnce({ comments: [{ user: { unique_id: 'user1' } }] })
      .mockResolvedValueOnce({ comments: [{ user: { unique_id: 'user1' } }] });
    mockExtractUsernamesFromComments
      .mockReturnValueOnce(['user1'])
      .mockReturnValueOnce(['user1']);

    mockGetClientsByRole.mockResolvedValueOnce(['POLRES01']);
    mockFindAllClientsByType.mockResolvedValueOnce([{ client_id: 'POLRES01' }]);

    mockGetUsersByDirektorat.mockResolvedValueOnce([
      {
        user_id: 'u0',
        client_id: 'DITBINMAS',
        nama: 'Admin',
        tiktok: '@admin',
        status: true,
        divisi: 'BAG',
      },
      {
        user_id: 'u1',
        client_id: 'POLRES01',
        nama: 'User 1',
        tiktok: '@user1',
        status: true,
        divisi: 'BAG',
      },
    ]);

    const result = await collectTiktokJajaranAttendance('DITBINMAS', null);

    expect(result.reportEntries).toBeDefined();
    expect(result.reportEntries.length).toBeGreaterThan(0);
    expect(result.reportEntries[0].clientType).toBe('direktorat');
  });
});

describe('Report Formatting', () => {
  test('formats Instagram report correctly', () => {
    const data = {
      clientName: 'Direktorat Binmas',
      hari: 'Senin',
      tanggal: '19 Februari 2026',
      jam: '10:00',
      totalKonten: 2,
      kontenLinks: [
        'https://www.instagram.com/p/sc1',
        'https://www.instagram.com/p/sc2',
      ],
      reportEntries: [
        {
          clientId: 'DITBINMAS',
          clientName: 'Direktorat Binmas',
          clientType: 'direktorat',
          totalPersonil: 10,
          sudahInputUsername: 8,
          belumInputUsername: 2,
          sudahMelaksanakan: 6,
          melaksanakanKurangLengkap: 1,
          belumMelaksanakan: 1,
          persenPelaksanaan: 60,
        },
        {
          clientId: 'POLRES01',
          clientName: 'Polres ABC',
          clientType: 'org',
          totalPersonil: 5,
          sudahInputUsername: 5,
          belumInputUsername: 0,
          sudahMelaksanakan: 4,
          melaksanakanKurangLengkap: 1,
          belumMelaksanakan: 0,
          persenPelaksanaan: 80,
        },
      ],
    };

    const report = formatInstagramJajaranReport(data);

    expect(report).toContain('Direktorat Binmas');
    expect(report).toContain('Senin, 19 Februari 2026');
    expect(report).toContain('*Jumlah Konten:* 2');
    expect(report).toContain('*Jumlah Total Personil:* 15 pers');
    expect(report).toContain('Direktorat Binmas');
    expect(report).toContain('Polres ABC');
    expect(report).toContain('60.00%');
    expect(report).toContain('80.00%');
  });

  test('formats TikTok report correctly', () => {
    const data = {
      clientName: 'Direktorat Binmas',
      hari: 'Senin',
      tanggal: '19 Februari 2026',
      jam: '10:00',
      totalKonten: 2,
      kontenLinks: [
        'https://www.tiktok.com/@username/video/vid1',
        'https://www.tiktok.com/@username/video/vid2',
      ],
      reportEntries: [
        {
          clientId: 'DITBINMAS',
          clientName: 'Direktorat Binmas',
          clientType: 'direktorat',
          totalPersonil: 10,
          sudahInputUsername: 8,
          belumInputUsername: 2,
          sudahMelaksanakan: 6,
          melaksanakanKurangLengkap: 1,
          belumMelaksanakan: 1,
          persenPelaksanaan: 60,
        },
      ],
    };

    const report = formatTiktokJajaranReport(data);

    expect(report).toContain('Rekap Absensi Komentar TikTok Jajaran');
    expect(report).toContain('Direktorat Binmas');
    expect(report).toContain('Senin, 19 Februari 2026');
    expect(report).toContain('*Jumlah Konten:* 2');
    expect(report).toContain('60.00%');
  });
});

describe('Sorting Logic', () => {
  test('sorts direktorat first, then by user count groups, then by percentage', async () => {
    mockFindClientById
      .mockResolvedValueOnce({
        client_id: 'DITBINMAS',
        nama: 'Direktorat Binmas',
        client_type: 'direktorat',
      })
      // Multiple clients for sorting test
      .mockResolvedValueOnce({
        client_id: 'DITBINMAS',
        nama: 'Direktorat Binmas',
        client_type: 'direktorat',
      })
      .mockResolvedValueOnce({
        client_id: 'BIG_POLRES',
        nama: 'Big Polres',
        client_type: 'org',
      })
      .mockResolvedValueOnce({
        client_id: 'SMALL_POLRES',
        nama: 'Small Polres',
        client_type: 'org',
      });

    mockGetShortcodesTodayByClient.mockResolvedValueOnce(['sc1']);
    mockGetLikesSets.mockResolvedValueOnce([new Set(['user1', 'user2'])]);
    mockGetClientsByRole.mockResolvedValueOnce(['BIG_POLRES', 'SMALL_POLRES']);
    mockFindAllClientsByType.mockResolvedValueOnce([
      { client_id: 'BIG_POLRES' },
      { client_id: 'SMALL_POLRES' },
    ]);

    // Create users with different counts for different groups
    const createUsers = (clientId, count, hasUsername) => {
      return Array.from({ length: count }, (_, i) => ({
        user_id: `${clientId}_u${i}`,
        client_id: clientId,
        nama: `User ${i}`,
        insta: hasUsername ? `@user${i}` : '',
        status: true,
        divisi: 'BAG',
      }));
    };

    mockGetUsersByDirektorat.mockResolvedValueOnce([
      ...createUsers('DITBINMAS', 10, true),
      ...createUsers('BIG_POLRES', 1200, false), // >1000 users, low execution
      ...createUsers('SMALL_POLRES', 400, true), // <500 users, high execution (user1, user2 liked)
    ]);

    const result = await collectInstagramJajaranAttendance('DITBINMAS', null);

    // Direktorat should be first
    expect(result.reportEntries[0].clientType).toBe('direktorat');
    
    // Then ORG clients
    const orgEntries = result.reportEntries.filter(e => e.clientType === 'org');
    
    // BIG_POLRES (>1000) should come before SMALL_POLRES (<500) due to group
    const bigPolresIndex = result.reportEntries.findIndex(e => e.clientId === 'BIG_POLRES');
    const smallPolresIndex = result.reportEntries.findIndex(e => e.clientId === 'SMALL_POLRES');
    expect(bigPolresIndex).toBeLessThan(smallPolresIndex);
  });
});
