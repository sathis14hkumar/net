const express = require('express');

const shiftLogRouter = express.Router();
const shiftLogController = require('../../controllers/company/shiftLogController');

// RENDER

shiftLogRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

shiftLogRouter.post('/read', (req, res) => {
  shiftLogController.read(req, res);
});

module.exports = shiftLogRouter;
