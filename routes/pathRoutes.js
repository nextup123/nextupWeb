const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const router = express.Router();


// Load and parse YAML files
function loadYAMLFile(filePath) {
  try {
    const yamlData = fs.readFileSync(filePath, 'utf8');
    return yaml.load(yamlData);
  } catch (error) {
    console.error(`Error loading YAML file ${filePath}:`, error.message);
    return null;
  }
}

// Create Path Object
function createPathObject(pathData) {
  if (!pathData.data || pathData.data.length === 0) {
    return {
      ...pathData,
      data: {
        expected_start_pose: null,
        expected_end_pose: null
      }
    };
  }

  return {
    name: pathData.name,
    plan_space: pathData.plan_space,
    start_point: pathData.start_point,
    end_point: pathData.end_point,
    data: {
      expected_start_pose: pathData.data[0].positions,
      expected_end_pose: pathData.data[pathData.data.length - 1].positions
    }
  };
}

// Create Point Object
function createPointObject(pointData) {
  return {
    name: pointData.name,
    date_time: pointData.date_time,
    sequence: pointData.sequence,
    nature: pointData.nature,
    joints_values: pointData.joints_values,
    coordinate: pointData.coordinate
  };
}

// Compare arrays with 4 decimal precision
function comparePoses(pose1, pose2, tolerance = 0.0001) {
  if (!pose1 || !pose2) return false;
  if (pose1.length !== pose2.length) return false;
  
  for (let i = 0; i < pose1.length; i++) {
    if (Math.abs(pose1[i] - pose2[i]) > tolerance) {
      return false;
    }
  }
  return true;
}

// Convert joint values object to array in correct order
function jointsValuesToArray(jointsValues) {
  return [
    jointsValues.joint1,
    jointsValues.joint2, 
    jointsValues.joint3,
    jointsValues.joint4,
    jointsValues.joint5,
    jointsValues.joint6
  ];
}

// ========== DATA LOADING FUNCTIONS ==========

function loadPathsData() {
  const pathsData = loadYAMLFile('/home/nextup/user_config_files/planning_data/paths/paths.yaml');
  return pathsData ? pathsData.paths.map(createPathObject) : [];
}

function loadPointsData() {
  const pointsData = loadYAMLFile('/home/nextup/user_config_files/planning_data/points/points.yaml');
  return pointsData ? pointsData.points.map(createPointObject) : [];
}

function loadTestingPointsData() {
  const testingPointsData = loadYAMLFile('/home/nextup/user_config_files/planning_data/points/points.yaml');
  return testingPointsData ? testingPointsData.points.map(createPointObject) : [];
}

// ========== ANALYSIS FUNCTIONS ==========

