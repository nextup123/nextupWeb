// utils/robotUtils.js
// Shared utilities for robot path and pose operations

const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const POINTS_FILE = '/home/nextup/NextupRobot/src/active_project_configs/planning_data/points.yaml';
const PATHS_FILE = '/home/nextup/NextupRobot/src/active_project_configs/planning_data/paths.yaml';
const DEFAULT_TOLERANCE = 0.0001;
const REQUIRED_JOINT_COUNT = 6;
const JOINT_KEYS = ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'];

// ---------- Basic Utility Functions ----------
function toPlainArray(v) {
  if (Array.isArray(v)) return v.slice();
  if (v && typeof v.length === 'number') return Array.from(v);
  return [];
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeDiffs(a, b) {
  const diffs = [];
  for (let i = 0; i < REQUIRED_JOINT_COUNT; i++) {
    diffs.push(Math.abs((a[i] || 0) - (b[i] || 0)));
  }
  return diffs;
}

function compareSix(a, b, tol = DEFAULT_TOLERANCE) {
  for (let i = 0; i < REQUIRED_JOINT_COUNT; i++) {
    if (Math.abs((a[i] || 0) - (b[i] || 0)) > tol) return false;
  }
  return true;
}

function extractFirstSixPositions(msg) {
  const positions = toPlainArray(msg.position || []);
  if (positions.length < REQUIRED_JOINT_COUNT) return null;
  return positions.slice(0, REQUIRED_JOINT_COUNT).map(safeNum);
}

function jointsValuesToArray(jointsValues) {
  if (!jointsValues || typeof jointsValues !== 'object') {
    return Array(REQUIRED_JOINT_COUNT).fill(0);
  }
  
  const joints = [];
  for (let i = 0; i < REQUIRED_JOINT_COUNT; i++) {
    joints.push(safeNum(jointsValues[JOINT_KEYS[i]]));
  }
  return joints;
}

// ---------- YAML Loading and Caching ----------
let cachedPoints = null;
let cachedPaths = null;
let pointsLoadedAt = null;
let pathsLoadedAt = null;

function loadYAMLRaw(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return yaml.load(raw);
  } catch (err) {
    console.error(`Failed to load YAML ${filePath}:`, err && err.message);
    return null;
  }
}

function convertPointEntry(p) {
  if (!p) return null;
  
  // Handle both object format and array format
  const joints = [];
  
  if (p.joints_values && typeof p.joints_values === 'object') {
    // Object format: joints_values.joint1..joint6
    for (let i = 0; i < REQUIRED_JOINT_COUNT; i++) {
      joints.push(safeNum(p.joints_values[JOINT_KEYS[i]]));
    }
  } else if (Array.isArray(p.joints_values)) {
    // Array format: joints_values as array
    for (let i = 0; i < REQUIRED_JOINT_COUNT; i++) {
      joints.push(safeNum(p.joints_values[i]));
    }
  } else if (p.data && Array.isArray(p.data) && p.data.length > 0) {
    // Path data format: data[0].positions
    const firstPositions = p.data[0].positions || [];
    for (let i = 0; i < REQUIRED_JOINT_COUNT; i++) {
      joints.push(safeNum(firstPositions[i]));
    }
  }
  
  return {
    name: p.name || null,
    date_time: p.date_time || null,
    sequence: p.sequence || null,
    nature: p.nature || null,
    joints: joints,
    joints_values: p.joints_values || null,
    coordinate: p.coordinate || null
  };
}

function convertPathEntry(p) {
  if (!p) return null;
  
  let expected_start_pose = null;
  let expected_end_pose = null;
  
  if (p.data && Array.isArray(p.data) && p.data.length > 0) {
    expected_start_pose = p.data[0].positions || null;
    expected_end_pose = p.data[p.data.length - 1].positions || null;
  }
  
  return {
    name: p.name || null,
    plan_space: p.plan_space || null,
    start_point: p.start_point || null,
    end_point: p.end_point || null,
    data: {
      expected_start_pose: expected_start_pose,
      expected_end_pose: expected_end_pose
    }
  };
}

function loadPointsCached() {
  if (cachedPoints) return cachedPoints;
  
  const data = loadYAMLRaw(POINTS_FILE);
  if (!data || !Array.isArray(data.points)) {
    cachedPoints = [];
    return cachedPoints;
  }
  
  cachedPoints = data.points.map(convertPointEntry).filter(p => p !== null);
  pointsLoadedAt = new Date();
  return cachedPoints;
}

