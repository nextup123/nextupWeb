const express = require('express');
const fs = require('fs').promises;
const xml2js = require('xml2js');
const path = require('path');

const router = express.Router();
const XML_FILE = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/do_di_tree.xml';
const XML_BACKUP_FILE = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/backup/do_di_tree_backup.xml';
const parser = new xml2js.Parser({ explicitArray: false });
const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'UTF-8', standalone: 'yes' } });

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function createBackup() {
    try {
        if (await fileExists(XML_FILE)) {
            const data = await fs.readFile(XML_FILE, 'utf8');
            await fs.writeFile(XML_BACKUP_FILE, data, 'utf8');
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error creating backup:', err);
        return false;
    }
}

async function swapWithBackup() {
    try {
        if (!await fileExists(XML_BACKUP_FILE)) {
            throw new Error('No backup file exists to undo to');
        }
        const backupData = await fs.readFile(XML_BACKUP_FILE, 'utf8');
        if (await fileExists(XML_FILE)) {
            const currentData = await fs.readFile(XML_FILE, 'utf8');
            await fs.writeFile(`${XML_BACKUP_FILE}.tmp`, currentData, 'utf8');
        }
        await fs.writeFile(XML_FILE, backupData, 'utf8');
        if (await fileExists(`${XML_BACKUP_FILE}.tmp`)) {
            await fs.rename(`${XML_BACKUP_FILE}.tmp`, XML_BACKUP_FILE);
        } else {
            await fs.unlink(XML_BACKUP_FILE);
        }
        return true;
    } catch (err) {
        console.error('Error swapping files:', err);
        throw err;
    }
}

async function saveXML(json) {
    try {
        await createBackup();
        const xml = builder.buildObject(json);
        await fs.writeFile(XML_FILE, xml, 'utf8');
    } catch (err) {
        throw new Error(`Failed to save XML: ${err.message}`);
    }
}

async function loadXML() {
    try {
        if (!await fileExists(XML_FILE)) {
            if (await fileExists(XML_BACKUP_FILE)) {
                console.log('Main XML file not found, using backup');
                await fs.copyFile(XML_BACKUP_FILE, XML_FILE);
            } else {
                throw new Error('XML file not found');
            }
        }
        const data = await fs.readFile(XML_FILE, 'utf8');
        return await parser.parseStringPromise(data);
    } catch (err) {
        throw new Error(`Failed to load XML: ${err.message}`);
    }
}

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

router.get('/canUndo', async (req, res) => {
    try {
        const canUndo = await fileExists(XML_BACKUP_FILE);
        console.log(`/canUndo: ${canUndo}`);
        return res.json({ canUndo });
    } catch (err) {
        console.error('Error in /canUndo:', err);
        return res.status(500).json({ message: err.message });
    }
});

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

        if (!data.root.BehaviorTree || Object.keys(data.root.BehaviorTree).length === 0) {
            return res.json([]);
        }

        const trees = Array.isArray(data.root.BehaviorTree)
            ? data.root.BehaviorTree
            : [data.root.BehaviorTree];

        const sequences = trees.map(tree => {

            /* ===================== DO (unchanged) ===================== */
            if (tree.Sequence && tree.Sequence.DoControl) {
                const control = tree.Sequence.DoControl.$;

                return {
                    type: 'DO',
                    name: tree.$.ID,
                    driverId: control.driver_id,
                    doId: control.do_id,
                    controlType: control.type_of_control,
                    pushWait: control.push_wait,
                    responseMsg:
                        tree.Sequence.Sequence?.MsgLoggerNode?.$?.msg_log || ''
                };
            }

            /* ===================== DI (OLD STYLE) ===================== */
            if (tree.Sequence && tree.Sequence.DIControl) {
                const control = tree.Sequence.DIControl.$;

                return {
                    type: 'DI',
                    name: tree.$.ID,
                    driverId: control.driver_id,
                    diId: control.di_id,
                    waitTime: control.wait_time || null,
                    responseMsg:
                        tree.Sequence.Sequence?.MsgLoggerNode?.$?.msg_log || '',
                    with_fallback: false
                };
            }

            /* ===================== DI (FALLBACK STYLE) ===================== */
            if (tree.Fallback && tree.Fallback.Sequence) {
                const sequences = Array.isArray(tree.Fallback.Sequence)
                    ? tree.Fallback.Sequence
                    : [tree.Fallback.Sequence];

                // Success path = sequence that contains DIControl
                const successSeq = sequences.find(seq => seq.DIControl);

                if (!successSeq) return null;

                const control = successSeq.DIControl.$;

                return {
                    type: 'DI',
                    name: tree.$.ID,
                    driverId: control.driver_id,
                    diId: control.di_id,
                    waitTime: control.wait_time || null,
                    responseMsg:
                        successSeq.Sequence?.MsgLoggerNode?.$?.msg_log || '',
                    with_fallback: true
                };
            }

            return null;
        }).filter(Boolean);

        res.json(sequences);

    } catch (err) {
        console.error('Error in /getTreeData:', err);
        res.status(500).json({ message: err.message });
    }
});



