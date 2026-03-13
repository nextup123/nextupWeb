import fs from "fs/promises";
import path from "path";
import { fileExists, formatPointData, loadYAML, saveYAML, swapWithBackup, validatePoint } from "../service/pointPlanningBtService.js";
import { BACKUP_DIR, pointPlanningFilePath } from "../config/path.js";

const YAML_BACKUP_FILE = pointPlanningFilePath.POINTS_BACKUP_YAML_FILE;

export const getPointFileNameController = async (req, res) => {
    try {
        const data = await loadYAML();
        res.json({ points_file_name: data.points_file_name || '' });
    } catch (err) {
        console.error('Error in /getPointFileName:', err);
        res.status(500).json({ message: err.message });
    }
}

export const getPointsController =  async (req, res) => {
    try {
        const data = await loadYAML();
        res.json(data.points || []);
    } catch (err) {
        console.error('Error in /getPoints:', err);
        res.status(500).json({ message: err.message });
    }
}

export const getPointBackupFileNamesController = async (req, res) => {
    try {
        // Check if directory exists
        await fs.access(BACKUP_DIR);
        // Read directory and filter .yaml files
        const files = await fs.readdir(BACKUP_DIR);
        const yamlFiles = files
            .filter(file => file.endsWith('.yaml'))
            .map(file => path.basename(file, '.yaml')); // Remove .yaml extension
        res.json({ backupFiles: yamlFiles });
    } catch (err) {
        console.error('Error in /getPointsBackupFileNames:', err);
        res.status(500).json({ message: `Failed to read backup directory: ${err.message}` });
    }
}

export const addPointController = async (req, res) => {
    try {
        const point = { ...req.body, sequence: Number(req.body.sequence) };
        const validationError = validatePoint(point);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const data = await loadYAML();
        if (!data.points) data.points = [];
        if (data.points.some(p => p.name === point.name)) {
            return res.status(400).json({ message: `Point ${point.name} already exists` });
        }

        data.points.push(point);
        await saveYAML(data);
        res.json({ message: `Added point ${point.name}`, points: data.points });
    } catch (err) {
        console.error('Error in /addPoint:', err);
        res.status(500).json({ message: err.message });
    }
}

export const updatePointController =  async (req, res) => {
    try {
        const { oldName, ...point } = req.body;
        point.sequence = Number(point.sequence);
        if (!oldName || !point.name) {
            return res.status(400).json({ message: 'Missing oldName or name' }); 
        }

        const validationError = validatePoint(point, true);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const data = await loadYAML();
        const index = data.points.findIndex(p => p.name === oldName);
        if (index === -1) {
            return res.status(404).json({ message: `Point ${oldName} not found` });
        }

        if (point.name !== oldName && data.points.some(p => p.name === point.name)) {
            return res.status(400).json({ message: `Point ${point.name} already exists` });
        }

        // Create history entry
        const oldPoint = data.points[index];
        const { jointsStr: oldJointsStr, coordsStr: oldCoordsStr } = formatPointData(oldPoint.joints_values, oldPoint.coordinate);
        const { jointsStr: newJointsStr, coordsStr: newCoordsStr } = formatPointData(point.joints_values, point.coordinate);
        const historyEntry = `on ${point.date_time} previous ${oldJointsStr} ${oldCoordsStr} updated ${newJointsStr} ${newCoordsStr}`;

        // Initialize or update history
        point.history = oldPoint.history || { Serial: historyEntry };
        point.history.Serial = historyEntry;
        const historyKeys = Object.keys(point.history).filter(k => k !== 'Serial' && !isNaN(k)).map(Number);
        const nextKey = historyKeys.length > 0 ? Math.max(...historyKeys) + 1 : 1;
        point.history[nextKey] = historyEntry;

        data.points[index] = point;
        await saveYAML(data);
        res.json({ message: `Updated point ${oldName} to ${point.name}`, points: data.points });
    } catch (err) {
        console.error('Error in /updatePoint:', err);
        res.status(500).json({ message: err.message });
    }
}

export const deletePointController =  async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Missing name' });
        }

        const data = await loadYAML();
        const initialLength = data.points.length;
        data.points = data.points.filter(p => p.name !== name);

        if (data.points.length === initialLength) {
            return res.status(404).json({ message: `Point ${name} not found` });
        }

        if (data.points.length === 0) delete data.points;
        await saveYAML(data);
        res.json({ message: `Deleted point ${name}`, points: data.points || [] });
    } catch (err) {
        console.error('Error in /deletePoint:', err);
        res.status(500).json({ message: err.message });
    }
}

export const deleteAllController = async (req, res) => {
    try {
        const data = await loadYAML();
        if (!data.points || data.points.length === 0) {
            return res.status(400).json({ message: 'No points to delete' });
        }

        delete data.points;
        await saveYAML(data);
        res.json({ message: 'Deleted all points', points: [] });
    } catch (err) {
        console.error('Error in /deleteAll:', err);
        res.status(500).json({ message: err.message });
    }
}

export const reorderPointsController = async (req, res) => {
    try {
        const { pointNames } = req.body;
        if (!Array.isArray(pointNames) || pointNames.length === 0) {
            return res.status(400).json({ message: 'pointNames must be a non-empty array' });
        }

        const data = await loadYAML();
        if (!data.points) {
            return res.status(400).json({ message: 'No points to reorder' });
        }

        const pointMap = new Map();
        data.points.forEach(p => pointMap.set(p.name, p));
        const invalidNames = pointNames.filter(name => !pointMap.has(name));
        if (invalidNames.length > 0) {
            return res.status(404).json({ message: `Points not found: ${invalidNames.join(', ')}` });
        }

        data.points = pointNames.map(name => pointMap.get(name));
        await saveYAML(data);
        res.json({ message: 'Points reordered successfully', points: data.points });
    } catch (err) {
        console.error('Error in /reorderPoints:', err);
        res.status(500).json({ message: err.message });
    }
}

export const undoController = async (req, res) => {
    try {
        await swapWithBackup();
        const data = await loadYAML();
        res.json({ message: 'Undo successful', points: data.points || [] });
    } catch (err) {
        console.error('Error in /undo:', err);
        res.status(500).json({ message: err.message });
    }
}

export const canUndoController =  async (req, res) => {
    try {
        const canUndo = await fileExists(YAML_BACKUP_FILE);
        res.json({ canUndo });
    } catch (err) {
        console.error('Error in /canUndo:', err);
        res.status(500).json({ message: err.message });
    }
}