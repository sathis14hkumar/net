const express = require('express');

const leaveApplicationRouter = express.Router();
const leaveApplicationController = require('../../controllers/company/leaveApplicationsController');

leaveApplicationRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1 || req.path.includes('staff')) return next();

  return res.status(402).send('This account is not permitted to access');
});

leaveApplicationRouter.post('/staff/apply', (req, res) => {
  leaveApplicationController.applyForLeave(req, res);
});

leaveApplicationRouter.post('/staff/getLeavedetailToApply', (req, res) => {
  leaveApplicationController.getLeaveDetailToApply(req, res);
});

leaveApplicationRouter.get('/getMyUsersList', (req, res) => {
  leaveApplicationController.getMyUserLeaves(req, res);
});

module.exports = leaveApplicationRouter;
