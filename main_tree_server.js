// ======================================================
// Imports & Constants
// ======================================================
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const {
  parseXmlString,
  jsonToXml,
  // ensureUids,
  stripInternalUids
} = require('./user_config/customXmlParser');
const cors = require('cors');

const app = express();
const PORT = 3011;

const TEMPLATE_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/template_tree.xml';
const DO_DI_TEMPLATE_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/do_di_tree.xml';
const NODES_JSON_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/nodes.json';
const RUNPATH_TEMPLATE_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/run_path.xml';


app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// const UID_CACHE_PATH = path.join(__dirname, 'user_config', 'template_with_uids.json');

// Utility: Read & Write XML (ordered JSON + _uid support)
async function readAndParseXML(filePath = TEMPLATE_PATH, forceXml2jsParse = false) {
  try {
    const baseName = path.basename(filePath, '.xml');
    const UID_CACHE_PATH = path.join(__dirname, 'user_config', `${baseName}_with_uids.json`);

    if (!forceXml2jsParse) {
      try {
        const cached = await fs.readFile(UID_CACHE_PATH, 'utf-8');
        return JSON.parse(cached);
      } catch {
      }
    } else {
      console.log(`🔁 Force flag active — ignoring cache, parsing fresh XML`);
    }

    const xmlData = await fs.readFile(filePath, 'utf-8');
    const json = parseXmlString(xmlData);
    await fs.writeFile(UID_CACHE_PATH, JSON.stringify(json, null, 2));
    return json;
  } catch (err) {
    console.error(`❌ Error in readAndParseXML(${filePath}):`, err);
    throw err;
  }
}



async function writeXML(jsonObj, filePath = TEMPLATE_PATH) {
  try {
    const baseName = path.basename(filePath, '.xml');
    const UID_CACHE_PATH = path.join(__dirname, 'user_config', `${baseName}_with_uids.json`);
    await fs.writeFile(UID_CACHE_PATH, JSON.stringify(jsonObj, null, 2));
    const xml = jsonToXml({ root: jsonObj }, true);
    await fs.writeFile(filePath, xml, 'utf-8');
  } catch (err) {
    console.error('Error writing XML:', err);
    throw err;
  }
}


// Utility: Read / Write nodes.json
async function readNodeDefs() {
  const data = await fs.readFile(NODES_JSON_PATH, 'utf-8');
  return JSON.parse(data);
}

async function writeNodeDefs(defs) {
  await fs.writeFile(NODES_JSON_PATH, JSON.stringify(defs, null, 2));
}

// Unique ID helper (used only for external visible IDs)
function ensureUids(node) {
  if (!node || typeof node !== 'object') return;
  if (node['@attributes']) {
    if (!node['@attributes']._uid) {
      node['@attributes']._uid = generateUniqueId('uid_');
    }
  }
  if (Array.isArray(node['@children'])) {
    node['@children'].forEach(child => ensureUids(child.content));
  }
}

function generateUniqueId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Node type definitions endpoints
app.get('/getNodeTypes', async (req, res) => {
  try {
    const defs = await readNodeDefs();
    res.json(defs);
  } catch (err) {
    res.status(500).send('Failed to load node types');
  }
});

app.post('/addCustomNode', async (req, res) => {
  const { name, category, isWrapper, attributes } = req.body;
  if (!name || !category)
    return res.status(400).send('Name and category required');

  try {
    const defs = await readNodeDefs();
    if (!defs.custom[category]) defs.custom[category] = {};
    if (defs.custom[category][name])
      return res.status(400).send('Custom node already exists');

    defs.custom[category][name] = {
      type: isWrapper ? 'wrapper' : 'leaf',
      attributes: attributes || {},
      ...(isWrapper ? { children: [] } : {})
    };

    await writeNodeDefs(defs);
    res.json({ success: true });
  } catch (err) {
    res.status(500).send('Failed to add custom node');
  }
});

