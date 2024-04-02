const { body, check } = require('express-validator');

module.exports.createOrUpdateValidation = [
  body('businessUnitId', 'Enter valid business unit id')
    .notEmpty()
    .isAlphanumeric(),
  body('businessUnitName', 'Enter valid business unit name')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('weekRangeStartsAt', 'Enter valid week Range Starts At')
    .notEmpty()
    .isString(),
  body('weekRangeEndsAt', 'Enter valid week Range Ends At')
    .notEmpty()
    .isString(),
  body('shifts', 'Enter valid shift').notEmpty().isArray(),
  body('shifts.*.staffNeedCount', 'Enter valid shift count')
    .notEmpty()
    .isNumeric()
    .custom((value) => value > 0),
  body('shifts.*.dayDate', 'Enter valid shift days').notEmpty().isArray(),
  body('shifts.*.dayDate.*.date', 'Enter valid shift date')
    .notEmpty()
    .isString(),
  body('shifts.*.dayDate.*.day', 'Enter valid shift day').notEmpty().isString(),
  body('shifts.*.dayDate.*.startTime', 'Enter valid shift start time')
    .notEmpty()
    .isString(),
  body('shifts.*.dayDate.*.endTime', 'Enter valid shift end time')
    .notEmpty()
    .isString(),
  body('shifts.*.dayDate.*.splitStartTime', 'Enter valid shift start time')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('shifts.*.dayDate.*.splitEndTime', 'Enter valid shift end time')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('shifts.*.dayDate.*.isSplitShift', 'Enter valid shift shift time')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  body('shifts.*.reportLocationId', 'Enter valid shift report location id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  body('shifts.*.status', 'Enter valid shift status')
    .notEmpty()
    .isNumeric()
    .isIn([1]),
  body('shifts.*.isSplitShift', 'Enter valid split shift')
    .notEmpty()
    .isBoolean(),
  body('shifts.*.backUpStaffNeedCount', 'Enter valid backUp staff need count')
    .notEmpty()
    .isNumeric()
    .custom((value) => value >= 0),
  body(
    'shifts.*.geoReportingLocation',
    'Enter valid shift geo reporting location',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  body('shifts.*.subSkillSets', 'Enter valid shift skills sets')
    .notEmpty()
    .isArray(),
  body('shifts.*.subSkillSets', 'Enter valid shift skills sets')
    .notEmpty()
    .isArray(),
  body('status', 'Enter valid status').notEmpty().isNumeric().isIn([1]),
  body('isTemplate', 'Enter valid isTemplate')
    .notEmpty()
    .isNumeric()
    .isIn([0, 1]),
  body('platform', 'Enter valid platform')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('skillSetTierType', 'Enter valid skill Set Tier Type')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2]),
  body('proximity', 'Enter valid proximity')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => value >= 0),
  body('isCheckInEnabled', 'Enter valid isCheckInEnabled')
    .notEmpty()
    .isBoolean(),
  body('isProximityEnabled', 'Enter valid isProximityEnabled')
    .notEmpty()
    .isBoolean(),
  body('templateId', 'Enter valid template id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];

module.exports.removeValidation = [
  check('templateId', 'Enter valid template id').notEmpty().isAlphanumeric(),
];

module.exports.deleteShiftInTemplateValidation = [
  check('templateId', 'Enter valid template id').notEmpty().isAlphanumeric(),
  check('planShiftToDelete', 'Enter valid planShiftToDelete')
    .notEmpty()
    .isAlphanumeric(),
];
