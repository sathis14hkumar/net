const express = require('express');

const subSkillSetRouter = express.Router();
const subSkillSetController = require('../../controllers/company/subSkillSetController');
const buShitPayloadValidation = require('../../middleware/validator/company/buShiftPayloadValidation');
// RENDER

subSkillSetRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

subSkillSetRouter.post(
  '/create',
  buShitPayloadValidation.subskillsetCreatePayloadValidation,
  (req, res) => {
    subSkillSetController.create(req, res);
  },
);

subSkillSetRouter.post('/read', (req, res) => {
  subSkillSetController.read(req, res);
});

subSkillSetRouter.post(
  '/update',
  buShitPayloadValidation.subskillsetUpdatePayloadValidation,
  (req, res) => {
    subSkillSetController.update(req, res);
  },
);

subSkillSetRouter.post(
  '/delete',
  buShitPayloadValidation.subskillsetDeletePayloadValidation,
  (req, res) => {
    subSkillSetController.delete(req, res);
  },
);

// subSkillSetRouter.post('/test', subSkillSetController.test);

module.exports = subSkillSetRouter;
