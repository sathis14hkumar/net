const express = require('express');

const sectionRouter = express.Router();
const sectionController = require('../../controllers/company/sectionController');
const sectionValidation = require('../../middleware/validator/company/sectionPayloadValidation');
// RENDER

sectionRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

sectionRouter.post(
  '/create',
  sectionValidation.createValidation,
  (req, res) => {
    sectionController.create(req, res);
  },
);

sectionRouter.post('/read', (req, res) => {
  sectionController.read(req, res);
});

sectionRouter.post(
  '/update',
  sectionValidation.updateValidation,
  (req, res) => {
    sectionController.update(req, res);
  },
);

sectionRouter.post(
  '/delete',
  sectionValidation.deleteValidation,
  (req, res) => {
    sectionController.delete(req, res);
  },
);

// sectionRouter.post('/test', sectionController.test);

module.exports = sectionRouter;
