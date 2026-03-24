import { jest } from '@jest/globals';

import { PRIORITY_USER_NAMES } from '../src/utils/constants.js';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/repository/db.js', () => ({
  query: mockQuery,
}));

let getRekapKomentarByClient;

beforeAll(async () => {
  ({ getRekapKomentarByClient } = await import('../src/model/tiktokCommentModel.js'));
});

beforeEach(() => {
  mockQuery.mockReset();
});

function mockClientType(type = 'instansi') {
  mockQuery.mockResolvedValueOnce({ rows: [{ client_type: type }] });
}

const PRIORITY_UPPER = PRIORITY_USER_NAMES.map(name => name.toUpperCase());

function expectPriorityParams(actualParams, prefixLength) {
  expect(actualParams.slice(-PRIORITY_UPPER.length)).toEqual(PRIORITY_UPPER);
}

test('getRekapKomentarByClient uses updated_at BETWEEN for date range', async () => {
  mockClientType();
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await getRekapKomentarByClient('POLRES', 'harian', null, '2024-01-01', '2024-01-31');
  expect(mockQuery).toHaveBeenCalledTimes(2);
  expect(mockQuery.mock.calls[1][0]).toContain('c.updated_at');
  expect(mockQuery.mock.calls[1][0]).toMatch(/BETWEEN \$\d+::date AND \$\d+::date/);
  const params = mockQuery.mock.calls[1][1];
  expect(params).toEqual(expect.arrayContaining(['POLRES', '2024-01-01', '2024-01-31']));
  expectPriorityParams(params, 0);
});

test('getRekapKomentarByClient filters directorate users by ditbinmas role only', async () => {
  mockClientType('direktorat');
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await getRekapKomentarByClient('ditbinmas', 'harian', undefined, undefined, undefined, 'ditbinmas');
  expect(mockQuery).toHaveBeenCalledTimes(2);
  expect(mockQuery.mock.calls[0][0]).toContain('SELECT client_type FROM clients');
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain('EXISTS (');
  expect(sql).toMatch(/(LOWER\(r\.role_name\) = LOWER\(\$\d+\)|r\.role_name = \$\d+)/);
  expect(sql).toContain('LEFT JOIN tiktok_post_roles pr');
  expect(sql).toMatch(/LOWER\(pr\.role_name\) = LOWER\(\$\d+\)/);
  expect(sql).toContain('LOWER(p.client_id) = LOWER(');
  expect(sql).toContain('OR LOWER(pr.role_name) = LOWER(');
  expect(sql).not.toContain('NOT EXISTS (');
  expect(sql).not.toContain('LOWER(u.client_id) = ANY');
  const params = mockQuery.mock.calls[1][1];
  expect(params.slice(0, 1)).toEqual(['ditbinmas']);
  expectPriorityParams(params, 1);
});

test('ditbinmas recap counts only ditbinmas-scoped posts and respects tanggal filter', async () => {
  mockClientType('direktorat');
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await getRekapKomentarByClient('ditbinmas', 'harian', '2024-02-10', undefined, undefined, 'ditbinmas');

  expect(mockQuery).toHaveBeenCalledTimes(2);
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toMatch(/LOWER\(p\.client_id\) = LOWER\(\$\d+\) OR LOWER\(pr\.role_name\) = LOWER\(\$\d+\)/);
  expect(sql).toContain('p.created_at AT TIME ZONE');
  expect(sql).toContain('::date = $1::date');
  const params = mockQuery.mock.calls[1][1];
  expect(params.slice(0, 2)).toEqual(['2024-02-10', 'ditbinmas']);
  expectPriorityParams(params, 2);
});

test('getRekapKomentarByClient orders nama by priority list', async () => {
  mockClientType();
  mockQuery.mockResolvedValueOnce({ rows: [] });
  await getRekapKomentarByClient('POLRES');
  const sql = mockQuery.mock.calls[1][0];
  const params = mockQuery.mock.calls[1][1];
  expect(params.slice(0, 1)).toEqual(['POLRES']);
  expectPriorityParams(params, 1);
  const matches = sql.match(/WHEN UPPER\(u\.nama\) = \$\d+/g) || [];
  expect(matches.length).toBeGreaterThanOrEqual(PRIORITY_UPPER.length);
  expect(sql).toContain('CASE WHEN');
  expect(sql).toContain('UPPER(u.nama)');
});

test('mingguan tanpa tanggal memakai basis minggu Asia/Jakarta', async () => {
  mockClientType();
  mockQuery.mockResolvedValueOnce({ rows: [] });

  await getRekapKomentarByClient('POLRES', 'mingguan');

  expect(mockQuery).toHaveBeenCalledTimes(2);
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain(
    "date_trunc('week', (c.updated_at AT TIME ZONE 'Asia/Jakarta')) = date_trunc('week', NOW() AT TIME ZONE 'Asia/Jakarta')"
  );
  expect(sql).toContain(
    "date_trunc('week', (p.created_at AT TIME ZONE 'Asia/Jakarta')) = date_trunc('week', NOW() AT TIME ZONE 'Asia/Jakarta')"
  );
  expect(sql).not.toContain("date_trunc('week', NOW())");
});

test('mingguan boundary tetap mengikuti kalender Jakarta saat zona server lintas minggu UTC', async () => {
  mockClientType();
  mockQuery.mockResolvedValueOnce({ rows: [] });
  const realDateNow = Date.now;
  Date.now = jest.fn(() => new Date('2024-03-31T17:30:00.000Z').getTime());

  try {
    await getRekapKomentarByClient('POLRES', 'mingguan');
  } finally {
    Date.now = realDateNow;
  }

  expect(mockQuery).toHaveBeenCalledTimes(2);
  const sql = mockQuery.mock.calls[1][0];
  expect(sql).toContain("NOW() AT TIME ZONE 'Asia/Jakarta'");
  expect(sql).toContain("date_trunc('week', (c.updated_at AT TIME ZONE 'Asia/Jakarta'))");
  expect(sql).toContain("date_trunc('week', (p.created_at AT TIME ZONE 'Asia/Jakarta'))");
});
