document.addEventListener('DOMContentLoaded', () => {

    const terminal = document.getElementById('terminal-display');
    const rosStatus = document.getElementById('ros-status');
    const searchInput = document.getElementById('log-search-input');
    const clearSearchBtn = document.getElementById('clear-search');

    let isPaused = false;
    let pausedLogs = [];
    let allLogs = [];   // 🔴 master log store

    // ---------------- ROS ----------------
    const ros = new ROSLIB.Ros({ url: 'ws://localhost:9090' });

    ros.on('connection', () => updateRosStatus(true));
    ros.on('close', () => updateRosStatus(false));
    ros.on('error', () => updateRosStatus(false));

    function updateRosStatus(connected) {
        rosStatus.textContent = connected ? 'ROS Connected' : 'ROS Disconnected';
        rosStatus.className = `ros-status ${connected ? 'connected' : 'disconnected'}`;
    }

    const logsListener = new ROSLIB.Topic({
        ros,
        name: '/logs_topic',
        messageType: 'std_msgs/String'
    });

    logsListener.subscribe(msg => {
        const entry = {
            time: timestamp(),
            data: msg.data
        };

        allLogs.push(entry);

        if (isPaused) {
            pausedLogs.push(entry);
            return;
        }

        applyFilterAndRender();
    });

    // ---------------- SEARCH ----------------
    searchInput.addEventListener('input', applyFilterAndRender);

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        applyFilterAndRender();
    });

    function applyFilterAndRender() {
        terminal.innerHTML = '';
        const keyword = searchInput.value.toLowerCase();

        allLogs
            .filter(log => log.data.toLowerCase().includes(keyword))
            .forEach(renderLog);

        terminal.scrollTop = terminal.scrollHeight;
    }


    function renderLog(log) {
        const { cleanText, level } = parseLogLevel(log.data);

        const line = document.createElement('div');
        line.classList.add('log-line', level);

        line.innerHTML = `
        <span class="timestamp">${log.time}</span>
        <span class="log-message">${cleanText}</span>
    `;

        terminal.appendChild(line);
    }

    function parseLogLevel(text) {
        const match = text.match(/^\[(info|success|warn|failure)\]\s*(.*)/i);

        if (!match) {
            return {
                cleanText: text,
                level: 'log-default'
            };
        }

        return {
            cleanText: match[2],
            level: `log-${match[1].toLowerCase()}`
        };
    }


    // ---------------- CONTROLS ----------------
    document.getElementById('clear-terminal').onclick = () => {
        terminal.innerHTML = '';
        allLogs = [];
    };

    document.getElementById('pause-terminal').onclick = () => togglePause(true);
    document.getElementById('play-terminal').onclick = () => togglePause(false);

    function togglePause(state) {
        isPaused = state;
        document.getElementById('pause-terminal').disabled = state;
        document.getElementById('play-terminal').disabled = !state;

        if (!state && pausedLogs.length) {
            pausedLogs.forEach(log => allLogs.push(log));
            pausedLogs = [];
            applyFilterAndRender();
        }
    }

    // ---------------- CLOCK ----------------
    function updateClock() {
        document.getElementById('digital-clock').textContent =
            new Date().toLocaleTimeString('en-US', { hour12: false });
    }
    setInterval(updateClock, 1000);
    updateClock();

    function timestamp() {
        return new Date().toLocaleTimeString('en-US', { hour12: false });
    }


    function callTriggerService(serviceName, button) {
        const service = new ROSLIB.Service({
            ros,
            name: serviceName,
            serviceType: 'std_srvs/Trigger'
        });

        const request = new ROSLIB.ServiceRequest({});

        service.callService(request, (response) => {
            const success = response.success === true;

            button.classList.add(success ? 'success' : 'failure');

            setTimeout(() => {
                button.classList.remove('success', 'failure');
            }, 2000);
        }, (error) => {
            console.error('Service call failed:', error);

            button.classList.add('failure');
            setTimeout(() => {
                button.classList.remove('failure');
            }, 2000);
        });
    }

    const startBtn = document.getElementById('monitorStartBtn');
    const stopBtn = document.getElementById('monitorStopBtn');

    startBtn.addEventListener('click', () => {
        callTriggerService('/monitoring_start', startBtn);
    });

    stopBtn.addEventListener('click', () => {
        callTriggerService('/monitoring_stop', stopBtn);
    });















    const monitorOpenBtn = document.getElementById('monitor-open-btn');
    const monitorCloseBtn = document.getElementById('monitor-close-btn');
    const monitorOverlay = document.getElementById('monitor-modal-overlay');
    const monitorRosStatus = document.getElementById('monitor-ros-status');

    const monitorNodeContainer = document.getElementById('monitor-nodes');
    const monitorControllerContainer = document.getElementById('monitor-controllers');

    const monitorNodeElements = {};
    const monitorControllerElements = {};

    /* ---------------- Open / Close ---------------- */
    monitorOpenBtn.onclick = () =>
        monitorOverlay.classList.remove('hidden');

    monitorCloseBtn.onclick = () =>
        monitorOverlay.classList.add('hidden');

    /* ---------------- Load Expected Names ---------------- */
    fetch('/ros-monitor/names')
        .then(res => res.json())
        .then(data => {
            data.nodes.forEach(name => {
                const el = document.createElement('div');
                el.className = 'monitor-item';
                el.textContent = name;
                monitorNodeContainer.appendChild(el);
                monitorNodeElements[name] = el;
            });

            data.controllers.forEach(name => {
                const el = document.createElement('div');
                el.className = 'monitor-item';
                el.textContent = name;
                monitorControllerContainer.appendChild(el);
                monitorControllerElements[name] = el;
            });
        });



    ros.on('connection', () => {
        monitorRosStatus.textContent = 'ROS: connected';
        monitorRosStatus.style.color = '#4caf50';
    });

    ros.on('error', () => {
        monitorRosStatus.textContent = 'ROS: connection error';
        monitorRosStatus.style.color = '#ff4444';
    });

    ros.on('close', () => {
        monitorRosStatus.textContent = 'ROS: disconnected';
        monitorRosStatus.style.color = '#ff4444';
    });

    /* ---------------- Active Nodes Topic ---------------- */
    const monitorActiveTopic = new ROSLIB.Topic({
        ros,
        name: '/active_nodes_report',
        messageType: 'std_msgs/String'
    });

    monitorActiveTopic.subscribe(msg => {
        const active = msg.data
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        Object.values(monitorNodeElements).forEach(e =>
            e.classList.remove('active')
        );
        Object.values(monitorControllerElements).forEach(e =>
            e.classList.remove('active')
        );

        active.forEach(name => {
            monitorNodeElements[name]?.classList.add('active');
            monitorControllerElements[name]?.classList.add('active');
        });
    });











});








