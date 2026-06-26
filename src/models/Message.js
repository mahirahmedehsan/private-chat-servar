import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: '',
    },
    encryptedContent: {
      encrypted: { type: String },
      nonce: { type: String },
      ephemeralPublicKey: { type: String },
      version: { type: Number },
    },
    file: {
      url: { type: String },
      name: { type: String },
      type: { type: String },
      size: { type: Number },
      encryptedFileKey: {
        encrypted: { type: String },
        nonce: { type: String },
        ephemeralPublicKey: { type: String },
        version: { type: Number },
      },
    },
    reactions: [
      {
        emoji: String,
        userIds: [String],
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

messageSchema.index({ conversationId: 1, createdAt: -1 })

export default mongoose.model('Message', messageSchema)
