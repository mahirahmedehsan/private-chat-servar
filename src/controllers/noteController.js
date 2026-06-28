import Note from '../models/Note.js'
import Friend from '../models/Friend.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'

function buildReactionsSummary(reactions, uid) {
  return reactions.map((r) => ({
    emoji: r.emoji,
    count: r.userIds.length,
    reactedByMe: r.userIds.includes(uid),
  }))
}

function getMyReactions(reactions, uid) {
  return reactions.filter((r) => r.userIds.includes(uid)).map((r) => r.emoji)
}

function toggleReactionInArray(arr, uid, emoji) {
  const existing = arr.find((r) => r.emoji === emoji)
  if (existing) {
    const idx = existing.userIds.indexOf(uid)
    if (idx > -1) {
      existing.userIds.splice(idx, 1)
      if (existing.userIds.length === 0) {
        arr.pull({ emoji })
      }
    } else {
      existing.userIds.push(uid)
    }
  } else {
    arr.push({ emoji, userIds: [uid] })
  }
}

export async function getFeed(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query
    const uid = req.user.uid
    const skip = (page - 1) * limit

    const friendDocs = await Friend.find({
      $or: [{ requester: uid }, { recipient: uid }],
      status: 'accepted',
    }).lean()

    const friendIds = new Set()
    for (const f of friendDocs) {
      friendIds.add(f.requester)
      friendIds.add(f.recipient)
    }
    friendIds.delete(uid)

    const notes = await Note.find({
      $or: [
        { visibility: 'public' },
        { visibility: 'friends', author: { $in: [...friendIds] } },
        { author: uid },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const commentAuthorIds = [...new Set(notes.flatMap((n) => n.comments.map((c) => c.author)))]
    const allCommentReactionUids = [...new Set(notes.flatMap((n) => n.comments.flatMap((c) => (c.reactions || []).flatMap((r) => r.userIds))))]
    const allAuthorIds = [...new Set([...notes.map((n) => n.author), ...commentAuthorIds, ...allCommentReactionUids])]
    const authors = await User.find({ uid: { $in: allAuthorIds } })
      .select('uid displayName photoURL')
      .lean()

    const authorMap = {}
    for (const a of authors) {
      authorMap[a.uid] = a
    }

    const enriched = notes.map((n) => ({
      ...n,
      author: authorMap[n.author] || { uid: n.author, displayName: n.author, photoURL: null },
      isFriend: friendIds.has(n.author),
      comments: n.comments.map((c) => ({
        ...c,
        author: authorMap[c.author] || { uid: c.author, displayName: c.author, photoURL: null },
        reactions: buildReactionsSummary(c.reactions || [], uid),
        myReactions: getMyReactions(c.reactions || [], uid),
      })),
      reactions: buildReactionsSummary(n.reactions || [], uid),
      myReactions: getMyReactions(n.reactions || [], uid),
      reactionCount: (n.reactions || []).reduce((sum, r) => sum + r.userIds.length, 0),
      commentCount: n.comments.length,
    }))

    const total = await Note.countDocuments({
      $or: [
        { visibility: 'public' },
        { visibility: 'friends', author: { $in: [...friendIds] } },
        { author: uid },
      ],
    })

    res.json({ notes: enriched, hasMore: skip + limit < total })
  } catch (err) {
    next(err)
  }
}

export async function getMyNotes(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query
    const uid = req.user.uid
    const skip = (page - 1) * limit

    const [notes, total] = await Promise.all([
      Note.find({ author: uid })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Note.countDocuments({ author: uid }),
    ])

    const author = await User.findOne({ uid }).select('uid displayName photoURL').lean()

    const enriched = notes.map((n) => ({
      ...n,
      author: author || { uid, displayName: uid, photoURL: null },
      comments: n.comments.map((c) => ({
        ...c,
        author: { uid: c.author, displayName: c.author, photoURL: null },
        reactions: buildReactionsSummary(c.reactions || [], uid),
        myReactions: getMyReactions(c.reactions || [], uid),
      })),
      reactions: buildReactionsSummary(n.reactions || [], uid),
      myReactions: getMyReactions(n.reactions || [], uid),
      reactionCount: (n.reactions || []).reduce((sum, r) => sum + r.userIds.length, 0),
      commentCount: n.comments.length,
    }))

    res.json({ notes: enriched, hasMore: skip + limit < total })
  } catch (err) {
    next(err)
  }
}

export async function createNote(req, res, next) {
  try {
    const { content, visibility, images } = req.body
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' })
    }

    const note = await Note.create({
      author: req.user.uid,
      content: content.trim(),
      visibility: visibility || 'public',
      images: images || [],
    })

    const author = await User.findOne({ uid: req.user.uid })
      .select('uid displayName photoURL')
      .lean()

    const payload = {
      ...note.toObject(),
      author: author || { uid: req.user.uid, displayName: req.user.uid, photoURL: null },
      reactions: [],
      myReactions: [],
      reactionCount: 0,
      commentCount: 0,
    }

    req.app.get('io').emit('note:new', payload)
    res.status(201).json({ note: payload })
  } catch (err) {
    next(err)
  }
}

