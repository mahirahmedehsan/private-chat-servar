import Notification from '../models/Notification.js'

export async function getNotifications(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit

    const filter = { userId: req.user.uid }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ])

    res.json({ notifications, unreadCount, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    next(error)
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { ids } = req.body
    await Notification.updateMany(
      { _id: { $in: ids }, userId: req.user.uid },
      { read: true }
    )
    res.json({ message: 'Notifications marked as read' })
  } catch (error) {
    next(error)
  }
}
