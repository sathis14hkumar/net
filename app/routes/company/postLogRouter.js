const express = require('express');

const postLogRouter = express.Router();
const postLogController = require('../../controllers/company/postLogController');
const { readLog } = require('../../middleware/validator/company/postLog');
const { validateRequestExactMatch } = require('../../middleware/validators');

// RENDER

postLogRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

postLogRouter.get('/', readLog, validateRequestExactMatch, (req, res) => {
  postLogController.read(req, res);
});

module.exports = postLogRouter;
