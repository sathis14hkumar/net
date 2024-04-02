const { body, query, param } = require('express-validator');
const { isObjectId, searchRegex } = require('../../validators');

const myNotification = [
  query('sortWith', 'Enter valid sortWith').optional().isString(),
  query('sortBy', 'Enter valid sortBy').optional().isString(),
  query('page', 'Enter valid page')
    .optional()
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('limit', 'Enter valid limit')
    .optional()
    .isInt()
    .custom((value) => {
      if (value < 0) {
        throw new Error('Must be a positive number');
      }

      return true;
    }),
  query('search', 'Enter valid search')
    .isString()
    .matches(searchRegex)
    .optional(),
];

const unReadNotifications = [
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
  query('search', 'Enter valid search')
    .isString()
    .matches(searchRegex)
    .optional(),
];

const acknowledgedNotifications = [
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
  query('search', 'Enter valid search')
    .isString()
    .matches(searchRegex)
    .optional(),
];

const acknowledge = [
  body('notificationId', 'Enter valid notification Id')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

const readNotification = [
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
  query('search', 'Enter valid search')
    .isString()
    .matches(searchRegex)
    .optional(),
  body('businessUnitId', 'Enter valid businessUnitId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

const readAcknowledgedAndUnreadUser = [
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
  query('from', 'Enter valid search').isString().optional(),
  param('_id', 'Enter valid notification Id')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

const downloadNotification = [
  body('date', 'Enter valid date').notEmpty().toDate(),
  body('notificationId', 'Enter valid notification Id')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

const viewAllNotification = [
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
  query('search', 'Enter valid search')
    .isString()
    .matches(searchRegex)
    .optional(),
  param('businessUnitId', 'Enter valid businessUnitId')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

const allQuestionAnswered = [
  body('notificationId', 'Enter valid notification Id')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

const acknowledgeNotification = [
  body('notificationId', 'Enter valid notification Id')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
];

const createNotification = [
  body('title', 'Enter valid title').notEmpty().isString(),
  body('notificationId', 'Enter valid notificationId').isString(),
  body('subTitle', 'Enter valid subTitle').notEmpty().isString(),
  body('description', 'Enter valid description').notEmpty().isString(),
  body('effectiveFrom', 'Enter valid effectiveFrom').notEmpty().isString(),
  body('effectiveTo', 'Enter valid effectiveTo').notEmpty().isString(),
  body('activeFrom', 'Enter valid activeFrom').notEmpty().isString(),
  body('activeTo', 'Enter valid activeTo').notEmpty().isString(),
  body('businessUnitId', 'Enter valid businessUnit Id')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('subCategoryId', 'Enter valid subCategory Id')
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('notificationAttachment', 'Enter valid notificationAttachment')
    .notEmpty()
    .isString(),
  body('isDynamic', 'Enter valid isDynamic').notEmpty().isBoolean(),
  body('viewOnly', 'Enter valid viewOnly').notEmpty().isBoolean(),
  body('moduleIncluded', 'Enter valid moduleIncluded').notEmpty().isBoolean(),
  body('moduleId', 'Enter valid moduleId')
    .if(body('moduleIncluded').equals(true))
    .notEmpty()
    .matches(isObjectId)
    .isString(),
  body('status', 'Enter valid status').notEmpty().isInt().isIn([0, 1, 2]),
  body('assignUsers', 'Enter valid assignUsers').notEmpty().isArray(),
];

module.exports = {
  myNotification,
  acknowledgedNotifications,
  acknowledge,
  readNotification,
  readAcknowledgedAndUnreadUser,
  downloadNotification,
  viewAllNotification,
  allQuestionAnswered,
  acknowledgeNotification,
  createNotification,
  unReadNotifications,
};
