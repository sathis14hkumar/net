const { check } = require('express-validator');

module.exports.bookingslistValidation = [
  check('startDate', 'Enter valid start date').notEmpty().isString(),
  check('cancelledShifts', 'Enter valid cancelledShifts')
    .notEmpty()
    .isBoolean(),
  check('type', 'Enter valid type'),
];

module.exports.checklimitPayload = [
  check('shiftDetailsId', 'Enter valid shift Details Id')
    .notEmpty()
    .isAlphanumeric(),
  check('isConfirmed', 'Enter valid isConfirmed').notEmpty().isNumeric(),
  check('splitShiftDetailsId', 'Enter valid split Shift Details Id').optional({
    nullable: true,
    checkFalsy: true,
  }),
  check('isSplitShift', 'Enter valid isSplitShift').notEmpty().isBoolean(),
  check('from', 'Enter valid from').notEmpty().isString(),
];

module.exports.shiftExtensionConfirmationValidation = [
  check('shiftDetailId', 'Enter valid shift Detail Id')
    .notEmpty()
    .isAlphanumeric(),
  check('userId', 'Enter valid userId').notEmpty().isAlphanumeric(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
];

module.exports.resRequestShiftChangeChecklimitValidation = [
  check('shiftDetailsId._id', 'Enter valid shift Detail Id')
    .notEmpty()
    .isAlphanumeric(),
  check(
    'shiftDetailsId.referenceShiftDetailsId',
    'Enter valid shift referenceShiftDetailsId',
  )
    .notEmpty()
    .isAlphanumeric(),
  check('shiftDetailsId.appliedStaffs', 'Enter valid shift Detail date')
    .notEmpty()
    .isArray(),
  check('isAccepted', 'Enter valid isAccepted').notEmpty().isNumeric(),
];

module.exports.resRequestShiftChangeValidation = [
  check('shiftDetailsId', 'Enter valid shiftDetailsId')
    .notEmpty()
    .isAlphanumeric(),
  check('isAccepted', 'Enter valid isAccepted').notEmpty().isNumeric(),
];

module.exports.staffshiftCancelValidation = [
  check('isSplitShift', 'Enter valid isSplitShift').notEmpty().isBoolean(),
  check('shiftDetailsId', 'Enter valid shiftDetailsId')
    .notEmpty()
    .isAlphanumeric(),
  check('splitShiftDetailsId', 'Enter valid splitShiftDetailsId').optional({
    nullable: true,
    checkFalsy: true,
  }),
];
