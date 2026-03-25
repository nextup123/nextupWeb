import express from "express";
import { promises as fs } from "fs";
import path from "path";
import yaml from "js-yaml";
import chokidar from "chokidar";
const router = express.Router();

// Configuration
const YAML_PATH =
  "/home/nextup/user_config_files/planning_data/articles/articles.yaml";
const CURRENT_INDEX_YAML_PATH =
  "/home/nextup/user_config_files/planning_data/articles/article_current_index.yaml";
const DEFAULT_ARTICLES_COUNT = 60;

// Ensure directory exists
async function ensureDirectory() {
  const dir = path.dirname(YAML_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Read articles YAML file (no longer contains machine_current_index)
async function readArticlesYAML() {
  try {
    const content = await fs.readFile(YAML_PATH, "utf8");
    return yaml.load(content);
  } catch (error) {
    // Return default structure if file doesn't exist
    return {
      articles_file_name: "articles.yaml",
      description: "Y-offsets for different shoe mould sizes in centimeters",
      unit: {
        position: "cm",
        orientation: "deg",
      },
      articles: [],
    };
  }
}

// Read current index from separate file
async function readCurrentIndex() {
  try {
    const content = await fs.readFile(CURRENT_INDEX_YAML_PATH, "utf8");
    const data = yaml.load(content);
    return data.machine_current_index || 1;
  } catch (error) {
    // Return default if file doesn't exist
    return 1;
  }
}

// Write articles YAML file (no machine_current_index)
async function writeArticlesYAML(data) {
  // Remove machine_current_index if present (for backward compatibility)
  const { machine_current_index, ...articlesData } = data;

  const yamlContent = yaml.dump(articlesData, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });
  await fs.writeFile(YAML_PATH, yamlContent, "utf8");
}

// Write current index to separate file
async function writeCurrentIndex(index) {
  const yamlContent = yaml.dump(
    { machine_current_index: index },
    {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    },
  );
  await fs.writeFile(CURRENT_INDEX_YAML_PATH, yamlContent, "utf8");
}

// Combined read for API response (merges both files)
async function readFullConfig() {
  const [articlesData, currentIndex] = await Promise.all([
    readArticlesYAML(),
    readCurrentIndex(),
  ]);

  return {
    ...articlesData,
    machine_current_index: currentIndex,
  };
}

// ==================== API Routes ====================

// GET all articles and current index
router.get("/articles", async (req, res) => {
  try {
    const data = await readFullConfig();
    res.json(data);
  } catch (error) {
    console.error("Error reading articles:", error);
    res.status(500).json({ error: "Failed to read configuration" });
  }
});

// POST update articles and/or current index
router.post("/articles", async (req, res) => {
  try {
    const { articles, machine_current_index } = req.body;

    // Read current articles data
    const currentData = await readArticlesYAML();

    if (articles !== undefined) {
      // Validate shoe_foot_type for each article
      for (const article of articles) {
        if (article.shoe_foot_type !== undefined) {
          const validTypes = ["left", "right"];
          if (!validTypes.includes(article.shoe_foot_type)) {
            return res.status(400).json({
              error: `Invalid shoe_foot_type for article ${article.id}. Must be 'left' or 'right'`,
            });
          }
        }
      }

      // Merge strategy: Preserve extra fields (x_offset_cm, roll_deg, etc.)
      const mergedArticles = articles.map((newArticle) => {
        const existing = currentData.articles.find(
          (a) => a.id === newArticle.id,
        );

        if (existing) {
          return {
            ...existing,
            ...newArticle,
          };
        }

        return newArticle;
      });

      currentData.articles = mergedArticles;
      await writeArticlesYAML(currentData);
    }

    // Handle current index separately if provided
    if (machine_current_index !== undefined) {
      const idx = parseInt(machine_current_index);
      if (idx < 1 || idx > DEFAULT_ARTICLES_COUNT) {
        return res.status(400).json({
          error: `Invalid index. Must be between 1 and ${DEFAULT_ARTICLES_COUNT}`,
        });
      }
      await writeCurrentIndex(idx);
    }

    const fullData = await readFullConfig();
    notifyClients(fullData);

    res.json({ success: true, message: "Configuration updated" });
  } catch (error) {
    console.error("Error saving articles:", error);
    res.status(500).json({ error: "Failed to save configuration" });
  }
});

// POST update only current index
router.post("/current-index", async (req, res) => {
  try {
    const { index } = req.body;
    const idx = parseInt(index);

    if (isNaN(idx) || idx < 1 || idx > DEFAULT_ARTICLES_COUNT) {
      return res.status(400).json({
        error: `Invalid index. Must be between 1 and ${DEFAULT_ARTICLES_COUNT}`,
      });
    }

    await writeCurrentIndex(idx);

    // Notify clients with updated full config
    const fullData = await readFullConfig();
    notifyClients(fullData);

    res.json({ success: true, index: idx });
  } catch (error) {
    console.error("Error updating index:", error);
    res.status(500).json({ error: "Failed to update index" });
  }
});

// ==================== SSE Setup ====================

let clients = [];

router.get("/watch", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const clientId = Date.now();
  const newClient = { id: clientId, res: res };
  clients.push(newClient);

  console.log(`SSE client connected: ${clientId}. Total: ${clients.length}`);

  // Send initial merged data
  readFullConfig().then((data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients = clients.filter((c) => c.id !== clientId);
    console.log(
      `SSE client disconnected: ${clientId}. Total: ${clients.length}`,
    );
  });
});

function notifyClients(data) {
  clients.forEach((client) => {
    try {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error(`Failed to notify client ${client.id}:`, err);
    }
  });
}

// ==================== File Watcher ====================

let articlesWatcher = null;
let indexWatcher = null;

function startWatchers() {
  // Watch articles file
  if (!articlesWatcher) {
    articlesWatcher = chokidar.watch(YAML_PATH, {
      persistent: true,
      ignoreInitial: true,
    });

    articlesWatcher.on("change", async () => {
      console.log("Articles YAML changed externally");
      try {
        const data = await readFullConfig();
        notifyClients(data);
      } catch (error) {
        console.error("Error reading changed articles file:", error);
      }
    });
  }

  // Watch current index file
  if (!indexWatcher) {
    indexWatcher = chokidar.watch(CURRENT_INDEX_YAML_PATH, {
      persistent: true,
      ignoreInitial: true,
    });

    indexWatcher.on("change", async () => {
      console.log("Current index YAML changed externally");
      try {
        const data = await readFullConfig();
        notifyClients(data);
      } catch (error) {
        console.error("Error reading changed index file:", error);
      }
    });
  }

  console.log("File watchers started");
}

ensureDirectory().then(() => {
  startWatchers();
});

export default router;
