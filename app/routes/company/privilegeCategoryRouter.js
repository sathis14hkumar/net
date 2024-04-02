const express = require('express');

const privilegeCategoryRouter = express.Router();
const privilegeCategoryController = require('../../controllers/company/privilegeCategoryController');

// RENDER

privilegeCategoryRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

privilegeCategoryRouter.post('/create', (req, res) => {
  privilegeCategoryController.create(req, res);
});

privilegeCategoryRouter.post('/read', (req, res) => {
  privilegeCategoryController.read(req, res);
});

privilegeCategoryRouter.post('/update', (req, res) => {
  privilegeCategoryController.update(req, res);
});

privilegeCategoryRouter.post('/delete', (req, res) => {
  privilegeCategoryController.delete(req, res);
});

privilegeCategoryRouter.post('/push', (req, res) => {
  privilegeCategoryController.push(req, res);
});

privilegeCategoryRouter.post('/pull', (req, res) => {
  privilegeCategoryController.pull(req, res);
});

module.exports = privilegeCategoryRouter;
