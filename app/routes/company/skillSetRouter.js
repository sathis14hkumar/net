const express = require('express');

const skillSetRouter = express.Router();
const skillSetController = require('../../controllers/company/skillSetController');
const __ = require('../../../helpers/globalFunctions');
const buShitPayloadValidation = require('../../middleware/validator/company/buShiftPayloadValidation');

// RENDER

skillSetRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

skillSetRouter.post('/read', (req, res) => {
  skillSetController.read(req, res);
});

skillSetRouter.get('/', (req, res) => {
  skillSetController.readSkillSet(req, res);
});

skillSetRouter.post(
  '/create',
  buShitPayloadValidation.skillCreatePayloadValidation,
  __.checkRole('skillSetSetup').validate,
  (req, res) => {
    skillSetController.create(req, res);
  },
);
skillSetRouter.post(
  '/update',
  buShitPayloadValidation.skillUpdatePayloadValidation,
  __.checkRole('skillSetSetup').validate,
  (req, res) => {
    skillSetController.update(req, res);
  },
);
skillSetRouter.post(
  '/delete',
  buShitPayloadValidation.skillsetDeletePayloadValidation,
  __.checkRole('skillSetSetup').validate,
  (req, res) => {
    skillSetController.delete(req, res);
  },
);
// skillSetRouter.post('/test', skillSetController.test);

module.exports = skillSetRouter;
