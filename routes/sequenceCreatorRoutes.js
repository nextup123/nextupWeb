// routes/sequenceCreatorRoutes.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const SEQUENCE_FILE = path.join(__dirname, '../config/path_sequence.json');
const UNDO_FILE = path.join(__dirname, '../config/path_sequence_undo.json');
const DEFAULT_VELOCITY = 0.20;
const MIN_VELOCITY = 0.01;
const MAX_VELOCITY = 0.30;

// Ensure config directory exists
async function ensureConfigDir() {
    const configDir = path.join(__dirname, '../config');
    try {
        await fs.access(configDir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(configDir, { recursive: true });
        }
    }
}

// Initialize files if they don't exist
async function initializeFiles() {
    await ensureConfigDir();
    
    const files = [
        { path: SEQUENCE_FILE, defaultContent: { sequences: [] } },
        { path: UNDO_FILE, defaultContent: { history: [] } }
    ];
    
    for (const file of files) {
        try {
            await fs.access(file.path);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(file.path, JSON.stringify(file.defaultContent, null, 2));
            }
        }
    }
}

// Call initialization
initializeFiles().catch(err => {
    console.error('Failed to initialize files:', err.message);
});

// Utility function to read JSON file
async function readJSONFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Handle old format (with "sequence" root) or new format (with "sequences" array)
        if (parsed.sequence && !parsed.sequences) {
            // Convert old format to new format
            const sequenceObj = parsed.sequence;
            if (sequenceObj.steps) {
                sequenceObj.id = sequenceObj.id || `seq_${Date.now()}`;
                sequenceObj.name = sequenceObj.name || `sequence_${new Date().toISOString().slice(0, 10)}`;
                sequenceObj.createdAt = sequenceObj.createdAt || new Date().toISOString();
                sequenceObj.totalSteps = sequenceObj.steps.length;
                
                // Add velocities if missing
                sequenceObj.steps = sequenceObj.steps.map((step, index) => ({
                    ...step,
                    order: step.order || index + 1,
                    velocity: step.velocity || DEFAULT_VELOCITY
                }));
                
                return { sequences: [sequenceObj] };
            }
        }
        
        return parsed;
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return default structure
            console.log(`File ${filePath} doesn't exist, returning default`);
            return { sequences: [] };
        } else if (error instanceof SyntaxError) {
            // JSON parse error, return default
            console.error(`Invalid JSON in ${filePath}:`, error.message);
            return { sequences: [] };
        }
        throw error;
    }
}

// Utility function to write JSON file
async function writeJSONFile(filePath, data) {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        await fs.writeFile(filePath, jsonString);
        return true;
    } catch (error) {
        console.error(`Failed to write file ${filePath}:`, error.message);
        throw error;
    }
}

// Save current state to undo before changes
async function saveToUndo() {
    try {
        const currentData = await readJSONFile(SEQUENCE_FILE);
        const undoData = await readJSONFile(UNDO_FILE);
        
        if (!undoData.history) undoData.history = [];
        
        // Limit undo history to last 10 operations
        if (undoData.history.length >= 10) {
            undoData.history.shift();
        }
        
        undoData.history.push({
            timestamp: new Date().toISOString(),
            previousState: JSON.parse(JSON.stringify(currentData)) // Deep copy
        });
        
        await writeJSONFile(UNDO_FILE, undoData);
    } catch (error) {
        console.error('Failed to save undo state:', error.message);
    }
}

// GET /sequences-creator - Get all sequences
router.get('/', async (req, res) => {
    try {
        const data = await readJSONFile(SEQUENCE_FILE);
        res.json({
            success: true,
            sequences: data.sequences || [],
            total: (data.sequences || []).length
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to read sequences: ${error.message}` 
        });
    }
});

// GET /undo - Get undo history
router.get('/undo', async (req, res) => {
    try {
        const undoData = await readJSONFile(UNDO_FILE);
        res.json({
            success: true,
            undoHistory: undoData.history || [],
            canUndo: (undoData.history || []).length > 0
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to read undo history: ${error.message}` 
        });
    }
});

