const express = require('express');

const settingRouter = express.Router();
const settingController = require('../../controllers/common/redeemedSettingController');

// RENDER
// settingRouter.use(
//   passport.authenticate("jwt", {
//     session: false
//   }) /*Allow only admin*/,
//   function(req, res, next) {
//     next();
//   }
// );

settingRouter.post('/redeemedLanding', (req, res) => {
  settingController.redeemedLanding(req, res);
});

settingRouter.post('/redeemedCategory', (req, res) => {
  settingController.redeemedCategory(req, res);
});

settingRouter.get('/getSetting', (req, res) => {
  settingController.getSetting(req, res);
});

settingRouter.post('/categoryName', (req, res) => {
  settingController.redeemedAddCategory(req, res);
});

settingRouter.post('/categoryName/:id', (req, res) => {
  settingController.redeemedUpdateCategory(req, res);
});

module.exports = settingRouter;