function loadPathsCached() {
  if (cachedPaths) return cachedPaths;
  
  const data = loadYAMLRaw(PATHS_FILE);
  if (!data || !Array.isArray(data.paths)) {
    cachedPaths = [];
    return cachedPaths;
  }
  
  cachedPaths = data.paths.map(convertPathEntry).filter(p => p !== null);
  pathsLoadedAt = new Date();
  return cachedPaths;
}

// ---------- Analysis Functions ----------
function findAvailablePathsFromPoint(pointName) {
  if (!pointName) return [];
  const paths = loadPathsCached();
  return paths.filter(p => p.start_point === pointName);
}

function analyzePathContinuity(paths, points) {
  const pointsMap = new Map();
  points.forEach(point => {
    pointsMap.set(point.name, point);
  });

  const continuityResults = paths.map(path => {
    const startPoint = pointsMap.get(path.start_point);
    const endPoint = pointsMap.get(path.end_point);

    let startMatch = false;
    let endMatch = false;
    let startMismatchDetails = null;
    let endMismatchDetails = null;

    // Check start point continuity
    if (startPoint && path.data.expected_start_pose) {
      const actualStartPose = startPoint.joints;
      startMatch = compareSix(path.data.expected_start_pose, actualStartPose);
      
      if (!startMatch) {
        startMismatchDetails = {
          expected: path.data.expected_start_pose,
          actual: actualStartPose
        };
      }
    }

    // Check end point continuity  
    if (endPoint && path.data.expected_end_pose) {
      const actualEndPose = endPoint.joints;
      endMatch = compareSix(path.data.expected_end_pose, actualEndPose);
      
      if (!endMatch) {
        endMismatchDetails = {
          expected: path.data.expected_end_pose,
          actual: actualEndPose
        };
      }
    }

    return {
      path_name: path.name,
      start_point: path.start_point,
      end_point: path.end_point,
      plan_space: path.plan_space,
      continuity: {
        start_point_match: startMatch,
        end_point_match: endMatch,
        fully_continuous: startMatch && endMatch
      },
      mismatches: {
        start: startMismatchDetails,
        end: endMismatchDetails
      }
    };
  });

  return continuityResults;
}

function findDuplicatePoints(points) {
  const duplicates = new Map();
  const processed = new Set();

  points.forEach((point1, index1) => {
    if (processed.has(point1.name)) return;

    const point1Joints = point1.joints;
    const duplicateGroup = [point1];

    points.forEach((point2, index2) => {
      if (index1 !== index2 && !processed.has(point2.name)) {
        const point2Joints = point2.joints;
        if (compareSix(point1Joints, point2Joints)) {
          duplicateGroup.push(point2);
          processed.add(point2.name);
        }
      }
    });

    if (duplicateGroup.length > 1) {
      processed.add(point1.name);
      duplicates.set(point1.name, duplicateGroup);
    }
  });

  return duplicates;
}

// Watch files and invalidate cache when changed
try {
  fs.watchFile(POINTS_FILE, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      console.log('points.yaml changed — reloading cache');
      cachedPoints = null;
      loadPointsCached();
    }
  });
} catch (e) { /* ignore if file not present yet */ }

try {
  fs.watchFile(PATHS_FILE, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      console.log('paths.yaml changed — reloading cache');
      cachedPaths = null;
      loadPathsCached();
    }
  });
} catch (e) { /* ignore if file not present yet */ }

// Export all functions
module.exports = {
  // Basic utilities
  toPlainArray,
  safeNum,
  computeDiffs,
  compareSix,
  comparePoses: compareSix, // Alias for compatibility
  extractFirstSixPositions,
  jointsValuesToArray,
  
  // Data loading
  loadYAMLRaw,
  convertPointEntry,
  convertPathEntry,
  loadPointsCached,
  loadPathsCached,
  
  // Analysis functions
  findAvailablePathsFromPoint,
  analyzePathContinuity,
  findDuplicatePoints,
  
  // Constants
  POINTS_FILE,
  PATHS_FILE,
  DEFAULT_TOLERANCE,
  REQUIRED_JOINT_COUNT,
  JOINT_KEYS,
  
  // Cached data accessors (read-only)
  getCachedPoints: () => cachedPoints,
  getCachedPaths: () => cachedPaths,
  getPointsLoadedAt: () => pointsLoadedAt,
  getPathsLoadedAt: () => pathsLoadedAt
};