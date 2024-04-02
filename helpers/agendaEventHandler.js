const { agendaNormal } = require('./agendaInit');
const AppliedStaffs = require('../app/models/appliedStaff');
const ShiftDetails = require('../app/models/shiftDetails');
const AgendaJobs = require('../app/models/agenda');
const Ballot = require('../app/models/ballot');
const OpsGroup = require('../app/models/ops');
const User = require('../app/models/user');
const FCM = require('./fcm');
const {
  conductBallot,
  publishBallot,
  resultReleaseFun,
} = require('../app/controllers/company/ballotController');

const {
  autoApproveCron,
} = require('../app/controllers/company/attendanceController');
const { challengeReward } = require('./challengeReward');

const { logInfo, logError } = require('./logger.helper');

class AgendaCron {
  // check this
  async addEvent(dateTime, data, oneTime = true) {
    if (oneTime) {
      return agendaNormal.schedule(dateTime, 'eventHandler', data);
    }

    return true;
  }

  async removeEvent(
    where,
    update = { nextRunAt: null, 'data.isRemoved': true },
  ) {
    try {
      logInfo('remove event called', where);
      const job = await AgendaJobs.findOneAndUpdate(where, {
        $set: update,
      }).lean();

      logInfo('removeEvent job', job);
      return job;
    } catch (e) {
      logError('removeEvent has error', e);
      logError('removeEvent has error', e.stack);
      return false;
    }
  }
}

const backupStaffRemoval = async (data) => {
  try {
    logInfo('backupStaffRemoval called', data);
    const { shiftDetailId } = data;

    if (!shiftDetailId) {
      return true;
    }

    const shiftDetailsObj = await ShiftDetails.findOne({
      _id: shiftDetailId,
      $where: 'this.backUpStaffs.length > 0',
    });

    if (!shiftDetailsObj) {
      logInfo('backupStaffRemoval no backup staff found');
      return false;
    }

    const update = await ShiftDetails.findOneAndUpdate(
      {
        _id: shiftDetailId,
      },
      {
        $set: {
          backUpStaffs: [],
          backUpStaffsLog: shiftDetailsObj.backUpStaffs,
          backUpStaffNeedCountLog: shiftDetailsObj.backUpStaffNeedCount,
          backUpStaffNeedCount: 0,
        },
      },
    );
    const backupStaff = shiftDetailsObj.backUpStaffs;

    const updatePromises = backupStaff.map(async (userId) => {
      await AppliedStaffs.findOneAndUpdate(
        { flexiStaff: userId, shiftDetailsId: shiftDetailId },
        { status: 0 },
      );
      // Add shift limit
    });

    // Wait for all promises to complete
    await Promise.all(updatePromises);

    logInfo('backupStaffRemoval updated', update);
    return update;
  } catch (err) {
    logError('backupStaffRemoval update has error', err, err.stack);
    return err;
  }
};

const ballotNotification = async (item, type) => {
  try {
    logInfo('ballotNotification has called', item);
    let isNotified = 2;

    if (type === 2) {
      isNotified = 0;
    } else if (type === 1) {
      isNotified = 1;
    }

    item = await Ballot.findOne({
      isDeleted: false,
      isCanceled: false,
      isDraft: false,
      isNotified,
      _id: item.ballotId,
    });
    if (item) {
      const usersDeviceTokens = [];
      let userWhere = {};

      if (item.userFrom === 1) {
        // user from ops group
        const userIDArr = await OpsGroup.find(
          { _id: { $in: item.opsGroupId }, isDelete: false },
          {
            userId: 1,
            _id: 0,
          },
        );
        let userId = [];

        userIDArr.forEach((user) => {
          userId = userId.concat(user.userId);
        });
        userWhere = { _id: { $in: userId } };
      } else {
        // user from bu
        userWhere = { parentBussinessUnitId: { $in: item.businessUnitId } };
      }

      const unAssignUser = await User.find(userWhere)
        .select('deviceToken')
        .lean();

      unAssignUser.forEach((token) => {
        if (token.deviceToken) {
          usersDeviceTokens.push(token.deviceToken);
        }
      });
      const appLastDate = new Date(item.applicationCloseDateTime);
      const appLastDateHere = appLastDate.toISOString().slice(0, 10);
      let body = `Today is the Ballot Exercise ${item.ballotName} closing day ${appLastDateHere} if not balloted yet, ballot before it closes.`;
      let bodyText = `Today is the Ballot Exercise ${item.ballotName} closing day ${appLastDateHere} if not balloted yet, ballot before it closes.`;
      let bodyTime = [
        item.applicationCloseDateTime,
        item.applicationCloseDateTime,
      ];

      if (type === 2) {
        body = `Just 2 days left for close of this Ballot submission. Ballot Name: ${item.ballotName} Please Ballot in 2 days before it closes.`;
        bodyText = `Just 2 days left for close of this Ballot submission. Ballot Name: ${item.ballotName} Please Ballot in 2 days before it closes.`;
        bodyTime = [item.applicationCloseDateTime];
      } else if (type === 1) {
        body = `Just a day left for close of this Ballot submission. Ballot Name: ${item.ballotName} Please ballot before it closes.`;
        bodyText = `Just a day left for close of this Ballot submission. Ballot Name: ${item.ballotName} Please ballot before it closes.`;
        bodyTime = [item.applicationCloseDateTime];
      }

      if (usersDeviceTokens.length > 0) {
        const pushData = {
          title: 'Reminder on the Balloting Exercise',
          body,
          bodyText,
          bodyTime,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };
        const collapseKey = item._id; /* unique id for this particular ballot */

        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }

      isNotified += 1;
      await Ballot.updateOne({ _id: item._id }, { isNotified });
    }

    return true;
  } catch (e) {
    logError('ballotNotification has error', e);
    logError('ballotNotification has error', e.stack);
    return false;
  }
};

