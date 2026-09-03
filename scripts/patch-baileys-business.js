import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const baileysRoot = path.resolve('node_modules/@whiskeysockets/baileys/lib');

async function replaceOnce(file, original, replacement) {
  const source = await readFile(file, 'utf8');
  if (source.includes(replacement)) return false;
  const candidates = Array.isArray(original) ? original : [original];
  const matched = candidates.find((candidate) => source.includes(candidate));
  if (!matched) {
    throw new Error(`Baileys patch target tidak ditemukan: ${file}`);
  }
  await writeFile(file, source.replace(matched, replacement));
  return true;
}

const validateConnection = path.join(baileysRoot, 'Utils/validate-connection.js');
const socketFile = path.join(baileysRoot, 'Socket/socket.js');
const companionUtils = path.join(
  baileysRoot,
  'Utils/companion-reg-client-utils.js'
);

const businessEnabled = "process.env.WA_BAILEYS_BUSINESS_ACCOUNT === 'true'";

const changes = [];
changes.push(await replaceOnce(
  validateConnection,
  [
    "platform: config.browser[1].toLocaleLowerCase().includes('android')\n            ? proto.ClientPayload.UserAgent.Platform.ANDROID\n            : proto.ClientPayload.UserAgent.Platform.WEB,",
    `platform: ${businessEnabled}\n            ? proto.ClientPayload.UserAgent.Platform.SMB_ANDROID\n            : config.browser[1].toLocaleLowerCase().includes('android')\n                ? proto.ClientPayload.UserAgent.Platform.ANDROID\n                : proto.ClientPayload.UserAgent.Platform.WEB,`,
  ],
  `platform: ${businessEnabled}\n            ? proto.ClientPayload.UserAgent.Platform.MACOS\n            : config.browser[1].toLocaleLowerCase().includes('android')\n                ? proto.ClientPayload.UserAgent.Platform.ANDROID\n                : proto.ClientPayload.UserAgent.Platform.WEB,`
));
changes.push(await replaceOnce(
  validateConnection,
  "if (!config.browser[1].toLocaleLowerCase().includes('android')) {",
  `if (${businessEnabled} || !config.browser[1].toLocaleLowerCase().includes('android')) {`
));
changes.push(await replaceOnce(
  companionUtils,
  "export const getCompanionPlatformId = (browser) => {\n    return getCompanionWebClientType(browser).toString();\n};",
  `export const getCompanionPlatformId = (browser) => {\n    if (${businessEnabled}) {\n        return CompanionWebClientType.CHROME.toString();\n    }\n    return getCompanionWebClientType(browser).toString();\n};`
));
changes.push(await replaceOnce(
  socketFile,
  "content: `${browser[1]} (${browser[0]})`",
  `content: ${businessEnabled} ? 'Chrome (Windows)' : \`${'${browser[1]}'} (${'${browser[0]}'})\``
));

console.log(
  changes.some(Boolean)
    ? 'Baileys WhatsApp Business compatibility patch diterapkan.'
    : 'Baileys WhatsApp Business compatibility patch sudah aktif.'
);
