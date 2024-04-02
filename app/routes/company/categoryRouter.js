const express = require('express');

const categoryRouter = express.Router();
const categoryController = require('../../controllers/company/categoryController');
const {
  createCategory,
  readCategory,
  getChannelCategories,
  updateCategory,
  deleteCategory,
} = require('../../middleware/validator/company/categoryValidation');
const { validateRequestExactMatch } = require('../../middleware/validators');
const { deleteOne } = require('../../models/category');

// RENDER

categoryRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

categoryRouter.post(
  '/create',
  createCategory,
  validateRequestExactMatch,
  (req, res) => {
    categoryController.create(req, res);
  },
);

categoryRouter.post(
  '/',
  createCategory,
  validateRequestExactMatch,
  (req, res) => {
    categoryController.createNew(req, res);
  },
);
// API transform
categoryRouter.get('/', readCategory, validateRequestExactMatch, (req, res) => {
  categoryController.read(req, res);
});

// API transform
categoryRouter.get(
  '/getChannelCategories/:channelId',
  getChannelCategories,
  validateRequestExactMatch,
  (req, res) => {
    categoryController.readOne(req, res);
  },
);

categoryRouter.post(
  '/update',
  updateCategory,
  validateRequestExactMatch,
  (req, res) => {
    categoryController.update(req, res);
  },
);

categoryRouter.post(
  '/delete',
  deleteCategory,
  validateRequestExactMatch,
  (req, res) => {
    categoryController.delete(req, res);
  },
);

categoryRouter.post(
  '/:categoryId',
  deleteOne,
  validateRequestExactMatch,
  (req, res) => {
    categoryController.deleteId(req, res);
  },
);

// categoryRouter.post('/test', categoryController.test);

module.exports = categoryRouter;
