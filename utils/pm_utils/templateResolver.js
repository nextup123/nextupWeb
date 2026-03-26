// utils/templateResolver.js

import fs from "fs-extra";
import path from "node:path";

import { TEMPLATE_PATH } from "./paths.js";

async function loadProjectTemplate() {
  return fs.readJson(TEMPLATE_PATH);
}

async function resolveTrackedPaths() {
  const template = await loadProjectTemplate();

  const tracked = new Set();

  // directories (top-level)
  for (const dir of template.directories || []) {
    tracked.add(dir);
  }

  // files inside directories
  for (const [dir, files] of Object.entries(template.files || {})) {
    if (dir === "root") continue;

    // track directory itself
    tracked.add(dir);

    // OPTIONAL (more granular tracking if needed later)
    // for (const file of Object.keys(files || {})) {
    //   tracked.add(path.join(dir, file));
    // }
  }

  // root-level files
  for (const file of Object.keys(template.files?.root || {})) {
    tracked.add(file);
  }

  return Array.from(tracked);
}

export { resolveTrackedPaths };