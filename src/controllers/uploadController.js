import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// On Vercel the filesystem is ephemeral — use /tmp for uploaded files
const uploadDir = process.env.VERCEL
  ? '/tmp/uploads'
  : path.resolve(__dirname, '../../uploads')

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed'), false)
  }
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })

export function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  res.json({
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  })
}