// Legacy helpers (may later be replaced by _uid logic)
function updateNodeIds(node, prefix = '') {
  if (node.$ && (node.$.ID || node.$.id)) {
    node.$.ID = generateUniqueId(prefix);
  }
  for (const key in node) {
    if (Array.isArray(node[key])) {
      node[key].forEach(child => updateNodeIds(child, `${prefix}${key}_`));
    }
  }
}

function findNodeById(node, targetId, parent = null, parentArray = null, parentKey = null, index = -1) {
  const currentId = node.$?.ID || node.$?.id;
  if (currentId === targetId) {
    return { node, parent, parentArray, parentKey, index };
  }
  for (const key in node) {
    if (Array.isArray(node[key])) {
      for (let i = 0; i < node[key].length; i++) {
        const child = node[key][i];
        const result = findNodeById(child, targetId, node, node[key], key, i);
        if (result.node) return result;
      }
    }
  }
  return { node: null, parent: null, parentArray: null, parentKey: null, index: -1 };
}

// DO/DI SUBTREES
app.get('/getDoDiSubtrees', async (req, res) => {
  try {
    const force = String(req.query.force_xml2js_parse === 'true');

    const result = await readAndParseXML(DO_DI_TEMPLATE_PATH, force);
    const allChildren = Array.isArray(result['@children']) ? result['@children'] : [];

    const subtrees = allChildren
      .filter(c => c.tagName === 'BehaviorTree')
      .map(c => ({ id: c.content['@attributes']?.ID }));

    if (subtrees.length === 0) {
      console.warn(`⚠ No DO/DI subtrees found in XML.`);
      return res.status(200).json({ message: 'No DO/DI subtrees found', subtrees: [] });
    }

    res.json(subtrees);
  } catch (err) {
    console.error('❌ Error in /getDoDiSubtrees:', err);
    res.status(500).json({ error: 'Failed to load DO/DI subtrees' });
  }
});


app.get('/getDoDiSubtree/:id', async (req, res) => {
  try {
    const result = await readAndParseXML(DO_DI_TEMPLATE_PATH);
    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' && c.content['@attributes'].ID === req.params.id);
    if (!subtree) return res.status(404).send('DO/DI Subtree not found');
    res.json({ root: { '@children': [subtree] } });
  } catch (err) {
    res.status(500).send('Failed to load DO/DI subtree');
  }
});

app.post('/addDoDiSubtreeAsChild', async (req, res) => {
  const { subtreeId, parentPath, childSubtreeId, mode = 'full', attributes = {} } = req.body;

  try {
    const mainTree = await readAndParseXML();
    const doDiTree = await readAndParseXML(DO_DI_TEMPLATE_PATH);

    const subtree = mainTree['@children']
      .find(c => c.tagName === 'BehaviorTree' && c.content['@attributes'].ID === subtreeId);
    if (!subtree) return res.status(404).send('Target subtree not found');

    const childTree = doDiTree['@children']
      .find(c => c.tagName === 'BehaviorTree' && c.content['@attributes'].ID === childSubtreeId);
    if (!childTree) return res.status(404).send('DO/DI subtree not found');

    let parent = subtree.content;
    for (const id of parentPath) {
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c => c['@attributes']?._uid === id || c['@attributes']?.ID === id);
      if (!next) return res.status(400).send(`Invalid path: ${id}`);
      parent = next;
    }

    if (!parent['@children']) parent['@children'] = [];

    if (mode === 'full') {
      const childCopy = JSON.parse(JSON.stringify(childTree));
      childCopy.content['@children'].forEach(child => {
        ensureUids(child.content);
      });
      parent['@children'].push(...childCopy.content['@children']);
    } else if (mode === 'reference') {
      const subtreePlusNode = {
        tagName: 'SubTreePlus',
        content: { '@attributes': { ID: childSubtreeId, ...attributes } }
      };
      parent['@children'].push(subtreePlusNode);
    } else {
      return res.status(400).send('Invalid mode');
    }

    await writeXML(mainTree);
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding DO/DI subtree:', err);
    res.status(500).send('Failed to add DO/DI subtree');
  }
});

