import User from '../models/User.js'
import { getOnlineUsers } from '../sockets/index.js'

export function getOnlinePresence(req, res) {
  const onlineUids = [...getOnlineUsers()]
  res.json({ online: onlineUids })
}

export async function getBatchStatus(req, res, next) {
  try {
    const uids = req.query.uids ? req.query.uids.split(',').filter(Boolean) : []
    if (uids.length === 0) return res.json({ users: [] })
    const users = await User.find(
      { uid: { $in: uids } },
      'uid status lastSeen hideOnlineStatus'
    ).lean()
    const result = {}
    for (const u of users) {
      if (!u.hideOnlineStatus) {
        result[u.uid] = { status: u.status, lastSeen: u.lastSeen }
      } else {
        result[u.uid] = { status: 'offline', lastSeen: null }
      }
    }
    res.json({ users: result })
  } catch (error) {
    next(error)
  }
}

export async function heartbeat(req, res, next) {
  try {
    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { status: 'online', lastSeen: new Date() }
    )
    res.json({ status: 'online' })
  } catch (error) {
    next(error)
  }
}
