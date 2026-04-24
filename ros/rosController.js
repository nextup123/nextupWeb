import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { extractNodes, getParsedXml } from "./rosHelper.js";
import { getROSNode } from "./rosService.js";
import { LOGS_JSON_FILE } from "../config/path.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DO_LAYOUT_PATH = path.join(
  __dirname,
  "../user_config/layouts/do_layout.json",
);

const SETTINGS_PATH = path.join(__dirname, "../user_config/user_settings.json");

const DI_LAYOUT_PATH = path.join(
  __dirname,
  "../user_config/layouts/di_layout.json",
);

// Ensure directories exist
await fs.mkdir(path.dirname(DO_LAYOUT_PATH), { recursive: true });
await fs.mkdir(path.dirname(DI_LAYOUT_PATH), { recursive: true });

export const doListController = async (req, res) => {
  try {
    const jsonRoot = getParsedXml();

    const doNodes = extractNodes(jsonRoot, "DoControl").map((attr) => ({
      name: attr.name,
      driver_id: attr.driver_id,
      do_id: attr.do_id,
      type_of_control: attr.type_of_control,
      ...(attr.type_of_control === "push" ? { push_wait: attr.push_wait } : {}),
    }));

    res.json({
      count: doNodes.length,
      data: doNodes,
    });
  } catch (err) {
    console.error("Error reading DOs:", err);
    res.status(500).json({
      error: "Failed to read DO list",
      details: err.message,
    });
  }
};

export const getDoLayoutController = async (req, res) => {
  try {
    const data = await fs.readFile(DO_LAYOUT_PATH, "utf-8").catch(() => null);

    if (!data) return res.json({});

    res.json(JSON.parse(data));
  } catch (e) {
    console.error("Failed to read DO layout:", e);
    res.status(500).json({ error: "Failed to load DO layout" });
  }
};

export const postDoLayoutController = async (req, res) => {
  try {
    const tmp = DO_LAYOUT_PATH + ".tmp";

    await fs.writeFile(tmp, JSON.stringify(req.body, null, 2));
    await fs.rename(tmp, DO_LAYOUT_PATH);

    res.json({ status: "ok" });
  } catch (e) {
    console.error("Failed to save DO layout:", e); {
      res.status(500).json({ error: "Failed to save DO layout" });
    }
  };
}
export const diListController = async (req, res) => {
  try {
    const jsonRoot = getParsedXml();

    const diNodes = extractNodes(jsonRoot, "DIControl").map((attr) => ({
      name: attr.name,
      driver_id: attr.driver_id,
      di_id: attr.di_id,
    }));

    res.json({
      count: diNodes.length,
      data: diNodes,
    });
  } catch (err) {
    console.error("Error reading DIs:", err);
    res.status(500).json({
      error: "Failed to read DI list",
      details: err.message,
    });
  }
};

export const getDiLayoutController = async (req, res) => {
  try {
    const data = await fs.readFile(DI_LAYOUT_PATH, "utf-8").catch(() => null);

    if (!data) return res.json({});

    res.json(JSON.parse(data));
  } catch (err) {
    console.error("Failed to read DI layout:", err);
    res.status(500).json({ error: "Failed to load DI layout" });
  }
};

export const postDiLayoutController = async (req, res) => {
  try {
    const layout = req.body;

    if (typeof layout !== "object") {
      return res.status(400).json({ error: "Invalid layout format" });
    }

    const tempPath = DI_LAYOUT_PATH + ".tmp";

    await fs.writeFile(tempPath, JSON.stringify(layout, null, 2));
    await fs.rename(tempPath, DI_LAYOUT_PATH);

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Failed to save DI layout:", err);
    res.status(500).json({ error: "Failed to save DI layout" });
  }
};

export const startMotionPlanningController = async (req, res) => {
  try {
    console.log("Line 130 ros controller.js");

    const ros = getROSNode();

    if (!ros) {
      console.error("ROS not initialized yet");
      return res.status(500).json({ error: "ROS not initialized" });
    }

    await ros.publishMotionStart(true); // assuming this can be async

    res.json({ status: "started" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to start motion planning" });
  }
};

export async function getLogsController(req, res) {
  try {
    const data = await fs.readFile(LOGS_JSON_FILE, "utf-8");
    const logs = JSON.parse(data);

    res.json({
      success: true,
      data: logs,
    });
  } catch (err) {
    console.error("Error reading logs:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch logs",
    });
  }
}

export async function setFrameController(req, res) {
  const { frame } = req.body;
  if (!frame || typeof frame !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "frame" field' });
  }

  const ros = getROSNode();
  if (!ros) {
    console.error("ROS not initialized yet");
    return res.status(500).json({ error: "ROS not initialized" });
  }

  // ✅ Correct: call the dedicated method
  ros.publishFrameMode(frame);

  console.log(`Published frame_mode: ${frame}`);
  res.json({ success: true, frame });
}
