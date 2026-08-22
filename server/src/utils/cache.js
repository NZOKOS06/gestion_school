/**
 * Couche cache applicative — Redis si REDIS_URL, sinon mémoire process.
 * Clés typiques : config:slug:{slug}, auth:user:{role}:{id}
 */
import { createLogger } from './logger.js';

const log = createLogger('Cache');

const memory = new Map();
let redis = null;
let redisReady = false;

const DEFAULT_TTL_SEC = 60;

function memoryGet(key) {
  const row = memory.get(key);
  if (!row) return null;
  if (row.expiresAt && Date.now() > row.expiresAt) {
    memory.delete(key);
    return null;
  }
  return row.value;
}

function memorySet(key, value, ttlSec) {
  memory.set(key, {
    value,
    expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0,
  });
}

function memoryDel(key) {
  memory.delete(key);
}

export async function initCache() {
  const url = process.env.REDIS_URL;
  if (!url) {
    log.info('REDIS_URL absent — cache mémoire process');
    return { backend: 'memory' };
  }
  try {
    const { default: Redis } = await import('ioredis');
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 5000,
    });
    redis.on('error', (err) => {
      log.warn({ err: err.message }, 'Redis error — fallback mémoire');
      redisReady = false;
    });
    redis.on('ready', () => {
      redisReady = true;
      log.info('Redis connecté');
    });
    await redis.connect();
    redisReady = true;
    return { backend: 'redis' };
  } catch (err) {
    log.warn({ err: err.message }, 'Impossible d’initialiser Redis — fallback mémoire');
    redis = null;
    redisReady = false;
    return { backend: 'memory' };
  }
}

export function getCacheBackend() {
  return redisReady && redis ? 'redis' : 'memory';
}

export async function cacheGet(key) {
  if (redisReady && redis) {
    try {
      const raw = await redis.get(key);
      if (raw == null) return null;
      return JSON.parse(raw);
    } catch {
      return memoryGet(key);
    }
  }
  return memoryGet(key);
}

export async function cacheSet(key, value, ttlSec = DEFAULT_TTL_SEC) {
  if (redisReady && redis) {
    try {
      const payload = JSON.stringify(value);
      if (ttlSec > 0) await redis.set(key, payload, 'EX', ttlSec);
      else await redis.set(key, payload);
      return;
    } catch {
      /* fallback */
    }
  }
  memorySet(key, value, ttlSec);
}

export async function cacheDel(key) {
  if (redisReady && redis) {
    try {
      await redis.del(key);
    } catch {
      /* ignore */
    }
  }
  memoryDel(key);
}

export async function cacheDelPattern(prefix) {
  if (redisReady && redis) {
    try {
      const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });
      const keys = [];
      for await (const batch of stream) {
        keys.push(...batch);
      }
      if (keys.length) await redis.del(...keys);
    } catch {
      /* ignore */
    }
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export const CacheKeys = {
  tenantConfig: (slug) => `config:slug:${slug}`,
  authUser: (role, id) => `auth:user:${role}:${id}`,
};
