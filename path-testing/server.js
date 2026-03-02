const express = require("express");
const http = require("http");
const path = require("path");
const cors = require('cors');

const pathRoutes = require("./routes/pathRoutes");
// const cycleRoutes = require("./routes/cycleRoutes"); 
const robotPoseRoutes = require("./routes/robotPoseRoutes"); 
const sequenceRoutes = require("./routes/sequenceRunnerRoutes");
const ros2Manager = require('./utils/ros2Manager'); 
const sequenceCreatorRoutes = require('./routes/sequenceCreatorRoutes');
const runPathRoutes = require('./routes/runPathRoutes');

// Add these routes before your existing routes
const layoutRoutes = require('./routes/layoutRoutes');
const app = express();
const port = 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve static files



// Routes
app.use('/config/layouts', layoutRoutes);
app.use("/api", pathRoutes);
// app.use("/api/cycles", cycleRoutes);
app.use("/pose", robotPoseRoutes);
app.use("/api/sequences", sequenceRoutes);
app.use('/api/sequences-creator', sequenceCreatorRoutes);
app.use('/runPath', runPathRoutes);



// Start server 
const server = http.createServer(app);
server.listen(port, () => console.log(`Server running !!!`));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await ros2Manager.shutdown();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await ros2Manager.shutdown();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});