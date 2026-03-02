function validateSequenceAgainstPaths(sequence, yamlPaths) {
  const pathMap = new Map();
  yamlPaths.forEach(p => pathMap.set(p.name, p));

  const errors = [];
  const warnings = [];

  sequence.steps.forEach((step, index) => {
    const yamlPath = pathMap.get(step.path);

    if (!yamlPath) {
      errors.push({
        step: index + 1,
        path: step.path,
        reason: 'PATH_NOT_FOUND'
      });
      return;
    }

    if (yamlPath.start_point !== step.from) {
      warnings.push({
        step: index + 1,
        path: step.path,
        reason: 'START_POINT_MISMATCH',
        expected: yamlPath.start_point,
        actual: step.from
      });
    }

    if (yamlPath.end_point !== step.to) {
      warnings.push({
        step: index + 1,
        path: step.path,
        reason: 'END_POINT_MISMATCH',
        expected: yamlPath.end_point,
        actual: step.to
      });
    }

    if (yamlPath.plan_space !== step.plan_space) {
      warnings.push({
        step: index + 1,
        path: step.path,
        reason: 'PLAN_SPACE_MISMATCH'
      });
    }
  });

  return {
    compatible: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = { validateSequenceAgainstPaths };
