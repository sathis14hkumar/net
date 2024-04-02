const express = require('express');

const notificationRouter = express.Router();
const multer = require('multer');

const notificationController = require('../../controllers/company/notificationController');
const __ = require('../../../helpers/globalFunctions');
const {
  validateRequestExactMatch,
  fileValidator,
  validateRequest,
} = require('../../middleware/validators');
const {
  myNotification,
  acknowledgedNotifications,
  readNotification,
  readAcknowledgedAndUnreadUser,
  downloadNotification,
  viewAllNotification,
  allQuestionAnswered,
  acknowledgeNotification,
  createNotification,
  unReadNotifications,
} = require('../../middleware/validator/company/notificationValidation');
const {
  checkFile,
  multerFileUploadErrorHandler,
} = require('../../../helpers/fileChecker.helper');

const storage = multer.memoryStorage({
  destination(req, file, cb) {
    cb(null, '');
  },
});
const upload = multer({
  storage,
});

// RENDER

const fileUpload = (fieldName) =>
  multerFileUploadErrorHandler(upload.single(fieldName));

notificationRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});
const inputNotification = async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.inputNotification) {
    switch (req.route.path) {
      case '/create':
        return notificationController.create(req, res);

      case '/update':
        return notificationController.update(req, res);

      default:
        return '';
    }
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }
};

notificationRouter.post(
  '/create',
  createNotification,
  validateRequestExactMatch,
  upload.single('notificationAttachment'),
  inputNotification,
);
notificationRouter.post(
  '/update',
  createNotification,
  validateRequestExactMatch,
  upload.single('notificationAttachment'),
  inputNotification,
);

notificationRouter.post(
  '/read',
  readNotification,
  validateRequestExactMatch,
  async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);

    if (routeprivilege.viewNotification) {
      return notificationController.read(req, res);
    }

    return __.out(res, 300, 'This account is not permitted to access');
  },
);

notificationRouter.get(
  '/readAcknowledgedAndUnreadUser/:_id',
  readAcknowledgedAndUnreadUser,
  validateRequestExactMatch,
  async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);

    if (routeprivilege.viewNotification) {
      return notificationController.getUserwhoUnreadOrAchknowledgedNotification(
        req,
        res,
      );
    }

    return __.out(res, 300, 'This account is not permitted to access');
  },
);

notificationRouter.get(
  '/viewAllNotification/:businessUnitId',
  viewAllNotification,
  validateRequestExactMatch,
  async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);

    if (routeprivilege.viewNotification) {
      return notificationController.viewAllNotification(req, res);
    }

    return __.out(res, 300, 'This account is not permitted to access');
  },
);

notificationRouter.get(
  '/mynotifications',
  myNotification,
  validateRequestExactMatch,
  (req, res) => {
    notificationController.myNotifications(req, res);
  },
);

notificationRouter.get(
  '/unReadNotifications',
  unReadNotifications,
  validateRequest,
  (req, res) => {
    notificationController.unReadNotifications(req, res);
  },
);

notificationRouter.get(
  '/acknowledgedNotifications/',
  acknowledgedNotifications,
  validateRequestExactMatch,
  (req, res) => {
    notificationController.acknowledgedNotifications(req, res);
  },
);

notificationRouter.post(
  '/acknowledge',
  acknowledgeNotification,
  validateRequestExactMatch,
  (req, res) => {
    notificationController.acknowledge(req, res);
  },
);

notificationRouter.post(
  '/download',
  downloadNotification,
  validateRequestExactMatch,
  (req, res) => {
    notificationController.download(req, res);
  },
);
// May be this API is not in used
notificationRouter.post('/getNotificModule', (req, res) => {
  notificationController.getNotificModule(req, res);
});

notificationRouter.post(
  '/uploadContentFiles',
  fileUpload('file'),
  fileValidator('file').validate,
  checkFile('file'),
  (req, res) => {
    notificationController.uploadContentFiles(req, res);
  },
);

notificationRouter.post(
  '/allQuestionAnswered',
  allQuestionAnswered,
  validateRequestExactMatch,
  (req, res) => {
    notificationController.allQuestionAnswered(req, res);
  },
);

module.exports = notificationRouter;
