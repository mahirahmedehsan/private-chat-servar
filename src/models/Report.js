import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: String, required: true, index: true },
    targetType: { type: String, enum: ['user', 'note', 'message'], required: true },
    targetId: { type: String, required: true },
    reason: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
    action: { type: String, default: null },
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

reportSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('Report', reportSchema)
