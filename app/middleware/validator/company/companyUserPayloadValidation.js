const { check } = require('express-validator');

module.exports.createValidation = [
  check('name', 'Enter valid user name').notEmpty().isString(),
  check('staffId', 'Enter valid staff id').notEmpty().isString(),
  check('email', 'Enter valid email').notEmpty().isEmail(),
  check('appointmentId', 'Enter valid appointment id')
    .notEmpty()
    .isAlphanumeric(),
  check(
    'staffPassExpiryDate',
    'Enter valid staff password expiry date',
  ).isString(),
  check('contactNumber', 'Enter valid contact number')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isLength({ min: 6, max: 10 }),
  check('allBUAccess', 'Enter valid BU Access').notEmpty().isNumeric(),
  check('role', 'Enter valid user role').notEmpty().isAlphanumeric(),
  check('leaveGroupId', 'Enter valid leave Group Id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('parentBussinessUnitId', 'Enter valid user parent Bussiness Unit Id')
    .notEmpty()
    .isAlphanumeric(),
  check(
    'planBussinessUnitId',
    'Enter valid user plan Bussiness Unit Id',
  ).isArray(),
  check('viewBussinessUnitId', 'Enter valid view bussiness unit id').isArray(),
  check('otherFields', 'Enter valid fields').isArray(),
  check('otherFields.*.fieldId', 'Enter valid fields id').isAlphanumeric(),
  check('otherFields.*.editable', 'Enter valid editable fields').isBoolean(),
  check('otherFields.*.value', 'Enter valid value').isString(),
  check('status', 'Enter valid status')
    .notEmpty()
    .isNumeric()
    .isIn([0, 1, 2, 3]),
  check('isFlexiStaff', 'Enter valid Flexi Staff value').notEmpty().isNumeric(),
];
module.exports.updateValidation = [
  check('name', 'Enter valid user name')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('staffId', 'Enter valid staff id')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('email', 'Enter valid email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail(),
  check('appointmentId', 'Enter valid appointment id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('staffPassExpiryDate', 'Enter valid staff password expiry date')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('contactNumber', 'Enter valid contact number')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isLength({ min: 6, max: 10 }),
  check('allBUAccess', 'Enter valid BU Access')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('role', 'Enter valid user role')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('leaveGroupId', 'Enter valid leave Group Id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('parentBussinessUnitId', 'Enter valid user parent Bussiness Unit Id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('planBussinessUnitId', 'Enter valid user plan Bussiness Unit Id')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('viewBussinessUnitId', 'Enter valid view bussiness unit id')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('otherFields', 'Enter valid fields')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('otherFields.*.fieldId', 'Enter valid fields id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('otherFields.*.editable', 'Enter valid editable fields')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('otherFields.*.value', 'Enter valid value')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('status', 'Enter valid status')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isIn([0, 1, 2, 3]),
  check('userId', 'Enter valid user id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('schemeId', 'Enter valid scheme id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('skillSetTierType', 'Enter valid skillSet tier type')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('subSkillSets', 'Enter valid sub skill sets')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
];

module.exports.readValidation = [
  check('userId', 'Enter valid user id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];
