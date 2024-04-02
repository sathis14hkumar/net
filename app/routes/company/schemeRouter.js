const express = require('express');

const schemeRouter = express.Router();
const schemeController = require('../../controllers/company/schemeController');

const schemaValidation = require('../../middleware/validator/company/schemePaylodValidation');
// RENDER

schemeRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  if (req.originalUrl === '/scheme/userScheme/noOfWeek') return next();

  return res.status(402).send('This account is not permitted to access');
});

schemeRouter.post('/', schemaValidation.createValidation, (req, res) => {
  schemeController.create(req, res);
});
schemeRouter.post('/mimetype', (req, res) => {
  schemeController.mimeType(req, res);
});
schemeRouter.get('/:companyId', (req, res) => {
  schemeController.read(req, res);
});
schemeRouter.get('/specific/:schemeId', (req, res) => {
  schemeController.readScheme(req, res);
});
schemeRouter.post('/update', schemaValidation.updateValidation, (req, res) => {
  schemeController.update(req, res);
});

schemeRouter.post('/userlog', (req, res) => {
  schemeController.readUserLog(req, res);
});

schemeRouter.get('/userScheme/noOfWeek', (req, res) => {
  schemeController.getNumberOfWeekForSchemeId(req, res);
});

module.exports = schemeRouter;
