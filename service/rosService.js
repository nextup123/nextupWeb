import fs from "fs";


import { ioFilePath } from "../config/path.js";
import { parseXmlString } from "../user_config/customXmlParser.js";

const XML_PATH = ioFilePath.DO_DI_TREE_XML_FILE;

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

export const getParsedXml = () => {
  const xmlContent = fs.readFileSync(XML_PATH, "utf-8");
  return parseXmlString(xmlContent);
};