// RUN PATH SUBTREES
app.get('/getRunPathSubtrees', async (req, res) => {
  try {
    // Always force re-parse for Run Path to get fresh data
    const result = await readAndParseXML(RUNPATH_TEMPLATE_PATH, true); // <-- true = force re-parse

    const allChildren = Array.isArray(result['@children']) ? result['@children'] : [];

    const subtrees = allChildren
      .filter(c => c.tagName === 'BehaviorTree')
      .map(c => ({
        id: c.content['@attributes']?.ID,
      }));

    if (subtrees.length === 0)
      return res.status(200).json({ message: 'No Run Path subtrees found', subtrees: [] });

    res.json(subtrees);
  } catch (err) {
    console.error('Error in /getRunPathSubtrees:', err);
    res.status(500).json({ error: 'Failed to load Run Path subtrees' });
  }
});

app.get('/getRunPathSubtree/:id', async (req, res) => {
  try {
    const result = await readAndParseXML(RUNPATH_TEMPLATE_PATH, true); // <-- true = force re-parse

    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' && c.content['@attributes'].ID === req.params.id);
    if (!subtree) return res.status(404).send('Run Path Subtree not found');
    res.json({ root: { '@children': [subtree] } });
  } catch (err) {
    res.status(500).send('Failed to load Run Path subtree');
  }
});

app.post('/addRunPathSubtreeAsChild', async (req, res) => {
  const { subtreeId, parentPath, childSubtreeId, mode = 'full' } = req.body;

  try {
    const mainTree = await readAndParseXML();
    const runPathTree = await readAndParseXML(RUNPATH_TEMPLATE_PATH);

    const subtree = mainTree['@children']
      .find(c => c.tagName === 'BehaviorTree' && c.content['@attributes'].ID === subtreeId);
    if (!subtree) return res.status(404).send('Target subtree not found');

    const childTree = runPathTree['@children']
      .find(c => c.tagName === 'BehaviorTree' && c.content['@attributes'].ID === childSubtreeId);
    if (!childTree) return res.status(404).send('Run Path subtree not found');

    let parent = subtree.content;
    for (const id of parentPath) {
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c => c['@attributes']?._uid === id || c['@attributes']?.ID === id);
      if (!next) return res.status(400).send(`Invalid path: ${id}`);
      parent = next;
    }

    if (!parent['@children']) parent['@children'] = [];

    if (mode === 'full') {
      const childCopy = JSON.parse(JSON.stringify(childTree));
      childCopy.content['@children'].forEach(child => {
        ensureUids(child.content);
      });
      parent['@children'].push(...childCopy.content['@children']);
    } else if (mode === 'reference') {
      const { attributes = {} } = req.body;

      const speed = parseFloat(attributes.desired_speed);
      if (isNaN(speed) || speed < 0.10 || speed > 2.00) {
        return res.status(400).send('desired_speed must be between 0.10 and 2.00');
      }

      const subtreePlusNode = {
        tagName: 'SubTreePlus',
        content: {
          '@attributes': {
            ID: childSubtreeId,
            desired_speed: speed.toFixed(2)
          }
        }
      };

      parent['@children'].push(subtreePlusNode);
    }
    else {
      return res.status(400).send('Invalid mode');
    }

    await writeXML(mainTree);
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding Run Path subtree:', err);
    res.status(500).send('Failed to add Run Path subtree');
  }
});

/* -------------------------------------------------
  NORMAL SUBTREE ENDPOINTS
  ------------------------------------------------- */

