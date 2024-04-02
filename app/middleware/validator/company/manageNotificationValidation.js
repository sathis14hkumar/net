const { body, query, param } = require('express-validator');
const { isObjectId, searchRegex } = require('../../validators');

const createNotification = [
  body('title', 'Enter valid title').notEmpty().isString(),
  body('description', 'Enter valid description').notEmpty().isString(),
  body('notificationType', 'Enter valid notification Type')
    .isInt()
    .notEmpty()
    .isIn([1, 2]),
  body('notificationTime', 'Enter valid notification Time')
    .isString()
    .notEmpty(),
  body('notificationSchedule', 'Enter valid notification Schedule')
    .isInt()
    .notEmpty()
    .isIn([1, 2, 3, 4]),
  body('activeFrom', 'Enter valid From Date').notEmpty().isString(),
  body('activeTo', 'Enter valid To Date')
    .if(body('notificationType').equals(2))
    .notEmpty()
    .isString(),
  body('day', 'Enter valid day')
    .if(body('notificationSchedule').equals(3))
    .notEmpty()
    .isString(),
  body('day', 'Enter valid day')
    .if(body('notificationSchedule').equals(4))
    .notEmpty()
    .isString(),
  body('timeZone', 'Enter valid userId').notEmpty().isString(),
  body('businessUnitId', 'Enter valid business Unit Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('isPublish', 'Enter valid publish').isBoolean().notEmpty(),
  body('assignUsers', 'Enter valid assign Users').isArray().notEmpty(),
];

const scheduleNotification = [
  body('timeZone', 'Enter valid userId').notEmpty().isString(),
  body('buId', 'Enter valid business Unit Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
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
  query('search', 'Enter valid search')
    .isString()
    .matches(searchRegex)
    .optional(),
];

const pushNotification = [
  body('timeZone', 'Enter valid userId').notEmpty().isString(),
  body('buId', 'Enter valid business Unit Id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
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
  query('search', 'Enter valid search')
    .isString()
    .matches(searchRegex)
    .optional(),
];

const singleNotification = [
  param('id', 'Enter valid id').notEmpty().matches(isObjectId).isString(),
];

const cancelNotification = [
  body('id', 'Enter valid id').notEmpty().matches(isObjectId).isString(),
];

const updateNotification = [
  body('title', 'Enter valid title').notEmpty().isString(),
  body('description', 'Enter valid description').notEmpty().isString(),
  body('notificationType', 'Enter valid notification Type')
    .isInt()
    .notEmpty()
    .isIn([1, 2]),
  body('notificationTime', 'Enter valid notification Time')
    .isString()
    .notEmpty(),
  body('notificationSchedule', 'Enter valid notification Schedule')
    .isInt()
    .notEmpty()
    .isIn([1, 2, 3, 4]),
  body('activeFrom', 'Enter valid From Date').notEmpty().isString(),
  body('activeTo', 'Enter valid To Date')
    .if(body('notificationType').equals(2))
    .notEmpty()
    .isString(),
  body('day', 'Enter valid day')
    .if(body('notificationSchedule').equals(3))
    .notEmpty()
    .isString(),
  body('day', 'Enter valid day')
    .if(body('notificationSchedule').equals(4))
    .notEmpty()
    .isString(),
  body('timeZone', 'Enter valid userId').notEmpty().isString(),
  body('businessUnitId', 'Enter valid business Unit Id')
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('isPublish', 'Enter valid publish').isBoolean().notEmpty(),
  body('assignUsers', 'Enter valid assign Users').isArray().notEmpty(),
  body('_id', 'Enter valid Id').notEmpty().isString().matches(isObjectId),
  body('isSend', 'Enter valid isSend').isBoolean().notEmpty(),
];
// {
//     "title": "efeew",
//     "description": "fewfewe",
//     "notificationType": 1,
//     "notificationTime": "00:10",
//     "notificationSchedule": 1,
//     "activeFrom": "10-10-2023 00:00:00 GMT+0530",
//     "timeZone": "GMT+0530",
//     "businessUnitId": "5a9d17b636ab4f444b4271dd",
//     "isPublish": true,
//     "assignUsers": [
//         {
//             "businessUnits": [],
//             "buFilterType": 1,
//             "appointments": [],
//             "subSkillSets": [],
//             "user": [],
//             "admin": [],
//             "allBuToken": true,
//             "allBuTokenStaffId": "admin001",
//             "customField": []
//         }
//     ]
// }

// {
//     "title": "dscdwfdw",
//     "description": "dfwewd",
//     "notificationType": 2,
//     "notificationTime": "00:10",
//     "notificationSchedule": 2,
//     "activeTo": "10-31-2023 00:00:00 GMT+0530",
//     "activeFrom": "10-10-2023 00:00:00 GMT+0530",
//     "timeZone": "GMT+0530",
//     "businessUnitId": "5a9d17b636ab4f444b4271dd",
//     "isPublish": false,
// }

// {
//     "title": "wdewewe",
//     "description": "wedeww",
//     "notificationType": 2,
//     "notificationTime": "00:20",
//     "day": "1",
//     "notificationSchedule": 3,
//     "activeTo": "10-31-2023 00:00:00 GMT+0530",
//     "activeFrom": "10-10-2023 00:00:00 GMT+0530",
//     "timeZone": "GMT+0530",
//     "businessUnitId": "5a9d17b636ab4f444b4271dd",
//     "isPublish": true,
//     "assignUsers": [
//         {
//             "businessUnits": [
//                 "5ada74ab28e2447e6419a551"
//             ],
//             "buFilterType": 1,
//             "appointments": [],
//             "subSkillSets": [],
//             "user": [],
//             "admin": [],
//             "allBuToken": false,
//             "allBuTokenStaffId": "",
//             "customField": []
//         }
//     ]
// }

module.exports = {
  createNotification,
  scheduleNotification,
  pushNotification,
  singleNotification,
  cancelNotification,
  updateNotification,
};
