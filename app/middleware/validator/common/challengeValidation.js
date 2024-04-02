const { body, query, param } = require('express-validator');

const disqualifyUser = [
  body('challengeId', 'Enter valid challenge Id').isMongoId().notEmpty(),
  body('fromDate', 'Enter valid From Date').notEmpty().toDate(),
  body('toDate', 'Enter valid To Date').notEmpty().toDate(),
  body('userId', 'Enter valid userId').isMongoId().notEmpty(),
];

const readDisqualifyUser = [
  query('challengeId', 'Enter valid challenge Id').isMongoId().notEmpty(),
  query('page', 'Enter valid page')
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('limit', 'Enter valid limit')
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
];

const deleteDisqualifyUser = [
  query('_id', 'Enter valid challenge Id').isMongoId().notEmpty(),
];
const appListOfRanks = [
  query('challengeId', 'Enter valid challenge Id').isMongoId().notEmpty(),
  query('page', 'Enter valid page').optional().isString(),
];

const readChallengesSingle = [
  param('challengeId', 'Enter valid challenge Id').isMongoId().notEmpty(),
];

const directRewards = [
  body('challengeId', 'Enter valid challenge Id').isMongoId().notEmpty(),
  body('comment', 'Enter valid comment').isString(),
  body('points', 'Enter valid points').notEmpty().isFloat({ min: 0.1 }),
  body('userId', 'Enter valid userId Id').isMongoId().notEmpty(),
];

const nomineeQuestions = [
  query('customFormId', 'Enter valid customFormId Id').isMongoId().notEmpty(),
];

const challengeUsers = [
  body('challengeId', 'Enter valid challenge Id').isMongoId().notEmpty(),
  body('q', 'Enter valid comment').isString(),
  body('page', 'Enter valid page')
    .notEmpty()
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
];

const countOfChallenges = [
  query('challengeId', 'Enter valid challengeId').isMongoId().notEmpty(),
  query('nonRewardPointSystemEnabled', 'Enter valid PointSystemEnabled')
    .isBoolean()
    .optional(),
  query('startDate', 'Enter valid startDate').isString().optional(),
  query('endDate', 'Enter valid endDate').isString().optional(),
  query('businessUnit', 'Enter valid businessUnit').isMongoId().optional(),
];
const exportManageChallenge = [
  query('startDate', 'Enter valid startDate').isString().isDate(),
  query('endDate', 'Enter valid endDate').isString().isDate(),
  query('businessUnit', 'Enter valid businessUnit').isMongoId(),
  query('challengeId', 'Enter valid challengeId').isMongoId().notEmpty(),
  query('timeZone', 'Enter valid timeZone').isString().notEmpty(),
  query('nonRewardPointSystemEnabled', 'Enter valid PointSystemEnabled')
    .isBoolean()
    .optional(),
];

const channelOrBoardsUsers = [
  body('channelId', 'Enter valid channelId')
    .isMongoId()
    .optional({ nullable: true }),
  body('customFormId', 'Enter valid customFormId')
    .isMongoId()
    .optional({ nullable: true }),
  body('questionId', 'Enter valid questionId')
    .isMongoId()
    .optional({ nullable: true }),
  body('wallId', 'Enter valid wallId')
    .isMongoId()
    .optional({ nullable: true, checkFalsy: true }),
  body('page', 'Enter valid page')
    .optional({ nullable: true, checkFalsy: true })
    .isInt()
    .default(0)
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  body('q', 'Enter valid q').optional({ nullable: true }).isString(),
];

