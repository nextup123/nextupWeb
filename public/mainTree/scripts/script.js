const API_BASE = "http://localhost:3000/main-tree";





// --------------------------------------------------------------------
let selectedNode = null;
let selectedNodeUid = null;   
let dragStartTime = null;
let customNodeModalOpen = false;

let lastSearchQuery = '';
let searchMatches = [];        // array of node UIDs that match
let currentMatchIndex = -1;

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}



/* -------------------------------------------------
   Custom Node Modal
   ------------------------------------------------- */
function openCustomNodeModal() {
  if (customNodeModalOpen) return;
  customNodeModalOpen = true;
  document.getElementById('custom-node-modal').style.display = 'flex';
  document.getElementById('custom-node-name').value = '';
  document.getElementById('custom-attributes-list').innerHTML = '';
  addAttributeRow();
}
function closeCustomNodeModal() {
  customNodeModalOpen = false;
  document.getElementById('custom-node-modal').style.display = 'none';
}

function addAttributeRow(key = '', value = '') {
  const list = document.getElementById('custom-attributes-list');
  const row = document.createElement('div');
  row.className = 'attr-row';
  row.innerHTML = `
    <input type="text" placeholder="attribute_name" value="${key}">
    <input type="text" placeholder="default_value (optional)" value="${value}">
    <button type="button" onclick="this.parentElement.remove()">x</button>
  `;
  list.appendChild(row);
}
document.getElementById('add-attr-btn').onclick = () => addAttributeRow();

