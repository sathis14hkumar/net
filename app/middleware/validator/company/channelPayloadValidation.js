const { body, param } = require('express-validator');
const { isObjectId } = require('../../validators');

const createChannel = [
  body('name', 'Enter valid name').notEmpty().isString(),
  body('category', 'Enter valid category').notEmpty().isArray(),
  body('category.*.name', 'Enter valid categoryName').notEmpty().isString(),
  body('category.*._id', 'Enter valid categoryId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('status', 'Enter valid status').notEmpty().isInt(),
  body('assignUsers', 'Enter valid assignUsers').notEmpty().isArray(),
  body('assignUsers.*.businessUnits', 'Enter valid BusinessUnits')
    .notEmpty()
    .isArray(),
  body('assignUsers.*.businessUnits.*', 'Enter valid businessUnits')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.buFilterType', 'buFilterType must be 1, 2, or 3')
    .notEmpty()
    .isInt()
    .isIn([1, 2, 3]),
  body('assignUsers.*.appointments', 'Enter valid appointments').isArray(),
  body('assignUsers.*.appointments.*', 'Enter valid appointments')
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.subSkillSets', 'Enter valid subSkillSets').isArray(),
  body('assignUsers.*.subSkillSets.*', 'Enter valid subSkillSets')
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.user', 'Enter valid user').isArray(),
  body('assignUsers.*.user.*', 'Enter valid user')
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.admin', 'Enter valid admin').notEmpty().isArray(),
  body('assignUsers.*.admin.*', 'Enter valid admin')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.allBuToken', 'Enter valid allBuToken')
    .notEmpty()
    .isBoolean(),
  body(
    'assignUsers.*.allBuTokenStaffId',
    'Enter valid allBuTokenStaffId',
  ).isString(),
  body('assignUsers.*.customField', 'Enter valid customField').isArray(),
  body('assignUsers.*.customField.*._id', 'Enter valid customFieldId')
    .matches(isObjectId)
    .isString(),
  body(
    'assignUsers.*.customField.*.name',
    'Enter valid customFieldName',
  ).isString(),
  body('assignUsers.*.customField.*.fieldId', 'Enter valid customFieldFieldId')
    .matches(isObjectId)
    .isString(),
  body(
    'assignUsers.*.customField.*.value',
    'Enter valid customFieldValue',
  ).isString(),
];

const updateChannel = [
  body('name', 'Enter valid name').notEmpty().isString(),
  body('category', 'Enter valid category').notEmpty().isArray(),
  body('category.*.name', 'Enter valid categoryName').notEmpty().isString(),
  body('category.*._id', 'Enter valid categoryId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('status', 'Enter valid status').notEmpty().isInt(),
  body('assignUsers', 'Enter valid assignUsers').notEmpty().isArray(),
  body('assignUsers.*.businessUnits', 'Enter valid BusinessUnits')
    .notEmpty()
    .isArray(),
  body('assignUsers.*.businessUnits.*', 'Enter valid businessUnits')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.buFilterType', 'buFilterType must be 1, 2, or 3')
    .notEmpty()
    .isInt()
    .isIn([1, 2, 3]),
  body('assignUsers.*.appointments', 'Enter valid appointments').isArray(),
  body('assignUsers.*.appointments.*', 'Enter valid appointments')
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.subSkillSets', 'Enter valid subSkillSets').isArray(),
  body('assignUsers.*.subSkillSets.*', 'Enter valid subSkillSets')
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.user', 'Enter valid user').isArray(),
  body('assignUsers.*.user.*', 'Enter valid user')
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.admin', 'Enter valid admin').notEmpty().isArray(),
  body('assignUsers.*.admin.*', 'Enter valid admin')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.allBuToken', 'Enter valid allBuToken')
    .notEmpty()
    .isBoolean(),
  body(
    'assignUsers.*.allBuTokenStaffId',
    'Enter valid allBuTokenStaffId',
  ).isString(),
  body('assignUsers.*.customField', 'Enter valid customField').isArray(),
  body('assignUsers.*.customField.*._id', 'Enter valid customFieldId')
    .matches(isObjectId)
    .isString(),
  body(
    'assignUsers.*.customField.*.name',
    'Enter valid customFieldName',
  ).isString(),
  body('assignUsers.*.customField.*.fieldId', 'Enter valid customFieldFieldId')
    .matches(isObjectId)
    .isString(),
  body(
    'assignUsers.*.customField.*.value',
    'Enter valid customFieldValue',
  ).isString(),
  param('channelId', 'Enter valid channelId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

module.exports = {
  createChannel,
  updateChannel,
};
