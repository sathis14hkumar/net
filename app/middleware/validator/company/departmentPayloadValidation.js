const { check } = require('express-validator');

module.exports.createValidation = [
  check('name', 'Enter valid company name').notEmpty().isString(),
  check('status', 'Enter valid company status')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2, 3]),
  check('companyId', 'Enter valid company id').notEmpty().isString(),
];

module.exports.updateValidation = [
  check('departmentId', 'Enter valid department id')
    .notEmpty()
    .isAlphanumeric(),
  check('name', 'Enter valid company name').notEmpty().isString(),
  check('companyId', 'Enter valid company id').notEmpty().isString(),
];

module.exports.deleteValidation = [
  check('departmentId', 'Enter valid department id')
    .notEmpty()
    .isAlphanumeric(),
];
