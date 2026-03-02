// routes/cycle.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const SETTINGS_PATH = path.join(__dirname, '../user_config/user_settings.json');

function readSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function writeSettings(newData) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(newData, null, 2));
}

// 🟢 GET - Reset total operations
router.get('/reset', (req, res) => {
  const settings = readSettings();
  settings.total_operations = 0;
  writeSettings(settings);
  console.log('🧹 Total operations reset');
  res.json({ message: 'Total operations reset to 0', data: settings });
});

module.exports = router;
