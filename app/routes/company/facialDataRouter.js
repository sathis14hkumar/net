const express = require('express');

const facialDataRouter = express.Router();
const facialDataController = require('../../controllers/company/facialDataController');
const facialValidation = require('../../middleware/validator/company/facialDataPayloadValidation');
// RENDER

facialDataRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

facialDataRouter.post(
  '/create',
  facialValidation.createValidation,
  (req, res) => {
    facialDataController.create(req, res);
  },
);

facialDataRouter.get('/list/:businessUnitId', (req, res) => {
  facialDataController.list(req, res);
});

module.exports = facialDataRouter;
