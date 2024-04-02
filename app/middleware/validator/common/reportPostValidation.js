const { body } = require('express-validator');
const { isObjectId } = require('../../validators');

const reportPost = [
  body('postId', 'Enter valid post Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('isWallAdmin', 'Enter valid isWallAdmin').isBoolean().optional(),
];

const reportCommment = [
  body('commentId', 'Enter valid commentId')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('isWallAdmin', 'Enter valid isWallAdmin').isBoolean().optional(),
];
const reportChannelPost = [
  body('postId', 'Enter valid post Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('isChannelAdmin', 'Enter valid isChannelAdmin').isBoolean().optional(),
];

const reportChannelComment = [
  body('postId', 'Enter valid post Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('commentId', 'Enter valid commentId')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

module.exports = {
  reportChannelComment,
  reportChannelPost,
  reportCommment,
  reportPost,
};
