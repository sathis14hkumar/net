const { body, check, param } = require('express-validator');

module.exports.usersbydateBu = [
  check('buId', 'Enter valid business unit id').notEmpty().isAlphanumeric(),
  check('date', 'Enter valid date')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('timeZone', 'Enter valid timeZone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];

module.exports.leaveTypeBu = [
  check('buId', 'Enter valid business unit id').notEmpty().isAlphanumeric(),
  check('date', 'Enter valid date')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('timeZone', 'Enter valid timeZone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];

module.exports.usersByDate = [
  check('opsGroupId', 'Enter valid ops Group Id').notEmpty().isAlphanumeric(),
  check('year', 'Enter valid year')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('date', 'Enter valid date')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('timeZone', 'Enter valid timeZone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];

module.exports.leavetypeNewleaveplanner = [
  check('opsGroupId', 'Enter valid ops Group Id').notEmpty().isAlphanumeric(),
  check('year', 'Enter valid year')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('date', 'Enter valid date')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('timeZone', 'Enter valid timeZone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];

module.exports.staffLeaveType = [
  check('userId', 'Enter valid user Id').notEmpty().isAlphanumeric(),
  check('year', 'Enter valid year')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
];

module.exports.checkOverLap = [
  check('leaveTypeId', 'Enter valid leaveTypeId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('leaveGroupId', 'Enter valid leaveGroupId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('userId', 'Enter valid ops Group Id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('businessUnitId', 'Enter valid businessUnitId')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('timeZone', 'Enter valid timeZone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('startDate', 'Enter valid startDate')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('endDate', 'Enter valid endDate')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];

module.exports.allocatteleave = [
  check('leaveTypeId', 'Enter valid leave Type Id').notEmpty().isAlphanumeric(),
  check('leaveGroupId', 'Enter valid leave group Id')
    .notEmpty()
    .isAlphanumeric(),
  check('userId', 'Enter valid user Id').notEmpty().isAlphanumeric(),
  check('businessUnitId', 'Enter validbusinessUnitId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('timeZone', 'Enter valid timeZone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('startDate', 'Enter valid startDate').notEmpty().isString(),
  check('endDate', 'Enter valid endDate').notEmpty().isString(),
  check('type', 'Enter valid type')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('isSwappable', 'Enter valid isSwappable')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isIn([1, 2]),
  check('remark', 'Enter valid remark')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('submittedFrom', 'Enter valid submittedFrom')
    .notEmpty()
    .isNumeric()
    .isIn([3]),
  check('startAt', 'Enter valid startAt').notEmpty().isString(),
  check('endAt', 'Enter valid endAt').notEmpty().isString(),
  check('opsGroupId', 'Enter valid opsGroupId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];
module.exports.allocateLeaveChangeDate = [
  body('userId', 'Enter valid user Id').notEmpty().isAlphanumeric(),
  body('startDate', 'Enter valid startDate').notEmpty().isString(),
  body('endDate', 'Enter valid endDate').notEmpty().isString(),
  body('remark', 'Enter valid remark')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('timeZone', 'Enter valid timeZone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('leaveAppliedId', 'Enter valid leaveAppliedId')
    .notEmpty()
    .isAlphanumeric(),
  body('startAt', 'Enter valid startAt').notEmpty().isString(),
  body('endAt', 'Enter valid endAt').notEmpty().isString(),
  body('isSwappable', 'Enter valid isSwappable')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isIn([1, 2]),
];

module.exports.cancelNewleaveplanner = [
  check('leaveAppliedId', 'Enter valid leaveAppliedId')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.leaveStatus = [
  check('appliedLeaveId', 'Enter valid appliedLeaveId')
    .notEmpty()
    .isAlphanumeric(),
  check('isApprove', 'Enter valid isApprove').notEmpty().isBoolean(),
  check('approvalRemark', 'Enter valid approvalRemark')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('approvalFrom', 'Enter valid approvalFrom')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('totalDeducated', 'Enter valid totalDeducated')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('totalRestOff', 'Enter valid totalRestOff')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
];

module.exports.userLeaveLogs = [
  check('userId', 'Enter valid user id').notEmpty().isAlphanumeric(),
  check('year', 'Enter valid year').notEmpty().isNumeric(),
];

module.exports.exportLeavePlanner = [
  check('startDate', 'Enter valid startDate')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('endDate', 'Enter valid endDate')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('timeZone', 'Enter valid timeZone')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('opsGroupId', 'Enter valid opsGroupId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('opsTeamId', 'Enter valid opsTeamId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];

module.exports.addperdayopsquota = [
  check('opsGroup.id', 'Enter valid ops group id').notEmpty().isAlphanumeric(),
  check('opsGroup.name', 'Enter valid ops group name').notEmpty().isString(),
  check('opsGroup.quota', 'Enter valid ops group quota').notEmpty().isArray(),
];

module.exports.getuserslistwithswapBallot = [
  check('opsGroupId', 'Enter valid opsGroup id').notEmpty().isAlphanumeric(),
];

module.exports.swaprestricttouserBallot = [
  param('userid', 'Enter valid user id').notEmpty().isAlphanumeric(),
];
