// public/context-menu.js - Right-click context menu for available points
(() => {
  console.log('Context menu module loading...');
  
  // Wait for enhanced-viz to initialize
  const MAX_WAIT_TIME = 5000; // 5 seconds max
  const POLL_INTERVAL = 100; // Check every 100ms
  
  let checkCount = 0;
  
  const waitForEnhancedViz = setInterval(() => {
    checkCount++;
    
    // Check if enhanced-viz is loaded
    if (window.__enhancedViz) {
      clearInterval(waitForEnhancedViz);
      console.log('Enhanced-viz detected, initializing context menu...');
      init();
    } 
    // Check if we've waited too long
    else if (checkCount * POLL_INTERVAL > MAX_WAIT_TIME) {
      clearInterval(waitForEnhancedViz);
      console.warn('Enhanced-viz not found, initializing standalone context menu...');
      initStandalone();
    }
  }, POLL_INTERVAL);
  
  // State
  let contextMenu = null;
  let selectedPointForContext = null;
  let currentPositionData = null;
  let availablePathsData = [];
  let availablePointsData = [];
  let matchedPointsData = [];
  
  // Colors
  const colors = {
    availablePoint: '#40c734ff',
    currentPoint: '#30cfffff',
    selectedPath: '#FF6B6B'
  };
  
  // ---------- Initialization ----------
  function init() {
    console.log('Context menu initializing...');
    
    // Get data from enhanced-viz if available
    if (window.__enhancedViz) {
      console.log('Using enhanced-viz data source');
      // We'll update this data when enhanced-viz updates
      setupDataSync();
    }
    
    // Create UI elements
    createContextMenu();
    addEventListeners();
    addStyles();
    
    console.log('Context menu ready. Right-click on available points (green/cyan) for options.');
  }
  
  function initStandalone() {
    console.log('Initializing standalone context menu...');
    
    // Create UI elements
    createContextMenu();
    addEventListeners();
    addStyles();
    
    // Try to load data directly
    loadDataDirectly();
    
    console.log('Standalone context menu ready.');
  }
  
  // ---------- Data Management ----------
  function setupDataSync() {
    // Override enhanced-viz's update function to sync data
    const originalUpdate = window.__enhancedViz.updateCurrentPosition;
    if (originalUpdate) {
      window.__enhancedViz.updateCurrentPosition = async function() {
        const result = await originalUpdate.apply(this, arguments);
        syncDataFromEnhancedViz();
        return result;
      };
    }
    
    // Also sync when enhanced-viz applies visual enhancements
    const originalApply = window.__enhancedViz.applyVisualEnhancements;
    if (originalApply) {
      window.__enhancedViz.applyVisualEnhancements = function() {
        const result = originalApply.apply(this, arguments);
        syncDataFromEnhancedViz();
        updatePointAvailability();
        return result;
      };
    }
    
    // Initial sync
    setTimeout(syncDataFromEnhancedViz, 1000);
  }
  
  function syncDataFromEnhancedViz() {
    // This function would extract data from enhanced-viz's internal state
    // Since we can't access its private variables, we'll use a different approach
    
    // Instead, we'll query the DOM to see which points are highlighted
    updatePointAvailability();
  }
  
  function updatePointAvailability() {
    // Scan the DOM for highlighted points
    const nodes = document.querySelectorAll('.node');
    
    nodes.forEach(node => {
      const rect = node.querySelector('.point-rect');
      if (rect) {
        const fillColor = rect.style.fill || '';
        
        // Check if point is available (green) or current (cyan)
        if (fillColor.includes('40c734') || fillColor.includes('#40c734') || 
            fillColor.includes('30cfff') || fillColor.includes('#30cfff')) {
          node.setAttribute('data-context-available', 'true');
          node.style.cursor = 'context-menu';
        } else {
          node.setAttribute('data-context-available', 'false');
          node.style.cursor = '';
        }
      }
    });
  }
  
  async function loadDataDirectly() {
    try {
      const tolerance = document.getElementById('tolerance')?.value || 0.0001;
      
      // Load current position and available paths
      const [whereRes, availableRes] = await Promise.all([
        fetch(`/pose/whereami?tolerance=${encodeURIComponent(tolerance)}`),
        fetch(`/pose/available_from_current?tolerance=${encodeURIComponent(tolerance)}`)
      ]);
      
      const whereData = await whereRes.json();
      const availableData = await availableRes.json();
      
      // Update our state
      matchedPointsData = whereData.matched ? (whereData.points || []) : [];
      availablePathsData = availableData.matched ? (availableData.merged_available_paths || []) : [];
      availablePointsData = availableData.matched ? (availableData.unique_available_points || []) : [];
      
      console.log(`Loaded ${matchedPointsData.length} matched points, ${availablePointsData.length} available points, ${availablePathsData.length} available paths`);
      
      // Update point availability in DOM
      updatePointAvailabilityDirect();
      
    } catch (error) {
      console.error('Error loading context menu data:', error);
    }
  }
  
  function updatePointAvailabilityDirect() {
    const allAvailablePoints = [...matchedPointsData, ...availablePointsData];
    
    const nodes = document.querySelectorAll('.node');
    nodes.forEach(node => {
      const pointName = node.dataset.name;
      if (pointName && allAvailablePoints.includes(pointName)) {
        node.setAttribute('data-context-available', 'true');
        node.style.cursor = 'context-menu';
        
        // Add subtle indicator
        addAvailabilityIndicator(node, pointName);
      } else {
        node.setAttribute('data-context-available', 'false');
        node.style.cursor = '';
        removeAvailabilityIndicator(node);
      }
    });
  }
  
  function addAvailabilityIndicator(node, pointName) {
    // Remove existing indicator
    removeAvailabilityIndicator(node);
    
    // Add new indicator
    const isCurrent = matchedPointsData.includes(pointName);
    const color = isCurrent ? colors.currentPoint : colors.availablePoint;
    
    const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    indicator.setAttribute('cx', '45');
    indicator.setAttribute('cy', '0');
    indicator.setAttribute('r', '4');
    indicator.setAttribute('fill', color);
    indicator.setAttribute('class', 'context-available-indicator');
    indicator.style.pointerEvents = 'none';
    
    node.appendChild(indicator);
  }
  
  function removeAvailabilityIndicator(node) {
    const indicator = node.querySelector('.context-available-indicator');
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }
  
  // ---------- Context Menu UI ----------
  function createContextMenu() {
    // Remove existing menu if any
    const existingMenu = document.getElementById('point-context-menu');
    if (existingMenu && existingMenu.parentNode) {
      existingMenu.parentNode.removeChild(existingMenu);
    }
    
    // Create new context menu
    contextMenu = document.createElement('div');
    contextMenu.id = 'point-context-menu';
    contextMenu.className = 'context-menu';
    contextMenu.style.cssText = `
      position: fixed;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      padding: 8px 0;
      min-width: 240px;
      z-index: 10000;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial;
      font-size: 13px;
      overflow: hidden;
    `;
    
    // Go to point option
    const goToItem = createMenuItem('▶ Go to this point', '#007AFF', executeGoToPoint);
    goToItem.id = 'context-go-to-item';
    
    // Path info
    const pathInfo = document.createElement('div');
    pathInfo.id = 'context-path-info';
    pathInfo.style.cssText = `
      padding: 6px 16px;
      font-size: 11px;
      color: #666;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      margin-top: 4px;
    `;
    
    // Point info
    const pointInfo = document.createElement('div');
    pointInfo.id = 'context-point-info';
    pointInfo.style.cssText = `
      padding: 6px 16px;
      font-size: 11px;
      color: #888;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    `;
    
    contextMenu.appendChild(goToItem);
    contextMenu.appendChild(pathInfo);
    contextMenu.appendChild(pointInfo);
    
    document.body.appendChild(contextMenu);
  }
  
  function createMenuItem(text, color, clickHandler) {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.style.cssText = `
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 10px;
      user-select: none;
    `;
    
    item.innerHTML = `
      <span style="color: ${color}; font-size: 14px;">▶</span>
      <span>${text}</span>
    `;
    
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      clickHandler();
    });
    
    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(0, 122, 255, 0.08)';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.background = '';
    });
    
    return item;
  }
  
  // ---------- Context Menu Logic ----------
  function showContextMenu(pointName, event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Check if point is available
    const node = document.querySelector(`.node[data-name="${pointName}"]`);
    if (!node || node.getAttribute('data-context-available') !== 'true') {
      console.log(`Point ${pointName} is not available for context menu`);
      return;
    }
    
    selectedPointForContext = pointName;
    
    // Find paths to this point
    const paths = findPathsToPoint(pointName);
    
    if (paths.length === 0) {
      console.warn(`No path found to point: ${pointName}`);
      // Disable the menu item
      const goToItem = document.getElementById('context-go-to-item');
      if (goToItem) {
        goToItem.style.opacity = '0.5';
        goToItem.style.cursor = 'not-allowed';
        goToItem.onclick = null;
      }
    } else {
      // Enable the menu item
      const goToItem = document.getElementById('context-go-to-item');
      if (goToItem) {
        goToItem.style.opacity = '1';
        goToItem.style.cursor = 'pointer';
        goToItem.onclick = () => executeGoToPoint();
      }
      
      // Update path info
      const bestPath = paths[0];
      const pathInfo = document.getElementById('context-path-info');
      const pointInfo = document.getElementById('context-point-info');
      
      if (pathInfo && pointInfo) {
        const pathName = bestPath.name || `${bestPath.start_point}_${bestPath.end_point}`;
        const isReverse = bestPath.is_reverse;
        
        pathInfo.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 2px;">${pathName}</div>
          <div style="color: #888;">
            ${bestPath.start_point} ${isReverse ? '←' : '→'} ${bestPath.end_point}
            ${isReverse ? ' (reverse)' : ''}
          </div>
        `;
        
        pointInfo.textContent = `Target point: ${pointName}`;
      }
    }
    
    // Position menu (avoid going off-screen)
    const menuWidth = 240;
    const menuHeight = 120;
    let left = event.clientX;
    let top = event.clientY;
    
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }
    
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 10;
    }
    
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.display = 'block';
    
    // Close menu when clicking elsewhere
    setTimeout(() => {
      const closeHandler = (e) => {
        if (contextMenu && !contextMenu.contains(e.target)) {
          hideContextMenu();
          document.removeEventListener('click', closeHandler);
          document.removeEventListener('contextmenu', closeHandler);
        }
      };
      
      document.addEventListener('click', closeHandler);
      document.addEventListener('contextmenu', closeHandler);
    }, 10);
  }
  
  function hideContextMenu() {
    if (contextMenu) {
      contextMenu.style.display = 'none';
      selectedPointForContext = null;
    }
  }
  
  function findPathsToPoint(targetPoint) {
    const paths = [];
    
    // First, check if we have direct data
    if (availablePathsData.length > 0) {
      // Find paths from current position to target
      const fromPoints = matchedPointsData.length > 0 ? matchedPointsData : availablePointsData;
      
      fromPoints.forEach(startPoint => {
        // Forward paths
        const forwardPaths = availablePathsData.filter(p => 
          p.start_point === startPoint && p.end_point === targetPoint
        );
        
        // Reverse paths
        const reversePaths = availablePathsData.filter(p =>
          p.end_point === startPoint && p.start_point === targetPoint
        ).map(p => ({ ...p, is_reverse: true }));
        
        paths.push(...forwardPaths, ...reversePaths);
      });
    } else {
      // Fallback: check DOM for highlighted paths
      // This is less accurate but works as a fallback
      console.log('Using fallback path detection');
    }
    
    return paths;
  }
  
  function executeGoToPoint() {
    if (!selectedPointForContext) {
      console.log('No point selected');
      return;
    }
    
    const paths = findPathsToPoint(selectedPointForContext);
    
    if (paths.length === 0) {
      console.error(`No path found to point: ${selectedPointForContext}`);
      alert(`No available path found to reach ${selectedPointForContext}`);
      return;
    }
    
    const bestPath = paths[0];
    const pathName = bestPath.name || `${bestPath.start_point}_${bestPath.end_point}`;
    
    // Log to console
    console.log(`%cRunning path: ${pathName}`, 
      'color: #007AFF; font-weight: bold; font-size: 14px;');
    console.log(`From: ${bestPath.start_point} → To: ${bestPath.end_point}`);
    if (bestPath.is_reverse) {
      console.log('Note: This is a reverse path');
    }
    
    // Visual feedback
    highlightSelectedPath(bestPath);
    
    // You can uncomment this to actually start the path:
    /*
    fetch(`/pose/start_path/${encodeURIComponent(pathName)}`, {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`API: Started path: ${pathName}`);
      }
    })
    .catch(error => {
      console.error('Error starting path:', error);
    });
    */
    
    hideContextMenu();
  }
  
  function highlightSelectedPath(path) {
    // Remove any existing highlights
    document.querySelectorAll('.context-selected-path').forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    
    // Find the SVG path element
    const pathSelector = `.path-line[data-start="${path.start_point}"][data-end="${path.end_point}"]`;
    const reverseSelector = `.path-line[data-start="${path.end_point}"][data-end="${path.start_point}"]`;
    
    const originalPath = document.querySelector(pathSelector) || document.querySelector(reverseSelector);
    if (!originalPath) {
      console.warn('Could not find path element for highlighting');
      return;
    }
    
    const d = originalPath.getAttribute('d');
    if (!d) return;
    
    // Create highlight overlay
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    overlay.setAttribute('d', d);
    overlay.classList.add('context-selected-path');
    overlay.style.cssText = `
      stroke: ${colors.selectedPath};
      stroke-width: 8px;
      opacity: 0.8;
      fill: none;
      stroke-linecap: round;
      stroke-dasharray: 10, 5;
      pointer-events: none;
      filter: drop-shadow(0 0 10px ${colors.selectedPath});
      animation: contextPathPulse 1.5s ease-in-out infinite;
    `;
    
    // Add to SVG
    const root = document.getElementById('root');
    if (root) {
      root.appendChild(overlay);
      
      // Remove highlight after 5 seconds
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 5000);
    }
  }
  
  // ---------- Event Listeners ----------
  function addEventListeners() {
    // Right-click on points
    document.addEventListener('contextmenu', (e) => {
      const node = e.target.closest('.node');
      if (node) {
        const pointName = node.dataset.name;
        if (pointName && node.getAttribute('data-context-available') === 'true') {
          showContextMenu(pointName, e);
        }
      }
    });
    
    // Long press on touch devices
    let touchTimer;
    document.addEventListener('touchstart', (e) => {
      const node = e.target.closest('.node');
      if (node) {
        const pointName = node.dataset.name;
        if (pointName && node.getAttribute('data-context-available') === 'true') {
          touchTimer = setTimeout(() => {
            showContextMenu(pointName, {
              preventDefault: () => {},
              stopPropagation: () => {},
              clientX: e.touches[0].clientX,
              clientY: e.touches[0].clientY
            });
          }, 600); // 600ms long press
        }
      }
    });
    
    document.addEventListener('touchend', () => {
      clearTimeout(touchTimer);
    });
    
    document.addEventListener('touchmove', () => {
      clearTimeout(touchTimer);
    });
    
    // ESC key closes menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    });
  }
  
  // ---------- Styles ----------
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Context menu animations */
      @keyframes contextPathPulse {
        0% {
          opacity: 0.6;
          stroke-dashoffset: 0;
        }
        50% {
          opacity: 0.9;
        }
        100% {
          opacity: 0.6;
          stroke-dashoffset: -15;
        }
      }
      
      /* Point cursor */
      .node[data-context-available="true"] {
        cursor: context-menu;
      }
      
      /* Context menu item hover */
      .context-menu-item:hover {
        background: rgba(0, 122, 255, 0.08) !important;
      }
      
      /* Availability indicator animation */
      .context-available-indicator {
        animation: contextIndicatorPulse 2s ease-in-out infinite;
      }
      
      @keyframes contextIndicatorPulse {
        0%, 100% {
          r: 4;
          opacity: 0.8;
        }
        50% {
          r: 5;
          opacity: 1;
        }
      }
      
      /* Tooltip for available points */
      .node[data-context-available="true"]:hover::after {
        content: "Right-click for options";
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
        transform: translate(50px, -20px);
      }
    `;
    document.head.appendChild(style);
  }
  
  // ---------- Public API ----------
  window.__contextMenu = {
    showMenu: showContextMenu,
    hideMenu: hideContextMenu,
    executeGoTo: executeGoToPoint,
    refreshData: loadDataDirectly,
    updateAvailability: updatePointAvailabilityDirect
  };
  
  console.log('Context menu module loaded successfully.');
})();