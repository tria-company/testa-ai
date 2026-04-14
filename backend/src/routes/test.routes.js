import { Router } from 'express';
import { startTest, stopTest, streamStatus, getReport, listSessions } from '../controllers/test.controller.js';

const router = Router();

router.post('/start', startTest);
router.get('/list', listSessions);
router.post('/:id/stop', stopTest);
router.get('/:id/status', streamStatus);
router.get('/:id/report', getReport);

export default router;
