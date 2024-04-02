const express = require('express');

const staffNotificationRouter = express.Router();
const staffNotificationController = require('../../controllers/staff/staffNotificationController');

// RENDER

staffNotificationRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff === 1) return next();

  return res.status(402).send('This account is not permitted to access');
});
// it was post
staffNotificationRouter.get('/mynotifications', (req, res) => {
  staffNotificationController.myNotifications(req, res);
});

staffNotificationRouter.post('/acknowledge', (req, res) => {
  staffNotificationController.acknowledge(req, res);
});

module.exports = staffNotificationRouter;
