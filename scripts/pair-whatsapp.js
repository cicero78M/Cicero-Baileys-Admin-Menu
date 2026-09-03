import dotenv from 'dotenv';
import { createBaileysClient } from '../src/service/baileysAdapter.js';

dotenv.config();

const phoneNumber = process.argv[2];
const clientId = process.env.ADMIN_WA_CLIENT_ID || 'wa-admin';

if (!phoneNumber) {
  console.error('Pemakaian: npm run wa:pair -- +6281234567890');
  process.exitCode = 1;
} else if (clientId === process.env.GATEWAY_WA_CLIENT_ID) {
  console.error('ADMIN_WA_CLIENT_ID tidak boleh sama dengan GATEWAY_WA_CLIENT_ID.');
  process.exitCode = 1;
} else {
  const client = await createBaileysClient(clientId);
  const shutdown = async (exitCode = 0) => {
    await client.destroy();
    process.exit(exitCode);
  };

  client.once('ready', async () => {
    console.log(`WhatsApp terhubung pada session ${clientId}.`);
    // Allow the final creds.update writes to settle before closing the
    // temporary pairing socket. PM2 will subsequently own this session.
    await new Promise((resolve) => setTimeout(resolve, 5000));
    void shutdown(0);
  });

  try {
    const code = await client.requestPairingCode(phoneNumber);
    const formattedCode = String(code).match(/.{1,4}/g)?.join('-') || code;
    console.log(`PAIRING CODE: ${formattedCode}`);
    console.log('Buka WhatsApp > Perangkat tertaut > Tautkan dengan nomor telepon, lalu masukkan kode di atas.');
  } catch (error) {
    console.error(`Gagal membuat pairing code: ${error.message}`);
    await shutdown(1);
  }
}