app.get('/getSubtrees', async (req, res) => {
  try {
    const force = String(req.query.force_xml2js_parse === 'true');
    // console.log(`🚀 /getSubtrees requested | force_xml2js_parse=${force}`);
    const result = await readAndParseXML(TEMPLATE_PATH, force);
    const allChildren = Array.isArray(result['@children']) ? result['@children'] : [];

    const subtrees = allChildren
      .filter(c => c.tagName === 'BehaviorTree')
      .map(c => ({
        id: c.content['@attributes']?.ID || c.content['@attributes']?.id
      }));

    if (subtrees.length === 0) {
      return res.status(200).json({ message: 'No subtrees found', subtrees: [] });
    }

    res.json(subtrees);
  } catch (err) {
    console.error('Error in /getSubtrees:', err);
    res.status(500).send('Failed to load subtrees');
  }
});

app.get('/getSubtree/:id', async (req, res) => {
  try {
    const result = await readAndParseXML();
    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' && c.content['@attributes'].ID === req.params.id);

    if (!subtree) return res.status(404).send('Subtree not found');
    res.json({ root: { '@children': [subtree] } });
  } catch (err) {
    res.status(500).send('Failed to load subtree');
  }
});

app.post('/addSubtree', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send('Subtree name required');

  try {
    const result = await readAndParseXML();
    if (!result['@children']) result['@children'] = [];

    const newSubtree = {
      tagName: 'BehaviorTree',
      content: {
        '@attributes': { ID: `${name}` },
        '@children': [
          {
            tagName: 'Sequence',
            content: {
              '@attributes': {
                ID: generateUniqueId('seq_'),
                name: 'RootSequence'
              },
              '@children': []
            }
          }
        ]
      }
    };

    // assign _uid to the new subtree and its children
    ensureUids(newSubtree.content);

    result['@children'].push(newSubtree);
    await writeXML(result);
    res.json({ success: true, id: name });
  } catch (err) {
    console.error('addSubtree error:', err);
    res.status(500).send('Failed to add subtree');
  }
});

/* -------------------------------------------------
   Update node attributes (by _uid path)
   ------------------------------------------------- */
app.post('/updateNode', async (req, res) => {
  const { subtreeId, nodePath, newAttributes } = req.body;

  try {
    const result = await readAndParseXML();
    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' && c.content['@attributes'].ID === subtreeId);
    if (!subtree) return res.status(404).send('Subtree not found');

    let node = subtree.content;
    for (const uid of nodePath) {
      node = (node['@children'] || [])
        .map(c => c.content)
        .find(c =>
          c['@attributes']?._uid === uid ||
          c['@attributes']?.ID === uid
        );
      if (!node) return res.status(400).send(`Invalid path: ${uid}`);
    }

    node['@attributes'] = { ...node['@attributes'], ...newAttributes };

    ensureUids(result); // make sure new nodes get internal IDs if any were missing
    await writeXML(result);
    res.json({ success: true });
  } catch (err) {
    console.error('updateNode error:', err);
    res.status(500).send('Failed to update node');
  }
});


