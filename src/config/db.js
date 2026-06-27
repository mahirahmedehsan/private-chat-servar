import mongoose from 'mongoose'
import config from './index.js'

let isConnected = false
let connecting = null
let lastAttemptAt = 0
const BACKOFF_MS = 3000

export async function connectDB() {
  if (isConnected) return
  if (connecting) return connecting

  // Rate-limit reconnect attempts to avoid hammering on every request
  const now = Date.now()
  if (!connecting && now - lastAttemptAt < BACKOFF_MS && lastAttemptAt > 0) {
    return
  }

  connecting = (async () => {
    lastAttemptAt = Date.now()
    try {
      mongoose.set('strictQuery', true)
      await mongoose.connect(config.mongodb.uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 3000,
        maxPoolSize: 3,
        minPoolSize: 0,
        socketTimeoutMS: 30000,
        waitQueueTimeoutMS: 2000,
        heartbeatFrequencyMS: 10000,
      })
      isConnected = true
      console.log('MongoDB connected')
    } catch (error) {
      console.warn(`MongoDB unavailable (${error.message})`)
      isConnected = false
    } finally {
      connecting = null
    }
  })()

  return connecting
}

export function isDBConnected() {
  return isConnected
}

export async function ensureDB() {
  if (isConnected) return true
  try {
    await connectDB()
    if (isConnected) return true
    // If we were rate-limited, isConnected might still be false — return false fast
    return false
  } catch {
    return false
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false
})

mongoose.connection.on('error', () => {})
