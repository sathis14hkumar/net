const { check, param } = require('express-validator');

module.exports.createValidation = [
  check('adminId', 'Enter valid admin id').notEmpty().isArray(),
  check('buId', 'Enter valid business id').notEmpty().isArray(),
  check('isDraft', 'Enter valid isDraft').notEmpty().isBoolean(),
  check('noOfTeam', 'Enter valid no of team').notEmpty().isNumeric(),
  check('opsGroupName', 'Enter valid no ops Group Name').notEmpty().isString(),
  check('opsTeam', 'Enter valid no ops team')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('swopSetup', 'Enter valid swop Setup').notEmpty().isNumeric(),
  check('userId', 'Enter valid userId')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
];

module.exports.updateValidation = [
  check('adminId', 'Enter valid admin id').notEmpty().isArray(),
  check('buId', 'Enter valid business id').notEmpty().isArray(),
  check('isDraft', 'Enter valid isDraft').notEmpty().isBoolean(),
  check('noOfTeam', 'Enter valid no of team').notEmpty().isNumeric(),
  check('opsGroupName', 'Enter valid no ops Group Name').notEmpty().isString(),
  check('opsTeam', 'Enter valid no ops team')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('opsTeam.*.userId', 'Enter valid no ops team')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('opsTeam.*.isInputDisabled', 'Enter valid no ops team')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('swopSetup', 'Enter valid swop Setup').notEmpty().isNumeric(),
  check('userId', 'Enter valid userId')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('_id', 'Enter valid ops Group id').notEmpty().isAlphanumeric(),
];

module.exports.deleteValidation = [
  param('opsGroupId', 'Enter valid ops group id').notEmpty().isAlphanumeric(),
];

module.exports.removeStaffValidation = [
  check('userId', 'Enter valid userId').notEmpty().isArray(),
  check('teamId', 'Enter valid team id')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isAlphanumeric(),
];