app.post('/addNode', async (req, res) => {
  const { subtreeId, parentPath, nodeType, nodeName, attributes = {} } = req.body;
  if (!nodeType || !nodeName)
    return res.status(400).send('nodeType and nodeName required');

  try {
    console.log(`=== /addNode called ===`);
    console.log(`Node type: ${nodeType}, Node name: ${nodeName}`);

    const result = await readAndParseXML();

    // ---- find the target subtree ----
    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === subtreeId);
    if (!subtree) return res.status(404).send('Subtree not found');

    // ---- locate parent node using _uid path ----
    let parent = subtree.content;
    for (const uid of parentPath) {
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c =>
          c['@attributes']?._uid === uid ||
          c['@attributes']?.ID === uid
        );
      if (!next) return res.status(400).send(`Invalid path: ${uid}`);
      parent = next;
    }

    // ---- Load node definitions to check type ----
    const nodeDefs = await readNodeDefs();
    let isWrapper = false;
    let defaultChildren = [];

    console.log(`Searching for node type: ${nodeType}`);

    // Search for node type in default definitions
    for (const category in nodeDefs.default) {
      if (nodeDefs.default[category][nodeType]) {
        const def = nodeDefs.default[category][nodeType];
        console.log(`Found in default.${category}:`, def);
        isWrapper = def.type === 'wrapper';
        defaultChildren = def.children || [];
        break;
      }
    }

    // If not found in default, search in custom definitions
    if (!isWrapper && defaultChildren.length === 0) {
      for (const category in nodeDefs.custom) {
        if (nodeDefs.custom[category][nodeType]) {
          const def = nodeDefs.custom[category][nodeType];
          console.log(`Found in custom.${category}:`, def);
          isWrapper = def.type === 'wrapper';
          defaultChildren = def.children || [];
          break;
        }
      }
    }

    console.log(`Is wrapper? ${isWrapper}`);
    console.log(`Default children:`, defaultChildren);

    // ---- helper for creating sequences ----
    const createSequence = (name) => ({
      tagName: 'Sequence',
      content: {
        '@attributes': {
          ID: generateUniqueId('seq_'),
          name
        },
        '@children': []
      }
    });

    // ---- create new node ----
    let newNode;

    if (isWrapper) {
      console.log(`Creating ${nodeType} as WRAPPER`);
      // Handle special wrapper types that need specific children
      switch (nodeType) {
        case 'Fallback':
          newNode = {
            tagName: 'Fallback',
            content: {
              '@attributes': {
                ID: generateUniqueId('fallback_'),
                name: nodeName,
                ...attributes
              },
              '@children': [createSequence('Sequence1'), createSequence('Sequence2')]
            }
          };
          break;

        case 'Parallel':
          newNode = {
            tagName: 'Parallel',
            content: {
              '@attributes': {
                ID: generateUniqueId('parallel_'),
                name: nodeName,
                ...attributes
              },
              '@children': [createSequence('Sequence1'), createSequence('Sequence2')]
            }
          };
          break;

        case 'WhileDoElse':
          newNode = {
            tagName: 'WhileDoElse',
            content: {
              '@attributes': {
                ID: generateUniqueId('whiledoelse_'),
                name: nodeName,
                ...attributes
              },
              '@children': [
                createSequence('ConditionSeq'),
                createSequence('DoSeq'),
                createSequence('ElseSeq')
              ]
            }
          };
          break;

        default:
          // Generic wrapper node (includes all decorator wrappers)
          // Create children from default definition if specified
          const children = [];
          if (defaultChildren && defaultChildren.length > 0) {
            for (const childDef of defaultChildren) {
              if (childDef.type === 'Sequence') {
                children.push(createSequence(childDef.name || 'Sequence'));
              }
              // Add more child types here if needed
            }
          }

          newNode = {
            tagName: nodeType,
            content: {
              '@attributes': {
                ID: generateUniqueId(`${nodeType.toLowerCase()}_`),
                name: nodeName,
                ...attributes
              },
              '@children': children
            }
          };
          console.log(`Created ${nodeType} with children array:`, children.length);
          break;
      }
    } else {
      console.log(`Creating ${nodeType} as LEAF`);
      // Leaf node
      newNode = {
        tagName: nodeType,
        content: {
          '@attributes': {
            ID: generateUniqueId(`${nodeType.toLowerCase()}_`),
            name: nodeName,
            ...attributes
          },
          '@children': []  // Leaf nodes have empty children array
        }
      };
    }

    console.log(`Final node structure:`, JSON.stringify(newNode, null, 2));

    // ---- assign _uid recursively ----
    ensureUids(newNode.content);

    // ---- append to parent ----
    if (!parent['@children']) parent['@children'] = [];
    parent['@children'].push(newNode);

    // ---- save to file ----
    await writeXML(result);
    console.log(`Node added successfully!`);
    res.json({ success: true });
  } catch (err) {
    console.error('addNode error:', err);
    res.status(500).send('Failed to add node');
  }
});

