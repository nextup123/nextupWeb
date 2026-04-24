// utils/robotData.js
const fs = require('fs');
const yaml = require('js-yaml');
const chokidar = require('chokidar');

const POINTS_FILE = '/home/nextup/NextupRobot/src/active_project_configs/planning_data/points.yaml';
const PATHS_FILE = '/home/nextup/NextupRobot/src/active_project_configs/planning_data/paths.yaml';
const TOLERANCE = 0.0001;

// Cache + invalidation
let cachedPoints = null;
let cachedPaths = null;
let pointsMTime = 0;
let pathsMTime = 0;

function loadYAML(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content);
  } catch (err) {
    console.error(`Failed to load ${filePath}:`, err.message);
    return null;
  }
}

function jointsObjectToArray(jointsObj) {
  if (!jointsObj) return null;
  return [
    jointsObj.joint1 ?? 0,
    jointsObj.joint2 ?? 0,
    jointsObj.joint3 ?? 0,
    jointsObj.joint4 ?? 0,
    jointsObj.joint5 ?? 0,
    jointsObj.joint6 ?? 0,
  ];
}

function createPointObject(pointData) {
  return {
    name: pointData.name,
    date_time: pointData.date_time,
    sequence: pointData.sequence,
    nature: pointData.nature,
    joints: jointsObjectToArray(pointData.joints_values),
    coordinate: pointData.coordinate || null,
  };
}

function loadPoints() {
  const data = loadYAML(POINTS_FILE);
  if (!data || !Array.isArray(data.points)) return [];
  return data.points.map(createPointObject);
}

function loadRawPaths() {
  const data = loadYAML(PATHS_FILE);
  if (!data || !Array.isArray(data.paths)) return [];
  return data.paths;
}

function clearCacheIfChanged() {
  let changed = false;
  try {
    const pStat = fs.statSync(POINTS_FILE);
    if (pStat.mtimeMs > pointsMTime) {
      cachedPoints = null;
      pointsMTime = pStat.mtimeMs;
      changed = true;
    }
  } catch (_) {}
  try {
    const pStat = fs.statSync(PATHS_FILE);
    if (pStat.mtimeMs > pathsMTime) {
      cachedPaths = null;
      pathsMTime = pStat.mtimeMs;
      changed = true;
    }
  } catch (_) {}
  return changed;
}

function getPoints() {
  clearCacheIfChanged();
  if (!cachedPoints) {
    cachedPoints = loadPoints();
    console.log(`Loaded ${cachedPoints.length} points`);
  }
  return cachedPoints;
}

function getPaths() {
  clearCacheIfChanged();
  if (!cachedPaths) {
    const points = getPoints();
    const pointMap = new Map(points.map(p => [p.name, p]));
    const raw = loadRawPaths();

    cachedPaths = raw.map(path => {
      const startPt = pointMap.get(path.start_point);
      const endPt = pointMap.get(path.end_point);

      return {
        name: path.name,
        plan_space: path.plan_space,
        start_point: path.start_point,
        end_point: path.end_point,
        expected_start_pose: startPt ? startPt.joints : null,
        expected_end_pose: endPt ? endPt.joints : null,
        trajectory: path.data || [],
      };
    });
    console.log(`Loaded ${cachedPaths.length} paths`);
  }
  return cachedPaths;
}

function comparePoses(a, b, tol = TOLERANCE) {
  if (!a || !b) return false;
  for (let i = 0; i < 6; i++) {
    if (Math.abs(a[i] - b[i]) > tol) return false;
  }
  return true;
}

function findDuplicatePoints(points) {
  const groups = new Map();
  const seen = new Map();

  for (const point of points) {
    if (!point.joints) continue;
    const key = point.joints.map(v => v.toFixed(8)).join('|');
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(point);
  }

  for (const [key, group] of seen) {
    if (group.length > 1) {
      groups.set(`group_${group[0].name}`, group);
    }
  }
  return groups;
}

function analyzePathContinuity() {
  const paths = getPaths();
  const points = getPoints();
  const pointMap = new Map(points.map(p => [p.name, p]));

  return paths.map(path => {
    const startPoint = pointMap.get(path.start_point);
    const endPoint = pointMap.get(path.end_point);

    const startMatch = startPoint && path.expected_start_pose
      ? comparePoses(path.expected_start_pose, startPoint.joints)
      : false;

    const endMatch = endPoint && path.expected_end_pose
      ? comparePoses(path.expected_end_pose, endPoint.joints)
      : false;

    return {
      path_name: path.name,
      start_point: path.start_point,
      end_point: path.end_point,
      plan_space: path.plan_space,
      continuity: {
        start_point_match: startMatch,
        end_point_match: endMatch,
        fully_continuous: startMatch && endMatch,
      },
      mismatches: {
        start: !startMatch && startPoint ? {
          expected: path.expected_start_pose,
          actual: startPoint.joints,
        } : null,
        end: !endMatch && endPoint ? {
          expected: path.expected_end_pose,
          actual: endPoint.joints,
        } : null,
      },
    };
  });
}

// Auto-reload on file change
chokidar.watch('/home/nextup/NextupRobot/src/active_project_configs/**/*.yaml')
  .on('change', (path) => {
    console.log(`File changed: ${path} → Reloading data...`);
    cachedPoints = cachedPaths = null;
  });

module.exports = {
  getPoints,
  getPaths,
  comparePoses,
  findDuplicatePoints,
  analyzePathContinuity,
  TOLERANCE,
};