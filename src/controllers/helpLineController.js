import Message from '../models/Message.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'

export async function getHelpMessages(req, res, next) {
  try {
    const conversationId = `help:${req.user.uid}`
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50))
    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      Message.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Message.countDocuments({ conversationId }),
    ])

    res.json({ messages, total, page, totalPages: Math.ceil(total / limit), hasMore: page * limit < total })
  } catch (err) {
    next(err)
  }
}

export async function sendHelpMessage(req, res, next) {
  try {
    const { text } = req.body
    if (!text?.trim()) {
      return res.status(400).json({ error: { message: 'Message text is required' } })
    }

    const conversationId = `help:${req.user.uid}`

    const message = await Message.create({
      conversationId,
      senderId: req.user.uid,
      text: text.trim(),
    })

    const fromUser = await User.findOne({ uid: req.user.uid }).select('displayName photoURL').lean()

    const admins = await User.find({ role: 'admin' }).select('uid').lean()
    for (const admin of admins) {
      const notif = await Notification.create({
        userId: admin.uid,
        type: 'new_message',
        payload: {
          from: req.user.uid,
          fromName: fromUser?.displayName || req.user.uid,
          message: text.trim().slice(0, 80),
          type: 'help_line',
        },
      })
      req.app.get('io').to(admin.uid).emit('notification:new', notif)
      req.app.get('io').to(admin.uid).emit('help:new', {
        _id: message._id,
        conversationId,
        senderId: req.user.uid,
        text: text.trim(),
        createdAt: message.createdAt.toISOString(),
        userId: req.user.uid,
        userName: fromUser?.displayName || req.user.uid,
      })
    }

    res.status(201).json({ message })
  } catch (err) {
    next(err)
  }
}

export async function getHelpConversations(req, res, next) {
  try {
    const conversations = await Message.aggregate([
      { $match: { conversationId: { $regex: /^help:/ } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ])

    const enriched = await Promise.all(
      conversations.map(async (c) => {
        const userId = c._id.replace('help:', '')
        const user = await User.findOne({ uid: userId }).select('uid displayName photoURL email').lean()
        return {
          userId,
          user,
          lastMessage: c.lastMessage,
          messageCount: c.messageCount,
        }
      })
    )

    res.json({ conversations: enriched })
  } catch (err) {
    next(err)
  }
}

export async function getAdminHelpMessages(req, res, next) {
  try {
    const { userId } = req.params
    const conversationId = `help:${userId}`
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50))
    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      Message.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Message.countDocuments({ conversationId }),
    ])

    res.json({ messages, total, page, totalPages: Math.ceil(total / limit), hasMore: page * limit < total })
  } catch (err) {
    next(err)
  }
}

export async function sendAdminHelpResponse(req, res, next) {
  try {
    const { userId } = req.params
    const { text } = req.body
    if (!text?.trim()) {
      return res.status(400).json({ error: { message: 'Message text is required' } })
    }

    const conversationId = `help:${userId}`

    const message = await Message.create({
      conversationId,
      senderId: req.user.uid,
      text: text.trim(),
    })

    const fromUser = await User.findOne({ uid: req.user.uid }).select('displayName').lean()
    const notif = await Notification.create({
      userId,
      type: 'new_message',
      payload: {
        from: req.user.uid,
        message: `Admin ${fromUser?.displayName || req.user.uid}: ${text.trim().slice(0, 80)}`,
        type: 'help_line',
      },
    })
    req.app.get('io').to(userId).emit('notification:new', notif)
    req.app.get('io').to(userId).emit('help:receive', {
      _id: message._id,
      conversationId,
      senderId: req.user.uid,
      text: text.trim(),
      createdAt: message.createdAt.toISOString(),
    })

    res.status(201).json({ message })
  } catch (err) {
    next(err)
  }
}
