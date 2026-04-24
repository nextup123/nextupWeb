let contextMenu = null;

document.addEventListener("contextmenu", (e) => {
  const nodeElem = e.target.closest(".node");
  if (!nodeElem) return; // not a node

  e.preventDefault();
  const nodeData = d3.select(nodeElem).datum();
  selectedNode = nodeData;

  // Remove any existing menu
  if (contextMenu) contextMenu.remove();

  // Create context menu container
  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.top = `${e.pageY}px`;
  contextMenu.style.left = `${e.pageX}px`;

  // Build items dynamically (not via innerHTML!)
  addContextItem("➕ Add Node ▸", createNodeSubmenu(), contextMenu);
  addContextItem("⤴️ Add Wrapper ▸", createWrapperSubmenu(), contextMenu);

  addSeparator(contextMenu);
  addSimpleItem("📋 Copy Node  [Ctrl+D]", copyNode, contextMenu);
  addSimpleItem("❌ Delete Node", deleteNode, contextMenu);
  addSimpleItem("🗑️ Delete Wrapper", deleteWrapperOnly, contextMenu);

  document.body.appendChild(contextMenu);

  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener("click", closeContextMenu, { once: true });
  }, 0);
});

function closeContextMenu() {
  if (contextMenu) contextMenu.remove();
  contextMenu = null;
}

// 🔹 Utility to create standard items
function addSimpleItem(label, handler, container) {
  const item = document.createElement("div");
  item.className = "context-menu-item";
  item.textContent = label;
  item.onclick = (e) => {
    e.stopPropagation();
    handler();
    closeContextMenu();
  };
  container.appendChild(item);
}

// 🔹 Utility for parent items with submenu (fixed)
function addContextItem(label, submenu, container) {
  const item = document.createElement("div");
  item.className = "context-menu-item";
  item.style.position = "relative";

  // Create a label span instead of setting textContent
  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  item.appendChild(labelSpan);

  // Right arrow icon
  const arrow = document.createElement("span");
  arrow.textContent = "›";
  arrow.style.marginLeft = "auto";
  arrow.style.color = "#999";
  item.appendChild(arrow);

  if (submenu) {
    item.appendChild(submenu);
  }

  container.appendChild(item);
}


// 🔹 Separator line
function addSeparator(container) {
  const sep = document.createElement("div");
  sep.className = "context-menu-separator";
  container.appendChild(sep);
}

/* ---------------------------------------------------------
   Submenu Builders
   --------------------------------------------------------- */
function createNodeSubmenu() {
  const submenu = document.createElement("div");
  submenu.className = "submenu";
  submenu.style.zIndex = "10000"; // ensure visible above parent menu

  if (!nodeDefinitions || !nodeDefinitions.default) {
    submenu.textContent = "Loading...";
    return submenu;
  }

  const mergedCats = { ...nodeDefinitions.default, ...nodeDefinitions.custom };
  Object.keys(mergedCats).forEach((cat) => {
    const catItem = document.createElement("div");
    catItem.className = "context-menu-item";
    catItem.textContent = cat;

    const typeSub = document.createElement("div");
    typeSub.className = "submenu";
    typeSub.style.zIndex = "10001";

    const defs = {
      ...(nodeDefinitions.default?.[cat] || {}),
      ...(nodeDefinitions.custom?.[cat] || {}),
    };

    Object.keys(defs).forEach((type) => {
      const leaf = document.createElement("div");
      leaf.className = "context-menu-item";
      leaf.textContent = type;
      leaf.onclick = (e) => {
        e.stopPropagation();
        console.log(`[Add Node] Category: ${cat}, Type: ${type}`);
        autoAddNode(cat, type);
        closeContextMenu();
      };
      typeSub.appendChild(leaf);
    });

    catItem.appendChild(typeSub);
    submenu.appendChild(catItem);
  });

  return submenu;
}


function createWrapperSubmenu() {
  const submenu = document.createElement("div");
  submenu.className = "submenu";

  ["Sequence", "Fallback", "Selector"].forEach((type) => {
    const item = document.createElement("div");
    item.className = "context-menu-item";
    item.textContent = type;
    item.onclick = (e) => {
      e.stopPropagation();
      console.log(`[Add Wrapper] Type: ${type}`);
      document.getElementById("new-wrapper-type").value = type;
      addWrapper();
      closeContextMenu();
    };
    submenu.appendChild(item);
  });

  return submenu;
}

/* ---------------------------------------------------------
   Add Node (auto name)
   --------------------------------------------------------- */
function autoAddNode(cat, type) {
  if (!selectedNode || !currentSubtreeId) {
    showToast("Select a parent node first!");
    return;
  }

  if (!checkIsWrapper(selectedNode.data.type)) {
    showToast("Can only add under wrapper nodes!");
    return;
  }

  const now = new Date();
  const timePart = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`.slice(-6);
  const name = `${type}_${timePart}`;

  const attributes = {};
  const def =
    nodeDefinitions.default?.[cat]?.[type] ||
    nodeDefinitions.custom?.[cat]?.[type];
  if (def?.attributes) {
    for (const [k, v] of Object.entries(def.attributes)) {
      attributes[k] = v || "";
    }
  }

  fetch(`${API_BASE}/addNode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subtreeId: currentSubtreeId,
      parentPath: selectedNode.data.path.slice(1),
      nodeType: type,
      nodeName: name,
      attributes,
    }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to add node");
      console.log(`✅ Added node: ${name}`);
      showToast(`Added ${type}`, "success");
      loadSubtree(currentSubtreeId);
    })
    .catch((err) => showToast(err.message));
}


/* -------------------------------------------------
   Context menu for nested view — reuses context_menu.js
   ------------------------------------------------- */
document.addEventListener('contextmenu', (e) => {
  const header = e.target.closest('#nested-view .nested-node-header');
  if (!header) return;

  e.preventDefault();
  e.stopPropagation();

  const uid = header.dataset.uid;
  if (!uid) return;

  selectedNodeUid = uid;

  // ✅ Wrap raw node in { data: ... } so ALL downstream functions work
  const rawNode = findNodeByUid(lastRenderedTreeData, uid);
  if (!rawNode) return;

  const parentRaw = findParentByUid(lastRenderedTreeData, uid);
  selectedNode = {
    data: rawNode,
    parent: parentRaw ? { data: parentRaw } : null
  };

  showNodeDetails(rawNode);
  updateButtonStates(selectedNode);
  renderNestedView();

  if (contextMenu) contextMenu.remove();

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.top  = `${e.pageY}px`;
  contextMenu.style.left = `${e.pageX}px`;

  addContextItem('➕ Add Node ▸',    createNodeSubmenu(),    contextMenu);
  addContextItem('⤴️ Add Wrapper ▸', createWrapperSubmenu(), contextMenu);
  addSeparator(contextMenu);
  addSimpleItem('📋 Copy Node  [Ctrl+D]', copyNode,         contextMenu);
  addSimpleItem('❌ Delete Node',          deleteNode,        contextMenu);
  addSimpleItem('🗑️ Delete Wrapper',      deleteWrapperOnly, contextMenu);

  document.body.appendChild(contextMenu);

  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true });
  }, 0);
});