// DELETE NODE
app.post('/deleteNode', async (req, res) => {
  const { subtreeId, nodePath } = req.body;

  try {
    const result = await readAndParseXML();
    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === subtreeId);
    if (!subtree) return res.status(404).send('Subtree not found');

    // navigate to parent
    let parent = subtree.content;
    for (let i = 0; i < nodePath.length - 1; i++) {
      const uid = nodePath[i];
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c =>
          c['@attributes']?._uid === uid ||
          c['@attributes']?.ID === uid
        );
      if (!next) return res.status(400).send(`Invalid path: ${uid}`);
      parent = next;
    }

    // remove target child
    const targetUid = nodePath[nodePath.length - 1];
    parent['@children'] = (parent['@children'] || [])
      .filter(c =>
        c.content['@attributes']?._uid !== targetUid &&
        c.content['@attributes']?.ID !== targetUid
      );

    ensureUids(result);
    await writeXML(result);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteNode error:', err);
    res.status(500).send('Failed to delete node');
  }
});

// DELETE SUBTREE
app.post('/deleteSubtree', async (req, res) => {
  const { subtreeId } = req.body;

  try {
    const result = await readAndParseXML();
    result['@children'] = result['@children']
      .filter(c => !(c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === subtreeId));
    await writeXML(result);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteSubtree error:', err);
    res.status(500).send('Failed to delete subtree');
  }
});
// ADD SUBTREE AS CHILD (FULL copy OR <SubTreePlus> reference)
app.post('/addSubtreeAsChild', async (req, res) => {
  const { subtreeId, parentPath, childSubtreeId, mode = 'full' } = req.body;

  try {
    const result = await readAndParseXML();

    // -------------------------------
    // Find target (current) subtree
    // -------------------------------
    const subtree = result['@children']
      .find(c =>
        c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === subtreeId
      );
    if (!subtree) {
      return res.status(404).send('Target subtree not found');
    }

    if (subtreeId === childSubtreeId) {
      return res.status(400).send('Cannot add subtree to itself');
    }

    // -------------------------------
    // Find child subtree definition
    // -------------------------------
    const childSubtree = result['@children']
      .find(c =>
        c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === childSubtreeId
      );
    if (!childSubtree) {
      return res.status(404).send('Child subtree not found');
    }

    // -------------------------------
    // Locate parent node using _uid path
    // -------------------------------
    let parent = subtree.content;
    for (const uid of parentPath) {
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c =>
          c['@attributes']?._uid === uid ||
          c['@attributes']?.ID === uid
        );

      if (!next) {
        return res.status(400).send(`Invalid parent path: ${uid}`);
      }
      parent = next;
    }

    if (!parent['@children']) parent['@children'] = [];

    // ==================================================
    // ⭐ HERE IS THE IMPORTANT PART (FULL vs REFERENCE)
    // ==================================================
    if (mode === 'reference') {
      // ---- <SubTreePlus> reference ----
      parent['@children'].push({
        tagName: 'SubTreePlus',
        content: {
          '@attributes': {
            ID: childSubtreeId
          }
        }
      });
    } else {
      // ---- FULL COPY ----
      const childCopy = JSON.parse(JSON.stringify(childSubtree));

      // Assign NEW _uid to all copied nodes
      (childCopy.content['@children'] || []).forEach(child => {
        ensureUids(child.content);
      });

      parent['@children'].push(...(childCopy.content['@children'] || []));
    }

    // -------------------------------
    // Save result
    // -------------------------------
    await writeXML(result);
    res.json({ success: true });

  } catch (err) {
    console.error('addSubtreeAsChild error:', err);
    res.status(500).send('Failed to add subtree as child');
  }
});


