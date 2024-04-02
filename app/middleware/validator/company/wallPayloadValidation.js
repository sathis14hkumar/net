const { body } = require('express-validator');
const { isObjectId } = require('../../validators');

const createWall = [
  body('wallName', 'Enter valid wallName').notEmpty().isString(),
  body('displayType', 'Enter valid displayType').notEmpty().isInt(),
  body('postType', 'Enter valid postType').notEmpty().isInt(),
  body('isNomineeActive', 'Select valid isNomineeActive')
    .notEmpty()
    .isBoolean(),
  body('adminResponse', 'Select valid adminResponse').notEmpty().isBoolean(),
  body('postAnonymously', 'Select valid postAnonymously')
    .notEmpty()
    .isBoolean(),
  body('isTaskActive', 'Select valid isTaskActive').notEmpty().isBoolean(),
  body('nominationOnlyByAdmin', 'Select valid nominationOnlyByAdmin')
    .notEmpty()
    .isBoolean(),
  body('quickNavEnabled', 'Select valid quickNavEnabled')
    .notEmpty()
    .isBoolean(),
  body('bannerImage', 'Enter valid bannerImage').notEmpty().isURL(),
  body('nominationPerUser.enabled', 'Select valid enabled')
    .notEmpty()
    .isBoolean(),
  body('nominationPerUser.submissionLimit', 'Enter valid nominationPerUser')
    .notEmpty()
    .isInt(),
  body('nominationPerUser.submissionPeriod', 'Enter valid submissionPeriod')
    .notEmpty()
    .isInt()
    .isIn([0, 1, 2, 3, 4]),
  body('maxNomination.enabled', 'Select valid maxNomination')
    .notEmpty()
    .isBoolean(),
  body('maxNomination.submissionLimit', 'Enter valid submissionLimit')
    .notEmpty()
    .isInt(),
  body('maxNomination.submissionPeriod', 'Enter valid submissionPeriod')
    .notEmpty()
    .isInt()
    .isIn([0, 1, 2, 3, 4]),
  body('category.*.categoryName', 'Enter valid categoryName')
    .notEmpty()
    .isString(),
  body('assignUsers.*.businessUnits.*', 'Enter valid businessUnits')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.buFilterType', 'Enter valid buFilterType')
    .notEmpty()
    .isInt(),
  body('assignUsers.*.appointments.*', 'Enter valid appointments').isString(),
  body('assignUsers.*.subSkillSets.*', 'Enter valid subSkillSets').isString(),
  body('assignUsers.*.user.*', 'Enter valid user').isString(),
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
  body('assignUsers.*.customField.*._id', 'Enter valid customFieldId')
    .matches(isObjectId)
    .isString(),
  body(
    'assignUsers.*.customField.*.name',
    'Enter valid customFieldName',
  ).isString(),
  body('assignUsers.*.customField.*.fieldId', 'Enter valid fieldId').isString(),
  body(
    'assignUsers.*.customField.*.value',
    'Enter valid customFieldValue',
  ).isString(),
  body('status', 'Enter valid status').notEmpty().isInt(),
];

const updateWall = [
  body('wallName', 'Enter valid wallName').notEmpty().isString(),
  body('displayType', 'Enter valid displayType').notEmpty().isInt(),
  body('postType', 'Enter valid postType').notEmpty().isInt(),
  body('isNomineeActive', 'Select valid isNomineeActive')
    .notEmpty()
    .isBoolean(),
  body('adminResponse', 'Select valid adminResponse').notEmpty().isBoolean(),
  body('postAnonymously', 'Select valid postAnonymously')
    .notEmpty()
    .isBoolean(),
  body('isTaskActive', 'Select valid isTaskActive').notEmpty().isBoolean(),
  body('nominationOnlyByAdmin', 'Select valid nominationOnlyByAdmin')
    .notEmpty()
    .isBoolean(),
  body('quickNavEnabled', 'Select valid quickNavEnabled')
    .notEmpty()
    .isBoolean(),
  body('bannerImage', 'Enter valid bannerImage').notEmpty().isURL(),
  body('nominationPerUser.enabled', 'Select valid enabled')
    .notEmpty()
    .isBoolean(),
  body('nominationPerUser.submissionLimit', 'Enter valid submissionLimit')
    .notEmpty()
    .isInt(),
  body('nominationPerUser.submissionPeriod', 'Enter valid submissionPeriod')
    .notEmpty()
    .isInt()
    .isIn([0, 1, 2, 3, 4]),
  body('maxNomination.enabled', 'Select valid maxNomination')
    .notEmpty()
    .isBoolean(),
  body('maxNomination.submissionLimit', 'Enter valid submissionLimit')
    .notEmpty()
    .isInt(),
  body('maxNomination.submissionPeriod', 'Enter valid submissionPeriod')
    .notEmpty()
    .isInt()
    .isIn([0, 1, 2, 3, 4]),
  body('category.*.categoryName', 'Enter valid categoryName')
    .notEmpty()
    .isString(),
  body('assignUsers.*.businessUnits.*', 'Enter valid businessUnits')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('assignUsers.*.buFilterType', 'Enter valid buFilterType')
    .notEmpty()
    .isInt(),
  body('assignUsers.*.appointments.*', 'Enter valid appointments').isString(),
  body('assignUsers.*.subSkillSets.*', 'Enter valid subSkillSets').isString(),
  body('assignUsers.*.user.*', 'Enter valid user').isString(),
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
  body('status', 'Enter valid status').notEmpty().isInt(),
  body('wallId._id', 'Enter valid wallId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

const reviewPostWall = [
  body('postId', 'Enter valid postId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('status', 'Enter valid status').notEmpty().isInt().isIn([1, 2]),
];

const updateStatusWall = [
  body('commentId', 'Enter valid commentId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('status', 'Enter valid status').notEmpty().isInt().isIn([1, 2]),
];

module.exports = {
  createWall,
  updateWall,
  reviewPostWall,
  updateStatusWall,
};
