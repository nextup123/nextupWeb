import fs from "fs/promises";
import { parseXmlString } from "../user_config/customXmlParser.js";
import { ioFilePath, LOGS_JSON_FILE } from "../config/path.js";

const XML_PATH = ioFilePath.DO_DI_TREE_XML_FILE;
const LOG_FILE = LOGS_JSON_FILE;

// ===== Utility: Recursively search nodes =====
export function extractNodes(node, tagName, result = []) {
  if (!node || !node["@children"]) return result;

  for (const child of node["@children"]) {
    if (child.tagName === tagName) {
      result.push(child.content["@attributes"]);
    }
    extractNodes(child.content, tagName, result);
  }
  return result;
}

// ===== Async XML Parser =====
export const getParsedXml = async () => {
  const xmlContent = await fs.readFile(XML_PATH, "utf-8");
  return parseXmlString(xmlContent);
};

// ===== Async Log Saver =====
export async function saveLogMessage(rawMsg) {
  try {
    const [message, type, duration] = rawMsg.split(",");

    if (!message || !type || !duration) {
      console.warn("Invalid log format:", rawMsg);
      return;
    }

    const logEntry = {
      message: message.trim(),
      duration: Number(duration),
      timestamp: new Date().toISOString(),
    };

    let data;

    // Read existing logs (handle file not existing)
    try {
      const fileContent = await fs.readFile(LOG_FILE, "utf-8");
      data = JSON.parse(fileContent);
    } catch (err) {
      // Initialize file if missing
      data = { error: [], success: [], warn: [] };
    }

    if (!data[type]) {
      console.warn("Unknown log type:", type);
      return;
    }

    data[type].push(logEntry);

    // Limit size (keep last 100 logs)
    if (data[type].length > 100) {
      data[type].shift();
    }

    await fs.writeFile(LOG_FILE, JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("Error saving log:", err);
  }
}