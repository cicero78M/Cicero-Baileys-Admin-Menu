import { jest } from '@jest/globals';

const withTransaction = jest.fn();

jest.unstable_mockModule('../src/repository/db.js', () => ({ withTransaction }));

const { applyWhatsAppStatusChange, isWhatsAppStatusHistoryEnabled } =
  await import('../src/service/whatsappStatusChangeService.js');

function setupTransaction({ actor, target, roles = ['operator'], failHistory = false }) {
  withTransaction.mockImplementation(async (callback) => {
    const db = {
      query: jest.fn(async (sql) => {
        if (sql.includes('regexp_replace')) {
          if (!actor) return { rows: [] };
          return { rows: [{ ...actor, roles }] };
        }
        if (sql.includes('FROM "user" WHERE user_id=$1 FOR UPDATE')) return { rows: [target] };
        if (sql.includes('FROM user_roles ur')) return { rows: roles.map((role_name) => ({ role_name })) };
        if (sql.includes('INSERT INTO user_status_history')) {
          if (failHistory) throw new Error('history failure');
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
    return callback(db);
  });
}

beforeEach(() => {
  withTransaction.mockReset();
  process.env.WHATSAPP_USER_STATUS_HISTORY_DUAL_WRITE = 'true';
});

afterEach(() => {
  delete process.env.WHATSAPP_USER_STATUS_HISTORY_DUAL_WRITE;
});

test('feature flag is explicit', () => {
  expect(isWhatsAppStatusHistoryEnabled()).toBe(true);
});

test('writes deactivation history atomically with resolved WhatsApp actor', async () => {
  setupTransaction({
    actor: { user_id: '87020990', nama: 'OPERATOR WA', title: 'BRIPKA', client_id: 'DITBINMAS', status: true },
    target: { user_id: '68020196', nama: 'TARGET', title: 'BRIPTU', divisi: 'SAT', client_id: 'DITBINMAS', status: true, whatsapp: '628000000001' },
    roles: ['operator'],
  });

  const result = await applyWhatsAppStatusChange({
    userId: '68020196',
    actionType: 'role_remove',
    roleName: 'operator',
    chatId: '628000000099@s.whatsapp.net',
    targetClientId: 'DITBINMAS',
    reasonCode: 'pensiun',
    reasonText: 'pensiun',
  });

  expect(result.status).toBe(false);
  expect(withTransaction).toHaveBeenCalledTimes(1);
});

test('rejects an unlinked or incomplete WhatsApp actor before mutation', async () => {
  setupTransaction({
    actor: { user_id: '87020990', nama: '', title: 'BRIPKA', client_id: 'DITBINMAS', status: true },
    target: { user_id: '68020196', status: true, client_id: 'DITBINMAS' },
  });

  await expect(applyWhatsAppStatusChange({
    userId: '68020196',
    actionType: 'role_remove',
    roleName: 'operator',
    chatId: '628000000099',
    targetClientId: 'DITBINMAS',
  })).rejects.toThrow('Lengkapi nama');
});

test('rolls back when history insert fails', async () => {
  setupTransaction({
    actor: { user_id: '87020990', nama: 'OPERATOR WA', title: 'BRIPKA', client_id: 'DITBINMAS', status: true },
    target: { user_id: '68020196', nama: 'TARGET', title: 'BRIPTU', divisi: 'SAT', client_id: 'DITBINMAS', status: true },
    failHistory: true,
  });

  await expect(applyWhatsAppStatusChange({
    userId: '68020196',
    actionType: 'deactivate',
    chatId: '628000000099',
    targetClientId: 'DITBINMAS',
  })).rejects.toThrow('history failure');
});