// POST / - Save new sequence (handles both formats)
router.post('/', async (req, res) => {
    try {
        const { sequence, sequenceName, steps, start, current } = req.body;
        
        // Check if we have the old format (with "sequence" root)
        if (sequence) {
            // Old format from frontend
            const { id, name, createdAt, start: seqStart, current: seqCurrent, steps: seqSteps } = sequence;
            
            // Validate steps
            if (!seqSteps || !Array.isArray(seqSteps)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid sequence format. Must have steps array'
                });
            }
            
            // Process steps with velocities
            const processedSteps = seqSteps.map((step, index) => {
                // Set default velocity if not provided
                let velocity = step.velocity || DEFAULT_VELOCITY;
                
                // Clamp velocity to allowed range
                velocity = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, velocity));
                
                return {
                    order: step.order || index + 1,
                    path: step.path,
                    type: step.type,
                    from: step.from,
                    to: step.to,
                    velocity: parseFloat(velocity.toFixed(2))
                };
            });
            
            // Create sequence object
            const sequenceObj = {
                id: id || `seq_${Date.now()}`,
                name: name || sequenceName || `sequence_${new Date().toISOString().slice(0, 10)}`,
                createdAt: createdAt || new Date().toISOString(),
                start: seqStart || start || 'unknown',
                current: seqCurrent || current || 'unknown',
                totalSteps: processedSteps.length,
                steps: processedSteps
            };
            
            // Save to undo
            await saveToUndo();
            
            // Save this single sequence (overwrites existing file)
            await writeJSONFile(SEQUENCE_FILE, { sequences: [sequenceObj] });
            
            return res.json({
                success: true,
                message: 'Sequence saved successfully',
                sequence: sequenceObj
            });
            
        } else if (steps && Array.isArray(steps)) {
            // New format with direct steps
            // Process steps with velocities
            const processedSteps = steps.map((step, index) => {
                let velocity = step.velocity || DEFAULT_VELOCITY;
                velocity = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, velocity));
                
                return {
                    order: index + 1,
                    path: step.path,
                    type: step.type,
                    from: step.from,
                    to: step.to,
                    velocity: parseFloat(velocity.toFixed(2))
                };
            });
            
            // Create sequence object
            const sequenceObj = {
                id: `seq_${Date.now()}`,
                name: sequenceName || `sequence_${new Date().toISOString().slice(0, 10)}`,
                createdAt: new Date().toISOString(),
                start: start || 'unknown',
                current: current || 'unknown',
                totalSteps: processedSteps.length,
                steps: processedSteps
            };
            
            // Save to undo
            await saveToUndo();
            
            // Save this single sequence (overwrites existing file)
            await writeJSONFile(SEQUENCE_FILE, { sequences: [sequenceObj] });
            
            return res.json({
                success: true,
                message: 'Sequence saved successfully',
                sequence: sequenceObj
            });
            
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid request format. Provide either "sequence" object or "steps" array'
            });
        }
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to save sequence: ${error.message}` 
        });
    }
});

// POST /append - Append to existing sequences (keeps old ones)
router.post('/append', async (req, res) => {
    try {
        const { sequence, sequenceName, steps, start, current } = req.body;
        
        // Read existing sequences
        const existingData = await readJSONFile(SEQUENCE_FILE);
        if (!existingData.sequences) existingData.sequences = [];
        
        let newSequence;
        
        if (sequence) {
            // Old format
            const { id, name, createdAt, start: seqStart, current: seqCurrent, steps: seqSteps } = sequence;
            
            if (!seqSteps || !Array.isArray(seqSteps)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid sequence format'
                });
            }
            
            const processedSteps = seqSteps.map((step, index) => {
                let velocity = step.velocity || DEFAULT_VELOCITY;
                velocity = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, velocity));
                
                return {
                    order: step.order || index + 1,
                    path: step.path,
                    type: step.type,
                    from: step.from,
                    to: step.to,
                    velocity: parseFloat(velocity.toFixed(2))
                };
            });
            
            newSequence = {
                id: id || `seq_${Date.now()}`,
                name: name || sequenceName || `sequence_${new Date().toISOString().slice(0, 10)}`,
                createdAt: createdAt || new Date().toISOString(),
                start: seqStart || start || 'unknown',
                current: seqCurrent || current || 'unknown',
                totalSteps: processedSteps.length,
                steps: processedSteps
            };
            
        } else if (steps && Array.isArray(steps)) {
            const processedSteps = steps.map((step, index) => {
                let velocity = step.velocity || DEFAULT_VELOCITY;
                velocity = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, velocity));
                
                return {
                    order: index + 1,
                    path: step.path,
                    type: step.type,
                    from: step.from,
                    to: step.to,
                    velocity: parseFloat(velocity.toFixed(2))
                };
            });
            
            newSequence = {
                id: `seq_${Date.now()}`,
                name: sequenceName || `sequence_${new Date().toISOString().slice(0, 10)}`,
                createdAt: new Date().toISOString(),
                start: start || 'unknown',
                current: current || 'unknown',
                totalSteps: processedSteps.length,
                steps: processedSteps
            };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid request format'
            });
        }
        
        // Save to undo
        await saveToUndo();
        
        // Append new sequence
        existingData.sequences.push(newSequence);
        
        // Save all sequences
        await writeJSONFile(SEQUENCE_FILE, existingData);
        
        res.json({
            success: true,
            message: 'Sequence appended successfully',
            sequence: newSequence,
            totalSequences: existingData.sequences.length
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to append sequence: ${error.message}` 
        });
    }
});

