import User from '../models/User.js'
import Message from '../models/Message.js'
import Friend from '../models/Friend.js'
import Note from '../models/Note.js'
import Notification from '../models/Notification.js'
import SyncMetadata from '../models/SyncMetadata.js'
import { deleteUserFolder } from '../services/googleDriveServiceAccount.js'

export async function deleteAccount(req, res, next) {
  try {
    const uid = req.user.uid
    const { confirmation } = req.body

    if (confirmation !== 'DELETE MY DATA') {
      return res.status(400).json({
        error: {
          message:
            'Please type "DELETE MY DATA" to confirm permanent deletion.',
        },
      })
    }

    const conversations = await Message.distinct('conversationId', {
      $or: [{ senderId: uid }, { conversationId: new RegExp(uid) }],
    })

    const messageResult = await Message.deleteMany({
      $or: [
        { senderId: uid },
        { conversationId: { $in: conversations } },
      ],
    })

    const [friendResult, noteResult, notifResult, syncResult] =
      await Promise.all([
        Friend.deleteMany({
          $or: [{ requester: uid }, { recipient: uid }],
        }),
        Note.deleteMany({ author: uid }),
        Notification.deleteMany({ userId: uid }),
        SyncMetadata.deleteMany({ userId: uid }),
      ])

    await deleteUserFolder(uid)

    await User.deleteOne({ uid })

    res.json({
      message: 'Account and all associated data permanently deleted.',
      stats: {
        messagesDeleted: messageResult.deletedCount,
        friendRelationshipsRemoved: friendResult.deletedCount,
        notesDeleted: noteResult.deletedCount,
        notificationsCleared: notifResult.deletedCount,
        syncMetadataCleared: syncResult.deletedCount,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function exportData(req, res, next) {
  try {
    const uid = req.user.uid

    const [messages, friends, notes, notifications] = await Promise.all([
      Message.find({
        $or: [{ senderId: uid }, { conversationId: new RegExp(uid) }],
      })
        .select('-__v')
        .lean(),
      Friend.find({
        $or: [{ requester: uid }, { recipient: uid }],
      })
        .select('-__v')
        .lean(),
      Note.find({ author: uid }).select('-__v').lean(),
      Notification.find({ userId: uid }).select('-__v').lean(),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: uid,
      messageCount: messages.length,
      friendCount: friends.length,
      noteCount: notes.length,
      notificationCount: notifications.length,
    }

    res.json(exportData)
  } catch (error) {
    next(error)
  }
}
