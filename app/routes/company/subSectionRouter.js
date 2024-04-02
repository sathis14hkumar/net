const express = require('express');

const subSectionRouter = express.Router();
const subSectionController = require('../../controllers/company/subSectionController');
const subSectionValidation = require('../../middleware/validator/company/subSectionPayloadValidation');
// RENDER

subSectionRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

subSectionRouter.post(
  '/create',
  subSectionValidation.createValidation,
  (req, res) => {
    subSectionController.create(req, res);
  },
);

subSectionRouter.post('/read', (req, res) => {
  subSectionController.read(req, res);
});

subSectionRouter.post(
  '/update',
  subSectionValidation.updateValidation,
  (req, res) => {
    subSectionController.update(req, res);
  },
);

subSectionRouter.post(
  '/delete',
  subSectionValidation.deleteValidation,
  (req, res) => {
    subSectionController.delete(req, res);
  },
);

// subSectionRouter.get('/categories', (req, res) => {
//   subSectionController.getCategories(req.query.id, res);
// });

module.exports = subSectionRouter;
