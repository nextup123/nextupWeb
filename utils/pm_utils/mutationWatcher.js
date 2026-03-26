import chokidar from "chokidar";
import path from "node:path";
import fs from "node:fs";

import { ACTIVE_RUNTIME_PATH } from "./paths.js";
import { markDirty } from "./dirtyTracker.js";
import { resolveTrackedPaths } from "./templateResolver.js";

let watcher = null;
let watcherActive = false;
let trackedPaths = [];
let dirtyTriggered = false;

// ignored noise
const IGNORED_PATTERNS = [".session.yaml", "project.yaml", ".swp", ".tmp", "~"];

function isIgnored(filePath) {
  const base = path.basename(filePath);
  return IGNORED_PATTERNS.some((p) => base === p || base.endsWith(p));
}

function isTracked(filePath) {
  const incoming = path.basename(filePath);

  return trackedPaths.some((p) => {
    return path.basename(p) === incoming;
  });
}

function getWatcherStatus() {
  return {
    active: watcherActive,
    watchingPath: ACTIVE_RUNTIME_PATH,
    trackedPaths,
    watcherInitialized: !!watcher,
  };
}

async function startMutationWatcher() {
  if (watcherActive) {
    console.log("[WATCHER] already active");
    return;
  }

  console.log("[WATCHER] starting...");
  console.log("[WATCHER] path exists:", fs.existsSync(ACTIVE_RUNTIME_PATH));

  trackedPaths = (await resolveTrackedPaths()).map((p) => {
    return path.join(ACTIVE_RUNTIME_PATH, path.basename(p));
  });

  console.log("[WATCHER] tracked paths:", trackedPaths);

  watcher = chokidar.watch(ACTIVE_RUNTIME_PATH, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  watcher.on("ready", () => {
    console.log("[WATCHER] ready");
  });

  watcher.on("error", (err) => {
    console.error("[WATCHER ERROR]", err);
  });

  watcher.on("all", (event, filePath) => {
    console.log(`[CHOKIDAR EVENT] ${event}: ${filePath}`);
  });

  const handleChange = async (filePath) => {
    const absPath = path.resolve(filePath);
    console.log("Incoming file:", path.basename(absPath));
    console.log(
      "Tracked files:",
      trackedPaths.map((p) => path.basename(p)),
    );
    console.log("[WATCH EVENT]", absPath);

    if (isIgnored(absPath)) {
      console.log("[IGNORED]", absPath);
      return;
    }

    if (!isTracked(absPath)) {
      console.log("[NOT TRACKED]", absPath);
      return;
    }

    if (dirtyTriggered) {
      console.log("[ALREADY DIRTY - SKIPPING]");
      return;
    }

    dirtyTriggered = true;

    console.log("[DIRTY TRIGGERED]", absPath);

    await markDirty("external_mutation");

    // stopMutationWatcher();
  };

  watcher.on("add", handleChange);

  watcher.on("change", (filePath) => {
    console.log("Something Changed");
    handleChange(filePath);
  });

  watcher.on("unlink", handleChange);

  watcherActive = true;
  dirtyTriggered = false;

  console.log("[WATCHER] ACTIVE:", watcherActive);
}

function stopMutationWatcher() {
  if (watcher) {
    watcher.close();
    console.log("[WATCHER] stopped");
  }

  watcher = null;
  watcherActive = false;
}

function resetDirtyFlag() {
  console.log("[WATCHER] resetting dirty flag");
  dirtyTriggered = false;
}

export {
  startMutationWatcher,
  stopMutationWatcher,
  getWatcherStatus,
  resetDirtyFlag,
};