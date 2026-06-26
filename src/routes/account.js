import { Router } from 'express'
import * as accountController from '../controllers/accountController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.delete('/', authenticate, accountController.deleteAccount)
router.get('/export', authenticate, accountController.exportData)

export default router
