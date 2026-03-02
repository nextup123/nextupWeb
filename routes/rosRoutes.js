// routes/rosRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { parseXmlString } = require('../user_config/customXmlParser');

// ===== File Path =====
const XML_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/do_di_tree.xml';

const SETTINGS_PATH = path.join(__dirname, '../user_config/user_settings.json');
const DI_LAYOUT_PATH = path.join(
  __dirname,
  '../user_config/layouts/di_layout.json'
);

// ===== Utility: Recursively search nodes =====
function extractNodes(node, tagName, result = []) {
  if (!node || !node['@children']) return result;

  for (const child of node['@children']) {
    if (child.tagName === tagName) {
      result.push(child.content['@attributes']);
    }
    extractNodes(child.content, tagName, result);
  }
  return result;
}

// ===== Endpoint: List all DOs =====
router.get('/do-list', async (req, res) => {
  try {
    const xmlContent = fs.readFileSync(XML_PATH, 'utf-8');
    const jsonRoot = parseXmlString(xmlContent);

    const doNodes = extractNodes(jsonRoot, 'DoControl').map((attr) => ({
      name: attr.name,
      driver_id: attr.driver_id,
      do_id: attr.do_id,
      type_of_control: attr.type_of_control,
      ...(attr.type_of_control === 'push' ? { push_wait: attr.push_wait } : {}),
    }));

    res.json({
      count: doNodes.length,
      data: doNodes,
    });
  } catch (err) {
    console.error('Error reading DOs:', err);
    res.status(500).json({ error: 'Failed to read DO list', details: err.message });
  }
});

const DO_LAYOUT_PATH = path.join(
  __dirname,
  '../user_config/layouts/do_layout.json'
);

// Ensure directory exists
fs.mkdirSync(path.dirname(DO_LAYOUT_PATH), { recursive: true });

// GET DO layout
router.get('/do-layout', (req, res) => {
  try {
    if (!fs.existsSync(DO_LAYOUT_PATH)) return res.json({});
    res.json(JSON.parse(fs.readFileSync(DO_LAYOUT_PATH, 'utf-8')));
  } catch (e) {
    console.error('Failed to read DO layout:', e);
    res.status(500).json({ error: 'Failed to load DO layout' });
  }
});

// POST DO layout
router.post('/do-layout', express.json(), (req, res) => {
  try {
    const tmp = DO_LAYOUT_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(req.body, null, 2));
    fs.renameSync(tmp, DO_LAYOUT_PATH);
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('Failed to save DO layout:', e);
    res.status(500).json({ error: 'Failed to save DO layout' });
  }
});


// ===== Endpoint: List all DIs =====
router.get('/di-list', async (req, res) => {
  try {
    const xmlContent = fs.readFileSync(XML_PATH, 'utf-8');
    const jsonRoot = parseXmlString(xmlContent);

    const diNodes = extractNodes(jsonRoot, 'DIControl').map((attr) => ({
      name: attr.name,
      driver_id: attr.driver_id,
      di_id: attr.di_id,
    }));

    res.json({
      count: diNodes.length,
      data: diNodes,
    });
  } catch (err) {
    console.error('Error reading DIs:', err);
    res.status(500).json({ error: 'Failed to read DI list', details: err.message });
  }
});

fs.mkdirSync(path.dirname(DI_LAYOUT_PATH), { recursive: true });

router.get('/di-layout', (req, res) => {
  try {
    if (!fs.existsSync(DI_LAYOUT_PATH)) {
      return res.json({});
    }

    const layout = JSON.parse(fs.readFileSync(DI_LAYOUT_PATH, 'utf-8'));
    res.json(layout);
  } catch (err) {
    console.error('Failed to read DI layout:', err);
    res.status(500).json({ error: 'Failed to load DI layout' });
  }
});

router.post('/di-layout', express.json(), (req, res) => {
  try {
    const layout = req.body;

    if (typeof layout !== 'object') {
      return res.status(400).json({ error: 'Invalid layout format' });
    }

    const tempPath = DI_LAYOUT_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(layout, null, 2));
    fs.renameSync(tempPath, DI_LAYOUT_PATH); // atomic replace

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Failed to save DI layout:', err);
    res.status(500).json({ error: 'Failed to save DI layout' });
  }
});


module.exports = router;
