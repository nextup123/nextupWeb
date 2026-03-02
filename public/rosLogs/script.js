// ROS Configuration
const ROS_CONFIG = {
    url: 'ws://localhost:9090',
    topic: '/rosout',
    messageType: 'rcl_interfaces/msg/Log'
};

// Application State
class ROSLogger {
    constructor() {
        this.ros = null;
        this.subscriber = null;
        this.isConnected = false;
        this.isPaused = false;
        this.autoScroll = true;
        this.wrapText = false;
        this.showOnlyOneNode = false;

        this.logs = [];
        this.filteredLogs = [];
        this.nodes = new Map(); // nodeName -> {count: number, visible: boolean}
        this.nodeLogCounts = new Map();

        this.levelFilters = {
            'debug': true,
            'info': true,
            'warn': true,
            'error': true,
            'fatal': true
        };

        this.levelCounts = {
            'debug': 0,
            'info': 0,
            'warn': 0,
            'error': 0,
            'fatal': 0
        };

        this.searchTerm = '';
        this.nodeSearchTerm = '';
        this.logsPerSecond = 0;
        this.lastSecondLogCount = 0;
        this.lastUpdateTime = Date.now();
        this.memoryUsage = 0;

        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.renderLevelFilters();
        this.updateStats();
        // this.attemptAutoConnect();
        this.startStatsUpdate();

        setTimeout(() => {
            this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
        }, 100);

    }

    cacheElements() {
        // Status elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');

        // Control buttons
        this.connectBtn = document.getElementById('connectBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.clearBtn = document.getElementById('clearBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.autoScrollBtn = document.getElementById('autoScrollBtn');
        this.autoScrollIcon = document.getElementById('autoScrollIcon');
        this.wrapTextBtn = document.getElementById('wrapTextBtn');
        this.collapseAllBtn = document.getElementById('collapseAllBtn');

        // Search inputs
        this.searchInput = document.getElementById('searchInput');
        this.clearSearchBtn = document.getElementById('clearSearch');
        this.nodeSearchInput = document.getElementById('nodeSearch');

        // Filter controls
        this.showAllLevelsBtn = document.getElementById('showAllLevels');
        this.hideAllLevelsBtn = document.getElementById('hideAllLevels');
        this.showAllNodesBtn = document.getElementById('showAllNodes');
        this.hideAllNodesBtn = document.getElementById('hideAllNodes');
        this.showOnlyOneNodeBtn = document.getElementById('showOnlyOneNode');

        // Containers
        this.levelFiltersContainer = document.getElementById('levelFilters');
        this.nodeFiltersContainer = document.getElementById('nodeFilters');
        this.logsContainer = document.getElementById('logsContainer');
        this.noLogsMessage = document.getElementById('noLogsMessage');

        // Stats elements
        this.totalLogsEl = document.getElementById('totalLogs');
        this.visibleLogsEl = document.getElementById('visibleLogs');
        this.connectedNodesEl = document.getElementById('connectedNodes');
        this.showingLogsEl = document.getElementById('showingLogs');
        this.totalLogsCountEl = document.getElementById('totalLogsCount');
        this.lastUpdateEl = document.getElementById('lastUpdate');
        this.logRateEl = document.getElementById('logRate');
        this.memoryUsageEl = document.getElementById('memoryUsage');
        this.visibleNodesCountEl = document.getElementById('visibleNodesCount');
        this.totalNodesCountEl = document.getElementById('totalNodesCount');
    }

    setupEventListeners() {
        // Connection controls
        this.connectBtn.addEventListener('click', () => this.toggleConnection());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.clearBtn.addEventListener('click', () => this.clearLogs());
        this.exportBtn.addEventListener('click', () => this.exportLogs());

        // View controls
        this.autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
        this.wrapTextBtn.addEventListener('click', () => this.toggleWrapText());
        this.collapseAllBtn.addEventListener('click', () => this.collapseAll());

        // Search
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.clearSearchBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.handleSearch('');
        });
        this.nodeSearchInput.addEventListener('input', (e) => {
            this.nodeSearchTerm = e.target.value.toLowerCase();
            this.renderNodeFilters();
        });

        // Filter controls
        this.showAllLevelsBtn.addEventListener('click', () => this.setAllLevels(true));
        this.hideAllLevelsBtn.addEventListener('click', () => this.setAllLevels(false));
        this.showAllNodesBtn.addEventListener('click', () => this.setAllNodes(true));
        this.hideAllNodesBtn.addEventListener('click', () => this.setAllNodes(false));
        this.showOnlyOneNodeBtn.addEventListener('click', () => this.toggleShowOnlyOneNode());

