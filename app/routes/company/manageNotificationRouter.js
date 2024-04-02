const express = require('express');

const manageNotificationController = require('../../controllers/company/manageNotificationController');
const { validateRequestExactMatch } = require('../../middleware/validators');
const {
  createNotification,
  scheduleNotification,
  pushNotification,
  singleNotification,
  cancelNotification,
  updateNotification,
} = require('../../middleware/validator/company/manageNotificationValidation');

const router = express.Router();

router.post(
  '/create',
  createNotification,
  validateRequestExactMatch,
  (req, res) => {
    manageNotificationController.createNotification(req, res);
  },
);
router.post(
  '/scheduled',
  scheduleNotification,
  validateRequestExactMatch,
  (req, res) => {
    manageNotificationController.getScheduleNotification(req, res);
  },
);
router.post(
  '/pushed',
  pushNotification,
  validateRequestExactMatch,
  (req, res) => {
    manageNotificationController.getPushNotification(req, res);
  },
);
router.get(
  '/single/:id',
  singleNotification,
  validateRequestExactMatch,
  (req, res) => {
    manageNotificationController.getSingle(req, res);
  },
);
router.post(
  '/cancel',
  cancelNotification,
  validateRequestExactMatch,
  (req, res) => {
    manageNotificationController.cancelled(req, res);
  },
);
router.post(
  '/update',
  updateNotification,
  validateRequestExactMatch,
  (req, res) => {
    manageNotificationController.updateNotification(req, res);
  },
);

module.exports = router;
