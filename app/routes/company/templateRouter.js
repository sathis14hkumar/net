const express = require('express');

const templateRouter = express.Router();
const templateController = require('../../controllers/company/templateController');
const __ = require('../../../helpers/globalFunctions');
const templateValidation = require('../../middleware/validator/company/templayePayloadValidatio');

// RENDER
templateRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

templateRouter.post(
  '/create',
  templateValidation.createOrUpdateValidation,
  __.checkRole('setTemplate').validate,
  (req, res) => {
    templateController.createOrUpdate(req, res);
  },
);
templateRouter.post('/read', templateController.read);
templateRouter.post(
  '/update',
  templateValidation.createOrUpdateValidation,
  __.checkRole('setTemplate').validate,
  (req, res) => {
    templateController.createOrUpdate(req, res);
  },
);
templateRouter.post(
  '/deleteShiftInTemplate',
  templateValidation.deleteShiftInTemplateValidation,
  __.checkRole('setTemplate').validate,
  (req, res) => {
    templateController.deleteShiftInTemplate(req, res);
  },
);
templateRouter.post(
  '/remove',
  templateValidation.removeValidation,
  __.checkRole('setTemplate').validate,
  (req, res) => {
    templateController.remove(req, res);
  },
);
templateRouter.post(
  '/renameTemplate',
  __.checkRole('setTemplate').validate,
  (req, res) => {
    templateController.renameTemplate(req, res);
  },
);

module.exports = templateRouter;