// if (process.env.pm_id === '0' || !process.env.pm_id) {
//   agendaNormal.define('autoApproveAttendanceCron', async () => {
//     try {
//       logInfo('autoApproveAttendanceCron called');
//       await autoApproveCron();
//       return true;
//     } catch (e) {
//       logError('autoApproveAttendanceCron error', e);
//       return true;
//     }
//   });
//   agendaNormal.define(
//     'eventHandler',
//     { priority: 'high', concurrency: 50 },
//     async (job) => {
//       try {
//         const { data } = job.attrs;

//         logInfo('eventHandler agenda cron', data);
//         switch (data.type) {
//           case 'BackupStaffRemoval':
//             backupStaffRemoval(data)
//               .then((result) => {
//                 logInfo('BackupStaffRemoval done', result);
//               })
//               .catch((err) => {
//                 logError('BackupStaffRemoval has error', err);
//               });
//             break;

//           case 'notificationBefore2Days':
//             ballotNotification(data, 2)
//               .then((result) => {
//                 logInfo('notificationBefore2Days done successfully', result);
//               })
//               .catch((err) => {
//                 logError('notificationBefore2Days has error', err);
//               });
//             break;

//           case 'notificationBefore1Day':
//             ballotNotification(data, 1)
//               .then((result) => {
//                 logInfo('notificationBefore1Day done successfully', result);
//               })
//               .catch((err) => {
//                 logError('notificationBefore1Day has error', err);
//               });
//             break;

//           case 'notificationOnDay':
//             ballotNotification(data, 0)
//               .then((result) => {
//                 logInfo('notificationOnDay done successfully', result);
//               })
//               .catch((err) => {
//                 logError('notificationOnDay has error', err);
//               });
//             break;

//           case 'conductBallot':
//             conductBallot(data.ballotId)
//               .then((result) => {
//                 logInfo('conductBallot done successfully', result);
//               })
//               .catch((err) => {
//                 logError('conductBallot has error', err);
//               });
//             break;

//           case 'publishBallot':
//             publishBallot(data.ballotId)
//               .then((result) => {
//                 logInfo('publishBallot done successfully', result);
//               })
//               .catch((err) => {
//                 logError('publishBallot has error', err);
//               });
//             break;

//           case 'resultRelease':
//             resultReleaseFun(data.ballotId)
//               .then((result) => {
//                 logInfo('ResultRelease done successfully', result);
//               })
//               .catch((err) => {
//                 logError('ResultRelease has error', err);
//               });
//             break;

//           case 'ChallengeReward':
//             challengeReward(data.challengeId)
//               .then((result) => {
//                 logInfo('ChallengeReward done successfully', result);
//               })
//               .catch((err) => {
//                 logError('ChallengeReward has error', err);
//               });
//             break;

//           default:
//             break;
//         }
//         return true;
//       } catch (e) {
//         logError('eventHandler has error', e);
//         return false;
//       }
//     },
//   );
// }

module.exports = new AgendaCron();
