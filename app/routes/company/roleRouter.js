const express = require('express');

const roleRouter = express.Router();
const roleController = require('../../controllers/company/roleController');
const __ = require('../../../helpers/globalFunctions');

// RENDER

roleRouter.use(
  /* Allow only admin */
  (req, res, next) => {
    if (req.user.isFlexiStaff !== 1) return next();

    return res.status(402).send('This account is not permitted to access');
  },
);

roleRouter.post('/create', __.checkRole('roleSetup').validate, (req, res) => {
  roleController.create(req, res);
});
roleRouter.post('/read', roleController.read);
roleRouter.post('/update', __.checkRole('roleSetup').validate, (req, res) => {
  roleController.update(req, res);
});
roleRouter.post('/delete', __.checkRole('roleSetup').validate, (req, res) => {
  roleController.delete(req, res);
});
// roleRouter.post('/test', roleController.test);

module.exports = roleRouter;
