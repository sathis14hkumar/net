const { body, check } = require('express-validator');

module.exports.createOrUpdateValidation = [
  check('name', 'Enter valid name').notEmpty().isString(),
  check('isQuotaExceed', 'Enter valid isQuotaExceed').notEmpty().isBoolean(),
  check('type', 'Enter valid type').notEmpty().isString(),
  check('leaveTypeId', 'Enter valid leave Type Id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];

module.exports.deleteValidation = [
  check('leaveTypeId', 'Enter valid leave Type Id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];

module.exports.createLeaveGrouptValidation = [
  body('name', 'Enter valid name').notEmpty().isString(),
  body('leaveType', 'Enter valid leave type').notEmpty().isArray(),
  body('leaveType.*.leaveTypeId', 'Enter valid leave type id')
    .notEmpty()
    .isAlphanumeric(),
  body('leaveType.*.displayQuota', 'Enter valid display quota')
    .notEmpty()
    .isBoolean(),
  body('leaveType.*.quota', 'Enter valid quota')
    .notEmpty()
    .isNumeric()
    .custom((value) => value >= 0),
  body('leaveType.*.specialType', 'Enter valid specialType')
    .notEmpty()
    .isBoolean(),
  body('leaveType.*.displayInMyLeave', 'Enter valid display in my leave')
    .notEmpty()
    .isBoolean(),
  body('leaveType.*.proRate', 'Enter valid proRate').notEmpty().isArray(),
  body('leaveType.*.proRate.*.fromMonth', 'Enter valid fromMonth')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .custom((value) => value >= 0 && value <= 12),
  body('leaveType.*.proRate.*.toMonth', 'Enter valid toMonth')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .custom((value) => value >= 0 && value <= 12),
  body('leaveType.*.proRate.*.quota', 'Enter valid quota')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .custom((value) => value >= 0),
  body('leaveType.*.seniority', 'Enter valid seniority').notEmpty().isArray(),
  body('leaveType.*.seniority.*.year', 'Enter valid year')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .custom((value) => value >= 0 && value <= 12),
  body('leaveType.*.seniority.*.quota', 'Enter valid quota')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .custom((value) => value >= 0),
  body(
    'leaveType.*.leavePlanning.isLeaveRequest',
    'Enter valid leave planning request',
  )
    .notEmpty()
    .isBoolean(),
  body(
    'leaveType.*.leavePlanning.isAdminAllocate',
    'Enter valid admin allocated leave',
  )
    .notEmpty()
    .isBoolean(),

  body(
    'leaveType.*.leaveApplication.isApplyLeavePlan',
    'Enter valid apply leave plan',
  )
    .notEmpty()
    .isBoolean(),
  body('leaveType.*.leaveApplication.isApplyLeave', 'Enter valid applied leave')
    .notEmpty()
    .isBoolean(),

  body('adminId', 'Enter valid admin ids').notEmpty().isArray(),
];

module.exports.updateLeaveGrouptValidation = [
  check('name', 'Enter valid name').notEmpty().isString(),
  check('leaveType', 'Enter valid leave type').notEmpty().isArray(),
  check('leaveType.*.leaveTypeId', 'Enter valid leave type id')
    .notEmpty()
    .isAlphanumeric(),
  check('leaveType.*.displayQuota', 'Enter valid display quota')
    .notEmpty()
    .isBoolean(),
  check('leaveType.*.quota', 'Enter valid quota')
    .notEmpty()
    .isNumeric()
    .custom((value) => value >= 0),
  check('leaveType.*.specialType', 'Enter valid specialType')
    .notEmpty()
    .isBoolean(),
  check('leaveType.*.displayInMyLeave', 'Enter valid display in my leave')
    .notEmpty()
    .isBoolean(),
  check('leaveType.*.proRate', 'Enter valid proRate').notEmpty().isArray(),
  check('leaveType.*.proRate.*.fromMonth', 'Enter valid fromMonth')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => value >= 0 && value <= 12),
  check('leaveType.*.proRate.*.toMonth', 'Enter valid toMonth')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => value >= 0 && value <= 12),
  check('leaveType.*.proRate.*.quota', 'Enter valid quota')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => value >= 0),
  check('leaveType.*.seniority', 'Enter valid seniority').notEmpty().isArray(),
  check('leaveType.*.seniority.*.year', 'Enter valid year')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => value >= 0 && value <= 12),
  check('leaveType.*.seniority.*.quota', 'Enter valid quota')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => value >= 0),
  check(
    'leaveType.*.leavePlanning.isLeaveRequest',
    'Enter valid leave planning request',
  )
    .notEmpty()
    .isBoolean(),
  check(
    'leaveType.*.leavePlanning.isAdminAllocate',
    'Enter valid admin allocated leave',
  )
    .notEmpty()
    .isBoolean(),

  check(
    'leaveType.*.leaveApplication.isApplyLeavePlan',
    'Enter valid apply leave plan',
  )
    .notEmpty()
    .isBoolean(),
  check(
    'leaveType.*.leaveApplication.isApplyLeave',
    'Enter valid applied leave',
  )
    .notEmpty()
    .isBoolean(),

  check('adminId', 'Enter valid admin ids').notEmpty().isArray(),
  check('leaveGroupId', 'Emter valid leave group id')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.deleteLeaveGroupValidation = [
  check('leaveGroupId', 'Enter valid leave group Id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];
