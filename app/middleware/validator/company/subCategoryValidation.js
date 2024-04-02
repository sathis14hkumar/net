const { body, query, param } = require('express-validator');

const createSubCategory = [
  body('name', 'Enter valid name').isString().notEmpty(),
  body('status', 'Enter valid status').notEmpty().isInt().isIn([1]),
  body('categoryId', 'Enter valid categoryId').isMongoId().notEmpty(),
];
const updateSubCategory = [
  body('name', 'Enter valid name').isString().notEmpty(),
  body('status', 'Enter valid status').notEmpty().isInt().isIn([1]),
  body('subCategoryId', 'Enter valid subCategoryId').isMongoId().notEmpty(),
  body('categoryId', 'Enter valid categoryId')
    .isMongoId()
    .optional({ nullable: true, checkFalsy: true }),
];

const readSubCategory = [
  body('subCategoryId', 'Enter valid subCategoryId')
    .isMongoId()
    .optional({ nullable: true, checkFalsy: true }),
  query('search', 'Enter valid search')
    .isString()
    .optional({ nullable: true, checkFalsy: true }),
  query('page', 'Enter valid page')
    .optional({ nullable: true, checkFalsy: true })
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('limit', 'Enter valid limit')
    .optional({ nullable: true, checkFalsy: true })
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('sortWith', 'Enter valid sortWith')
    .isString()
    .optional({ nullable: true, checkFalsy: true }),
  query('sortBy', 'Enter valid sortBy')
    .isString()
    .optional({ nullable: true, checkFalsy: true }),
];

const deleteSubCategory = [
  body('subCategoryId', 'Enter valid subCategoryId').isMongoId().notEmpty(),
];
const getSubCategory = [
  param('categoryId', 'Enter valid categoryId').isMongoId().notEmpty(),
];

module.exports = {
  createSubCategory,
  readSubCategory,
  updateSubCategory,
  deleteSubCategory,
  getSubCategory,
};
