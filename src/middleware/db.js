import { ensureDB } from '../config/db.js'

export async function requireDB(req, res, next) {
  const ready = await ensureDB()
  if (!ready) {
    return res.status(503).json({
      error: { message: 'Database temporarily unavailable. Please try again.' },
    })
  }
  next()
}
