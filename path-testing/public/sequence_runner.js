const seq_runner = {
    // State
    sequenceData: null,
    updateInterval: null,
    elapsedTimer: null,
    executionStartTime: null,
    elapsedTime: 0,
    completedTime: null,

    // DOM elements
    elements: {},

    // Initialize
    init() {
        // Cache DOM elements
        this.elements = {
            seqName: document.getElementById('seq-runner-seq-name'),
            seqRoute: document.getElementById('seq-runner-seq-route'),
            startBtn: document.getElementById('seq-runner-start'),
            stopBtn: document.getElementById('seq-runner-stop'),
            refreshBtn: document.getElementById('seq-runner-refresh'),
            badge: document.getElementById('seq-runner-badge'),
            progress: document.getElementById('seq-runner-progress'),
            progressFill: document.getElementById('seq-runner-progress-fill'),
            elapsed: document.getElementById('seq-runner-elapsed'),
            currentStep: document.getElementById('seq-runner-current-step'),
            currentInfo: document.getElementById('seq-runner-current-info'),
            currentRoute: document.getElementById('seq-runner-current-route'),
            currentTime: document.getElementById('seq-runner-current-time'),
            stepsGrid: document.getElementById('seq-runner-steps-grid'),
            alertContainer: document.getElementById('seq-runner-alert-container')
        };

        // Event listeners
        this.elements.startBtn.addEventListener('click', () => this.startSequence());
        this.elements.stopBtn.addEventListener('click', () => this.stopSequence());
        this.elements.refreshBtn.addEventListener('click', () => this.refreshState());

        // Load sequence and start updates
        this.loadSequence();
        this.startStatusUpdates();
    },

    // Show alert
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `sr-alert sr-alert-${type}`;
        alert.innerHTML = `
                    <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                    ${message}
                `;

        this.elements.alertContainer.appendChild(alert);

        // Remove after 3 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 3000);
    },

    // Load the sequence
    async loadSequence() {
        this.elements.stepsGrid.innerHTML = `
                    <div class="sr-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        Loading steps...
                    </div>
                `;

        try {
            const response = await fetch('/api/sequences-creator');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to load sequence');
            }

            if (result.sequences && result.sequences.length > 0) {
                this.sequenceData = result.sequences[0];
                this.updateSequenceInfo();
                this.updateControls(false);
            } else {
                throw new Error('No sequences available');
            }

        } catch (error) {
            console.error('Error loading sequence:', error);
            this.showAlert('Failed to load sequence: ' + error.message, 'error');
            this.elements.stepsGrid.innerHTML = `
                        <div class="sr-loading" style="color: #ff3b30;">
                            <i class="fas fa-exclamation-circle"></i>
                            Failed to load
                        </div>
                    `;
            this.elements.seqName.textContent = 'Error';
        }
    },

    // Update sequence information
    updateSequenceInfo() {
        if (!this.sequenceData) return;

        const seq = this.sequenceData;

        // Update header info
        this.elements.seqName.textContent = seq.name || 'Sequence';

        const startPoint = seq.start || '-';
        const endPoint = seq.steps && seq.steps.length > 0
            ? seq.steps[seq.steps.length - 1].to
            : '-';
        this.elements.seqRoute.textContent = `${startPoint} → ${endPoint}`;

        // Render steps
        this.renderSteps();
    },

    // Render steps list
    renderSteps() {
        const steps = this.sequenceData?.steps || [];

        if (steps.length === 0) {
            this.elements.stepsGrid.innerHTML = `
                        <div class="sr-loading">
                            <i class="fas fa-inbox"></i>
                            No steps in sequence
                        </div>
                    `;
            return;
        }

        let html = '';
        steps.forEach((step, index) => {
            html += `
                        <div class="sr-step" id="seq-runner-step-${index}">
                            <div class="dot">${step.order || index + 1}</div>
                            <div class="name" title="${step.path}">${step.path}</div>
                            <div class="route">${step.from} → ${step.to}</div>
                        </div>
                    `;
        });

        this.elements.stepsGrid.innerHTML = html;
    },

    // Start sequence execution
    async startSequence() {
        if (!this.sequenceData) {
            this.showAlert('No sequence loaded', 'error');
            return;
        }

        try {
            const sequenceData = {
                sequence: {
                    id: this.sequenceData.id,
                    start: this.sequenceData.start,
                    current: this.sequenceData.current,
                    steps: this.sequenceData.steps
                }
            };

            const response = await fetch('/api/sequences/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sequenceData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to start sequence');
            }

            // Start elapsed time counter
            this.startElapsedTimer();

            this.showAlert('Sequence execution started', 'success');
            this.updateControls(true);

        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    },

    // Start elapsed time timer
    startElapsedTimer() {
        this.executionStartTime = Date.now();
        this.elapsedTime = 0;
        this.completedTime = null;

        if (this.elapsedTimer) {
            clearInterval(this.elapsedTimer);
        }

        this.elapsedTimer = setInterval(() => {
            if (!this.completedTime) {
                this.elapsedTime = Math.floor((Date.now() - this.executionStartTime) / 1000);
                this.updateElapsedTime();
            }
        }, 1000);
    },

    // Update elapsed time display
    updateElapsedTime() {
        this.elements.elapsed.textContent = this.completedTime
            ? `${this.completedTime}s`
            : `${this.elapsedTime}s`;
    },

    // Stop sequence
    async stopSequence() {
        try {
            const response = await fetch('/api/sequences/stop', {
                method: 'POST'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to stop sequence');
            }

            // Stop elapsed timer
            if (this.elapsedTimer) {
                clearInterval(this.elapsedTimer);
                this.elapsedTimer = null;
            }

            this.showAlert('Sequence stopped', 'info');
            this.updateControls(false);

        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    },

    // Refresh/reset state
    async refreshState() {
        try {
            const response = await fetch('/api/sequences/refresh', {
                method: 'POST'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to reset state');
            }

            // Reset elapsed time
            if (this.elapsedTimer) {
                clearInterval(this.elapsedTimer);
                this.elapsedTimer = null;
            }
            this.elapsedTime = 0;
            this.completedTime = null;
            this.updateElapsedTime();

            // Reload sequence
            await this.loadSequence();

            this.showAlert('State reset', 'success');
            this.updateControls(false);

        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    },

    // Update control buttons
    updateControls(isActive) {
        if (isActive) {
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
        } else {
            this.elements.startBtn.disabled = !this.sequenceData;
            this.elements.stopBtn.disabled = true;
        }
    },

    // Start status updates
    startStatusUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => this.updateStatus(), 1000);
        this.updateStatus();
    },

    // Update status from server
    async updateStatus() {
        try {
            const response = await fetch('/api/sequences/status');

            // First check if response is OK
            if (!response.ok) {
                // Try to parse error as JSON first
                try {
                    const errorData = await response.json();
                    console.error('Status endpoint error:', errorData.error);
                } catch (e) {
                    // If not JSON, get text
                    const errorText = await response.text();
                    console.error('Status endpoint returned:', errorText.substring(0, 100));
                }

                // Don't throw, just return and try again next interval
                return;
            }

            const status = await response.json();
            if (!status) return;

            // Update badge
            const badge = this.elements.badge;
            if (status.active) {
                badge.className = 'seq-runner-badge seq-runner-badge-running';
                badge.textContent = 'RUNNING';
            } else if (status.completed) {
                badge.className = 'seq-runner-badge seq-runner-badge-completed';
                badge.textContent = 'COMPLETED';

                // Stop elapsed timer on completion
                if (!this.completedTime) {
                    this.completedTime = this.elapsedTime;
                    if (this.elapsedTimer) {
                        clearInterval(this.elapsedTimer);
                        this.elapsedTimer = null;
                    }
                    this.updateElapsedTime();
                }
            } else if (status.error) {
                badge.className = 'seq-runner-badge seq-runner-badge-error';
                badge.textContent = 'ERROR';

                // Stop elapsed timer on error
                if (this.elapsedTimer) {
                    clearInterval(this.elapsedTimer);
                    this.elapsedTimer = null;
                }
            } else {
                badge.className = 'seq-runner-badge seq-runner-badge-idle';
                badge.textContent = 'IDLE';
            }

            // Update progress
            this.elements.progress.textContent =
                `${status.stepsCompleted || 0}/${status.stepsTotal || 0}`;

            if (status.progress) {
                const percent = status.progress.percentage || 0;
                this.elements.progressFill.style.width = `${percent}%`;
            }

            // Update current step
            if (status.currentStepInfo) {
                this.elements.currentStep.style.display = 'block';
                const step = status.currentStepInfo;
                const runningTime = step.running_time || 0;

                this.elements.currentInfo.textContent = step.path || 'Step';
                this.elements.currentRoute.textContent = `${step.from} → ${step.to}`;
                this.elements.currentTime.textContent = step.has_started
                    ? `Running: ${runningTime.toFixed(1)}s`
                    : 'Ready';
            } else {
                this.elements.currentStep.style.display = 'none';
            }

            // Update steps progress visualization
            this.updateStepsProgress(status);

            // Update controls
            this.updateControls(status.active);

        } catch (error) {
            console.error('Failed to update status:', error.message);
            if (!error.message.includes('JSON')) {
                this.showAlert('Connection error: ' + error.message, 'error');
            }
        }
    },

    // Update steps progress visualization
    updateStepsProgress(status) {
        const steps = status.currentSequence?.steps || this.sequenceData?.steps || [];

        steps.forEach((step, index) => {
            const stepElement = document.getElementById(`seq-runner-step-${index}`);
            if (!stepElement) return;

            // Reset classes
            stepElement.className = 'sr-step';

            if (index < (status.stepsCompleted || 0)) {
                stepElement.classList.add('completed');
            } else if (index === status.currentStepIndex) {
                stepElement.classList.add('current');

                // Smooth scroll to current step
                stepElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        });
    }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    seq_runner.init();
});