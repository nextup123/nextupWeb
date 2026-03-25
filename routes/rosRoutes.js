import express from "express";

import {
  diListController,
  doListController,
  getDiLayoutController,
  getDoLayoutController,
  postDiLayoutController,
  postDoLayoutController,
} from "../controller/rosController.js";

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

export default router;
