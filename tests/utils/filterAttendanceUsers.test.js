import { filterAttendanceUsers } from '../../src/utils/utilsHelper.js';

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