// DELETE WRAPPER ONLY
app.post('/deleteWrapperOnly', async (req, res) => {
  const { subtreeId, nodePath } = req.body;

  try {
    const result = await readAndParseXML();
    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === subtreeId);
    if (!subtree) return res.status(404).send('Subtree not found');

    const targetUid = nodePath[nodePath.length - 1];

    // locate parent
    let parent = subtree.content;
    for (let i = 0; i < nodePath.length - 1; i++) {
      const uid = nodePath[i];
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c =>
          c['@attributes']?._uid === uid ||
          c['@attributes']?.ID === uid
        );
      if (!next) return res.status(400).send(`Invalid path: ${uid}`);
      parent = next;
    }

    // find wrapper index
    const idx = (parent['@children'] || [])
      .findIndex(c =>
        c.content['@attributes']?._uid === targetUid ||
        c.content['@attributes']?.ID === targetUid
      );
    if (idx === -1) return res.status(400).send('Wrapper not found');

    const wrapper = parent['@children'][idx];
    const innerChildren = wrapper.content['@children'] || [];

    // replace wrapper with its children
    parent['@children'].splice(idx, 1, ...innerChildren);

    ensureUids(result);
    await writeXML(result);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteWrapperOnly error:', err);
    res.status(500).send('Failed to delete wrapper');
  }
});

// ADD WRAPPER
app.post('/addWrapper', async (req, res) => {
  const { subtreeId, nodePath, wrapperType } = req.body;

  try {
    const result = await readAndParseXML();
    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === subtreeId);
    if (!subtree) return res.status(404).send('Subtree not found');

    const wrapperTypes = ['Sequence', 'Fallback', 'Selector'];
    if (!wrapperTypes.includes(wrapperType))
      return res.status(400).send('Wrapper type invalid');

    const targetUid = nodePath[nodePath.length - 1];

    // locate parent
    let parent = subtree.content;
    for (let i = 0; i < nodePath.length - 1; i++) {
      const uid = nodePath[i];
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c =>
          c['@attributes']?._uid === uid ||
          c['@attributes']?.ID === uid
        );
      if (!next) return res.status(400).send(`Invalid path: ${uid}`);
      parent = next;
    }

    // locate target
    const idx = (parent['@children'] || [])
      .findIndex(c =>
        c.content['@attributes']?._uid === targetUid ||
        c.content['@attributes']?.ID === targetUid
      );
    if (idx === -1) return res.status(400).send('Target not found');

    const targetNode = parent['@children'][idx];
    const newWrapper = {
      tagName: wrapperType,
      content: {
        '@attributes': {
          ID: generateUniqueId(`${wrapperType.toLowerCase()}_`),
          name: `${wrapperType}_${targetNode.content['@attributes']?.name || 'wrapped'}`
        },
        '@children': [targetNode]
      }
    };

    ensureUids(newWrapper.content);
    parent['@children'].splice(idx, 1, newWrapper);

    await writeXML(result);
    res.json({ success: true });
  } catch (err) {
    console.error('addWrapper error:', err);
    res.status(500).send('Failed to add wrapper');
  }
});

// SWAP NODES
app.post('/swapNodes', async (req, res) => {
  const { subtreeId, nodePath1, nodePath2 } = req.body;
  if (!subtreeId || !Array.isArray(nodePath1) || !Array.isArray(nodePath2))
    return res.status(400).send('subtreeId and node paths required');

  try {
    const result = await readAndParseXML();
    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === subtreeId);
    if (!subtree) return res.status(404).send('Subtree not found');

    // locate parent
    let parent = subtree.content;
    for (let i = 0; i < nodePath1.length - 1; i++) {
      const uid = nodePath1[i];
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c =>
          c['@attributes']?._uid === uid ||
          c['@attributes']?.ID === uid
        );
      if (!next) return res.status(400).send(`Invalid path: ${uid}`);
      parent = next;
    }

    const uid1 = nodePath1[nodePath1.length - 1];
    const uid2 = nodePath2[nodePath2.length - 1];
    const children = parent['@children'] || [];

    const idx1 = children.findIndex(c =>
      c.content['@attributes']?._uid === uid1 ||
      c.content['@attributes']?.ID === uid1
    );
    const idx2 = children.findIndex(c =>
      c.content['@attributes']?._uid === uid2 ||
      c.content['@attributes']?.ID === uid2
    );

    if (idx1 === -1 || idx2 === -1)
      return res.status(400).send('One or both nodes not found');

    [children[idx1], children[idx2]] = [children[idx2], children[idx1]];

    ensureUids(result);
    await writeXML(result);
    res.json({ success: true });
  } catch (err) {
    console.error('swapNodes error:', err);
    res.status(500).send('Failed to swap nodes');
  }
});

