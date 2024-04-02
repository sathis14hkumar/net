const express = require('express');

const privilegeRouter = express.Router();
const privilegeController = require('../../controllers/company/privilegeController');

// RENDER

privilegeRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

privilegeRouter.post('/create', (req, res) => {
  privilegeController.create(req, res);
});

privilegeRouter.post('/read', (req, res) => {
  privilegeController.read(req, res);
});

privilegeRouter.post('/update', (req, res) => {
  privilegeController.update(req, res);
});

privilegeRouter.post('/delete', (req, res) => {
  privilegeController.delete(req, res);
});

module.exports = privilegeRouter;
