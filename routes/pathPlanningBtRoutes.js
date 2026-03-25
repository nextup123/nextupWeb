import express from "express";
import {
  addPlanPathController,
  canUndoController,
  deleteAllController,
  deleteLastController,
  deletePathController,
  getOriginPointFileNameController,
  getPathNamesController,
  getPathsYAMLController,
  getPointFileNameController,
  getPointNamesController,
  getTreeDataController,
  getXMLController,
  reorderSequencesController,
  undoController,
  updatePlanPathController,
} from "../controller/pathPlanningBtController.js";

const router = express.Router();

// UNDO endpoint
router.post("/undo", undoController);

// Check if undo is available
router.get("/canUndo", canUndoController);

router.get("/getPointNames", getPointNamesController);

router.get("/getPathNames", getPathNamesController);

router.get("/getPathsYAML", getPathsYAMLController);

router.get("/getOriginPointFileName", getOriginPointFileNameController);

router.get("/getPointFileName", getPointFileNameController);

router.post("/getXML", getXMLController);

router.get("/getTreeData", getTreeDataController);

router.post("/addPlanPath", addPlanPathController);

router.post("/updatePlanPath", updatePlanPathController);

router.post("/deletePath", deletePathController);

router.post("/deleteLast", deleteLastController);

router.post("/deleteAll", deleteAllController);

router.post("/reorderSequences", reorderSequencesController);

export default router;

// router.listen(3005, async () => {
//     console.log('Server running on http://localhost:3005');

//     // Initialize backup if it doesn't exist but main file does
//     if (fileExists(XML_FILE) && !fileExists(XML_BACKUP_FILE)) {
//         try {
//             await createBackup();
//             console.log('Initial backup created');
//         } catch (err) {
//             console.error('Failed to create initial backup:', err);
//         }
//     }
// });
