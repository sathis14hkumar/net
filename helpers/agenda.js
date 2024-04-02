const Mongoose = require('mongoose');
const { agendaNotification } = require('./agendaInit');
const { logInfo, logError } = require('./logger.helper');
const ManageNotification = require('./manageNotification');

class CreateAgenda {
  async createJob(jobName, cron, data) {
    try {
      logInfo('agenda createJob called');
      const job = await agendaNotification.schedule(cron, jobName, data);

      return job;
    } catch (e) {
      logError('createJob has error');
      return null;
    }
  }

  async sendNotification(notificationData) {
    try {
      const result = await ManageNotification.sendNotification(
        notificationData,
        false,
      );

      return result;
    } catch (e) {
      logError('sendNotification has error', e);
      logError('sendNotification has error', e.stack);
      return null;
    }
  }
}

// if (process.env.pm_id === '0' || !process.env.pm_id) {
//   agendaNotification.define('ad-hoc', async (job) => {
//     try {
//       logInfo('ad-hoc agenda cron', job);
//       const data = job?.attrs.data;
//       const notificationData = data.otherModules
//         ? data
//         : {
//             _id: Mongoose.Types.ObjectId(data._id),
//             moduleType: data.moduleType,
//           };

//       new CreateAgenda()
//         .sendNotification(notificationData, false)
//         .then((result) => {
//           logInfo('result ad-hoc', result);
//         })
//         .catch((err) => {
//           logError('result ad-hoc', err);
//         });
//     } catch (e) {
//       logError('ad-hoc agenda cron', e);
//       logError('ad-hoc agenda cron', e.stack);
//     }
//   });
// }

module.exports = new CreateAgenda();