router.get('/getControl/:name', async (req, res) => {
    try {
        const data = await loadXML();

        const trees = Array.isArray(data.root.BehaviorTree)
            ? data.root.BehaviorTree
            : (data.root.BehaviorTree ? [data.root.BehaviorTree] : []);

        const control = trees.find(tree => tree.$.ID === req.params.name);
        if (!control) {
            return res.status(404).json({ message: `Control ${req.params.name} not found` });
        }

        /* ===================== DO ===================== */
        if (control.Sequence && control.Sequence.DoControl) {
            const ctrl = control.Sequence.DoControl.$;

            return res.json({
                type: 'DO',
                name: control.$.ID,
                driverId: ctrl.driver_id,
                doId: ctrl.do_id,
                controlType: ctrl.type_of_control,
                pushWait: ctrl.push_wait,
                responseMsg:
                    control.Sequence.Sequence?.MsgLoggerNode?.$?.msg_log || ''
            });
        }

        /* ===================== DI (OLD STYLE) ===================== */
        if (control.Sequence && control.Sequence.DIControl) {
            const ctrl = control.Sequence.DIControl.$;

            return res.json({
                type: 'DI',
                name: control.$.ID,
                driverId: ctrl.driver_id,
                diId: ctrl.di_id,
                waitTime: ctrl.wait_time || null,
                responseMsg:
                    control.Sequence.Sequence?.MsgLoggerNode?.$?.msg_log || '',
                with_fallback: false
            });
        }

        /* ===================== DI (FALLBACK STYLE) ===================== */
        if (control.Fallback && control.Fallback.Sequence) {
            const sequences = Array.isArray(control.Fallback.Sequence)
                ? control.Fallback.Sequence
                : [control.Fallback.Sequence];

            // Success path = the sequence containing DIControl
            const successSeq = sequences.find(seq => seq.DIControl);

            if (!successSeq) {
                return res.status(404).json({
                    message: `Control ${req.params.name} has no valid DI success sequence`
                });
            }

            const ctrl = successSeq.DIControl.$;

            return res.json({
                type: 'DI',
                name: control.$.ID,
                driverId: ctrl.driver_id,
                diId: ctrl.di_id,
                waitTime: ctrl.wait_time || null,
                responseMsg:
                    successSeq.Sequence?.MsgLoggerNode?.$?.msg_log || '',
                with_fallback: true
            });
        }

        return res.status(404).json({ message: `Control ${req.params.name} not found` });

    } catch (err) {
        console.error('Error in /getControl:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/addControl', async (req, res) => {
    try {
        const {
            type,
            name,
            driverId,
            doId,
            diId,
            controlType,
            pushWait,
            waitTime,
            responseMsg,
            with_fallback
        } = req.body;

        // ---------------- VALIDATION ----------------
        if (
            !type ||
            !name ||
            !driverId ||
            !responseMsg ||
            !/^[A-Za-z0-9]+(\[(DO|DI)\])?$/.test(name)
        ) {
            return res.status(400).json({ message: '1 Missing or invalid required fields' });
        }

        if (type === 'DO' && (!doId || !controlType)) {
            return res.status(400).json({ message: '2 Missing DO required fields' });
        }

        if (type === 'DI' && !diId) {
            return res.status(400).json({ message: '3 Missing DI required fields' });
        }

        // ---------------- LOAD XML ----------------
        const data = await loadXML();

        let trees = Array.isArray(data.root.BehaviorTree)
            ? data.root.BehaviorTree
            : (data.root.BehaviorTree ? [data.root.BehaviorTree] : []);

        if (trees.some(tree => tree.$.ID === name)) {
            return res.status(400).json({ message: `Control ${name} already exists` });
        }

        // ---------------- DO TREE ----------------
        const doTree = {
            $: { ID: name },
            Sequence: {
                $: { ID: 'seq_1' },
                MsgLoggerNode: {
                    $: { ID: 'msg_1', msg_log: `${name} subtree starting...` }
                },
                DoControl: {
                    $: {
                        ID: 'ctrl_1',
                        name,
                        driver_id: driverId,
                        do_id: doId,
                        control_name: name,
                        type_of_control: controlType,
                        expected_action: '{expected_action}',
                        ...(pushWait !== undefined && { push_wait: pushWait })
                    }
                },
                Sequence: {
                    $: { ID: `seq_2` },
                    MsgLoggerNode: { $: { ID: `msg_2`, msg_log: responseMsg } }
                },
                PopupMsg: {
                    $: {
                        ID: 'pop_1',
                        msg: `${name} action successful`,
                        type: 'success',
                        timeout: '3'
                    }
                }
            }
        };

        // ---------------- DI SUCCESS SEQUENCE ----------------
        const diSuccessSequence = {
            $: { ID: 'success_seq' },
            MsgLoggerNode: {
                $: { ID: 'msg_1', msg_log: `${name} subtree starting...` }
            },
            DIControl: {
                $: {
                    ID: 'ctrl_1',
                    name,
                    driver_id: driverId,
                    di_id: diId,
                    status_name: name,
                    expected_status: '{expected_status}',
                    ...(waitTime && { wait_time: waitTime })
                }
            },
            Sequence: {
                $: { ID: `seq_2` },
                MsgLoggerNode: { $: { ID: `msg_2`, msg_log: responseMsg } }
            }
            // ,
            // PopupMsg: {
            //     $: {
            //         ID: 'pop_1',
            //         msg: `${name} sensing successful`,
            //         type: 'success',
            //         timeout: '3'
            //     }
            // }
        };

        // ---------------- DI TREE (NO FALLBACK) ----------------
        const diTreeNormal = {
            $: { ID: name },
            Sequence: diSuccessSequence
        };

        // ---------------- DI TREE (WITH FALLBACK) ----------------
        const diTreeWithFallback = {
            $: { ID: name },
            Fallback: {
                Sequence: [
                    diSuccessSequence,
                    {
                        $: { ID: 'failure_seq' },
                        PopupMsg: {
                            $: {
                                ID: 'pop_fail',
                                msg: `${name} sensing failed`,
                                type: 'failure',
                                timeout: '0'
                            }
                        },
                        MsgLoggerNode: {
                            $: {
                                ID: 'msg_fail',
                                msg_log: `${name} sensing failed`
                            }
                        },
                        AlwaysFailure: {}
                    }
                ]
            }
        };

        // ---------------- FINAL TREE SELECTION ----------------
        let newTree;
        if (type === 'DO') {
            newTree = doTree;
        } else {
            newTree = with_fallback ? diTreeWithFallback : diTreeNormal;
        }

        // ---------------- SAVE ----------------
        trees.push(newTree);
        data.root.BehaviorTree = trees;

        await saveXML(data);

        return res.json({
            message: `Added ${name} (${type}${type === 'DI' && with_fallback ? ' with fallback' : ''})`,
            xml: builder.buildObject(data)
        });

    } catch (err) {
        console.error('Error in /addControl:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/updateControl', async (req, res) => {
    try {
        const {
            oldName,
            type,
            name,
            driverId,
            doId,
            diId,
            controlType,
            pushWait,
            waitTime,
            responseMsg,
            with_fallback
        } = req.body;

        // ---------------- VALIDATION ----------------
        if (
            !oldName ||
            !type ||
            !name ||
            !driverId ||
            !responseMsg ||
            !/^[A-Za-z0-9]+(\[(DO|DI)\])?$/.test(name)
        ) {
            return res.status(400).json({ message: 'Missing or invalid required fields' });
        }

        if (type === 'DO' && (!doId || !controlType)) {
            return res.status(400).json({ message: 'Missing DO required fields' });
        }

        if (type === 'DI' && !diId) {
            return res.status(400).json({ message: 'Missing DI required fields' });
        }

        // ---------------- LOAD XML ----------------
        const data = await loadXML();
        let trees = Array.isArray(data.root.BehaviorTree)
            ? data.root.BehaviorTree
            : (data.root.BehaviorTree ? [data.root.BehaviorTree] : []);

        const index = trees.findIndex(tree => tree.$.ID === oldName);
        if (index === -1) {
            return res.status(404).json({ message: `Control ${oldName} not found` });
        }

        if (name !== oldName && trees.some(tree => tree.$.ID === name)) {
            return res.status(400).json({ message: `Control ${name} already exists` });
        }

        // ---------------- DO TREE ----------------
        const doTree = {
            $: { ID: name },
            Sequence: {
                $: { ID: 'seq_1' },
                MsgLoggerNode: {
                    $: { ID: 'msg_1', msg_log: `${name} subtree starting...` }
                },
                DoControl: {
                    $: {
                        ID: 'ctrl_1',
                        name: name,
                        driver_id: driverId,
                        do_id: doId,
                        control_name: name,
                        type_of_control: controlType,
                        expected_action: '{expected_action}',
                        ...(pushWait !== undefined && { push_wait: pushWait })
                    }
                },
                Sequence: {
                    $: { ID: `seq_2` },
                    MsgLoggerNode: { $: { ID: `msg_2`, msg_log: responseMsg } }
                }
                // ,
                // PopupMsg: {
                //     $: {
                //         ID: 'pop_1',
                //         msg: `${name} action successful`,
                //         type: 'success',
                //         timeout: '3'
                //     }
                // }
            }
        };

        // ---------------- DI SUCCESS SEQUENCE ----------------
        const diSuccessSequence = {
            $: { ID: 'success_seq' },
            MsgLoggerNode: {
                $: { ID: 'msg_1', msg_log: `${name} subtree starting...` }
            },
            DIControl: {
                $: {
                    ID: 'ctrl_1',
                    name: name,
                    driver_id: driverId,
                    di_id: diId,
                    status_name: name,
                    expected_status: '{expected_status}',
                    ...(waitTime && { wait_time: waitTime })
                }
            },
            Sequence: {
                $: { ID: `seq_2` },
                MsgLoggerNode: { $: { ID: `msg_2`, msg_log: responseMsg } }
            }
            // ,
            // PopupMsg: {
            //     $: {
            //         ID: 'pop_1',
            //         msg: `${name} sensing successful`,
            //         type: 'success',
            //         timeout: '3'
            //     }
            // }
        };

        // ---------------- DI TREE (NO FALLBACK) ----------------
        const diTreeNormal = {
            $: { ID: name },
            Sequence: diSuccessSequence
        };

        // ---------------- DI TREE (WITH FALLBACK) ----------------
        const diTreeWithFallback = {
            $: { ID: name },
            Fallback: {
                Sequence: [
                    diSuccessSequence,
                    {
                        $: { ID: 'failure_seq' },
                        PopupMsg: {
                            $: {
                                ID: 'pop_fail',
                                msg: `${name} sensing failed`,
                                type: 'failure',
                                timeout: '0'
                            }
                        },
                        MsgLoggerNode: {
                            $: {
                                ID: 'msg_fail',
                                msg_log: `${name} sensing failed`
                            }
                        },
                        AlwaysFailure: {}
                    }
                ]
            }
        };

        // ---------------- FINAL TREE SELECTION ----------------
        let newTree;
        if (type === 'DO') {
            newTree = doTree;
        } else {
            newTree = with_fallback ? diTreeWithFallback : diTreeNormal;
        }

        // ---------------- SAVE ----------------
        trees[index] = newTree;
        data.root.BehaviorTree = trees;

        await saveXML(data);

        return res.json({
            message: `Updated ${oldName} → ${name} (${type}${type === 'DI' && with_fallback ? ' with fallback' : ''})`,
            xml: builder.buildObject(data)
        });

    } catch (err) {
        console.error('Error in /updateControl:', err);
        return res.status(500).json({ message: err.message });
    }
});


router.post('/deleteControl', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Missing name' });
        }
        const data = await loadXML();
        let trees = Array.isArray(data.root.BehaviorTree) ? data.root.BehaviorTree : [data.root.BehaviorTree];
        const initialLength = trees.length;
        trees = trees.filter(tree => tree.$.ID !== name);
        if (trees.length === initialLength) {
            return res.status(404).json({ message: `Control ${name} not found` });
        }
        data.root.BehaviorTree = trees.length > 0 ? trees : undefined;
        await saveXML(data);
        return res.json({ message: `Deleted ${name}`, xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /deleteControl:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/deleteAll', async (req, res) => {
    try {
        const data = await loadXML();
        if (!data.root.BehaviorTree) {
            return res.status(400).json({ message: 'No sequences to delete' });
        }
        data.root.BehaviorTree = undefined;
        await saveXML(data);
        return res.json({ message: 'Deleted all sequences', xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /deleteAll:', err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/reorderSequences', async (req, res) => {
    try {
        const { sequenceNames } = req.body;
        const sortOrder = req.query.sortOrder;
        const data = await loadXML();
        let trees = Array.isArray(data.root.BehaviorTree) ? data.root.BehaviorTree : [data.root.BehaviorTree];
        if (sortOrder === 'diFirst' || sortOrder === 'doFirst') {
            trees = trees.sort((a, b) => {
                const aIsDI = a.Sequence.DIControl ? true : false;
                const bIsDI = b.Sequence.DIControl ? true : false;
                if (sortOrder === 'diFirst') {
                    return aIsDI && !bIsDI ? -1 : !aIsDI && bIsDI ? 1 : 0;
                } else {
                    return !aIsDI && bIsDI ? -1 : aIsDI && !bIsDI ? 1 : 0;
                }
            });
        } else if (Array.isArray(sequenceNames) && sequenceNames.length > 0) {
            const sequenceMap = new Map();
            trees.forEach(tree => {
                if (tree.$?.ID) sequenceMap.set(tree.$.ID, tree);
            });
            const invalidNames = sequenceNames.filter(name => !sequenceMap.has(name));
            if (invalidNames.length > 0) {
                return res.status(404).json({ message: `Controls not found: ${invalidNames.join(', ')}` });
            }
            trees = sequenceNames.map(name => sequenceMap.get(name));
        } else {
            return res.status(400).json({ message: 'Invalid or missing sortOrder or sequenceNames' });
        }
        data.root.BehaviorTree = trees;
        await saveXML(data);
        return res.json({ message: 'Sequences reordered successfully', xml: builder.buildObject(data) });
    } catch (err) {
        console.error('Error in /reorderSequences:', err);
        return res.status(500).json({ message: err.message });
    }
});

async function initIOXMLBackup() {
    console.log('Checking initial backup file: do_di_tree_backup.xml');
    if (await fileExists(XML_FILE) && !await fileExists(XML_BACKUP_FILE)) {
        try {
            await fs.writeFile(XML_BACKUP_FILE, await fs.readFile(XML_FILE, 'utf8'));
            console.log('Initial XML control tree backup created');
        } catch (err) {
            console.error('Failed to create initial XML control tree backup:', err);
        }
    }
}

module.exports = { router, initIOXMLBackup };