import mongoose from 'mongoose'

const syncMetadataSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    lastSyncTimestamp: {
      type: Date,
      default: Date.now,
    },
    driveFileVersion: {
      type: Number,
      default: 0,
    },
    lastDriveFileId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
)

syncMetadataSchema.index({ userId: 1, deviceId: 1 }, { unique: true })

export default mongoose.model('SyncMetadata', syncMetadataSchema)
