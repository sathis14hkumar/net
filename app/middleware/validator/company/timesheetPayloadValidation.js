const { check } = require('express-validator');

module.exports.approvalValidation = [
  check('businessUnitId', 'Enter valid business id')
    .notEmpty()
    .isAlphanumeric(),
  check('clocked', 'Enter valid clocked').notEmpty().isBoolean(),
  check('neither', 'Enter valid neither').notEmpty().isBoolean(),
  check('shift', 'Enter valid shift').notEmpty().isBoolean(),
  check('breakTime', 'Enter valid break time')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('approveClockInTime', 'Enter valid approve Clock In Time')
    .notEmpty()
    .isString(),
  check('approveClockOutTime', 'Enter valid approve Clock Out Time')
    .notEmpty()
    .isString(),
  check('shiftDetailId', 'Enter valid shift details id')
    .notEmpty()
    .isAlphanumeric(),
  check('shiftId', 'Enter valid shift id').notEmpty().isAlphanumeric(),
  check('userId', 'Enter valid user id').notEmpty().isAlphanumeric(),
  check('neitherMessage', 'Enter valid neitherMessage')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('_id', 'Enter valid id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];
module.exports.lockValidation = [
  check('_id', 'Enter valid id').notEmpty().isAlphanumeric(),
];
module.exports.lockcallValidation = [
  check('ids', 'Enter valid ids').notEmpty().isArray(),
];
