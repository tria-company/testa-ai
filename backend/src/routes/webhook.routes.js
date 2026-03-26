import { Router } from 'express';
import { handleEvent } from '../controllers/webhook.controller.js';

const router = Router();

router.post('/evolution', handleEvent);

export default router;
