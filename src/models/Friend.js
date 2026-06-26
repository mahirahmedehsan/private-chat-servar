import mongoose from 'mongoose'

const friendSchema = new mongoose.Schema(
  {
    requester: {
      type: String,
      required: true,
      index: true,
    },
    recipient: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
)

friendSchema.index({ requester: 1, recipient: 1 }, { unique: true })

export default mongoose.model('Friend', friendSchema)
