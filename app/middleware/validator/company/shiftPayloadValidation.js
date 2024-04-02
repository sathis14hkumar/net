const { check } = require('express-validator');

module.exports.createValidation = [
  check('businessUnitId', 'Enter valid business unit id')
    .notEmpty()
    .isAlphanumeric(),
  check('businessUnitName', 'Enter valid business unit name').isString(),
  check('weekRangeStartsAt', 'Enter valid week Range Starts At')
    .notEmpty()
    .isString(),
  check('weekRangeEndsAt', 'Enter valid week Range Ends At')
    .notEmpty()
    .isString(),
  check('shifts', 'Enter valid shift').notEmpty().isArray(),
  check('shifts.*.staffNeedCount', 'Enter valid shift count')
    .notEmpty()
    .isNumeric()
    .custom((value) => value > 0),
  check('shifts.*.dayDate', 'Enter valid shift days').notEmpty().isArray(),
  check('shifts.*.dayDate.*.date', 'Enter valid shift date')
    .notEmpty()
    .isString(),
  check('shifts.*.dayDate.*.day', 'Enter valid shift day')
    .notEmpty()
    .isString(),
  check('shifts.*.dayDate.*.startTime', 'Enter valid shift start time')
    .notEmpty()
    .isString(),
  check('shifts.*.dayDate.*.endTime', 'Enter valid shift end time')
    .notEmpty()
    .isString(),
  check(
    'shifts.*.dayDate.*.splitStartTime',
    'Enter valid shift start time',
  ).isString(),
  check(
    'shifts.*.dayDate.*.splitEndTime',
    'Enter valid shift end time',
  ).isString(),
  check(
    'shifts.*.dayDate.*.isSplitShift',
    'Enter valid shift shift time',
  ).isBoolean(),
  check('shifts.*.reportLocationId', 'Enter valid shift report location id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('shifts.*.status', 'Enter valid shift status')
    .notEmpty()
    .isNumeric()
    .isIn([1]),
  check('shifts.*.isSplitShift', 'Enter valid split shift')
    .notEmpty()
    .isBoolean(),
  check('shifts.*.backUpStaffNeedCount', 'Enter valid backUp staff need count')
    .notEmpty()
    .isNumeric()
    .custom((value) => value >= 0),
  check(
    'shifts.*.geoReportingLocation',
    'Enter valid shift geo reporting location',
  ),
  check('shifts.*.subSkillSets', 'Enter valid shift skills sets')
    .notEmpty()
    .isArray(),
  check('shifts.*.subSkillSets', 'Enter valid shift skills sets')
    .notEmpty()
    .isArray(),
  check('status', 'Enter valid status').notEmpty().isNumeric().isIn([1]),
  check('isTemplate', 'Enter valid isTemplate')
    .notEmpty()
    .isNumeric()
    .isIn([0, 1]),
  check('platform', 'Enter valid platform').notEmpty().isString(),
  check('skillSetTierType', 'Enter valid skill Set Tier Type')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isIn([1, 2]),
  check('proximity', 'Enter valid proximity')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => value >= 0),
  check('isCheckInEnabled', 'Enter valid isCheckInEnabled')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('isProximityEnabled', 'Enter valid isProximityEnabled')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
];

module.exports.adjustValidation = [
  check('businessUnitId', 'Enter valid business unit id')
    .notEmpty()
    .isAlphanumeric(),
  check('shiftDetailsId', 'Enter valid shift Details Id')
    .notEmpty()
    .isAlphanumeric(),
  check('startDate', 'Enter valid start data').notEmpty().isString(),
  check('staffNeedCount', 'Enter valid staff need count')
    .notEmpty()
    .isNumeric()
    .custom((value) => value > 0),
];

module.exports.cancelShiftValidation = [
  check('shiftId', 'Enter valid shift id').notEmpty().isAlphanumeric(),
  check('shiftDetailsId', 'Enter valid shift Details Id')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.cancelIndividualShiftValidation = [
  check('shiftId', 'Enter valid shift id').notEmpty().isAlphanumeric(),
  check('shiftDetailsId', 'Enter valid shift Details Id')
    .notEmpty()
    .isAlphanumeric(),
  check('userId', 'Enter valid start data').notEmpty().isAlphanumeric(),
];

module.exports.checklimitValidation = [
  check('from', 'Enter valid shift from').notEmpty().isString(),
  check('userId', 'Enter valid user Id').notEmpty().isAlphanumeric(),
  check('shiftDetailsId', 'Enter valid shift Details Id')
    .notEmpty()
    .isAlphanumeric(),
  check('startDateTime', 'Enter valid start date time').notEmpty().isString(),
  check('endDateTime', 'Enter valid end date time').notEmpty().isString(),
];

module.exports.requestChangeValidation = [
  check('shiftId', 'Enter valid shift id').notEmpty().isAlphanumeric(),
  check('shiftDetailsId', 'Enter valid shift Details Id')
    .notEmpty()
    .isAlphanumeric(),
  check('startTime', 'Enter valid start time').notEmpty().isString(),
  check('endTime', 'Enter valid end time').notEmpty().isString(),
  check('reportLocationId', 'Enter valid reportLocationId')
    .notEmpty()
    .isAlphanumeric(),
  check('staffNeedCount', 'Enter valid staffNeedCount')
    .notEmpty()
    .isNumeric()
    .custom((value) => value > 0),
];

module.exports.stopRequestingValidation = [
  check('shiftId', 'Enter valid shift id').notEmpty().isAlphanumeric(),
  check('shiftDetailsId', 'Enter valid shift Details Id')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.shiftCreateRestoffValidation = [
  check('shiftDetailId', 'Enter valid shift Detail Id')
    .notEmpty()
    .isAlphanumeric(),
  check('startTime', 'Enter valid start time').notEmpty().isString(),
  check('endTime', 'Enter valid end time').notEmpty().isString(),
  check('reportLocationId', 'Enter valid reportLocationId')
    .notEmpty()
    .isAlphanumeric(),
  check('mainSkillSets', 'Enter valid mainSkillSets').isArray(),
  check('subSkillSets', 'Enter valid subSkillSets').isArray(),
  check('isOffed', 'Enter valid isOffed').notEmpty().isBoolean(),
  check('isRested', 'Enter valid isRested').notEmpty().isBoolean(),
  check('userId', 'Enter valid userId').notEmpty().isAlphanumeric(),
  check('assignShiftId', 'Enter valid assignShiftId')
    .notEmpty()
    .isAlphanumeric(),
  check('isSplitShift', 'Enter valid isSplitShift').notEmpty().isBoolean(),
  check('splitStartTime', 'Enter valid splitStartTime').notEmpty().isString(),
  check('splitEndTime', 'Enter valid splitEndTime').notEmpty().isString(),
];
