const express = require('express');

const challengeRouter = express.Router();
const uuid = require('node-uuid');
const multer = require('multer');
const path = require('path');
const challengeController = require('../../controllers/common/challengeController');
const __ = require('../../../helpers/globalFunctions');
const {
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
} = require('../../middleware/validator/common/challengeValidation');
const {
  validateRequestExactMatch,
  validateRequest,
  fileValidator,
} = require('../../middleware/validators');

const storage = multer.diskStorage({
  destination: 'public/uploads/challenge',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
});
const badgeStorage = multer.diskStorage({
  destination: 'public/uploads/challenge/badges',
  filename(req, file, cb) {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});
const badgeUpload = multer({
  storage: badgeStorage,
});

// Disqualify a user for particular period
challengeRouter.post(
  '/disqualifyUser',
  disqualifyUser,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.disqualifyUser(req, res);
  },
);
// get disqualifier data
challengeRouter.get(
  '/readDisqualifier',
  readDisqualifyUser,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.readDisqualifier(req, res);
  },
);
// delete disqualifier data
challengeRouter.get(
  '/deleteDisqualifier',
  deleteDisqualifyUser,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.deleteDisqualifier(req, res);
  },
);

// Read Non reward points challenges
challengeRouter.get('/getPointsSummary', (req, res) => {
  challengeController.getPointsSummary(req, res);
});

challengeRouter.get(
  '/appListOfChallenge',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.appListOfChallenge(req, res);
  },
);
challengeRouter.get(
  '/appListOfAchievements',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.appListOfAchievements(req, res);
  },
);
challengeRouter.get(
  '/appListOfRanks',
  __.checkRole('challenges').validate,
  appListOfRanks,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.appListOfRanks(req, res);
  },
);
challengeRouter.get('/getRecentChallenges', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (!routeprivilege?.challenges) {
    return __.out(res, 201, []);
  }

  return challengeController.getRecentChallenges(req, res);
});

challengeRouter.post(
  '/create',
  createChallenge,
  validateRequest,
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.create(req, res);
  },
);
challengeRouter.post(
  '/update',
  updateChallenge,
  validateRequest,
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.update(req, res);
  },
);
challengeRouter.get(
  '/read',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.readChallenges(req, res);
  },
);

challengeRouter.get(
  '/read/new',
  readNew,
  validateRequest,
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.readChallengesNew(req, res);
  },
);

challengeRouter.get(
  '/read/new/:challengeId',
  __.checkRole('challenges').validate,
  readChallengesSingle,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.readChallengesSingle(req, res);
  },
);

challengeRouter.post(
  '/uploadFiles',
  upload.single('file'),
  fileValidator('file').validate,
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.uploadContentFiles(req, res);
  },
);
challengeRouter.post(
  '/saveBadge',
  badgeUpload.single('file'),
  fileValidator('file').validate,
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.saveBadge(req, res);
  },
);
challengeRouter.get(
  '/manageChallenge',
  manageChallenge,
  validateRequest,
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.manageChallenge(req, res);
  },
);
challengeRouter.get(
  '/getCountOfChallenges',
  __.checkRole('challenges').validate,
  countOfChallenges,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.getCountOfChallenges(req, res);
  },
);
challengeRouter.get(
  '/exportManageChallenge',
  __.checkRole('challenges').validate,
  exportManageChallenge,
  validateRequest,
  (req, res) => {
    challengeController.exportManageChallenge(req, res);
  },
);
challengeRouter.get(
  '/getChannelsAndBoards',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getChannelsAndBoards(req, res);
  },
);
challengeRouter.post(
  '/getChannelOrBoardsUsers',
  __.checkRole('challenges').validate,
  channelOrBoardsUsers,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.getChannelOrBoardsUsers(req, res);
  },
);
challengeRouter.get(
  '/getChallengesLog',
  logChallenge,
  validateRequest,
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getChallengesLog(req, res);
  },
);
challengeRouter.get(
  '/readChallengeCriteriaLog',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.readChallengeCriteriaLog(req, res);
  },
);
challengeRouter.get(
  '/getChallengesAndUsers',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getChallengesAndUsers(req, res);
  },
);
challengeRouter.post(
  '/getChallengeUsers',
  __.checkRole('challenges').validate,
  challengeUsers,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.getChallengeUsers(req, res);
  },
);

challengeRouter.get(
  '/getNomineeQuestions',
  __.checkRole('challenges').validate,
  nomineeQuestions,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.getNomineeQuestions(req, res);
  },
);
challengeRouter.get(
  '/readOne/:challengeId',
  readChallengesSingle,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.readOne(req, res);
  },
);
challengeRouter.get(
  '/getBadges',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getBadges(req, res);
  },
);
challengeRouter.post(
  '/directRewards',
  __.checkRole('challenges').validate,
  directRewards,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.directRewards(req, res);
  },
);
challengeRouter.post(
  '/bulkUpdateDirectReward',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.bulkUpdateDirectReward(req, res);
  },
);
challengeRouter.get(
  '/isRewardErrorLogExist/:challengeId',
  readChallengesSingle,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.isRewardErrorLogExist(req, res);
  },
);

challengeRouter.get(
  '/getRewardErrorLog/:challengeId',
  __.checkRole('challenges').validate,
  readChallengesSingle,
  validateRequestExactMatch,
  (req, res) => {
    challengeController.getRewardErrorLog(req, res);
  },
);
challengeRouter.get(
  '/customForm/fields/:customFormId',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.customFormFields(req, res);
  },
);

challengeRouter.get(
  '/digitalstamp/:challengeId',
  __.checkRole('challenges').validate,
  (req, res) => {
    challengeController.getDigitalStamp(req, res);
  },
);

module.exports = challengeRouter;
