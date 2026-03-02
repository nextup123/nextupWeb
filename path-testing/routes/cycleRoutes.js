const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const router = express.Router();

// ========== GRAPH AND CYCLE DETECTION FUNCTIONS ==========

// Build adjacency list from paths
function buildGraph(paths) {
  const graph = new Map();
  
  paths.forEach(path => {
    if (!graph.has(path.start_point)) {
      graph.set(path.start_point, []);
    }
    graph.get(path.start_point).push({
      node: path.end_point,
      path_name: path.name,
      plan_space: path.plan_space
    });
  });
  
  return graph;
}

// DFS-based cycle detection with path tracking
function findCyclesFromPoint(graph, startPoint, maxDepth = 10) {
  const cycles = [];
  const visited = new Set();
  const pathStack = [];
  const currentPath = [];

  function dfs(currentNode, depth) {
    if (depth > maxDepth) return; // Prevent infinite recursion
    
    visited.add(currentNode);
    pathStack.push(currentNode);
    currentPath.push(currentNode);

    const neighbors = graph.get(currentNode) || [];
    
    for (const neighbor of neighbors) {
      if (neighbor.node === startPoint) {
        // Found a cycle back to start point
        const cyclePath = [...currentPath, startPoint];
        const cycleEdges = [];
        
        // Build edge information for the cycle
        for (let i = 0; i < cyclePath.length - 1; i++) {
          const from = cyclePath[i];
          const to = cyclePath[i + 1];
          const edge = graph.get(from).find(e => e.node === to);
          if (edge) {
            cycleEdges.push({
              from: from,
              to: to,
              path_name: edge.path_name,
              plan_space: edge.plan_space
            });
          }
        }
        
        cycles.push({
          nodes: cyclePath,
          edges: cycleEdges,
          length: cyclePath.length - 1 // Number of edges
        });
      } else if (!visited.has(neighbor.node)) {
        dfs(neighbor.node, depth + 1);
      }
    }

    pathStack.pop();
    currentPath.pop();
    visited.delete(currentNode);
  }

  dfs(startPoint, 0);
  return cycles;
}

// Find all possible cycles (including those that don't start from the given point but contain it)
function findAllCyclesContainingPoint(graph, targetPoint, maxDepth = 10) {
  const allCycles = [];
  const visited = new Set();
  
  function dfs(currentNode, path, depth) {
    if (depth > maxDepth) return;
    
    if (currentNode === targetPoint && path.length > 1) {
      // Found a cycle containing the target point
      const cyclePath = [...path, targetPoint];
      const cycleEdges = [];
      
      // Build edge information for the cycle
      for (let i = 0; i < cyclePath.length - 1; i++) {
        const from = cyclePath[i];
        const to = cyclePath[i + 1];
        const edge = graph.get(from)?.find(e => e.node === to);
        if (edge) {
          cycleEdges.push({
            from: from,
            to: to,
            path_name: edge.path_name,
            plan_space: edge.plan_space
          });
        }
      }
      
      // Check if this cycle is not already found
      const cycleKey = cyclePath.join('->');
      if (!allCycles.some(c => c.key === cycleKey)) {
        allCycles.push({
          key: cycleKey,
          nodes: cyclePath,
          edges: cycleEdges,
          length: cyclePath.length - 1,
          starts_from_target: path[0] === targetPoint
        });
      }
      return;
    }
    
    if (visited.has(currentNode)) return;
    
    visited.add(currentNode);
    path.push(currentNode);
    
    const neighbors = graph.get(currentNode) || [];
    for (const neighbor of neighbors) {
      if (neighbor.node === targetPoint || !visited.has(neighbor.node)) {
        dfs(neighbor.node, path, depth + 1);
      }
    }
    
    path.pop();
    visited.delete(currentNode);
  }
  
  // Start DFS from all neighbors of the target point
  const neighbors = graph.get(targetPoint) || [];
  for (const neighbor of neighbors) {
    dfs(neighbor.node, [targetPoint], 1);
  }
  
  return allCycles;
}

// Load paths data (reusing functions from pathRoutes)
function loadPathsData() {
  try {
    const pathsData = loadYAMLFile('/home/nextup/user_config_files/planning_data/paths/paths.yaml');
    return pathsData ? pathsData.paths.map(createPathObject) : [];
  } catch (error) {
    console.error('Error loading paths data:', error.message);
    return [];
  }
}

// Helper functions from pathRoutes
function loadYAMLFile(filePath) {
  try {
    const yamlData = fs.readFileSync(filePath, 'utf8');
    return yaml.load(yamlData);
  } catch (error) {
    console.error(`Error loading YAML file ${filePath}:`, error.message);
    return null;
  }
}

function createPathObject(pathData) {
  return {
    name: pathData.name,
    plan_space: pathData.plan_space,
    start_point: pathData.start_point,
    end_point: pathData.end_point
  };
}

// ========== LOGGING FUNCTIONS ==========

