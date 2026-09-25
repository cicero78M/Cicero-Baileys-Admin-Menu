import dotenv from 'dotenv';
import { cleanEnv, str, port, bool, num } from 'envalid';

dotenv.config();

export const env = cleanEnv(process.env, {
  PORT: port({ default: 3000 }),
  DB_USER: str({ default: '' }),
  DB_HOST: str({ default: '' }),
  DB_NAME: str({ default: '' }),
  DB_PASS: str({ default: '' }),
  DB_PORT: port({ default: 5432 }),
  // Keep this service from consuming the database capacity needed by the
  // web backend and other CICERO workers.
  // Keep the aggregate connection budget bounded across PM2 services.
  DB_POOL_MAX: num({ default: 2 }),
  DB_IDLE_TIMEOUT_MS: num({ default: 30000 }),
  DB_CONNECT_TIMEOUT_MS: num({ default: 5000 }),
  DB_QUERY_TIMEOUT_MS: num({ default: 12000 }),
  DB_DRIVER: str({ default: 'postgres' }),
  REDIS_URL: str({ default: 'redis://localhost:6379' }),
  CORS_ORIGIN: str({ default: '*' }),
  ALLOW_DUPLICATE_REQUESTS: bool({ default: false }),
  SECRET_KEY: str({ default: '' }),
  JWT_SECRET: str(),
  RAPIDAPI_KEY: str({ default: '' }),
  RAPIDAPI_FALLBACK_KEY: str({ default: '' }),
  RAPIDAPI_FALLBACK_HOST: str({ default: '' }),
  ADMIN_WHATSAPP: str({ default: '' }),
  ADMIN_WA_CLIENT_ID: str({ default: 'wa-admin' }),
  APP_SESSION_NAME: str({ default: '' }),
  WA_WEB_VERSION: str({ default: '' }),
  WA_WEB_VERSION_CACHE_URL: str({
    default:
      'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json'
  }),
  WA_WWEBJS_PROTOCOL_TIMEOUT_MS: num({ default: 120000 }),
  ENABLE_DIRREQUEST_GROUP: bool({ default: true }),
  DEBUG_FETCH_INSTAGRAM: bool({ default: false }),
  INSTAGRAM_LIKES_MAX_PAGES: num({ default: 0 }),
  INSTAGRAM_COMMENTS_MAX_PAGES: num({ default: 10 }),
  INSTAGRAM_COMMENTS_PAGE_DELAY_MS: num({ default: 3000 }),
  BACKUP_DIR: str({ default: 'backups' }),
  GOOGLE_DRIVE_FOLDER_ID: str({ default: '' }),
  GOOGLE_SERVICE_ACCOUNT: str({ default: '' }),
  GOOGLE_IMPERSONATE_EMAIL: str({ default: '' }),
  GOOGLE_CONTACT_SCOPE: str({
    default: 'https://www.googleapis.com/auth/contacts'
  }),
  DASHBOARD_PREMIUM_ALLOWED_TIERS: str({ default: 'tier1,tier2,premium_1' })
});
