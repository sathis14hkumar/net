const { check } = require('express-validator');

module.exports.createValidation = [
  check('name', 'Enter valid appointment name').notEmpty().isString(),
  check('status', 'Enter valid appointment status')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2, 3]),
];
module.exports.updateValidation = [
  check('name', 'Enter valid appointment name').notEmpty().isString(),
  check('appointmentId', 'Enter valid appointment id')
    .notEmpty()
    .isAlphanumeric(),
  check('status', 'Enter valid appointment status')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2, 3]),
];

module.exports.deleteValidation = [
  check('appointmentId', 'Enter valid appointment id')
    .notEmpty()
    .isAlphanumeric(),
];
