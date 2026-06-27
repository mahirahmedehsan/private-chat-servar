import mongoose from 'mongoose'
import config from './index.js'

let isConnected = false

export async function connectDB() {
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
}

export function isDBConnected() {
  return isConnected
}

mongoose.connection.on('disconnected', () => {
  isConnected = false
})

mongoose.connection.on('error', () => {})
