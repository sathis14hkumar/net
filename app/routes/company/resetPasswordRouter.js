const express = require('express');

const resetPasswordRouter = express.Router();
const resetPasswordController = require('../../controllers/company/resetPasswordController');
const __ = require('../../../helpers/globalFunctions');

// RENDER

resetPasswordRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) {
    return next();
  }

  return res.status(402).send('This account is not permitted to access');
});

resetPasswordRouter.get(
  '/getUserData/:staffId',
  __.checkRole('resetPassword').validate,
  (req, res) => {
    resetPasswordController.getResetPassword(req, res);
  },
);
resetPasswordRouter.post(
  '/updatePassword',
  __.checkRole('resetPassword').validate,
  (req, res) => {
    resetPasswordController.UpdatePassword(req, res);
  },
);
resetPasswordRouter.get(
  '/getResetPasswordLog',
  __.checkRole('resetPassword').validate,
  (req, res) => {
    resetPasswordController.getResetPasswordLog(req, res);
  },
);

module.exports = resetPasswordRouter;
