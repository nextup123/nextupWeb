// public/scripts.js - updated: separate curves for two-way paths + fixed label orientation
(() => {
  const API_POINTS = '/pose/points';
  const API_PATHS = '/pose/paths';
  const API_WHERE = '/pose/whereami';

  const svg = document.getElementById('viz');
  const root = document.getElementById('root');
  const gridLayer = document.getElementById('grid-layer');
  const tooltip = document.getElementById('tooltip');

  // UI elements
  const reloadBtn = document.getElementById('reloadBtn');
  const planSpaceFilter = document.getElementById('planSpaceFilter');
  const resetLayoutBtn = document.getElementById('resetLayout');
  const exportLayoutBtn = document.getElementById('exportLayout');

  const toleranceInput = document.getElementById('tolerance');



  const showGridCheckbox = document.getElementById('showGrid');
  const snapToGridCheckbox = document.getElementById('snapToGrid');
  const alignGridBtn = document.getElementById('alignGrid');

  // State
  let points = []; // { name, joints }
  let paths = [];  // { name, plan_space, start_point, end_point }
  let nodesByName = new Map();
  let layoutCache = {}; // name -> {x,y}
  let selectedNode = null;

  // view transform
  let scale = 1;
  let pan = { x: 0, y: 0 };
  const minScale = 0.35;
  const maxScale = 4;
  const scaleStep = 1.12;

  // grid & snap
  const gridSize = 40;

  // animated arrows state
  let animatedArrows = []; // { pathEl, arrowG, length, speed, offset }




  // Layout Management
  const layoutSelect = document.getElementById('layoutSelect');
  const saveLayoutBtn = document.getElementById('saveLayout');
  const loadLayoutBtn = document.getElementById('loadLayout');
  const deleteLayoutBtn = document.getElementById('deleteLayout');
  let layoutsList = [];
  const LAYOUTS_DIR = 'config/layouts';


  // ---------- Layout Management Functions ----------
  async function loadLayoutsList() {
    try {
      const response = await fetch(`/${LAYOUTS_DIR}/list`);
      layoutsList = await response.json();
      updateLayoutSelect();
    } catch (err) {
      console.warn('Could not load layouts list, using empty list');
      layoutsList = [];
    }
  }

  function updateLayoutSelect() {
    layoutSelect.innerHTML = '<option value="">No layout</option>';
    layoutsList.forEach(layout => {
      const option = document.createElement('option');
      option.value = layout.name;
      option.textContent = layout.name;
      if (layout.description) {
        option.title = layout.description;
      }
      layoutSelect.appendChild(option);
    });
  }

  function showNameInputDialog(title, defaultValue = '') {
    return new Promise((resolve) => {
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'layout-name-input';
      modal.innerHTML = `
      <h3>${title}</h3>
      <input type="text" id="layoutNameInput" value="${defaultValue}" placeholder="Layout name" autofocus>
      <div class="button-group">
        <button id="cancelLayoutName" class="icon-btn" style="margin: 0;">Cancel</button>
        <button id="confirmLayoutName" class="icon-btn" style="margin: 0; background: var(--accent-color);">OK</button>
      </div>
    `;

      document.body.appendChild(modal);

      const input = modal.querySelector('#layoutNameInput');
      const cancelBtn = modal.querySelector('#cancelLayoutName');
      const confirmBtn = modal.querySelector('#confirmLayoutName');

      input.select();

      function cleanup() {
        document.body.removeChild(modal);
      }

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      confirmBtn.addEventListener('click', () => {
        const name = input.value.trim();
        if (name) {
          cleanup();
          resolve(name);
        } else {
          input.focus();
        }
      });

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const name = input.value.trim();
          if (name) {
            cleanup();
            resolve(name);
          }
        }
      });

      // Close on escape
      document.addEventListener('keydown', function onEscape(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onEscape);
          cleanup();
          resolve(null);
        }
      });
    });
  }

  async function saveCurrentLayout() {
    const layoutName = await showNameInputDialog('Save Layout As',
      `Layout_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now().toString().slice(-4)}`);

    if (!layoutName) return;

    // Check if name already exists
    if (layoutsList.some(layout => layout.name === layoutName)) {
      if (!confirm(`Layout "${layoutName}" already exists. Overwrite?`)) {
        return;
      }
    }

    try {
      const layoutData = {
        name: layoutName,
        description: `Saved on ${new Date().toLocaleString()}`,
        timestamp: new Date().toISOString(),
        layout: layoutCache,
        viewState: {
          scale,
          pan,
          showGrid: showGridCheckbox.checked,
          snapToGrid: snapToGridCheckbox.checked
        }
      };

      const response = await fetch(`/${LAYOUTS_DIR}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutData)
      });

      if (response.ok) {
        await loadLayoutsList();
        layoutSelect.value = layoutName;
        console.log(`Layout "${layoutName}" saved successfully`);
      } else {
        throw new Error('Failed to save layout');
      }
    } catch (err) {
      console.error('Error saving layout:', err);
      alert('Failed to save layout. Check console for details.');
    }
  }

  async function loadSelectedLayout() {
    const selectedLayout = layoutSelect.value;
    if (!selectedLayout) return;

    try {
      const response = await fetch(`/${LAYOUTS_DIR}/load/${encodeURIComponent(selectedLayout)}`);
      if (!response.ok) throw new Error('Layout not found');

      const layoutData = await response.json();

      // Restore layout cache
      Object.keys(layoutData.layout).forEach(key => {
        layoutCache[key] = layoutData.layout[key];
      });

      // Restore view state if available
      if (layoutData.viewState) {
        scale = layoutData.viewState.scale || scale;
        pan = layoutData.viewState.pan || pan;
        if (layoutData.viewState.showGrid !== undefined) {
          showGridCheckbox.checked = layoutData.viewState.showGrid;
        }
        if (layoutData.viewState.snapToGrid !== undefined) {
          snapToGridCheckbox.checked = layoutData.viewState.snapToGrid;
        }
      }

      updateViewTransform();
      render();
      console.log(`Layout "${selectedLayout}" loaded successfully`);
    } catch (err) {
      console.error('Error loading layout:', err);
      alert('Failed to load layout. Check console for details.');
    }
  }

  async function deleteSelectedLayout() {
    const selectedLayout = layoutSelect.value;
    if (!selectedLayout) return;

    if (!confirm(`Delete layout "${selectedLayout}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/${LAYOUTS_DIR}/delete/${encodeURIComponent(selectedLayout)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadLayoutsList();
        layoutSelect.value = '';
        console.log(`Layout "${selectedLayout}" deleted successfully`);
      } else {
        throw new Error('Failed to delete layout');
      }
    } catch (err) {
      console.error('Error deleting layout:', err);
      alert('Failed to delete layout. Check console for details.');
    }
  }


  // ---------- helpers ----------
  function clearRoot() { while (root.firstChild) root.removeChild(root.firstChild); }
  function clearGrid() { while (gridLayer.firstChild) gridLayer.removeChild(gridLayer.firstChild); }
  function clearAnimatedArrows() {
    animatedArrows.forEach(a => {
      if (a.arrowG && a.arrowG.parentNode) a.arrowG.parentNode.removeChild(a.arrowG);
    }); animatedArrows = [];
  }
  function getOrCreateArrowsLayer() {
    let layer = svg.querySelector('#arrows-layer');
    if (!layer) {
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.setAttribute('id', 'arrows-layer');
      svg.appendChild(layer);
    }
    // sync transform when needed
    layer.setAttribute('transform', root.getAttribute('transform') || '');
    return layer;
  }

  // robust fetch CSS variable with trim and fallback
  function getColorForPlanSpace(plan_space) {
    const fallbackJoint = '#ff8d67ff';
    const fallbackCart = '#f3ac32ff';

    const jointColor = fallbackJoint;
    const cartColor = fallbackCart;

    if (plan_space === 'cart' || plan_space === 'Cartesian') return cartColor;
    if (plan_space === 'joint' || plan_space === 'Joint') return jointColor;
    // default: return accent
    return '#6b21a8';;
  }

  // ---------- robust SVG coordinate point (root local/world coords) ----------
  function svgPointFromClient(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    const rootCTM = root.getCTM();
    if (rootCTM) {
      return svgP.matrixTransform(rootCTM.inverse());
    }
    return svgP;
  }

  // ---------- grid rendering ----------
  function renderGrid() {
    clearGrid();
    if (!showGridCheckbox.checked) return;
    const size = 4000;
    for (let x = -size; x <= size; x += gridSize) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x); line.setAttribute('y1', -size);
      line.setAttribute('x2', x); line.setAttribute('y2', size);
      line.classList.add('grid-line');
      gridLayer.appendChild(line);
    }
    for (let y = -size; y <= size; y += gridSize) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', -size); line.setAttribute('y1', y);
      line.setAttribute('x2', size); line.setAttribute('y2', y);
      line.classList.add('grid-line');
      gridLayer.appendChild(line);
    }
  }

  // ---------- view transform ----------
  function updateViewTransform() {
    const tr = `translate(${pan.x},${pan.y}) scale(${scale})`;
    root.setAttribute('transform', tr);
    const arrowsLayer = svg.querySelector('#arrows-layer');
    if (arrowsLayer) arrowsLayer.setAttribute('transform', tr); // keep arrow layer in sync
    renderGrid();
  }

  // ---------- curve math ----------
  function perpUnit(dx, dy) {
    const nx = -dy;
    const ny = dx;
    const len = Math.hypot(nx, ny) || 1;
    return { ux: nx / len, uy: ny / len };
  }

  function computeCurveControlPoint(ax, ay, bx, by, offset) {
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const perp = perpUnit(bx - ax, by - ay);
    return { cx: mx + perp.ux * offset, cy: my + perp.uy * offset };
  }

  // New function to compute offset for two-way paths
  function computeTwoWayOffsets(ax, ay, bx, by, baseOffset) {
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy);

    // For two-way paths, create two curves with opposite offsets
    const offset1 = Math.max(baseOffset * 1.5, 60); // Primary offset
    const offset2 = -offset1; // Opposite offset

    return {
      forward: computeCurveControlPoint(ax, ay, bx, by, offset1),
      backward: computeCurveControlPoint(ax, ay, bx, by, offset2)
    };
  }

  // ---------- render ----------
  function render() {
    // Clear and rebuild shapes
    clearRoot();
    nodesByName.clear();
    clearAnimatedArrows();

    // ensure layout keys
    points.forEach(pt => { if (!(pt.name in layoutCache)) layoutCache[pt.name] = null; });

    // default layout if needed
    let needDefault = Object.values(layoutCache).every(v => v === null);
    if (needDefault) defaultLayout();

    // build nodes map
    points.forEach(pt => {
      const pos = layoutCache[pt.name] || { x: Math.random() * 900 + 100, y: Math.random() * 500 + 80 };
      nodesByName.set(pt.name, pos);
    });

    const filter = planSpaceFilter.value;

    // Create a map to track two-way paths
    const twoWayMap = new Map();
    paths.forEach(p => {
      const key = [p.start_point, p.end_point].sort().join('|');
      if (!twoWayMap.has(key)) {
        twoWayMap.set(key, []);
      }
      twoWayMap.get(key).push(p);
    });

    // create a group for paths (so they are under points)
    const pathsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    root.appendChild(pathsGroup);

    // Track rendered paths to avoid duplicates
    const renderedPaths = new Set();

    // draw paths (curved) and labels
    paths.forEach(p => {
      if (filter !== 'all' && p.plan_space !== filter) return;

      const pathKey = `${p.start_point}|${p.end_point}`;
      if (renderedPaths.has(pathKey)) return;
      renderedPaths.add(pathKey);

      const a = nodesByName.get(p.start_point) || { x: 0, y: 0 };
      const b = nodesByName.get(p.end_point) || { x: 0, y: 0 };
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const baseOffset = Math.min(120, Math.max(30, dist * 0.12));

      // Check if this is a two-way path
      const reverseKey = `${p.end_point}|${p.start_point}`;
      const hasReverse = renderedPaths.has(reverseKey) || paths.some(path =>
        path.start_point === p.end_point && path.end_point === p.start_point
      );

      // color (robust)
      const color = getColorForPlanSpace(p.plan_space);

      if (hasReverse) {
        // Two-way path - draw two curves
        const offsets = computeTwoWayOffsets(a.x, a.y, b.x, b.y, baseOffset);

        // Forward curve (start -> end)
        const dForward = `M ${a.x} ${a.y} Q ${offsets.forward.cx} ${offsets.forward.cy} ${b.x} ${b.y}`;
        const pathElForward = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElForward.setAttribute('d', dForward);
        pathElForward.classList.add('path-line');
        pathElForward.classList.add('two-way');
        pathElForward.style.stroke = color;
        pathElForward.style.pointerEvents = 'stroke';
        pathElForward.dataset.pathName = p.name || '';
        pathElForward.dataset.planSpace = p.plan_space || '';
        pathElForward.dataset.start = p.start_point;
        pathElForward.dataset.end = p.end_point;
        pathsGroup.appendChild(pathElForward);

        // Backward curve (end -> start) - slightly different style
        const dBackward = `M ${b.x} ${b.y} Q ${offsets.backward.cx} ${offsets.backward.cy} ${a.x} ${a.y}`;

        const pathElBackward = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElBackward.setAttribute('d', dBackward);
        pathElBackward.classList.add('path-line');
        pathElBackward.classList.add('two-way');
        pathElBackward.style.stroke = color;
        pathElBackward.style.strokeDasharray = '5, 9';
        pathElBackward.style.pointerEvents = 'stroke';
        pathElBackward.dataset.pathName = p.name || '';
        pathElBackward.dataset.planSpace = p.plan_space || '';
        pathElBackward.dataset.start = p.end_point;
        pathElBackward.dataset.end = p.start_point;
        pathsGroup.appendChild(pathElBackward);

        // Add event listeners and labels for both curves
        [pathElForward, pathElBackward].forEach((pathEl, idx) => {
          const direction = idx === 0 ? '→' : '←';
          pathEl.addEventListener('mousemove', (ev) => showTooltip(ev,
            `Path: ${p.name || '-'}\n${p.start_point} ${direction} ${p.end_point}\nplan_space: ${p.plan_space}\n(two-way)`));
          pathEl.addEventListener('mouseleave', hideTooltip);

          // Label only on forward curve
          if (idx === 0) {
            createLabelForPath(pathEl, p.name || '', color);
          }

          // Animated arrows for both directions - use the CURRENT pathEl
          createAnimatedArrowForPath(pathEl, p.plan_space); // <-- Changed from pathElForward to pathEl
        });
      } else {
        // One-way path
        const offset = -Math.max(40, baseOffset * 0.4);
        const cp = computeCurveControlPoint(a.x, a.y, b.x, b.y, offset);
        const d = `M ${a.x} ${a.y} Q ${cp.cx} ${cp.cy} ${b.x} ${b.y}`;
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', d);
        pathEl.classList.add('path-line');
        pathEl.style.stroke = color;
        pathEl.style.pointerEvents = 'stroke';
        pathEl.dataset.pathName = p.name || '';
        pathEl.dataset.planSpace = p.plan_space || '';
        pathEl.dataset.start = p.start_point;
        pathEl.dataset.end = p.end_point;
        pathsGroup.appendChild(pathEl);

        pathEl.addEventListener('mousemove', (ev) => showTooltip(ev,
          `Path: ${p.name || '-'}\n${p.start_point} → ${p.end_point}\nplan_space: ${p.plan_space}`));
        pathEl.addEventListener('mouseleave', hideTooltip);

        createLabelForPath(pathEl, p.name || '', color);
        createAnimatedArrowForPath(pathEl, p.plan_space);
      }
    });

    // draw points on top of paths
    const pointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    root.appendChild(pointsGroup);

    points.forEach(pt => {
      const pos = nodesByName.get(pt.name);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'node');
      g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
      g.dataset.name = pt.name;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -62);
      rect.setAttribute('y', -20);
      rect.setAttribute('width', 124);
      rect.setAttribute('height', 40);
      rect.setAttribute('class', 'point-rect');
      g.appendChild(rect);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('class', 'point-label');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('alignment-baseline', 'middle');
      label.textContent = pt.name;
      g.appendChild(label);

      // add events
      g.addEventListener('mousedown', startDrag);
      g.addEventListener('touchstart', startDrag, { passive: false });
      g.addEventListener('mousemove', (ev) => showTooltip(ev,
        `Point: ${pt.name}\njoints: ${pt.joints && pt.joints.length ? pt.joints.map(v => Number(v).toFixed(6)).join(', ') : '-'}`));
      g.addEventListener('mouseleave', hideTooltip);

      pointsGroup.appendChild(g);
    });

    // animated arrows use animatedArrows array; start RAF if entries exist
    if (animatedArrows.length > 0) {
      startAnimationLoop();
    }

    // renderSideLists();
  }

  // ---------- improved label positioning ----------
  function createLabelForPath(pathEl, text, color) {
    // compute midpoint length
    let length = 0;
    try { length = pathEl.getTotalLength(); } catch (e) { return; }
    const mid = length / 2;

    // get point at midpoint
    const p = safeGetPointAtLength(pathEl, mid);
    if (!p) return;

    // get tangent at midpoint for orientation
    const before = safeGetPointAtLength(pathEl, Math.max(0, mid - 0.01));
    const after = safeGetPointAtLength(pathEl, Math.min(length, mid + 0.01));
    if (!before || !after) return;

    const tx = after.x - before.x;
    const ty = after.y - before.y;
    const angle = Math.atan2(ty, tx) * 180 / Math.PI;

    // Determine if label should be flipped to avoid upside-down text
    // Keep angle between -90 and 90 degrees for readability
    let displayAngle = angle;
    if (displayAngle > 90) displayAngle -= 180;
    if (displayAngle < -90) displayAngle += 180;

    // compute perpendicular offset
    const perp = perpUnit(tx, ty);
    const offset = 16; // px offset from curve

    // Place label on the "outside" of curves
    const labelX = p.x + perp.ux * offset;
    const labelY = p.y + perp.uy * offset;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${labelX},${labelY}) rotate(${displayAngle})`);
    g.style.pointerEvents = 'none';

    // Create background first for better visibility
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', 'path-label');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('fill', color);
    t.textContent = text || 'path';

    g.appendChild(t);
    root.appendChild(g);

    // Add background rectangle after measuring text
    try {
      const bbox = t.getBBox();
      const padding = 4;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', bbox.x - padding);
      rect.setAttribute('y', bbox.y - padding);
      rect.setAttribute('width', bbox.width + padding * 2);
      rect.setAttribute('height', bbox.height + padding * 2);
      rect.setAttribute('rx', 4);
      rect.setAttribute('ry', 4);
      rect.setAttribute('fill', 'rgba(255,255,255,0.9)');
      rect.setAttribute('stroke', 'rgba(0,0,0,0.1)');
      rect.setAttribute('stroke-width', '0.5');
      rect.setAttribute('class', 'path-label-bg');

      // Insert background behind text
      g.insertBefore(rect, t);
    } catch (e) {
      // If bbox measurement fails, continue without background
      console.warn('Could not measure text bounds for path label:', e);
    }
  }

  // ---------- animated arrow creation ----------
  function createAnimatedArrowForPath(pathEl, plan_space) {
    const arrowG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', '0,-5 10,0 0,5');
    const color = getColorForPlanSpace(plan_space);
    poly.setAttribute('fill', color);
    poly.setAttribute('opacity', '0.65');
    poly.style.pointerEvents = 'none';
    arrowG.appendChild(poly);

    const arrowsLayer = getOrCreateArrowsLayer();
    arrowsLayer.appendChild(arrowG);

    // compute length
    let length = 0;
    try { length = pathEl.getTotalLength(); } catch (e) { length = 100; }

    // Different speeds for different plan spaces
    const baseSpeed = (plan_space === 'cart') ? 110 : 100;
    const speed = baseSpeed * (1 + length / 400);

    const offset = Math.random() * length;

    animatedArrows.push({
      pathEl,
      arrowG,
      length,
      speed,
      offset,
      lastTime: performance.now()
    });

    arrowG.style.pointerEvents = 'none';
  }

  // ---------- animation loop ----------
  let animRunning = false;
  function startAnimationLoop() {
    if (animRunning) return;
    animRunning = true;
    let last = performance.now();
    function step(now) {
      const dt = (now - last) / 2000; // seconds
      last = now;
      for (const a of animatedArrows) {
        a.offset += a.speed * dt;
        if (a.length > 0) a.offset = a.offset % a.length;
        const pos = safeGetPointAtLength(a.pathEl, a.offset);
        const tan = safeGetTangentAtLength(a.pathEl, a.offset);
        if (pos && tan) {
          const angle = Math.atan2(tan.y, tan.x) * 180 / Math.PI;
          a.arrowG.setAttribute('transform', `translate(${pos.x},${pos.y}) rotate(${angle})`);
        }
      }
      if (animatedArrows.length === 0) {
        animRunning = false;
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function safeGetPointAtLength(pathEl, dist) {
    try {
      return pathEl.getPointAtLength(dist);
    } catch (e) {
      return null;
    }
  }

  function safeGetTangentAtLength(pathEl, dist) {
    try {
      const len = pathEl.getTotalLength();
      const p1 = pathEl.getPointAtLength(Math.max(0, dist - 0.5));
      const p2 = pathEl.getPointAtLength(Math.min(len, dist + 0.5));
      return { x: p2.x - p1.x, y: p2.y - p1.y };
    } catch (e) {
      return null;
    }
  }

  // ---------- default layout ----------
  function defaultLayout() {
    const total = points.length || 1;
    const cols = Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    const width = 1200;
    const height = 800;
    const gapX = width / (cols + 1);
    const gapY = height / (rows + 1);
    let i = 0;
    points.forEach(p => {
      if (!layoutCache[p.name]) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        layoutCache[p.name] = { x: (col + 1) * gapX, y: (row + 1) * gapY };
      }
      i++;
    });
  }

  // ---------- dragging nodes (world coords) ----------
  let dragging = null;
  let dragStartWorld = null; // {worldX, worldY, nodeX, nodeY}
  function startDrag(e) {
    e.preventDefault();
    const g = e.currentTarget;
    const name = g.dataset.name;
    dragging = name;
    selectedNode = name;
    const touch = (e.touches && e.touches[0]) ? e.touches[0] : null;
    const client = touch || e;
    const world = svgPointFromClient(client.clientX, client.clientY);
    const node = layoutCache[name] || { x: 0, y: 0 };
    dragStartWorld = { worldX: world.x, worldY: world.y, nodeX: node.x, nodeY: node.y };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', endDrag);
  }

  function onDrag(e) {
    if (!dragging) return;
    e.preventDefault();
    const touch = (e.touches && e.touches[0]) ? e.touches[0] : null;
    const client = touch || e;
    const world = svgPointFromClient(client.clientX, client.clientY);
    const dx = world.x - dragStartWorld.worldX;
    const dy = world.y - dragStartWorld.worldY;
    let nx = dragStartWorld.nodeX + dx;
    let ny = dragStartWorld.nodeY + dy;
    if (snapToGridCheckbox.checked) {
      nx = Math.round(nx / gridSize) * gridSize;
      ny = Math.round(ny / gridSize) * gridSize;
    }
    layoutCache[dragging] = { x: nx, y: ny };
    render();
  }

  function endDrag(e) {
    if (!dragging) return;
    dragging = null;
    dragStartWorld = null;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchmove', onDrag);
    window.removeEventListener('touchend', endDrag);
  }

  // ---------- background pan ----------
  let panning = false;
  let panStart = null;
  function startPan(e) {
    // start pan only when clicking background (not on nodes)
    if (e.target !== svg && e.target.parentNode !== svg && e.target.id !== 'grid-layer') return;
    panning = true;
    const touch = (e.touches && e.touches[0]) ? e.touches[0] : null;
    const client = touch || e;
    panStart = { clientX: client.clientX, clientY: client.clientY, panX: pan.x, panY: pan.y };
    window.addEventListener('mousemove', onPan);
    window.addEventListener('mouseup', endPan);
    window.addEventListener('touchmove', onPan, { passive: false });
    window.addEventListener('touchend', endPan);
  }
  function onPan(e) {
    if (!panning) return;
    e.preventDefault();
    const touch = (e.touches && e.touches[0]) ? e.touches[0] : null;
    const client = touch || e;
    const dx = client.clientX - panStart.clientX;
    const dy = client.clientY - panStart.clientY;
    pan.x = panStart.panX + dx;
    pan.y = panStart.panY + dy;
    updateViewTransform();
    render();
  }
  function endPan(e) {
    panning = false;
    panStart = null;
    window.removeEventListener('mousemove', onPan);
    window.removeEventListener('mouseup', endPan);
    window.removeEventListener('touchmove', onPan);
    window.removeEventListener('touchend', endPan);
  }

  // ---------- wheel zoom ----------
  function onWheel(e) {
    if (e.ctrlKey) return; // allow system zoom
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? scaleStep : (1 / scaleStep);
    setScale(scale * factor, e);
  }

  // ---------- tooltip ----------
  function showTooltip(ev, text) {
    const t = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
    tooltip.style.display = 'block';
    tooltip.textContent = t;
    const evt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    let left = evt.clientX + 12;
    let top = evt.clientY + 12;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    if (left + tw > ww) left = evt.clientX - tw - 12;
    if (top + th > wh) top = evt.clientY - th - 12;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  function hideTooltip() { tooltip.style.display = 'none'; }

  // ---------- side lists ----------
  // function renderSideLists() {
  //   pointsListEl.innerHTML = '';
  //   points.forEach(p => {
  //     const div = document.createElement('div');
  //     div.className = 'list-item';
  //     div.innerHTML = `<span>${p.name}</span><span class="filter-tag">pts</span>`;
  //     div.addEventListener('click', () => centerOnPoint(p.name));
  //     pointsListEl.appendChild(div);
  //   });

  //   pathsListEl.innerHTML = '';
  //   paths.forEach(p => {
  //     const div = document.createElement('div');
  //     div.className = 'list-item';
  //     div.innerHTML = `<span>${p.name || '-'}: ${p.start_point} → ${p.end_point}</span><span class="filter-tag">${p.plan_space || 'unknown'}</span>`;
  //     pathsListEl.appendChild(div);
  //   });
  // }

  function centerOnPoint(name) {
    const pos = layoutCache[name];
    if (!pos) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    pan.x = cx - pos.x * scale;
    pan.y = cy - pos.y * scale;
    updateViewTransform();
    render();
  }

  // ---------- load data ----------
  async function loadData() {
    try {
      const [pRes, pathRes, whereRes] = await Promise.all([
        fetch(API_POINTS),
        fetch(API_PATHS),
        fetch(`${API_WHERE}?tolerance=${encodeURIComponent(toleranceInput.value)}`)
      ]);
      const pJson = await pRes.json();
      const pathJson = await pathRes.json();
      const whereJson = await whereRes.json().catch(() => null);

      points = (pJson.points || []).map(pt => ({ name: pt.name, joints: pt.joints || [] }));
      paths = (pathJson.paths || []);

      // ensure layout cache includes nodes
      points.forEach(pt => { if (!(pt.name in layoutCache)) layoutCache[pt.name] = null; });

      render();
      updateViewTransform();

      // if (whereJson && whereJson.matched) {
      //   matchedInfo.textContent = `Matched: ${whereJson.points ? whereJson.points.join(', ') : whereJson.point}`;
      // } else if (whereJson) {
      //   matchedInfo.textContent = 'No matched points';
      // } else {
      //   matchedInfo.textContent = 'whereami unavailable';
      // }
    } catch (err) {
      console.error('Failed to load data', err);
      // pointsListEl.textContent = 'Failed to load';
      // pathsListEl.textContent = 'Failed to load';
    }
  }

  // ---------- zoom helpers ----------
  function setScale(newScale, centerEvent) {
    const rect = svg.getBoundingClientRect();
    const cx = centerEvent ? (centerEvent.clientX - rect.left) : rect.width / 2;
    const cy = centerEvent ? (centerEvent.clientY - rect.top) : rect.height / 2;
    const worldX = (cx - pan.x) / scale;
    const worldY = (cy - pan.y) / scale;
    scale = Math.max(minScale, Math.min(maxScale, newScale));
    pan.x = cx - worldX * scale;
    pan.y = cy - worldY * scale;
    updateViewTransform();
    render();
  }

  // ---------- alignment / snap ----------
  alignGridBtn.addEventListener('click', () => {
    Object.keys(layoutCache).forEach(k => {
      if (!layoutCache[k]) return;
      layoutCache[k].x = Math.round(layoutCache[k].x / gridSize) * gridSize;
      layoutCache[k].y = Math.round(layoutCache[k].y / gridSize) * gridSize;
    });
    render();
  });

  // ---------- controls ----------
  reloadBtn.addEventListener('click', () => loadData());
  planSpaceFilter.addEventListener('change', render);
  resetLayoutBtn.addEventListener('click', () => { layoutCache = {}; render(); });
  exportLayoutBtn.addEventListener('click', () => {
    const data = JSON.stringify(layoutCache, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'layout.json'; a.click();
    URL.revokeObjectURL(url);
  });

  // ---------- events ----------
  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('mousedown', startPan);
  svg.addEventListener('touchstart', startPan, { passive: false });

  showGridCheckbox.addEventListener('change', () => { renderGrid(); render(); });



  saveLayoutBtn.addEventListener('click', saveCurrentLayout);
  loadLayoutBtn.addEventListener('click', loadSelectedLayout);
  deleteLayoutBtn.addEventListener('click', deleteSelectedLayout);

  // ---------- startup ----------
  loadData();
  updateViewTransform();
  // Load available layouts on startup
  loadLayoutsList();
  
  // expose for debug
  window.__viz = { loadData, render, layoutCache, pan };
})();