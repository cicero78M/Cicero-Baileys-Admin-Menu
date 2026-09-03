import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { createBaileysClient } from '../src/service/baileysAdapter.js';

dotenv.config();

const clientId = process.env.ADMIN_WA_CLIENT_ID || 'wa-admin';
const outputPath = process.env.WA_PAIRING_QR_OUTPUT || '/tmp/cicero-wa-pairing.png';
const client = await createBaileysClient(clientId);
let qrWritten = false;

client.on('qr', async (qr) => {
  if (qrWritten) return;
  qrWritten = true;
  await QRCode.toFile(outputPath, qr, {
    errorCorrectionLevel: 'M',
    margin: 3,
    width: 640,
  });
  console.log(`QR_READY: ${outputPath}`);
});

client.once('ready', async () => {
  console.log(`WhatsApp terhubung pada session ${clientId}.`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await client.destroy();
  process.exit(0);
});
