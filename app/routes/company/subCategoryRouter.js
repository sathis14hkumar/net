const express = require('express');

const subCategoryRouter = express.Router();
const subCategoryController = require('../../controllers/company/subCategoryController');
const {
  createSubCategory,
  readSubCategory,
  getSubCategory,
  updateSubCategory,
  deleteSubCategory,
} = require('../../middleware/validator/company/subCategoryValidation');
const { validateRequestExactMatch } = require('../../middleware/validators');

// RENDER

subCategoryRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

subCategoryRouter.post(
  '/create',
  createSubCategory,
  validateRequestExactMatch,
  (req, res) => {
    subCategoryController.create(req, res);
  },
);

subCategoryRouter.post(
  '/read',
  readSubCategory,
  validateRequestExactMatch,
  (req, res) => {
    subCategoryController.read(req, res);
  },
);

subCategoryRouter.get(
  '/:categoryId',
  getSubCategory,
  validateRequestExactMatch,
  (req, res) => {
    subCategoryController.getSubCategories(req, res);
  },
);

subCategoryRouter.post(
  '/update',
  updateSubCategory,
  validateRequestExactMatch,
  (req, res) => {
    subCategoryController.update(req, res);
  },
);

subCategoryRouter.post(
  '/delete',
  deleteSubCategory,
  validateRequestExactMatch,
  (req, res) => {
    subCategoryController.delete(req, res);
  },
);

// subCategoryRouter.post('/test', subCategoryController.test);

module.exports = subCategoryRouter;
