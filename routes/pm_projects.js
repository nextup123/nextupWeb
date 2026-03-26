import express from "express";
const router = express.Router();

import { createNewProject } from "../utils/pm_utils/projectCreator.js";
import { listProjects } from "../utils/pm_utils/projectRegistry.js";
import { deleteProject } from "../utils/pm_utils/projectDeleter.js";

import {
  loadProject,
  readActiveProjectName,
  readActiveProjectData,
} from "../utils/pm_utils/projectLoader.js";

import { saveProject } from "../utils/pm_utils/projectSaver.js";
import { listProjectVersions } from "../utils/pm_utils/projectVersions.js";
import { restoreProjectVersion } from "../utils/pm_utils/projectVersionRestorer.js";
import { getSessionDetails } from "../utils/pm_utils/runTimeInitializer.js";
// Create project
// Create project
router.post("/create", async (req, res) => {
  try {
    const result = await createNewProject(req.body);
    res.status(201).json(result);
  } catch (err) {
    // 409 Conflict for duplicate name, 400 for all other validation errors
    const status = err.code === 'PROJECT_EXISTS' ? 409 : 400;
    res.status(status).json({ success: false, error: err.message });
    // Do NOT re-throw — that would crash the process
  }
});

// List projects
router.get("/list", async (req, res) => {
  try {
    const projects = await listProjects();

    setTimeout(() => {
      getSessionDetails();
    }, 300);

    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// LOAD
router.post("/load", async (req, res) => {
  try {
    const { name } = req.body;
    const result = await loadProject(name);
    res.json(result);
  } catch (err) {
    console.error("[LOAD ERROR FULL]", err);
    res.status(400).json({ error: err.message, stack: err.stack });
  }
});

// SAVE
router.post("/save", async (req, res) => {
  try {
    const result = await saveProject();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/versions/:name", async (req, res) => {
  try {
    const data = await listProjectVersions(req.params.name);
    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to list versions" });
  }
});

router.post("/overwrite", async (req, res) => {
  const { name } = req.body;

  try {
    await loadProject(name, { force: true });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/restore", async (req, res) => {
  try {
    const { name, versionId } = req.body;
    const result = await restoreProjectVersion(name, versionId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//Add these two Routes

router.get("/active", async (req, res) => {
  try {
    // const { name } = req.body;
    const result = await readActiveProjectName();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/active-project", async (req, res) => {
  try {
    const { projectName } = req.body;
    const result = await readActiveProjectData(projectName);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/delete/:name", async (req, res) => {
  try {
    const { name } = req.params;

    const result = await deleteProject(name);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;