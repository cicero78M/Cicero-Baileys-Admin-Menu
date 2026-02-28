import {
  filterAttendanceUsers,
  filterUsersBySatikDivision,
} from '../../src/utils/utilsHelper.js';

describe('filterAttendanceUsers', () => {
  test('tidak memfilter sat intelkam jika switch SATIK nonaktif', () => {
    const users = [
      { user_id: '1', divisi: 'Sat Intelkam' },
      { user_id: '2', divisi: 'Bag Ops' },
    ];

    const result = filterAttendanceUsers(users, 'direktorat', false);
    expect(result).toHaveLength(2);
  });

  test('memfilter sat intelkam jika switch SATIK aktif', () => {
    const users = [
      { user_id: '1', divisi: 'Sat Intelkam' },
      { user_id: '2', divisi: 'Sat Intel' },
      { user_id: '3', divisi: 'Bag Ops' },
    ];

    const result = filterAttendanceUsers(users, 'direktorat', true);
    expect(result).toEqual([{ user_id: '3', divisi: 'Bag Ops' }]);
  });
});

describe('filterUsersBySatikDivision', () => {
  const users = [
    { user_id: '1', divisi: 'Sat Intelkam' },
    { user_id: '2', divisi: 'Sat Intel' },
    { user_id: '3', divisi: 'Bag Ops' },
  ];

  test('mode include_only hanya mengambil sat intel/sat intelkam saat switch aktif', () => {
    const result = filterUsersBySatikDivision(users, true, 'include_only');
    expect(result).toEqual([
      { user_id: '1', divisi: 'Sat Intelkam' },
      { user_id: '2', divisi: 'Sat Intel' },
    ]);
  });

  test('switch nonaktif mengembalikan data apa adanya', () => {
    const result = filterUsersBySatikDivision(users, false, 'include_only');
    expect(result).toEqual(users);
  });
});
