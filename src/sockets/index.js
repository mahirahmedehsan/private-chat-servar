import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import { getRedis, isRedisReady } from '../config/redis.js'
import Message from '../models/Message.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'

function getConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join(':')
}

const userSockets = new Map()
const onlineUsers = new Set()

export function getOnlineUsers() {
  return onlineUsers
}

async function setPresence(uid, status) {
  if (isRedisReady()) {
    try {
      const redis = getRedis()
      await redis.hset('presence', uid, status)
    } catch { /* redis hiccup */ }
  } else {
    try {
      await User.findOneAndUpdate(
        { uid },
        { status, lastSeen: status === 'offline' ? new Date() : undefined },
        { upsert: false }
      )
    } catch { /* db hiccup */ }
  }
  if (status === 'online') onlineUsers.add(uid)
  else onlineUsers.delete(uid)
}

export function setupSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error('Authentication required'))

    try {
      const decoded = jwt.verify(token, config.jwt.secret)
      socket.user = decoded
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const { uid } = socket.user

    socket.join(uid)
    if (!userSockets.has(uid)) userSockets.set(uid, new Set())
    userSockets.get(uid).add(socket.id)
    await setPresence(uid, 'online')

    const userData = await User.findOne({ uid }).select('hideOnlineStatus publicKey').lean()
    const hideStatus = userData?.hideOnlineStatus

    if (!hideStatus) {
      io.emit('presence:update', { uid, status: 'online' })
    }

    socket.emit('e2ee:key', { publicKey: userData?.publicKey || null })

    if (onlineUsers.size > 0) {
      const otherUids = [...onlineUsers].filter(id => id !== uid)
      if (otherUids.length > 0) {
        const otherUsers = await User.find(
          { uid: { $in: otherUids } },
          'uid hideOnlineStatus'
        ).lean()
        for (const u of otherUsers) {
          if (!u.hideOnlineStatus) {
            socket.emit('presence:update', { uid: u.uid, status: 'online' })
          }
        }
      }
    }

    socket.on('chat:send', async (data) => {
      const { to, text, conversationId, messageId, timestamp, file, encryptedContent } = data
      const cid = conversationId || getConversationId(uid, to)

      // Relay to recipient — REST API already saved the message
      io.to(to).emit('chat:receive', {
        _id: messageId,
        conversationId: cid,
        senderId: uid,
        text: text || '',
        encryptedContent,
        file,
        createdAt: timestamp || new Date().toISOString(),
        reactions: [],
      })

      socket.emit('chat:sent', { conversationId: cid, messageId })
    })

    socket.on('e2ee:key-update', async (data) => {
      try {
        await User.findOneAndUpdate(
          { uid },
          { publicKey: data.publicKey, encKeyVersion: data.version || 1 }
        )
        io.emit('e2ee:key-changed', { uid, publicKey: data.publicKey })
      } catch { /* handle silently */ }
    })

    socket.on('e2ee:key-request', async (data) => {
      const targetUser = await User.findOne({ uid: data.uid })
        .select('publicKey encKeyVersion')
        .lean()
      if (targetUser?.publicKey) {
        socket.emit('e2ee:key-response', {
          uid: data.uid,
          publicKey: targetUser.publicKey,
          version: targetUser.encKeyVersion,
        })
      }
    })

    socket.on('chat:delivered', (data) => {
      io.to(data.to).emit('chat:delivered', { messageId: data.messageId, conversationId: data.conversationId, uid })
    })

    socket.on('chat:read', (data) => {
      io.to(data.to).emit('chat:read', { messageId: data.messageId, conversationId: data.conversationId, uid })
    })

    socket.on('chat:typing', (data) => {
      socket.to(data.to).emit('chat:typing', { uid, conversationId: data.conversationId, isTyping: data.isTyping })
    })

    socket.on('chat:reaction', (data) => {
      io.to(data.to).emit('chat:reaction', { uid, messageId: data.messageId, conversationId: data.conversationId, reaction: data.reaction })
    })

    socket.on('signal:offer', (data) => {
      io.to(data.to).emit('signal:offer', { from: uid, offer: data.offer })
    })

    socket.on('signal:answer', (data) => {
      io.to(data.to).emit('signal:answer', { from: uid, answer: data.answer })
    })

    socket.on('signal:ice-candidate', (data) => {
      io.to(data.to).emit('signal:ice-candidate', { from: uid, candidate: data.candidate })
    })

    socket.on('sync:request', (data) => {
      io.to(data.to).emit('sync:request', { from: uid })
    })

    socket.on('disconnect', async () => {
      const sockets = userSockets.get(uid)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size > 0) return
        userSockets.delete(uid)
      }
      await setPresence(uid, 'offline')
      const userData = await User.findOne({ uid }).select('hideOnlineStatus').lean()
      if (!userData?.hideOnlineStatus) {
        io.emit('presence:update', { uid, status: 'offline', lastSeen: new Date() })
      }
    })
  })
}
