import User from '../models/User.js'
import Note from '../models/Note.js'
import Message from '../models/Message.js'
import Report from '../models/Report.js'
import Notification from '../models/Notification.js'

export async function getStats(req, res, next) {
  try {
    const [totalUsers, totalNotes, totalMessages, pendingReports, bannedUsers, onlineUsers] = await Promise.all([
      User.countDocuments(),
      Note.countDocuments(),
      Message.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      User.countDocuments({ banned: true }),
      User.countDocuments({ status: 'online' }),
    ])
    res.json({ totalUsers, totalNotes, totalMessages, pendingReports, bannedUsers, onlineUsers })
  } catch (err) {
    next(err)
  }
}

export async function getUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, search, role, banned } = req.query
    const skip = (page - 1) * limit
    const filter = {}
    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { uid: { $regex: search, $options: 'i' } },
      ]
    }
    if (role) filter.role = role
    if (banned !== undefined) filter.banned = banned === 'true'

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-googleAccessToken -publicKey -encKeySignature -blockedUsers')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])

    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { uid } = req.params
    const { role } = req.body
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: { message: 'Invalid role' } })
    }
    const user = await User.findOneAndUpdate(
      { uid },
      { role },
      { new: true }
    ).select('-googleAccessToken -publicKey -encKeySignature -blockedUsers').lean()
    if (!user) return res.status(404).json({ error: { message: 'User not found' } })
    res.json({ user })
  } catch (err) {
    next(err)
  }
}

export async function toggleBanUser(req, res, next) {
  try {
    const { uid } = req.params
    const user = await User.findOne({ uid })
    if (!user) return res.status(404).json({ error: { message: 'User not found' } })
    if (user.role === 'admin') {
      return res.status(400).json({ error: { message: 'Cannot ban an admin' } })
    }
    user.banned = !user.banned
    await user.save()
    res.json({ user: { uid: user.uid, displayName: user.displayName, banned: user.banned } })
  } catch (err) {
    next(err)
  }
}

export async function getNotes(req, res, next) {
  try {
    const { page = 1, limit = 20, author } = req.query
    const skip = (page - 1) * limit
    const filter = {}
    if (author) filter.author = author

    const [notes, total] = await Promise.all([
      Note.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Note.countDocuments(filter),
    ])

    const authorIds = [...new Set(notes.map((n) => n.author))]
    const authors = await User.find({ uid: { $in: authorIds } })
      .select('uid displayName photoURL')
      .lean()
    const authorMap = {}
    for (const a of authors) authorMap[a.uid] = a

    const enriched = notes.map((n) => ({
      ...n,
      authorData: authorMap[n.author] || { uid: n.author, displayName: n.author, photoURL: null },
      reactionCount: (n.reactions || []).reduce((sum, r) => sum + r.userIds.length, 0),
      commentCount: n.comments.length,
    }))

    res.json({ notes: enriched, total, page: parseInt(page), totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
}

export async function deleteNote(req, res, next) {
  try {
    const note = await Note.findById(req.params.id)
    if (!note) return res.status(404).json({ error: { message: 'Note not found' } })
    await Note.deleteOne({ _id: req.params.id })
    req.app.get('io').emit('note:delete', { id: req.params.id })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export async function getReports(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query
    const skip = (page - 1) * limit
    const filter = {}
    if (status) filter.status = status

    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Report.countDocuments(filter),
    ])

    const uids = [...new Set(reports.map((r) => r.reporterId).concat(reports.map((r) => r.resolvedBy).filter(Boolean)))]
    const users = await User.find({ uid: { $in: uids } }).select('uid displayName photoURL').lean()
    const userMap = {}
    for (const u of users) userMap[u.uid] = u

    const enriched = reports.map((r) => ({
      ...r,
      reporter: userMap[r.reporterId] || { uid: r.reporterId, displayName: r.reporterId, photoURL: null },
      resolvedByUser: r.resolvedBy ? userMap[r.resolvedBy] || { uid: r.resolvedBy, displayName: r.resolvedBy, photoURL: null } : null,
    }))

    res.json({ reports: enriched, total, page: parseInt(page), totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
}

export async function createReport(req, res, next) {
  try {
    const { targetType, targetId, reason, description } = req.body
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: { message: 'targetType, targetId, and reason are required' } })
    }
    if (!['user', 'note', 'message'].includes(targetType)) {
      return res.status(400).json({ error: { message: 'Invalid targetType' } })
    }
    const report = await Report.create({
      reporterId: req.user.uid,
      targetType,
      targetId,
      reason,
      description: description || '',
    })
    res.status(201).json({ report })
  } catch (err) {
    next(err)
  }
}

export async function resolveReport(req, res, next) {
  try {
    const { id } = req.params
    const { status, action } = req.body
    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status' } })
    }
    const report = await Report.findByIdAndUpdate(
      id,
      { status, resolvedBy: req.user.uid, resolvedAt: new Date(), action: action || null },
      { new: true }
    ).lean()
    if (!report) return res.status(404).json({ error: { message: 'Report not found' } })
    res.json({ report })
  } catch (err) {
    next(err)
  }
}

export async function getConversationMessages(req, res, next) {
  try {
    const { conversationId } = req.params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50))
    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      Message.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Message.countDocuments({ conversationId }),
    ])

    res.json({ messages, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
}

export async function sendMessageAsAdmin(req, res, next) {
  try {
    const { recipientId, text } = req.body
    if (!recipientId || !text?.trim()) {
      return res.status(400).json({ error: { message: 'recipientId and text are required' } })
    }

    const recipient = await User.findOne({ uid: recipientId }).lean()
    if (!recipient) return res.status(404).json({ error: { message: 'Recipient not found' } })

    const conversationId = [req.user.uid, recipientId].sort().join(':')

    const message = await Message.create({
      conversationId,
      senderId: req.user.uid,
      text: text.trim(),
    })

    const fromUser = await User.findOne({ uid: req.user.uid }).select('displayName').lean()
    const notif = await Notification.create({
      userId: recipientId,
      type: 'new_message',
      payload: { from: req.user.uid, message: `Admin ${fromUser?.displayName || req.user.uid}: ${text.slice(0, 80)}` },
    })
    req.app.get('io').to(recipientId).emit('notification:new', notif)
    req.app.get('io').to(recipientId).emit('chat:receive', {
      _id: message._id,
      conversationId,
      senderId: req.user.uid,
      text: text.trim(),
      createdAt: message.createdAt.toISOString(),
      reactions: [],
    })

    res.status(201).json({ message })
  } catch (err) {
    next(err)
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const message = await Message.findById(req.params.id)
    if (!message) return res.status(404).json({ error: { message: 'Message not found' } })
    await Message.deleteOne({ _id: req.params.id })
    const [uid1, uid2] = message.conversationId.split(':')
    const to = uid1 === message.senderId ? uid2 : uid1
    req.app.get('io').to(to).emit('chat:delete', { messageId: req.params.id, conversationId: message.conversationId })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
