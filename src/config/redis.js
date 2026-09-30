import { createClient } from '@redis/client';
import { env } from './env.js';

const parseSentinels = (raw) => String(raw || '').split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => { const url = new URL(entry.includes('://') ? entry : `redis://${entry}`); return { host: url.hostname, port: Number(url.port || 26379) }; });
const sentinelMode = Boolean(env.REDIS_SENTINELS || env.REDIS_SENTINEL_NAME);
if (sentinelMode && (!env.REDIS_SENTINELS || !env.REDIS_SENTINEL_NAME)) throw new Error('REDIS_SENTINELS and REDIS_SENTINEL_NAME must be configured together');
const createSentinelClient = async () => { const { default: IORedis } = await import('ioredis'); const client = new IORedis({ sentinels: parseSentinels(env.REDIS_SENTINELS), name: env.REDIS_SENTINEL_NAME, ...(env.REDIS_USERNAME ? { username: env.REDIS_USERNAME } : {}), ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}), ...(env.REDIS_TLS ? { tls: {} } : {}), connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS, maxRetriesPerRequest: null, retryStrategy: (times) => Math.min(250 * (2 ** Math.min(times - 1, 5)), 5000) }); client.on('error', (err) => console.error('Redis Client Error', err)); return { on: (...args) => client.on(...args), connect: async () => undefined, get: (...args) => client.get(...args), exists: (...args) => client.exists(...args), sAdd: (key, ...members) => client.sadd(key, ...members.flat()), set: (key, value, options = {}) => { const args = []; if (options.NX) args.push('NX'); if (typeof options.EX === 'number') args.push('EX', options.EX); if (typeof options.PX === 'number') args.push('PX', options.PX); return client.set(key, value, ...args); }, quit: () => client.quit() }; };
const redis = sentinelMode ? await createSentinelClient() : createClient({ url: env.REDIS_URL });
if (!sentinelMode) redis.on('error', (err) => console.error('Redis Client Error', err));
if (!sentinelMode) await redis.connect();
export default redis;
