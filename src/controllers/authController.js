import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import { getAuth } from '../config/firebase.js'
import User from '../models/User.js'
import * as driveService from '../services/googleDrive.js'

function generateTokens(user) {
  const accessToken = jwt.sign(
    { uid: user.uid, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
  const refreshToken = jwt.sign(
    { uid: user.uid },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )
  return { accessToken, refreshToken }
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  })
}

function sanitizeUser(user) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    driveFolderId: user.driveFolderId,
    driveFolders: user.driveFolders,
    bio: user.bio,
    status: user.status,
    lastSeen: user.lastSeen,
    profilePrivacy: user.profilePrivacy || 'public',
    hideOnlineStatus: user.hideOnlineStatus || false,
    address: user.address || '',
    birthday: user.birthday || null,
    gender: user.gender || '',
    emailVisibility: user.emailVisibility || 'public',
    bioVisibility: user.bioVisibility || 'public',
    addressVisibility: user.addressVisibility || 'public',
    birthdayVisibility: user.birthdayVisibility || 'public',
    genderVisibility: user.genderVisibility || 'public',
  }
}

async function verifyAndRespond(req, res, next, findOrCreate) {
  try {
    const firebaseAuth = getAuth()
    if (!firebaseAuth) {
      return res.status(500).json({ error: { message: 'Firebase not configured' } })
    }

    const { idToken, googleAccessToken } = req.body
    if (!idToken) {
      return res.status(400).json({ error: { message: 'ID token required' } })
    }

    const decoded = await firebaseAuth.verifyIdToken(idToken)
    const { uid, email, name, picture } = decoded

    const user = await findOrCreate(uid, email, name || email?.split('@')[0], picture, googleAccessToken)
    if (!user) return

    const tokens = generateTokens(user)
    setRefreshCookie(res, tokens.refreshToken)

    res.json({
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      googleAccessToken: user.googleAccessToken || null,
    })
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: { message: 'Token expired. Please sign in again.' } })
    }
    next(error)
  }
}

export async function googleAuth(req, res, next) {
  return verifyAndRespond(req, res, next, async (uid, email, displayName, photoURL, googleAccessToken) => {
    let user = await User.findOne({ uid })
    if (!user) {
      user = await User.create({ uid, email, displayName, photoURL, googleAccessToken })
    } else {
      user.displayName = displayName || user.displayName
      if (photoURL) user.photoURL = photoURL
      if (googleAccessToken) user.googleAccessToken = googleAccessToken
      await user.save()
    }

    if (!user.driveFolderId && googleAccessToken) {
      driveService.setupAppFolders(uid, googleAccessToken).catch(() => {})
    }

    return user
  })
}

export async function emailRegister(req, res, next) {
  return verifyAndRespond(req, res, next, async (uid, email, displayName) => {
    const existing = await User.findOne({ email })
    if (existing) {
      res.status(409).json({ error: { message: 'Email already registered' } })
      return null
    }
    const displayNameFromBody = req.body.name || displayName
    return User.create({ uid, email, displayName: displayNameFromBody })
  })
}

export async function emailLogin(req, res, next) {
  return verifyAndRespond(req, res, next, async (uid, email) => {
    const user = await User.findOne({ uid })
    if (!user) {
      res.status(404).json({ error: { message: 'User not found. Please register first.' } })
      return null
    }
    return user
  })
}

export async function refreshToken(req, res, next) {
  try {
    const token = req.cookies.refreshToken
    if (!token) {
      return res.status(401).json({ error: { message: 'No refresh token' } })
    }

    const decoded = jwt.verify(token, config.jwt.refreshSecret)
    const user = await User.findOne({ uid: decoded.uid })
    if (!user) {
      return res.status(401).json({ error: { message: 'User not found' } })
    }

    const tokens = generateTokens(user)
    setRefreshCookie(res, tokens.refreshToken)

    res.json({ accessToken: tokens.accessToken })
  } catch (error) {
    return res.status(401).json({ error: { message: 'Invalid or expired refresh token' } })
  }
}

export async function logout(req, res) {
  res.clearCookie('refreshToken', { path: '/api/auth' })
  res.json({ message: 'Logged out successfully' })
}
