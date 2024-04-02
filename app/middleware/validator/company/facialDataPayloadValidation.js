const { check } = require('express-validator');

module.exports.createValidation = [
  check('userId', 'Enter valid user id').notEmpty().isAlphanumeric(),
  check('facialInfo', 'Enter valid facial info').notEmpty().isString(),
  check('descriptor', 'Enter valid descriptor').notEmpty().isArray(),
];
