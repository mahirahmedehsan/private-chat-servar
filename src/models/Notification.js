import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['friend_request', 'friend_accepted', 'new_message', 'call', 'system', 'note_like', 'note_comment'],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, read: 1 })

export default mongoose.model('Notification', notificationSchema)
