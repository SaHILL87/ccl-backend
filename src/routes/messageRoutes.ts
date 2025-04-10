import express from 'express';
import { createMessage, getMessage, decryptMessageContent } from '../controllers/messageController';

const router = express.Router();

router.post('/', createMessage);
router.get('/:messageId', getMessage);
router.post('/:messageId/decrypt', decryptMessageContent);

export default router;