const { body } = require('express-validator');
const { isObjectId } = require('../../validators');

const getStaffs = [
  body('businessUnitId', 'Enter valid businessUnitId')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

module.exports = {
  getStaffs,
};
