import User from '../models/User.js'
import Note from '../models/Note.js'
import Friend from '../models/Friend.js'
import { getCached, setCache, clearCache } from '../utils/cache.js'

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function getProfile(req, res, next) {
  try {
    const cacheKey = `profile:${req.user.uid}`
    const cached = getCached(cacheKey)
    if (cached) return res.json(cached)

    const user = await User.findOne({ uid: req.user.uid }).select('-__v')
    if (!user) return res.status(404).json({ error: { message: 'User not found' } })
    setCache(cacheKey, user, 15000)
    res.json(user)
  } catch (error) {
    next(error)
  }
}

export async function updateProfile(req, res, next) {
  try {
    const updates = {}
    if (req.body.displayName) updates.displayName = req.body.displayName
    if (req.body.photoURL) updates.photoURL = req.body.photoURL
    if (req.body.driveFolderId) updates.driveFolderId = req.body.driveFolderId
    if (req.body.publicKey) updates.publicKey = req.body.publicKey
    if (req.body.profilePrivacy) updates.profilePrivacy = req.body.profilePrivacy
    if (typeof req.body.bio === 'string') updates.bio = req.body.bio
    if (typeof req.body.address === 'string') updates.address = req.body.address
    if (req.body.birthday) updates.birthday = new Date(req.body.birthday)
    if (['male', 'female', ''].includes(req.body.gender)) updates.gender = req.body.gender
    if (typeof req.body.hideOnlineStatus === 'boolean') updates.hideOnlineStatus = req.body.hideOnlineStatus
    if (['public', 'friends', 'only_me'].includes(req.body.emailVisibility)) updates.emailVisibility = req.body.emailVisibility
    if (['public', 'friends', 'only_me'].includes(req.body.bioVisibility)) updates.bioVisibility = req.body.bioVisibility
    if (['public', 'friends', 'only_me'].includes(req.body.addressVisibility)) updates.addressVisibility = req.body.addressVisibility
    if (['public', 'friends', 'only_me'].includes(req.body.birthdayVisibility)) updates.birthdayVisibility = req.body.birthdayVisibility
    if (['public', 'friends', 'only_me'].includes(req.body.genderVisibility)) updates.genderVisibility = req.body.genderVisibility

    const user = await User.findOneAndUpdate({ uid: req.user.uid }, updates, { new: true })

    clearCache(`profile:${req.user.uid}`)
    clearCache(`stats:${req.user.uid}`)

    const io = req.app.get('io')
    if (io) {
      io.emit('profile:update', {
        uid: req.user.uid,
        updates,
      })
    }

    res.json(user)
  } catch (error) {
    next(error)
  }
}

export async function getUserByUid(req, res, next) {
  try {
    const user = await User.findOne({ uid: req.params.uid }).select('uid email displayName photoURL status lastSeen createdAt profilePrivacy address birthday gender')
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (error) {
    next(error)
  }
}

export async function getUserProfile(req, res, next) {
  try {
    const viewerUid = req.user.uid
    const targetUid = req.params.uid

    const target = await User.findOne({ uid: targetUid }).select('-__v')
    if (!target) return res.status(404).json({ error: { message: 'User not found' } })

    const isOwner = targetUid === viewerUid
    const isPrivate = target.profilePrivacy === 'friends'

    if (!isOwner && isPrivate) {
      const friendship = await Friend.findOne({
        $or: [
          { requester: viewerUid, recipient: targetUid },
          { requester: targetUid, recipient: viewerUid },
        ],
        status: 'accepted',
      })
      if (!friendship) {
        return res.status(403).json({ error: { message: 'This profile is friends-only' } })
      }
    }

    const viewerIsFriend = targetUid === viewerUid ? true : !!(await Friend.findOne({
      $or: [
        { requester: viewerUid, recipient: targetUid },
        { requester: targetUid, recipient: viewerUid },
      ],
      status: 'accepted',
    }))

    const [postCount, friendCount, posts] = await Promise.all([
      Note.countDocuments({ author: targetUid }),
      Friend.countDocuments({
        $or: [{ requester: targetUid }, { recipient: targetUid }],
        status: 'accepted',
      }),
      Note.find({ author: targetUid })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ])

    const totalLikes = posts.reduce((sum, n) => {
      return sum + (n.reactions || []).reduce((s, r) => s + r.userIds.length, 0)
    }, 0)

    const enrichedPosts = posts.map((n) => ({
      ...n,
      reactions: n.reactions || [],
      reactionCount: (n.reactions || []).reduce((sum, r) => sum + r.userIds.length, 0),
      commentCount: n.comments.length,
    }))

    function canSee(fieldVis) {
      if (isOwner) return true
      if (fieldVis === 'public') return true
      if (fieldVis === 'friends' && viewerIsFriend) return true
      return false
    }

    const userBase = {
      uid: target.uid,
      displayName: target.displayName,
      photoURL: target.photoURL,
      status: target.status,
      lastSeen: target.lastSeen,
      createdAt: target.createdAt,
      profilePrivacy: target.profilePrivacy,
      email: canSee(target.emailVisibility) ? target.email : null,
      bio: canSee(target.bioVisibility) ? target.bio : null,
      address: canSee(target.addressVisibility) ? target.address : null,
      birthday: canSee(target.birthdayVisibility) ? target.birthday : null,
      gender: canSee(target.genderVisibility) ? target.gender : null,
    }

    res.json({
      user: userBase,
      stats: { postCount, friendCount, totalLikes },
      posts: enrichedPosts,
    })
  } catch (error) {
    next(error)
  }
}

export async function getProfileStats(req, res, next) {
  try {
    const uid = req.user.uid
    const cacheKey = `stats:${uid}`
    const cached = getCached(cacheKey)
    if (cached) return res.json(cached)

    const [postCount, friendCount, notes] = await Promise.all([
      Note.countDocuments({ author: uid }),
      Friend.countDocuments({
        $or: [{ requester: uid }, { recipient: uid }],
        status: 'accepted',
      }),
      Note.find({ author: uid }).select('reactions').lean(),
    ])

    const totalLikes = notes.reduce((sum, n) => {
      return sum + (n.reactions || []).reduce((s, r) => s + r.userIds.length, 0)
    }, 0)

    const result = { postCount, friendCount, totalLikes }
    setCache(cacheKey, result, 30000)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export async function searchUsers(req, res, next) {
  try {
    const { q } = req.query
    if (!q) return res.json([])

    const sanitized = escapeRegex(q)
    const users = await User.find(
      {
        $or: [
          { displayName: { $regex: sanitized, $options: 'i' } },
          { email: { $regex: sanitized, $options: 'i' } },
        ],
        uid: { $ne: req.user.uid },
      },
      'uid email displayName photoURL status'
    ).limit(20)

    res.json(users)
  } catch (error) {
    next(error)
  }
}
