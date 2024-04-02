const express = require('express');

const userFieldRouter = express.Router();
const userFieldController = require('../../controllers/company/userFieldController');
const customFieldValidation = require('../../middleware/validator/company/userFieldPayloadValidation');

// RENDER

userFieldRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

userFieldRouter.post(
  '/create',
  customFieldValidation.createValidation,
  (req, res) => {
    userFieldController.create(req, res);
  },
);

userFieldRouter.post(
  '/update',
  customFieldValidation.updateValidation,
  (req, res) => {
    userFieldController.update(req, res);
  },
);

userFieldRouter.get('/read', (req, res) => {
  userFieldController.read(req, res);
});

userFieldRouter.get('/', (req, res) => {
  userFieldController.getAll(req, res);
});

userFieldRouter.get(
  '/remove/:fieldId',
  customFieldValidation.removeValidation,
  (req, res) => {
    userFieldController.remove(req, res);
  },
);

module.exports = userFieldRouter;
