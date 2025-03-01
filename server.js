const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const errorRoutes = require("./routes/errorJsonRoutes");
const logRoutes = require("./routes/misLogRoutes");
const fileRoutes = require("./routes/xlsxFileRoutes");

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static("public")); // Serve static files


// Use separate route files
app.use("/error-handling/errors", errorRoutes);

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

// Start server
server.listen(port, () => console.log(`Server running on http://localhost:${port}`));