app.post('/moveNodeAfter', async (req, res) => {
  const { subtreeId, sourcePath, targetPath } = req.body;
  if (!subtreeId || !Array.isArray(sourcePath) || !Array.isArray(targetPath))
    return res.status(400).send('subtreeId and node paths required');

  try {
    const result = await readAndParseXML();

    const subtree = result['@children']
      .find(c => c.tagName === 'BehaviorTree' &&
        c.content['@attributes'].ID === subtreeId);
    if (!subtree)
      return res.status(404).send('Subtree not found');

    // Locate common parent (both source and target have same parent)
    let parent = subtree.content;
    for (let i = 0; i < sourcePath.length - 1; i++) {
      const uid = sourcePath[i];
      const next = (parent['@children'] || [])
        .map(c => c.content)
        .find(c =>
          c['@attributes']?._uid === uid ||
          c['@attributes']?.ID === uid
        );
      if (!next) return res.status(400).send(`Invalid path: ${uid}`);
      parent = next;
    }

    const children = parent['@children'] || [];

    // Find indices
    const sourceUid = sourcePath[sourcePath.length - 1];
    const targetUid = targetPath[targetPath.length - 1];

    const srcIndex = children.findIndex(c =>
      c.content['@attributes']?._uid === sourceUid ||
      c.content['@attributes']?.ID === sourceUid
    );
    const targetIndex = children.findIndex(c =>
      c.content['@attributes']?._uid === targetUid ||
      c.content['@attributes']?.ID === targetUid
    );

    if (srcIndex === -1 || targetIndex === -1)
      return res.status(400).send('One or both nodes not found');

    // Safety: same node
    if (sourceUid === targetUid) {
      return res.status(400).send('Source and target cannot be the same');
    }

    // Safety: ensure both paths share same parent
    if (sourcePath.length !== targetPath.length ||
      sourcePath.slice(0, -1).join() !== targetPath.slice(0, -1).join()) {
      return res.status(400).send('Nodes must share the same parent');
    }

    // Remove and reinsert AFTER target
    const [moved] = children.splice(srcIndex, 1);
    // Adjust insertion index if removing before the target
    const insertIndex = srcIndex < targetIndex ? targetIndex : targetIndex + 1;
    children.splice(insertIndex, 0, moved);

    ensureUids(result);
    await writeXML(result);

    res.json({ success: true });
  } catch (err) {
    console.error('moveNodeAfter error:', err);
    res.status(500).send('Failed to move node');
  }
});


const XML_BASE_DIR =
  '/home/nextup/user_config_files/control_logic_data/behaviour_trees';

const XML_MAP = {
  mainTree: 'template_tree.xml',
  runPathTree: 'run_path.xml',
  doDiTree: 'do_di_tree.xml'
};

app.post('/getTreeXML', async (req, res) => {
  try {
    const { treeType } = req.body;

    if (!XML_MAP[treeType]) {
      return res.status(400).json({ message: 'Invalid tree type' });
    }

    const filePath = path.join(XML_BASE_DIR, XML_MAP[treeType]);

    const xmlText = await fs.readFile(filePath, 'utf8');

    const rootContent = parseXmlString(xmlText);
    stripInternalUids(rootContent);

    const xml = jsonToXml({ root: rootContent }, true);

    res.json({ xml, treeType });
  } catch (err) {
    console.error('❌ /getTreeXML error:', err);
    res.status(500).json({ message: err.message });
  }
});


// START SERVER
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));