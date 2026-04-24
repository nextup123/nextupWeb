import express from "express";
import http from "http";
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
import errorLogsServiceRoutes from "./routes/errorLogsServiceRoutes.js";
import shoeMouldRoutes from "./routes/shoeMouldRoutes.js";
import mappedDataRoutes from "./routes/mappedDataRoutes.js";
import { initSequenceModule } from "./service/sequenceCreatorService.js";
import { initXMLBackup } from "./service/pathPlanningBtService.js";
import mainTreeRoutes from "./routes/mainTreeRoutes.js";
import projectRoutes from "./routes/pm_projects.js";
import statusRoutes from "./routes/pm_status.js";
import { initializeRuntime } from "./utils/pm_utils/runTimeInitializer.js";
import rosRoutes from "./ros/rosRoutes.js";

import WSServer from "./ws/wsServer.js";
import { createWSHandler } from "./ws/wsHandler.js";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ================= INIT NON-ROS SERVICES =================
initSequenceModule();
initXMLBackup();

// ================= ROUTES =================
app.use("/point-planning", pointPlanningBtRoutes);
app.use("/path-planning", pathPlanningBtRoutes);
app.use("/path-testing", pathTestingRoutes);
app.use("/io-control", oiConrol);
app.use("/settings", settingsRoute);
app.use("/cycle", cycleRoute);
app.use("/error-logs", errorLogsServiceRoutes);
app.use("/main-tree", mainTreeRoutes);

app.use("/api/projects", projectRoutes);
app.use("/api/status", statusRoutes);
app.use("/ros",rosRoutes);
app.use("/ui_micron_diagnosis", logRoutes);

// ================= SYSTEM APIs =================
app.get("/uptime", (req, res) => {
  exec("uptime", (err, stdout, stderr) => {
    if (err) {
      console.error("Uptime command error:", stderr);
      return res.status(500).json({ error: "Failed to get system info" });
    }

    const uptimeData = parseUptime(stdout.trim());
    res.json(uptimeData);
  });
});

function parseUptime(uptimeString) {
  const timeMatch = uptimeString.match(/^(\d{2}:\d{2}:\d{2})/);
  const upMatch = uptimeString.match(/up\s+(.+?),/);
  const loadMatch = uptimeString.match(/load average:\s+(.+)$/);

  return {
    currentTime: timeMatch ? timeMatch[1] : "N/A",
    uptime: upMatch ? upMatch[1] : "N/A",
    loadAverage: loadMatch ? loadMatch[1] : "N/A",
  };
}

// ================= ETHERCAT =================
app.post("/start-ethercat", (req, res) => {
  exec("sudo /etc/init.d/ethercat start", (error, stdout, stderr) => {
    if (error) return res.status(500).send(error.message);
    if (stderr) return res.status(500).send(stderr);
    res.send(`Started EtherCAT:\n${stdout}`);
  });
});

app.post("/stop-ethercat", (req, res) => {
  exec("sudo /etc/init.d/ethercat stop", (error, stdout, stderr) => {
    if (error) return res.status(500).send(error.message);
    if (stderr) return res.status(500).send(stderr);
    res.send(`Stopped EtherCAT:\n${stdout}`);
  });
});

// ================= ROS MONITOR =================
const MONITOR_YAML =
  "/home/nextup/user_config_files/ros_node_controller_monitor/monitor.yaml";

app.get("/ros-monitor/names", (req, res) => {
  try {
    if (!fs.existsSync(MONITOR_YAML)) {
      return res.status(404).json({ error: "monitor.yaml not found" });
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
    res.status(500).json({ error: "Failed to parse monitor.yaml" });
  }
});

// ================= SYSTEMCTL SAFE =================
function isValidServiceName(name) {
  return /^[a-zA-Z0-9-_]+$/.test(name);
}

app.post("/start/:service", (req, res) => {
  const service = req.params.service;
  if (!isValidServiceName(service)) return res.sendStatus(400);

  exec(`sudo systemctl start ${service}`, (error, stdout, stderr) => {
    if (error) return res.status(500).send(stderr);
    res.send(`Started ${service}`);
  });
});

app.post("/stop/:service", (req, res) => {
  const service = req.params.service;
  if (!isValidServiceName(service)) return res.sendStatus(400);

  exec(`sudo systemctl stop ${service}`, (error, stdout, stderr) => {
    if (error) return res.status(500).send(stderr);
    res.send(`Stopped ${service}`);
  });
});

// ================= POWER =================
app.post("/shutdown", (req, res) => {
  exec("sudo shutdown now", () => res.sendStatus(200));
});

app.post("/reboot", (req, res) => {
  exec("sudo reboot", () => res.sendStatus(200));
});

app.post("/force-shutdown", (req, res) => {
  exec("sudo poweroff -f", () => res.sendStatus(200));
});

// ================= PASSWORD =================
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

// ================= Shutdown ===================
function setupGracefulShutdown({ server, wsServer, ros }) {
  const shutdown = async (signal) => {
    console.log(`\n⚠️ Received ${signal}. Shutting down...`);

    try {
      // HTTP
      server.close(() => {
        console.log("HTTP server closed");
      });

      // WS
      if (wsServer && wsServer.close) {
        wsServer.close();
        console.log("WebSocket server closed");
      }

      // ROS
      if (ros && ros.shutdown) {
        await ros.shutdown();
        console.log("ROS node shutdown complete");
      }

      setTimeout(() => {
        console.log("Force exiting...");
        process.exit(0);
      }, 500);

    } catch (err) {
      console.error("Shutdown error:", err);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// ================= MAIN START =================
async function startServer() {
  // ✅ CREATE HTTP SERVER (REQUIRED)
  const server = http.createServer(app);

  // ✅ PASS CORRECT OBJECT
  const wsServer = new WSServer(server);

  // ROS INIT - Use the async factory function
  const createROSNode = (await import('./ros/rosService.js')).default;
  const ros = await createROSNode(wsServer);

  // WS HANDLER
  const handler = createWSHandler({ ros, wsServer });
  wsServer.setMessageHandler(handler);

  // Runtime init
  setTimeout(async () => {
    await initializeRuntime();
  }, 500);

  // ✅ FIXED shutdown wiring
  setupGracefulShutdown({ server, wsServer, ros });

  // ✅ USE server.listen NOT app.listen
  server.listen(port, () =>
    console.log(`Server running on http://localhost:${port}`)
  );
}

startServer();