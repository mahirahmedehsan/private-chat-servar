import { Router } from 'express'
import { requireDB } from '../middleware/db.js'
import File from '../models/File.js'

const router = Router()

router.get('/:id', requireDB, async (req, res, next) => {
  try {
    const file = await File.findById(req.params.id)
    if (!file) return res.status(404).json({ error: 'File not found' })

    res.set('Content-Type', file.type)
    res.set('Content-Disposition', `inline; filename="${file.name}"`)
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(file.data)
  } catch (error) {
    next(error)
  }
})

export default router
