// public/path-animator.js - Continuous pulse animation
(() => {
  // API endpoints
  const API_START_PATH = '/pose/start_path';
  const API_STOP_PATH = '/pose/stop_path';
  const API_CURRENT_RUNNING = '/pose/current_running_path';
  const API_PATH_PROGRESS = '/pose/path_progress';
  const API_PATHS = '/pose/paths';

  // State
  let currentRunningPath = null;
  let pulsePosition = 0;
  let updateInterval = null;
  let runningPathOverlay = null;
  let runningPathMarkers = [];
  let allPathsData = [];
  let pulseAnimationId = null;

  // Colors for running paths
  const colors = {
    runningPath: '#FF6B6B', // Bright red for active path
    startPoint: '#4ECDC4',   // Teal for start point
    endPoint: '#45B7D1',     // Blue for end point
    pulseMarker: '#FFE66D',  // Yellow for pulse marker
    pulseTrail: 'rgba(255, 107, 107, 0.3)' // Faint red for pulse trail
  };

  // ---------- DOM Elements ----------
  let animatorControls = null;
  let startPathBtn = null;
  let stopPathBtn = null;
  let pathSelect = null;
  let statusDisplay = null;

  // ---------- Initialization ----------
  function init() {
    console.log('Path animator initializing...');
    createUIControls();
    startStatusUpdates();
    listenForRenderEvents();
    checkForRunningPath();
    console.log('Path animator ready.');
  }

  // ---------- UI Controls ----------
  function createUIControls() {
    const header = document.querySelector('header');
    if (!header) return;

    // Create animator controls container
    animatorControls = document.createElement('div');
    animatorControls.className = 'animator-controls';
    animatorControls.style.display = 'flex';
    animatorControls.style.gap = '8px';
    animatorControls.style.alignItems = 'center';
    animatorControls.style.marginLeft = '20px';
    animatorControls.style.paddingLeft = '20px';
    animatorControls.style.borderLeft = '1px solid rgba(0,0,0,0.1)';

    // Path selection dropdown
    const pathLabel = document.createElement('label');
    pathLabel.innerHTML = 'Path: ';
    pathLabel.style.color = 'var(--muted)';
    pathLabel.style.fontSize = '13px';

    pathSelect = document.createElement('select');
    pathSelect.id = 'pathSelector';
    pathSelect.style.minWidth = '120px';

    // Start Path button
    startPathBtn = document.createElement('button');
    startPathBtn.textContent = '▶ Start Path';
    startPathBtn.title = 'Start animating selected path';
    startPathBtn.addEventListener('click', startSelectedPath);

    // Stop Path button
    stopPathBtn = document.createElement('button');
    stopPathBtn.textContent = '⏹ Stop';
    stopPathBtn.title = 'Stop current path animation';
    stopPathBtn.disabled = true;
    stopPathBtn.addEventListener('click', stopCurrentPath);

    // Status display
    statusDisplay = document.createElement('span');
    statusDisplay.className = 'path-status';
    statusDisplay.style.fontSize = '12px';
    statusDisplay.style.color = 'var(--muted)';
    statusDisplay.style.marginLeft = '8px';

    // Assemble controls
    animatorControls.appendChild(pathLabel);
    animatorControls.appendChild(pathSelect);
    animatorControls.appendChild(startPathBtn);
    animatorControls.appendChild(stopPathBtn);
    animatorControls.appendChild(statusDisplay);


    loadPathsIntoDropdown();
  }

  // ---------- Data Loading ----------
  async function loadPathsIntoDropdown() {
    try {
      const response = await fetch(API_PATHS);
      const data = await response.json();

      allPathsData = data.paths || [];
      pathSelect.innerHTML = '<option value="">Select a path</option>';

      allPathsData.forEach(path => {
        const option = document.createElement('option');
        option.value = path.name || `${path.start_point}_${path.end_point}`;
        option.textContent = `${path.name || 'Unnamed'} (${path.start_point} → ${path.end_point})`;
        option.dataset.pathData = JSON.stringify(path);
        pathSelect.appendChild(option);
      });

      console.log(`Loaded ${allPathsData.length} paths`);
    } catch (error) {
      console.error('Error loading paths:', error);
      statusDisplay.textContent = 'Failed to load paths';
    }
  }

  // ---------- Path Control Functions ----------
  async function startSelectedPath() {
    const selectedOption = pathSelect.options[pathSelect.selectedIndex];
    if (!selectedOption.value) {
      alert('Please select a path first');
      return;
    }

    const pathName = selectedOption.value;
    const pathData = JSON.parse(selectedOption.dataset.pathData || '{}');

    await startPath(pathName, pathData);
  }

  async function startPath(pathName, pathData = null) {
    try {
      const response = await fetch(`${API_START_PATH}/${encodeURIComponent(pathName)}`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        if (!pathData) {
          pathData = allPathsData.find(p => p.name === pathName) ||
            allPathsData.find(p => `${p.start_point}_${p.end_point}` === pathName);
        }

        currentRunningPath = result.path;

        // Update UI
        startPathBtn.disabled = true;
        stopPathBtn.disabled = false;
        pathSelect.disabled = true;
        statusDisplay.textContent = `Continuous: ${currentRunningPath.name}`;
        statusDisplay.style.color = colors.runningPath;

        // Update dropdown
        if (pathSelect) {
          for (let i = 0; i < pathSelect.options.length; i++) {
            if (pathSelect.options[i].value === pathName) {
              pathSelect.selectedIndex = i;
              break;
            }
          }
        }

        // Start pulse animation
        if (pathData) {
          visualizeRunningPath(pathData);
          startPulseAnimation();
        }

        console.log(`Started continuous path: ${pathName}`);
      }
    } catch (error) {
      console.error('Error starting path:', error);
      alert('Failed to start path.');
    }
  }

  async function stopCurrentPath(skipServerCall = false) {
    try {
      if (!skipServerCall) {
        const response = await fetch(API_STOP_PATH, {
          method: 'POST'
        });

        if (!response.ok) {
          // If we get a 400, the path might already be stopped
          if (response.status === 400) {
            console.log('Path was already stopped on server');
            // Continue with cleanup anyway
          } else {
            const result = await response.json();
            console.error('Error stopping path:', result.error);
            return;
          }
        } else {
          const result = await response.json();
          if (result.success) {
            console.log(`Stopped path: ${currentRunningPath?.name}`);
          }
        }
      }

      // Always reset frontend state
      currentRunningPath = null;
      pulsePosition = 0;

      // Update UI
      startPathBtn.disabled = false;
      stopPathBtn.disabled = true;
      pathSelect.disabled = false;
      statusDisplay.textContent = 'Ready';
      statusDisplay.style.color = 'var(--muted)';

      // Stop animation and remove visualization
      stopPulseAnimation();
      removeRunningPathVisualization();

    } catch (error) {
      console.error('Error in stopCurrentPath:', error);
      // Even if there's an error, cleanup frontend state
      currentRunningPath = null;
      startPathBtn.disabled = false;
      stopPathBtn.disabled = true;
      statusDisplay.textContent = 'Error stopping';
      stopPulseAnimation();
      removeRunningPathVisualization();
    }
  }

  // ---------- Visualization ----------
  function visualizeRunningPath(pathData) {
    removeRunningPathVisualization();

    const pathSelector = `.path-line[data-start="${pathData.start_point}"][data-end="${pathData.end_point}"]`;
    const reverseSelector = `.path-line[data-start="${pathData.end_point}"][data-end="${pathData.start_point}"]`;

    const originalPath = document.querySelector(pathSelector) || document.querySelector(reverseSelector);
    if (!originalPath) {
      console.warn('Path element not found for:', pathData);
      return;
    }

    const d = originalPath.getAttribute('d');
    if (!d) return;

    // Create main path overlay
    runningPathOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    runningPathOverlay.setAttribute('d', d);
    runningPathOverlay.classList.add('running-path-overlay');

    // Style for continuous pulse effect
    runningPathOverlay.style.stroke = colors.runningPath;
    runningPathOverlay.style.strokeWidth = '6px';
    runningPathOverlay.style.opacity = '0.8';
    runningPathOverlay.style.fill = 'none';
    runningPathOverlay.style.strokeLinecap = 'round';
    runningPathOverlay.style.pointerEvents = 'none';
    runningPathOverlay.style.filter = `drop-shadow(0 0 8px ${colors.runningPath})`;

    // Create pulse trail (faint background)
    const pulseTrail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pulseTrail.setAttribute('d', d);
    pulseTrail.classList.add('pulse-trail');
    pulseTrail.style.stroke = colors.pulseTrail;
    pulseTrail.style.strokeWidth = '10px';
    pulseTrail.style.opacity = '0.5';
    pulseTrail.style.fill = 'none';
    pulseTrail.style.strokeLinecap = 'round';
    pulseTrail.style.pointerEvents = 'none';

    // Create pulse marker
    const pulseMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulseMarker.setAttribute('r', '10');
    pulseMarker.classList.add('pulse-marker');
    pulseMarker.setAttribute('fill', colors.pulseMarker);
    pulseMarker.setAttribute('stroke', 'rgba(0,0,0,0.3)');
    pulseMarker.setAttribute('stroke-width', '2');
    pulseMarker.style.filter = `drop-shadow(0 0 10px ${colors.pulseMarker})`;
    pulseMarker.style.pointerEvents = 'none';

    // Highlight points
    highlightPoint(pathData.start_point, 'start');
    highlightPoint(pathData.end_point, 'end');

    // Add to SVG - FIXED INSERTION ERROR
    const root = document.getElementById('root');
    if (root) {
      // Create a container group for all running path elements
      const runningPathGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      runningPathGroup.classList.add('running-path-group');
      runningPathGroup.appendChild(pulseTrail);
      runningPathGroup.appendChild(runningPathOverlay);
      runningPathGroup.appendChild(pulseMarker);

      // Simply append to root - no complex insertion logic
      root.appendChild(runningPathGroup);

      runningPathMarkers.push({
        element: pulseMarker,
        type: 'pulse',
        originalPath: originalPath,
        group: runningPathGroup,
        trail: pulseTrail
      });
    }
  }

  function highlightPoint(pointName, type) {
    const node = document.querySelector(`.node[data-name="${pointName}"]`);
    if (!node) return;

    const rect = node.querySelector('.point-rect');
    if (!rect) return;

    rect.dataset.originalFill = rect.style.fill || '';
    rect.dataset.originalStroke = rect.style.stroke || '';

    const color = type === 'start' ? colors.startPoint : colors.endPoint;
    rect.style.fill = color;
    rect.style.filter = `drop-shadow(0 0 8px ${color})`;
    rect.style.stroke = 'rgba(0,0,0,0.3)';
    rect.style.strokeWidth = '2px';

    runningPathMarkers.push({ node, rect, type });
  }

  // ---------- Pulse Animation ----------
  function startPulseAnimation() {
    if (pulseAnimationId) {
      cancelAnimationFrame(pulseAnimationId);
    }

    let lastTime = 0;
    const pulseSpeed = 1.0; // Seconds per complete cycle

    function animatePulse(currentTime) {
      if (!currentRunningPath) return;

      if (!lastTime) lastTime = currentTime;
      const delta = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      // Update pulse position (0 to 1, loops continuously)
      pulsePosition = (pulsePosition + (delta / pulseSpeed)) % 1;

      // Update pulse marker position
      const pulseMarker = runningPathMarkers.find(m => m.type === 'pulse');
      if (pulseMarker && pulseMarker.originalPath) {
        try {
          const length = pulseMarker.originalPath.getTotalLength();
          const point = pulseMarker.originalPath.getPointAtLength(length * pulsePosition);

          // Update pulse marker position
          pulseMarker.element.setAttribute('cx', point.x);
          pulseMarker.element.setAttribute('cy', point.y);

          // Create glowing effect
          const glowSize = 12 + Math.sin(currentTime / 200) * 4;
          pulseMarker.element.setAttribute('r', glowSize);

          // Update path overlay with pulse effect
          if (runningPathOverlay) {
            const dashOffset = -pulsePosition * 30;
            runningPathOverlay.style.strokeDasharray = '10, 20';
            runningPathOverlay.style.strokeDashoffset = dashOffset;
          }

        } catch (e) {
          console.warn('Error updating pulse position:', e);
        }
      }

      pulseAnimationId = requestAnimationFrame(animatePulse);
    }

    pulseAnimationId = requestAnimationFrame(animatePulse);
  }

  function stopPulseAnimation() {
    if (pulseAnimationId) {
      cancelAnimationFrame(pulseAnimationId);
      pulseAnimationId = null;
    }
  }

  function removeRunningPathVisualization() {
    // Stop animation first
    stopPulseAnimation();

    // Remove all SVG elements with running path classes
    const svg = document.getElementById('viz');
    if (svg) {
      // Remove running path group
      const runningGroups = svg.querySelectorAll('.running-path-group');
      runningGroups.forEach(group => {
        if (group.parentNode) {
          group.parentNode.removeChild(group);
        }
      });

      // Remove any leftover pulse markers
      const pulseMarkers = svg.querySelectorAll('.pulse-marker');
      pulseMarkers.forEach(marker => {
        if (marker.parentNode) {
          marker.parentNode.removeChild(marker);
        }
      });
    }

    // Restore point styles
    runningPathMarkers.forEach(marker => {
      if (marker.rect) {
        marker.rect.style.fill = marker.rect.dataset.originalFill || '';
        marker.rect.style.stroke = marker.rect.dataset.originalStroke || '';
        marker.rect.style.filter = '';
        marker.rect.style.strokeWidth = '';
      }
    });

    // Clear arrays
    runningPathOverlay = null;
    runningPathMarkers = [];
  }

  // ---------- Status Updates ----------
  function startStatusUpdates() {
    if (updateInterval) clearInterval(updateInterval);

    // Check for external path changes every second
    updateInterval = setInterval(async () => {
      await checkExternalPathStatus();
    }, 1000);
  }

  async function checkExternalPathStatus() {
    try {
      const response = await fetch(API_CURRENT_RUNNING);
      const data = await response.json();

      if (data.running) {
        // Path is running (could be started externally)
        if (!currentRunningPath || currentRunningPath.name !== data.path.name) {
          // New/different path detected
          console.log('External path detected:', data.path.name);

          const pathData = allPathsData.find(p => p.name === data.path.name);

          if (pathData) {
            currentRunningPath = data.path;

            // Update UI
            startPathBtn.disabled = true;
            stopPathBtn.disabled = false;
            pathSelect.disabled = true;
            statusDisplay.textContent = `External: ${currentRunningPath.name}`;
            statusDisplay.style.color = colors.runningPath;

            // Update dropdown
            if (pathSelect) {
              for (let i = 0; i < pathSelect.options.length; i++) {
                if (pathSelect.options[i].value === data.path.name) {
                  pathSelect.selectedIndex = i;
                  break;
                }
              }
            }

            // Start visualization
            if (pathData) {
              visualizeRunningPath(pathData);
              startPulseAnimation();
            }
          }
        }
      } else if (!data.running && currentRunningPath) {
        // Path was stopped externally - just cleanup frontend, don't call stop API
        console.log('Path stopped externally, cleaning up frontend');

        // Reset frontend state without calling server
        currentRunningPath = null;
        pulsePosition = 0;

        // Update UI
        startPathBtn.disabled = false;
        stopPathBtn.disabled = true;
        pathSelect.disabled = false;
        statusDisplay.textContent = 'Ready';
        statusDisplay.style.color = 'var(--muted)';

        // Stop animation and remove visualization
        stopPulseAnimation();
        removeRunningPathVisualization();
      }
    } catch (error) {
      console.error('Error checking path status:', error);
    }
  }

  async function checkForRunningPath() {
    try {
      const response = await fetch(API_CURRENT_RUNNING);
      const data = await response.json();

      if (data.running) {
        console.log('Found running path on startup:', data.path.name);

        setTimeout(async () => {
          if (allPathsData.length === 0) {
            await loadPathsIntoDropdown();
          }

          const pathData = allPathsData.find(p => p.name === data.path.name);

          if (pathData) {
            currentRunningPath = data.path;

            // Update UI
            startPathBtn.disabled = true;
            stopPathBtn.disabled = false;
            pathSelect.disabled = true;
            statusDisplay.textContent = `Running: ${currentRunningPath.name}`;
            statusDisplay.style.color = colors.runningPath;

            // Update dropdown
            if (pathSelect) {
              for (let i = 0; i < pathSelect.options.length; i++) {
                if (pathSelect.options[i].value === data.path.name) {
                  pathSelect.selectedIndex = i;
                  break;
                }
              }
            }

            // Start visualization
            visualizeRunningPath(pathData);
            startPulseAnimation();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error checking for running path:', error);
    }
  }

  // ---------- Event Listeners ----------
  function listenForRenderEvents() {
    const originalRender = window.__viz?.render;
    if (originalRender) {
      window.__viz.render = function () {
        originalRender.call(this);
        // Re-apply visualization if a path is running
        setTimeout(() => {
          if (currentRunningPath) {
            const pathData = allPathsData.find(p => p.name === currentRunningPath.name);
            if (pathData) {
              removeRunningPathVisualization();
              visualizeRunningPath(pathData);
              startPulseAnimation();
            }
          }
        }, 100);
      };
    }

    const originalLoadData = window.__viz?.loadData;
    if (originalLoadData) {
      window.__viz.loadData = async function () {
        await originalLoadData.call(this);
        loadPathsIntoDropdown();
      };
    }
  }

  // ---------- CSS Styles ----------
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .running-path-overlay {
        z-index: 10;
      }
      
      .pulse-trail {
        z-index: 9;
      }
      
      .pulse-marker {
        z-index: 20;
        pointer-events: none;
        animation: pulseGlow 1s ease-in-out infinite alternate;
      }
      
      @keyframes pulseGlow {
        from {
          filter: drop-shadow(0 0 8px #f85422ff);
        }
        to {
          filter: drop-shadow(0 0 16px #ff7d49ff);
        }
      }
      
      .animator-controls button {
        background: var(--panel);
        border: 1px solid rgba(11, 17, 28, 0.06);
        color: var(--text);
        padding: 6px 8px;
        border-radius: 8px;
        box-shadow: var(--shadow);
        cursor: pointer;
        font-size: 12px;
      }
      
      .animator-controls button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .animator-controls select {
        background: var(--panel);
        border: 1px solid rgba(11, 17, 28, 0.06);
        color: var(--text);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- Initialize ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 1500);
    });
  } else {
    setTimeout(init, 1500);
  }

  addStyles();

  // Export for external control
  window.__pathAnimator = {
    startPath: (pathName) => {
      const pathData = allPathsData.find(p => p.name === pathName);
      return startPath(pathName, pathData);
    },
    stopPath: stopCurrentPath,
    getCurrentPath: () => currentRunningPath,
    refreshPaths: loadPathsIntoDropdown
  };
})();