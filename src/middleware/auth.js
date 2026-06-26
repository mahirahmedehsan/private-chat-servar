import jwt from 'jsonwebtoken'
import config from '../config/index.js'

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'No token provided' } })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } })
  }
}
