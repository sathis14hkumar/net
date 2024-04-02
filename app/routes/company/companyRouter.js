const express = require('express');

const companyRouter = express.Router();
const companyController = require('../../controllers/company/companyController');

// RENDER

companyRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) {
    return next();
  }

  return res.status(402).send('This account is not permitted to access');
});

companyRouter.post('/create', (req, res) => {
  companyController.create(req, res);
});

companyRouter.post('/read', (req, res) => {
  companyController.read(req, res);
});

companyRouter.post('/update', (req, res) => {
  companyController.update(req, res);
});

companyRouter.post('/delete', (req, res) => {
  companyController.delete(req, res);
});

// companyRouter.post('/test', companyController.test);

module.exports = companyRouter;
