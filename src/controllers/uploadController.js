import multer from 'multer'
import File from '../models/File.js'

const storage = multer.memoryStorage()

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed'), false)
  }
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })

export async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = await File.create({
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
    })

    res.json({
      _id: file._id.toString(),
      url: `/api/files/${file._id}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    })
  } catch (error) {
    next(error)
  }
}