const createChallenge = [
  body('challenge.title', 'Enter valid title').isString().notEmpty(),
  body('challenge.description', 'Enter valid description')
    .isString()
    .notEmpty(),
  body('challenge.challengeStart', 'Enter valid challengeStart Date')
    .notEmpty()
    .isString(),
  body('challenge.challengeEnd', 'Enter valid challengeEnd Date')
    .notEmpty()
    .isString(),
  body('challenge.publishStart', 'Enter valid publishStart Date')
    .notEmpty()
    .isString(),
  body('challenge.publishEnd', 'Enter valid publishEnd Date')
    .notEmpty()
    .isString(),
  body('challenge.status', 'Enter valid status').isInt().isIn([1]),
  body('challenge.icon', 'Enter valid icon').isString().notEmpty(),
  body('challenge.leaderBoard', 'Enter valid leaderBoard').isBoolean(),
  body('challenge.criteriaType', 'Enter valid criteriaType')
    .isInt()
    .isIn([1, 2, 3, 4, 5, 6]),
  body('challenge.criteriaCountType', 'Enter valid criteriaCountType')
    .isInt()
    .isIn([1, 2]),
  body('challenge.maximumRewards', 'Enter valid maximumRewards').isNumeric(),
  body('challenge.criteriaCount', 'Enter valid criteriaCount').isNumeric(),
  body('challenge.rewardPoints', 'Enter valid rewardPoints').isNumeric(),
  body(
    'challenge.nonRewardPointSystem',
    'Enter valid nonRewardPointSystem',
  ).isString(),
  body(
    'challenge.nonRewardPointSystemEnabled',
    'Enter valid nonRewardPointSystemEnabled',
  ).isBoolean(),
  body(
    'challenge.stopAfterAchievement',
    'Enter valid stopAfterAchievement',
  ).isBoolean(),
  body(
    'challenge.setLimitToMaxRewards',
    'Enter valid setLimitToMaxRewards',
  ).isBoolean(),
  body('challenge.fieldOptions', 'Enter valid fieldOptions').isArray(),
  body('challenge.nomineeQuestion', 'Enter valid nomineeQuestion')
    .isString()
    .optional({ nullable: true }),
  body('challenge.badgeTiering', 'Enter valid badgeTiering').isBoolean(),
  body('challenge.ranks', 'Enter valid ranks').isArray(),
  body('challenge.criteriaSourceType', 'Enter valid criteriaSourceType')
    .isInt()
    .isIn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    .optional({ nullable: true }),
  body('challenge.selectedChannel', 'Enter valid selectedChannel')
    .isString()
    .optional(),
  body('challenge.assignUsers', 'Enter valid assignUsers').isArray(),
  body('challenge.administrators', 'Enter valid administrators').isArray(),
  body('challenge.selectedWall', 'Enter valid selectedWall')
    .isString()
    .optional({ nullable: true, checkFalsy: true }),
  body('challenge.selectedCustomForm', 'Enter valid selectedCustomForm')
    .isString()
    .optional({ nullable: true, checkFalsy: true }),
];