function logCycleResults(pointName, cycles, searchType) {
  console.log(`\n=== CYCLE DETECTION RESULTS for "${pointName}" (${searchType}) ===`);
  
  if (cycles.length === 0) {
    console.log('No cycles found.');
    return;
  }
  
  console.log(`Found ${cycles.length} cycle(s):\n`);
  
  cycles.forEach((cycle, index) => {
    console.log(`Cycle ${index + 1} (Length: ${cycle.length} edges):`);
    console.log(`  Path: ${cycle.nodes.join(' → ')}`);
    console.log(`  Edges:`);
    cycle.edges.forEach(edge => {
      console.log(`    - ${edge.path_name} (${edge.plan_space}): ${edge.from} → ${edge.to}`);
    });
    console.log('');
  });
}

// ========== ENDPOINTS ==========

// Main endpoint to find cycles from a specific point
router.get('/find_cycles/:pointName', (req, res) => {
  try {
    const pointName = req.params.pointName;
    const searchType = req.query.type || 'from_point'; // 'from_point' or 'containing_point'
    const maxDepth = parseInt(req.query.max_depth) || 15;

    if (!pointName) {
      return res.status(400).json({ error: 'Point name is required' });
    }

    const paths = loadPathsData();
    
    if (paths.length === 0) {
      return res.status(500).json({ error: 'Failed to load paths data' });
    }

    // Build graph
    const graph = buildGraph(paths);
    
    // Check if point exists in graph
    if (!graph.has(pointName) && !Array.from(graph.values()).some(neighbors => 
      neighbors.some(n => n.node === pointName))) {
      return res.status(404).json({ error: `Point "${pointName}" not found in any path` });
    }

    let cycles;
    if (searchType === 'containing_point') {
      cycles = findAllCyclesContainingPoint(graph, pointName, maxDepth);
    } else {
      cycles = findCyclesFromPoint(graph, pointName, maxDepth);
    }

    // Sort cycles by length (shortest first)
    cycles.sort((a, b) => a.length - b.length);

    logCycleResults(pointName, cycles, searchType);

    res.json({
      point_name: pointName,
      search_type: searchType,
      max_depth: maxDepth,
      summary: {
        total_cycles_found: cycles.length,
        total_paths_analyzed: paths.length
      },
      cycles: cycles.map(cycle => ({
        length: cycle.length,
        nodes: cycle.nodes,
        edges: cycle.edges,
        path_sequence: cycle.nodes.join(' → ')
      }))
    });

  } catch (error) {
    console.error('Error in cycle detection:', error.message);
    res.status(500).json({ error: 'Failed to find cycles: ' + error.message });
  }
});

// Endpoint to get all available points
router.get('/available_points', (req, res) => {
  try {
    const paths = loadPathsData();
    
    if (paths.length === 0) {
      return res.status(500).json({ error: 'Failed to load paths data' });
    }

    const points = new Set();
    paths.forEach(path => {
      points.add(path.start_point);
      points.add(path.end_point);
    });

    const pointsArray = Array.from(points).sort();

    res.json({
      available_points: pointsArray,
      total_points: pointsArray.length
    });

  } catch (error) {
    console.error('Error getting available points:', error.message);
    res.status(500).json({ error: 'Failed to get available points: ' + error.message });
  }
});

// Endpoint to analyze graph structure
router.get('/graph_analysis', (req, res) => {
  try {
    const paths = loadPathsData();
    
    if (paths.length === 0) {
      return res.status(500).json({ error: 'Failed to load paths data' });
    }

    const graph = buildGraph(paths);
    
    const analysis = {
      total_nodes: graph.size,
      total_edges: paths.length,
      nodes_with_outgoing: Array.from(graph.entries()).map(([node, neighbors]) => ({
        node: node,
        outgoing_edges: neighbors.length,
        neighbors: neighbors.map(n => n.node)
      })),
      isolated_nodes: Array.from(graph.keys()).filter(node => 
        !Array.from(graph.values()).some(neighbors => 
          neighbors.some(n => n.node === node)
        )
      )
    };

    console.log('\n=== GRAPH ANALYSIS ===');
    console.log(`Total nodes: ${analysis.total_nodes}`);
    console.log(`Total edges: ${analysis.total_edges}`);
    console.log('\nNodes with outgoing edges:');
    analysis.nodes_with_outgoing.forEach(nodeInfo => {
      console.log(`  ${nodeInfo.node}: ${nodeInfo.outgoing_edges} edges → [${nodeInfo.neighbors.join(', ')}]`);
    });
    if (analysis.isolated_nodes.length > 0) {
      console.log(`\nIsolated nodes (no incoming edges): [${analysis.isolated_nodes.join(', ')}]`);
    }

    res.json(analysis);

  } catch (error) {
    console.error('Error in graph analysis:', error.message);
    res.status(500).json({ error: 'Failed to analyze graph: ' + error.message });
  }
});

module.exports = router;