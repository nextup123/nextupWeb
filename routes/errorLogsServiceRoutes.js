import express from 'express';
import { getCommandsController, getDescriptionController, getErrorLogsController, openTerminalController, postCommandsController, postDescriptionController } from '../controller/errorLogsController.js';


const router = express.Router();


router.get('/', getErrorLogsController);

// ---------------- GET description ----------------
router.get('/description', getDescriptionController);

// ---------------- SAVE description ----------------
router.post('/description', postDescriptionController);

// ---------- GET notebook ----------
router.get('/commands', getCommandsController);

// ---------- SAVE notebook ----------
router.post('/commands', postCommandsController);

router.post('/open-terminal', openTerminalController);


export default router;