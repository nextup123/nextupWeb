// public/enhanced-viz.js - Enhanced visualization with current position and available paths
(() => {
  // API endpoints
  const API_CURRENT = '/pose/current';
  const API_WHEREAMI = '/pose/whereami';
  const API_AVAILABLE = '/pose/available_from_current';
  const API_MATCH_POINT = '/pose/match_point/';
  const API_DEBUG = '/pose/debug/distances';

  // State
  let currentPosition = null;
  let matchedPoints = [];
  let availablePaths = [];
  let availablePoints = [];
  let distances = [];
  let updateInterval = null;
  let autoUpdate = true;

  // Color scheme for visualization
  const colors = {
    currentPoint: '#30cfffff',
    matchedPoint: '#ff9500',
    availablePoint: '#40c734ff',
    availablePathOverlay: 'rgba(31, 255, 162, 0.7)',
    highlightPathOverlay: 'rgba(255, 214, 10, 0.7)',
    defaultNode: '#ffffff',
  };

  // ---------- DOM Elements ----------
  let statusPanel = null;
  let toggleAutoBtn = null;
  let refreshBtn = null;
  let highlightModeSelect = null;
  let showDistancesCheckbox = null;

  // ---------- Initialization ----------
  function init() {
    console.log('Enhanced visualization initializing...');
    createUIControls();
    startAutoUpdate();
    listenForRenderEvents();
    console.log('Enhanced visualization ready.');
  }

  // ---------- UI Controls ----------
  function createUIControls() {
    const header = document.querySelector('header');
    if (!header) return;

    const enhancedControls = document.createElement('div');
    enhancedControls.className = 'enhanced-controls';
    enhancedControls.style.display = 'flex';
    enhancedControls.style.gap = '8px';
    enhancedControls.style.alignItems = 'center';
    enhancedControls.style.marginLeft = '20px';
    enhancedControls.style.paddingLeft = '20px';
    enhancedControls.style.borderLeft = '1px solid rgba(0,0,0,0.1)';

    // Auto-update toggle
    toggleAutoBtn = document.createElement('button');
    toggleAutoBtn.textContent = '⏸ Auto-update';
    toggleAutoBtn.title = 'Toggle automatic position updates';
    toggleAutoBtn.addEventListener('click', toggleAutoUpdate);

    // Manual refresh button
    refreshBtn = document.createElement('button');
    refreshBtn.textContent = '⟳ Refresh';
    refreshBtn.title = 'Update current position';
    refreshBtn.addEventListener('click', updateCurrentPosition);

  


    // Assemble controls
    enhancedControls.appendChild(toggleAutoBtn);
    enhancedControls.appendChild(refreshBtn);

    // Insert after existing controls
    const existingControls = header.querySelector('.controls');
    if (existingControls) {
      header.insertBefore(enhancedControls, existingControls.nextSibling);
    } else {
      header.appendChild(enhancedControls);
    }

    // Create status panel in sidebar
    // createStatusPanel();
  }


  // ---------- Data Fetching ----------
  async function updateCurrentPosition() {
    try {
      const tolerance = document.getElementById('tolerance')?.value || 0.0001;

      // Fetch current position and available paths
      const [currentRes, whereRes, availableRes] = await Promise.all([
        fetch(API_CURRENT),
        fetch(`${API_WHEREAMI}?tolerance=${encodeURIComponent(tolerance)}`),
        fetch(`${API_AVAILABLE}?tolerance=${encodeURIComponent(tolerance)}`)
      ]);

      const currentData = await currentRes.json();
      const whereData = await whereRes.json();
      const availableData = await availableRes.json();

      // Update state
      currentPosition = currentData.latest;
      matchedPoints = whereData.matched ? (whereData.points || []) : [];
      availablePaths = availableData.matched ? (availableData.merged_available_paths || []) : [];
      availablePoints = availableData.matched ? (availableData.unique_available_points || []) : [];

      // Update UI
      updateStatusPanel();

      // Apply visual enhancements
      applyVisualEnhancements();

      if (!autoUpdate) {
        setTimeout(() => {
          removeVisualEnhancements();
        }, 5000); // Remove highlights after 5 seconds
      }

    } catch (error) {
      console.error('Error updating current position:', error);
      updateStatusError();
    }
  }

  // ---------- Visual Enhancements ----------
  function applyVisualEnhancements() {
    // First remove any existing enhancements
    removeVisualEnhancements();

    if (!currentPosition || matchedPoints.length === 0) {
      return;
    }

    const highlightMode = highlightModeSelect?.value || 'all';

    // Highlight matched points
    matchedPoints.forEach(pointName => {
      highlightPoint(pointName, 'current');
    });

    if (highlightMode === 'none') {
      return;
    }

    // Highlight available points (if mode is 'all' or 'points')
    if (highlightMode === 'all' || highlightMode === 'points') {
      availablePoints.forEach(pointName => {
        if (!matchedPoints.includes(pointName)) {
          highlightPoint(pointName, 'available');
        }
      });
    }

    // Highlight available paths (if mode is 'all' or 'paths')
    if (highlightMode === 'all' || highlightMode === 'paths') {
      highlightAvailablePaths();
    }

    // Show distance labels if enabled
    if (showDistancesCheckbox?.checked) {
      showDistanceLabels();
    }
  }

  function removeVisualEnhancements() {
    // Remove point highlights
    const nodes = document.querySelectorAll('.node');
    nodes.forEach(node => {
      const rect = node.querySelector('.point-rect');
      if (rect) {
        rect.style.fill = '';
        rect.style.stroke = '';
        rect.style.strokeWidth = '';
        rect.style.filter = '';
      }
    });

    // Remove path overlays
    const overlays = document.querySelectorAll('.path-overlay');
    overlays.forEach(overlay => overlay.remove());

    // Remove distance labels
    const distanceLabels = document.querySelectorAll('.distance-label');
    distanceLabels.forEach(label => label.remove());
  }

  function highlightPoint(pointName, type) {
    const node = document.querySelector(`.node[data-name="${pointName}"]`);
    if (!node) return;

    const rect = node.querySelector('.point-rect');
    if (!rect) return;

    switch (type) {
      case 'current':
        rect.style.fill = colors.currentPoint;
        rect.style.stroke = 'rgba(0,0,0,0.3)';
        rect.style.strokeWidth = '2px';
        rect.style.filter = 'drop-shadow(0 0 8px rgba(48, 207, 255, 0.6))';
        break;
      case 'available':
        rect.style.fill = colors.availablePoint;
        rect.style.stroke = 'rgba(0,0,0,0.2)';
        rect.style.strokeWidth = '1.5px';
        rect.style.filter = 'drop-shadow(0 0 6px rgba(64, 199, 52, 0.4))';
        break;
    }
  }

  function highlightAvailablePaths() {
    // Instead of modifying existing paths, create semi-transparent overlays
    availablePaths.forEach(path => {
      createPathOverlay(path, 'available');
    });
  }

  function createPathOverlay(path, type) {
    // Find existing path element
    const pathSelector = `.path-line[data-start="${path.start_point}"][data-end="${path.end_point}"]`;
    const reverseSelector = `.path-line[data-start="${path.end_point}"][data-end="${path.start_point}"]`;

    const originalPath = document.querySelector(pathSelector) || document.querySelector(reverseSelector);
    if (!originalPath) return;

    // Get the path data
    const d = originalPath.getAttribute('d');
    if (!d) return;

    // Create overlay path
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    overlay.setAttribute('d', d);
    overlay.classList.add('path-overlay');

    // Style the overlay based on type
    switch (type) {
      case 'available':
        overlay.style.stroke = colors.availablePathOverlay;
        overlay.style.strokeWidth = '6px'; // Slightly thicker to stand out
        overlay.style.opacity = '0.4'; // More transparent
        overlay.style.fill = 'none';
        overlay.style.strokeLinecap = 'round';
        overlay.style.pointerEvents = 'none'; // Don't interfere with hover
        overlay.style.filter = 'none'; // Remove drop shadow to avoid visual clutter
        break;
    }

    // Get the root element and ensure we insert in correct order
    const root = document.getElementById('root');
    if (!root) return;

    // Find the paths group in the root
    let pathsGroup = root.querySelector('g');
    if (!pathsGroup) return;

    // We want to insert the overlay into the paths group but before the points
    // So find where to insert it - after the last path but before points
    const allPaths = Array.from(pathsGroup.querySelectorAll('.path-line'));
    if (allPaths.length > 0) {
      // Insert after the last path element
      const lastPath = allPaths[allPaths.length - 1];
      if (lastPath.nextSibling) {
        pathsGroup.insertBefore(overlay, lastPath.nextSibling);
      } else {
        pathsGroup.appendChild(overlay);
      }
    } else {
      // Just append to paths group
      pathsGroup.appendChild(overlay);
    }
  }

  // ---------- Distance Visualization ----------
  function showDistanceLabels() {
    // This would require fetching debug distance data
    fetch(API_DEBUG)
      .then(response => response.json())
      .then(data => {
        distances = data.report || [];
        renderDistanceLabels();
      })
      .catch(error => {
        console.error('Error fetching distances:', error);
      });
  }

  function renderDistanceLabels() {
    // Remove existing labels
    document.querySelectorAll('.distance-label').forEach(label => label.remove());

    distances.forEach(item => {
      if (!item.valid || item.max_abs === null) return;

      const node = document.querySelector(`.node[data-name="${item.name}"]`);
      if (!node) return;

      // Get node position
      const transform = node.getAttribute('transform');
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (!match) return;

      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);

      // Create distance label
      const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelGroup.setAttribute('class', 'distance-label');
      labelGroup.setAttribute('transform', `translate(${x}, ${y + 35})`);

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -25);
      rect.setAttribute('y', -10);
      rect.setAttribute('width', 50);
      rect.setAttribute('height', 20);
      rect.setAttribute('rx', 4);
      rect.setAttribute('ry', 4);
      rect.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
      rect.setAttribute('stroke', 'rgba(0, 0, 0, 0.1)');
      rect.setAttribute('stroke-width', '0.5');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '10px');
      text.setAttribute('fill', '#333');
      text.textContent = item.max_abs.toFixed(4);

      labelGroup.appendChild(rect);
      labelGroup.appendChild(text);

      const root = document.getElementById('root');
      if (root) {
        // Insert before points so labels are under points
        root.appendChild(labelGroup);
      }
    });
  }

  function toggleDistanceDisplay() {
    if (showDistancesCheckbox?.checked) {
      showDistanceLabels();
    } else {
      document.querySelectorAll('.distance-label').forEach(label => label.remove());
    }
  }

  // ---------- UI Updates ----------
  function updateStatusPanel() {
    if (!statusPanel) return;

    const currentStatus = statusPanel.querySelector('#currentStatus');
    const matchedPointsEl = statusPanel.querySelector('#matchedPoints');
    const availableInfo = statusPanel.querySelector('#availableInfo');
    const distanceInfo = statusPanel.querySelector('#distanceInfo');

    if (!currentPosition) {
      currentStatus.innerHTML = '<span style="color: #ff3b30">No position data</span>';
      matchedPointsEl.innerHTML = '';
      availableInfo.innerHTML = '';
      distanceInfo.innerHTML = '';
      return;
    }

    // Current position
    const joints = currentPosition.position || [];
    const jointStr = joints.map(j => j.toFixed(6)).join(', ');
    currentStatus.innerHTML = `
      <div style="font-size: 12px;">
        <div><strong>Position:</strong> [${jointStr}]</div>
        <div><strong>Timestamp:</strong> ${new Date(currentPosition.received_at).toLocaleTimeString()}</div>
      </div>
    `;

    // Matched points
    if (matchedPoints.length > 0) {
      matchedPointsEl.innerHTML = `
        <div style="font-size: 12px;">
          <div style="color: #30acffff; margin-bottom: 4px;">
            <strong>✓ At point${matchedPoints.length > 1 ? 's' : ''}:</strong>
          </div>
          <div>${matchedPoints.map(p => `<span style="background: ${colors.currentPoint}; color: white; padding: 2px 6px; border-radius: 4px; margin: 2px; display: inline-block;">${p}</span>`).join('')}</div>
        </div>
      `;
    } else {
      matchedPointsEl.innerHTML = `
        <div style="font-size: 12px; color: #ff9500;">
          <strong>ⓘ Not at any defined point</strong>
        </div>
      `;
    }

    // Available paths and points
    if (availablePaths.length > 0 || availablePoints.length > 0) {
      availableInfo.innerHTML = `
        <div style="font-size: 12px;">
          <div style="color: #34c759; margin-bottom: 4px;">
            <strong>Available from here:</strong>
          </div>
          <div style="margin-bottom: 4px;">
            <strong>Paths:</strong> ${availablePaths.length}
            ${availablePaths.length > 0 ?
          `<div style="margin-top: 2px; font-size: 11px;">
                ${availablePaths.slice(0, 3).map(p => `${p.start_point} → ${p.end_point}`).join(', ')}
                ${availablePaths.length > 3 ? `... +${availablePaths.length - 3} more` : ''}
              </div>` : ''
        }
          </div>
          <div>
            <strong>Points:</strong> ${availablePoints.length}
            ${availablePoints.length > 0 ?
          `<div style="margin-top: 2px;">
                ${availablePoints.map(p => `<span style="background: ${colors.availablePoint}; color: white; padding: 1px 4px; border-radius: 3px; margin: 1px; font-size: 10px; display: inline-block;">${p}</span>`).join('')}
              </div>` : ''
        }
          </div>
        </div>
      `;
    } else {
      availableInfo.innerHTML = `
        <div style="font-size: 12px; color: #8e8e93;">
          <strong>No available paths from current position</strong>
        </div>
      `;
    }

    // Distance info
    if (distances.length > 0 && showDistancesCheckbox?.checked) {
      const closest = distances.filter(d => d.valid).sort((a, b) => a.max_abs - b.max_abs)[0];
      if (closest) {
        distanceInfo.innerHTML = `
          <div>Closest point: <strong>${closest.name}</strong> (Δ=${closest.max_abs.toFixed(4)})</div>
        `;
      }
    }
  }

  function updateStatusError() {
    if (!statusPanel) return;

    const currentStatus = statusPanel.querySelector('#currentStatus');
    if (currentStatus) {
      currentStatus.innerHTML = '<span style="color: #ff3b30">Error fetching position data</span>';
    }
  }

  // ---------- Auto-update Management ----------
  function startAutoUpdate() {
    if (updateInterval) clearInterval(updateInterval);

    // Initial update
    updateCurrentPosition();

    // Set up periodic updates (every second)
    updateInterval = setInterval(() => {
      if (autoUpdate) {
        updateCurrentPosition();
      }
    }, 1000);

    if (toggleAutoBtn) {
      toggleAutoBtn.textContent = '⏸ Auto-update';
      toggleAutoBtn.style.color = '';
    }
  }

  function toggleAutoUpdate() {
    autoUpdate = !autoUpdate;

    if (toggleAutoBtn) {
      if (autoUpdate) {
        toggleAutoBtn.textContent = '⏸ Auto-update';
        toggleAutoBtn.style.color = '';
        startAutoUpdate();
      } else {
        toggleAutoBtn.textContent = '▶ Auto-update';
        toggleAutoBtn.style.color = '#ff3b30';
        if (updateInterval) {
          clearInterval(updateInterval);
          updateInterval = null;
        }
      }
    }
  }

  // ---------- Event Listeners ----------
  function listenForRenderEvents() {
    // Listen for main script render events
    const originalRender = window.__viz?.render;
    if (originalRender) {
      window.__viz.render = function () {
        originalRender.call(this);
        // Re-apply our enhancements after main render
        setTimeout(applyVisualEnhancements, 100);
      };
    }

    // Listen for tolerance changes
    const toleranceInput = document.getElementById('tolerance');
    if (toleranceInput) {
      toleranceInput.addEventListener('change', () => {
        if (autoUpdate) {
          updateCurrentPosition();
        }
      });
    }

    // Listen for plan space filter changes
    const planSpaceFilter = document.getElementById('planSpaceFilter');
    if (planSpaceFilter) {
      planSpaceFilter.addEventListener('change', () => {
        setTimeout(applyVisualEnhancements, 100);
      });
    }
  }

  // ---------- CSS Styles ----------
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .status-panel {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-left: 4px solid #0b84ff;
      }
      
      .enhanced-controls button {
        background: var(--panel);
        border: 1px solid rgba(11, 17, 28, 0.06);
        color: var(--text);
        padding: 6px 8px;
        border-radius: 8px;
        box-shadow: var(--shadow);
        cursor: pointer;
        font-size: 12px;
      }
      
      .enhanced-controls select {
        background: var(--panel);
        border: 1px solid rgba(11, 17, 28, 0.06);
        color: var(--text);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
      }
      
      .distance-label {
        pointer-events: none;
      }
      
      .path-overlay {
        z-index: 1; /* Lower z-index so original paths show through */
      }
    `;
    document.head.appendChild(style);
  }










  // Add this to enhanced-viz.js (replace the previous context menu code)

  // ---------- Context Menu for Available Points ----------
  let contextMenu = null;
  let selectedPointForContext = null;

  function createContextMenu() {
    // Create context menu element
    contextMenu = document.createElement('div');
    contextMenu.id = 'point-context-menu';
    contextMenu.className = 'context-menu';
    contextMenu.style.cssText = `
    position: fixed;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: 8px 0;
    min-width: 200px;
    z-index: 1000;
    display: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial;
    font-size: 13px;
  `;

    // Menu header (point name)
    const header = document.createElement('div');
    header.style.cssText = `
    padding: 8px 16px;
    font-weight: 600;
    border-bottom: 1px solid #eee;
    color: #333;
  `;
    header.id = 'context-menu-header';

    // Go to point option
    const goToItem = document.createElement('div');
    goToItem.className = 'context-menu-item';
    goToItem.style.cssText = `
    padding: 8px 16px;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
    goToItem.innerHTML = `
    <span style="color: #007AFF;">▶</span>
    <span>Go to this point</span>
  `;
    goToItem.addEventListener('click', executeGoToPoint);
    goToItem.id = 'context-menu-goto';

    // Path info
    const pathInfo = document.createElement('div');
    pathInfo.style.cssText = `
    padding: 4px 16px 8px 16px;
    font-size: 11px;
    color: #666;
    border-bottom: 1px solid #eee;
  `;
    pathInfo.id = 'context-path-info';

    // Status message (for unavailable points)
    const statusMsg = document.createElement('div');
    statusMsg.style.cssText = `
    padding: 12px 16px;
    font-size: 12px;
    color: #8B8000;
    text-align: center;
  `;
    statusMsg.id = 'context-status-msg';

    contextMenu.appendChild(header);
    contextMenu.appendChild(goToItem);
    contextMenu.appendChild(pathInfo);
    contextMenu.appendChild(statusMsg);

    document.body.appendChild(contextMenu);
  }

  function showContextMenu(pointName, event) {
    event.preventDefault();

    selectedPointForContext = pointName;

    // Find the path(s) to this point
    const pathsToPoint = findPathsToPoint(pointName);

    // Update context menu elements
    const header = document.getElementById('context-menu-header');
    const gotoItem = document.getElementById('context-menu-goto');
    const pathInfo = document.getElementById('context-path-info');
    const statusMsg = document.getElementById('context-status-msg');

    if (header) header.textContent = `Point: ${pointName}`;

    if (pathsToPoint.length > 0) {
      // Point is reachable
      const bestPath = pathsToPoint[0];
      const pathName = bestPath.name || `${bestPath.start_point}_${bestPath.end_point}`;

      if (gotoItem) {
        gotoItem.style.display = 'flex';
        gotoItem.style.opacity = '1';
        gotoItem.style.cursor = 'pointer';
      }

      if (pathInfo) {
        pathInfo.textContent = `Via: ${pathName}`;
        pathInfo.style.display = 'block';
        pathInfo.style.color = '#34c759';
      }

      if (statusMsg) {
        statusMsg.style.display = 'none';
      }
    } else {
      // Point is NOT reachable
      if (gotoItem) {
        gotoItem.style.display = 'flex';
        gotoItem.style.opacity = '0.5';
        gotoItem.style.cursor = 'not-allowed';
      }

      if (pathInfo) {
        pathInfo.textContent = 'No direct path available';
        pathInfo.style.display = 'block';
        pathInfo.style.color = '#FF3B30';
      }

      if (statusMsg) {
        statusMsg.textContent = 'This point is not reachable from current position';
        statusMsg.style.display = 'block';
      }
    }

    // Position the menu
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.display = 'block';

    // Close menu when clicking elsewhere
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!contextMenu.contains(e.target)) {
          hideContextMenu();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 10);
  }

  function hideContextMenu() {
    if (contextMenu) {
      contextMenu.style.display = 'none';
      selectedPointForContext = null;
    }
  }

  function findPathsToPoint(targetPoint) {
    // Find paths from current position to target point
    const fromPoints = matchedPoints.length > 0 ? matchedPoints : availablePoints;

    const possiblePaths = [];

    // Check each possible starting point
    fromPoints.forEach(startPoint => {
      // Find paths that go from startPoint to targetPoint
      const paths = availablePaths.filter(p =>
        p.start_point === startPoint && p.end_point === targetPoint
      );

      // Also check reverse paths
      const reversePaths = availablePaths.filter(p =>
        p.end_point === startPoint && p.start_point === targetPoint
      );

      possiblePaths.push(...paths, ...reversePaths.map(p => ({
        ...p,
        is_reverse: true
      })));
    });

    return possiblePaths;
  }


  async function executeGoToPoint() {
    const RUNPATH_BASE_URL = 'http://localhost:3003';

    if (!selectedPointForContext) return;

    // Check if point is reachable
    const paths = findPathsToPoint(selectedPointForContext);

    if (paths.length === 0) {
      console.log(`Cannot reach point: ${selectedPointForContext}`);

      const statusMsg = document.getElementById('context-status-msg');
      if (statusMsg) {
        statusMsg.textContent = 'Cannot reach this point from current position';
        statusMsg.style.color = '#FF3B30';
        statusMsg.style.display = 'block';
      }
      return;
    }

    const bestPath = paths[0];
    const pathName = bestPath.name || `${bestPath.start_point}_${bestPath.end_point}`;
    const velocity = 0.2; // default UI velocity (replace with slider value if needed)

    console.log(`Executing path: ${pathName}`);
    showNotification(`Executing path: ${pathName}`, 'info');

    hideContextMenu();

    // Build full URL (falls back to relative if RUNPATH_BASE_URL is falsy)
    const endpointPath = '/runPath/run-path-with-velocity-scale';
    const url = (RUNPATH_BASE_URL && RUNPATH_BASE_URL.trim() !== '')
      ? `${RUNPATH_BASE_URL.replace(/\/+$/, '')}${endpointPath}` // ensure no trailing slash issues
      : endpointPath;

    // small helper: fetch with timeout
    const fetchWithTimeout = (resource, options = {}, timeout = 5000) => {
      return Promise.race([
        fetch(resource, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), timeout)
        )
      ]);
    };

    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // If your backend requires credentials (cookies/auth), add credentials: 'include'
        body: JSON.stringify({ pathName, velocity })
      }, 7000); // 7s timeout

      // network-level success, now check HTTP status
      if (!response.ok) {
        // Try to parse JSON error if available
        let errBody = null;
        try { errBody = await response.json(); } catch (e) { /* ignore */ }
        const msg = errBody?.error || `HTTP ${response.status}`;
        showNotification(`Error executing path: ${msg}`, "error");
        console.error("Backend returned error", response.status, errBody);
        return;
      }

      const data = await response.json();
      console.log("Backend response:", data);

      if (data.ok) {
        showNotification(`Path executed: ${pathName}`, "success");
      } else {
        showNotification(`Error executing path: ${data.error || 'unknown'}`, "error");
      }
    } catch (err) {
      // likely network, CORS, or timeout
      console.error("API call failed:", err);

      // Common CORS symptom: TypeError: Failed to fetch (or network error). Informative message:
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('CORS'))) {
        showNotification('Network/CORS error: check server address and CORS settings', 'error');
      } else if (err.message && err.message.includes('timed out')) {
        showNotification('Request timed out', 'error');
      } else {
        showNotification('Failed to send path command', 'error');
      }
    }
  }


  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'info' ? '#ccfdabff' : '#b7ff30ff'};
    color: black;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;

    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // ---------- Add Right-Click Event Listeners ----------
  function addRightClickListeners() {
    // Listen for right-clicks on ALL point nodes
    document.addEventListener('contextmenu', (e) => {
      // Find if we clicked on a point node
      const node = e.target.closest('.node');
      if (node) {
        const pointName = node.dataset.name;
        if (pointName) {
          showContextMenu(pointName, e);
        }
      }
    });

    // Also handle touch devices (long press)
    let touchTimer;
    document.addEventListener('touchstart', (e) => {
      const node = e.target.closest('.node');
      if (node) {
        const pointName = node.dataset.name;
        if (pointName) {
          touchTimer = setTimeout(() => {
            showContextMenu(pointName, {
              preventDefault: () => { },
              clientX: e.touches[0].clientX,
              clientY: e.touches[0].clientY
            });
          }, 500); // 500ms long press
        }
      }
    });

    document.addEventListener('touchend', () => {
      clearTimeout(touchTimer);
    });

    document.addEventListener('touchmove', () => {
      clearTimeout(touchTimer);
    });
  }

  // ---------- Update Initialization ----------
  // Modify the init() function to include context menu setup
  const originalInit = init;
  init = function () {
    console.log('Enhanced visualization initializing with context menu...');
    createContextMenu();
    addRightClickListeners();
    originalInit();
  };

  // ---------- Add CSS Styles ----------
  const originalAddStyles = addStyles;
  addStyles = function () {
    originalAddStyles();

    const contextMenuStyles = document.createElement('style');
    contextMenuStyles.textContent = `
    .context-menu-item:hover {
      background: #f0f0f0;
    }
    
    .context-menu-item:active {
      background: #e0e0e0;
    }
    
    /* Visual indicator for available points */
    .node[data-available="true"] {
      cursor: pointer;
    }
    
    /* Notification animations */
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
    document.head.appendChild(contextMenuStyles);
  };

  // ---------- Update point highlighting to add data attribute ----------
  // Modify the highlightPoint function to mark available points
  const originalHighlightPoint = highlightPoint;
  highlightPoint = function (pointName, type) {
    originalHighlightPoint(pointName, type);

    // Mark the node as available for context menu
    const node = document.querySelector(`.node[data-name="${pointName}"]`);
    if (node) {
      if (type === 'available' || type === 'current') {
        node.setAttribute('data-available', 'true');
      }
    }
  };

  // ---------- Export new functions ----------
  window.__enhancedViz = {
    ...window.__enhancedViz,
    showContextMenu,
    hideContextMenu,
    findPathsToPoint,
    executeGoToPoint
  };





  // ---------- Initialize ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 1000);
    });
  } else {
    setTimeout(init, 1000);
  }

  addStyles();

  // Export for debugging
  window.__enhancedViz = {
    updateCurrentPosition,
    applyVisualEnhancements,
    removeVisualEnhancements,
    toggleAutoUpdate,
    colors
  };
})();