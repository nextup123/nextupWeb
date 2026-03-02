const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const chokidar = require('chokidar');

const router = express.Router();

const MAPPED_DATA_PATH = '/home/nextup/user_config_files/planning_data/articles/mapped_data.yaml';

// Ensure directory exists
async function ensureDirectory() {
    const dir = path.dirname(MAPPED_DATA_PATH);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

// Read mapped data YAML
async function readMappedData() {
    try {
        const content = await fs.readFile(MAPPED_DATA_PATH, 'utf8');
        return yaml.load(content);
    } catch (error) {
        return {
            mapped_data_file_name: 'mapped_data.yaml',
            description: 'Robot executable mapped data generated from articles.yaml',
            unit: { position: 'cm', orientation: 'deg' },
            mapped_data: {}
        };
    }
}

// Write mapped data YAML
async function writeMappedData(data) {
    const yamlContent = yaml.dump(data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
    });
    await fs.writeFile(MAPPED_DATA_PATH, yamlContent, 'utf8');
}

// GET all mapped data
router.get('/mapped-data', async (req, res) => {
    try {
        const data = await readMappedData();
        res.json(data);
    } catch (error) {
        console.error('Error reading mapped data:', error);
        res.status(500).json({ error: 'Failed to read mapped data' });
    }
});

// POST update mapped data (full replacement or partial)
router.post('/mapped-data', async (req, res) => {
    try {
        const { mapped_data } = req.body;
        
        if (mapped_data === undefined) {
            return res.status(400).json({ error: 'mapped_data is required' });
        }
        
        const currentData = await readMappedData();
        currentData.mapped_data = mapped_data;
        
        await writeMappedData(currentData);
        
        res.json({ success: true, message: 'Mapped data updated' });
    } catch (error) {
        console.error('Error saving mapped data:', error);
        res.status(500).json({ error: 'Failed to save mapped data' });
    }
});

// POST add/update single entry
router.post('/mapped-data/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const entry = req.body;
        
        // Validate required fields
        const requiredFields = ['shoe_foot_type', 'y_cm'];
        for (const field of requiredFields) {
            if (entry[field] === undefined) {
                return res.status(400).json({ error: `Missing required field: ${field}` });
            }
        }
        
        const currentData = await readMappedData();
        currentData.mapped_data[key] = entry;
        
        await writeMappedData(currentData);
        
        res.json({ success: true, key, entry });
    } catch (error) {
        console.error('Error saving entry:', error);
        res.status(500).json({ error: 'Failed to save entry' });
    }
});

// DELETE single entry
router.delete('/mapped-data/:key', async (req, res) => {
    try {
        const { key } = req.params;
        
        const currentData = await readMappedData();
        
        if (!currentData.mapped_data[key]) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        
        delete currentData.mapped_data[key];
        await writeMappedData(currentData);
        
        res.json({ success: true, message: `Deleted ${key}` });
    } catch (error) {
        console.error('Error deleting entry:', error);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

// GET raw YAML content
router.get('/mapped-data/raw', async (req, res) => {
    try {
        const content = await fs.readFile(MAPPED_DATA_PATH, 'utf8');
        res.type('text/yaml').send(content);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read raw YAML' });
    }
});

ensureDirectory();

module.exports = router;