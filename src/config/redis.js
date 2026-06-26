import { Redis } from 'ioredis'
import config from './index.js'

let redis = null

export function getRedis() {
  if (redis) return redis
  if (!config.redis.url) return null

  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 1,
    retryStrategy() { return null },
    lazyConnect: true,
    enableOfflineQueue: false,
  })

  redis.on('error', () => {})
  redis.on('connect', () => {})

  redis.connect().catch(() => {
    redis = null
  })

  return redis
}

export function isRedisReady() {
  return redis?.status === 'ready' || false
}

export async function closeRedis() {
  if (redis) {
    await redis.quit().catch(() => {})
    redis = null
  }
}
