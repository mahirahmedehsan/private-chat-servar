import mongoose from 'mongoose'

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    userIds: [{ type: String }],
  },
  { _id: false }
)

const commentSchema = new mongoose.Schema(
  {
    author: { type: String, required: true },
    content: { type: String, required: true },
    reactions: [reactionSchema],
  },
  { timestamps: true }
)

const noteSchema = new mongoose.Schema(
  {
    author: { type: String, required: true, index: true },
    content: { type: String, required: true },
    images: [{ type: String }],
    visibility: { type: String, enum: ['public', 'friends'], default: 'public' },
    reactions: [reactionSchema],
    comments: [commentSchema],
  },
  { timestamps: true }
)

noteSchema.index({ createdAt: -1 })

export default mongoose.model('Note', noteSchema)
