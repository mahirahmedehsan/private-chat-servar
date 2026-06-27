import mongoose from 'mongoose'
import config from './index.js'

let isConnected = false
let connecting = null

export async function connectDB() {
  if (isConnected) return
  if (connecting) return connecting

  connecting = (async () => {
    try {
      mongoose.set('strictQuery', true)
      await mongoose.connect(config.mongodb.uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        maxPoolSize: 10,
        minPoolSize: 1,
        socketTimeoutMS: 30000,
        waitQueueTimeoutMS: 5000,
      })
      isConnected = true
      console.log('MongoDB connected')
    } catch (error) {
      console.warn(`MongoDB unavailable (${error.message}) — running without database`)
      isConnected = false
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
    return isConnected
  } catch {
    return false
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false
})

mongoose.connection.on('error', () => {})
