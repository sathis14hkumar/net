const express = require('express');

const departmentRouter = express.Router();
const departmentController = require('../../controllers/company/departmentController');
const departmentValidation = require('../../middleware/validator/company/departmentPayloadValidation');
// RENDER

departmentRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

departmentRouter.post(
  '/create',
  departmentValidation.createValidation,
  (req, res) => {
    departmentController.create(req, res);
  },
);

departmentRouter.post('/read', (req, res) => {
  departmentController.read(req, res);
});

departmentRouter.post('/readWithPn', (req, res) => {
  departmentController.readWithPn(req, res);
});

departmentRouter.post(
  '/update',
  departmentValidation.updateValidation,
  (req, res) => {
    departmentController.update(req, res);
  },
);

departmentRouter.post(
  '/delete',
  departmentValidation.deleteValidation,
  (req, res) => {
    departmentController.delete(req, res);
  },
);

// departmentRouter.post('/test', departmentController.test);

module.exports = departmentRouter;
