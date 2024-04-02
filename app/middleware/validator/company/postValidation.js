/* eslint-disable no-unused-vars */
const { body, param, query } = require('express-validator');
const { isObjectId } = require('../../validators');

const readOnePost = [
  param('postId', 'Enter valid post Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];
const exportWallData = [
  body('_id', 'Enter valid Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];
const updateCommentStatus = [
  body('postId', 'Enter valid post Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('status', 'Enter valid status').isInt().isIn([0, 1, 2]),
];
const reportedComments = [
  param('postType', 'Enter valid postType').notEmpty().isString(),
  query('sortWith', 'Enter valid sortWith').notEmpty().isString(),
  query('sortBy', 'Enter valid sortBy').notEmpty().isString(),
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
  query('search', 'Enter valid search').isString().optional(),
];

const reportedPosts = [
  param('postType', 'Enter valid postType').notEmpty().isString(),
  query('sortWith', 'Enter valid sortWith').notEmpty().isString(),
  query('sortBy', 'Enter valid sortBy').notEmpty().isString(),
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
  query('search', 'Enter valid search').isString().optional(),
];

const allNews = [
  param('companyId', 'Enter a valid companyId').notEmpty().isMongoId(),
  query('postType', 'Enter valid postType').isString().optional(),
  query('categoryId', 'Enter valid categoryId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  query('channelId', 'Enter valid channelId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  query('sortWith', 'Enter valid sortWith').notEmpty().isString(),
  query('sortBy', 'Enter valid sortBy').notEmpty().isString(),
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
  query('search', 'Enter valid search').isString().optional(),
];
const getManageNews = [
  query('postType', 'Enter valid postType').isString().optional(),
  query('categoryId', 'Enter valid categoryId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  query('channelId', 'Enter valid channelId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  query('sortWith', 'Enter valid sortWith').isString().optional(),
  query('sortBy', 'Enter valid sortBy').isString().optional(),
  query('page', 'Enter valid page')
    .isInt()
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('limit', 'Enter valid limit')
    .isInt()
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('search', 'Enter valid search').isString().optional(),
];

const createPost = [
  body('categoryId', 'Enter valid categoryId')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('channelId', 'Enter valid channelId')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('content', 'Enter valid content').notEmpty().isObject(),
  body('eventCreation', 'Enter valid eventCreation')
    .isInt()
    .isIn([0, 1, 2])
    .optional({ nullable: true, checkFalsy: true }),
  body('eventDetails', 'Enter valid eventDetails').isObject().optional(),
  body('eventWallLogoImage', 'Enter valid eventWallLogoImage')
    .isString()
    .optional({ nullable: true, checkFalsy: true }),
  body('mainImage', 'Enter valid mainImage').isString().optional(),
  body('postType', 'Enter valid postType').isString().notEmpty(),
  body('publishing', 'Enter valid publishing').notEmpty().isObject(),
  body('publish', 'Enter valid publish').isObject().optional(),
  body('teaser', 'Enter valid teaser').notEmpty().isObject(),
  body('teaserImage', 'Enter valid teaserImage')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('userOptions', 'Enter valid userOptions').isObject().optional(),
  body('wallTitle', 'Enter valid wallTitle').isObject().optional(),
  body('moduleId', 'Enter valid moduleId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  body('status', 'Enter valid status').isInt().notEmpty().isIn([0, 1, 2]),
];
const updatePost = [
  body('categoryId', 'Enter valid categoryId')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('postId', 'Enter valid postId')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('channelId', 'Enter valid channelId')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('content', 'Enter valid content').notEmpty().isObject(),
  body('eventCreation', 'Enter valid eventCreation')
    .isInt()
    .optional({ nullable: true, checkFalsy: true })
    .isIn([0, 1, 2]),
  body('eventDetails', 'Enter valid eventDetails').isObject(),
  body('eventWallLogoImage', 'Enter valid eventWallLogoImage')
    .isString()
    .optional(),
  body('mainImage', 'Enter valid mainImage').isString().optional(),
  body('postType', 'Enter valid postType').isString().notEmpty(),
  body('publishing', 'Enter valid publishing').notEmpty().isObject(),
  body('publish', 'Enter valid publish').isObject().optional(),
  body('teaser', 'Enter valid teaser').notEmpty().isObject(),
  body('teaserImage', 'Enter valid teaserImage').isString().optional(),
  body('isNotifi', 'Enter valid isNotifi').notEmpty().isBoolean(),
  body('userOptions', 'Enter valid userOptions').isObject().optional(),
  body('wallTitle', 'Enter valid wallTitle').isObject().optional(),
  body('moduleId', 'Enter valid moduleId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  body('status', 'Enter valid status').isInt().notEmpty().isIn([0, 1, 2]),
];

module.exports = {
  readOnePost,
  exportWallData,
  updateCommentStatus,
  reportedComments,
  allNews,
  getManageNews,
  createPost,
  updatePost,
  reportedPosts,
};
