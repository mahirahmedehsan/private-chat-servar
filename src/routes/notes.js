import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { getFeed, getMyNotes, createNote, updateNote, deleteNote, toggleNoteReaction, addComment, toggleCommentReaction, deleteComment } from '../controllers/noteController.js'

const router = Router()

router.use(authenticate)

router.get('/', getFeed)
router.get('/my', getMyNotes)
router.post('/', createNote)
router.put('/:id', updateNote)
router.delete('/:id', deleteNote)
router.post('/:id/react', toggleNoteReaction)
router.post('/:id/comments', addComment)
router.post('/:noteId/comments/:commentId/react', toggleCommentReaction)
router.delete('/:noteId/comments/:commentId', deleteComment)

export default router
