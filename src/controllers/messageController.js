import Message from '../models/Message.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'

function getConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join(':')
}

export async function getMessages(req, res, next) {
  try {
    const { conversationId } = req.params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit

    const filter = { conversationId }

    const [messages, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Message.countDocuments(filter),
    ])

    res.json({
      messages,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
    })
  } catch (error) {
    next(error)
  }
}

export async function sendMessage(req, res, next) {
  try {
    const { recipientId, text, file, encryptedContent } = req.body
    if (!recipientId) {
      return res.status(400).json({ error: { message: 'recipientId is required' } })
    }

    const [me, them] = await Promise.all([
      User.findOne({ uid: req.user.uid }).select('blockedUsers').lean(),
      User.findOne({ uid: recipientId }).select('blockedUsers').lean(),
    ])
    const myBlock = (me?.blockedUsers || []).find((b) => b.uid === recipientId)
    const theirBlock = (them?.blockedUsers || []).find((b) => b.uid === req.user.uid)
    const isActive = (b) => !b.blockedUntil || new Date(b.blockedUntil) > new Date()
    if ((myBlock && isActive(myBlock)) || (theirBlock && isActive(theirBlock))) {
      return res.status(403).json({ error: { message: 'Cannot send message to this user' } })
    }

    const conversationId = getConversationId(req.user.uid, recipientId)

    const messageData = {
      conversationId,
      senderId: req.user.uid,
      text: text || '',
    }

    if (encryptedContent) {
      messageData.encryptedContent = encryptedContent
      messageData.text = ''
    }

    if (file) {
      messageData.file = file
    }

    const message = await Message.create(messageData)

    const fromUser = await User.findOne({ uid: req.user.uid }).select('displayName').lean()
    const preview = encryptedContent
      ? '🔒 Encrypted message'
      : `${fromUser?.displayName || req.user.uid}: ${(text || '').slice(0, 80)}${(text || '').length > 80 ? '...' : ''}`
    const notif = await Notification.create({
      userId: recipientId,
      type: 'new_message',
      payload: { from: req.user.uid, message: preview },
    })
    req.app.get('io').to(recipientId).emit('notification:new', notif)

    res.status(201).json(message)
  } catch (error) {
    next(error)
  }
}

export async function editMessage(req, res, next) {
  try {
    const { id } = req.params
    const { text, encryptedContent } = req.body
    if (!text?.trim() && !encryptedContent) {
      return res.status(400).json({ error: { message: 'Text or encrypted content is required' } })
    }

    const message = await Message.findOne({ _id: id, senderId: req.user.uid })
    if (!message) {
      return res.status(404).json({ error: { message: 'Message not found' } })
    }

    if (encryptedContent) {
      message.encryptedContent = encryptedContent
      message.text = ''
    } else {
      message.text = text.trim()
    }
    message.isEdited = true
    await message.save()

    const [uid1, uid2] = message.conversationId.split(':')
    const to = uid1 === req.user.uid ? uid2 : uid1
    req.app
      .get('io')
      .to(to)
      .emit('chat:edit', {
        conversationId: message.conversationId,
        messageId: id,
        text: message.text,
        encryptedContent: message.encryptedContent || undefined,
        isEdited: true,
      })

    res.json(message)
  } catch (error) {
    next(error)
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const { id } = req.params
    const message = await Message.findOne({ _id: id, senderId: req.user.uid })
    if (!message) {
      return res.status(404).json({ error: { message: 'Message not found' } })
    }

    await Message.deleteOne({ _id: id })

    const [uid1, uid2] = message.conversationId.split(':')
    const to = uid1 === req.user.uid ? uid2 : uid1
    req.app.get('io').to(to).emit('chat:delete', { messageId: id, conversationId: message.conversationId })

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
}

export async function toggleReaction(req, res, next) {
  try {
    const { id } = req.params
    const { emoji } = req.body
    if (!emoji) {
      return res.status(400).json({ error: { message: 'emoji is required' } })
    }

    const message = await Message.findById(id)
    if (!message) {
      return res.status(404).json({ error: { message: 'Message not found' } })
    }

    const existingReaction = message.reactions.find((r) => r.emoji === emoji)
    if (existingReaction) {
      const idx = existingReaction.userIds.indexOf(req.user.uid)
      if (idx > -1) {
        existingReaction.userIds.splice(idx, 1)
        if (existingReaction.userIds.length === 0) {
          message.reactions.pull({ emoji })
        }
      } else {
        existingReaction.userIds.push(req.user.uid)
      }
    } else {
      message.reactions.push({ emoji, userIds: [req.user.uid] })
    }

    await message.save()

    const [uid1, uid2] = message.conversationId.split(':')
    const to = uid1 === req.user.uid ? uid2 : uid1
    req.app.get('io').to(to).emit('chat:reaction', {
      messageId: id,
      conversationId: message.conversationId,
      reactions: message.reactions,
    })

    res.json(message)
  } catch (error) {
    next(error)
  }
}
