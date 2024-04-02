const { check } = require('express-validator');

module.exports.createValidation = [
  check('name', 'Enter valid subsection name').notEmpty().isString(),
  check('sectionId', 'Enter valid section id').notEmpty().isAlphanumeric(),
  check('status', 'Enter valid subsection status')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2, 3]),
];
module.exports.updateValidation = [
  check('name', 'Enter valid subsection name').notEmpty().isString(),
  check('subSectionId', 'Enter valid subsection staus')
    .notEmpty()
    .isAlphanumeric(),
  check('sectionId', 'Enter valid subsection id').notEmpty().isAlphanumeric(),
];

module.exports.deleteValidation = [
  check('subSectionId', 'Enter valid subsection id')
    .notEmpty()
    .isAlphanumeric(),
];
