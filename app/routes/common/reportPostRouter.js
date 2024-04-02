const express = require('express');

const reportPostRouter = express.Router();
const reportPostController = require('../../controllers/common/reportPostController');
const {
  reportPost,
  reportChannelComment,
  reportChannelPost,
  reportCommment,
} = require('../../middleware/validator/common/reportPostValidation');
const { validateRequestExactMatch } = require('../../middleware/validators');

//
reportPostRouter.post(
  '/reportPost',
  reportPost,
  validateRequestExactMatch,
  (req, res) => {
    reportPostController.reportPost(req, res);
  },
);

reportPostRouter.post(
  '/reportComment',
  reportCommment,
  validateRequestExactMatch,
  (req, res) => {
    reportPostController.reportCommment(req, res);
  },
);

reportPostRouter.post(
  '/reportChannelPost',
  reportChannelPost,
  validateRequestExactMatch,
  (req, res) => {
    reportPostController.reportChannelPost(req, res);
  },
);

// Not in use
reportPostRouter.post(
  '/reportChannelComment',
  reportChannelComment,
  validateRequestExactMatch,
  (req, res) => {
    reportPostController.reportChannelComment(req, res);
  },
);

module.exports = reportPostRouter;
