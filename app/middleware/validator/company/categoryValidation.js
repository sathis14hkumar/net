const { body, query, param } = require('express-validator');

const createCategory = [
  body('name', 'Enter valid name').isString().notEmpty(),
  body('status', 'Enter valid status').notEmpty().isInt().isIn([1]),
];
const updateCategory = [
  body('name', 'Enter valid name').isString().notEmpty(),
  body('status', 'Enter valid status').notEmpty().isInt().isIn([1]),
  body('categoryId', 'Enter valid categoryId').isMongoId().notEmpty(),
];

const readCategory = [
  body('categoryId', 'Enter valid categoryId')
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

const getChannelCategories = [
  param('channelId', 'Enter valid channelId').isMongoId().notEmpty(),
];

const deleteCategory = [
  body('categoryId', 'Enter valid categoryId').isMongoId().notEmpty(),
];

const deleteOne = [
  param('categoryId', 'Enter valid categoryId').isMongoId().notEmpty(),
];

module.exports = {
  createCategory,
  readCategory,
  getChannelCategories,
  updateCategory,
  deleteCategory,
  deleteOne,
};
