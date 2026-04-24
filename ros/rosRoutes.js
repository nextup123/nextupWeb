import express from "express";

import {
  diListController,
  doListController,
  getDiLayoutController,
  getDoLayoutController,
  getLogsController,
  postDiLayoutController,
  postDoLayoutController,
  setFrameController,
  startMotionPlanningController,
} from "./rosController.js";

const router = express.Router();

// ===== File Path =====

// ===== Endpoint: List all DOs =====
router.get("/do-list", doListController);

// Ensure directory exists

// GET DO layout
router.get("/do-layout", getDoLayoutController);

// POST DO layout
router.post("/do-layout", postDoLayoutController);

// ===== Endpoint: List all DIs =====
router.get("/di-list", diListController);

router.get("/di-layout", getDiLayoutController);

router.post("/di-layout", postDiLayoutController);

router.get("/startPlanning", startMotionPlanningController);

router.get("/logs", getLogsController);

router.post('/set_frame', setFrameController);

//ROS ROUTES RELATED TO POINT PLANNING//





////////////////////////////////////////



//ROS ROUTES RELATED TO MAINWEB




export default router;