// GET /latest - Get the most recent sequence
router.get('/latest', async (req, res) => {
    try {
        const data = await readJSONFile(SEQUENCE_FILE);
        
        if (!data.sequences || data.sequences.length === 0) {
            return res.json({
                success: true,
                sequence: null,
                message: 'No sequences found'
            });
        }
        
        // Sort by creation date (newest first) and get the first one
        const sorted = [...data.sequences].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        res.json({
            success: true,
            sequence: sorted[0]
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to get latest sequence: ${error.message}` 
        });
    }
});

// PUT /:id - Update specific sequence
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, steps, velocityUpdates } = req.body;
        
        const data = await readJSONFile(SEQUENCE_FILE);
        const sequenceIndex = data.sequences.findIndex(seq => seq.id === id);
        
        if (sequenceIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Sequence not found'
            });
        }

        // Save to undo
        await saveToUndo();

        // Update sequence
        const sequence = data.sequences[sequenceIndex];
        
        if (name) sequence.name = name;
        
        if (steps && Array.isArray(steps)) {
            sequence.steps = steps.map((step, index) => ({
                order: index + 1,
                path: step.path,
                type: step.type,
                from: step.from,
                to: step.to,
                velocity: Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, 
                    step.velocity || DEFAULT_VELOCITY))
            }));
            sequence.totalSteps = steps.length;
        }

        // Update specific velocities
        if (velocityUpdates && Array.isArray(velocityUpdates)) {
            velocityUpdates.forEach(update => {
                const step = sequence.steps.find(s => s.order === update.order);
                if (step) {
                    step.velocity = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, 
                        update.velocity || DEFAULT_VELOCITY));
                }
            });
        }

        sequence.updatedAt = new Date().toISOString();
        data.sequences[sequenceIndex] = sequence;

        await writeJSONFile(SEQUENCE_FILE, data);

        res.json({
            success: true,
            message: 'Sequence updated successfully',
            sequence
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to update sequence: ${error.message}` 
        });
    }
});

// DELETE /:id - Delete sequence
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await readJSONFile(SEQUENCE_FILE);
        
        const sequenceIndex = data.sequences.findIndex(seq => seq.id === id);
        if (sequenceIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Sequence not found'
            });
        }

        // Save to undo
        await saveToUndo();

        // Remove sequence
        const deletedSequence = data.sequences.splice(sequenceIndex, 1)[0];
        
        await writeJSONFile(SEQUENCE_FILE, data);

        res.json({
            success: true,
            message: 'Sequence deleted successfully',
            deletedSequence,
            remainingSequences: data.sequences.length
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to delete sequence: ${error.message}` 
        });
    }
});

// POST /undo - Undo last operation
router.post('/undo', async (req, res) => {
    try {
        const undoData = await readJSONFile(UNDO_FILE);
        
        if (!undoData.history || undoData.history.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No operations to undo'
            });
        }

        // Get last state from undo history
        const lastState = undoData.history.pop();
        
        // Restore previous state
        await writeJSONFile(SEQUENCE_FILE, lastState.previousState);
        
        // Update undo file
        await writeJSONFile(UNDO_FILE, undoData);

        res.json({
            success: true,
            message: 'Undo successful',
            undoneOperation: lastState,
            remainingUndos: undoData.history.length
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to undo: ${error.message}` 
        });
    }
});

// POST /clear-undo - Clear undo history
router.post('/clear-undo', async (req, res) => {
    try {
        await writeJSONFile(UNDO_FILE, { history: [] });
        res.json({
            success: true,
            message: 'Undo history cleared'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to clear undo history: ${error.message}` 
        });
    }
});

// POST /clear-all - Clear all sequences
router.post('/clear-all', async (req, res) => {
    try {
        // Save to undo
        await saveToUndo();
        
        // Clear all sequences
        await writeJSONFile(SEQUENCE_FILE, { sequences: [] });
        
        res.json({
            success: true,
            message: 'All sequences cleared'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: `Failed to clear sequences: ${error.message}` 
        });
    }
});

module.exports = router;