const updateChallenge = [
  body('challenge.title', 'Enter valid title').isString().notEmpty(),
  body('challenge.description', 'Enter valid description')
    .isString()
    .notEmpty(),
  body('challenge.challengeStart', 'Enter valid challengeStart Date')
    .notEmpty()
    .isString(),
  body('challenge.challengeEnd', 'Enter valid challengeEnd Date')
    .notEmpty()
    .isString(),
  body('challenge.publishStart', 'Enter valid publishStart Date')
    .notEmpty()
    .isString(),
  body('challenge.publishEnd', 'Enter valid publishEnd Date')
    .notEmpty()
    .isString(),
  body('challenge.status', 'Enter valid status').isInt().isIn([1]),
  body('challenge.icon', 'Enter valid icon').isString().notEmpty(),
  body('challenge.leaderBoard', 'Enter valid leaderBoard').isBoolean(),
  body('challenge.criteriaType', 'Enter valid criteriaType')
    .isInt()
    .isIn([1, 2, 3, 4, 5, 6]),
  body('challenge.criteriaCountType', 'Enter valid criteriaCountType')
    .isInt()
    .isIn([1, 2]),
  body('challenge.maximumRewards', 'Enter valid maximumRewards')
    .isNumeric()
    .optional(),
  body('challenge.criteriaCount', 'Enter valid criteriaCount').isInt(),
  body('challenge.rewardPoints', 'Enter valid rewardPoints').isNumeric(),
  body(
    'challenge.nonRewardPointSystemEnabled',
    'Enter valid nonRewardPointSystemEnabled',
  ).isBoolean(),
  body(
    'challenge.stopAfterAchievement',
    'Enter valid stopAfterAchievement',
  ).isBoolean(),
  body(
    'challenge.setLimitToMaxRewards',
    'Enter valid setLimitToMaxRewards',
  ).isBoolean(),
  body('challenge.fieldOptions', 'Enter valid fieldOptions').isArray(),
  body('challenge.nomineeQuestion', 'Enter valid nomineeQuestion')
    .isString()
    .optional({ nullable: true }),
  body('challenge.badgeTiering', 'Enter valid badgeTiering').isBoolean(),
  body('challenge.ranks', 'Enter valid ranks').isArray(),
  body('challenge.criteriaSourceType', 'Enter valid criteriaSourceType')
    .isInt()
    .isIn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    .optional({ nullable: true }),
  body('challenge.selectedChannel', 'Enter valid selectedChannel')
    .isString()
    .optional(),
  body('challenge.assignUsers', 'Enter valid assignUsers').isArray(),
  body('challenge.administrators', 'Enter valid administrators').isArray(),
  body('challenge.selectedWall', 'Enter valid selectedWall')
    .isString()
    .optional({ nullable: true, checkFalsy: true }),
  body('challenge.selectedCustomForm', 'Enter valid selectedCustomForm')
    .isString()
    .optional({ nullable: true, checkFalsy: true }),
  body('challenge._id', 'Enter valid challenge Id').isString().optional(),
];

const readNew = [
  query('draw', 'Enter Valid draw')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('columns', 'Enter Valid columns object').isArray().notEmpty(),
  query('order', 'Enter Valid columns order').isArray().notEmpty(),
  query('start', 'Enter Valid start')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('length', 'Enter Valid length')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('search', 'Enter Valid search object').isObject().notEmpty(),
];

const manageChallenge = [
  query('draw', 'Enter Valid draw')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('columns', 'Enter Valid columns object').isArray().notEmpty(),
  query('order', 'Enter Valid columns order').isArray().notEmpty(),
  query('start', 'Enter Valid start')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('length', 'Enter Valid length')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('search', 'Enter Valid search object').isObject().notEmpty(),
  query('challengeId', 'Enter Valid challengeId')
    .isString()
    .notEmpty()
    .isAlphanumeric(),
  query(
    'nonRewardPointSystemEnabled',
    'Enter Valid nonRewardPointSystemEnabled',
  )
    .isBoolean()
    .notEmpty(),
  query('individual', 'Enter Valid individual').isBoolean().notEmpty(),
  query('startDate', 'Enter Valid startDate').isString().optional(),
  query('endDate', 'Enter Valid endDate').isString().optional(),
  query('businessUnit', 'Enter Valid businessUnit').isString().optional(),
];

const logChallenge = [
  query('draw', 'Enter Valid draw')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('columns', 'Enter Valid columns object').isArray().notEmpty(),
  query('order', 'Enter Valid columns order').isArray().notEmpty(),
  query('start', 'Enter Valid start')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('length', 'Enter Valid length')
    .isInt()
    .notEmpty()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('search', 'Enter Valid search object').isObject().notEmpty(),
  query('startDate', 'Enter Valid startDate').isString().optional(),
  query('endDate', 'Enter Valid endDate').isString().optional(),
  query('businessUnit', 'Enter Valid businessUnit').isString().optional(),
];

module.exports = {
  disqualifyUser,
  readDisqualifyUser,
  deleteDisqualifyUser,
  appListOfRanks,
  readChallengesSingle,
  directRewards,
  nomineeQuestions,
  challengeUsers,
  countOfChallenges,
  exportManageChallenge,
  channelOrBoardsUsers,
  createChallenge,
  updateChallenge,
  readNew,
  manageChallenge,
  logChallenge,
};
