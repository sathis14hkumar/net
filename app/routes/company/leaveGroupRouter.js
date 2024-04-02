const express = require('express');

const leaveGroupRouter = express.Router();
const leaveGroupController = require('../../controllers/company/leaveGroupController');
const leaveSchemeValidation = require('../../middleware/validator/company/leaveSchemePayloadValidation');
// RENDER

leaveGroupRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

leaveGroupRouter.post(
  '/create',
  leaveSchemeValidation.createLeaveGrouptValidation,
  (req, res) => {
    // check if user role has access to this module
    leaveGroupController.create(req, res);
  },
);
leaveGroupRouter.post(
  '/update',
  leaveSchemeValidation.updateLeaveGrouptValidation,
  (req, res) => {
    // check if user role has access to this module
    leaveGroupController.update(req, res);
  },
);
leaveGroupRouter.post(
  '/delete',
  leaveSchemeValidation.deleteLeaveGroupValidation,
  (req, res) => {
    // check if user role has access to this module
    leaveGroupController.delete(req, res);
  },
);
leaveGroupRouter.get('/get', (req, res) => {
  // check if user role has access to this module
  leaveGroupController.get(req, res);
});
leaveGroupRouter.get('/bu/adminlist', (req, res) => {
  // check if user role has access to this module
  leaveGroupController.adminListForBu(req, res);
});
module.exports = leaveGroupRouter;
