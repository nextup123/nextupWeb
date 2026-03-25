
import fs from "fs";
import { spawn } from 'child_process';

import {
  DESCRIPTION_PATH,
  COMMANDS_PATH,
  OPEN_TERMINAL_PATH,
} from "../config/path.js";
import { readLastErrorLogs } from "../service/errorLogsService.js";

const DEFAULT_LIMIT = 500;
const HARD_LIMIT = 2000;

export const getErrorLogsController = async (req, res) => {
  const limit = Math.min(
    parseInt(req.query.limit) || DEFAULT_LIMIT,
    HARD_LIMIT,
  );

  try {
    const logs = await readLastErrorLogs(limit);
    res.json({
      count: logs.length,
      logs,
    });
  } catch (err) {
    console.error("Error reading error logs:", err);
    res.status(500).json({ error: "Failed to read error logs" });
  }
};

export const getDescriptionController = (req, res) => {
  fs.readFile(DESCRIPTION_PATH, "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Failed to read description");
    }
    res.type("text/plain").send(data);
  });
};

export const postDescriptionController = (req, res) => {
  const content = req.body.content ?? "";

  fs.writeFile(DESCRIPTION_PATH, content, "utf8", (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to save" });
    }
    res.json({ status: "saved" });
  });
};

export const getCommandsController = (req, res) => {
  fs.readFile(COMMANDS_PATH, "utf8", (err, data) => {
    if (err) return res.json({ cells: [] });
    res.json(JSON.parse(data));
  });
};

export const postCommandsController = (req, res) => {
  fs.writeFile(
    COMMANDS_PATH,
    JSON.stringify(req.body, null, 2),
    "utf8",
    (err) => {
      if (err) return res.status(500).json({ error: "save failed" });
      res.json({ status: "saved" });
    },
  );
};

export const openTerminalController = (req, res) => {
  try {
    spawn(OPEN_TERMINAL_PATH, [], {
      detached: true,
      stdio: "ignore",
    }).unref();

    res.json({ status: "terminal launched" });
  } catch (err) {
    console.error("Failed to launch terminal script:", err);
    res.status(500).json({ error: "failed to launch terminal" });
  }
};
