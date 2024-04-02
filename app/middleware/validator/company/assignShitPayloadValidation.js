const { check } = require('express-validator');

module.exports.assginshiftStaffUpdate = [
  check('user.*.assignShiftId', 'Enter valid assign shift id')
    .notEmpty()
    .isAlphanumeric(),
  check('user.*.Date', 'Enter valid Date').notEmpty().isString(),
  check('user.*.StartDate', 'Enter valid start Date').notEmpty().isString(),
  check('user.*.StartTime', 'Enter valid start time').notEmpty().isString(),
  check('user.*.EndDate', 'Enter valid end Date').notEmpty().isString(),
  check('user.*.EndTime', 'Enter valid end time').notEmpty().isString(),
  check('user.*.timeFormat', 'Enter valid time format').notEmpty().isString(),
  check('user.*.isOff', 'Enter valid isOff').notEmpty().isBoolean(),
  check('user.*.isRest', 'Enter valid isRest').notEmpty().isBoolean(),
  check('user.*.splitStartTime', 'Enter valid splitStartTime')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('user.*.splitEndTime', 'Enter valid splitEndTime')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),

  check('user.*.splitStartDate', 'Enter valid split start Date')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isString(),
  check('user.*.spiltEndDate', 'Enter valid split end date')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isString(),

  check('user.*.isSplitShift', 'Enter valid isSplitShift')
    .notEmpty()
    .isBoolean(),
  check('user.*.isCheckInEnabled', 'Enter valid isCheckInEnabled')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('user.*.isProximityEnabled', 'Enter valid isProximityEnabled')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check('user.*.proximity', 'Enter valid proximity')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('user.*.geoReportingLocation', 'Enter valid geoReportingLocation')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('user.*.reportLocationId', 'Enter valid reportLocationId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('user.*.subSkillSets', 'Enter valid subSkillSets')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
];

module.exports.assginshiftStafflisting = [
  check('businessUnitId', 'Enter valid business unit Id')
    .notEmpty()
    .isAlphanumeric(),
  check('plannedBy', 'Enter valid planned Id').notEmpty().isAlphanumeric(),
  check('timeFormat', 'Enter valid timeFormat').notEmpty().isString(),
  check('userId', 'Enter valid user Id').notEmpty().isAlphanumeric(),
  check('weekNumber', 'Enter valid week number').notEmpty().isNumeric(),
  check('weekRangeEndsAt', 'Enter valid weekRangeEndsAt').notEmpty().isString(),
  check('weekRangeStartsAt', 'Enter valid weekRangeStartsAt')
    .notEmpty()
    .isString(),
];

module.exports.assginshiftStaffDelete = [
  check('assignShiftId', 'Enter valid assignShiftId')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('userId', 'Enter valid userId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];

module.exports.assginshiftPublishAll = [
  check('businessUnitId', 'Enter valid business unit id')
    .notEmpty()
    .isAlphanumeric(),
  check('weekRangeStartsAt', 'Enter valid week range startsAt')
    .notEmpty()
    .isString(),
  check('weekRangeEndsAt', 'Enter valid week range EndsAt')
    .notEmpty()
    .isString(),
  check('assignShiftIds', 'Enter valid assign shift Ids')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
];

module.exports.alertactionAssginshift = [
  check('assignShiftId', 'Enter valid assign shift id')
    .notEmpty()
    .isAlphanumeric(),
  check('from', 'Enter valid assign shift from')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];
