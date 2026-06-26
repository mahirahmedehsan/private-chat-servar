import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import config from './config/index.js'
import User from './models/User.js'
import { connectDB } from './config/db.js'
import { getRedis, isRedisReady } from './config/redis.js'
import { getFirebaseAdmin } from './config/firebase.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import friendRoutes from './routes/friends.js'
import syncRoutes from './routes/sync.js'
import notificationRoutes from './routes/notifications.js'
import driveRoutes from './routes/drive.js'
import presenceRoutes from './routes/presence.js'
import messageRoutes from './routes/messages.js'
import noteRoutes from './routes/notes.js'
import uploadRoutes from './routes/upload.js'
import accountRoutes from './routes/account.js'
import { setupSocketHandlers } from './sockets/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)

const allowedOrigins = [
  config.clientUrl,
  'http://localhost:5173',
  'http://localhost:3000',
]

const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(null, false)
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
})

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseio.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", 'blob:'],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(null, false)
  },
  credentials: true,
}))
app.use(process.env.NODE_ENV === 'production' ? morgan('combined') : morgan('dev'))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cookieParser())
app.use('/api', apiLimiter)

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/drive', driveRoutes)
app.use('/api/presence', presenceRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/notes', noteRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/account', accountRoutes)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')))

app.get('/', (req, res) => {
  res.json({
    name: 'PrivateChat API',
    version: '1.0.0',
    status: 'running',
    clientUrl: config.clientUrl,
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/{google,register,login,refresh,logout}',
    },
  })
})

app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: isRedisReady() ? 'connected' : 'unavailable',
    uptime: process.uptime(),
  })
})

app.set('io', io)

app.use(errorHandler)

setupSocketHandlers(io)

async function start() {
  await connectDB()

  await User.updateMany({ status: 'online' }, { status: 'offline', lastSeen: new Date() })

  getRedis()
  getFirebaseAdmin()

  httpServer.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`)
  })
}

// On Vercel, initialize services but don't start the HTTP listener
if (process.env.VERCEL) {
  connectDB().catch(() => {})
  getRedis()
  getFirebaseAdmin()
} else {
  start()
}

export default app
export { httpServer, io }
