const express = require('express');

const addOnSchemesRouter = express.Router();
const addOnSchemesController = require('../../controllers/company/addOnSchemesController');

// RENDER

addOnSchemesRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) {
    return next();
  }

  return res.status(402).send('This account is not permitted to access');
});

addOnSchemesRouter.post('/create', (req, res) => {
  addOnSchemesController.create(req, res);
});
addOnSchemesRouter.post('/update/:id', (req, res) => {
  addOnSchemesController.update(req, res);
});

addOnSchemesRouter.post('/read', (req, res) => {
  addOnSchemesController.getAddOnScheme(req, res);
});

addOnSchemesRouter.post('/remove/:schemeId', (req, res) => {
  addOnSchemesController.remove(req, res);
});

module.exports = addOnSchemesRouter;
