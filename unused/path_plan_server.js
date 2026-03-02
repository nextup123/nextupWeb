const express = require('express');
const fs = require('fs');
const xml2js = require('xml2js');
const yaml = require('js-yaml');
const path = require('path');

const router = express.Router();


const XML_FILE = '/home/nextup/motion_planning_bt/src/motion_plan_bt/tree.xml';
const XML_BACKUP_FILE = '/home/nextup/motion_planning_bt/src/motion_plan_bt/tree_backup.xml';

const parser = new xml2js.Parser({ explicitArray: false });
const builder = new xml2js.Builder();

function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (err) {
        return false;
    }
}

// Create backup of current XML
async function createBackup() {
    try {
        if (fileExists(XML_FILE)) {
            const data = fs.readFileSync(XML_FILE, 'utf8');
            fs.writeFileSync(XML_BACKUP_FILE, data, 'utf8');
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error creating backup:', err);
        return false;
    }
}

// Swap the main XML file with the backup
async function swapWithBackup() {
    try {
        // Check if backup exists
        if (!fileExists(XML_BACKUP_FILE)) {
            throw new Error('No backup file exists to undo to');
        }

        // Read backup content
        const backupData = fs.readFileSync(XML_BACKUP_FILE, 'utf8');

        // Create a temporary backup of current state
        if (fileExists(XML_FILE)) {
            const currentData = fs.readFileSync(XML_FILE, 'utf8');
            fs.writeFileSync(`${XML_BACKUP_FILE}.tmp`, currentData, 'utf8');
        }

        // Write backup data to main file
        fs.writeFileSync(XML_FILE, backupData, 'utf8');

        // Replace backup with the temporary backup (for redo functionality if needed)
        if (fileExists(`${XML_BACKUP_FILE}.tmp`)) {
            fs.renameSync(`${XML_BACKUP_FILE}.tmp`, XML_BACKUP_FILE);
        } else {
            // If no current file existed, remove the backup after undo
            fs.unlinkSync(XML_BACKUP_FILE);
        }

        return true;
    } catch (err) {
        console.error('Error swapping files:', err);
        throw err;
    }
}



// Modified saveXML function to create backup before saving
async function saveXML(json) {
    try {
        // Create backup before making changes
        await createBackup();

        const xml = builder.buildObject(json);
        fs.writeFileSync(XML_FILE, xml, 'utf8');
    } catch (err) {
        throw new Error(`Failed to save XML: ${err.message}`);
    }
}

async function loadXML() {
    try {
        if (!fileExists(XML_FILE)) {
            // If main file doesn't exist, check if backup exists
            if (fileExists(XML_BACKUP_FILE)) {
                console.log('Main XML file not found, using backup');
                fs.copyFileSync(XML_BACKUP_FILE, XML_FILE);
            } else {
                throw new Error('XML file not found');
            }
        }

        const data = fs.readFileSync(XML_FILE, 'utf8');
        return await new Promise((resolve, reject) => {
            parser.parseString(data, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    } catch (err) {
        throw new Error(`Failed to load XML: ${err.message}`);
    }
}

// UNDO endpoint
router.post('/undo', async (req, res) => {
    try {
        await swapWithBackup();
        const data = await loadXML();

        return res.json({
            message: 'Undo successful',
            xml: builder.buildObject(data)
        });
    } catch (err) {
        console.error('Error in /undo:', err);
        return res.status(500).json({ message: err.message });
    }
});

// Check if undo is available
router.get('/canUndo', async (req, res) => {
    try {
        const canUndo = fileExists(XML_BACKUP_FILE);
        console.log(`/callUndo : ${canUndo}`);

        return res.json({ canUndo });
    } catch (err) {
        console.error('Error in /canUndo:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.get('/getPointNames', (req, res) => {
    try {
        const file = fs.readFileSync('/home/nextup/planning_data/points/points.yaml', 'utf8');
        const parsed = yaml.load(file);
        const points = parsed.points.map(p => p.name);
        res.json(points);
    } catch (err) {
        console.error('Error in /getPointNames:', err);
        res.status(500).json({ message: 'Error reading points YAML' });
    }
});

router.get('/getPathNames', async (req, res) => {
    const filePath = '/home/nextup/planning_data/paths/paths.yaml';
    try {
        console.log(`Attempting to read ${filePath}`);
        await fs.promises.access(filePath, fs.constants.R_OK);
        console.log(`${filePath} is accessible`);
        const file = await fs.promises.readFile(filePath, 'utf8');
        // console.log(`Read ${filePath}, content: ${file.slice(0, 100)}...`);
        const parsed = yaml.load(file);
        // console.log(`Parsed YAML: ${JSON.stringify(parsed, null, 2).slice(0, 100)}...`);
        const paths = parsed.paths ? parsed.paths.map(p => p.name) : [];
        console.log(`Returning path names: ${paths}`);
        res.json(paths);
    } catch (err) {
        console.error(`Error in /getPathNames for ${filePath}:`, err);
        res.status(500).json({ message: `Error reading paths YAML: ${err.message}` });
    }
});

router.get('/getPathsYAML', async (req, res) => {
    const filePath = '/home/nextup/planning_data/paths/paths.yaml';
    try {
        console.log(`Attempting to read ${filePath}`);
        await fs.promises.access(filePath, fs.constants.R_OK);
        console.log(`${filePath} is accessible`);
        const file = await fs.promises.readFile(filePath, 'utf8');
        const parsed = yaml.load(file);
        const paths = parsed.paths || [];
        console.log(`Returning full paths YAML data`);
        res.json({ paths });
    } catch (err) {
        console.error(`Error in /getPathsYAML for ${filePath}:`, err);
        res.status(500).json({ message: `Error reading paths YAML: ${err.message}` });
    }
});
router.get('/getOriginPointFileName', async (req, res) => {
    const filePath = '/home/nextup/planning_data/paths/paths.yaml';
    try {
        console.log(`Attempting to read ${filePath} for origin_point_file_name`);
        await fs.promises.access(filePath, fs.constants.R_OK);
        console.log(`${filePath} is accessible`);
        const file = await fs.promises.readFile(filePath, 'utf8');
        const parsed = yaml.load(file);
        const originPointFileName = parsed.points_file_name || '';
        console.log(`Returning origin_point_file_name: ${originPointFileName}`);
        res.json({ originPointFileName });
    } catch (err) {
        console.error(`Error in /getOriginPointFileName for ${filePath}:`, err);
        res.status(500).json({ message: `Error reading paths YAML: ${err.message}` });
    }
});

router.get('/getPointFileName', async (req, res) => {
    const filePath = '/home/nextup/planning_data/points/points.yaml';
    try {
        console.log(`Attempting to read ${filePath} for point_file_name`);
        await fs.promises.access(filePath, fs.constants.R_OK);
        console.log(`${filePath} is accessible`);
        const file = await fs.promises.readFile(filePath, 'utf8');
        const parsed = yaml.load(file);
        const pointFileName = parsed.points_file_name || '';
        console.log(`Returning point_file_name: ${pointFileName}`);
        res.json({ pointFileName });
    } catch (err) {
        console.error(`Error in /getPointFileName for ${filePath}:`, err);
        res.status(500).json({ message: `Error reading paths YAML: ${err.message}` });
    }
});


function findRootPlanSequence(data) {
    try {
        let mainSeq = data.root.BehaviorTree.Sequence.Start.Fallback.Sequence;

        if (Array.isArray(mainSeq)) {
            mainSeq = mainSeq.find(s => s.$?.name === 'main_seq');
        } else if (mainSeq.$?.name !== 'main_seq') {
            return null;
        }

        if (!mainSeq) return null;

        let rootSeq = mainSeq.Sequence;

        if (Array.isArray(rootSeq)) {
            rootSeq = rootSeq.find(s => s.$?.name === 'root_plan_sequence');
        } else if (rootSeq.$?.name !== 'root_plan_sequence') {
            return null;
        }

        return rootSeq;
    } catch (error) {
        console.error('Error finding root_plan_sequence:', error);
        return null;
    }
}

router.post('/getXML', async (req, res) => {
    try {
        const data = await loadXML();
        return res.json({ xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /getXML:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.get('/getTreeData', async (req, res) => {
    try {
        const data = await loadXML();
        const target = findRootPlanSequence(data);
        if (!target || !target.Sequence) {
            return res.json([]);
        }

        const sequences = Array.isArray(target.Sequence) ? target.Sequence : [target.Sequence];
        const blocks = sequences.map(seq => {
            if (seq.Fallback?.Sequence?.[0]?.PlanPath) {
                const plan = seq.Fallback.Sequence[0].PlanPath.$;
                return {
                    type: 'planPath',
                    name: seq.$.name,
                    startPoint: plan.start_goal,
                    goalPoint: plan.end_goal,
                    planSpace: plan.plan_space,
                    pathName: plan.path_name,
                    intermediateGoal: plan.intermediate_goal || ''
                };
            }
            return null;
        }).filter(Boolean);

        res.json(blocks);
    } catch (err) {
        console.error('Error in /getTreeData:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/addPlanPath', async (req, res) => {
    try {
        const { startPoint, goalPoint, planSpace, pathName, intermediateGoal = '' } = req.body;

        if (!startPoint || !goalPoint || !planSpace || !pathName) {
            return res.status(400).json({ message: 'Missing required fields: startPoint, goalPoint, planSpace, pathName' });
        }

        const data = await loadXML();
        const target = findRootPlanSequence(data);
        if (!target) {
            return res.status(404).json({ message: 'root_plan_sequence not found' });
        }

        if (!target.Sequence) target.Sequence = [];
        if (!Array.isArray(target.Sequence)) target.Sequence = [target.Sequence];

        const fullPathName = `plan_${pathName}`;
        if (target.Sequence.some(seq => seq.$.name === fullPathName)) {
            return res.status(400).json({ message: `Sequence ${fullPathName} already exists` });
        }

        const newSeq = {
            $: { name: fullPathName },
            Fallback: {
                Sequence: [
                    {
                        Sequence: [
                            {
                                MsgLoggerNode: {
                                    $: { msg_log: `[MOTION-PLAN] Initiating ${planSpace}-space path planning: start=${startPoint}, goal=${goalPoint}, path=${pathName}${intermediateGoal ? `, intermediate=${intermediateGoal}` : ''}` }
                                },
                                PopupMsg: {
                                    $: { msg: `Planning Path: ${startPoint} → ${goalPoint}${intermediateGoal ? ` via ${intermediateGoal}` : ''}`, type: 'warn', timeout: '10' }
                                }
                            }
                        ],
                        PlanPath: {
                            $: {
                                start_goal: startPoint,
                                end_goal: goalPoint,
                                plan_space: planSpace,
                                path_name: pathName,
                                ...(intermediateGoal && { intermediate_goal: intermediateGoal })
                            }
                        },
                        MsgLoggerNode: {
                            $: { msg_log: `[MOTION-PLAN] Successfully planned ${planSpace}-space path: start=${startPoint}, goal=${goalPoint}, path=${pathName}${intermediateGoal ? `, intermediate=${intermediateGoal}` : ''}` }
                        },
                        PopupMsg: {
                            $: { msg: `Path Planning Successful: ${startPoint} → ${goalPoint}${intermediateGoal ? ` via ${intermediateGoal}` : ''}`, type: 'success', timeout: '10' }
                        },
                        Sleep: { $: { msec: '300' } }
                    },
                    {
                        Sequence: [
                            {
                                MsgLoggerNode: {
                                    $: { msg_log: `[MOTION-PLAN] Path planning FAILED in ${planSpace} space: start=${startPoint}, goal=${goalPoint}, path=${pathName}${intermediateGoal ? `, intermediate=${intermediateGoal}` : ''}` }
                                },
                                PopupMsg: {
                                    $: { msg: `Path Planning Failed: ${startPoint} → ${goalPoint}${intermediateGoal ? ` via ${intermediateGoal}` : ''}`, type: 'failure', timeout: '0' }
                                }
                            },
                            {
                                MsgLoggerNode: {
                                    $: { msg_log: '[MOTION-PLAN] Shutting down motion planning node due to planning failure.' }
                                }
                            }
                        ],
                        ShutdownNode: {},
                        MsgLoggerNode: {
                            $: { msg_log: '[MOTION-PLAN] Please review the planning parameters/control flow and restart motion planning.' }
                        },
                        PublishDataOnTopic: {
                            $: { type_of_topic: 'std_msgs/msg/String', msg_on_topic: 'stop', topic_name: '/control_process_motion_bt' }
                        },
                        AlwaysFailure: {}
                    }
                ]
            }
        };

        target.Sequence.push(newSeq);
        await saveXML(data);
        return res.json({ message: `Added ${fullPathName}`, xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /addPlanPath:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/updatePlanPath', async (req, res) => {
    try {
        const { oldPathName, newPathName, startPoint, goalPoint, planSpace, intermediateGoal = '' } = req.body;
        if (!oldPathName || !newPathName || !startPoint || !goalPoint || !planSpace) {
            return res.status(400).json({ message: 'Missing required fields: oldPathName, newPathName, startPoint, goalPoint, planSpace' });
        }

        const data = await loadXML();
        const target = findRootPlanSequence(data);
        if (!target) {
            return res.status(404).json({ message: 'root_plan_sequence not found' });
        }

        if (!Array.isArray(target.Sequence)) target.Sequence = [target.Sequence];

        const oldFullPathName = oldPathName.startsWith('plan_') ? oldPathName : `plan_${oldPathName}`;
        const seqIndex = target.Sequence.findIndex(seq => seq.$.name === oldFullPathName);
        if (seqIndex === -1) {
            return res.status(404).json({ message: `Sequence ${oldFullPathName} not found` });
        }

        const newFullPathName = `plan_${newPathName}`;
        if (newFullPathName !== oldFullPathName && target.Sequence.some(seq => seq.$.name === newFullPathName)) {
            return res.status(400).json({ message: `Sequence ${newFullPathName} already exists` });
        }

        target.Sequence[seqIndex] = {
            $: { name: newFullPathName },
            Fallback: {
                Sequence: [
                    {
                        Sequence: [
                            {
                                MsgLoggerNode: {
                                    $: { msg_log: `[MOTION-PLAN] Initiating ${planSpace}-space path planning: start=${startPoint}, goal=${goalPoint}, path=${newPathName}${intermediateGoal ? `, intermediate=${intermediateGoal}` : ''}` }
                                },
                                PopupMsg: {
                                    $: { msg: `Planning Path: ${startPoint} → ${goalPoint}${intermediateGoal ? ` via ${intermediateGoal}` : ''}`, type: 'warn', timeout: '10' }
                                }
                            }
                        ],
                        PlanPath: {
                            $: {
                                start_goal: startPoint,
                                end_goal: goalPoint,
                                plan_space: planSpace,
                                path_name: newPathName,
                                ...(intermediateGoal && { intermediate_goal: intermediateGoal })
                            }
                        },
                        MsgLoggerNode: {
                            $: { msg_log: `[MOTION-PLAN] Successfully planned ${planSpace}-space path: start=${startPoint}, goal=${goalPoint}, path=${newPathName}${intermediateGoal ? `, intermediate=${intermediateGoal}` : ''}` }
                        },
                        PopupMsg: {
                            $: { msg: `Path Planning Successful: ${startPoint} → ${goalPoint}${intermediateGoal ? ` via ${intermediateGoal}` : ''}`, type: 'success', timeout: '10' }
                        },
                        Sleep: { $: { msec: '300' } }
                    },
                    {
                        Sequence: [
                            {
                                MsgLoggerNode: {
                                    $: { msg_log: `[MOTION-PLAN] Path planning FAILED in ${planSpace} space: start=${startPoint}, goal=${goalPoint}, path=${newPathName}${intermediateGoal ? `, intermediate=${intermediateGoal}` : ''}` }
                                },
                                PopupMsg: {
                                    $: { msg: `Path Planning Failed: ${startPoint} → ${goalPoint}${intermediateGoal ? ` via ${intermediateGoal}` : ''}`, type: 'failure', timeout: '0' }
                                }
                            },
                            {
                                MsgLoggerNode: {
                                    $: { msg_log: '[MOTION-PLAN] Shutting down motion planning node due to planning failure.' }
                                }
                            }
                        ],
                        ShutdownNode: {},
                        MsgLoggerNode: {
                            $: { msg_log: '[MOTION-PLAN] Please review the planning parameters/control flow and restart motion planning.' }
                        },
                        PublishDataOnTopic: {
                            $: { type_of_topic: 'std_msgs/msg/String', msg_on_topic: 'stop', topic_name: '/control_process_motion_bt' }
                        },
                        AlwaysFailure: {}
                    }
                ]
            }
        };

        await saveXML(data);
        return res.json({ message: `Updated ${oldFullPathName} to ${newFullPathName}`, xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /updatePlanPath:', err);
        return res.status(500).json({ message: err.message });
    }
});


router.post('/deletePath', async (req, res) => {
    try {
        const { pathName } = req.body;
        if (!pathName) {
            return res.status(400).json({ message: 'Missing pathName' });
        }

        const data = await loadXML();
        const target = findRootPlanSequence(data);
        if (!target) {
            return res.status(404).json({ message: 'root_plan_sequence not found' });
        }

        if (!Array.isArray(target.Sequence)) target.Sequence = [target.Sequence];

        const fullPathName = pathName.startsWith('plan_') ? pathName : `plan_${pathName}`;
        const initialLength = target.Sequence.length;
        target.Sequence = target.Sequence.filter(seq => seq.$.name !== fullPathName);

        if (target.Sequence.length === initialLength) {
            return res.status(404).json({ message: `Sequence ${fullPathName} not found` });
        }

        if (target.Sequence.length === 0) delete target.Sequence;

        saveXML(data);
        return res.json({ message: `Deleted sequence: ${fullPathName}`, xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /deletePath:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/deleteLast', async (req, res) => {
    try {
        const data = await loadXML();
        const target = findRootPlanSequence(data);
        if (!target) {
            return res.status(404).json({ message: 'root_plan_sequence not found' });
        }

        if (!Array.isArray(target.Sequence)) target.Sequence = [target.Sequence];

        if (!target.Sequence || target.Sequence.length === 0) {
            return res.status(400).json({ message: 'No sequences to delete' });
        }

        target.Sequence.pop();

        if (target.Sequence.length === 0) delete target.Sequence;

        saveXML(data);
        return res.json({ message: 'Deleted last sequence', xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /deleteLast:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/deleteAll', async (req, res) => {
    try {
        const data = await loadXML();
        const target = findRootPlanSequence(data);
        if (!target) {
            return res.status(404).json({ message: 'root_plan_sequence not found' });
        }

        // Check if Sequence exists and is not empty
        if (!target.Sequence || target.Sequence.length === 0) {
            return res.status(400).json({ message: 'No sequences to delete' });
        }

        delete target.Sequence;

        saveXML(data);
        return res.json({ message: 'Deleted all sequences', xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /deleteAll:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/reorderSequences', async (req, res) => {
    try {
        const { sequenceNames } = req.body;
        if (!Array.isArray(sequenceNames) || sequenceNames.length === 0) {
            return res.status(400).json({ message: 'sequenceNames must be a non-empty array' });
        }

        const data = await loadXML();
        const target = findRootPlanSequence(data);
        if (!target) {
            return res.status(404).json({ message: 'root_plan_sequence not found' });
        }

        if (!Array.isArray(target.Sequence)) target.Sequence = [target.Sequence];

        const sequenceMap = new Map();
        target.Sequence.forEach(seq => {
            if (seq.$?.name) sequenceMap.set(seq.$.name, seq);
        });

        const invalidNames = sequenceNames.filter(name => !sequenceMap.has(name));
        if (invalidNames.length > 0) {
            return res.status(404).json({ message: `Sequences not found: ${invalidNames.join(', ')}` });
        }

        target.Sequence = sequenceNames.map(name => sequenceMap.get(name));

        saveXML(data);
        return res.json({ message: 'Sequences reordered successfully', xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /reorderSequences:', err);
        return res.status(500).json({ message: err.message });
    }
});


async function initXMLBackup() {
    console.log('checking initial backup file : tree_backup.xml');
    
    if (fileExists(XML_FILE) && !fileExists(XML_BACKUP_FILE)) {
        try {
            fs.writeFileSync(XML_BACKUP_FILE, fs.readFileSync(XML_FILE, "utf8"));
            console.log("Initial xml plan bt backup created");
        } catch (err) {
            console.error("Failed to create initial xml plan bt backup:", err);
        }
    }
}

module.exports = { router, initXMLBackup };

// router.listen(3005, async () => {
//     console.log('Server running on http://localhost:3005');

//     // Initialize backup if it doesn't exist but main file does
//     if (fileExists(XML_FILE) && !fileExists(XML_BACKUP_FILE)) {
//         try {
//             await createBackup();
//             console.log('Initial backup created');
//         } catch (err) {
//             console.error('Failed to create initial backup:', err);
//         }
//     }
// });