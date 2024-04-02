const express = require('express');

const leaveTypeRouter = express.Router();
const leaveTypeController = require('../../controllers/company/leaveTypeController');

const leaveSchemeValidation = require('../../middleware/validator/company/leaveSchemePayloadValidation');
// RENDER

leaveTypeRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

// leaveTypeRouter.post('/create', (req, res) => {
//   // check if user role has access to this module
//   leaveTypeController.create(req, res);
// });
leaveTypeRouter.post(
  '/update',
  leaveSchemeValidation.createOrUpdateValidation,
  (req, res) => {
    // check if user role has access to this module
    leaveTypeController.update(req, res);
  },
);
leaveTypeRouter.post(
  '/delete',
  leaveSchemeValidation.deleteValidation,
  (req, res) => {
    // check if user role has access to this module
    leaveTypeController.delete(req, res);
  },
);
leaveTypeRouter.get('/get', (req, res) => {
  // check if user role has access to this module
  leaveTypeController.get(req, res);
});
module.exports = leaveTypeRouter;