document.getElementById('save-custom-node').onclick = async () => {
  const name = document.getElementById('custom-node-name').value.trim();
  const category = document.getElementById('custom-node-category').value;
  const isWrapper = document.querySelector('input[name="node-kind"]:checked').value === 'wrapper';

  if (!name) { showToast('Node name required!','warn'); return; }

  const attributes = {};
  document.querySelectorAll('#custom-attributes-list .attr-row').forEach(row => {
    const k = row.children[0].value.trim();
    const v = row.children[1].value.trim();
    if (k) attributes[k] = v;
  });

  try {
    const res = await fetch(`${API_BASE}/addCustomNode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, isWrapper, attributes })
    });
    if (!res.ok) throw new Error(await res.text());
    showToast('Custom node added!');
    closeCustomNodeModal();
    await loadNodeTypes();
  } catch (err) {
    console.error(err);
    showToast(`Failed: ${err.message}`,'failure');
  }
};

/* -------------------------------------------------
   Tree conversion & rendering (with _uid support)
   ------------------------------------------------- */
function convertToTree(obj, name = 'root', path = [], type = 'BehaviorTree') {
  const attrs = obj['@attributes'] || {};
  const children = obj['@children'] || [];

  // 🔹 Extract UID safely — use ID if _uid missing (for backward compatibility)
  const uid = attrs._uid || attrs.ID || `temp_${Math.random().toString(36).slice(2)}`;

  const node = {
    // what user sees
    name: attrs.name || attrs.ID || name,
    // what backend uses
    uid,
    id: attrs.ID || null,
    attributes: attrs,
    children: [],
    path,     // inherited from parent — full ancestry of UIDs
    type
  };

  children.forEach(child => {
    const tag = child.tagName;
    const content = child.content;
    const childAttrs = content['@attributes'] || {};

    // 🔹 child UID & name fallback
    const childUid = childAttrs._uid || childAttrs.ID || `temp_${Math.random().toString(36).slice(2)}`;
    const childName = childAttrs.name || childAttrs.ID || tag;

    // 🔹 recursively build subtree
    const childNode = convertToTree(
      content,
      childName,
      [...path, childUid],   // 🔹 use UID path, not ID path
      tag
    );
    node.children.push(childNode);
  });

  return node;
}


// node coloring
const TYPE_COLOR = {
  BehaviorTree: '#007aff',
  SubTreePlus: '#dd00ffff',
  Sequence: '#5856d6',
  Fallback: '#ff2d55',
  Selector: '#00c4b4',
  Parallel: '#ff9500',
  WhileDoElse: '#ffcc00',
  Timeout: '#1f3801ff',
  Action: '#34c759',
  DoControl: '#34c759',
  DIControl: '#34c759',
  RunPath: '#a3654cff',
  PilzPointsAction: '#f5a8c8',
  Condition: '#ff9500',
  __wrapper__: '#9c27b0',
  __leaf__: '#4caf50'
};

// ✅ Unified helper: determines if a node type is a wrapper
function checkIsWrapper(type) {
  
  const wrapperTypes = ['BehaviorTree', 'Sequence', 'Fallback', 'Selector', 'Parallel', 'WhileDoElse'];

  // Standard wrapper nodes
  if (wrapperTypes.includes(type)) {
    console.log(`  ${type} is in hardcoded wrapperTypes`);
    return true;
  }

  // Check custom node definitions (same logic as renderTree)
  if (nodeDefinitions.custom) {
    for (const cat in nodeDefinitions.custom) {
      if (nodeDefinitions.custom[cat][type]) {
        const def = nodeDefinitions.custom[cat][type];
        if (def.type === 'wrapper') {
          console.log(`  ${type} is wrapper (custom)`);
          return true;
        }
      }
    }
  }

  // Check default node definitions
  if (nodeDefinitions.default) {
    for (const cat in nodeDefinitions.default) {
      if (nodeDefinitions.default[cat][type]) {
        const def = nodeDefinitions.default[cat][type];
        console.log(`  Found ${type} in default.${cat}:`, def);
        if (def.type === 'wrapper') {
          console.log(`  ${type} is wrapper (default)`);
          return true;
        }
      }
    }
  }

  console.log(`  ${type} is NOT a wrapper`);
  return false;
}
/* -------------------------------------------------
   Helper: swap target detection - FIXED VERSION
   ------------------------------------------------- */
function findSwapTarget(x, y, currentNode, root) {
  const nodes = root.descendants();
  let closest = null;
  let minDist = Infinity;

  // Get the XML parent path of the current node (remove itself)
  const currentParentPath = currentNode.data.path.slice(0, -1);

  nodes.forEach(n => {
    if (n === currentNode) return;

    const targetParentPath = n.data.path.slice(0, -1);

    // Compare by UID path (safe)
    if (JSON.stringify(currentParentPath) !== JSON.stringify(targetParentPath)) return;

    const dx = n.x - x;
    const dy = n.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist && dist < 80) {
      minDist = dist;
      closest = n;
    }
  });

  return closest;
}

function showNodeDetails(data) {
  const info = document.getElementById('node-info');
  const edit = document.getElementById('edit-section');
  const fieldsDiv = document.getElementById('edit-fields');

  info.innerHTML = `<b>${data.name}</b>`;
  edit.style.display = 'block';
  fieldsDiv.innerHTML = '';

  // List all attributes (excluding _uid for clarity)
  for (const [k, v] of Object.entries(data.attributes)) {
    if (k === '_uid') continue; // don't show internal UID
    const field = document.createElement('div');
    field.innerHTML = `<label>${k}</label><input type="text" name="${k}" value="${v || ''}" />`;
    fieldsDiv.appendChild(field);
  }

  const form = document.getElementById('edit-form');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const newAttrs = {};
    fd.forEach((val, key) => (newAttrs[key] = val));

    try {
      // 🔹 send UID path for update
      const res = await fetch(`${API_BASE}/updateNode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtreeId: currentSubtreeId,
          nodePath: data.path.slice(1), // UID path
          newAttributes: newAttrs,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      showToast('Node updated!');
      loadSubtree(currentSubtreeId);
    } catch (err) {
      console.error('Error updating node:', err);
      showToast(`Failed to update node: ${err.message}`,'failure');
    }
  };
}




/* ==============================================================
   NODE TYPE LOADING (unchanged, only improved readability)
   ============================================================== */
let nodeDefinitions = {};

