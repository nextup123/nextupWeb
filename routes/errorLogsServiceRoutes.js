const express = require('express');
const fs = require('fs');
const readline = require('readline');

const router = express.Router();
const { spawn } = require('child_process');

const ERROR_LOGS_PATH =
    '/home/nextup/user_config_files/error_container/error_logs.yaml';

const DEFAULT_LIMIT = 500;
const HARD_LIMIT = 2000;

/**
 * GET /error-logs
 * GET /error-logs?limit=500
 */
router.get('/', async (req, res) => {
    const limit = Math.min(
        parseInt(req.query.limit) || DEFAULT_LIMIT,
        HARD_LIMIT
    );

    try {
        const logs = await readLastErrorLogs(limit);
        res.json({
            count: logs.length,
            logs
        });
    } catch (err) {
        console.error('Error reading error logs:', err);
        res.status(500).json({ error: 'Failed to read error logs' });
    }
});

/**
 * Stream & extract last N error entries
 */
async function readLastErrorLogs(limit) {
    const stream = fs.createReadStream(ERROR_LOGS_PATH, { encoding: 'utf8' });

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    const buffer = [];
    let current = null;
    let insideList = false;

    for await (const line of rl) {
        const trimmed = line.trim();

        // Detect start of error_logs list
        if (trimmed === 'error_logs:') {
            insideList = true;
            continue;
        }

        if (!insideList) continue;

        // New entry
        if (trimmed.startsWith('- time:')) {
            if (current) {
                buffer.push(current);
                if (buffer.length > limit) buffer.shift();
            }

            current = {
                time: trimmed.replace('- time:', '').trim()
            };
        }
        else if (current && trimmed.startsWith('joint:')) {
            current.joint = trimmed.replace('joint:', '').trim();
        }
        else if (current && trimmed.startsWith('last_error:')) {
            current.last_error = Number(
                trimmed.replace('last_error:', '').trim()
            );
        }
    }

    // Push final entry
    if (current) {
        buffer.push(current);
        if (buffer.length > limit) buffer.shift();
    }

    return buffer;

}



const DESCRIPTION_PATH =
    '/home/nextup/user_config_files/error_container/description_error.txt';

// ---------------- GET description ----------------
router.get('/description', (req, res) => {
    fs.readFile(DESCRIPTION_PATH, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Failed to read description');
        }
        res.type('text/plain').send(data);
    });
});

// ---------------- SAVE description ----------------
router.post('/description', express.json(), (req, res) => {
    const content = req.body.content ?? '';

    fs.writeFile(DESCRIPTION_PATH, content, 'utf8', err => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to save' });
        }
        res.json({ status: 'saved' });
    });
});





const COMMANDS_PATH =
    '/home/nextup/user_config_files/error_container/commands.json';

// ---------- GET notebook ----------
router.get('/commands', (req, res) => {
    fs.readFile(COMMANDS_PATH, 'utf8', (err, data) => {
        if (err) return res.json({ cells: [] });
        res.json(JSON.parse(data));
    });
});

// ---------- SAVE notebook ----------
router.post('/commands', express.json(), (req, res) => {
    fs.writeFile(
        COMMANDS_PATH,
        JSON.stringify(req.body, null, 2),
        'utf8',
        err => {
            if (err) return res.status(500).json({ error: 'save failed' });
            res.json({ status: 'saved' });
        }
    );
});

/**
 * Launch always-on-top terminal via script
 */
router.post('/open-terminal', (req, res) => {
    try {
        spawn(
            '/home/nextup/user_config_files/error_container/always_on_top_terminal.sh',
            [],
            {
                detached: true,
                stdio: 'ignore'
            }
        ).unref();

        res.json({ status: 'terminal launched' });
    } catch (err) {
        console.error('Failed to launch terminal script:', err);
        res.status(500).json({ error: 'failed to launch terminal' });
    }
});



module.exports = router;
