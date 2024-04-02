const express = require('express');

const buTemplateRouter = express.Router();
const buTemplateController = require('../../controllers/company/buTemplateController');

// RENDER

buTemplateRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

buTemplateRouter.post('/createbuTemplate', (req, res) => {
  buTemplateController.create(req, res);
});

buTemplateRouter.get('/getButemplate', (req, res) => {
  buTemplateController.read(req, res);
});

module.exports = buTemplateRouter;