async function loadNodeTypes() {
  try {
    const res = await fetch(`${API_BASE}/getNodeTypes`);
    if (!res.ok) throw new Error('Failed to load node types');
    nodeDefinitions = await res.json();
    
    
    // Log default nodes
    for (const category in nodeDefinitions.default) {
      for (const nodeName in nodeDefinitions.default[category]) {
        const nodeDef = nodeDefinitions.default[category][nodeName];
        if (nodeDef.attributes) {
        }
      }
    }
    
    // Log custom nodes  
    for (const category in nodeDefinitions.custom) {
      for (const nodeName in nodeDefinitions.custom[category]) {
        const nodeDef = nodeDefinitions.custom[category][nodeName];
        if (nodeDef.attributes) {
        }
      }
    }
    
    // Count totals
    let defaultCount = 0;
    for (const category in nodeDefinitions.default) {
      defaultCount += Object.keys(nodeDefinitions.default[category]).length;
    }
    
    let customCount = 0;
    for (const category in nodeDefinitions.custom) {
      customCount += Object.keys(nodeDefinitions.custom[category]).length;
    }
    
  

    // Rest of your existing code for populating the UI...
    const catSelect = document.getElementById('node-category');
    catSelect.innerHTML = '<option value="">Select Category</option>';

    const baseCategories = ['Control', 'Decorator', 'Action'];
    baseCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = 'Custom';
    customOpt.textContent = 'Custom';
    catSelect.appendChild(customOpt);

    catSelect.onchange = () => {
      const cat = catSelect.value;
      const typeSelect = document.getElementById('node-type');
      typeSelect.innerHTML = '<option value="">Select Node Type</option>';
      document.getElementById('node-attributes').innerHTML = '';
      if (!cat) return;

      let merged = {};
      if (cat === 'Custom') {
        for (const customCat in nodeDefinitions.custom) {
          merged = { ...merged, ...nodeDefinitions.custom[customCat] };
        }
      } else {
        merged = {
          ...(nodeDefinitions.default[cat] || {}),
          ...(nodeDefinitions.custom[cat] || {}),
        };
      }

      // Log what's available for this category
      console.log(`\n=== AVAILABLE NODES FOR CATEGORY: ${cat} ===`);
      console.log('Merged node definitions:', merged);
      
      for (const type in merged) {
        const opt = document.createElement('option');
        opt.value = type;

        let isCustom = false;
        for (const customCat in nodeDefinitions.custom) {
          if (nodeDefinitions.custom[customCat][type]) {
            isCustom = true;
            break;
          }
        }

        console.log(`  - ${type} ${isCustom ? '(custom)' : '(default)'}`);
        opt.textContent = type + (isCustom ? ' (custom)' : '');
        typeSelect.appendChild(opt);
      }

      typeSelect.onchange = () => {
        const type = typeSelect.value;
        const attrDiv = document.getElementById('node-attributes');
        attrDiv.innerHTML = '';

        const nameInput = document.getElementById('new-node-name');
        if (type) {
          const now = new Date();
          const timePart = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`.slice(-6);
          const autoName = `${type}_${timePart}`;
          nameInput.value = autoName;
        }

        if (!type) return;

        let def = null;
        if (cat === 'Custom') {
          for (const customCat in nodeDefinitions.custom) {
            if (nodeDefinitions.custom[customCat][type]) {
              def = nodeDefinitions.custom[customCat][type];
              break;
            }
          }
        } else {
          def = merged[type];
        }

        console.log(`\n=== SELECTED NODE: ${type} ===`);
        console.log('Node definition:', def);
        
        if (def && def.attributes) {
          console.log(`Attributes found:`, Object.keys(def.attributes));
          for (const [k, v] of Object.entries(def.attributes)) {
            const div = document.createElement('div');
            div.className = 'attr';
            div.innerHTML = `<label>${k}</label><input type="text" data-attr="${k}" placeholder="${v}" />`;
            attrDiv.appendChild(div);
          }
        } else {
          console.log('No attributes for this node');
        }
      };
    };
  } catch (err) {
    console.error(err);
    showToast('Failed to load node types','failure');
  }
}

const tooltip = d3.select('#tooltip');
function showHoverTooltip(d) {
  const info = Object.entries(d.data.attributes || {})
    .filter(([k]) => k !== '_uid') // hide _uid
    .map(([k, v]) => `${k}: ${v}`)
    .join('<br>');
  tooltip.style('display', 'block')
    .html(`<b>${d.data.name}</b><br>${info}`);
}

function hideHoverTooltip() { 
  tooltip.style('display', 'none');
}

d3.select('#tree-view').on('mousemove', e => {
  tooltip.style('left', `${e.pageX + 10}px`)
    .style('top', `${e.pageY + 10}px`);
});




window.onload = () => {

  loadNodeTypes();

  // ── Keyboard shortcuts ──────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Ctrl+D — duplicate (copy) selected node
    if (e.ctrlKey && e.key === 'd') {
      // Only fire when not typing inside an input/textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      e.preventDefault();
      copyNode();
    }
  });

};