import Friend from '../models/Friend.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'

export async function getFriends(req, res, next) {
  try {
    const status = req.query.status || 'accepted'
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit

    const filter = {
      $or: [{ requester: req.user.uid }, { recipient: req.user.uid }],
      status,
    }

    const [friendships, total] = await Promise.all([
      Friend.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Friend.countDocuments(filter),
    ])

    const userIds = friendships.map((f) =>
      f.requester === req.user.uid ? f.recipient : f.requester
    )

    const users = await User.find(
      { uid: { $in: userIds } },
      'uid email displayName photoURL status lastSeen'
    )

    if (status === 'pending') {
      const enriched = friendships.map((f) => {
        const user = users.find((u) => u.uid === f.requester) || users.find((u) => u.uid === f.recipient)
        return {
          _id: f._id,
          requester: f.requester,
          recipient: f.recipient,
          createdAt: f.createdAt,
          user: user
            ? { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL }
            : null,
        }
      })
      return res.json({
        sent: enriched.filter((r) => r.requester === req.user.uid),
        received: enriched.filter((r) => r.recipient === req.user.uid),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      })
    }

    res.json({ friends: users, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    next(error)
  }
}

export async function sendRequest(req, res, next) {
  try {
    const { userId } = req.body
    if (userId === req.user.uid) {
      return res.status(400).json({ error: { message: 'Cannot send request to yourself' } })
    }

    const existing = await Friend.findOne({
      $or: [
        { requester: req.user.uid, recipient: userId },
        { requester: userId, recipient: req.user.uid },
      ],
    })

    if (existing) {
      return res.status(400).json({ error: { message: 'Friend request already exists' } })
    }

    const friend = await Friend.create({
      requester: req.user.uid,
      recipient: userId,
    })

    const fromUser = await User.findOne({ uid: req.user.uid }).select('displayName').lean()
    const notif = await Notification.create({
      userId,
      type: 'friend_request',
      payload: { from: req.user.uid, message: `${fromUser?.displayName || req.user.uid} sent you a friend request` },
    })
    req.app.get('io').to(userId).emit('notification:new', notif)

    res.status(201).json(friend)
  } catch (error) {
    next(error)
  }
}

export async function respondToRequest(req, res, next) {
  try {
    const { requestId, action } = req.body
    const friend = await Friend.findById(requestId)

    if (!friend || friend.recipient !== req.user.uid) {
      return res.status(404).json({ error: { message: 'Request not found' } })
    }

    friend.status = action === 'accept' ? 'accepted' : 'rejected'
    await friend.save()

    if (action === 'accept') {
      const fromUser = await User.findOne({ uid: req.user.uid }).select('displayName').lean()
      const notif = await Notification.create({
        userId: friend.requester,
        type: 'friend_accepted',
        payload: { from: req.user.uid, message: `${fromUser?.displayName || req.user.uid} accepted your friend request` },
      })
      req.app.get('io').to(friend.requester).emit('notification:new', notif)
    }

    res.json(friend)
  } catch (error) {
    next(error)
  }
}

export async function removeFriend(req, res, next) {
  try {
    const { id } = req.params
    await Friend.findOneAndDelete({
      $or: [
        { requester: req.user.uid, recipient: id },
        { requester: id, recipient: req.user.uid },
      ],
    })
    res.json({ message: 'Friend removed' })
  } catch (error) {
    next(error)
  }
}

function isBlockActive(entry) {
  return !entry.blockedUntil || new Date(entry.blockedUntil) > new Date()
}

export async function blockUser(req, res, next) {
  try {
    const { id } = req.params
    const { duration } = req.body
    const blockedUntil = duration ? new Date(Date.now() + duration * 60 * 1000) : null
    await User.findOneAndUpdate(
      { uid: req.user.uid, 'blockedUsers.uid': id },
      { $set: { 'blockedUsers.$.blockedUntil': blockedUntil } }
    )
    await User.findOneAndUpdate(
      { uid: req.user.uid, 'blockedUsers.uid': { $ne: id } },
      { $push: { blockedUsers: { uid: id, blockedUntil } } }
    )
    res.json({ message: 'User blocked', blockedUntil })
  } catch (error) {
    next(error)
  }
}

export async function unblockUser(req, res, next) {
  try {
    const { id } = req.params
    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $pull: { blockedUsers: { uid: id } } }
    )
    res.json({ message: 'User unblocked' })
  } catch (error) {
    next(error)
  }
}

export async function getFriendStatus(req, res, next) {
  try {
    const { id } = req.params
    const [me, them] = await Promise.all([
      User.findOne({ uid: req.user.uid }).select('blockedUsers').lean(),
      User.findOne({ uid: id }).select('blockedUsers').lean(),
    ])
    const myBlock = (me?.blockedUsers || []).find((b) => b.uid === id)
    const theirBlock = (them?.blockedUsers || []).find((b) => b.uid === req.user.uid)
    res.json({
      blockedByMe: myBlock ? isBlockActive(myBlock) : false,
      blockedByThem: theirBlock ? isBlockActive(theirBlock) : false,
      blockedUntil: myBlock?.blockedUntil || null,
    })
  } catch (error) {
    next(error)
  }
}

export async function getBlockedList(req, res, next) {
  try {
    const me = await User.findOne({ uid: req.user.uid }).select('blockedUsers').lean()
    const activeBlocks = (me?.blockedUsers || []).filter(isBlockActive)
    const uids = activeBlocks.map((b) => b.uid)
    const blockedMap = {}
    for (const b of activeBlocks) {
      blockedMap[b.uid] = b.blockedUntil
    }
    const users = await User.find(
      { uid: { $in: uids } },
      'uid email displayName photoURL status lastSeen'
    ).lean()
    res.json({
      friends: users.map((u) => ({ ...u, blockedUntil: blockedMap[u.uid] || null })),
      total: users.length,
    })
  } catch (error) {
    next(error)
  }
}
