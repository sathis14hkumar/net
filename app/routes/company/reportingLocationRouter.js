const express = require('express');

const reportingLocationRouter = express.Router();
const reportingLocationController = require('../../controllers/company/reportingLocationController');

// RENDER

reportingLocationRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

reportingLocationRouter.post('/create', (req, res) => {
  reportingLocationController.create(req, res);
});

reportingLocationRouter.post('/read', (req, res) => {
  reportingLocationController.read(req, res);
});

reportingLocationRouter.post('/update', (req, res) => {
  reportingLocationController.update(req, res);
});

reportingLocationRouter.post('/delete', (req, res) => {
  reportingLocationController.delete(req, res);
});

// reportingLocationRouter.post('/test', reportingLocationController.test);

module.exports = reportingLocationRouter;
