import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    photoURL: {
      type: String,
      default: null,
    },
    driveFolderId: {
      type: String,
      default: null,
    },
    driveFolders: {
      type: Object,
      default: null,
    },
    googleAccessToken: {
      type: String,
      default: null,
    },
    publicKey: {
      type: String,
      default: null,
    },
    encKeyVersion: {
      type: Number,
      default: 1,
    },
    encKeySignature: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    notificationToken: {
      type: String,
      default: null,
    },
    profilePrivacy: {
      type: String,
      enum: ['public', 'friends'],
      default: 'public',
    },
    bio: {
      type: String,
      default: '',
      maxlength: 500,
    },
    address: {
      type: String,
      default: '',
    },
    birthday: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['', 'male', 'female'],
      default: '',
    },
    hideOnlineStatus: {
      type: Boolean,
      default: false,
    },
    emailVisibility: {
      type: String,
      enum: ['public', 'friends', 'only_me'],
      default: 'public',
    },
    bioVisibility: {
      type: String,
      enum: ['public', 'friends', 'only_me'],
      default: 'public',
    },
    addressVisibility: {
      type: String,
      enum: ['public', 'friends', 'only_me'],
      default: 'public',
    },
    birthdayVisibility: {
      type: String,
      enum: ['public', 'friends', 'only_me'],
      default: 'public',
    },
    genderVisibility: {
      type: String,
      enum: ['public', 'friends', 'only_me'],
      default: 'public',
    },
    blockedUsers: [{
      uid: { type: String },
      blockedUntil: { type: Date, default: null },
    }],
  },
  { timestamps: true }
)

userSchema.index({ status: 1 })

export default mongoose.model('User', userSchema)
