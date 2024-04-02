/* eslint-disable no-unused-vars */
const { query } = require('express-validator');
const { isObjectId } = require('../../validators');

const readLog = [
  query('postId', 'Enter valid postId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  query('skip', 'Enter valid skip')
    .isInt()
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('draw', 'Enter valid draw')
    .isInt()
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('page', 'Enter valid page')
    .notEmpty()
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('limit', 'Enter valid limit')
    .notEmpty()
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('search', 'Enter valid search').isString(),
  query('sortBy', 'Enter valid sortBy').isString(),
  query('sortWith', 'Enter valid sortWith').isString(),
];

module.exports = {
  readLog,
};
