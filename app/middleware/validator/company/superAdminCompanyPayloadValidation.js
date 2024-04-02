const { body } = require('express-validator');
const { isObjectId } = require('../../validators');

const createCompany = [
  body('name', 'Enter valid name').notEmpty().isString(),
  body('email', 'Enter valid email').isEmail().isString(),
];

const updateCompany = [
  body('name', 'Enter valid name').notEmpty().isString(),
  body('email', 'Enter valid email').isEmail().isString(),
  body('companyId', 'Enter valid companyId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('status', 'Enter valid status').notEmpty().isInt().isIn([1, 2]),
  body('file', 'Enter valid file')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty(),
];

module.exports = {
  createCompany,
  updateCompany,
};