function analyzePathContinuity(paths, points) {
  // Create points lookup map
  const pointsMap = new Map();
  points.forEach(point => {
    pointsMap.set(point.name, point);
  });

  // Check continuity for each path
  const continuityResults = paths.map(path => {
    const startPoint = pointsMap.get(path.start_point);
    const endPoint = pointsMap.get(path.end_point);

    let startMatch = false;
    let endMatch = false;
    let startMismatchDetails = null;
    let endMismatchDetails = null;

    // Check start point continuity
    if (startPoint && path.data.expected_start_pose) {
      const actualStartPose = jointsValuesToArray(startPoint.joints_values);
      startMatch = comparePoses(path.data.expected_start_pose, actualStartPose);
      
      if (!startMatch) {
        startMismatchDetails = {
          expected: path.data.expected_start_pose,
          actual: actualStartPose
        };
      }
    }

    // Check end point continuity  
    if (endPoint && path.data.expected_end_pose) {
      const actualEndPose = jointsValuesToArray(endPoint.joints_values);
      endMatch = comparePoses(path.data.expected_end_pose, actualEndPose);
      
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

    const point1Joints = jointsValuesToArray(point1.joints_values);
    const duplicateGroup = [point1];

    // Compare with all other points
    points.forEach((point2, index2) => {
      if (index1 !== index2 && !processed.has(point2.name)) {
        const point2Joints = jointsValuesToArray(point2.joints_values);
        if (comparePoses(point1Joints, point2Joints)) {
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

// ========== LOGGING FUNCTIONS ==========

function logPathContinuityResults(continuityResults) {
  console.log('\n=== PATH CONTINUITY CHECK RESULTS ===');
  continuityResults.forEach(result => {
    const status = result.continuity.fully_continuous ? '✓ CONTINUOUS' : '✗ BROKEN';
    console.log(`\n${result.path_name}: ${status}`);
    console.log(`  Start: ${result.start_point} - ${result.continuity.start_point_match ? '✓' : '✗'}`);
    console.log(`  End: ${result.end_point} - ${result.continuity.end_point_match ? '✓' : '✗'}`);
    
    if (!result.continuity.start_point_match && result.mismatches.start) {
      console.log(`  Start Mismatch:`);
      console.log(`    Expected: [${result.mismatches.start.expected.map(v => v.toFixed(6)).join(', ')}]`);
      console.log(`    Actual:   [${result.mismatches.start.actual.map(v => v.toFixed(6)).join(', ')}]`);
    }
    
    if (!result.continuity.end_point_match && result.mismatches.end) {
      console.log(`  End Mismatch:`);
      console.log(`    Expected: [${result.mismatches.end.expected.map(v => v.toFixed(6)).join(', ')}]`);
      console.log(`    Actual:   [${result.mismatches.end.actual.map(v => v.toFixed(6)).join(', ')}]`);
    }
  });

  // Summary
  const continuousPaths = continuityResults.filter(r => r.continuity.fully_continuous).length;
  const totalPaths = continuityResults.length;
  console.log(`\n=== SUMMARY ===`);
  console.log(`Continuous paths: ${continuousPaths}/${totalPaths}`);
  console.log(`Broken paths: ${totalPaths - continuousPaths}/${totalPaths}`);
}

function logDuplicatePoints(duplicates) {
  console.log('\n=== DUPLICATE POINTS ANALYSIS ===');
  
  if (duplicates.size === 0) {
    console.log('No duplicate points found.');
    return;
  }

  console.log(`Found ${duplicates.size} groups of duplicate points:\n`);

  let groupCount = 1;
  duplicates.forEach((pointsGroup, key) => {
    console.log(`Group ${groupCount}:`);
    pointsGroup.forEach(point => {
      const jointsArray = jointsValuesToArray(point.joints_values);
      console.log(`  - ${point.name} (${point.nature})`);
      console.log(`    Joints: [${jointsArray.map(v => v.toFixed(6)).join(', ')}]`);
      console.log(`    Coordinate: x:${point.coordinate.x}, y:${point.coordinate.y}, z:${point.coordinate.z}`);
    });
    console.log('');
    groupCount++;
  });
}

// ========== ENDPOINTS ==========

// Endpoint to check path continuity
router.get('/check_path_continuity', (req, res) => {
  try {
    const paths = loadPathsData();
    const points = loadPointsData();

    if (paths.length === 0 || points.length === 0) {
      return res.status(500).json({ error: 'Failed to load YAML files' });
    }

    const continuityResults = analyzePathContinuity(paths, points);
    logPathContinuityResults(continuityResults);

    const continuousPaths = continuityResults.filter(r => r.continuity.fully_continuous).length;
    const totalPaths = continuityResults.length;

    res.json({
      summary: {
        total_paths: totalPaths,
        continuous_paths: continuousPaths,
        broken_paths: totalPaths - continuousPaths
      },
      results: continuityResults
    });

  } catch (error) {
    console.error('Error in path continuity check:', error.message);
    res.status(500).json({ error: 'Failed to check path continuity: ' + error.message });
  }
});

// New endpoint to find duplicate points
router.get('/check_duplicate_points', (req, res) => {
  try {
    const points = loadTestingPointsData();

    if (points.length === 0) {
      return res.status(500).json({ error: 'Failed to load points YAML file' });
    }

    const duplicates = findDuplicatePoints(points);
    logDuplicatePoints(duplicates);

    // Convert Map to array for JSON response
    const duplicatesArray = Array.from(duplicates.values());

    res.json({
      summary: {
        total_points: points.length,
        duplicate_groups: duplicates.size,
        total_duplicate_points: duplicatesArray.reduce((sum, group) => sum + group.length, 0)
      },
      duplicate_groups: duplicatesArray
    });

  } catch (error) {
    console.error('Error in duplicate points check:', error.message);
    res.status(500).json({ error: 'Failed to check duplicate points: ' + error.message });
  }
});

// Endpoint to get all paths (for visualization)
router.get('/paths', (req, res) => {
  try {
    const paths = loadPathsData();
    const points = loadPointsData();

    if (paths.length === 0 || points.length === 0) {
      return res.status(500).json({ error: 'Failed to load YAML files' });
    }

    res.json({
      paths: paths,
      points: points
    });

  } catch (error) {
    console.error('Error loading paths:', error.message);
    res.status(500).json({ error: 'Failed to load paths: ' + error.message });
  }
});

// Endpoint to get testing points
router.get('/testing_points', (req, res) => {
  try {
    const points = loadTestingPointsData();

    if (points.length === 0) {
      return res.status(500).json({ error: 'Failed to load testing points YAML file' });
    }

    res.json({
      points: points
    });

  } catch (error) {
    console.error('Error loading testing points:', error.message);
    res.status(500).json({ error: 'Failed to load testing points: ' + error.message });
  }
});




module.exports = router;