        // Replace the existing auto-scroll observer with:
        const observer = new MutationObserver(() => {
            if (this.autoScroll && !this.isPaused) {
                const container = this.logsContainer;
                // CHANGED: Check if we're near the bottom
                const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 50;
                if (isNearBottom) {
                    container.scrollTop = container.scrollHeight;
                }
            }
        });
        observer.observe(this.logsContainer, { childList: true });
    }

    // // ROS Connection Methods
    // attemptAutoConnect() {
    //     this.updateStatus('Connecting...', false);
    //     setTimeout(() => {
    //         this.connectToROS();
    //     }, 500);
    // }

    connectToROS() {
        if (this.ros) {
            this.ros.close();
        }

        this.ros = new ROSLIB.Ros({
            url: ROS_CONFIG.url
        });

        this.ros.on('connection', () => {
            console.log('Connected to ROSBridge');
            this.isConnected = true;
            this.updateStatus('Connected', true);
            this.subscribeToRosout();
        });

        this.ros.on('error', (error) => {
            console.error('Error connecting to ROSBridge:', error);
            this.updateStatus('Connection failed', false);
            this.isConnected = false;
        });

        this.ros.on('close', () => {
            console.log('Disconnected from ROSBridge');
            this.updateStatus('Disconnected', false);
            this.isConnected = false;
        });
    }

    disconnectFromROS() {
        if (this.subscriber) {
            this.subscriber.unsubscribe();
            this.subscriber = null;
        }

        if (this.ros) {
            this.ros.close();
            this.ros = null;
        }

        this.isConnected = false;
        this.updateStatus('Disconnected', false);
    }

    toggleConnection() {
        if (this.isConnected) {
            this.disconnectFromROS();
        } else {
            this.connectToROS();
        }
    }

    subscribeToRosout() {
        if (!this.ros || !this.isConnected) return;

        this.subscriber = new ROSLIB.Topic({
            ros: this.ros,
            name: ROS_CONFIG.topic,
            messageType: ROS_CONFIG.messageType
        });

        this.subscriber.subscribe((message) => this.handleRosoutMessage(message));
        console.log('Subscribed to /rosout');
    }

    // Message Handling
    handleRosoutMessage(message) {
        if (this.isPaused) return;

        const timestamp = new Date(message.stamp.sec * 1000 + message.stamp.nanosec / 1000000);
        const level = this.getLevelName(message.level);
        const node = message.name || 'unknown';

        const logEntry = {
            id: `${timestamp.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp,
            level,
            node,
            message: message.msg,
            file: message.file,
            function: message.function,
            line: message.line,
            raw: message
        };

        // CHANGED: Add to end (bottom) instead of beginning
        this.logs.push(logEntry);

        // Update level counts
        this.levelCounts[level]++;

        // Update node counts
        if (!this.nodes.has(node)) {
            this.nodes.set(node, { count: 0, visible: true });
            this.nodeLogCounts.set(node, 0);
        }

        const nodeData = this.nodes.get(node);
        nodeData.count++;
        this.nodeLogCounts.set(node, (this.nodeLogCounts.get(node) || 0) + 1);

        // Limit logs to prevent memory issues (remove from beginning)
        if (this.logs.length > 50000) {
            this.logs = this.logs.slice(10000); // Remove oldest 10000 logs
        }

        // Update logs per second
        this.lastSecondLogCount++;

        // Filter and render
        this.filterAndRenderLogs();

        // Update node filters if new node
        if (nodeData.count === 1) {
            this.renderNodeFilters();
        }
    }

    getLevelName(level) {
        switch (level) {
            case 10: return 'debug';
            case 20: return 'info';
            case 30: return 'warn';
            case 40: return 'error';
            case 50: return 'fatal';
            default: return 'info';
        }
    }

    filterAndRenderLogs() {
        // Apply all filters
        this.filteredLogs = this.logs.filter(log => {
            // Level filter
            if (!this.levelFilters[log.level]) return false;

            // Node filter
            const nodeData = this.nodes.get(log.node);
            if (!nodeData || !nodeData.visible) return false;

            // Search filter
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                return log.message.toLowerCase().includes(searchLower) ||
                    log.node.toLowerCase().includes(searchLower) ||
                    log.level.toLowerCase().includes(searchLower);
            }

            return true;
        });

        this.renderLogs();
        this.updateStats();
    }

    handleSearch(term) {
        this.searchTerm = term.toLowerCase();
        this.filterAndRenderLogs();
    }

    setAllLevels(visible) {
        Object.keys(this.levelFilters).forEach(level => {
            this.levelFilters[level] = visible;
        });
        this.renderLevelFilters();
        this.filterAndRenderLogs();
    }

    setAllNodes(visible) {
        this.nodes.forEach((data, node) => {
            data.visible = visible;
        });
        this.renderNodeFilters();
        this.filterAndRenderLogs();
    }

    toggleShowOnlyOneNode() {
        this.showOnlyOneNode = !this.showOnlyOneNode;
        this.showOnlyOneNodeBtn.classList.toggle('active', this.showOnlyOneNode);

        if (this.showOnlyOneNode) {
            // Find first visible node
            let foundVisible = false;
            this.nodes.forEach((data, node) => {
                if (data.visible && !foundVisible) {
                    foundVisible = true;
                } else {
                    data.visible = false;
                }
            });
        }

        this.renderNodeFilters();
        this.filterAndRenderLogs();
    }

    toggleNode(nodeName) {
        const nodeData = this.nodes.get(nodeName);
        if (!nodeData) return;

        if (this.showOnlyOneNode) {
            // If showOnlyOneNode is enabled, hide all others and show this one
            this.nodes.forEach((data, node) => {
                data.visible = (node === nodeName);
            });
        } else {
            // Normal toggle
            nodeData.visible = !nodeData.visible;
        }

        this.renderNodeFilters();
        this.filterAndRenderLogs();
    }

    // Rendering Methods
    renderLevelFilters() {
        this.levelFiltersContainer.innerHTML = '';

        Object.entries(this.levelFilters).forEach(([level, visible]) => {
            const item = document.createElement('div');
            item.className = `level-filter-item ${visible ? 'active' : ''}`;
            item.style.color = this.getLevelColor(level);
            item.dataset.level = level;

            item.innerHTML = `
                <div class="level-indicator"></div>
                <span class="level-label">${level.toUpperCase()}</span>
                <span class="level-count">${this.levelCounts[level]}</span>
            `;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.levelFilters[level] = !this.levelFilters[level];
                this.renderLevelFilters();
                this.filterAndRenderLogs();
            });

            this.levelFiltersContainer.appendChild(item);
        });
    }

    renderNodeFilters() {
        this.nodeFiltersContainer.innerHTML = '';

        let visibleCount = 0;
        let totalCount = 0;

        // Filter nodes by search term
        const filteredNodes = Array.from(this.nodes.entries())
            .filter(([nodeName]) =>
                nodeName.toLowerCase().includes(this.nodeSearchTerm)
            )
            .sort((a, b) => a[0].localeCompare(b[0]));

        filteredNodes.forEach(([nodeName, nodeData]) => {
            totalCount++;
            if (nodeData.visible) visibleCount++;

            const logCount = this.nodeLogCounts.get(nodeName) || 0;

            const item = document.createElement('div');
            item.className = `node-filter-item ${nodeData.visible ? 'active' : ''}`;
            item.dataset.node = nodeName;

            item.innerHTML = `
                <div class="node-visibility">
                    <i class="fas fa-${nodeData.visible ? 'eye' : 'eye-slash'}"></i>
                </div>
                <span class="node-name">${nodeName}</span>
                <span class="node-log-count">${logCount}</span>
            `;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNode(nodeName);
            });

            this.nodeFiltersContainer.appendChild(item);
        });

        this.visibleNodesCountEl.textContent = visibleCount;
        this.totalNodesCountEl.textContent = totalCount;
    }

    renderLogs() {
        if (this.filteredLogs.length === 0) {
            this.noLogsMessage.classList.remove('hidden');
            this.logsContainer.innerHTML = '';
            this.logsContainer.appendChild(this.noLogsMessage);
            return;
        }

        this.noLogsMessage.classList.add('hidden');

        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();

        // CHANGED: Render logs in chronological order (oldest to newest)
        this.filteredLogs.forEach(log => {
            const logElement = this.createLogElement(log);
            fragment.appendChild(logElement);
        });

        this.logsContainer.innerHTML = '';
        this.logsContainer.appendChild(fragment);

        // CHANGED: Auto-scroll to bottom to show latest logs
        if (this.autoScroll && !this.isPaused) {
            this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
        }
    }

    createLogElement(log) {
        const div = document.createElement('div');
        div.className = `log-entry compact ${log.level}`;
        div.dataset.id = log.id;

        // Format timestamp
        const timestamp = log.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        }).replace(',', '.');

        // Format level
        const levelDisplay = log.level.toUpperCase();

        // Highlight search term in message
        let message = log.message;
        if (this.searchTerm) {
            const regex = new RegExp(`(${this.escapeRegExp(this.searchTerm)})`, 'gi');
            message = message.replace(regex, '<span class="highlight">$1</span>');
        }

        div.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div class="log-node" title="${log.node}">${log.node}</div>
            <div class="log-level ${log.level}">${levelDisplay}</div>
            <div class="log-message ${this.wrapText ? 'wrapped' : ''}" title="${log.message}">${message}</div>
        `;

        return div;
    }

    // Utility Methods
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getLevelColor(level) {
        const colors = {
            'debug': '#34C759',
            'info': '#007AFF',
            'warn': '#FF9500',
            'error': '#FF3B30',
            'fatal': '#AF52DE'
        };
        return colors[level] || '#000000';
    }

    // Control Methods
    togglePause() {
        this.isPaused = !this.isPaused;
        this.pauseIcon.className = this.isPaused ? 'fas fa-play' : 'fas fa-pause';
        this.pauseBtn.title = this.isPaused ? 'Resume' : 'Pause';

        if (this.isPaused) {
            this.statusText.textContent = 'Paused';
        } else {
            this.updateStatus(this.isConnected ? 'Connected' : 'Disconnected', this.isConnected);
        }
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        this.autoScrollIcon.style.color = this.autoScroll ? 'var(--system-blue)' : 'var(--system-gray)';
        this.autoScrollBtn.classList.toggle('active', this.autoScroll);

        // CHANGED: When enabling auto-scroll, scroll to bottom
        if (this.autoScroll) {
            this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
        }
    }

    toggleWrapText() {
        this.wrapText = !this.wrapText;
        this.wrapTextBtn.classList.toggle('active', this.wrapText);
        this.filterAndRenderLogs();
    }

    collapseAll() {
        // Currently just scrolls to top
        this.logsContainer.scrollTop = 0;
    }

    clearLogs() {
        if (confirm('Are you sure you want to clear all logs?')) {
            this.logs = [];
            this.filteredLogs = [];
            this.nodes.clear();
            this.nodeLogCounts.clear();

            // Reset level counts
            Object.keys(this.levelCounts).forEach(level => {
                this.levelCounts[level] = 0;
            });

            this.renderLogs();
            this.renderNodeFilters();
            this.renderLevelFilters();
            this.updateStats();
        }
    }

    exportLogs() {
        if (this.logs.length === 0) {
            alert('No logs to export');
            return;
        }

        let content = 'ROS 2 Logs Export\n';
        content += `Exported: ${new Date().toISOString()}\n`;
        content += `Total logs: ${this.logs.length}\n`;
        content += `Visible logs: ${this.filteredLogs.length}\n\n`;

        // CHANGED: No need to reverse anymore since logs are in chronological order
        this.logs.forEach(log => {
            content += `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.node}]: ${log.message}\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ros2-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    // Status and Stats
    updateStatus(text, connected) {
        this.statusText.textContent = text;

        if (connected) {
            this.statusIndicator.className = 'status-indicator connected';
            this.connectBtn.innerHTML = '<i class="fas fa-plug"></i>';
            this.connectBtn.title = 'Disconnect';
        } else {
            this.statusIndicator.className = 'status-indicator';
            this.connectBtn.innerHTML = '<i class="fas fa-plug"></i>';
            this.connectBtn.title = 'Connect';
        }
    }

    updateStats() {
        this.totalLogsEl.textContent = this.logs.length;
        this.visibleLogsEl.textContent = this.filteredLogs.length;
        this.connectedNodesEl.textContent = this.nodes.size;
        this.showingLogsEl.textContent = this.filteredLogs.length;
        this.totalLogsCountEl.textContent = this.logs.length;
        this.lastUpdateEl.textContent = new Date().toLocaleTimeString();

        // Calculate memory usage (approximate)
        this.memoryUsage = Math.round((JSON.stringify(this.logs).length / 1024 / 1024) * 100) / 100;
        this.memoryUsageEl.textContent = `${this.memoryUsage} MB`;
    }

    startStatsUpdate() {
        setInterval(() => {
            this.logsPerSecond = this.lastSecondLogCount;
            this.lastSecondLogCount = 0;
            this.logRateEl.textContent = `${this.logsPerSecond}/s`;

            // Update level counts in UI
            const levelItems = this.levelFiltersContainer.querySelectorAll('.level-count');
            levelItems.forEach(item => {
                const level = item.parentElement.dataset.level;
                if (level) {
                    item.textContent = this.levelCounts[level];
                }
            });

            // Update node counts
            this.renderNodeFilters();

        }, 1000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.rosLogger = new ROSLogger();
});