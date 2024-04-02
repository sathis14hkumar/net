/* eslint-disable no-unused-vars */
const { body, param } = require('express-validator');
const { isObjectId } = require('../../validators');

const readOnePost = [
  param('postId', 'Enter valid post Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

const readPost = [
  body('sortWith', 'Enter valid sortWith').optional().isString(),
  body('sortBy', 'Enter valid sortBy').optional().isString(),
  body('page', 'Enter valid page')
    .optional({ nullable: true, checkFalsy: true })
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  body('pageNum', 'Enter valid pageNum')
    .optional({ nullable: true, checkFalsy: true })
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  body('limit', 'Enter valid limit')
    .optional({ nullable: true, checkFalsy: true })
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  body('search', 'Enter valid search').isString().optional(),
  body('channelId', 'Enter valid channelId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  body('categoryId', 'Enter valid categoryId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  body('skip', 'Enter valid skip')
    .isInt()
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
];

const createComment = [
  body('postId', 'Enter valid postId')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('commentId', 'Enter valid commentId')
    .if((value, { req }) => value)
    .matches(isObjectId),
  body('comment', 'Enter valid comment').custom((value, { req }) => {
    if (!value && !req.body.attachment) {
      throw new Error('At least one of comment or comment must be provided');
    }

    return true;
  }),
  body('attachment', 'Enter valid attachment').custom((value, { req }) => {
    if (!value && !req.body.comment) {
      throw new Error('At least one of comment or comment must be provided');
    }

    return true;
  }),
];
const deleteComment = [
  body('commentId', 'Enter valid commentId').isString().matches(isObjectId),
];

const sharePost = [
  body('postId', 'Enter valid postId').isString().matches(isObjectId),
  body('wallId', 'Enter valid wallId').isString().matches(isObjectId),
  body('category', 'Enter valid category').isString().matches(isObjectId),
];

const reportComment = [
  body('postId', 'Enter valid postId').isString().matches(isObjectId),
  body('commentId', 'Enter valid commentId').isString().matches(isObjectId),
];

const postLike = [
  body('postId', 'Enter valid postId').isString().matches(isObjectId),
  body('isLiked', 'Enter valid isLiked').isBoolean().notEmpty(),
];
const viewComments = [
  param('postId', 'Enter valid post Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

module.exports = {
  readOnePost,
  readPost,
  createComment,
  deleteComment,
  sharePost,
  reportComment,
  postLike,
  viewComments,
};
