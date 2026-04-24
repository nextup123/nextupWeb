import fs from "fs";
import path from "path";

import fsasync from "fs/promises";
import { LOGS_JSON_FILE } from "../config/path.js";
import { fileURLToPath } from "url";
import { extractNodes, getParsedXml } from "./rosHelper.js";
import { getROSNode } from "./rosService.js";



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

fs.mkdirSync(path.dirname(DO_LAYOUT_PATH), { recursive: true });
fs.mkdirSync(path.dirname(DI_LAYOUT_PATH), { recursive: true });

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
    res
      .status(500)
      .json({ error: "Failed to read DO list", details: err.message });
  }
};

export const getDoLayoutController = (req, res) => {
  try {
    if (!fs.existsSync(DO_LAYOUT_PATH)) return res.json({});
    res.json(JSON.parse(fs.readFileSync(DO_LAYOUT_PATH, "utf-8")));
  } catch (e) {
    console.error("Failed to read DO layout:", e);
    res.status(500).json({ error: "Failed to load DO layout" });
  }
};

export const postDoLayoutController = (req, res) => {
  try {
    const tmp = DO_LAYOUT_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(req.body, null, 2));
    fs.renameSync(tmp, DO_LAYOUT_PATH);
    res.json({ status: "ok" });
  } catch (e) {
    console.error("Failed to save DO layout:", e);
    res.status(500).json({ error: "Failed to save DO layout" });
  }
};

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
    res
      .status(500)
      .json({ error: "Failed to read DI list", details: err.message });
  }
};

export const getDiLayoutController = (req, res) => {
  try {
    if (!fs.existsSync(DI_LAYOUT_PATH)) {
      return res.json({});
    }

    const layout = JSON.parse(fs.readFileSync(DI_LAYOUT_PATH, "utf-8"));
    res.json(layout);
  } catch (err) {
    console.error("Failed to read DI layout:", err);
    res.status(500).json({ error: "Failed to load DI layout" });
  }
};

export const postDiLayoutController = (req, res) => {
  try {
    const layout = req.body;

    if (typeof layout !== "object") {
      return res.status(400).json({ error: "Invalid layout format" });
    }

    const tempPath = DI_LAYOUT_PATH + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(layout, null, 2));
    fs.renameSync(tempPath, DI_LAYOUT_PATH); // atomic replace

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Failed to save DI layout:", err);
    res.status(500).json({ error: "Failed to save DI layout" });
  }
};


export const startMotionPlanningController = async (req, res) => {
  console.log("Line 130 ros controller.js");
  try {
    const ros = getROSNode();

    if (!ros) {
      console.error("ROS not initialized yet");
      return;
    }

    ros.publishMotionStart(true);
  } catch (error) {
    console.error(error);
  }
}

// routes/logs.js (or inside your main server file)


export async function getLogs(req, res) {
  try {
    const data = await fsasync.readFile(LOGS_JSON_FILE, "utf-8");
    const logs = JSON.parse(data);

    res.json({
      success: true,
      data: logs
    });

  } catch (err) {
    console.error("Error reading logs:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch logs"
    });
  }
}