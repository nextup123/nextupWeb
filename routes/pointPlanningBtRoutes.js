const express = require("express");
const yaml = require("js-yaml");
const {
  getPointFileNameController,
  getPointsController,
  getPointBackupFileNamesController,
  addPointController,
  updatePointController,
  deletePointController,
  deleteAllController,
  reorderPointsController,
  canUndoController,
  undoController,
} = require("../controller/pointPlanningBtController");

const router = express.Router();

// /getPointFileName endpoint
router.get("/getPointFileName", getPointFileNameController);

// /getPoints endpoint
router.get("/getPoints", getPointsController);

// /getPointsBackupFileNames endpoint
router.get("/getPointsBackupFileNames", getPointBackupFileNamesController);

// /addPoint endpoint
router.post("/addPoint", addPointController);

// /updatePoint endpoint
router.post("/updatePoint", updatePointController);

// /deletePoint endpoint
router.post("/deletePoint", deletePointController);

// /deleteAll endpoint
router.post("/deleteAll", deleteAllController);

// /reorderPoints endpoint
router.post("/reorderPoints", reorderPointsController);

// /undo endpoint
router.post("/undo", undoController);

// /canUndo endpoint
router.get("/canUndo", canUndoController);

module.exports = router;

// // Initialize server and create initial backup
// app.listen(3003, async () => {
//     console.log('Server running on http://localhost:3003');
//     if (await fileExists(YAML_FILE) && !await fileExists(YAML_BACKUP_FILE)) {
//         try {
//             await createBackup();
//             console.log('Initial backup created');
//         } catch (err) {
//             console.error('Failed to create initial backup:', err);
//         }
//     }
// });
