const { check, param } = require('express-validator');

module.exports.createValidation = [
  check('fieldName', 'Enter valid field name').notEmpty().isString(),
  check('type', 'Enter valid field type').notEmpty().isString(),
  check('options', 'Enter valid option').isArray(),
  check('indexNum', 'Enter valid index number').notEmpty().isNumeric(),
  check('editable', 'Enter valid editable field').notEmpty().isBoolean(),
];
module.exports.updateValidation = [
  check('fieldId', 'Enter valid field id').notEmpty().isAlphanumeric(),
  check('fieldName', 'Enter valid field name').notEmpty().isString(),
  check('type', 'Enter valid field type').notEmpty().isString(),
  check('options', 'Enter valid option').isArray(),
  check('indexNum', 'Enter valid index number').notEmpty().isNumeric(),
  check('editable', 'Enter valid editable field').notEmpty().isBoolean(),
];

module.exports.removeValidation = [
  param('fieldId', 'Enter valid field id').notEmpty().isAlphanumeric(),
];
