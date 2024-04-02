const express = require('express');

const settingRouter = express.Router();
const settingController = require('../../controllers/company/settingController');

// RENDER

settingRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

settingRouter.post('/create', (req, res) => {
  settingController.create(req, res);
});

settingRouter.post('/read', (req, res) => {
  settingController.read(req, res);
});

settingRouter.post('/update', (req, res) => {
  settingController.update(req, res);
});

settingRouter.post('/delete', (req, res) => {
  settingController.delete(req, res);
});

module.exports = settingRouter;
