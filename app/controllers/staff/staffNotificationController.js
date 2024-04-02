// Controller Code Starts here
const notificationController = require('../company/notificationController');
const __ = require('../../../helpers/globalFunctions');

class StaffNotificationController {
  async myNotifications(req, res) {
    const data = {
      userId: req.user._id,
    };
    const myNotifications = await notificationController.userNotifications(
      data,
      res,
    );

    return __.out(res, 201, myNotifications);
  }

  async acknowledge(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'notificationId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const data = {
        userId: req.user._id,
        notificationId: req.body.notificationId,
      };

      if (req.body.qnsresponses) {
        data.user = req.user;
        data.qnsresponses = req.body.qnsresponses;
      }

      __.log(data, 'userAcknowledge');

      return notificationController.userAcknowledge(data, res);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
const notification = new StaffNotificationController();

module.exports = notification;
