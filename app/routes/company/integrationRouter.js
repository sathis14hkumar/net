const express = require('express');

const integrationRouter = express.Router();
const passport = require('passport');
const integrationController = require('../../controllers/company/integrationController');

integrationRouter.use(
  passport.authenticate('jwt', {
    session: false,
  }) /* Allow only admin */,
  (req, res, next) => {
    if (req.user.isFlexiStaff !== 1) return next();

    return res.status(402).send('This account is not permitted to access');
  },
);

integrationRouter.get('/read', (req, res) => {
  integrationController.read(req, res);
});
integrationRouter.get('/readMasterData', (req, res) => {
  integrationController.readMasterData(req, res);
});
integrationRouter.get('/readQuota', (req, res) => {
  integrationController.readQuota(req, res);
});
integrationRouter.get('/readApprove', (req, res) => {
  integrationController.readApprove(req, res);
});

module.exports = integrationRouter;