export async function deleteNote(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, author: req.user.uid })
    if (!note) {
      return res.status(404).json({ error: 'Note not found' })
    }
    await Note.deleteOne({ _id: req.params.id })
    req.app.get('io').emit('note:delete', { id: req.params.id })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export async function updateNote(req, res, next) {
  try {
    const note = await Note.findOne({ _id: req.params.id, author: req.user.uid })
    if (!note) {
      return res.status(404).json({ error: 'Note not found' })
    }
    const { content, visibility } = req.body
    if (content !== undefined) note.content = content
    if (visibility !== undefined) note.visibility = visibility
    await note.save()
    req.app.get('io').emit('note:update', { id: req.params.id, content, visibility })
    res.json({ note })
  } catch (err) {
    next(err)
  }
}

export async function toggleNoteReaction(req, res, next) {
  try {
    const note = await Note.findById(req.params.id)
    if (!note) {
      return res.status(404).json({ error: 'Note not found' })
    }

    const uid = req.user.uid
    const { emoji } = req.body
    if (!emoji) {
      return res.status(400).json({ error: 'emoji is required' })
    }

    const existing = note.reactions.find((r) => r.emoji === emoji)
    const wasReacted = existing ? existing.userIds.includes(uid) : false

    toggleReactionInArray(note.reactions, uid, emoji)
    await note.save()

    const reactionsSummary = buildReactionsSummary(note.reactions, uid)
    const payload = {
      id: req.params.id,
      reactions: reactionsSummary,
      myReactions: getMyReactions(note.reactions, uid),
      reactionCount: reactionsSummary.reduce((sum, r) => sum + r.count, 0),
    }
    req.app.get('io').emit('note:reaction', payload)

    if (!wasReacted && note.author !== uid) {
      const fromUser = await User.findOne({ uid }).select('displayName').lean()
      const notif = await Notification.create({
        userId: note.author,
        type: 'note_like',
        payload: { from: uid, noteId: req.params.id, message: `${fromUser?.displayName || uid} reacted to your note` },
      })
      req.app.get('io').to(note.author).emit('notification:new', notif)
    }

    res.json(payload)
  } catch (err) {
    next(err)
  }
}

export async function addComment(req, res, next) {
  try {
    const { content } = req.body
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' })
    }

    const note = await Note.findById(req.params.id)
    if (!note) {
      return res.status(404).json({ error: 'Note not found' })
    }

    const comment = { author: req.user.uid, content: content.trim(), reactions: [] }
    note.comments.push(comment)
    await note.save()

    const saved = note.comments[note.comments.length - 1]
    const author = await User.findOne({ uid: req.user.uid })
      .select('uid displayName photoURL')
      .lean()

    const payload = {
      noteId: req.params.id,
      comment: { ...saved.toObject(), author: author || { uid: req.user.uid, displayName: req.user.uid, photoURL: null }, reactions: [], myReactions: [] },
    }

    req.app.get('io').emit('note:comment', payload)

    if (note.author !== req.user.uid) {
      const notif = await Notification.create({
        userId: note.author,
        type: 'note_comment',
        payload: { from: req.user.uid, noteId: req.params.id, message: `${author?.displayName || req.user.uid} commented on your note` },
      })
      req.app.get('io').to(note.author).emit('notification:new', notif)
    }

    res.status(201).json(payload)
  } catch (err) {
    next(err)
  }
}

export async function toggleCommentReaction(req, res, next) {
  try {
    const note = await Note.findById(req.params.noteId)
    if (!note) {
      return res.status(404).json({ error: 'Note not found' })
    }

    const comment = note.comments.id(req.params.commentId)
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    const uid = req.user.uid
    const { emoji } = req.body
    if (!emoji) {
      return res.status(400).json({ error: 'emoji is required' })
    }

    toggleReactionInArray(comment.reactions, uid, emoji)
    await note.save()

    const payload = {
      noteId: req.params.noteId,
      commentId: req.params.commentId,
      reactions: buildReactionsSummary(comment.reactions, uid),
      myReactions: getMyReactions(comment.reactions, uid),
    }
    req.app.get('io').emit('note:comment-reaction', payload)

    res.json(payload)
  } catch (err) {
    next(err)
  }
}

export async function deleteComment(req, res, next) {
  try {
    const note = await Note.findById(req.params.noteId)
    if (!note) {
      return res.status(404).json({ error: 'Note not found' })
    }

    const comment = note.comments.id(req.params.commentId)
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    if (comment.author !== req.user.uid && note.author !== req.user.uid) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    comment.deleteOne()
    await note.save()

    req.app.get('io').emit('note:delete-comment', { noteId: req.params.noteId, commentId: req.params.commentId })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
