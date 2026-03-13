const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const yaml = require("js-yaml");

// const errorRoutes = require("./routes/errorJsonRoutes");
const logRoutes = require("./routes/misLogRoutes");
const fileRoutes = require("./routes/xlsxFileRoutes");
const {
  router: pathPlanningBtRoutes,
  initXMLBackup,
} = require("./routes/pathPlanningBtRoutes");
const pointPlanningBtRoutes = require("./routes/pointPlanningBtRoutes");
const pathTestingRoutes = require("./routes/pathTestingRoutes");
const { router: oiConrol, initIOXMLBackup } = require("./routes/ioRoutes");
const settingsRoute = require("./routes/settings");
const cycleRoute = require("./routes/cycle");
const rosRoutes = require("./routes/rosRoutes");
const errorLogsServiceRoutes = require("./routes/errorLogsServiceRoutes");
const { exec } = require("child_process");
const shoeMouldRoutes = require("./routes/shoeMouldRoutes");
const mappedDataRoutes = require("./routes/mappedDataRoutes");

const app = express();
const port = 3000;
app.use(cors());

// Middleware
app.use(express.json());

app.use("/path-planning", pathPlanningBtRoutes);
app.use("/point-planning", pointPlanningBtRoutes);
app.use("/path-testing", pathTestingRoutes);
app.use("/io-control", oiConrol);
app.use("/ros", rosRoutes);
app.use("/settings", settingsRoute);
app.use("/cycle", cycleRoute);
app.use("/error-logs", errorLogsServiceRoutes);
app.use("/shoe-mould", shoeMouldRoutes);
app.use("/shoe-mould", mappedDataRoutes);
// app.use("/error-handling/errors", errorRoutes);

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

// Start server
server.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`),
);
