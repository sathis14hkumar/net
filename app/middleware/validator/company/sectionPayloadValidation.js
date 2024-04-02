const { check } = require('express-validator');

module.exports.createValidation = [
  check('name', 'Enter valid section name').notEmpty().isString(),
  check('departmentId', 'Enter valid department id')
    .notEmpty()
    .isAlphanumeric(),
  check('status', 'Enter valid section status')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2, 3]),
];
module.exports.updateValidation = [
  check('name', 'Enter valid section name').notEmpty().isString(),
  check('status', 'Enter valid section staus')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2, 3]),
  check('sectionId', 'Enter valid section id').notEmpty().isAlphanumeric(),
];

module.exports.deleteValidation = [
  check('sectionId', 'Enter valid section id').notEmpty().isAlphanumeric(),
];
