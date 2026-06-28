import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import * as helpLineController from '../controllers/helpLineController.js'

const router = Router()

router.use(authenticate)

router.get('/messages', helpLineController.getHelpMessages)
router.post('/messages', helpLineController.sendHelpMessage)

export default router
