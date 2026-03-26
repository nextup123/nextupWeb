import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import yaml from "js-yaml";
import { exec } from "child_process";

import logRoutes from "./routes/misLogRoutes.js";

import pathPlanningBtRoutes from "./routes/pathPlanningBtRoutes.js";

import pointPlanningBtRoutes from "./routes/pointPlanningBtRoutes.js";
import pathTestingRoutes from "./routes/pathTestingRoutes.js";

import oiConrol from "./routes/ioRoutes.js";

import settingsRoute from "./routes/settings.js";
import cycleRoute from "./routes/cycle.js";
import rosRoutes from "./ros/rosRoutes.js";
import errorLogsServiceRoutes from "./routes/errorLogsServiceRoutes.js";
import shoeMouldRoutes from "./routes/shoeMouldRoutes.js";
import mappedDataRoutes from "./routes/mappedDataRoutes.js";
import { initSequenceModule } from "./service/sequenceCreatorService.js";
import { initXMLBackup } from "./service/pathPlanningBtService.js";
import mainTreeRoutes from './routes/mainTreeRoutes.js';
import projectRoutes from "./routes/pm_projects.js";
import statusRoutes from "./routes/pm_status.js";
import { initializeRuntime } from "./utils/pm_utils/runTimeInitializer.js";
const app = express();
const port = 3000;
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.static("public")); // Serve static files


initSequenceModule();
app.use("/point-planning", pointPlanningBtRoutes);
app.use("/path-planning", pathPlanningBtRoutes);
app.use("/path-testing", pathTestingRoutes);
app.use("/io-control", oiConrol);
app.use("/ros", rosRoutes);
app.use("/settings", settingsRoute);
app.use("/cycle", cycleRoute);
app.use("/error-logs", errorLogsServiceRoutes);
app.use("/shoe-mould", shoeMouldRoutes);
app.use("/shoe-mould", mappedDataRoutes);
app.use("/main-tree",mainTreeRoutes);
// app.use("/error-handling/errors", errorRoutes);

app.use("/api/projects", projectRoutes);
app.use("/api/status", statusRoutes); // ✅ ADD THIS


app.use("/ui_micron_diagnosis", logRoutes);
// app.use("/files", fileRoutes);
 
// Create HTTP server
const server = http.createServer(app);
const io = new Server(server);

// WebSocket Namespace for Error Handling
const errorNamespace = io.of("/error-namespace");
errorNamespace.on("connection", (socket) => {
  console.log("Error handler connected");
  socket.on("disconnect", () => console.log("Error handler disconnected"));
});

// WebSocket Namespace for Logs
const logNamespace = io.of("/log-namespace");
logNamespace.on("connection", (socket) => {
  console.log("Log client connected");
  socket.on("disconnect", () => console.log("Log client disconnected"));
});

//****************API***************//
initXMLBackup();

app.get("/uptime", (req, res) => {
  exec("uptime", (err, stdout, stderr) => {
    if (err) {
      console.error("Uptime command error:", stderr);
      return res.status(500).json({ error: "Failed to get system info" });
    }

    // Return structured data instead of raw text
    const uptimeData = parseUptime(stdout.trim());
    res.json(uptimeData);
  });
});

function parseUptime(uptimeString) {
  // Example input: "16:01:51 up 1 min, 1 user, load average: 0.23, 0.12, 0.05"
  const timeMatch = uptimeString.match(/^(\d{2}:\d{2}:\d{2})/);
  const upMatch = uptimeString.match(/up\s+(.+?),/);
  const loadMatch = uptimeString.match(/load average:\s+(.+)$/);

  return {
    currentTime: timeMatch ? timeMatch[1] : "N/A",
    uptime: upMatch ? upMatch[1] : "N/A",
    loadAverage: loadMatch ? loadMatch[1] : "N/A",
  };
}

app.post("/start-ethercat", (req, res) => {
  exec("sudo /etc/init.d/ethercat start", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).send(`Error: ${error.message}`);
    }
    if (stderr) {
      console.warn(`Stderr: ${stderr}`);
      return res.status(500).send(`Stderr: ${stderr}`);
    }
    console.log(`Success: ${stdout}`);
    res.send(`Started EtherCAT:\n${stdout}`);
  });
});

app.post("/stop-ethercat", (req, res) => {
  exec("sudo /etc/init.d/ethercat stop", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).send(`Error: ${error.message}`);
    }
    if (stderr) {
      console.warn(`Stderr: ${stderr}`);
      return res.status(500).send(`Stderr: ${stderr}`);
    }
    console.log(`Success: ${stdout}`);
    res.send(`stopped EtherCAT:\n${stdout}`);
  });
});

const MONITOR_YAML =
  "/home/nextup/user_config_files/ros_node_controller_monitor/monitor.yaml";

app.get("/ros-monitor/names", (req, res) => {
  try {
    if (!fs.existsSync(MONITOR_YAML)) {
      return res.status(404).json({
        error: "monitor.yaml not found",
      });
    }

    const fileContents = fs.readFileSync(MONITOR_YAML, "utf8");
    const data = yaml.load(fileContents);

    const nodeNames = (data.nodes || []).map((n) => n.name);
    const controllerNames = (data.controllers || []).map((c) => c.name);

    res.json({
      nodes: nodeNames,
      controllers: controllerNames,
    });
  } catch (err) {
    console.error("Failed to read monitor.yaml:", err);
    res.status(500).json({
      error: "Failed to parse monitor.yaml",
    });
  }
});

// Start service === systemctl
app.post("/start/:service", (req, res) => {
  const service = req.params.service;
  exec(`sudo systemctl start ${service}`, (error, stdout, stderr) => {
    if (error) return res.status(500).send(stderr);
    res.send(`Started ${service}`);
  });
});

// Stop service === systemctl
app.post("/stop/:service", (req, res) => {
  const service = req.params.service;
  exec(`sudo systemctl stop ${service}`, (error, stdout, stderr) => {
    if (error) return res.status(500).send(stderr);
    res.send(`Stopped ${service}`);
  });
});

app.post("/shutdown", (req, res) => {
  exec("sudo shutdown now", () => res.sendStatus(200));
});

app.post("/reboot", (req, res) => {
  exec("sudo reboot", () => res.sendStatus(200));
});

app.post("/force-shutdown", (req, res) => {
  exec("sudo poweroff -f", () => res.sendStatus(200));
});

const PASSWORD_FILE =
  "/home/nextup/user_config_files/security/web_frontent_passwords.json";

app.get("/security/visualizer-password", (req, res) => {
  try {
    if (!fs.existsSync(PASSWORD_FILE)) {
      return res.json({ password: null });
    }

    const raw = fs.readFileSync(PASSWORD_FILE, "utf8");
    const data = JSON.parse(raw);

    const password = data?.visualizer?.password || null;

    res.json({ password });
  } catch (err) {
    console.error("Failed to read visualizer password:", err);
    res.json({ password: null });
  }
});

setTimeout (async () => {
  await initializeRuntime(); 
}, 500);


// Start server
server.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`),
);
