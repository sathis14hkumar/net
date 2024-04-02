// Controller Code Starts here
/* eslint-disable no-await-in-loop */
const _ = require('lodash');
const multiparty = require('multiparty');
const moment = require('moment');
const csv = require('csvtojson');
const json2csv = require('json2csv').parse;
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const StaffSapData = require('../../models/staffSAPData');
const Ballot = require('../../models/ballot');
const OpsGroup = require('../../models/ops');
const OpsTeam = require('../../models/opsTeam');
const User = require('../../models/user');
const PageSettingModel = require('../../models/pageSetting');
const __ = require('../../../helpers/globalFunctions');
const FCM = require('../../../helpers/fcm');
const swopRequests = require('../../models/swapRequests');
const leaveApplications = require('../../models/leaveApplication');
const userLeaves = require('../../models/userLeaves');
const leaveType = require('../../models/leaveType');
const staffLeave = require('../../models/staffLeave');
const LeaveApplied = require('../../models/leaveApplied');
const LeaveType = require('../../models/leaveType');
const LeaveGroup = require('../../models/leaveGroup');

const RATIO = 1;
const { agendaNormal } = require('../../../helpers/agendaInit');
const AgendaJobs = require('../../models/agenda');
const { logInfo, logError } = require('../../../helpers/logger.helper');

function isEmpty(obj) {
  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
  }
  return true;
}

function groupByOU(array, f) {
  const groups = {};

  array.forEach((o) => {
    const group = JSON.stringify(f(o));

    groups[group] = groups[group] || [];

    groups[group].push(o);
  });

  return Object.keys(groups).map((group) => {
    const arrayData = JSON.parse(`[${group}]`);

    return {
      userId: arrayData[0][0],
      opsId: arrayData[0][1],
      teamId: arrayData[0][2],
      data: groups[group],
    };
  });
}

function checkForIsRestrict(clone) {
  let cc = false;

  for (const [value] of Object.entries(clone)) {
    if (value.isRestrict) {
      cc = true;
    }
  }

  return cc;
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function groupBy(xs, key) {
  return xs.reduce((rv, x) => {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
}

function groupByA(array, f) {
  const groups = {};

  array.forEach((o) => {
    const group = JSON.stringify(f(o));

    groups[group] = groups[group] || [];

    groups[group].push(o);
  });

  return Object.keys(groups).map((group) => {
    array = JSON.parse(`[${group}]`);

    groups[group] = JSON.parse(JSON.stringify(groups[group]));
    groups[group].forEach((ite, ind) => {
      groups[group][ind].ballotRound = array[0][3] + 1;
    });

    return {
      userId: array[0][0],
      opsId: array[0][1],
      teamId: array[0][2],
      ballotRound: array[0][3] + 1,
      data: groups[group],
    };
  });
}

function groupBySingle(data) {
  const grouped = _.mapValues(_.groupBy(data, 'userId'), (fileList) =>
    fileList.map((file) => _.omit(file, 'userId')),
  );

  return grouped;
}

function getRandomNumber(length, howMany) {
  if (howMany > length) {
    howMany = length;
  }

  const arr = [];

  for (let i = 0; i < howMany; i += 1) {
    const num = Math.floor(Math.random() * (length - 0)) + 0;

    if (arr.includes(num)) {
      i -= 1;
    } else {
      arr.push(num);
    }
  }
  return arr;
}

async function managePlanLeave(
  userId,
  leaveQuota,
  leaveTypeData,
  startYear = new Date().getFullYear(),
) {
  const updateStaffLeave = await staffLeave.findOneAndUpdate(
    {
      userId,
      leaveDetails: {
        $elemMatch: { year: startYear, leaveTypeId: leaveTypeData.leaveTypeId },
      },
    },
    {
      $inc: {
        'leaveDetails.$.planQuota': leaveQuota,
        'leaveDetails.$.request': leaveQuota,
      },
    },
  );

  return updateStaffLeave;
}

async function checkIsAnnualLeave(
  userId,
  companyId,
  year,
  isFixedBallotingLeaveType = false,
  leaveTypeId = null,
) {
  let annualLeave;

  if (isFixedBallotingLeaveType) {
    annualLeave = await leaveType.findOne({
      _id: leaveTypeId,
      isActive: true,
      companyId,
    });
  } else {
    annualLeave = await leaveType.findOne({
      name: 'Annual Leave',
      isActive: true,
      companyId,
    });
  }

  if (annualLeave) {
    const staffLevaeData = await staffLeave.findOne({
      userId,
      'leaveDetails.leaveTypeId': annualLeave._id,
    });

    if (staffLevaeData) {
      if (!year) {
        const leaveTypeData = staffLevaeData.leaveDetails.filter(
          (leave) =>
            leave.leaveTypeId.toString() === annualLeave._id.toString(),
        )[0];

        return {
          leaveTypeData,
          status: true,
          leaveGroupId: staffLevaeData.leaveGroupId,
          businessUnitId: staffLevaeData.businessUnitId,
        };
      }

      let leaveTypeData = staffLevaeData.leaveDetails.filter(
        (leave) =>
          leave.leaveTypeId.toString() === annualLeave._id.toString() &&
          leave.year === year,
      );

      let status = true;

      if (leaveTypeData && leaveTypeData.length > 0) {
        [leaveTypeData] = leaveTypeData;
      } else {
        status = false;
        leaveTypeData = {};
        leaveTypeData.planQuota = 0;
      }

      return {
        leaveTypeData,
        status,
        leaveGroupId: staffLevaeData.leaveGroupId,
        businessUnitId: staffLevaeData.businessUnitId,
      };
    }

    return { status: false };
  }

  return { status: false };
}

async function insertStaffLeaveForBallot(
  finalWinStaff,
  ballot,
  totalDeducated,
) {
  // userId, weekNo,
  // yyyy-mm-dd
  const finalLeave = [];

  const promiseData = [];
  const finalWinStaffCall = async (staffWon) => {
    const { userId } = staffWon;
    const leaveTypeData = await checkIsAnnualLeave(userId, ballot.companyId);

    if (leaveTypeData.status) {
      const slotWon = staffWon.weekNo;
      const slotArr = ballot.weekRange;
      const slotValue = slotArr[slotWon];
      const startDate = moment(slotValue.start); // .format('DD-MM-YYYY');
      const endDate = moment(slotValue.end);
      const diff = endDate.diff(startDate, 'days') + 1;
      const { leaveTypeId } = leaveTypeData.leaveTypeData;
      const { leaveGroupId } = leaveTypeData;
      const parentBussinessUnitId = leaveTypeData.businessUnitId;
      const obj = {
        ballotId: ballot._id,
        userId,
        startDate,
        endDate,
        totalDeducated,
        totalRestOff: diff - totalDeducated,
        leaveTypeId,
        leaveGroupId,
        remark: 'Won by Ballot',
        timeZone: ballot.timeZone,
        totalDay: diff,
        businessUnitId: parentBussinessUnitId,
        status: 4,
        submittedFrom: 4,
      };

      finalLeave.push(obj);
    } else {
      // failed to won as anuual leave is not present
    }
  };

  for (let i = 0; i < finalWinStaff.length; i += 1) {
    promiseData.push(finalWinStaffCall(finalWinStaff[i]));
  }

  await Promise.all(promiseData);

  await Ballot.findOneAndUpdate(
    { _id: ballot._id },
    { $set: { staffLeave: finalLeave } },
  );
}

async function unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId) {
  const ballotData = await Ballot.findOne({ _id: ballotId });
  let leave = 5;

  if (ballotData.leaveConfiguration === 2) {
    leave = 6;
  } else if (ballotData.leaveConfiguration === 3) {
    leave = 7;
  } else if (ballotData.leaveConfiguration === 4) {
    leave = 1;
  }

  if (ballotData.leaveType === 2) {
    leave = 1;
  }

  const appliedStaff = groupBy(ballotData.appliedStaff, 'userId');
  const wonStaff = groupBy(ballotData.wonStaff, 'userId');
  const updateLeaveBy = [];

  for (const key of Object.keys(appliedStaff)) {
    const obj = {
      userId: key,
      value: 0,
      startYear: new Date().getFullYear,
    };
    const staffAppliedCount = appliedStaff[key].length;
    const slotNo = appliedStaff[key][0].weekNo;
    const startDate = ballotData.weekRange[slotNo].start;
    const startYearF = new Date(startDate).getFullYear();
    let staffWonCount = 0;

    if (wonStaff[key]) {
      staffWonCount = wonStaff[key].length;
    }

    obj.startYear = startYearF;
    obj.value = (staffAppliedCount - staffWonCount) * leave;
    updateLeaveBy.push(obj);
  }

  for (let i = 0; i < updateLeaveBy.length; i += 1) {
    const user = updateLeaveBy[i];
    const { userId } = user;
    const { startYear } = user;

    let leaveTypeData;

    if (ballotData !== null && ballotData.fixedBallotingLeaveType) {
      leaveTypeData = await checkIsAnnualLeave(
        userId,
        ballotData.companyId,
        null,
        true,
        ballotData.leaveTypeId,
      );
    } else {
      leaveTypeData = await checkIsAnnualLeave(
        userId,
        ballotData.companyId,
        null,
        false,
      );
    }

    if (leaveTypeData.status) {
      await managePlanLeave(
        userId,
        user.value,
        leaveTypeData.leaveTypeData,
        startYear,
      );
    }
  }
}

function checkStaffRestrict(
  selectedStaffR,
  ballotDataR,
  slotNo,
  autoWonStaff,
  oldBallotStaffWon,
  leaveAppliedData,
) {
  // staff restricted

  const userIdR = selectedStaffR.userId.toString();
  const { startDate } = ballotDataR.slotCreation[0].arr[slotNo];
  let isWinStaff = [];

  if (ballotDataR && ballotDataR.length > 0) {
    ballotDataR.wonStaff = ballotDataR.concat(autoWonStaff);
  } else {
    ballotDataR.wonStaff = autoWonStaff;
  }

  // start Already Won
  if (ballotDataR.wonStaff && ballotDataR.wonStaff.length > 0) {
    isWinStaff = ballotDataR.wonStaff.filter(
      (win) => win.userId.toString() === userIdR && win.weekNo === slotNo,
    );
    if (isWinStaff.length > 0) {
      return true;
    }
  }

  // end Already Won

  // start Staff Restriction for a particular

  if (ballotDataR.staffRestriction && ballotDataR.staffRestriction.length > 0) {
    const staffRestrictionResultArr = ballotDataR.staffRestriction.filter(
      (staffRestriction) =>
        new Date(staffRestriction.startDate).getTime() ===
        new Date(startDate).getTime(),
    );

    if (staffRestrictionResultArr.length > 0) {
      const staffRestrictionResult = staffRestrictionResultArr[0];
      const userListArr = staffRestrictionResult.userList.filter(
        (userList) => userList.id.toString() === userIdR,
      );

      if (userListArr.length > 0) {
        return true;
      }
    }
  }

  // end Staff Restriction for a particular

  // get slot win
  const slotWinData = ballotDataR.wonStaff.filter(
    (win) => win.userId.toString() === userIdR,
  );
  const slotWinNo = [];

  slotWinData.forEach((item) => {
    slotWinNo.push(item.weekNo);
  });

  slotWinNo.push(slotNo);
  slotWinNo.sort((a, b) => a - b);
  // maxConsecutiveBallot start
  const { maxConsecutiveBallot } = ballotDataR;

  if (slotWinNo.length > 1 && maxConsecutiveBallot) {
    let checkMaxCons = 0;
    let ismaxConsecutiveBallot = false;

    for (let i = 0; i < slotWinNo.length; i += 1) {
      if (i !== 0) {
        const lastValue = slotWinNo[i - 1];
        const currentValue = slotWinNo[i];
        const diff = currentValue - lastValue;

        if (diff === 1) {
          checkMaxCons += 1;
          if (checkMaxCons >= maxConsecutiveBallot) {
            ismaxConsecutiveBallot = true;
            break;
          }
        } else {
          checkMaxCons = 0;
        }
      }
    }
    if (ismaxConsecutiveBallot) {
      return true;
    }
  }
  // maxConsecutiveBallot end

  // Segement restriction start;
  const maxSegement = ballotDataR.maxSegment;

  if (maxSegement && maxSegement.length > 0) {
    const segmentArr = maxSegement.filter(
      (segement) =>
        new Date(segement.startDate).getTime() <=
          new Date(startDate).getTime() &&
        new Date(segement.endDate).getTime() >= new Date(startDate).getTime(),
    );

    if (segmentArr.length > 0) {
      const segement = segmentArr[0];

      if (segement.maxBallot) {
        const segementStartDate = new Date(segement.startDate);
        let yearStartDate = new Date(segementStartDate.getFullYear(), 0, 1);
        let daysTillThen = Math.floor(
          (segementStartDate - yearStartDate) / (24 * 60 * 60 * 1000),
        );

        const weekNumberForSegementStartDate = Math.ceil(daysTillThen / 7);

        const segementEndDate = new Date(segement.endDate);

        yearStartDate = new Date(segementEndDate.getFullYear(), 0, 1);
        daysTillThen = Math.floor(
          (segementEndDate - yearStartDate) / (24 * 60 * 60 * 1000),
        );

        const weekNumberForSegementEndDate = Math.ceil(daysTillThen / 7);

        let slotWon = 0;

        for (
          let i = weekNumberForSegementStartDate - 1;
          i < weekNumberForSegementEndDate - 1;
          i += 1
        ) {
          const slotWonArr = ballotDataR.wonStaff.filter(
            (ww) => ww.weekNo === i && ww.userId.toString() === userIdR,
          );
          const leaveAppliedFilter = leaveAppliedData.filter(
            (ww) =>
              ww.startDate >= segementStartDate &&
              ww.startDate <= segementEndDate,
          );

          if (slotWonArr.length > 0 || leaveAppliedFilter.length > 0) {
            slotWon += 1;
          }
        }
        if (slotWon >= segement.maxBallot) {
          return true;
        }
      } else {
        return true;
      }
    }
  }
  // Segement restriction end;

  // check old ballot data
  const oldStartDate = new Date(ballotDataR.weekRange[slotNo].start).getTime();
  const oldEndDate = new Date(ballotDataR.weekRange[slotNo].end).getTime();

  let isOldWin = false;

  for (let i = 0; i < oldBallotStaffWon.length; i += 1) {
    const oldStaffWonObj = oldBallotStaffWon[i];

    if (
      oldStaffWonObj.userId === userIdR &&
      ((oldStartDate >= oldStaffWonObj.startDate &&
        oldStartDate <= oldStaffWonObj.endDate) ||
        (oldEndDate >= oldStaffWonObj.startDate &&
          oldEndDate <= oldStaffWonObj.endDate))
    ) {
      isOldWin = true;
      break;
    }
  }
  return isOldWin;
}

function groupByAuto(array, f) {
  const groups = {};

  array.forEach((o) => {
    const group = JSON.stringify(f(o));

    groups[group] = groups[group] || [];

    groups[group].push(o);
  });

  return Object.keys(groups).map((group) => {
    const arrayData = JSON.parse(`[${group}]`);

    return {
      userId: arrayData[0][0],
      opsId: arrayData[0][1],
      teamId: arrayData[0][2],
      isAuto: arrayData[0][3],
      data: groups[group],
    };
  });
}

async function ballotCancelledNotifications(item) {
  const currentTime = new Date();

  if (item.userFrom === 1) {
    const userIDArr = await OpsGroup.find(
      { _id: { $in: item.opsGroupId }, isDelete: false },
      { userId: 1, _id: 0 },
    );
    let userId = [];

    userIDArr.forEach((items) => {
      userId = userId.concat(items.userId);
    });
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select('deviceToken')
      .lean();
    const usersDeviceTokens = [];

    unAssignUser.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: 'Balloting Excercise Cancelled.',
        body: `Balloting Excercise "${item.ballotName}" has been Cancelled.`,
        bodyText: `Balloting Excercise "${item.ballotName}" has been Cancelled.`,
        bodyTime: currentTime,
        bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
      };
      const collapseKey = item._id; /* unique id for this particular ballot */

      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }

    await Ballot.update({ _id: item._id }, { isNotified: 4 });
  } else {
    // user from bu
    const userList = await User.find(
      { parentBussinessUnitId: { $in: item.businessUnitId } },
      { _id: 0, deviceToken: 1 },
    );
    const usersDeviceTokens = [];

    userList.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: 'Ballot Cancelled',
        body: `Ballot${item.ballotName}has been Cancelled.`,
        bodyText: `Ballot${item.ballotName}has been Cancelled.`,
        bodyTime: currentTime,
        bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
      };
      const collapseKey = item._id; /* unique id for this particular ballot */

      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }

    await Ballot.update({ _id: item._id }, { isNotified: 4 });
  }
}

async function ballotExtendNotifications(item) {
  const currentTime = new Date();

  if (item.userFrom === 1) {
    // user from ops group
    const userIDArr = await OpsGroup.find(
      { _id: { $in: item.opsGroupId }, isDelete: false },
      { userId: 1, _id: 0 },
    );
    let userId = [];

    userIDArr.forEach((items) => {
      userId = userId.concat(items.userId);
    });
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select('deviceToken')
      .lean();
    const usersDeviceTokens = [];

    unAssignUser.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: 'Balloting Excercise Extended',
        body: `Closing date of Balloting Excercise "${item.ballotName}" has been extended. Please check the new closing date.`,
        bodyText: `Closing date of Balloting Excercise "${item.ballotName}" has been extended. Please check the new closing date.`,
        bodyTime: currentTime,
        bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
      };
      const collapseKey = item._id; /* unique id for this particular ballot */

      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }

    await Ballot.update({ _id: item._id }, { isNotified: 3 });
  } else {
    // user from bu
    const userList = await User.find(
      { parentBussinessUnitId: { $in: item.businessUnitId } },
      { _id: 0, deviceToken: 1 },
    );
    const usersDeviceTokens = [];

    userList.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: 'Ballot Extended',
        body: 'Ballot Application date is extended.',
        bodyText: `Applocation closing date for  Ballot: ${item.ballotName}is extended.`,
        bodyTime: currentTime,
        bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
      };
      const collapseKey = item._id; /* unique id for this particular ballot */

      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }

    await Ballot.update({ _id: item._id }, { isNotified: 3 });
  }
}

async function sendBallotEditNotification(item) {
  const currentTime = new Date();

  if (item.userFrom === 1) {
    const userIDArr = await OpsGroup.find(
      { _id: { $in: item.opsGroupId }, isDelete: false },
      { userId: 1, _id: 0 },
    );
    let userId = [];

    userIDArr.forEach((items) => {
      userId = userId.concat(items.userId);
    });
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select('deviceToken')
      .lean();
    const usersDeviceTokens = [];

    unAssignUser.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: 'Balloting Excercise Updated.',
        body: `Balloting Excercise "${item.ballotName}" has been revised, please see the new details.`,
        bodyText: `Balloting Excercise "${item.ballotName}" has been revised, please see the new details.`,
        bodyTime: currentTime,
        bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
      };
      const collapseKey = item._id; /* unique id for this particular ballot */

      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }

    await Ballot.update({ _id: item._id }, { isNotified: 4 });
  } else {
    // user from bu
    const userList = await User.find(
      { parentBussinessUnitId: { $in: item.businessUnitId } },
      { _id: 0, deviceToken: 1 },
    );
    const usersDeviceTokens = [];

    userList.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: 'Balloting Excercise Updated.',
        body: `Balloting Excercise "${item.ballotName}" has been revised, please see the new details.`,
        bodyText: `Balloting Excercise "${item.ballotName}" has been revised, please see the new details.`,
        bodyTime: currentTime,
        bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
      };
      const collapseKey = item._id; /* unique id for this particular ballot */

      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }

    await Ballot.update({ _id: item._id }, { isNotified: 4 });
  }
}

class BallotController {
  groupByPro(xs, key) {
    return xs.reduce((rv, x) => {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  }

  async ballotEvent(data, from, isUpdate = false) {
    try {
      logInfo('ballotEvent called', { data, from, isUpdate });
      if (isUpdate) {
        const deletedJob = await AgendaJobs.deleteMany({
          'data.ballotId': data._id,
        });

        logInfo('ballotEvent jobs deleted', { deletedJob });
      }

      // notification 2 days before
      const obj = {
        ballotId: data._id,
        type: 'notificationBefore2Days',
      };
      const applicationCloseDate = new Date(data.applicationCloseDateTime);
      // applicationCloseDate.setHours(0, 0, 0, 0);
      const twoDayBeforeDate = moment(applicationCloseDate)
        .add(-2, 'd')
        .toDate();
      const oneDayBeforeDate = moment(applicationCloseDate)
        .add(-1, 'd')
        .toDate();

      // notification 1 day before
      // notification on day
      await agendaNormal.schedule(twoDayBeforeDate, 'eventHandler', obj);

      obj.type = 'notificationBefore1Day';

      await agendaNormal.schedule(oneDayBeforeDate, 'eventHandler', obj);

      obj.type = 'notificationOnDay';
      await agendaNormal.schedule(applicationCloseDate, 'eventHandler', obj);

      obj.type = 'conductBallot';
      const conductTime = moment(applicationCloseDate).add(5, 'm').toDate();

      await agendaNormal.schedule(conductTime, 'eventHandler', obj);

      obj.type = 'publishBallot';
      const publishBallots = moment(data.applicationOpenDateTime).toDate();

      await agendaNormal.schedule(publishBallots, 'eventHandler', obj);

      if (data.resultRelease === 1) {
        obj.type = 'resultRelease';
        const resultRelease = moment(data.resultReleaseDateTime).toDate();

        await agendaNormal.schedule(resultRelease, 'eventHandler', obj);
      }

      return true;
    } catch (e) {
      logError('create cron has error', e.stack);
      logError('create cron has error', e);
      return false;
    }
  }

  async deleteEvent(id) {
    try {
      logInfo('deleteEvent called', { id });
      await AgendaJobs.updateMany(
        { 'data.ballotId': id },
        {
          $set: {
            nextRunAt: null,
            'data.isRemoved': true,
            'data.removedAt': new Date(),
          },
        },
      );

      return true;
    } catch (e) {
      return false;
    }
  }

  // The below commented function is required for local testing we can use it in the future, There is no need to remove this.

  // async conductBallot(req, res) {
  //   try {
  //     const ballotId = '6561c4ab53be2233721ec8fb';
  //     let ballotResult = await Ballot.findOne({
  //       _id: ballotId,
  //     }); // isConduct: false

  //     if (ballotResult) {
  //       // result for BU
  //       let totalDeducated = 5;

  //       if (ballotResult.leaveConfiguration === 2) {
  //         totalDeducated = 6;
  //       } else if (ballotResult.leaveConfiguration === 3) {
  //         totalDeducated = 7;
  //       }

  //       if (ballotResult.leaveType === 2) {
  //         totalDeducated = 1;
  //       }

  //       if (ballotResult.userFrom === 2) {
  //         ballotResult = JSON.stringify(ballotResult);
  //         ballotResult = JSON.parse(ballotResult);
  //         let shuffle1 = [];

  //         shuffle1 = ballotResult.slotCreation;
  //         ballotResult.appliedStaff.forEach((appliedStaff) => {
  //           const indexOfBu = ballotResult.slotCreation.findIndex(
  //             (x) => x.buId === appliedStaff.buId,
  //           );

  //           if (shuffle1[indexOfBu].arr[appliedStaff.weekNo].appliedStaff) {
  //             shuffle1[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(
  //               appliedStaff,
  //             );
  //           } else {
  //             shuffle1[indexOfBu].arr[appliedStaff.weekNo].appliedStaff = [];
  //             shuffle1[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(
  //               appliedStaff,
  //             );
  //           }
  //         });
  //         let finalWinStaff = [];

  //         shuffle1.forEach((staffShuffle) => {
  //           staffShuffle.arr.forEach((slotWise) => {
  //             const howMuchWin = slotWise.value;

  //             if (
  //               slotWise.appliedStaff &&
  //               slotWise.appliedStaff.length <= howMuchWin
  //             ) {
  //               finalWinStaff = finalWinStaff.concat(slotWise.appliedStaff);
  //             } else if (slotWise.appliedStaff) {
  //               const randomStaff = getRandomNumber(
  //                 slotWise.appliedStaff.length,
  //                 howMuchWin,
  //               );

  //               randomStaff.forEach((randomSelectedStaff) => {
  //                 finalWinStaff.push(
  //                   slotWise.appliedStaff[randomSelectedStaff],
  //                 );
  //               });
  //             }
  //           });
  //         });
  //         const updateWin = await Ballot.findOneAndUpdate(
  //           { _id: ballotId },
  //           {
  //             $set: {
  //               wonStaff: finalWinStaff,
  //               isConduct: true,
  //               isResultRelease: false,
  //             },
  //           },
  //         );

  //         insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
  //         unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
  //       } else {
  //         // for ops group
  //         ballotResult = JSON.stringify(ballotResult);
  //         ballotResult = JSON.parse(ballotResult);

  //         const opsGroupQuota = [];

  //         const appliedStaffArray = [];

  //         for (let i = 0; i < ballotResult.slotCreation.length; i += 1) {
  //           const opsGroupSlot = ballotResult.slotCreation[i];
  //           // get quato for ops group
  //           // get quato for team
  //           const slotValue = {
  //             opsGroupId: opsGroupSlot.opsGroup.opsId,
  //             slotQuota: [],
  //           };

  //           opsGroupSlot.arr.forEach((arrItem, arrIndex) => {
  //             const key = `${arrIndex}A`;
  //             const slotNumber = arrIndex;
  //             const slotOpsGroupValue = parseInt(
  //               opsGroupSlot.weekRangeSlot[key].value,
  //               10,
  //             );

  //             const teamValue = [];
  //             let totalTeamQuota = 0;

  //             opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
  //               const key1 = `OG${arrIndex}OT${teamIndex}`;

  //               totalTeamQuota += parseInt(
  //                 opsGroupSlot.weekRangeSlot[key1].value,
  //                 10,
  //               );
  //               teamValue.push(
  //                 parseInt(opsGroupSlot.weekRangeSlot[key1].value, 10),
  //               );
  //             });
  //             const obj = {
  //               slot: slotNumber,
  //               opsGroupQuotaValue: slotOpsGroupValue,
  //               opsTeamQuotaValue: teamValue,
  //               totalTeamQuota,
  //             };

  //             slotValue.slotQuota.push(obj);
  //           });
  //           opsGroupQuota.push(slotValue);
  //           let appliedStaffObject = {};

  //           appliedStaffObject = groupBy(
  //             ballotResult.appliedStaff,
  //             'opsTeamId',
  //           );

  //           const opsGroupSlotWithTeam = {
  //             opsGroupId: opsGroupSlot.opsGroup.opsId,
  //             opsTeamValue: [],
  //           };

  //           if (opsGroupSlot.opsTeam && opsGroupSlot.opsTeam.length > 0) {
  //             opsGroupSlot.opsTeam.forEach((teamItem) => {
  //               if (appliedStaffObject[teamItem._id]) {
  //                 const ayaya = groupBy(
  //                   appliedStaffObject[teamItem._id],
  //                   'weekNo',
  //                 );

  //                 opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
  //               } else {
  //                 opsGroupSlotWithTeam.opsTeamValue.push({});
  //               }
  //             });
  //           } else if (isEmpty(appliedStaffObject)) {
  //             // Object is empty (Would return true in this example)
  //           } else if (appliedStaffObject.undefined) {
  //             // Object is NOT empty

  //             const staffAyaya = appliedStaffObject.undefined.filter(
  //               (sta) =>
  //                 sta.opsGroupId.toString() ===
  //                 opsGroupSlot.opsGroup.opsId.toString(),
  //             );

  //             appliedStaffObject.undefined = [];
  //             appliedStaffObject.undefined = staffAyaya;
  //             const ayaya = groupBy(appliedStaffObject.undefined, 'weekNo');

  //             opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
  //           }

  //           appliedStaffArray.push(opsGroupSlotWithTeam);
  //         }

  //         let finalWinStaff = [];

  //         opsGroupQuota.forEach((item, topIndex) => {
  //           const objA = {
  //             opsGroupId: item.opsGroupId,
  //           };

  //           item.slotQuota.forEach((slll) => {
  //             objA.slot = slll.slot;
  //             if (slll.opsTeamQuotaValue.length === 0) {
  //               objA.isTeamPresent = false;
  //               objA.opsGroupQuotaValue = slll.opsGroupQuotaValue;
  //               if (
  //                 appliedStaffArray[topIndex].opsTeamValue[0] &&
  //                 appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`]
  //               ) {
  //                 if (
  //                   slll.opsGroupQuotaValue >=
  //                   appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`]
  //                     .length
  //                 ) {
  //                   finalWinStaff = finalWinStaff.concat(
  //                     appliedStaffArray[topIndex].opsTeamValue[0][
  //                       `${slll.slot}`
  //                     ],
  //                   );
  //                 } else {
  //                   const randomStaff = getRandomNumber(
  //                     appliedStaffArray[topIndex].opsTeamValue[0][
  //                       `${slll.slot}`
  //                     ].length,
  //                     slll.opsGroupQuotaValue,
  //                   );

  //                   randomStaff.forEach((ppp) => {
  //                     finalWinStaff.push(
  //                       appliedStaffArray[topIndex].opsTeamValue[0][
  //                         `${slll.slot}`
  //                       ][ppp],
  //                     );
  //                   });
  //                 }
  //               }
  //             } else if (slll.opsGroupQuotaValue >= slll.totalTeamQuota) {
  //               // all team quota should win
  //               slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
  //                 if (
  //                   appliedStaffArray[topIndex].opsTeamValue[
  //                     opsTeamQuotaValueIndex
  //                   ] &&
  //                   appliedStaffArray[topIndex].opsTeamValue[
  //                     opsTeamQuotaValueIndex
  //                   ][`${slll.slot}`]
  //                 ) {
  //                   const len =
  //                     appliedStaffArray[topIndex].opsTeamValue[
  //                       opsTeamQuotaValueIndex
  //                     ][`${slll.slot}`].length;

  //                   // p means no of win
  //                   // len means no of applied
  //                   if (len > p) {
  //                     const randomStaff = getRandomNumber(len, p);

  //                     randomStaff.forEach((randomSelectedStaff) => {
  //                       finalWinStaff.push(
  //                         appliedStaffArray[topIndex].opsTeamValue[
  //                           opsTeamQuotaValueIndex
  //                         ][`${slll.slot}`][randomSelectedStaff],
  //                       );
  //                     });
  //                   } else {
  //                     for (let x = 0; x < len; x += 1) {
  //                       finalWinStaff.push(
  //                         appliedStaffArray[topIndex].opsTeamValue[
  //                           opsTeamQuotaValueIndex
  //                         ][`${slll.slot}`][x],
  //                       );
  //                     }
  //                   }
  //                 }
  //               });
  //             } else {
  //               // if ops group quota value is less then total team quota
  //               let allAppliedStaff = [];

  //               slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
  //                 if (
  //                   appliedStaffArray[topIndex].opsTeamValue[
  //                     opsTeamQuotaValueIndex
  //                   ] &&
  //                   appliedStaffArray[topIndex].opsTeamValue[
  //                     opsTeamQuotaValueIndex
  //                   ][`${slll.slot}`]
  //                 ) {
  //                   if (
  //                     p >=
  //                     appliedStaffArray[topIndex].opsTeamValue[
  //                       opsTeamQuotaValueIndex
  //                     ][`${slll.slot}`].length
  //                   ) {
  //                     allAppliedStaff = allAppliedStaff.concat(
  //                       appliedStaffArray[topIndex].opsTeamValue[
  //                         opsTeamQuotaValueIndex
  //                       ][`${slll.slot}`],
  //                     );
  //                   } else {
  //                     const randomStaff = getRandomNumber(
  //                       appliedStaffArray[topIndex].opsTeamValue[
  //                         opsTeamQuotaValueIndex
  //                       ][`${slll.slot}`].length,
  //                       p,
  //                     );

  //                     randomStaff.forEach((ppp) => {
  //                       allAppliedStaff.push(
  //                         appliedStaffArray[topIndex].opsTeamValue[
  //                           opsTeamQuotaValueIndex
  //                         ][`${slll.slot}`][ppp],
  //                       );
  //                     });
  //                   }
  //                 }
  //               });
  //               if (allAppliedStaff.length > 0) {
  //                 const finalAppliedStaff = [];
  //                 const randomStaff = getRandomNumber(
  //                   allAppliedStaff.length,
  //                   allAppliedStaff.length,
  //                 );

  //                 randomStaff.forEach((ppp) => {
  //                   finalAppliedStaff.push(allAppliedStaff[ppp]);
  //                 });
  //                 const finalRandomStaff = getRandomNumber(
  //                   allAppliedStaff.length,
  //                   slll.opsGroupQuotaValue,
  //                 );

  //                 finalRandomStaff.forEach((ppp) => {
  //                   finalWinStaff.push(finalAppliedStaff[ppp]);
  //                 });
  //               }
  //             }
  //           });
  //         });
  //         await Ballot.findOneAndUpdate(
  //           { _id: ballotId },
  //           {
  //             $set: {
  //               wonStaff: finalWinStaff,
  //               isConduct: true,
  //               isResultRelease: false,
  //             },
  //           },
  //         );

  //         return res.json({ finalWinStaff });
  //       }
  //     }

  //     return res.json({ message: 'Ballot NotFound' });
  //   } catch (error) {
  //     return res.json({ message: error });
  //   }
  // }

  async formatData(data) {
    function genrows(groups, groupKey) {
      return _.toPairs(groups).map(([key, data1]) => ({
        [groupKey]: key,
        data1,
      }));
    }

    function gengroups(arr, iteratee, key) {
      const grouped = _.groupBy(arr, iteratee);

      return genrows(grouped, key);
    }

    function grouparray(data2, props) {
      let result = [{ data2 }];

      result = _.flatten(
        props.map((prop, i) => {
          let k11 = '';

          if (i === 0) {
            k11 = 'opsGroupId';
          } else {
            k11 = 'opsTeamId';
          }

          const key = prop.key || k11;
          const iteratee = prop.iteratee || prop;

          return result.map((row) =>
            gengroups(row.data, iteratee, key).map((group) => ({
              ...row,
              [key]: group[key],
              data: group.data,
            })),
          );
        }),
      );

      return _.flatten(result);
    }

    const result = grouparray(data.data, ['opsG', 'opsT']);

    return result;
  }

  async autoResultRelease(req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errorMessage: errors.array() });
    }

    const staffData = req.body.data;
    const { ballotId } = req.body;
    const { userFrom } = req.body;
    const userData = [];

    staffData.forEach((staff) => {
      delete staff.deepClone;
      userData.push(staff);
    });
    if (userFrom === 1) {
      const ballotData = await Ballot.findById({ _id: ballotId });

      const reaminSlot = [];
      let finalWonStaff = [];
      const allBallotId = [];

      allBallotId.push(ballotId);

      if (ballotData) {
        if (ballotData.isConduct) {
          return res.json({ message: 'Already Conduct' });
        }

        let parentBallotWon = [];
        let parentBallotData1;
        let parentBallotData;
        let idd;
        const ballotYear = new Date(ballotData.weekRange[0].end).getFullYear();

        for (let ij = 0; ij < ballotData.ballotRound; ij += 1) {
          if (ij === 0) {
            idd = ballotData.parentBallot;
          } else {
            idd = parentBallotData1.parentBallot;
          }

          allBallotId.push(idd);
          parentBallotData1 = await Ballot.findById({ _id: idd });
          if (ij === 0) {
            parentBallotData = parentBallotData1;
          }

          const parentBallotWon1 = JSON.parse(
            JSON.stringify(parentBallotData1.wonStaff),
          );

          parentBallotWon = parentBallotWon.concat(parentBallotWon1);
        }
        const checkSlot = 5;

        for (let i = 0; i < ballotData.slotCreation.length; i += 1) {
          const slotData = ballotData.slotCreation[i];

          let resultFilter = staffData.filter(
            (opt) => opt.opsG === slotData.opsGroup.opsId,
          );

          if (resultFilter.length > 0) {
            resultFilter = shuffle(resultFilter);
            const oldBallotStaffWon = [];
            const oldBallotWon = await Ballot.find({
              opsGroupId: slotData.opsGroup.opsId,
              isConduct: true,
              _id: { $nin: allBallotId },
            });

            for (
              let oldIndex = 0;
              oldIndex < oldBallotWon.length;
              oldIndex += 1
            ) {
              const oldBallot = oldBallotWon[oldIndex];

              if (
                ballotYear ===
                  new Date(oldBallot.weekRange[0].end).getFullYear() &&
                oldBallot.wonStaff.length > 0
              ) {
                for (
                  let wonSIndex = 0;
                  wonSIndex < oldBallot.wonStaff.length;
                  wonSIndex += 1
                ) {
                  const wonSStaff = oldBallot.wonStaff[wonSIndex];
                  const wonObj = {
                    userId: wonSStaff.userId,
                    startDate: new Date(
                      oldBallot.weekRange[wonSStaff.weekNo].start,
                    ).getTime(),
                    endDate: new Date(
                      oldBallot.weekRange[wonSStaff.weekNo].end,
                    ).getTime(),
                    opsTeamId: wonSStaff.opsTeamId,
                    opsGroupId: wonSStaff.opsGroupId,
                  };

                  oldBallotStaffWon.push(wonObj);
                }
              }
            }
            const wonStaffForOpsGroup = ballotData.wonStaff.filter(
              (win) => win.opsGroupId === slotData.opsGroup.opsId,
            );

            for (let j = 0; j < ballotData.weekRange.length; j += 1) {
              let opsGroupQuota = Math.round(
                parseInt(
                  slotData.weekRangeSlot[`${j}A`].balanceToBeAssigned,
                  10,
                ),
              );
              const wonStaffList = wonStaffForOpsGroup.filter(
                (win) => win.weekNo === j,
              );
              const wonStaffCount = wonStaffList.length;
              let totalTeamQuota = -1;
              let teamStatus = [];

              if (slotData.opsTeam && slotData.opsTeam.length > 0) {
                totalTeamQuota = 0;
                teamStatus = [];
                let data = resultFilter;

                slotData.opsTeam.forEach((te, index) => {
                  const teamQuota = parseInt(
                    slotData.weekRangeSlot[`OG${j}OT${index}`]
                      .balanceToBeAssigned,
                    10,
                  );

                  totalTeamQuota += teamQuota;
                  // get count of staff win this lot for ops team
                  const winStaffOpsTeam = wonStaffList.filter(
                    (ax) => ax.opsTeamId === te._id,
                  );
                  const winStaffOpsTeamUserId = [];

                  winStaffOpsTeam.forEach((wonTeamStaff) => {
                    winStaffOpsTeamUserId.push(wonTeamStaff.userId);
                  });
                  const resultFilterWon = data.filter(
                    (rmWon) => !winStaffOpsTeamUserId.includes(rmWon.userId),
                  );

                  data = resultFilterWon;
                  const o = {
                    teamQuota: teamQuota - winStaffOpsTeam.length,
                    teamWin: winStaffOpsTeam.length,
                    teamId: te._id,
                    teamIndex: index,
                  };

                  teamStatus.push(o);
                });
                resultFilter = data;
                totalTeamQuota = Math.round(totalTeamQuota);
                let takeQuota = -1;

                if (opsGroupQuota < totalTeamQuota) {
                  takeQuota = opsGroupQuota;
                } else {
                  takeQuota = totalTeamQuota;
                }

                const slotRemain = takeQuota - wonStaffCount;

                const obj = {
                  weekNo: j,
                  slotRemain,
                  teamStatus,
                };
                const slotWonStaff = [];

                if (slotRemain > 0) {
                  const minimum = 0;
                  const maximum = resultFilter.length - 1;
                  let howManyTimes = 0;

                  for (let p = 0; p < slotRemain; p += 1) {
                    // get team

                    const randomNumber =
                      Math.floor(Math.random() * (maximum - minimum + 1)) +
                      minimum;

                    const selectedStaff = resultFilter[randomNumber];
                    let selectedStaffTeam = teamStatus.filter(
                      (ts) => ts.teamId === selectedStaff.opsT,
                    );

                    [selectedStaffTeam] = selectedStaffTeam;
                    if (
                      selectedStaff.ballotLeaveBalance > 0 &&
                      selectedStaffTeam.teamQuota > 0
                    ) {
                      const convertedArray = allBallotId.map((item) => {
                        if (typeof item === 'string') {
                          return mongoose.Types.ObjectId(item);
                        }

                        return item;
                      });
                      const leaveAppliedData = await LeaveApplied.find({
                        userId: selectedStaff.userId.toString(),
                        ballotId: { $in: convertedArray },
                      });
                      const isRestirct = await checkStaffRestrict(
                        selectedStaff,
                        parentBallotData,
                        j,
                        finalWonStaff,
                        oldBallotStaffWon,
                        leaveAppliedData,
                      );

                      if (!isRestirct) {
                        if (!slotWonStaff.includes(selectedStaff)) {
                          slotWonStaff.push(selectedStaff);
                          let st;
                          const userData1 = await User.findOne(
                            { _id: selectedStaff.userId },
                            {
                              _id: 0,
                              name: 1,
                              staffId: 1,
                            },
                          );

                          if (!userData1) {
                            st = {
                              userId: selectedStaff.userId,
                              leaveTypeId: selectedStaff.leaveTypeId,
                              leaveGroupId: selectedStaff.leaveGroupId,
                              weekNo: j,
                              buId: selectedStaff.parentBu,
                              opsGroupId: selectedStaff.opsG,
                              opsTeamId: selectedStaff.opsT,
                              isAutoAssign: true,
                            };
                          } else {
                            st = {
                              userId: selectedStaff.userId,
                              weekNo: j,

                              leaveTypeId: selectedStaff.leaveTypeId,
                              leaveGroupId: selectedStaff.leaveGroupId,
                              userData1,
                              buId: selectedStaff.parentBu,
                              opsGroupId: selectedStaff.opsG,
                              opsTeamId: selectedStaff.opsT,
                              isAutoAssign: true,
                            };
                          }

                          finalWonStaff.push(st);
                          resultFilter[randomNumber].ballotLeaveBalance -= 1;
                          teamStatus[
                            selectedStaffTeam.teamIndex
                          ].teamQuota -= 1;

                          howManyTimes = 0;
                        } else if (howManyTimes < checkSlot) {
                          p -= 1;
                          howManyTimes += 1;
                        }
                      } else if (howManyTimes < checkSlot) {
                        p -= 1;
                        howManyTimes += 1;
                      }
                    } else if (howManyTimes < checkSlot) {
                      p -= 1;
                      howManyTimes += 1;
                    }
                  }
                }

                reaminSlot.push(obj);
              } else {
                const slotRemain = opsGroupQuota - wonStaffCount;
                const winStaffOpsTeamUserId = [];

                wonStaffList.forEach((wonTeamStaff) => {
                  winStaffOpsTeamUserId.push(wonTeamStaff.userId);
                });
                const resultFilterWon = resultFilter.filter(
                  (rmWon) => !winStaffOpsTeamUserId.includes(rmWon.userId),
                );

                resultFilter = resultFilterWon;
                const obj = {
                  weekNo: j,
                  slotRemain,
                };

                reaminSlot.push(obj);
                const slotWonStaff = [];

                if (slotRemain > 0) {
                  const minimum = 0;
                  const maximum = resultFilter.length - 1;
                  let howManyTimes = 0;

                  for (let p = 0; p < slotRemain; p += 1) {
                    // get team
                    const randomNumber =
                      Math.floor(Math.random() * (maximum - minimum + 1)) +
                      minimum;

                    const selectedStaff = resultFilter[randomNumber];

                    if (
                      selectedStaff.ballotLeaveBalance > 0 &&
                      opsGroupQuota > 0
                    ) {
                      const convertedArray = allBallotId.map((item) => {
                        if (typeof item === 'string') {
                          return mongoose.Types.ObjectId(item);
                        }

                        return item;
                      });

                      const leaveAppliedData = await LeaveApplied.find({
                        userId: selectedStaff.userId.toString(),
                        ballotId: { $in: convertedArray },
                      });

                      const isRestirct = await checkStaffRestrict(
                        selectedStaff,
                        parentBallotData,
                        j,
                        finalWonStaff,
                        oldBallotStaffWon,
                        leaveAppliedData,
                      );

                      if (!isRestirct) {
                        if (!slotWonStaff.includes(selectedStaff)) {
                          slotWonStaff.push(selectedStaff);
                          const userdata = await User.findOne(
                            { _id: selectedStaff.userId },
                            { _id: 0, name: 1, staffId: 1 },
                          );
                          const st = {
                            userId: selectedStaff.userId,
                            weekNo: j,
                            leaveTypeId: selectedStaff.leaveTypeId,
                            leaveGroupId: selectedStaff.leaveGroupId,
                            buId: selectedStaff.parentBu,
                            opsGroupId: selectedStaff.opsG,
                            opsTeamId: selectedStaff.opsT,
                            isAutoAssign: true,
                            userData: userdata,
                          };

                          finalWonStaff.push(st);
                          resultFilter[randomNumber].ballotLeaveBalance -= 1;

                          opsGroupQuota -= 1;
                          howManyTimes = 0;
                        } else if (howManyTimes < checkSlot) {
                          p -= 1;
                          howManyTimes += 1;
                        }
                      } else if (howManyTimes < checkSlot) {
                        p -= 1;
                        howManyTimes += 1;
                      }
                    } else if (howManyTimes < checkSlot) {
                      p -= 1;
                      howManyTimes += 1;
                    }
                  }
                }
              }
            }
          }
        }
        await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: { wonStaff: [], staffLeave: [] },
          },
        );
        await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: { isConduct: true, isPublish: true },
            $push: {
              wonStaff: { $each: finalWonStaff },
            },
          },
        );

        const reduceLeave = JSON.parse(JSON.stringify(finalWonStaff));

        if (reduceLeave.length > 0) {
          let leave = 5;

          if (ballotData.leaveConfiguration === 2) {
            leave = 6;
          } else if (ballotData.leaveConfiguration === 3) {
            leave = 7;
          }

          if (ballotData.leaveType === 2) {
            leave = 1;
          }

          // genereate leave
          this.insertStaffLeaveForBallotIn(reduceLeave, ballotData, leave);
          reduceLeave.forEach((item) => {
            const leaveTypeData = {
              leaveTypeId: item.leaveTypeId,
            };
            const startDate = ballotData.weekRange[item.weekNo].start;
            const startYear = new Date(startDate).getFullYear();

            this.managePlanLeave(item.userId, -leave, leaveTypeData, startYear);
          });
        }

        finalWonStaff = groupBy(finalWonStaff, 'userId');

        return res.json({
          message: 'Successfully auto assign done',
          success: true,
          finalWonStaff,
        });
      }

      return res.json({ message: 'Ballot Not found', success: false });
    }

    return res.json({ message: 'For BU not Implemented', success: false });
  }

  async insertStaffLeaveForBallotIn(finalWinStaff, ballot, totalDeductable) {
    const finalLeave = [];

    for (let i = 0; i < finalWinStaff.length; i += 1) {
      const staffWon = finalWinStaff[i];
      const { userId } = staffWon;
      const leaveTypeData = await this.checkIsAnnualLeave(
        userId,
        ballot.companyId,
      );

      if (leaveTypeData.status) {
        const slotWon = staffWon.weekNo;
        const slotArr = ballot.weekRange;
        const slotValue = slotArr[slotWon];
        const startDate = moment(slotValue.start); // .format('DD-MM-YYYY');
        const endDate = moment(slotValue.end);
        const diff = endDate.diff(startDate, 'days') + 1;
        const { leaveTypeId } = leaveTypeData.leaveTypeData;
        const { leaveGroupId } = leaveTypeData;
        const parentBussinessUnitId = leaveTypeData.businessUnitId;
        const obj = {
          ballotId: ballot._id,
          userId,
          startDate,
          endDate,
          leaveTypeId,
          leaveGroupId,
          remark: 'Won by Ballot(Auto Assign Conduct)',
          timeZone: ballot.timeZone,
          totalDay: diff,
          totalDeducated: totalDeductable,
          totalRestOff: diff - totalDeductable,
          businessUnitId: parentBussinessUnitId,
          status: 4,
          submittedFrom: 4,
        };

        finalLeave.push(obj);
      }
    }

    await Ballot.findOneAndUpdate(
      { _id: ballot._id },
      { $set: { staffLeave: finalLeave } },
    );
  }

  async getSlot(id) {
    const ballots = await Ballot.find({
      createdBy: id,
      isDeleted: false,
    })
      .populate([
        {
          path: 'staffRestriction.userList.id',
          select: 'name',
        },
        {
          path: 'adminId',
          select: '_id name staffId',
        },
        {
          path: 'opsGroupId',
          model: 'OpsGroup',
          select: '_id opsGroupName',
        },
      ])
      .lean();

    return ballots;
  }

  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      // check required filed
      const requiredResult1 = await __.checkRequiredFields(req, [
        'ballotName',
        'openDate',
        'openTime',
        'closeDate',
        'closeTime',
        'ballotStartDate',
        'ballotEndDate',
        'leaveType',
        'resultRelease',
      ]);

      if (requiredResult1.status === false) {
        return res.json({
          status: false,
          message: 'Please fill the empty fields',
        });
      }

      if (
        !req.body.ballotName.trim() ||
        !req.body.applicationOpenDateTime.trim() ||
        !req.body.applicationCloseDateTime.trim() ||
        !req.body.ballotStartDate.trim() ||
        !req.body.ballotEndDate.trim()
      ) {
        return res.json({
          status: false,
          message: 'Please fill the empty fields',
        });
      }

      req.body.createdBy = req.user._id;
      req.body.companyId = req.user.companyId;
      const data = req.body;

      let parentLeaveTypeIdToOverrideChildsLeaveTypeId;

      if (data.parentBallot) {
        parentLeaveTypeIdToOverrideChildsLeaveTypeId = await Ballot.findById(
          data.parentBallot,
        );
      }

      data.applicationOpenDateTime = `${data.openDate} ${data.openTime}:00 ${data.timeZone}`;
      data.applicationCloseDateTime = `${data.closeDate} ${data.closeTime}:00 ${data.timeZone}`;

      data.applicationOpenDateTime = moment(
        data.applicationOpenDateTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      data.applicationCloseDateTime = moment(
        data.applicationCloseDateTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      data.ballotStartDate = moment(
        data.ballotStartDate,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      data.ballotEndDate = moment(data.ballotEndDate, 'MM-DD-YYYY HH:mm:ss Z')
        .utc()
        .format();
      data.fixedBallotingLeaveType = req.body.fixedBallotingLeaveType;

      if (data.resultRelease === '1') {
        data.resultReleaseDateTime = `${data.resultReleaseDate} ${data.resultReleaseTime}:00 ${data.timeZone}`;
        data.resultReleaseDateTime = moment(
          data.resultReleaseDateTime,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }

      if (data.maxSegment && data.maxSegment !== 0) {
        data.maxSegment.forEach((segment) => {
          segment.startDate = moment.utc(segment.startDate).local().format();
          segment.endDate = moment.utc(segment.endDate).local().format();
        });
      }

      if (data.isAutoAssign) {
        new Ballot(data)
          .save()
          .then((ressss) => {
            let message = 'Ballot successfully created';

            if (data.isDraft) {
              message = 'Ballot saved as a draft';
            } else {
              // notification for publish ballot
            }

            if (data.parentBallot) {
              this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
            }

            return res.json({ status: true, message });
          })
          .catch((err) => res.json({ status: false, message: err }));
      } else {
        if (data.LeaveTYPE) {
          this.createCasual();
        }

        const validationObj = this.validationOfDate(data);

        if (validationObj.status) {
          const isValidSegmentDate = { status: true, message: '' };

          if (isValidSegmentDate.status) {
            if (data.leaveType === 2) {
              data.leaveConfiguration = 4;
            }

            let insertLeaveType;

            if (req.body.fixedBallotingLeaveType || data.parentBallot) {
              let newLeaveName = 'Fixed Balloting Leave Type';
              const found = await LeaveType.find({
                name: { $regex: newLeaveName, $options: 'i' },
                companyId: req.user.companyId,
                isActive: true,
              })
                .sort({ _id: -1 })
                .limit(1);

              if (found && found.length > 0) {
                const nameOfLeave = found[0].name.toString();
                const lastCountInTable = nameOfLeave.split(' ').splice(-1)[0];
                const lastCount = parseInt(lastCountInTable, 10) + 1;

                newLeaveName = `${newLeaveName} ${lastCount}`;
              }

              if (data.parentBallot) {
                // Child
                data.fixedBallotingLeaveType =
                  parentLeaveTypeIdToOverrideChildsLeaveTypeId.fixedBallotingLeaveType;
                data.leaveTypeId =
                  parentLeaveTypeIdToOverrideChildsLeaveTypeId.leaveTypeId;
                data.totalQuota =
                  parentLeaveTypeIdToOverrideChildsLeaveTypeId.totalQuota
                    ? parentLeaveTypeIdToOverrideChildsLeaveTypeId.totalQuota
                    : 0;
              } else {
                // Parent
                const obj = {};

                obj.name = newLeaveName;
                obj.createdBy = req.user._id;
                obj.updatedBy = req.user._id;
                obj.companyId = req.user.companyId;
                insertLeaveType = await new LeaveType(obj).save();
                data.leaveTypeName = insertLeaveType.name;
                data.leaveTypeId = insertLeaveType._id;
                data.totalQuota = req.body.totalQuota ? req.body.totalQuota : 0;

                if (
                  req.body.fixedBallotingLeaveType ||
                  parentLeaveTypeIdToOverrideChildsLeaveTypeId.fixedBallotingLeaveType
                ) {
                  const leaveDtlObj = {};

                  leaveDtlObj.year = new Date(
                    req.body.ballotStartDate,
                  ).getFullYear();
                  leaveDtlObj.leaveTypeId = data.parentBallot
                    ? parentLeaveTypeIdToOverrideChildsLeaveTypeId.leaveTypeId
                    : insertLeaveType._id;
                  leaveDtlObj.quota = req.body.totalQuota
                    ? req.body.totalQuota
                    : 0;
                  leaveDtlObj.planQuota = req.body.totalQuota
                    ? req.body.totalQuota
                    : 0;
                  leaveDtlObj.total = req.body.totalQuota
                    ? req.body.totalQuota
                    : 0;
                  leaveDtlObj.planDymanicQuota = 0;
                  leaveDtlObj.taken = 0;
                  leaveDtlObj.request = 0;

                  await staffLeave.updateMany(
                    {},
                    { $push: { leaveDetails: leaveDtlObj } },
                  );
                }
              }

              if (!data.parentBallot) {
                await LeaveGroup.updateMany(
                  { 'leaveType.leaveTypeId': insertLeaveType._id },
                  {
                    $set: {
                      'leaveType.$.quota': req.body.totalQuota
                        ? req.body.totalQuota
                        : 0,
                    },
                  },
                );
              }
            }

            new Ballot(data)
              .save()
              .then((ressss) => {
                let message = 'Ballot successfully created';

                if (data.isDraft) {
                  message = 'Ballot saved as a draft';
                } else {
                  this.ballotEvent(ressss, 'createBallot', false);
                }

                if (data.parentBallot) {
                  this.checkIfHasParentAndUpdate(
                    req.body.parentBallot,
                    ressss._id,
                  );
                }

                return res.json({ status: true, message });
              })
              .catch((err) => res.json({ status: false, message: err }));
          } else {
            return res.json({
              status: false,
              message: isValidSegmentDate.message,
            });
          }
        } else {
          return res.json({ status: false, message: validationObj.message });
        }
      }

      return null;
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong1', e });
    }
  }

  async createCasual(req, res) {
    try {
      // check required filed
      const requiredResult1 = await __.checkRequiredFields(req, [
        'ballotName',
        'openDate',
        'openTime',
        'closeDate',
        'closeTime',
        'ballotStartDate',
        'ballotEndDate',
        'leaveType',
        'resultRelease',
      ]);

      if (requiredResult1.status === false) {
        return res.json({
          status: false,
          message: 'Please fill the empty fields',
        });
      }

      if (
        !req.body.ballotName.trim() ||
        !req.body.applicationOpenDateTime.trim() ||
        !req.body.applicationCloseDateTime.trim() ||
        !req.body.ballotStartDate.trim() ||
        !req.body.ballotEndDate.trim()
      ) {
        return res.json({
          status: false,
          message: 'Please fill the empty fields',
        });
      }

      req.body.createdBy = req.user._id;
      req.body.companyId = req.user.companyId;
      const data = req.body;

      data.applicationOpenDateTime = `${data.openDate} ${data.openTime}:00 ${data.timeZone}`;
      data.applicationCloseDateTime = `${data.closeDate} ${data.closeTime}:00 ${data.timeZone}`;
      data.applicationOpenDateTime = moment(
        data.applicationOpenDateTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      data.applicationCloseDateTime = moment(
        data.applicationCloseDateTime,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      data.ballotStartDate = moment(
        data.ballotStartDate,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      data.ballotEndDate = moment(data.ballotEndDate, 'MM-DD-YYYY HH:mm:ss Z')
        .utc()
        .format();
      if (data.resultRelease === '1') {
        data.resultReleaseDateTime = `${data.resultReleaseDate} ${data.resultReleaseTime}:00 ${data.timeZone}`;
        data.resultReleaseDateTime = moment(
          data.resultReleaseDateTime,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }

      if (data.isAutoAssign) {
        new Ballot(data)
          .save()
          .then((ressss) => {
            let message = 'Ballot successfully created';

            if (data.isDraft) {
              message = 'Ballot saved as a draft';
            } else {
              this.ballotEvent(ressss, 'createBallot', false);
              // notification for publish ballot
            }

            if (data.parentBallot) {
              this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
            }

            return res.json({ status: true, message });
          })
          .catch((err) => res.json({ status: false, message: err }));
      } else {
        const validationObj = this.validationOfDate(data);

        if (validationObj.status) {
          const isValidSegmentDate = { status: true, message: '' };

          if (isValidSegmentDate.status) {
            new Ballot(data)
              .save()
              .then((ressss) => {
                let message = 'Ballot successfully created';

                if (data.isDraft) {
                  this.ballotEvent(ressss, 'createBallot', false);
                  message = 'Ballot saved as a draft';
                } else {
                  // notification for publish ballot
                }

                if (data.parentBallot) {
                  this.checkIfHasParentAndUpdate(
                    req.body.parentBallot,
                    ressss._id,
                  );
                }

                return res.json({ status: true, message });
              })
              .catch((err) => res.json({ status: false, message: err }));
          } else {
            return res.json({
              status: false,
              message: isValidSegmentDate.message,
            });
          }
        } else {
          return res.json({ status: false, message: validationObj.message });
        }
      }

      return null;
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong1', e });
    }
  }

  validationOfDate(data) {
    if (
      data.applicationOpenDateTime === 'Invalid date' ||
      data.applicationCloseDateTime === 'Invalid date' ||
      data.ballotStartDate === 'Invalid date' ||
      data.resultReleaseDateTime === 'Invalid date' ||
      data.ballotEndDate === 'Invalid date'
    ) {
      return {
        status: false,
        message: 'There are some date are not in valid format',
      };
    }

    if (
      data.resultRelease === 1 &&
      new Date(data.applicationCloseDateTime).getTime() >
        new Date(data.resultReleaseDateTime).getTime()
    ) {
      return {
        status: false,
        message:
          'Result release date should be greater then application close date',
      };
    }

    if (
      data.resultRelease === 1 &&
      new Date(data.ballotStartDate).getTime() <
        new Date(data.resultReleaseDateTime).getTime()
    ) {
      return {
        status: false,
        message: 'Result release date should be less then ballot start date',
      };
    }

    if (
      new Date().getTime() > new Date(data.applicationOpenDateTime).getTime()
    ) {
      return {
        status: false,
        message: 'Application Open Date should be greater then today',
      };
    }

    if (
      new Date(data.applicationCloseDateTime).getTime() <
      new Date(data.applicationOpenDateTime).getTime()
    ) {
      return {
        status: false,
        message: 'Application Open Date should be less then close date',
      };
    }

    if (new Date().getTime() > new Date(data.ballotStartDate).getTime()) {
      return {
        status: false,
        message: 'Ballot Start Date should be greater then today',
      };
    }

    if (
      new Date(data.ballotEndDate).getTime() <
      new Date(data.ballotStartDate).getTime()
    ) {
      return {
        status: false,
        message: 'Ballot Start Date should be less then end date',
      };
    }

    if (
      new Date(data.applicationOpenDateTime).getTime() >
        new Date(data.ballotStartDate).getTime() ||
      new Date(data.applicationOpenDateTime).getTime() >
        new Date(data.ballotEndDate).getTime()
    ) {
      return {
        status: false,
        message:
          'Application Open Date should be less then ballot start date or end Date',
      };
    }

    if (
      new Date(data.applicationCloseDateTime).getTime() >
        new Date(data.ballotStartDate).getTime() ||
      new Date(data.applicationCloseDateTime).getTime() >
        new Date(data.ballotEndDate).getTime()
    ) {
      return {
        status: false,
        message:
          'Application Close Date should be less then ballot start date or end Date',
      };
    }

    return { status: true };
  }

  async checkIfHasParentAndUpdate(ballotid, id) {
    const currentBallot = await Ballot.findOne({ _id: ballotid });

    if (!currentBallot) {
      logInfo('currentBallot Not Found');
    } else if (currentBallot.parentBallot) {
      this.checkIfHasParentAndUpdate(currentBallot.parentBallot, id);
    } else {
      await Ballot.update(
        { _id: currentBallot._id },
        { $push: { childBallots: id } },
      );
    }
  }

  async readBallots(req, res) {
    try {
      const { id } = req.user;

      let page = 1;

      if (req.query.page) {
        page = parseInt(req.query.page, 10);
      }

      const opp = {
        page,
        limit: 10,
        lean: true,
        sort: { createdAt: -1 },
        populate: [
          {
            path: 'staffRestriction.userList.id',
            select: 'name',
          },
          {
            path: 'adminId',
            select: '_id name staffId',
          },
          {
            path: 'leaveTypeId',
            model: 'LeaveType',
            select: '_id name',
          },
          {
            path: 'opsGroupId',
            model: 'OpsGroup',
            select: '_id opsGroupName',
          },
        ],
      };
      const ballots = await Ballot.paginate(
        {
          $or: [
            {
              createdBy: id,
            },
            { adminId: id },
          ],
          companyId: req.user.companyId,
          isDeleted: false,
        },
        opp,
      );
      const data = ballots.docs;

      return res.json({
        status: true,
        data,
        total: ballots.total,
        pages: ballots.pages,
      });
    } catch (e) {
      return res.json({
        status: false,
        data: null,
        message: 'Something went wrong',
      });
    }
  }

  async read(req, res) {
    try {
      const data = await Ballot.find({
        companyId: req.user.companyId,
        isDeleted: false,
      })
        .populate([
          {
            path: 'staffRestriction.userList.id',
            select: 'name',
          },
        ])
        .lean();

      return res.json({ status: true, data });
    } catch (e) {
      return res.json({
        status: false,
        data: null,
        message: 'Something went wrong',
      });
    }
  }

  async readBallotForStaff(req, res) {
    try {
      // get ballot for Ops group
      const opsGroupList = await OpsGroup.findOne(
        { userId: req.user._id, isDelete: false },
        { _id: 1, opsTeamId: 1 },
      );
      const staffOpsTeam = await OpsTeam.findOne({
        userId: req.user._id,
        isDeleted: false,
        opsGroupId: opsGroupList._id,
      });
      let ballotListOps = [];

      ballotListOps = await Ballot.find({
        opsGroupId: opsGroupList._id,
        isPublish: true,
        $expr: { $eq: [{ $year: '$ballotStartDate' }, req.body.year] },
      });
      // get ballot for BU
      const ballotListBu = await Ballot.find({
        businessUnitId: req.user.parentBussinessUnitId,
        isPublish: true,
        $expr: { $eq: [{ $year: '$ballotStartDate' }, req.body.year] },
      });
      const ballotList = ballotListBu.concat(ballotListOps);

      return this.generateBallotDataForStaff(
        ballotList,
        res,
        req,
        opsGroupList,
        staffOpsTeam,
      );
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong',
      });
    }
  }

  async generateBallotDataForStaff(
    ballotList,
    res,
    req,
    opsGroupList,
    opsTeamList,
  ) {
    if (ballotList.length > 0) {
      ballotList = JSON.stringify(ballotList);
      ballotList = JSON.parse(ballotList);
      let userSlot = [];
      let userSlotOps = [];
      let userTierOps = [];

      const promiseData = [];
      const ballotListCall = async (item, i) => {
        let staffStatus = 'No Application';
        const toBeRemove = [];

        item.appliedStaff.forEach((appliedStaff, index) => {
          if (req.user._id.toString() === appliedStaff.userId.toString()) {
            staffStatus = 'Submitted';
            if (item.isResultRelease) {
              appliedStaff.resultStatus = 'Failed';

              if (item.wonStaff && item.wonStaff.length > 0) {
                item.wonStaff.forEach((won) => {
                  if (
                    req.user._id.toString() === won.userId.toString() &&
                    won.weekNo === appliedStaff.weekNo
                  ) {
                    appliedStaff.resultStatus = 'Successful';
                  }
                });
              }
            }
          } else {
            // remove other staff
            toBeRemove.push(index);
          }
        });
        if (item.isResultRelease) {
          if (item.isAutoAssign) {
            if (item.wonStaff && item.wonStaff.length > 0) {
              item.wonStaff.forEach((won) => {
                if (req.user._id.toString() === won.userId.toString()) {
                  won.resultStatus = 'Successful';
                }

                item.appliedStaff.push(won);
              });
            }
          }
        }

        delete item.wonStaff;
        for (let iii = toBeRemove.length - 1; iii >= 0; iii -= 1) {
          item.appliedStaff.splice(toBeRemove[iii], 1);
        }
        // if result release
        let ballotStatus = 'Open';

        if (
          new Date().getTime() >
          new Date(item.applicationCloseDateTime).getTime()
        ) {
          ballotStatus = 'Closed';
        }

        if (item.isResultRelease) {
          ballotStatus = 'Closed';
        }

        if (item.isCanceled) {
          ballotStatus = 'Cancelled';
        }

        ballotList[i].staffStatus = staffStatus;
        ballotList[i].ballotStatus = ballotStatus;
        ballotList[i].monthRange = [];
        ballotList[i].monthRange = JSON.stringify(item.weekRange);
        ballotList[i].monthRange = JSON.parse(ballotList[i].monthRange);

        // week range
        if (ballotList[i].userFrom === 2) {
          userSlot = ballotList[i].slotCreation.filter(
            (bu) =>
              bu.buId.toString() === req.user.parentBussinessUnitId.toString(),
          );
          [userSlot] = userSlot;
        } else {
          let slotRange = ballotList[i].slotCreation.filter(
            (bu) =>
              bu.opsGroup.opsId.toString() === opsGroupList._id.toString(),
          );

          [slotRange] = slotRange;
          userSlotOps = [];
          userTierOps = [];
          if (opsGroupList && opsGroupList.opsTeamId.length > 0) {
            const teamIndex = slotRange.opsTeam.findIndex(
              (tttt) =>
                tttt &&
                tttt._id &&
                tttt._id.toString() === opsTeamList._id.toString(),
            );

            slotRange.arr.forEach((ii, indexArr) => {
              const key = `OG${indexArr}OT${teamIndex}`;
              const key1 = `${indexArr}A`;

              userTierOps.push(slotRange.weekRangeSlot[key1]);
              userSlotOps.push(slotRange.weekRangeSlot[key]);
            });
          } else {
            // no team
            slotRange?.arr.forEach((ii, indexArr) => {
              const key = `${indexArr}A`;

              userSlotOps.push(slotRange.weekRangeSlot[key]);
            });
          }

          delete ballotList[i].slotCreation;
          ballotList[i].slotCreation = [];
          ballotList[i].slotCreation.push(slotRange);
        }

        ballotList[i].monthRange.forEach((dd, index) => {
          dd.month = moment(dd.start).format('MMMM-YY');
          dd.weekNO = index;
          if (ballotList[i].userFrom === 2) {
            if (userSlot) dd.quotaValue = userSlot.arr[index].value;
          } else {
            if (userTierOps.length > 0) {
              dd.tierQuota = userTierOps[index] ? userTierOps[index].value : 0;
            } else {
              dd.tierQuota = userSlotOps[index] ? userSlotOps[index].value : 0;
            }

            dd.quotaValue = userSlotOps[index] ? userSlotOps[index].value : 0;
          }
        });
        ballotList[i].monthRange = groupBy(ballotList[i].monthRange, 'month');
        const MONTH = [];

        await Object.entries(ballotList[i].monthRange).forEach((entry) => {
          const key = entry[0];
          const value = entry[1];
          const objTo = {};

          objTo[key] = value;
          MONTH.push(objTo);
          // use key and value here
        });
        ballotList[i].monthRange = MONTH;
      };

      for (let i = 0; i < ballotList.length; i += 1) {
        promiseData.push(ballotListCall(ballotList[i], i));
      }

      await Promise.all(promiseData);

      // sort by name
      ballotList.sort((a, b) => {
        const nameA = a.ballotName.toUpperCase(); // ignore upper and lowercase
        const nameB = b.ballotName.toUpperCase(); // ignore upper and lowercase

        if (nameA < nameB) {
          return -1;
        }

        if (nameA > nameB) {
          return 1;
        }

        // names must be equal
        return 0;
      });

      return res.status(201).json({
        success: true,
        data: ballotList,
      });
    }

    return res.status(400).json({
      success: false,
      data: [],
      message: 'No Ballot found',
    });
  }

  async readBallotForStaffApplied(req, res) {
    try {
      let opsfilteredOpen = [];
      let opsfilteredClosed = [];
      const ballotList = await Ballot.find(
        {
          $or: [
            { 'appliedStaff.userId': req.user._id },
            { 'wonStaff.userId': req.user._id },
          ],
          isPublish: true,
        },
        { slotCreation: 0 },
      );

      // finding ballots with new requirements saying

      const opsGroupOfUser = await OpsGroup.findOne(
        { userId: req.user._id, isDelete: false },
        { _id: 1, opsTeamId: 1 },
      );

      if (opsGroupOfUser) {
        const ballotListOps = await Ballot.find({
          opsGroupId: opsGroupOfUser._id,
          isPublish: true,
          isDeleted: false,
        });

        if (ballotListOps.length > 0) {
          opsfilteredOpen = ballotListOps.filter(
            (bl) =>
              new Date(bl.applicationCloseDateTime).getTime() >
              new Date().getTime(),
          );
          opsfilteredClosed = ballotListOps.filter(
            (b2) =>
              new Date(b2.applicationCloseDateTime).getTime() <
              new Date().getTime(),
          );
        }
      }

      if (ballotList.length > 0) {
        this.generateBallotDataForStaffApplied(
          ballotList,
          opsfilteredOpen,
          opsfilteredClosed,
          res,
          req,
        );
      } else {
        return res.status(400).json({
          success: false,
          message: 'No Ballot applied',
        });
      }

      return null;
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong',
      });
    }
  }

  async generateBallotDataForStaffApplied(
    ballotList,
    opsfilteredOpen,
    opsfilteredClosed,
    res,
    req,
  ) {
    if (ballotList.length > 0) {
      ballotList = JSON.stringify(ballotList);
      ballotList = JSON.parse(ballotList);
      for (let i = 0; i < ballotList.length; i += 1) {
        const item = ballotList[i];
        let staffStatus = 'No Application';
        const toBeRemove = [];

        item.appliedStaff.forEach((appliedStaff, index) => {
          if (req.user._id.toString() === appliedStaff.userId.toString()) {
            const slotObj = item.weekRange[appliedStaff.weekNo];

            item.appliedStaff[index].slotObj = {};
            item.appliedStaff[index].slotObj = slotObj;
            staffStatus = 'Submitted';
            if (item.isResultRelease) {
              staffStatus = 'Successful';
              appliedStaff.resultStatus = 'Failed';
              item.wonStaff.forEach((won) => {
                if (
                  req.user._id.toString() === won.userId.toString() &&
                  won.weekNo === appliedStaff.weekNo
                ) {
                  staffStatus = 'Successful';
                  appliedStaff.resultStatus = 'Successful';
                }
              });
            }
          } else {
            // remove other staff
            toBeRemove.push(index);
          }
        });
        if (item.isResultRelease) {
          if (item.isAutoAssign) {
            if (item.wonStaff && item.wonStaff.length > 0) {
              item.wonStaff.forEach((won) => {
                const slotObj = item.weekRange[won.weekNo];

                if (req.user._id.toString() === won.userId.toString()) {
                  won.slotObj = {};
                  won.slotObj = slotObj;
                  won.resultStatus = 'Successful';
                }

                item.appliedStaff.push(won);
              });
            }
          }
        }

        delete item.wonStaff;

        for (let iii = toBeRemove.length - 1; iii >= 0; iii -= 1) {
          item.appliedStaff.splice(toBeRemove[iii], 1);
        }
        // if result release
        let ballotStatus = 'Open';

        if (
          new Date().getTime() >
          new Date(item.applicationCloseDateTime).getTime()
        ) {
          ballotStatus = 'Closed';
        }

        if (item.isResultRelease) {
          ballotStatus = 'Closed';
        }

        ballotList[i].staffStatus = staffStatus;
        ballotList[i].ballotStatus = ballotStatus;
      }

      if (opsfilteredOpen.length > 0) {
        for (let i = 0; i <= opsfilteredOpen.length - 1; i += 1) {
          const tempoopenBallot = JSON.stringify(opsfilteredOpen[i]);

          opsfilteredOpen[i] = JSON.parse(tempoopenBallot);
          // if already applied
          if (opsfilteredOpen[i].appliedStaff.length > 0) {
            const toBeRemove1 = [];

            for (
              let a = 0;
              a <= opsfilteredOpen[i].appliedStaff.length - 1;
              a += 1
            ) {
              if (
                req.user._id.toString() ===
                opsfilteredOpen[i].appliedStaff[a].userId.toString()
              ) {
                const slotObj =
                  opsfilteredOpen[i].weekRange[
                    opsfilteredOpen[i].appliedStaff[a].weekNo
                  ];

                opsfilteredOpen[i].appliedStaff[a].slotObj = {};
                opsfilteredOpen[i].appliedStaff[a].slotObj = slotObj;
                opsfilteredOpen[i].appliedStaff[a].staffStatus = 'Submitted';
              } else {
                // remove other staff
                toBeRemove1.push(a);
              }
            }

            for (let iii = toBeRemove1.length - 1; iii >= 0; iii -= 1) {
              opsfilteredOpen[i].appliedStaff.splice(toBeRemove1[iii], 1);
            }
          }

          let winners = [];

          if (opsfilteredClosed.length > 0) {
            for (let j = 0; j <= opsfilteredClosed.length - 1; j += 1) {
              const tempoclosedBallot = JSON.stringify(opsfilteredClosed[j]);

              opsfilteredClosed[j] = JSON.parse(tempoclosedBallot);
              const winss = opsfilteredClosed[j].wonStaff.filter((wn) => {
                const dat = [];

                if (wn.userId.toString() === req.user._id.toString()) {
                  wn.slotObj = {
                    start: opsfilteredClosed[j].weekRange[wn.weekNo].start,
                    end: opsfilteredClosed[j].weekRange[wn.weekNo].end,
                  };
                  wn.resultStatus = 'Successful';
                  return dat.push(wn);
                }

                return false;
              });

              winners = winners.concat(winss);
            }
          }

          if (winners.length > 0) {
            for (let w = 0; w <= winners.length - 1; w += 1) {
              const indexHere = opsfilteredOpen[i].weekRange.findIndex(
                (x) =>
                  x.start === winners[w].slotObj.start &&
                  x.end === winners[w].slotObj.end,
              );

              if (indexHere !== -1) {
                // find and exchange indexes here...
                winners[w].weekNo = indexHere;
                opsfilteredOpen[i].appliedStaff.push(winners[w]);
              }
            }
          }

          const indexOfSameBallot = ballotList.findIndex(
            (x) => x._id.toString() === opsfilteredOpen[i]._id.toString(),
          );

          if (indexOfSameBallot !== -1) {
            ballotList.splice(indexOfSameBallot);
          }
        }

        ballotList = ballotList.concat(opsfilteredOpen);
      }

      return res.status(201).json({
        success: true,
        data: ballotList,
      });
    }

    return res.status(400).json({
      success: false,
      data: [],
      message: 'No Ballot found',
    });
  }

  async staffApplyForSlot(req, res) {
    try {
      const alreadyApplied = await Ballot.findOne({
        _id: req.body.ballotId,
        isPublish: true,
        appliedStaff: {
          $elemMatch: { weekNo: req.body.slotNumber, userId: req.user._id },
        },
      });

      if (!alreadyApplied) {
        let obj = {};
        const checkLeave = await this.checkIsLeavePresent(
          req.user._id,
          req.body.leaveConfiguration,
        );

        if (checkLeave) {
          if (req.body.userFrom === 1) {
            const opsGroupList = await OpsGroup.findOne(
              { userId: req.user._id, isDelete: false },
              {
                _id: 1,
                opsTeamId: 1,
              },
            );
            const opsTeamList = await OpsTeam.findOne(
              { userId: req.user._id, isDeleted: false },
              {
                _id: 1,
                opsGroupId: 1,
              },
            );

            if (
              opsTeamList ||
              (opsGroupList && opsGroupList.opsTeamId.length === 0)
            ) {
              if (opsGroupList.opsTeamId.length === 0) {
                obj = {
                  userId: req.user._id,
                  weekNo: req.body.slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsGroupList._id,
                };
              } else {
                obj = {
                  userId: req.user._id,
                  weekNo: req.body.slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsTeamList.opsGroupId,
                  opsTeamId: opsTeamList._id,
                };
              }
            } else {
              return res.status(400).json({
                success: false,
                message:
                  'You can not apply for slot as your not in any OPS team',
              });
            }
          } else {
            obj = {
              userId: req.user._id,
              weekNo: req.body.slotNumber,
              buId: req.user.parentBussinessUnitId,
            };
          }

          const apply = await Ballot.findOneAndUpdate(
            { _id: req.body.ballotId },
            { $push: { appliedStaff: obj } },
          );
          let leaveDecrease = 5;

          if (apply.leaveConfiguration === 2) {
            leaveDecrease = 6;
          } else if (apply.leaveConfiguration === 3) {
            leaveDecrease = 7;
          }

          const sapData = await StaffSapData.findOneAndUpdate(
            { staff_Id: req.user._id },
            { $inc: { ballotLeaveBalanced: -leaveDecrease } },
          );

          return res.status(201).json({
            success: true,
            message: 'Successfully Applied to slot',
            sapData,
          });
        }

        return res.status(400).json({
          success: false,
          message: 'You do not have leave to apply for slot',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'You are already applied for same slot',
      });
    } catch (e) {
      return res.status(500).json({
        status: false,
        data: null,
        message: 'Something went wrong',
        e,
      });
    }
  }

  async staffApplyForSlotMulti(req, res) {
    const alreadyArr = [];
    const successArr = [];
    const failedArr = [];

    const promiseData = [];
    const slotNumberListCall = async (slotNumber) => {
      const alreadyApplied = await Ballot.findOne({
        _id: req.body.ballotId,
        isPublish: true,
        appliedStaff: {
          $elemMatch: { weekNo: slotNumber, userId: req.user._id },
        },
      });

      if (!alreadyApplied) {
        let obj = {};
        const checkLeave = await this.checkIsLeavePresent(
          req.user._id,
          req.body.leaveConfiguration,
        );

        if (checkLeave) {
          if (req.body.userFrom === 1) {
            const opsGroupList = await OpsGroup.findOne(
              { userId: req.user._id, isDelete: false },
              {
                _id: 1,
                opsTeamId: 1,
              },
            );
            const opsTeamList = await OpsTeam.findOne(
              { userId: req.user._id, isDeleted: false },
              {
                _id: 1,
                opsGroupId: 1,
              },
            );

            if (
              opsTeamList ||
              (opsGroupList && opsGroupList.opsTeamId.length === 0)
            ) {
              if (opsGroupList.opsTeamId.length === 0) {
                obj = {
                  userId: req.user._id,
                  weekNo: slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsGroupList._id,
                };
              } else {
                obj = {
                  userId: req.user._id,
                  weekNo: slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsTeamList.opsGroupId,
                  opsTeamId: opsTeamList._id,
                };
              }
            } else {
              failedArr.push(slotNumber);
            }
          } else {
            obj = {
              userId: req.user._id,
              weekNo: slotNumber,
              buId: req.user.parentBussinessUnitId,
            };
          }

          const apply = await Ballot.findOneAndUpdate(
            { _id: req.body.ballotId },
            { $push: { appliedStaff: obj } },
          );
          let leaveDecrease = 5;

          if (apply.leaveConfiguration === 2) {
            leaveDecrease = 6;
          } else if (apply.leaveConfiguration === 3) {
            leaveDecrease = 7;
          }

          await StaffSapData.findOneAndUpdate(
            { staff_Id: req.user._id },
            { $inc: { ballotLeaveBalanced: -leaveDecrease } },
          );

          successArr.push(slotNumber);
        } else {
          failedArr.push(slotNumber);
        }
      } else {
        alreadyArr.push(slotNumber);
      }
    };

    for (let i = 0; i < req.body.slotNumber.length; i += 1) {
      promiseData.push(slotNumberListCall(req.body.slotNumber[i]));
    }

    await Promise.all(promiseData);
    return res.status(201).json({
      success: true,
      message: 'Successfully Applied to slot',
      successArr,
      alreadyArr,
      failedArr,
    });
  }

  async staffApplyForMultipleSlots(req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errorMessage: errors.array() });
    }

    let isAnnualLeavePresent;
    const data = req.body;
    const failedArr = [];
    const successArr = [];

    const findFixedBallotingLeaveTypeObj = await Ballot.findOne({
      _id: data.ballotId,
      isPublish: true,
    });

    if (
      findFixedBallotingLeaveTypeObj !== null &&
      findFixedBallotingLeaveTypeObj.fixedBallotingLeaveType
    ) {
      isAnnualLeavePresent = await this.checkIsAnnualLeave(
        req.user._id,
        req.user.companyId,
        null,
        true,
        findFixedBallotingLeaveTypeObj.leaveTypeId,
      );
    } else {
      isAnnualLeavePresent = await this.checkIsAnnualLeave(
        req.user._id,
        req.user.companyId,
        null,
        false,
      );
    }

    if (isAnnualLeavePresent.status) {
      const alreadyApplied = await Ballot.findOne({
        _id: data.ballotId,
        isPublish: true,
      });

      if (
        alreadyApplied.isPublish &&
        new Date().getTime() >
          new Date(alreadyApplied.applicationCloseDateTime).getTime()
      ) {
        return res.status(201).json({
          success: false,
          message: 'Balloting Exercise is closed, cannot submit now.',
        });
      }

      const promiseData1 = [];
      const orgNameListCall = async (j) => {
        if (
          req.user._id.toString() ===
          alreadyApplied.appliedStaff[j].userId.toString()
        ) {
          let leaveIncrease = 5;

          if (alreadyApplied.leaveConfiguration === 2) {
            leaveIncrease = 6;
          } else if (alreadyApplied.leaveConfiguration === 3) {
            leaveIncrease = 7;
          } else if (alreadyApplied.leaveConfiguration === 4) {
            leaveIncrease = 1;
          }

          if (alreadyApplied.leaveType === 2) {
            leaveIncrease = 1;
          }

          const startDate =
            alreadyApplied.weekRange[alreadyApplied.appliedStaff[j].weekNo]
              .start;
          const startYear = new Date(startDate).getFullYear();

          await this.managePlanLeave(
            req.user._id,
            leaveIncrease,
            isAnnualLeavePresent.leaveTypeData,
            startYear,
          );
        }
      };

      for (let j = 0; j <= alreadyApplied.appliedStaff.length - 1; j += 1) {
        promiseData1.push(orgNameListCall(j));
      }

      await Promise.all(promiseData1);

      await Ballot.update(
        { _id: data.ballotId, 'appliedStaff.userId': req.user._id },
        { $pull: { appliedStaff: { userId: req.user._id } } },
      );

      const promiseData = [];
      const ballotUpdateCall = async (slotNumber) => {
        let obj = {};

        const startDate = alreadyApplied.weekRange[slotNumber].start;
        const startYear = new Date(startDate).getFullYear();
        const checkLeave = await this.checkIsLeavePresentMultiple(
          req.user._id,
          req.body.leaveConfiguration,
          alreadyApplied.leaveType,
          isAnnualLeavePresent.leaveTypeData,
          startYear,
        );

        if (checkLeave) {
          if (req.body.userFrom === 1) {
            const opsGroupList = await OpsGroup.findOne(
              { userId: req.user._id, isDelete: false },
              {
                _id: 1,
                opsTeamId: 1,
              },
            );
            const opsTeamList = await OpsTeam.findOne(
              { userId: req.user._id, isDeleted: false },
              {
                _id: 1,
                opsGroupId: 1,
              },
            );

            if (
              opsTeamList ||
              (opsGroupList && opsGroupList.opsTeamId.length === 0)
            ) {
              if (opsGroupList.opsTeamId.length === 0) {
                obj = {
                  userId: req.user._id,
                  weekNo: slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsGroupList._id,
                };
              } else {
                obj = {
                  userId: req.user._id,
                  weekNo: slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsTeamList.opsGroupId,
                  opsTeamId: opsTeamList._id,
                };
              }
            } else {
              failedArr.push(slotNumber);
            }
          } else {
            obj = {
              userId: req.user._id,
              weekNo: slotNumber,
              buId: req.user.parentBussinessUnitId,
            };
          }

          const apply = await Ballot.findOneAndUpdate(
            { _id: req.body.ballotId },
            { $push: { appliedStaff: obj } },
          );
          let leaveDecrease = 5;

          if (apply.leaveConfiguration === 2) {
            leaveDecrease = 6;
          } else if (apply.leaveConfiguration === 3) {
            leaveDecrease = 7;
          } else if (apply.leaveConfiguration === 4) {
            leaveDecrease = 1;
          }

          if (apply.leaveType === 2) {
            leaveDecrease = 1;
          }

          await this.managePlanLeave(
            req.user._id,
            -1 * leaveDecrease,
            isAnnualLeavePresent.leaveTypeData,
            startYear,
          );

          successArr.push(slotNumber);
        } else {
          failedArr.push(slotNumber);
        }
      };

      for (let i = 0; i < req.body.slotNumber.length; i += 1) {
        promiseData.push(ballotUpdateCall(req.body.slotNumber[i]));
      }

      await Promise.all(promiseData);

      return res.status(201).json({
        success: true,
        message: 'Successfully Applied.',
        successArr,
        failedArr,
      });
    }

    return res.status(201).json({
      success: false,
      successArr,
      failedArr,
      message: 'You do not have Annual Leave Type assigned',
    });
  }

  async checkIsLeavePresentMultiple(
    userId,
    leave,
    type,
    leaveTypeData,
    startYear = new Date().getFullYear(),
  ) {
    let howMany = 7;

    if (leave === 1) {
      howMany = 5;
    } else if (leave === 2) {
      howMany = 6;
    } else if (leave === 4) {
      howMany = 1;
    }

    if (type === 2) {
      howMany = 1;
    }

    const staffLevaeData = await staffLeave.findOne({
      userId,
      leaveDetails: {
        $elemMatch: { year: startYear, leaveTypeId: leaveTypeData.leaveTypeId },
      },
    });

    if (staffLevaeData) {
      const leaveTypeDataNew = staffLevaeData.leaveDetails.filter(
        (leaves) =>
          leaves.leaveTypeId.toString() ===
            leaveTypeData.leaveTypeId.toString() && leaves.year === startYear,
      )[0];

      return staffLevaeData && howMany <= leaveTypeDataNew.planQuota;
    }

    return false;
  }

  async checkIsLeavePresent(id, leave) {
    let howMany = 7;

    if (leave === 1) {
      howMany = 5;
    } else if (leave === 2) {
      howMany = 6;
    }

    const staffLeaveData = await StaffSapData.findOne({ staff_Id: id });

    return staffLeaveData && howMany <= staffLeaveData.ballotLeaveBalanced;
  }

  async sapDataImport(req, res) {
    const bodyData = await this.getBodyData1(req);

    if (bodyData && bodyData.opsGroupDetails) {
      const userDataArr = bodyData.opsGroupDetails;
      const len = userDataArr.length;
      const finalData = [];
      const failedData = [];
      const successData = [];

      const promiseData = [];
      const opsGroupDetailsCall = async (user) => {
        const obj = {};
        const userData = await User.findOne(
          { staffId: user['Staff ID'].toLowerCase() },
          { leaveGroupId: 1 },
        ).populate([
          {
            path: 'leaveGroupId',
            match: {
              isActive: true,
            },
            select: 'leaveType.leaveTypeId',
            populate: [
              {
                path: 'leaveType.leaveTypeId',
                match: {
                  isActive: true,
                  name: user['Leave Type'],
                },
                select: 'name',
              },
            ],
          },
        ]);

        if (userData) {
          if (userData.leaveGroupId) {
            if (
              userData.leaveGroupId.leaveType &&
              userData.leaveGroupId.leaveType.length > 0
            ) {
              let leaveTypeData = userData.leaveGroupId.leaveType.filter(
                (leave) => leave && leave.leaveTypeId,
              );

              if (leaveTypeData && leaveTypeData.length > 0) {
                [leaveTypeData] = leaveTypeData;
                obj.userId = userData._id;
                obj.leaveGroupId = userData.leaveGroupId._id;
                obj.leaveTypeId = leaveTypeData.leaveTypeId._id;
                obj.quota = parseInt(user.Value, 10);
                obj.year = parseInt(user.Year, 10);
                const staffLeaveData = await staffLeave.findOne({
                  userId: obj.userId,
                });

                if (staffLeaveData) {
                  const index = staffLeaveData.leaveDetails.findIndex(
                    (le) =>
                      le.leaveTypeId.toString() ===
                        obj.leaveTypeId.toString() && le.year === obj.year,
                  );
                  let leaveDetails = {};

                  if (index !== -1) {
                    leaveDetails = staffLeaveData.leaveDetails[index];

                    const inc = obj.quota - leaveDetails.total;

                    staffLeaveData.leaveDetails[index].total = obj.quota;
                    staffLeaveData.leaveDetails[index].request += inc;
                    staffLeaveData.leaveDetails[index].taken += inc;
                    staffLeaveData.leaveDetails[index].planDymanicQuota += inc;
                    staffLeaveData.leaveDetails[index].quota += inc;
                    staffLeaveData.leaveDetails[index].planQuota += inc;
                    await staffLeaveData.save();
                  } else {
                    leaveDetails = {
                      leaveTypeId: obj.leaveTypeId,
                      request: 0,
                      taken: 0,
                      total: obj.quota,
                      planDymanicQuota: obj.quota,
                      planQuota: obj.quota,
                      quota: obj.quota,
                      year: obj.year,
                    };
                    const newArray = staffLeaveData.leaveDetails.concat([
                      leaveDetails,
                    ]);

                    staffLeaveData.leaveDetails = newArray;
                    await staffLeaveData.save();
                  }

                  successData.push(obj);
                } else {
                  user.message = 'Something went wrong';
                  failedData.push(user);
                }
              } else {
                user.message = 'Leave Type not found';
                failedData.push(user);
              }
            } else {
              user.message = 'Leave Group Does not have any leave type';
              failedData.push(user);
            }
          } else {
            user.message = 'Leave Group Not found';
            failedData.push(user);
          }
        } else {
          user.message = 'failed as no staff found for staff Id';
          failedData.push(user);
        }

        finalData.push(userData);
      };

      for (let i = 0; i < len; i += 1) {
        promiseData.push(opsGroupDetailsCall(userDataArr[i]));
      }

      await Promise.all(promiseData);
      const msg =
        failedData.length > 0
          ? 'Some staff Id Failed'
          : 'All Processed Successfully';

      return res.json({
        message: msg,
        success: true,
        failedData,
        successData,
      });
    }

    return res.json({
      success: false,
      message: 'Proper Data not found in file',
    });
  }

  async getBodyData1(req) {
    return new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (err, fields, files) => {
        const pathCSV = files.ff[0].path;

        csv()
          .fromFile(pathCSV)
          .then((jsonObj) => {
            const dataRequiredObj = {
              opsGroupDetails: jsonObj,
            };

            resolve(dataRequiredObj);
          })
          .catch(() => {
            reject(err);
          });
      });
    });
  }

  async sendResponse(data, res) {
    try {
      const dataLength = data.length;

      const promiseData = [];
      const dataLengthListCall = async (item) => {
        if (item) {
          const result = await StaffSapData.findOne({
            staff_Id: item.staff_Id,
          });

          if (!result) {
            await new StaffSapData(item).save();
          } else {
            const increaseLeave =
              result.leavesBalanced + parseInt(item.leavesBalanced, 10);
            const ballotLeaveBalanced =
              result.ballotLeaveBalanced + parseInt(item.leavesBalanced, 10);

            await StaffSapData.findOneAndUpdate(
              { staff_Id: item.staff_Id },
              {
                $set: {
                  leavesAvailed: item.leavesAvailed,
                  leavesBalanced: increaseLeave,
                  leavesEntitled: item.leavesEntitled,
                  ballotLeaveBalanced,
                },
              },
            );
          }
        }
      };

      for (let i = 0; i < dataLength; i += 1) {
        promiseData.push(dataLengthListCall(data[i]));
      }

      await Promise.all(promiseData);

      return res.json({ status: true, message: 'Data Successfully imported' });
    } catch (e) {
      return res.json({
        status: false,
        message: 'Data Not Successfully imported',
        e,
      });
    }
  }

  parseBodyData(req) {
    return new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (fields, files) => {
        const pathCSV = files.ff[0].path;

        csv()
          .fromFile(pathCSV)
          .then((jsonObj) => {
            const dataRequiredObj = {
              staffDetails: jsonObj,
            };

            resolve(dataRequiredObj);
          })
          .catch((err) => {
            reject(err);
          });
      });
    });
  }

  async staffCancelSlot(req, res) {
    try {
      const data = req.body;
      const leaveTypeData = await this.checkIsAnnualLeave(
        req.user._id,
        req.user.companyId,
      );

      if (leaveTypeData.status) {
        const ballotData = await Ballot.findOne({
          _id: data.ballotId,
          'appliedStaff.userId': req.user._id,
          'appliedStaff.weekNo': data.slotNumber,
        });

        if (ballotData) {
          if (
            new Date(ballotData.applicationCloseDateTime).getTime() >
            new Date().getTime()
          ) {
            const pullStaff = await Ballot.update(
              {
                _id: data.ballotId,
                'appliedStaff.userId': req.user._id,
                'appliedStaff.weekNo': data.slotNumber,
              },
              {
                $pull: {
                  appliedStaff: {
                    userId: req.user._id,
                    weekNo: data.slotNumber,
                  },
                },
              },
            );

            await Ballot.update(
              { _id: data.ballotId },
              {
                $push: {
                  deletedStaff: {
                    userId: req.user._id,
                    weekNo: data.slotNumber,
                  },
                },
              },
            );

            if (pullStaff.nModified > 0) {
              let leave = 5;

              if (ballotData.leaveConfiguration === 2) {
                leave = 6;
              } else if (ballotData.leaveConfiguration === 3) {
                leave = 7;
              } else if (ballotData.leaveConfiguration === 4) {
                leave = 1;
              }

              if (ballotData.leaveType === 2) {
                leave = 1;
              }

              const startDate = ballotData.weekRange[data.slotNumber].start;
              const startYear = new Date(startDate).getFullYear();

              await this.managePlanLeave(
                req.user._id,
                leave,
                leaveTypeData.leaveTypeData,
                startYear,
              );
            }

            return res
              .status(201)
              .json({ success: true, message: 'Successfully Canceled' });
          }

          return res.status(400).json({
            success: false,
            message: 'Can not Cancel slot as ballot is closed',
          });
        }

        return res
          .status(400)
          .json({ success: false, message: 'Ballot Not found' });
      }

      return res.status(400).json({
        success: false,
        message: 'Annual Leave Type is not present',
      });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: 'Something went wrong' });
    }
  }

  async annualLeave(req, res) {
    try {
      let { year } = req.body;

      if (!year) {
        year = new Date().getFullYear();
      }

      let leaveTypeData;

      const findFixedBallotingLeaveTypeObj = await Ballot.findOne({
        _id: req.body.ballotId,
        isPublish: true,
      });

      if (
        findFixedBallotingLeaveTypeObj !== null &&
        findFixedBallotingLeaveTypeObj.fixedBallotingLeaveType
      ) {
        leaveTypeData = await this.checkIsAnnualLeave(
          req.user._id,
          req.user.companyId,
          year,
          true,
          findFixedBallotingLeaveTypeObj.leaveTypeId,
        );
      } else {
        leaveTypeData = await this.checkIsAnnualLeave(
          req.user._id,
          req.user.companyId,
          year,
          false,
        );
      }

      if (leaveTypeData.status) {
        const leaveData = leaveTypeData.leaveTypeData;
        const data = {
          leavesBalanced: leaveData.total,
          ballotLeaveBalanced: leaveData.planQuota,
          leavesAvailed: leaveData.total - leaveData.planQuota,
        };

        return res.json({ success: true, data });
      }

      const data = {
        leavesBalanced: 0,
        ballotLeaveBalanced: 0,
        leavesAvailed: 0,
      };

      return res.json({ success: false, data });
    } catch (e) {
      return res.status(400).json({
        success: false,
        data: e,
        message: 'Something went wrong',
      });
    }
  }

  async userList(req, res) {
    try {
      if (req.body.isOpsGroup) {
        if (req.body.opsGroupId && req.body.opsGroupId.length > 0) {
          let opsGroupInfo = await OpsGroup.find({
            _id: { $in: req.body.opsGroupId },
          })
            .select('opsTeamId userId buId opsGroupName')
            .populate([
              {
                path: 'opsTeamId',
                select: 'name userId buId',
              },
              {
                path: 'userId',
                select:
                  '_id parentBussinessUnitId name staffId contactNumber email profilePicture status',
                populate: [
                  {
                    path: 'parentBussinessUnitId',
                    select: 'orgName',
                  },
                ],
              },
            ])
            .lean();

          opsGroupInfo = JSON.stringify(opsGroupInfo);
          opsGroupInfo = JSON.parse(opsGroupInfo);
          const userInfo = [];

          for (let i = 0; i < opsGroupInfo.length; i += 1) {
            const opsItem = opsGroupInfo[i];

            opsItem.opsTeamId.forEach((teamItem) => {
              teamItem.userId.forEach((userItem) => {
                opsItem.userId.forEach((opsGroupUser, index) => {
                  if (opsGroupUser._id === userItem) {
                    opsGroupInfo[i].userId[index].opsTeam = teamItem.name;
                    opsGroupInfo[i].userId[index].opsTeamId1 = teamItem._id;
                  }

                  opsGroupInfo[i].userId[index].opsGroupName =
                    opsGroupInfo[i].opsGroupName;
                  opsGroupInfo[i].userId[index].opsGroupId =
                    opsGroupInfo[i]._id;
                });
              });
            });

            opsItem.userId.forEach((opsGroupUser, index) => {
              opsGroupInfo[i].userId[index].opsGroupName =
                opsGroupInfo[i].opsGroupName;
              opsGroupInfo[i].userId[index].opsGroupId = opsGroupInfo[i]._id;
              if (opsGroupInfo[i].userId[index].status !== 2) {
                userInfo.push(opsGroupInfo[i].userId[index]);
              }
            });
          }
          return res.status(201).json({
            success: true,
            data: userInfo,
          });
        }

        return res.status(400).json({
          success: false,
          message: 'Please send Ops Group Id',
        });
      }

      if (req.body.buId && req.body.buId.length > 0) {
        let userInfo = await User.find({
          parentBussinessUnitId: { $in: req.body.buId },
          status: 1,
        })
          .select(
            '_id parentBussinessUnitId name staffId email contactNumber profilePicture',
          )
          .populate([
            {
              path: 'parentBussinessUnitId',
              select: 'orgName',
            },
          ])
          .lean();

        userInfo = JSON.parse(JSON.stringify(userInfo));

        const promiseData = [];
        const userInfoListCall = async (uid, i) => {
          const opsGroupInfo = await OpsGroup.findOne({
            userId: uid,
            isDelete: false,
          })
            .select('opsGroupName opsTeamId')
            .populate([
              {
                path: 'opsTeamId',
                select: 'name userId',
              },
            ]);

          userInfo[i].opsGroupName = opsGroupInfo
            ? opsGroupInfo.opsGroupName
            : '';
          opsGroupInfo?.opsTeamId.forEach((element) => {
            if (element.userId.includes(uid)) {
              userInfo[i].opsTeam = element.name;
            }
          });
        };

        for (let i = 0; i < userInfo.length; i += 1) {
          promiseData.push(userInfoListCall(userInfo[i]._id, i));
        }

        await Promise.all(promiseData);
        return res.status(201).json({
          success: true,
          data: userInfo,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Please send BUId',
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong',
      });
    }
  }

  async delete(req, res) {
    try {
      if (req.body.isDeleted) {
        await Ballot.update(
          { _id: req.body.id },
          { companyId: req.user.companyId, isDeleted: true },
        );

        this.deleteEvent(req.body.id);
        return res.json({
          success: true,
          message: 'Ballot deleted successfully',
        });
      }

      await Ballot.update(
        { _id: req.body.id },
        { companyId: req.user.companyId, isCanceled: true },
      );

      this.deleteEvent(req.body.id);
      return res.json({
        success: true,
        message: 'Ballot canceled successfully',
      });
    } catch (e) {
      return res.json({ success: false, message: 'Something went wrong' });
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const { id } = req.body;

      delete req.body.id;
      if (req.body.leaveType === 2) {
        req.body.leaveConfiguration = 4;
      }

      const data = await Ballot.findOneAndUpdate({ _id: id }, req.body);

      if (!data.isDraft) {
        this.ballotEvent(data, 'update', true);
      }

      sendBallotEditNotification(data);
      return res.json({
        success: true,
        message: 'Ballot Updated successfully',
      });
    } catch (e) {
      return res.json({ success: false, message: 'Something went wrong' });
    }
  }

  async updateCasual(req, res) {
    try {
      const { id } = req.body;

      delete req.body.id;
      const data = await Ballot.findOneAndUpdate({ _id: id }, req.body);

      if (!data.isDraft) {
        this.ballotEvent(data, 'update', true);
      }

      sendBallotEditNotification(data);
      return res.json({
        success: true,
        message: 'Ballot Updated successfully',
      });
    } catch (e) {
      return res.json({ success: false, message: 'Something went wrong' });
    }
  }

  async getballotAdmins(req, res) {
    try {
      const planBuObj = await User.findOne(
        { _id: req.user._id },
        {
          planBussinessUnitId: 1,
          _id: 0,
        },
      ).populate([
        {
          path: 'planBussinessUnitId',
          select: '_id',
          match: {
            status: 1,
          },
        },
      ]);
      const plabBuArr = [];

      planBuObj.planBussinessUnitId.forEach((item) => {
        plabBuArr.push(item._id);
      });
      if (plabBuArr && plabBuArr.length > 0) {
        const adminList = await User.find(
          { parentBussinessUnitId: { $in: plabBuArr }, status: 1 },
          {
            name: 1,
            status: 1,
          },
        );

        return res.json({ status: true, data: adminList });
      }

      return res.json({ status: false, data: 'no admin found' });
    } catch (e) {
      return res.json({
        status: false,
        data: null,
        message: 'Something went wrong',
        e,
      });
    }
  }

  async leaveBallotSetting(req, res) {
    try {
      const pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select('opsGroup')
        .lean();

      return __.out(res, 201, pageSettingData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async winBallotForStaff(req, res) {
    try {
      const ballotId = req.params.id;
      let ballotResult = await Ballot.findOne({
        _id: ballotId,
        isPublish: true,
      });

      if (ballotResult) {
        // result for BU
        let totalDeducated = 5;

        if (ballotResult.leaveConfiguration === 2) {
          totalDeducated = 6;
        } else if (ballotResult.leaveConfiguration === 3) {
          totalDeducated = 7;
        }

        if (ballotResult.leaveType === 2) {
          totalDeducated = 1;
        }

        let shuffle1 = [];

        if (ballotResult.userFrom === 2) {
          ballotResult = JSON.stringify(ballotResult);
          ballotResult = JSON.parse(ballotResult);

          shuffle1 = ballotResult.slotCreation;
          ballotResult.appliedStaff.forEach((appliedStaff) => {
            const indexOfBu = ballotResult.slotCreation.findIndex(
              (x) => x.buId === appliedStaff.buId,
            );

            if (shuffle1[indexOfBu].arr[appliedStaff.weekNo].appliedStaff) {
              shuffle1[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(
                appliedStaff,
              );
            } else {
              shuffle1[indexOfBu].arr[appliedStaff.weekNo].appliedStaff = [];
              shuffle1[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(
                appliedStaff,
              );
            }
          });
          let finalWinStaff = [];

          shuffle1.forEach((staffShuffle) => {
            staffShuffle.arr.forEach((slotWise) => {
              const howMuchWin = slotWise.value;

              if (
                slotWise.appliedStaff &&
                slotWise.appliedStaff.length <= howMuchWin
              ) {
                finalWinStaff = finalWinStaff.concat(slotWise.appliedStaff);
              } else if (slotWise.appliedStaff) {
                const randomStaff = this.getRandomNumber(
                  slotWise.appliedStaff.length,
                  howMuchWin,
                );

                randomStaff.forEach((randomSelectedStaff) => {
                  finalWinStaff.push(
                    slotWise.appliedStaff[randomSelectedStaff],
                  );
                });
              }
            });
          });
          const updateWin = await Ballot.findOneAndUpdate(
            { _id: ballotId },
            {
              $set: {
                wonStaff: finalWinStaff,
                isResultRelease: true,
              },
            },
          );

          this.insertStaffLeaveForBallot(
            finalWinStaff,
            updateWin,
            totalDeducated,
          );
          this.unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
          return res.status(200).json({
            success: true,
            message: 'Result release successfully',
            finalWinStaff,
          });
        }

        // for ops group
        ballotResult = JSON.stringify(ballotResult);
        ballotResult = JSON.parse(ballotResult);

        const opsGroupQuota = [];

        shuffle1 = ballotResult.slotCreation;
        const appliedStaffArray = [];

        for (let i = 0; i < ballotResult.slotCreation.length; i += 1) {
          const opsGroupSlot = ballotResult.slotCreation[i];
          // get quato for ops group
          // get quato for team
          const slotValue = {
            opsGroupId: opsGroupSlot.opsGroup.opsId,
            slotQuota: [],
          };

          opsGroupSlot.arr.forEach((arrItem, arrIndex) => {
            const key = `${arrIndex}A`;
            const slotNumber = arrIndex;
            const slotOpsGroupValue = parseInt(
              opsGroupSlot.weekRangeSlot[key].value,
              10,
            );
            const teamValue = [];
            let totalTeamQuota = 0;

            opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
              const key1 = `OG${arrIndex}OT${teamIndex}`;

              totalTeamQuota += parseInt(
                opsGroupSlot.weekRangeSlot[key1].value,
                10,
              );
              teamValue.push(
                parseInt(opsGroupSlot.weekRangeSlot[key1].value, 10),
              );
            });
            const obj = {
              slot: slotNumber,
              opsGroupQuotaValue: slotOpsGroupValue,
              opsTeamQuotaValue: teamValue,
              totalTeamQuota,
            };

            slotValue.slotQuota.push(obj);
          });
          opsGroupQuota.push(slotValue);
          let appliedStaffObject = {};

          appliedStaffObject = groupBy(ballotResult.appliedStaff, 'opsTeamId');

          const opsGroupSlotWithTeam = {
            opsGroupId: opsGroupSlot.opsGroup.opsId,
            opsTeamValue: [],
          };

          if (opsGroupSlot.opsTeam && opsGroupSlot.opsTeam.length > 0) {
            opsGroupSlot.opsTeam.forEach((teamItem) => {
              if (appliedStaffObject[teamItem._id]) {
                const ayaya = groupBy(
                  appliedStaffObject[teamItem._id],
                  'weekNo',
                );

                opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
              } else {
                opsGroupSlotWithTeam.opsTeamValue.push({});
              }
            });
          } else {
            const ayaya = groupBy(appliedStaffObject.undefined, 'weekNo');

            opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
          }

          appliedStaffArray.push(opsGroupSlotWithTeam);
        }

        let finalWinStaff = [];

        opsGroupQuota.forEach((item, topIndex) => {
          const objA = {
            opsGroupId: item.opsGroupId,
          };

          item.slotQuota.forEach((slll) => {
            objA.slot = slll.slot;
            if (slll.opsTeamQuotaValue.length === 0) {
              objA.isTeamPresent = false;
              objA.opsGroupQuotaValue = slll.opsGroupQuotaValue;
              if (
                appliedStaffArray[topIndex].opsTeamValue[0] &&
                appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`]
              ) {
                if (
                  slll.opsGroupQuotaValue >=
                  appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`]
                    .length
                ) {
                  finalWinStaff = finalWinStaff.concat(
                    appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`],
                  );
                } else {
                  const randomStaff = this.getRandomNumber(
                    appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`]
                      .length,
                    slll.opsGroupQuotaValue,
                  );

                  randomStaff.forEach((ppp) => {
                    finalWinStaff.push(
                      appliedStaffArray[topIndex].opsTeamValue[0][
                        `${slll.slot}`
                      ][ppp],
                    );
                  });
                }
              }
            } else if (slll.opsGroupQuotaValue >= slll.totalTeamQuota) {
              // all team quota should win
              slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                if (
                  appliedStaffArray[topIndex].opsTeamValue[
                    opsTeamQuotaValueIndex
                  ] &&
                  appliedStaffArray[topIndex].opsTeamValue[
                    opsTeamQuotaValueIndex
                  ][`${slll.slot}`]
                ) {
                  const len =
                    appliedStaffArray[topIndex].opsTeamValue[
                      opsTeamQuotaValueIndex
                    ][`${slll.slot}`].length;

                  // p means no of win
                  // len means no of applied
                  if (len > p) {
                    const randomStaff = this.getRandomNumber(len, p);

                    randomStaff.forEach((randomSelectedStaff) => {
                      finalWinStaff.push(
                        appliedStaffArray[topIndex].opsTeamValue[
                          opsTeamQuotaValueIndex
                        ][`${slll.slot}`][randomSelectedStaff],
                      );
                    });
                  } else {
                    for (let x = 0; x < len; x += 1) {
                      finalWinStaff.push(
                        appliedStaffArray[topIndex].opsTeamValue[
                          opsTeamQuotaValueIndex
                        ][`${slll.slot}`][x],
                      );
                    }
                  }
                }
              });
            } else {
              // if ops group quota value is less then total team quota
              let allAppliedStaff = [];

              slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                if (
                  appliedStaffArray[topIndex].opsTeamValue[
                    opsTeamQuotaValueIndex
                  ] &&
                  appliedStaffArray[topIndex].opsTeamValue[
                    opsTeamQuotaValueIndex
                  ][`${slll.slot}`]
                ) {
                  if (
                    p >=
                    appliedStaffArray[topIndex].opsTeamValue[
                      opsTeamQuotaValueIndex
                    ][`${slll.slot}`].length
                  ) {
                    allAppliedStaff = allAppliedStaff.concat(
                      appliedStaffArray[topIndex].opsTeamValue[
                        opsTeamQuotaValueIndex
                      ][`${slll.slot}`],
                    );
                  } else {
                    const randomStaff = this.getRandomNumber(
                      appliedStaffArray[topIndex].opsTeamValue[
                        opsTeamQuotaValueIndex
                      ][`${slll.slot}`].length,
                      p,
                    );

                    randomStaff.forEach((ppp) => {
                      allAppliedStaff.push(
                        appliedStaffArray[topIndex].opsTeamValue[
                          opsTeamQuotaValueIndex
                        ][`${slll.slot}`][ppp],
                      );
                    });
                  }
                }
              });
              if (allAppliedStaff.length > 0) {
                const finalAppliedStaff = [];
                const randomStaff = this.getRandomNumber(
                  allAppliedStaff.length,
                  allAppliedStaff.length,
                );

                randomStaff.forEach((ppp) => {
                  finalAppliedStaff.push(allAppliedStaff[ppp]);
                });
                const finalRandomStaff = this.getRandomNumber(
                  allAppliedStaff.length,
                  slll.opsGroupQuotaValue,
                );

                finalRandomStaff.forEach((ppp) => {
                  finalWinStaff.push(finalAppliedStaff[ppp]);
                });
              }
            }
          });
        });

        const updateWin = await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: {
              wonStaff: finalWinStaff,
              isResultRelease: true,
            },
          },
        );

        this.insertStaffLeaveForBallot(
          finalWinStaff,
          updateWin,
          totalDeducated,
        );
        this.unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
        return res.status(200).json({
          success: true,
          message: 'Result release successfully',
          finalWinStaff,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Ballot not found',
      });
    } catch (e) {
      return res.status(500).json({
        status: false,
        data: null,
        message: 'Something went wrong',
        e,
      });
    }
  }

  async readRestrictionForStaffForBallot(req, res) {
    const { id } = req.params;
    const ballot = await Ballot.findOne({ _id: id });
    const startYearA = new Date(ballot.ballotStartDate).getFullYear();
    const levaeTypeData = await this.checkIsAnnualLeave(
      req.user._id,
      req.user.companyId,
      startYearA,
    );
    let ballotLeaveBalanced = 0;

    if (levaeTypeData.status) {
      ballotLeaveBalanced = levaeTypeData.leaveTypeData.planQuota;
    } else {
      return res
        .status(200)
        .json({ success: false, data: {}, message: 'falied No Quota Found' });
    }

    let leaveConfiguration = 5;

    if (ballot.leaveConfiguration === 2) {
      leaveConfiguration = 6;
    } else if (ballot.leaveConfiguration === 3) {
      leaveConfiguration = 7;
    }

    if (ballot.leaveType === 2) {
      leaveConfiguration = 1;
    }

    const howManySlotStaffCanApplied = Math.floor(
      ballotLeaveBalanced / leaveConfiguration,
    );

    if (ballot.isRestrict) {
      const staffRestriction = [];

      ballot.staffRestriction.forEach((item) => {
        let isPresent = false;
        let staffRestrictionObj = {};

        isPresent = item.userList.some((user) => {
          if (user.id.toString() === req.user._id.toString()) {
            staffRestrictionObj = {
              slot: item.slot,
              startDate: item.startDate,
              endDate:
                ballot.leaveType === 1
                  ? new Date(
                      new Date(item.startDate).setDate(
                        new Date(item.startDate).getDate() + 6,
                      ),
                    )
                  : item.startDate,
            };
            return true;
          }

          return false;
        });
        if (isPresent) {
          let slot = this.getWeekIndex(
            item.startDate,
            ballot.weekRange,
            'start',
            ballot.leaveType,
          );

          slot = -1;
          if (slot === -1) {
            const slotStr = item.slot.split(' ')[0].substring(6);

            slot = parseInt(slotStr, 10) - 1;
          }

          staffRestrictionObj.slotNo = slot;
          staffRestriction.push(staffRestrictionObj);
        }
      });
      const segmentRestriction = [];

      ballot.maxSegment.forEach((item) => {
        const startSlot = this.getWeekIndex(
          item.startDate,
          ballot.weekRange,
          'start',
          ballot.leaveType,
        );
        const endSlot = this.getWeekIndex(
          item.endDate,
          ballot.weekRange,
          'end',
          ballot.leaveType,
        );
        const slotRange = [];

        for (let i = startSlot; i <= endSlot; i += 1) {
          slotRange.push(i);
        }
        const segmentRestrictionObj = {
          startSlot,
          endSlot,
          slotRange,
          maxBallot: item.maxBallot,
        };

        segmentRestriction.push(segmentRestrictionObj);
      });
      const resTo = {
        segmentRestriction,
        leaveConfiguration,
        howManySlotStaffCanApplied,
        isRestrict: ballot.isRestrict,
        ballotLeaveBalanced,
        staffRestriction,
      };

      return res.status(201).json({
        success: true,
        data: resTo,
        message: 'Successfull',
      });
    }

    const resTo = {
      howManySlotStaffCanApplied,
      isRestrict: ballot.isRestrict,
      ballotLeaveBalanced,
    };

    return res
      .status(200)
      .json({ success: true, data: resTo, message: 'successful' });
  }

  getWeekIndex(date, weekRange, from, leaveTypes = 1) {
    if (leaveTypes === 1) {
      if (from === 'end') {
        const weekDay = new Date(date).getDay();

        if (weekDay !== 0) {
          date = new Date(date);
          date.setDate(new Date(date).getDate() + 7 - weekDay);
        }
      } else {
        const weekDay = new Date(date).getDay();

        if (weekDay !== 1) {
          date = new Date(date);
          date.setDate(new Date(date).getDate() + 1 - weekDay);
        }
      }

      const yeterday = new Date(date);

      yeterday.setDate(new Date(date).getDate() - 1);

      const currentDate = moment(date).format('YYYY-MM-DD');
      const tomorrow = new Date(date);

      tomorrow.setDate(new Date(date).getDate() + 1);

      let slot = -1;

      if (from === 'start') {
        for (let i = 0; i < weekRange.length; i += 1) {
          const item = weekRange[i];

          if (
            new Date(item.start).getTime() === new Date(currentDate).getTime()
          ) {
            slot = i;
            break;
          }
        }
      } else {
        for (let i = 0; i < weekRange.length; i += 1) {
          const item = weekRange[i];

          if (
            new Date(item.end).getTime() === new Date(currentDate).getTime()
          ) {
            slot = i;
            break;
          }
        }
      }

      return slot;
    }

    // date, weekRange
    const currentDate = moment(date).format('YYYY-MM-DD');
    let slot = -1;

    if (from === 'start') {
      for (let i = 0; i < weekRange.length; i += 1) {
        const item = weekRange[i];

        if (
          new Date(item.start).getTime() === new Date(currentDate).getTime()
        ) {
          slot = i;
          break;
        }
      }
    } else {
      for (let i = 0; i < weekRange.length; i += 1) {
        const item = weekRange[i];

        if (new Date(item.end).getTime() === new Date(currentDate).getTime()) {
          slot = i;
          break;
        }
      }
    }

    return slot;
  }

  async extendBallot(req, res) {
    const { id } = req.params;
    const data = req.body;
    const ballot = await Ballot.findOne({ _id: id });

    if (!ballot) {
      return res
        .status(500)
        .json({ success: false, message: 'Requested ballot not found' });
    }

    data.applicationCloseDateTime = `${data.applicationCloseDate} ${data.applicationCloseTime}:00 ${data.timeZone}`;

    data.applicationCloseDateTime = moment(
      data.applicationCloseDateTime,
      'MM-DD-YYYY HH:mm:ss Z',
    )
      .utc()
      .format();

    const oldClosingDate = ballot.applicationCloseDateTime;
    const date = data.applicationCloseDateTime;

    data.resultReleaseDateTime = `${data.resultReleaseDate} ${data.resultReleaseTime}:00 ${data.timeZone}`;

    data.resultReleaseDateTime = moment(
      data.resultReleaseDateTime,
      'MM-DD-YYYY HH:mm:ss Z',
    )
      .utc()
      .format();

    const date1 = data.resultReleaseDateTime;
    const validationObj = this.validatieEndBallotDate(date);

    if (validationObj.status) {
      const updates = await Ballot.update(
        { _id: id },
        {
          $set: {
            applicationCloseDateTime: date,
            resultReleaseDateTime: date1,
            closeDate: data.applicationCloseDate,
            closeTime: data.applicationCloseTime,
          },
          $push: { ballotExtendLogs: oldClosingDate },
        },
      );
      const ballotInfo = await Ballot.findOne({ _id: id }).lean();

      await this.ballotEvent(ballotInfo, 'update', true);
      ballotExtendNotifications(ballot);
      return res.status(201).json({
        status: true,
        message: 'Ballot extended successfully',
        data: updates,
      });
    }

    return res.json({
      status: false,
      message: 'There are some date are not in valid format',
    });
  }

  validatieEndBallotDate(data) {
    if (data === 'Invalid date') {
      return {
        status: false,
        message: 'There are some date are not in valid format',
      };
    }

    return { status: true };
  }

  async cancelBallot(req, res) {
    const { id } = req.params;
    const ballotData = await Ballot.findOne({ _id: id });
    let leave = 5;

    if (ballotData.leaveConfiguration === 2) {
      leave = 6;
    } else if (ballotData.leaveConfiguration === 3) {
      leave = 7;
    }

    const appliedStaff = groupBy(ballotData.appliedStaff, 'userId');
    const wonStaff = groupBy(ballotData.wonStaff, 'userId');
    const updateLeaveBy = [];

    for (const key of Object.keys(appliedStaff)) {
      const obj = {
        userId: key,
        value: 0,
      };
      const staffAppliedCount = appliedStaff[key].length;
      let staffWonCount = 0;

      if (wonStaff[key]) {
        staffWonCount = wonStaff[key].length;
      }

      obj.value = (staffAppliedCount - staffWonCount) * leave;
      updateLeaveBy.push(obj);
    }

    const promiseData = [];
    const updateLeaveByListCall = async (user) => {
      if (user.value > 0) {
        const staffLeavedata = await StaffSapData.findOne({
          staff_Id: user.userId,
        });

        if (staffLeavedata) {
          let totalLeave = staffLeavedata.ballotLeaveBalanced + user.value;

          if (totalLeave > staffLeavedata.leavesBalanced) {
            totalLeave = staffLeavedata.leavesBalanced;
          }

          await StaffSapData.update(
            { staff_Id: user.userId },
            { $set: { ballotLeaveBalanced: totalLeave } },
          );
        }
      }
    };

    for (let i = 0; i < updateLeaveBy.length; i += 1) {
      promiseData.push(updateLeaveByListCall(updateLeaveBy[i]));
    }

    await Promise.all(promiseData);

    await Ballot.update({ _id: id }, { isCanceled: true });

    ballotCancelledNotifications(ballotData);
    return res
      .status(201)
      .json({ status: true, message: 'Ballot Cancelled successfully.' });
  }

  async reBallot(req, res) {
    const { id } = req.params;
    const ballot = await Ballot.findOne({ _id: id }).populate([
      {
        path: 'adminId',
        select: '_id name staffId',
      },
      { path: 'opsGroupId', model: 'OpsGroup', select: '_id opsGroupName' },
    ]);

    if (!ballot) {
      return res
        .status(500)
        .json({ success: false, message: 'Requested ballot not found' });
    }

    let newballot = JSON.stringify(ballot);

    newballot = JSON.parse(newballot);
    newballot.parentBallot = ballot._id;
    newballot.applicationOpenDateTime = '';
    newballot.applicationCloseDateTime = '';

    newballot.ballotStartDate = moment(newballot.ballotStartDate).format(
      'MM-DD-YYYY',
    );
    newballot.ballotEndDate = moment(newballot.ballotEndDate).format(
      'MM-DD-YYYY',
    );

    newballot.resultReleaseDateTime = moment(newballot.applicationOpenDateTime)
      .add(15, 'd')
      .toDate();

    // start with remainng quotas
    const slots = ballot.slotCreation;

    if (newballot.userFrom === 2) {
      // FOr BU's
      for (let i = 0; i <= slots.length - 1; i += 1) {
        for (let j = 0; j <= slots[i].arr.length - 1; j += 1) {
          const found = ballot.wonStaff.filter(
            (element) =>
              element.buId.toString() === slots[i].buId.toString() &&
              element.weekNo === j,
          );

          slots[i].arr[j].value -= found.length;
        }
      }
    } else {
      // For Ops groups

      for (let i = 0; i <= slots.length - 1; i += 1) {
        const opsGrpid = slots[i].opsGroup.opsId;

        for (let j = 0; j <= slots[i].arr.length - 1; j += 1) {
          const currentweek = `${j}A`;
          const found = ballot.wonStaff.filter(
            (element) =>
              element.opsGroupId.toString() === opsGrpid.toString() &&
              element.weekNo === j,
          );

          slots[i].weekRangeSlot[currentweek].value -= found.length;
          if (slots[i].opsTeam.length > 0) {
            slots[i].opsTeam.forEach((team, d) => {
              const currentweek1 = `OG${j}OT${d.toString()}`;
              const found1 = ballot.wonStaff.filter((element) => {
                if (element.opsTeamId) {
                  return (
                    element.opsTeamId.toString() === team._id.toString() &&
                    element.weekNo === j
                  );
                }

                return (
                  element.opsGroupId === opsGrpid &&
                  !element.opsTeamId &&
                  element.weekNO === j
                );
              });

              slots[i].weekRangeSlot[currentweek1].value -= found1.length;
            });
          }
        }
      }
    }

    newballot.slotCreation = slots;
    newballot.appliedStaff = [];
    newballot.wonStaff = [];
    newballot.isPublish = false;
    newballot.isDraft = false;
    newballot.isResultRelease = false;

    return res
      .status(201)
      .json({ status: true, data: newballot, message: 'Received data.' });
  }

  async getBallotAppliedUsersList(req, res) {
    try {
      let ballot = await Ballot.findById({ _id: req.params.id }).populate([
        { path: 'appliedStaff.userId', select: '_id name' },
        { path: 'wonStaff.userId', select: '_id name' },
      ]);
      const { weekRange } = ballot;

      weekRange.map((week) => {
        week.appliedUser = [];
        week.wonUser = [];
        return week;
      });
      ballot = JSON.stringify(ballot);
      ballot = JSON.parse(ballot);
      if (ballot) {
        if (ballot.appliedStaff.length > 0) {
          for (let i = 0; i <= ballot.appliedStaff.length - 1; i += 1) {
            const SlotObject = ballot.appliedStaff[i];

            weekRange[SlotObject.weekNo].appliedUser.push(SlotObject.userId);
          }
        }

        if (ballot.wonStaff.length > 0) {
          for (let i = 0; i <= ballot.wonStaff.length - 1; i += 1) {
            const SlotObject = ballot.wonStaff[i];

            weekRange[SlotObject.weekNo].wonUser.push(SlotObject.userId);
          }
        }

        const ballotingdata = { weeks: weekRange };

        return res.status(200).json({
          status: true,
          data: ballotingdata,
          message: 'data retrieved successfully',
        });
      }

      return res.send('couldent found');
    } catch (e) {
      return res
        .status(500)
        .json({ status: false, data: e, message: 'something went wrong', e });
    }
  }

  async getOpsTeamdropedown(req, res) {
    const { id } = req.params;
    const opsData = [];
    const ballot = await Ballot.findOne({ _id: id });
    const { opsGroupId } = ballot;

    if (!ballot) {
      return res
        .status(500)
        .json({ success: false, message: 'Requested ballot not found' });
    }

    const promiseData = [];
    const opsGroupIdListCall = async (i) => {
      const ops = {};
      const opsG = await OpsGroup.findOne(
        { _id: opsGroupId[i] },
        { opsGroupName: 1, _id: 1, opsTeamId: 1 },
      );

      if (!opsG) {
        return res.status(500).json({
          success: false,
          message: 'Couldnt find respective ops group',
        });
      }

      ops.opsgroup = opsG;
      const teams = [];
      const Teams = opsG.opsTeamId;

      if (Teams.length > 0) {
        const promiseData1 = [];
        const TeamsListCall = async (j) => {
          const OpsT = await OpsTeam.findOne(
            { _id: Teams[j] },
            { _id: 1, name: 1 },
          );

          teams.push(OpsT);
        };

        for (let j = 0; j <= Teams.length - 1; j += 1) {
          promiseData1.push(TeamsListCall(j));
        }

        await Promise.all(promiseData1);
      }

      ops.Teams = teams;

      opsData.push(ops);
      return opsData;
    };

    for (let i = 0; i <= opsGroupId.length - 1; i += 1) {
      promiseData.push(opsGroupIdListCall(i));
    }

    await Promise.all(promiseData);

    return res.status(200).json({
      success: true,
      data: opsData,
      message: 'Successfully received ops data for respectd ballot',
    });
  }

  async getBallotInRounds(req, res) {
    // first check if ballot has parent ballot

    try {
      const ballot = await Ballot.findOne({ _id: req.params.id });

      if (!ballot) {
        return res
          .status(500)
          .json({ success: false, message: 'Requested ballot not found' });
      }

      if (ballot.parentBallot) {
        const parentBallotId = await this.checkBallots(ballot._id);
        const ballotparent = await Ballot.findOne(
          { _id: parentBallotId },
          {
            _id: 1,
            ballotName: 1,
            resultReleaseDateTime: 1,
            childBallots: 1,
            ballotRound: 1,
            isResultRelease: 1,
            applicationOpenDateTime: 1,
            applicationCloseDateTime: 1,
            isConduct: 1,
            resultRelease: 1,
            isAutoAssign: 1,
            isCanceled: 1,
          },
        );

        this.sendManageBallotData(ballotparent, res);
      } else {
        this.sendManageBallotData(ballot, res);
      }

      return null;
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: 'Something went wrong!' });
    }
  }

  async checkBallots(ballotid) {
    let newballot = await Ballot.findOne({ _id: ballotid });

    newballot = JSON.stringify(newballot);
    newballot = JSON.parse(newballot);
    if (newballot.parentBallot) {
      const id = newballot.parentBallot;

      return this.checkBallots(id);
    }

    return newballot._id;
  }

  async sendManageBallotData(ballot, res) {
    const BallotsList = [];
    let ballotStatus = 'Open';

    if (
      new Date().getTime() > new Date(ballot.applicationCloseDateTime).getTime()
    ) {
      ballotStatus = 'Closed';
    }

    if (ballot.isResultRelease) {
      ballotStatus = 'Closed';
    }

    const roundOne = ballot.ballotRound + 1;
    const newbal = {
      ballotName: ballot.ballotName,
      _id: ballot._id,
      ballotStatus,
      ballotRound: `Round ${roundOne}`,
      resultDate: ballot.resultReleaseDateTime,
      applicationOpenDateTime: ballot.applicationOpenDateTime,
      applicationCloseDateTime: ballot.applicationCloseDateTime,
      isResultRelease: ballot.isResultRelease,
      isConduct: ballot.isConduct,
      resultRelease: ballot.resultRelease,
      isAutoAssign: ballot.isAutoAssign,
      isCanceled: ballot.isCanceled,
    };

    BallotsList.push(newbal);
    const parentBallotMain = ballot._id;

    if (ballot.childBallots && ballot.childBallots.length > 0) {
      const promiseData = [];
      const childBallotsListCall = async (b) => {
        const childBallot = await Ballot.findOne(
          { _id: ballot.childBallots[b] },
          {
            _id: 1,
            ballotName: 1,
            resultReleaseDateTime: 1,
            ballotRound: 1,
            isResultRelease: 1,
            applicationOpenDateTime: 1,
            applicationCloseDateTime: 1,
            isConduct: 1,
            resultRelease: 1,
            isAutoAssign: 1,
            assignRatio: 1,
            isCanceled: 1,
          },
        );

        if (childBallot) {
          let Status = 'Open';

          if (
            new Date().getTime() >
            new Date(childBallot.applicationCloseDateTime).getTime()
          ) {
            Status = 'Closed';
          }

          if (childBallot.isResultRelease) {
            Status = 'Closed';
          }

          const roundChild = childBallot.ballotRound + 1;
          const newbal1 = {
            ballotName: childBallot.ballotName,
            _id: childBallot._id,
            ballotStatus: Status,
            ballotRound: `Round ${roundChild}`,
            resultDate: childBallot.resultReleaseDateTime,
            applicationOpenDateTime: childBallot.applicationOpenDateTime,
            applicationCloseDateTime: childBallot.applicationCloseDateTime,
            isResultRelease: childBallot.isResultRelease,
            isConduct: childBallot.isConduct,
            resultRelease: childBallot.resultRelease,
            isAutoAssign: childBallot.isAutoAssign,
            isCanceled: childBallot.isCanceled,
          };

          if (!childBallot.assignRatio) {
            childBallot.isAssignRatio = false;
          } else {
            childBallot.isAssignRatio = true;
          }

          BallotsList.push(newbal1);
        } else {
          return res.status(500).json({
            success: false,
            message:
              'Problem while finding child ballots, Please try again later',
          });
        }

        return false;
      };

      for (let b = 0; b <= ballot.childBallots.length - 1; b += 1) {
        promiseData.push(childBallotsListCall(b));
      }

      await Promise.all(promiseData);
    }

    BallotsList.reverse();
    const ballotData = { parent: parentBallotMain, BallotList: BallotsList };

    return res.status(200).json({
      success: true,
      data: ballotData,
      message: 'Successfully got data.',
    });
  }

  async resultRelase(req, res) {
    const { selectedBallotId } = req.body;
    const annualLeaveId = await leaveType.findOne(
      { name: 'Annual Leave', isActive: true, companyId: req.user.companyId },
      { _id: 1 },
    );
    const getLeavetypeId = await Ballot.find(
      { _id: selectedBallotId, isPublish: true, isDeleted: false },
      {
        _id: 0,
        leaveTypeId: 1,
        wonStaff: 1,
        fixedBallotingLeaveType: 1,
        ballotRound: 1,
        ballotStartDate: 1,
      },
    );

    const currentYear = moment(getLeavetypeId[0].ballotStartDate).year();

    const user = await Ballot.findOneAndUpdate(
      { _id: selectedBallotId },
      { $set: { isResultRelease: true, resultReleaseDateTime: new Date() } },
    );

    if (user && user.isResultRelease) {
      return res.json({
        success: false,
        message: 'Result is already released',
      });
    }

    const uniqueUserIdsObj = getLeavetypeId[0].wonStaff
      .slice()
      .reverse()
      .filter(
        (v, i, a) =>
          a.findIndex(
            (t) => JSON.stringify(t.userId) === JSON.stringify(v.userId),
          ) === i,
      )
      .reverse();
    const uniqueIds = [...new Set(uniqueUserIdsObj.map((item) => item.userId))];

    for (let i = 0; i < getLeavetypeId[0].wonStaff.length; i += 1) {
      const findLeaveTpeInStaffLeave = await staffLeave.findOne(
        {
          userId: uniqueIds[i],
          'leaveDetails.year': currentYear,
          'leaveDetails.leaveTypeId': getLeavetypeId[0].fixedBallotingLeaveType
            ? getLeavetypeId[0].leaveTypeId
            : annualLeaveId._id,
        },
        { leaveDetails: 1, _id: 0 },
      );

      let leaveObj = [];
      let annualLeavePlanQuotaObj;
      let calculatedValue;

      if (findLeaveTpeInStaffLeave !== null) {
        // New-Leavetype
        leaveObj = _.filter(
          findLeaveTpeInStaffLeave.leaveDetails,
          (e) =>
            JSON.stringify(e.leaveTypeId) ===
              JSON.stringify(getLeavetypeId[0].leaveTypeId) &&
            e.year === currentYear,
        );
        if (leaveObj && leaveObj.length !== 0) {
          // Annual-Leavetype
          annualLeavePlanQuotaObj = _.filter(
            findLeaveTpeInStaffLeave.leaveDetails,
            (e) =>
              JSON.stringify(e.leaveTypeId) ===
                JSON.stringify(annualLeaveId._id) && e.year === currentYear,
          );
          // Total and PlanQuota will come from New-Leave type not from Annual Leave.
          calculatedValue =
            parseInt(leaveObj[0].total, 10) -
            parseInt(leaveObj[0].planQuota, 10);
        }
      }

      if (getLeavetypeId[0].fixedBallotingLeaveType) {
        if (getLeavetypeId[0].ballotRound === 0) {
          if (uniqueIds[i] !== undefined) {
            await staffLeave.findOneAndUpdate(
              {
                userId: uniqueIds[i],
                leaveDetails: {
                  $elemMatch: {
                    year: currentYear,
                    leaveTypeId: annualLeaveId._id,
                  },
                },
              },
              {
                'leaveDetails.$.planQuota':
                  annualLeavePlanQuotaObj[0].planQuota - calculatedValue,
              },
            );
          }
        } else {
          const findLeaveTpeInStaffLeavee = await staffLeave.findOne(
            {
              userId: getLeavetypeId[0].wonStaff[i].userId,
              'leaveDetails.year': currentYear,
              'leaveDetails.leaveTypeId': getLeavetypeId[0]
                .fixedBallotingLeaveType
                ? getLeavetypeId[0].leaveTypeId
                : annualLeaveId._id,
            },
            { leaveDetails: 1, _id: 0 },
          );

          const annualLeavePlanQuotaObjn = _.filter(
            findLeaveTpeInStaffLeavee.leaveDetails,
            (e) =>
              JSON.stringify(e.leaveTypeId) ===
                JSON.stringify(annualLeaveId._id) && e.year === currentYear,
          );

          await staffLeave.findOneAndUpdate(
            {
              userId: getLeavetypeId[0].wonStaff[i].userId,
              leaveDetails: {
                $elemMatch: {
                  year: currentYear,
                  leaveTypeId: annualLeaveId._id,
                },
              },
            },
            {
              'leaveDetails.$.planQuota':
                annualLeavePlanQuotaObjn[0].planQuota - 1,
            },
          );
        }
      }
    }

    this.sendResultReleaseNotification(user);
    const updateLeave = await this.pushLeaveToLeaveApplied(user);

    if (updateLeave && updateLeave.length) {
      return res.json({
        success: true,
        message: 'Result Released Successfully',
      });
    }

    return res.json({ success: false, message: 'Staff Leave not updated.' });
  }

  async sendResultReleaseNotification(item) {
    const currentTime = new Date();

    if (item.userFrom === 1) {
      const userIDArr = await OpsGroup.find(
        { _id: { $in: item.opsGroupId }, isDelete: false },
        { userId: 1, _id: 0 },
      );
      let userId = [];

      userIDArr.forEach((items) => {
        userId = userId.concat(items.userId);
      });
      const unAssignUser = await User.find({ _id: { $in: userId } })
        .select('deviceToken')
        .lean();
      const usersDeviceTokens = [];

      unAssignUser.forEach((token) => {
        if (token.deviceToken) {
          usersDeviceTokens.push(token.deviceToken);
        }
      });
      if (usersDeviceTokens.length > 0) {
        // Balloting Exercise (Ballot Name) results are released, please check the results
        const pushData = {
          title: 'Balloting Excercise results are released.',
          body: `Balloting Excercise "${item.ballotName}" results are released,  please check the results.`,
          bodyText: `Balloting Excercise "${item.ballotName}" results are released, please check the results.`,
          bodyTime: currentTime,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };
        const collapseKey = item._id; /* unique id for this particular ballot */

        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }

      await Ballot.update({ _id: item._id }, { isNotified: 4 });
    } else {
      // user from bu
      const userList = await User.find(
        { parentBussinessUnitId: { $in: item.businessUnitId } },
        { _id: 0, deviceToken: 1 },
      );
      const usersDeviceTokens = [];

      userList.forEach((token) => {
        if (token.deviceToken) {
          usersDeviceTokens.push(token.deviceToken);
        }
      });
      if (usersDeviceTokens.length > 0) {
        const pushData = {
          title: 'Balloting Excercise results are released.',
          body: `Balloting Excercise "${item.ballotName}" results are released,  please check the results.`,
          bodyText: `Balloting Excercise "${item.ballotName}" results are released, please check the results.`,
          bodyTime: currentTime,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };
        const collapseKey = item._id; /* unique id for this particular ballot */

        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }

      await Ballot.update({ _id: item._id }, { isNotified: 4 });
    }
  }

  async pushLeaveToLeaveApplied(ballotData) {
    if (ballotData.staffLeave && ballotData.staffLeave.length) {
      const leaveData = [];

      for (let i = 0; i < ballotData.staffLeave.length; i += 1) {
        leaveData.push(ballotData.staffLeave[i]);
      }
      const result = await LeaveApplied.insertMany(leaveData, {
        ordered: true,
      });

      return result;
    }

    return false;
  }

  async ballotDetail(req, res) {
    const { selectedBallotId } = req.body;
    const ballotData = await Ballot.findOne({ _id: selectedBallotId });

    // for BU
    if (ballotData.userFrom === 2) {
      const wonStaffData = [];
      const wonStaffByBu = this.groupByPro(ballotData.wonStaff, 'buId');

      for (const buId of Object.keys(wonStaffByBu)) {
        const wonStaffByBuWeek = this.groupByPro(wonStaffByBu[buId], 'weekNo');

        wonStaffData.push({ buId, wonStaffByBuWeek });
      }
      const appliedStaffData = [];
      const appliedStaffDataByBu = this.groupByPro(
        ballotData.appliedStaff,
        'buId',
      );

      for (const buId of Object.keys(appliedStaffDataByBu)) {
        const appliedStaffDataByBuWeek = this.groupByPro(
          appliedStaffDataByBu[buId],
          'weekNo',
        );

        appliedStaffData.push({ buId1: buId, appliedStaffDataByBuWeek });
      }
      const actualSlotValueByBuArr = [];
      const ballotRoundResult = {
        quota: 0,
        applied: 0,
        successful: 0,
      };

      for (let i = 0; i < ballotData.slotCreation.length; i += 1) {
        const slot = ballotData.slotCreation[i];
        const wonBuStaffArr = wonStaffData.filter(
          (bu) => bu.buId.toString() === slot.buId.toString(),
        );
        const appliedBuStaffArr = appliedStaffData.filter(
          (bu) => bu.buId1.toString() === slot.buId.toString(),
        );
        let appliedBuStaff = null;
        let wonBuStaff = null;

        if (appliedBuStaffArr.length > 0) {
          [appliedBuStaff] = appliedBuStaffArr;
        }

        if (wonBuStaffArr.length > 0) {
          [wonBuStaff] = wonBuStaffArr;
        }

        const actualSlotValueByBu = {
          buId: slot.buId,
          weekValue: [],
          ballotRoundResultBuWise: {
            quota: 0,
            applied: 0,
            successful: 0,
          },
        };

        slot.arr.forEach((item, index) => {
          const slotValue = item.value;

          ballotRoundResult.quota += slotValue;
          actualSlotValueByBu.ballotRoundResultBuWise.quota += slotValue;
          let appliedValue = 0;

          if (
            appliedBuStaff &&
            appliedBuStaff.appliedStaffDataByBuWeek[`${index}`]
          ) {
            appliedValue =
              appliedBuStaff.appliedStaffDataByBuWeek[`${index}`].length;
            ballotRoundResult.applied += appliedValue;
            actualSlotValueByBu.ballotRoundResultBuWise.applied += appliedValue;
          }

          let wonValue = 0;

          if (wonBuStaff && wonBuStaff.wonStaffByBuWeek[`${index}`]) {
            wonValue = wonBuStaff.wonStaffByBuWeek[`${index}`].length;
            ballotRoundResult.successful += wonValue;
            actualSlotValueByBu.ballotRoundResultBuWise.successful += wonValue;
          }

          actualSlotValueByBu.weekValue.push(
            `${slotValue}/${appliedValue}/${wonValue}`,
          );
        });
        actualSlotValueByBuArr.push(actualSlotValueByBu);
      }
      res.send({ actualSlotValueByBuArr, ballotRoundResult });
    } else {
      const wonStaffDataOpsGroup = [];
      const wonStaffByOpsGroup = this.groupByPro(
        ballotData.wonStaff,
        'opsGroupId',
      );

      for (const opsGroupId of Object.keys(wonStaffByOpsGroup)) {
        const wonStaffByBuWeek = this.groupByPro(
          wonStaffByOpsGroup[opsGroupId],
          'weekNo',
        );

        wonStaffDataOpsGroup.push({ opsGroupId, wonStaffByBuWeek });
      }
      const wonStaffDataOpsTeam = [];
      const wonStaffByOpsTeam = this.groupByPro(
        ballotData.wonStaff,
        'opsTeamId',
      );

      for (const opsTeamId of Object.keys(wonStaffByOpsTeam)) {
        const { opsGroupId } = wonStaffByOpsTeam[opsTeamId][0];
        const wonStaffByBuWeek = this.groupByPro(
          wonStaffByOpsTeam[opsTeamId],
          'weekNo',
        );

        wonStaffDataOpsTeam.push({ opsTeamId, opsGroupId, wonStaffByBuWeek });
      }

      const appliedStaffDataOpsGroup = [];
      const appliedStaffDataByOpsGroup = this.groupByPro(
        ballotData.appliedStaff,
        'opsGroupId',
      );

      for (const opsGroupId of Object.keys(appliedStaffDataByOpsGroup)) {
        const appliedStaffDataByBuWeek = this.groupByPro(
          appliedStaffDataByOpsGroup[opsGroupId],
          'weekNo',
        );

        appliedStaffDataOpsGroup.push({
          opsGroupId,
          appliedStaffDataByBuWeek,
        });
      }
      const appliedStaffDataOpsTeam = [];
      const appliedStaffDataByOpsTeam = this.groupByPro(
        ballotData.appliedStaff,
        'opsTeamId',
      );

      for (const opsTeamId of Object.keys(appliedStaffDataByOpsTeam)) {
        const { opsGroupId } = appliedStaffDataByOpsTeam[opsTeamId][0];
        const appliedStaffDataByBuWeek = this.groupByPro(
          appliedStaffDataByOpsTeam[opsTeamId],
          'weekNo',
        );

        appliedStaffDataOpsTeam.push({
          opsTeamId,
          opsGroupId,
          appliedStaffDataByBuWeek,
        });
      }
      const finalValue = [];

      for (let i = 0; i < ballotData.slotCreation.length; i += 1) {
        const slotObj = ballotData.slotCreation[i];
        const weekRangeSlotList = Object.keys(slotObj.weekRangeSlot);
        const checkIndexFormat = weekRangeSlotList.includes('OG0OT0');

        if (slotObj.opsTeam.length > 0) {
          const appliedStaffOpsTeamArr = [];

          appliedStaffDataOpsTeam.forEach((item) => {
            for (let k = 0; k < slotObj.opsTeam.length; k += 1) {
              if (
                slotObj.opsTeam[k]._id.toString() === item.opsTeamId.toString()
              ) {
                appliedStaffOpsTeamArr.push(item);
              }
            }
          });

          const wonStaffOpsTeamArr = [];

          wonStaffDataOpsTeam.forEach((item) => {
            for (let j = 0; j < slotObj.opsTeam.length; j += 1) {
              if (
                slotObj.opsTeam[j]._id.toString() === item.opsTeamId.toString()
              ) {
                wonStaffOpsTeamArr.push(item);
              }
            }
          });
          const tire1Quota = [];

          const finalValueTeam = [];

          slotObj.opsTeam.forEach((team, index) => {
            const appliedStaffTeamObj = appliedStaffOpsTeamArr.filter(
              (appliedTeam) =>
                appliedTeam.opsTeamId.toString() === team._id.toString(),
            );

            const wonStaffTeamObj = wonStaffOpsTeamArr.filter(
              (wonTeam) => wonTeam.opsTeamId.toString() === team._id.toString(),
            );
            let teamSlotArr = [];

            for (let j = 0; j < ballotData.weekRange.length; j += 1) {
              if (index === 0) {
                tire1Quota.push(
                  parseInt(slotObj.weekRangeSlot[`${j}A`].value, 10),
                );
              }

              const teamQuota = checkIndexFormat
                ? parseInt(slotObj.weekRangeSlot[`OG${j}OT${index}`].value, 10)
                : parseInt(slotObj.weekRangeSlot[`${j}${index}`].value, 10);
              let appliedStaffQuota = 0;
              let successStaffQuota = 0;

              if (
                appliedStaffTeamObj.length > 0 &&
                appliedStaffTeamObj[0].appliedStaffDataByBuWeek[`${j}`]
              ) {
                appliedStaffQuota =
                  appliedStaffTeamObj[0].appliedStaffDataByBuWeek[`${j}`]
                    .length;
              }

              if (
                wonStaffTeamObj.length > 0 &&
                wonStaffTeamObj[0].wonStaffByBuWeek[`${j}`]
              ) {
                successStaffQuota =
                  wonStaffTeamObj[0].wonStaffByBuWeek[`${j}`].length;
              }

              teamSlotArr.push({
                teamQuota,
                appliedStaffQuota,
                weekNo: j,
                successStaffQuota,
              });
            }
            // tire1Quota
            let obj = {
              teamId: team._id,
              opsGroupId: slotObj.opsGroup.opsId,
              value: teamSlotArr,
            };

            finalValueTeam.push(obj);

            teamSlotArr = [];
            if (index === slotObj.opsTeam.length - 1) {
              for (let k = 0; k < ballotData.weekRange.length; k += 1) {
                let totalTeamSuccess = 0;
                let totalTeamApplied = 0;

                slotObj.opsTeam.forEach((insideTeam, indexIndex) => {
                  totalTeamSuccess +=
                    finalValueTeam[indexIndex].value[k].successStaffQuota;
                  totalTeamApplied +=
                    finalValueTeam[indexIndex].value[k].appliedStaffQuota;
                });
                teamSlotArr.push({
                  teamQuota: tire1Quota[k],
                  appliedStaffQuota: totalTeamApplied,
                  weekNo: k,
                  successStaffQuota: totalTeamSuccess,
                });
              }
              obj = {
                teamId: 'Tier 1',
                opsGroupId: slotObj.opsGroup.opsId,
                value: teamSlotArr,
              };
              finalValueTeam.push(obj);
            }
          });

          finalValue.push(finalValueTeam);
        } else {
          // no team detail
          const finalValueTeam = [];
          const noOpsTeamAppliedDataArr = appliedStaffDataOpsGroup.filter(
            (item) =>
              item.opsGroupId.toString() === slotObj.opsGroup.opsId.toString(),
          );
          const noOpsTeamWonDataArr = wonStaffDataOpsGroup.filter(
            (item) =>
              item.opsGroupId.toString() === slotObj.opsGroup.opsId.toString(),
          );
          const obj = {
            teamId: null,
            opsGroupId: slotObj.opsGroup.opsId,
            value: [],
          };
          const teamSlotArr = [];

          for (let e = 0; e < ballotData.weekRange.length; e += 1) {
            const teamQuota = parseInt(
              slotObj.weekRangeSlot[`${e}A`].value,
              10,
            );
            let appliedStaffQuota = 0;

            if (
              noOpsTeamAppliedDataArr &&
              noOpsTeamAppliedDataArr.length > 0 &&
              noOpsTeamAppliedDataArr[0].appliedStaffDataByBuWeek[e] &&
              noOpsTeamAppliedDataArr[0].appliedStaffDataByBuWeek[e].length > 0
            ) {
              appliedStaffQuota =
                noOpsTeamAppliedDataArr[0].appliedStaffDataByBuWeek[e].length;
            }

            let successStaffQuota = 0;

            if (
              noOpsTeamWonDataArr &&
              noOpsTeamWonDataArr.length &&
              noOpsTeamWonDataArr[0].wonStaffByBuWeek[e] &&
              noOpsTeamWonDataArr[0].wonStaffByBuWeek[e].length > 0
            ) {
              successStaffQuota =
                noOpsTeamWonDataArr[0].wonStaffByBuWeek[e].length;
            }

            teamSlotArr.push({
              teamQuota,
              appliedStaffQuota,
              weekNo: e,
              successStaffQuota,
            });
          }
          obj.value = teamSlotArr;
          finalValueTeam.push(obj);
          finalValue.push(finalValueTeam);
        }
      }
      const newFinalData = [];
      let finalTotalApplied = 0;
      let finalTotalQuota = 0;

      let finalTotalSuccessful = 0;

      for (let i = 0; i < ballotData.slotCreation.length; i += 1) {
        const slotData = ballotData.slotCreation[i];
        const weekRangeSlotList = Object.keys(slotData.weekRangeSlot);
        const checkIndexFormat = weekRangeSlotList.includes('OG0OT0');
        const opsGroupData = finalValue[i];
        let totalBalanceTeamQuota = 0;

        slotData.opsGroup.balanceQuota = 0;
        slotData.opsGroup.applied = 0;
        slotData.opsGroup.quota = 0;
        slotData.opsGroup.successful = 0;

        for (let j = 0; j < opsGroupData.length; j += 1) {
          if (opsGroupData.length - 1 !== j) {
            slotData.opsTeam[j].balanceQuota = 0;
            slotData.opsTeam[j].applied = 0;
            slotData.opsTeam[j].quota = 0;
            slotData.opsTeam[j].successful = 0;
          }
        }
        for (let k = 0; k < ballotData.weekRange.length; k += 1) {
          let teamQuota = 0;
          let teamBallanceReaming = 0;

          for (let j = 0; j < opsGroupData.length; j += 1) {
            if (opsGroupData.length - 1 === j) {
              // for tire 1
              if (opsGroupData.length === 1) {
                slotData.opsGroup.applied +=
                  opsGroupData[j].value[k].appliedStaffQuota;
                slotData.opsGroup.successful +=
                  opsGroupData[j].value[k].successStaffQuota;
              }

              slotData.weekRangeSlot[`${k}A`].value = opsGroupData[j].value[k];
              finalTotalApplied += opsGroupData[j].value[k].appliedStaffQuota;
              finalTotalSuccessful +=
                opsGroupData[j].value[k].successStaffQuota;
              slotData.opsGroup.balanceQuota +=
                opsGroupData[j].value[k].teamQuota -
                opsGroupData[j].value[k].successStaffQuota;
              if (
                teamBallanceReaming < slotData.opsGroup.balanceQuota &&
                opsGroupData.length !== 1
              ) {
                slotData.opsGroup.balanceQuota = teamBallanceReaming;
              }

              if (
                teamQuota < opsGroupData[j].value[k].teamQuota &&
                opsGroupData.length > 1
              ) {
                finalTotalQuota += parseInt(teamQuota, 10);
                slotData.opsGroup.quota += parseInt(teamQuota, 10);
              } else {
                finalTotalQuota += parseInt(
                  opsGroupData[j].value[k].teamQuota,
                  10,
                );
                slotData.opsGroup.quota += parseInt(
                  opsGroupData[j].value[k].teamQuota,
                  10,
                );
              }
            } else {
              slotData.opsTeam[j].isShow = true;
              if (checkIndexFormat) {
                slotData.weekRangeSlot[`OG${k}OT${j}`].value =
                  opsGroupData[j].value[k];
              } else {
                slotData.weekRangeSlot[`${k}${j}`].value =
                  opsGroupData[j].value[k];
              }

              slotData.opsTeam[j].balanceQuota +=
                opsGroupData[j].value[k].teamQuota -
                opsGroupData[j].value[k].successStaffQuota;
              slotData.opsTeam[j].applied +=
                opsGroupData[j].value[k].appliedStaffQuota;
              slotData.opsTeam[j].quota += opsGroupData[j].value[k].teamQuota;
              teamQuota += parseInt(opsGroupData[j].value[k].teamQuota, 10);

              slotData.opsTeam[j].successful +=
                opsGroupData[j].value[k].successStaffQuota;
              slotData.opsGroup.applied +=
                opsGroupData[j].value[k].appliedStaffQuota;
              slotData.opsGroup.successful +=
                opsGroupData[j].value[k].successStaffQuota;
            }

            if (opsGroupData.length - 1 !== j) {
              totalBalanceTeamQuota += slotData.opsTeam[j].balanceQuota;
              teamBallanceReaming += slotData.opsTeam[j].balanceQuota;
            }
          }
        }
        // remove code for changing balance quota
        if (
          totalBalanceTeamQuota < slotData.opsGroup.balanceQuota &&
          opsGroupData.length !== 1
        ) {
          slotData.opsGroup.balanceQuota = totalBalanceTeamQuota;
        }

        newFinalData.push(slotData);
      }
      newFinalData.forEach((ite) => {
        ite.opsGroup.balanceQuota =
          ite.opsGroup.quota - ite.opsGroup.successful;
      });
      let leaveFormat = 5;

      if (ballotData.leaveConfiguration === 2) {
        leaveFormat = 6;
      } else if (ballotData.leaveConfiguration === 3) {
        leaveFormat = 7;
      }

      if (ballotData.leaveType === 2) {
        leaveFormat = 1;
      }

      const startYear = new Date(ballotData.ballotStartDate).getFullYear();
      let totalTeamUnassign = 0;

      for (let i = 0; i < newFinalData.length; i += 1) {
        const opsGroupData = newFinalData[i];

        newFinalData[i].opsGroup.unassignBalanace = 0;

        if (opsGroupData.opsTeam.length > 0) {
          for (let j = 0; j < opsGroupData.opsTeam.length; j += 1) {
            const opsTeamData = opsGroupData.opsTeam[j];
            const opsTeamUser = await OpsTeam.findOne(
              { _id: opsTeamData._id },
              { userId: 1, _id: 0 },
            ).lean();

            let leaveBallanceData;

            if (ballotData !== null && ballotData.fixedBallotingLeaveType) {
              leaveBallanceData = await this.checkIsAnnualLeaveArr(
                opsTeamUser.userId,
                req.user.companyId,
                startYear,
                true,
                ballotData.leaveTypeId,
              );
            } else {
              leaveBallanceData = await this.checkIsAnnualLeaveArr(
                opsTeamUser.userId,
                req.user.companyId,
                startYear,
                false,
              );
            }

            let teamUnassign = 0;

            leaveBallanceData.staffArr.forEach((item) => {
              teamUnassign += Math.floor(
                item.leaveTypeData.planQuota / leaveFormat,
              );
            });
            // to get all unassign before result release
            if (!ballotData.isResultRelease && !ballotData.isConduct) {
              teamUnassign += newFinalData[i].opsTeam[j].applied;
            }

            newFinalData[i].opsTeam[j].unassignBalanace = teamUnassign;
            totalTeamUnassign += teamUnassign;
            newFinalData[i].opsGroup.unassignBalanace += teamUnassign;
          }
        } else {
          // no team
          const opsTeamUser = await OpsGroup.findOne(
            { _id: opsGroupData.opsGroup.opsId },
            { userId: 1, _id: 0 },
          ).lean();

          let leaveBallanceData;

          if (ballotData !== null && ballotData.fixedBallotingLeaveType) {
            leaveBallanceData = await this.checkIsAnnualLeaveArr(
              opsTeamUser.userId,
              req.user.companyId,
              startYear,
              true,
              ballotData.leaveTypeId,
            );
          } else {
            leaveBallanceData = await this.checkIsAnnualLeaveArr(
              opsTeamUser.userId,
              req.user.companyId,
              startYear,
              false,
            );
          }

          let teamUnassign = 0;

          leaveBallanceData.staffArr.forEach((item) => {
            teamUnassign += Math.floor(
              item.leaveTypeData.planQuota / leaveFormat,
            );
          });
          newFinalData[i].opsGroup.unassignBalanace = teamUnassign;
          totalTeamUnassign += teamUnassign;
        }
      }
      res.json({
        success: true,
        data: newFinalData,
        finalTotalQuota,
        finalTotalApplied,
        finalTotalSuccessful,
        totalTeamUnassign,
      });
    }
  }

  async getBallotDetail(Id, res) {
    const selectedBallotId = Id;
    const ballotData = await Ballot.findOne({ _id: selectedBallotId });

    // for BU
    if (ballotData.userFrom === 2) {
      const wonStaffData = [];
      const wonStaffByBu = this.groupByPro(ballotData.wonStaff, 'buId');

      for (const buId of Object.keys(wonStaffByBu)) {
        const wonStaffByBuWeek = this.groupByPro(wonStaffByBu[buId], 'weekNo');

        wonStaffData.push({ buId, wonStaffByBuWeek });
      }
      const appliedStaffData = [];
      const appliedStaffDataByBu = this.groupByPro(
        ballotData.appliedStaff,
        'buId',
      );

      for (const buId of Object.keys(appliedStaffDataByBu)) {
        const appliedStaffDataByBuWeek = this.groupByPro(
          appliedStaffDataByBu[buId],
          'weekNo',
        );

        appliedStaffData.push({ buId1: buId, appliedStaffDataByBuWeek });
      }
      const actualSlotValueByBuArr = [];
      const ballotRoundResult = {
        quota: 0,
        applied: 0,
        successful: 0,
      };

      for (let i = 0; i < ballotData.slotCreation.length; i += 1) {
        const slot = ballotData.slotCreation[i];
        const wonBuStaffArr = wonStaffData.filter(
          (bu) => bu.buId.toString() === slot.buId.toString(),
        );
        const appliedBuStaffArr = appliedStaffData.filter(
          (bu) => bu.buId1.toString() === slot.buId.toString(),
        );
        let appliedBuStaff = null;
        let wonBuStaff = null;

        if (appliedBuStaffArr.length > 0) {
          [appliedBuStaff] = appliedBuStaffArr;
        }

        if (wonBuStaffArr.length > 0) {
          [wonBuStaff] = wonBuStaffArr;
        }

        const actualSlotValueByBu = {
          buId: slot.buId,
          weekValue: [],
          ballotRoundResultBuWise: {
            quota: 0,
            applied: 0,
            successful: 0,
          },
        };

        slot.arr.forEach((item, index) => {
          const slotValue = item.value;

          ballotRoundResult.quota += slotValue;
          actualSlotValueByBu.ballotRoundResultBuWise.quota += slotValue;
          let appliedValue = 0;

          if (
            appliedBuStaff &&
            appliedBuStaff.appliedStaffDataByBuWeek[`${index}`]
          ) {
            appliedValue =
              appliedBuStaff.appliedStaffDataByBuWeek[`${index}`].length;
            ballotRoundResult.applied += appliedValue;
            actualSlotValueByBu.ballotRoundResultBuWise.applied += appliedValue;
          }

          let wonValue = 0;

          if (wonBuStaff && wonBuStaff.wonStaffByBuWeek[`${index}`]) {
            wonValue = wonBuStaff.wonStaffByBuWeek[`${index}`].length;
            ballotRoundResult.successful += wonValue;
            actualSlotValueByBu.ballotRoundResultBuWise.successful += wonValue;
          }

          actualSlotValueByBu.weekValue.push(
            `${slotValue}/${appliedValue}/${wonValue}`,
          );
        });
        actualSlotValueByBuArr.push(actualSlotValueByBu);
      }
      res.send({ actualSlotValueByBuArr, ballotRoundResult });
    }

    const wonStaffDataOpsGroup = [];
    const wonStaffByOpsGroup = this.groupByPro(
      ballotData.wonStaff,
      'opsGroupId',
    );

    for (const opsGroupId of Object.keys(wonStaffByOpsGroup)) {
      const wonStaffByBuWeek = this.groupByPro(
        wonStaffByOpsGroup[opsGroupId],
        'weekNo',
      );

      wonStaffDataOpsGroup.push({ opsGroupId, wonStaffByBuWeek });
    }
    const wonStaffDataOpsTeam = [];
    const wonStaffByOpsTeam = this.groupByPro(ballotData.wonStaff, 'opsTeamId');

    for (const opsTeamId of Object.keys(wonStaffByOpsTeam)) {
      const { opsGroupId } = wonStaffByOpsTeam[opsTeamId][0];
      const wonStaffByBuWeek = this.groupByPro(
        wonStaffByOpsTeam[opsTeamId],
        'weekNo',
      );

      wonStaffDataOpsTeam.push({ opsTeamId, opsGroupId, wonStaffByBuWeek });
    }

    const appliedStaffDataOpsGroup = [];
    const appliedStaffDataByOpsGroup = this.groupByPro(
      ballotData.appliedStaff,
      'opsGroupId',
    );

    for (const opsGroupId of Object.keys(appliedStaffDataByOpsGroup)) {
      const appliedStaffDataByBuWeek = this.groupByPro(
        appliedStaffDataByOpsGroup[opsGroupId],
        'weekNo',
      );

      appliedStaffDataOpsGroup.push({
        opsGroupId,
        appliedStaffDataByBuWeek,
      });
    }
    const appliedStaffDataOpsTeam = [];
    const appliedStaffDataByOpsTeam = this.groupByPro(
      ballotData.appliedStaff,
      'opsTeamId',
    );

    for (const opsTeamId of Object.keys(appliedStaffDataByOpsTeam)) {
      const { opsGroupId } = appliedStaffDataByOpsTeam[opsTeamId][0];
      const appliedStaffDataByBuWeek = this.groupByPro(
        appliedStaffDataByOpsTeam[opsTeamId],
        'weekNo',
      );

      appliedStaffDataOpsTeam.push({
        opsTeamId,
        opsGroupId,
        appliedStaffDataByBuWeek,
      });
    }
    const finalValue = [];

    for (let i = 0; i < ballotData.slotCreation.length; i += 1) {
      const slotObj = ballotData.slotCreation[i];
      const weekRangeSlotList = Object.keys(slotObj.weekRangeSlot);
      const checkIndexFormat = weekRangeSlotList.includes('OG0OT0');

      if (slotObj.opsTeam.length > 0) {
        const appliedStaffOpsTeamArr = [];

        appliedStaffDataOpsTeam.forEach((item) => {
          for (let m = 0; m < slotObj.opsTeam.length; m += 1) {
            if (
              slotObj.opsTeam[m]._id.toString() === item.opsTeamId.toString()
            ) {
              appliedStaffOpsTeamArr.push(item);
            }
          }
        });
        const wonStaffOpsTeamArr = [];

        wonStaffDataOpsTeam.forEach((item) => {
          for (let n = 0; n < slotObj.opsTeam.length; n += 1) {
            if (
              slotObj.opsTeam[n]._id.toString() === item.opsTeamId.toString()
            ) {
              wonStaffOpsTeamArr.push(item);
            }
          }
        });
        const tire1Quota = [];
        const finalValueTeam = [];

        slotObj.opsTeam.forEach((team, index) => {
          const appliedStaffTeamObj = appliedStaffOpsTeamArr.filter(
            (appliedTeam) =>
              appliedTeam.opsTeamId.toString() === team._id.toString(),
          );

          const wonStaffTeamObj = wonStaffOpsTeamArr.filter(
            (wonTeam) => wonTeam.opsTeamId.toString() === team._id.toString(),
          );
          let teamSlotArr = [];

          for (let j = 0; j < ballotData.weekRange.length; j += 1) {
            if (index === 0) {
              tire1Quota.push(
                parseInt(slotObj.weekRangeSlot[`${j}A`].value, 10),
              );
            }

            const teamQuota = checkIndexFormat
              ? parseInt(slotObj.weekRangeSlot[`OG${j}OT${index}`].value, 10)
              : parseInt(slotObj.weekRangeSlot[`${j}${index}`].value, 10);
            let appliedStaffQuota = 0;
            let successStaffQuota = 0;

            if (
              appliedStaffTeamObj.length > 0 &&
              appliedStaffTeamObj[0].appliedStaffDataByBuWeek[`${j}`]
            ) {
              appliedStaffQuota =
                appliedStaffTeamObj[0].appliedStaffDataByBuWeek[`${j}`].length;
            }

            if (
              wonStaffTeamObj.length > 0 &&
              wonStaffTeamObj[0].wonStaffByBuWeek[`${j}`]
            ) {
              successStaffQuota =
                wonStaffTeamObj[0].wonStaffByBuWeek[`${j}`].length;
            }

            teamSlotArr.push({
              teamQuota,
              appliedStaffQuota,
              weekNo: j,
              successStaffQuota,
            });
          }
          // tire1Quota
          let obj = {
            teamId: team._id,
            opsGroupId: slotObj.opsGroup.opsId,
            value: teamSlotArr,
          };

          finalValueTeam.push(obj);
          teamSlotArr = [];
          if (index === slotObj.opsTeam.length - 1) {
            for (let k = 0; k < ballotData.weekRange.length; k += 1) {
              let totalTeamSuccess = 0;
              let totalTeamApplied = 0;

              slotObj.opsTeam.forEach((insideTeam, indexIndex) => {
                totalTeamSuccess +=
                  finalValueTeam[indexIndex].value[k].successStaffQuota;
                totalTeamApplied +=
                  finalValueTeam[indexIndex].value[k].appliedStaffQuota;
              });
              teamSlotArr.push({
                teamQuota: tire1Quota[k],
                appliedStaffQuota: totalTeamApplied,
                weekNo: k,
                successStaffQuota: totalTeamSuccess,
              });
            }
            obj = {
              teamId: 'Tier 1',
              opsGroupId: slotObj.opsGroup.opsId,
              value: teamSlotArr,
            };
            finalValueTeam.push(obj);
          }
        });

        finalValue.push(finalValueTeam);
      } else {
        const finalValueTeam = [];
        const noOpsTeamAppliedDataArr = appliedStaffDataOpsGroup.filter(
          (item) =>
            item.opsGroupId.toString() === slotObj.opsGroup.opsId.toString(),
        );
        const noOpsTeamWonDataArr = wonStaffDataOpsGroup.filter(
          (item) =>
            item.opsGroupId.toString() === slotObj.opsGroup.opsId.toString(),
        );
        const obj = {
          teamId: null,
          opsGroupId: slotObj.opsGroup.opsId,
          value: [],
        };
        const teamSlotArr = [];

        for (let e = 0; e < ballotData.weekRange.length; e += 1) {
          const teamQuota = parseInt(slotObj.weekRangeSlot[`${e}A`].value, 10);

          let appliedStaffQuota = 0;

          if (
            noOpsTeamAppliedDataArr &&
            noOpsTeamAppliedDataArr.length > 0 &&
            noOpsTeamAppliedDataArr[0].appliedStaffDataByBuWeek[e] &&
            noOpsTeamAppliedDataArr[0].appliedStaffDataByBuWeek[e].length > 0
          ) {
            appliedStaffQuota =
              noOpsTeamAppliedDataArr[0].appliedStaffDataByBuWeek[e].length;
          }

          let successStaffQuota = 0;

          if (
            noOpsTeamWonDataArr &&
            noOpsTeamWonDataArr.length &&
            noOpsTeamWonDataArr[0].wonStaffByBuWeek[e] &&
            noOpsTeamWonDataArr[0].wonStaffByBuWeek[e].length > 0
          ) {
            successStaffQuota =
              noOpsTeamWonDataArr[0].wonStaffByBuWeek[e].length;
          }

          teamSlotArr.push({
            teamQuota,
            appliedStaffQuota,
            weekNo: e,
            successStaffQuota,
          });
        }
        obj.value = teamSlotArr;

        finalValueTeam.push(obj);
        finalValue.push(finalValueTeam);
      }
    }

    const newFinalData = [];
    let finalTotalApplied = 0;
    let finalTotalQuota = 0;

    let finalTotalSuccessful = 0;

    for (let i = 0; i < ballotData.slotCreation.length; i += 1) {
      const slotData = ballotData.slotCreation[i];
      const weekRangeSlotList = Object.keys(slotData.weekRangeSlot);
      const checkIndexFormat = weekRangeSlotList.includes('OG0OT0');
      const opsGroupData = finalValue[i];

      slotData.opsGroup.balanceQuota = 0;
      slotData.opsGroup.applied = 0;
      slotData.opsGroup.quota = 0;
      slotData.opsGroup.successful = 0;

      for (let j = 0; j < opsGroupData.length; j += 1) {
        if (opsGroupData.length - 1 !== j) {
          slotData.opsTeam[j].balanceQuota = 0;
          slotData.opsTeam[j].applied = 0;
          slotData.opsTeam[j].quota = 0;
          slotData.opsTeam[j].successful = 0;
        }
      }
      for (let k = 0; k < ballotData.weekRange.length; k += 1) {
        let teamQuota = 0;
        let teamBallanceReaming = 0;

        for (let j = 0; j < opsGroupData.length; j += 1) {
          if (opsGroupData.length - 1 === j) {
            // for tire 1
            if (opsGroupData.length === 1) {
              slotData.opsGroup.applied +=
                opsGroupData[j].value[k].appliedStaffQuota;
              slotData.opsGroup.successful +=
                opsGroupData[j].value[k].successStaffQuota;
            }

            slotData.weekRangeSlot[`${k}A`].value = opsGroupData[j].value[k];
            finalTotalApplied += opsGroupData[j].value[k].appliedStaffQuota;
            finalTotalSuccessful += opsGroupData[j].value[k].successStaffQuota;
            slotData.opsGroup.balanceQuota +=
              opsGroupData[j].value[k].teamQuota -
              opsGroupData[j].value[k].successStaffQuota;
            if (
              teamBallanceReaming < slotData.opsGroup.balanceQuota &&
              opsGroupData.length !== 1
            ) {
              slotData.opsGroup.balanceQuota = teamBallanceReaming;
            }

            if (
              teamQuota < opsGroupData[j].value[k].teamQuota &&
              opsGroupData.length > 1
            ) {
              finalTotalQuota += teamQuota;
              slotData.opsGroup.quota += teamQuota;
            } else {
              finalTotalQuota += opsGroupData[j].value[k].teamQuota;
              slotData.opsGroup.quota += opsGroupData[j].value[k].teamQuota;
            }
          } else {
            slotData.opsTeam[j].isShow = true;
            if (checkIndexFormat) {
              slotData.weekRangeSlot[`OG${k}OT${j}`].value =
                opsGroupData[j].value[k];
            } else {
              slotData.weekRangeSlot[`${k}${j}`].value =
                opsGroupData[j].value[k];
            }

            slotData.opsTeam[j].balanceQuota +=
              opsGroupData[j].value[k].teamQuota -
              opsGroupData[j].value[k].successStaffQuota;
            slotData.opsTeam[j].applied +=
              opsGroupData[j].value[k].appliedStaffQuota;
            slotData.opsTeam[j].quota += opsGroupData[j].value[k].teamQuota;
            teamQuota += opsGroupData[j].value[k].teamQuota;

            slotData.opsTeam[j].successful +=
              opsGroupData[j].value[k].successStaffQuota;
            slotData.opsGroup.applied +=
              opsGroupData[j].value[k].appliedStaffQuota;
            slotData.opsGroup.successful +=
              opsGroupData[j].value[k].successStaffQuota;
          }

          if (opsGroupData.length - 1 !== j) {
            teamBallanceReaming += slotData.opsTeam[j].balanceQuota;
          }
        }
      }
      // remove code for changing balance quota

      newFinalData.push(slotData);
    }
    let leaveFormat = 5;

    if (ballotData.leaveConfiguration === 2) {
      leaveFormat = 6;
    } else if (ballotData.leaveConfiguration === 3) {
      leaveFormat = 7;
    }

    let totalTeamUnassign = 0;

    for (let i = 0; i < newFinalData.length; i += 1) {
      const opsGroupData = newFinalData[i];

      newFinalData[i].opsGroup.unassignBalanace = 0;

      if (opsGroupData.opsTeam.length > 0) {
        for (let j = 0; j < opsGroupData.opsTeam.length; j += 1) {
          const opsTeamData = opsGroupData.opsTeam[j];
          const opsTeamUser = await OpsTeam.findOne(
            { _id: opsTeamData._id },
            { userId: 1, _id: 0 },
          ).lean();
          const leaveBallanceData = await StaffSapData.find(
            { staff_Id: { $in: opsTeamUser.userId } },
            { ballotLeaveBalanced: 1, _id: 0 },
          ).lean();
          let teamUnassign = 0;

          leaveBallanceData.forEach((item) => {
            teamUnassign += Math.floor(item.ballotLeaveBalanced / leaveFormat);
          });
          // remove comment
          if (!ballotData.isResultRelease && !ballotData.isConduct) {
            teamUnassign += newFinalData[i].opsTeam[j].applied;
          }

          newFinalData[i].opsTeam[j].unassignBalanace = teamUnassign;
          totalTeamUnassign += teamUnassign;
          newFinalData[i].opsGroup.unassignBalanace += teamUnassign;
        }
      } else {
        // no team
        const opsTeamUser = await OpsGroup.findOne(
          { _id: opsGroupData.opsGroup.opsId },
          { userId: 1, _id: 0 },
        ).lean();
        const leaveBallanceData = await StaffSapData.find(
          { staff_Id: { $in: opsTeamUser.userId } },
          { ballotLeaveBalanced: 1, _id: 0 },
        ).lean();
        let teamUnassign = 0;

        leaveBallanceData.forEach((item) => {
          teamUnassign += Math.floor(item.ballotLeaveBalanced / leaveFormat);
        });
        newFinalData[i].opsGroup.unassignBalanace = teamUnassign;
        totalTeamUnassign += teamUnassign;
      }
    }

    return {
      success: true,
      data: newFinalData,
      finalTotalQuota,
      finalTotalApplied,
      finalTotalSuccessful,
      totalTeamUnassign,
    };
  }

  async ballotDetailAll(req, res) {
    // last round come first
    const ballotId = req.body.selectedBallotId;
    const allData = [];
    let quotaCal = [];

    let finalTotalQuota = 0;
    let finalTotalApplied = 0;
    let finalTotalSuccessful = 0;
    let totalTeamUnassign = 0;

    const promiseData = [];
    const ballotIdsListCall = async (i) => {
      if (i === 0) {
        const data = await this.getBallotDetail(ballotId[i], res);

        totalTeamUnassign = data.totalTeamUnassign;

        finalTotalQuota = data.finalTotalQuota;
        finalTotalApplied = data.finalTotalApplied;
        finalTotalSuccessful = data.finalTotalSuccessful;
        quotaCal.push({
          finalTotalQuota,
          finalTotalSuccessful,
          finalTotalApplied,
        });
        allData.push(data.data);
      } else {
        const data = await this.getBallotDetail(ballotId[i], res);

        quotaCal.push({
          finalTotalQuota: data.finalTotalQuota,
          finalTotalSuccessful: data.finalTotalSuccessful,
          finalTotalApplied: data.finalTotalApplied,
        });
        finalTotalQuota += data.finalTotalQuota;
        finalTotalApplied += data.finalTotalApplied;
        finalTotalSuccessful += data.finalTotalSuccessful;
        allData.push(data.data);
      }
    };

    for (let i = 0; i < ballotId.length; i += 1) {
      promiseData.push(ballotIdsListCall(i));
    }

    await Promise.all(promiseData);

    let actualData = {};

    for (let i = 0; i < allData.length; i += 1) {
      const dataObj = allData[i];

      if (i === 0) {
        actualData = dataObj;
      } else {
        for (let j = 0; j < dataObj.length; j += 1) {
          const obj = dataObj[j];
          const weekObj = obj.weekRangeSlot;

          for (const key of Object.keys(weekObj)) {
            if (Object.prototype.hasOwnProperty.call(weekObj, key)) {
              actualData[j].weekRangeSlot[key].value.teamQuota =
                weekObj[key].value.teamQuota;
              actualData[j].weekRangeSlot[key].value.appliedStaffQuota +=
                weekObj[key].value.appliedStaffQuota;
              actualData[j].weekRangeSlot[key].value.successStaffQuota +=
                weekObj[key].value.successStaffQuota;
            }
          }
        }
      }
    }
    quotaCal = quotaCal.reverse();
    let finalQuota = 0;

    quotaCal.forEach((item, index) => {
      if (index === 0) {
        finalQuota = item.finalTotalQuota;
      }
    });
    return res.json({
      success: true,
      data: actualData,
      finalTotalQuota: finalQuota,
      finalTotalApplied,
      finalTotalSuccessful,
      totalTeamUnassign,
    });
  }

  async ballotConsolidatedResult(req, res) {
    // last round come first
    const ballotId = req.body.selectedBallotId;
    const allData = [];
    let quotaCal = [];

    let finalTotalQuota = 0;
    let finalTotalApplied = 0;
    let finalTotalSuccessful = 0;

    const promiseData = [];
    const ballotIdListCall = async (i) => {
      if (i === 0) {
        const data = await this.getBallotDetail(ballotId[i], res);

        finalTotalQuota = data.finalTotalQuota;
        finalTotalApplied = data.finalTotalApplied;
        finalTotalSuccessful = data.finalTotalSuccessful;
        quotaCal.push({
          finalTotalQuota,
          finalTotalSuccessful,
          finalTotalApplied,
        });
        allData.push(data.data);
      } else {
        const data = await this.getBallotDetail(ballotId[i], res);

        quotaCal.push({
          finalTotalQuota: data.finalTotalQuota,
          finalTotalSuccessful: data.finalTotalSuccessful,
          finalTotalApplied: data.finalTotalApplied,
        });
        finalTotalQuota += data.finalTotalQuota;
        finalTotalApplied += data.finalTotalApplied;
        finalTotalSuccessful += data.finalTotalSuccessful;
        allData.push(data.data);
      }
    };

    for (let i = 0; i < ballotId.length; i += 1) {
      promiseData.push(ballotIdListCall(i));
    }

    await Promise.all(promiseData);
    quotaCal = quotaCal.reverse();
    let finalQuota = 0;
    let preQuota = 0;
    let preSuccess = 0;

    quotaCal.forEach((item, index) => {
      if (index === 0) {
        finalQuota = item.finalTotalQuota;
        preQuota = item.finalTotalQuota;
        preSuccess = item.finalTotalSuccessful;
      } else {
        finalQuota += item.finalTotalQuota - (preQuota - preSuccess);
        preQuota = item.finalTotalQuota;
        preSuccess += item.finalTotalSuccessful;
      }
    });
    return res.json({
      success: true,
      finalTotalQuota: finalQuota,
      finalTotalSuccess: preSuccess,
    });
  }

  async ballotDetailsByUsers(req, res) {
    try {
      const ballotId = req.params.id;

      const parentBallot = await Ballot.findOne({ _id: ballotId });
      const userList = [];

      if (!parentBallot) {
        return res.json({
          status: false,
          message: "Coulden't find requested ballot ",
        });
      }

      const applied = groupByA(parentBallot.appliedStaff, (item) => [
        item.userId,
        item.opsGroupId,
        item.opsTeamId,
      ]);

      const won = groupByAuto(parentBallot.wonStaff, (item) => [
        item.userId,
        item.opsGroupId,
        item.opsTeamId,
        item.isAutoAssign,
      ]);

      const promiseData3 = [];
      const appliedUserListCall = async (key) => {
        const user = {};

        user.user = await User.findOne(
          { _id: key.userId },
          { _id: 1, name: 1, staffId: 1 },
        );
        user.Ops = await OpsGroup.findOne(
          { _id: key.opsId },
          { _id: 1, opsGroupName: 1 },
        );
        if (key.teamId !== null || key.teamId !== undefined) {
          user.Team = await OpsTeam.findOne(
            { _id: key.teamId },
            { _id: 1, name: 1 },
          );
        } else {
          user.Team = {};
          user.Team.name = ' ';
        }

        user.userId = key.userId;
        user.opsId = key.opsId;
        user.teamId = key.teamId;
        user.applied = key.data.length;
        user.ballotId = parentBallot._id;
        user.ballotRound = 1;
        user.wonCount = 0;

        userList.push(user);
      };

      for (const key of applied) {
        promiseData3.push(appliedUserListCall(key));
      }
      await Promise.all(promiseData3);
      for (const ulist of userList) {
        for (let wins = 0; wins <= won.length - 1; wins += 1) {
          if (
            ulist.userId === won[wins].userId &&
            ulist.opsId === won[wins].opsId &&
            ulist.teamId === won[wins].teamId &&
            !won[wins].isAuto
          ) {
            ulist.wonCount = won[wins].data.length;
          }
        }
      }
      if (parentBallot.childBallots && parentBallot.childBallots.length > 0) {
        const promiseData2 = [];
        const childBallotsListCall = async (child) => {
          const childBallot = await Ballot.findOne({
            _id: parentBallot.childBallots[child],
          });

          if (!childBallot) {
            return res.json({
              status: false,
              message: "Coulden't find requested ballot ",
            });
          }

          if (childBallot.isAutoAssign) {
            const won1 = groupByAuto(childBallot.wonStaff, (item) => [
              item.userId,
              item.opsGroupId,
              item.opsTeamId,
              item.isAutoAssign,
            ]);

            const promiseData1 = [];
            const wonListCall = async (key) => {
              const user = {};

              user.user = await User.findOne(
                { _id: key.userId },
                { _id: 1, name: 1, staffId: 1 },
              );
              user.Ops = await OpsGroup.findOne(
                { _id: key.opsId },
                { _id: 1, opsGroupName: 1 },
              );
              if (key.teamId !== null || key.teamId !== undefined) {
                user.Team = await OpsTeam.findOne(
                  { _id: key.teamId },
                  { _id: 1, name: 1 },
                );
              } else {
                user.Team = {};
                user.Team.name = ' ';
              }

              user.userId = key.userId;
              user.opsId = key.opsId;
              user.teamId = key.teamId;
              user.applied = 0;
              user.ballotId = childBallot._id;
              user.ballotRound = childBallot.ballotRound + 1;
              user.wonCount = key.data.length;
              userList.push(user);
            };

            for (const key of won1) {
              promiseData1.push(wonListCall(key));
            }

            await Promise.all(promiseData1);
          } else {
            const applied1 = groupByA(childBallot.appliedStaff, (item) => [
              item.userId,
              item.opsGroupId,
              item.opsTeamId,
            ]);
            const won2 = groupByAuto(childBallot.wonStaff, (item) => [
              item.userId,
              item.opsGroupId,
              item.opsTeamId,
              item.isAutoAssign,
            ]);

            const promiseData = [];
            const appliedCall = async (key) => {
              const user = {};

              user.user = await User.findOne(
                { _id: key.userId },
                { _id: 1, name: 1, staffId: 1 },
              );
              user.Ops = await OpsGroup.findOne(
                { _id: key.opsId },
                { _id: 1, opsGroupName: 1 },
              );
              if (key.teamId !== null || key.teamId !== undefined) {
                user.Team = await OpsTeam.findOne(
                  { _id: key.teamId },
                  { _id: 1, name: 1 },
                );
              } else {
                user.Team = {};
                user.Team.name = ' ';
              }

              user.userId = key.userId;
              user.opsId = key.opsId;
              user.teamId = key.teamId;
              user.applied = key.data.length;
              user.ballotId = childBallot._id;
              user.ballotRound = childBallot.ballotRound + 1;
              user.wonCount = 0;
              userList.push(user);
            };

            for (const key of applied1) {
              promiseData.push(appliedCall(key));
            }

            await Promise.all(promiseData);

            for (const ulist of userList) {
              for (let wins = 0; wins <= won2.length - 1; wins += 1) {
                if (
                  ulist.userId === won2[wins].userId &&
                  ulist.opsId === won2[wins].opsId &&
                  ulist.teamId === won2[wins].teamId &&
                  !won2[wins].isAuto
                ) {
                  ulist.wonCount = won2[wins].data.length;
                }
              }
            }
          }

          return null;
        };

        for (
          let child = 0;
          child <= parentBallot.childBallots.length - 1;
          child += 1
        ) {
          promiseData2.push(childBallotsListCall(child));
        }

        await Promise.all(promiseData2);

        return res.send({ userlist: userList });
      }

      return res.send({ userlist: userList });
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong', e });
    }
  }

  async addAsBallotAdmin(req, res) {
    try {
      const users = req.body.userIds;

      await User.updateMany(
        { isBallotAdmin: true },
        { $set: { isBallotAdmin: false } },
      );

      const promiseData = [];
      const usersListCall = async (id) => {
        await User.findOneAndUpdate(
          { _id: id },
          { $set: { isBallotAdmin: true } },
        );
      };

      for (let u = 0; u <= users.length - 1; u += 1) {
        promiseData.push(usersListCall(users[u].toString()));
      }

      await Promise.all(promiseData);

      return res.json({ status: true, message: 'Saved Successfully.' });
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong', e });
    }
  }

  async getballotAdmins1(req, res) {
    try {
      const Users = await User.find(
        { isBallotAdmin: true },
        { _id: 1, name: 1, staffId: 1 },
      );

      return res.json({
        status: true,
        data: Users,
        message: 'Users retrieved successfully.',
      });
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong', e });
    }
  }

  async getBallotPerStaffData(req, res) {
    const { body } = req;
    const ballot = await Ballot.findOne({ _id: body.id });

    if (!ballot) {
      return res.json({
        status: false,
        message: 'requested ballot for this user could not found',
      });
    }

    const resObj = {};

    resObj.ballotStartDate = ballot.ballotStartDate;
    resObj.ballotEndDate = ballot.ballotEndDate;

    resObj.leaveType = ballot.leaveType;
    resObj.maxConsecutiveBallot = ballot.maxConsecutiveBallot;
    resObj.applicationCloseDateTime = ballot.applicationCloseDateTime;
    resObj.opsGroup = body.opsGroup;

    const applied = ballot.appliedStaff.filter(
      (x) => x.userId.toString() === body.userId.toString(),
    );
    const won = ballot.wonStaff.filter(
      (x) => x.userId.toString() === body.userId.toString(),
    );
    const winSlots = [];

    if (applied.length > 0 && won.length > 0) {
      for (let a = 0; a <= applied.length - 1; a += 1) {
        const slot = applied[a].weekNo;
        const oneSlot = {};

        oneSlot.start = ballot.weekRange[slot].start;
        oneSlot.end = ballot.weekRange[slot].end;
        oneSlot.weekNo = slot;
        oneSlot.staffStatus = '';
        if (ballot.isConduct) {
          oneSlot.staffStatus = 'Unsuccessful';
        }

        for (let w = 0; w <= won.length - 1; w += 1) {
          if (
            applied[a].userId.toString() === won[w].userId.toString() &&
            applied[a].weekNo === won[w].weekNo
          ) {
            oneSlot.staffStatus = 'Successful';
          }
        }
        winSlots.push(oneSlot);
      }
    }

    if (ballot.isAutoAssign === true) {
      const result = won.filter((staff) => staff.isAutoAssign === true);

      if (result.length > 0) {
        for (let r = 0; r <= result.length - 1; r += 1) {
          const slot = result[r].weekNo;
          const oneSlot = {};

          oneSlot.start = ballot.weekRange[slot].start;
          oneSlot.end = ballot.weekRange[slot].end;
          oneSlot.weekNo = slot;
          oneSlot.staffStatus = 'autoAssigned';
          winSlots.push(oneSlot);
        }
      }
    }

    if (applied.length > 0 && !won.length > 0) {
      for (let a = 0; a <= applied.length - 1; a += 1) {
        const slot = applied[a].weekNo;
        const oneSlot = {};

        oneSlot.start = ballot.weekRange[slot].start;
        oneSlot.end = ballot.weekRange[slot].end;
        oneSlot.weekNo = slot;
        oneSlot.staffStatus = '';
        if (ballot.isResultRelease) {
          oneSlot.staffStatus = 'Unsuccessful';
        }

        winSlots.push(oneSlot);
      }
    }

    resObj.won = winSlots;
    return res.json({
      status: true,
      data: resObj,
      message: 'successfully retrived ballot data',
    });
  }

  async cancelBallotAll(req, res) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errorMessage: errors.array() });
    }

    const { id } = req.params;
    const updateLeaveBy = [];
    const ballot = await Ballot.findOne(
      { _id: id },
      {
        ballotName: 1,
        wonStaff: 1,
        leaveConfiguration: 1,
        childBallots: 1,
        opsGroupId: 1,
        userFrom: 1,
        appliedStaff: 1,
        isConduct: 1,
        ballotStartDate: 1,
        isResultRelease: 1,
        leaveType: 1,
      },
    );
    let leaveFormat = 5;

    if (ballot.leaveConfiguration === 2) {
      leaveFormat = 6;
    } else if (ballot.leaveConfiguration === 3) {
      leaveFormat = 7;
    }

    if (ballot.leaveType === 2) {
      leaveFormat = 1;
    }

    if (!ballot) {
      return res.json({
        status: false,
        message: 'Problem receiving ballot id',
      });
    }

    let wonStaff;

    if (ballot.isConduct) {
      wonStaff = groupBy(ballot.wonStaff, 'userId');
      if (ballot.isResultRelease) {
        await LeaveApplied.deleteMany({ ballotId: ballot._id });
      }
    } else {
      wonStaff = groupBy(ballot.appliedStaff, 'userId');
    }

    for (const key of Object.keys(wonStaff)) {
      const keyP = key;

      const keyV = wonStaff[key].length;
      const valueOfKey = leaveFormat * keyV;

      updateLeaveBy.push({ key: keyP, leave: valueOfKey, data: wonStaff[key] });
    }

    if (ballot.childBallots && ballot.childBallots.length > 0) {
      const promiseData = [];
      const childBallotsListCall = async (cid) => {
        const cBallot = await Ballot.findOne(
          { _id: cid },
          {
            appliedStaff: 1,
            wonStaff: 1,
            leaveConfiguration: 1,
            isConduct: 1,
            isResultRelease: 1,
          },
        );
        let cWOn;

        if (cBallot.isConduct) {
          cWOn = groupBy(cBallot.wonStaff, 'userId');
          if (cBallot.isResultRelease) {
            await LeaveApplied.deleteMany({ ballotId: cBallot._id });
          }
        } else {
          cWOn = groupBy(cBallot.appliedStaff, 'userId');
        }

        for (const keyc of Object.keys(cWOn)) {
          const keyPP = keyc;
          const keyVP = cWOn[keyc].length;
          const valueOfKeyP = leaveFormat * keyVP;

          updateLeaveBy.push({ key: keyPP, leave: valueOfKeyP, data: keyVP });
        }
      };

      for (let i = 0; i <= ballot.childBallots.length - 1; i += 1) {
        promiseData.push(childBallotsListCall(ballot.childBallots[i]));
      }

      await Promise.all(promiseData);
    }

    const annL = await leaveType.findOne({
      companyId: req.user.companyId,
      isActive: true,
      name: 'Annual Leave',
    });
    const fYear = new Date(ballot.ballotStartDate).getFullYear();

    const promiseData1 = [];
    const updateLeaveByCall = async (user) => {
      await this.managePlanLeaveCancel(user.key, user.leave, annL._id, fYear);
    };

    for (let i = 0; i < updateLeaveBy.length; i += 1) {
      promiseData1.push(updateLeaveByCall(updateLeaveBy[i]));
    }

    await Promise.all(promiseData1);

    await Ballot.update(
      { _id: id },
      { $set: { isCanceled: true, staffLeave: [], wonStaff: [] } },
    );

    this.deleteEvent(id);

    const promiseData = [];
    const childBallotsCall = async (i) => {
      this.deleteEvent(ballot.childBallots[i]);
      await Ballot.update(
        { _id: ballot.childBallots[i] },
        { $set: { isCanceled: true, staffLeave: [], wonStaff: [] } },
      );
    };

    for (let i = 0; i <= ballot.childBallots.length - 1; i += 1) {
      promiseData.push(childBallotsCall(i));
    }

    await Promise.all(promiseData);

    ballotCancelledNotifications(ballot);
    return res
      .status(201)
      .json({ status: true, message: 'Ballot Cancelled successfully.' });
  }

  async managePlanLeaveCancel(
    userId,
    leaveQuota,
    leaveTypeId,
    startYear = new Date().getFullYear(),
  ) {
    const updateStaffLeave = await staffLeave.findOneAndUpdate(
      {
        userId,
        leaveDetails: {
          $elemMatch: { year: startYear, leaveTypeId },
        },
      },
      {
        $inc: {
          'leaveDetails.$.planQuota': leaveQuota,
          'leaveDetails.$.request': leaveQuota,
        },
      },
    );

    return updateStaffLeave;
  }

  async checkIfHasParent(ballotid) {
    const currentBallot = await Ballot.findOne(
      { _id: ballotid },
      { parentBallot: 1, childBallots: 1 },
    );

    if (!currentBallot) {
      logInfo('Adding in Future');
    } else {
      if (currentBallot.parentBallot) {
        return this.checkIfHasParent(currentBallot.parentBallot);
      }

      if (currentBallot.childBallots && currentBallot.childBallots.length > 0) {
        const list = [];

        list.push(currentBallot._id.toString());
        for (let i = 0; i <= currentBallot.childBallots.length - 1; i += 1) {
          list.push(currentBallot.childBallots[i].toString());
        }
        return list;
      }
    }

    return null;
  }

  async getUserLeavePlans(req, res) {
    try {
      let user = req.user._id;

      user = '5f5fdde0f126bb068ad3a570';
      const todayIs = new Date();

      const allocatedLeaves = await userLeaves.find({
        userId: user,
        type: { $in: [1, 2, 3] },
        status: { $in: ['Allocated', 'Balloted'] },
      });
      const thsUser = await User.findOne(
        { _id: user },
        { isLeaveSwapAllowed: 1, name: 1 },
      );

      let weeksToApply = 1;
      const pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select('opsGroup')
        .lean();

      if (pageSettingData.opsGroup.minWeeksBeforeSwop) {
        weeksToApply = pageSettingData.opsGroup.minWeeksBeforeSwop;
      }

      const totaldays = weeksToApply * 7;
      const ballots = [];
      const swopingsFrom = await swopRequests.find(
        { userFrom: req.user._id, requestStatus: 1 },
        { requestStatus: 1, userFrom: 1, leaveFrom: 1, leaveTo: 1 },
      );
      const swopingsTo = await swopRequests.find(
        { userTo: req.user._id, requestStatus: 1 },
        { userTo: 1, requestStatus: 1, leaveFrom: 1, leaveTo: 1 },
      );
      const opsGrp = await OpsGroup.findOne(
        { userId: user, isDelete: false },
        { swopSetup: 1 },
      );

      if (allocatedLeaves.length > 0) {
        const promiseData = [];
        const allocatedLeavesCall = async (a) => {
          const leave = {};

          const startdd = new Date(allocatedLeaves[a].fromdate);

          const enddd = new Date(allocatedLeaves[a].todate);

          const days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));

          leave.days = days + 1;
          leave.ballotStartDate = allocatedLeaves[a].fromdate;
          leave.ballotEndDate = allocatedLeaves[a].todate;
          leave.leaveId = allocatedLeaves[a]._id;
          if (allocatedLeaves[a].type === 1) {
            leave.leaveType = 5;
          } else {
            leave.leaveType = allocatedLeaves[a].type;
          }

          leave.startdate = startdd;
          if (opsGrp && opsGrp.swopSetup) {
            leave.swapRequest = parseInt(opsGrp.swopSetup, 10);
            if (leave.swapRequest === 1 || leave.swapRequest === 2) {
              if (thsUser.isLeaveSwapAllowed === true) {
                leave.swapRequest = 0;
              }
            }
          }

          let daysleft = Math.floor(
            (startdd - todayIs) / (1000 * 60 * 60 * 24),
          );

          daysleft += 1;

          if (daysleft < 0 || daysleft < totaldays) {
            leave.swapRequest = 0;
          }

          if (swopingsFrom.length > 0) {
            // SwoppingFrom means - I have sent this swap request for this slot.
            const swopping = swopingsFrom.filter((qw) => {
              if (qw.leaveFrom) {
                return (
                  qw.leaveFrom.toString() === allocatedLeaves[a]._id.toString()
                );
              }

              return null;
            });

            if (swopping.length > 0) {
              leave.swoppingFrom = true;
            }
          }

          if (swopingsTo.length > 0) {
            // SwoppingFrom means - I have sent this swap request for this slot.
            const swopping = swopingsTo.filter((qw) => {
              if (qw.leaveTo) {
                return (
                  qw.leaveTo.toString() === allocatedLeaves[a]._id.toString()
                );
              }

              return null;
            });

            if (swopping.length > 0) {
              leave.swoppingTo = true;
              leave.swoppingToCount = swopping.length;
            }
          }

          const leaveAppliedFor = await leaveApplications.find({
            leaveId: allocatedLeaves[a]._id,
            userId: req.user._id,
          });

          if (leaveAppliedFor.length > 0) {
            leave.isLeaveApplied = true;
          } else {
            leave.isLeaveApplied = false;
          }

          ballots.push(leave);
        };

        for (let a = 0; a <= allocatedLeaves.length - 1; a += 1) {
          promiseData.push(allocatedLeavesCall(a));
        }

        await Promise.all(promiseData);
      }

      const BB = ballots.sort((a, b) => b.startdate - a.startdate);

      BB.reverse();
      return res.status(201).json({
        success: true,
        data: BB,
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong',
      });
    }
  }

  async exportBallotByUser(req, res) {
    try {
      const ballotId = req.params.id;
      const parentBallot = await Ballot.findOne({ _id: ballotId }).populate([
        {
          path: 'opsGroupId',
          select: 'opsGroupName opsTeamId userId',
          populate: [
            {
              path: 'opsTeamId',
              select: 'name userId',
            },
            {
              path: 'userId',
              select: 'staffId name parentBussinessUnitId',
              populate: [
                {
                  path: 'parentBussinessUnitId',
                  select: 'name',
                  populate: {
                    path: 'sectionId',
                    select: 'name',
                    populate: {
                      path: 'departmentId',
                      select: 'name',
                      populate: {
                        path: 'companyId',
                        select: 'name',
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      ]);

      let userList = [];

      if (!parentBallot) {
        return res.json({
          status: false,
          message: "Coulden't find requested ballot ",
        });
      }

      let totalUserList = [];

      for (
        let opIndexU = 0;
        opIndexU < parentBallot.opsGroupId.length;
        opIndexU += 1
      ) {
        const opUsers = JSON.parse(
          JSON.stringify(parentBallot.opsGroupId[opIndexU].userId),
        );

        for (let ij = 0; ij < opUsers.length; ij += 1) {
          opUsers[ij].Ops = {
            _id: parentBallot.opsGroupId[opIndexU]._id,
            opsGroupName: parentBallot.opsGroupId[opIndexU].opsGroupName,
          };

          const uuId = opUsers[ij]._id;
          const oTeam = {};

          parentBallot.opsGroupId[opIndexU].opsTeamId.forEach((item) => {
            const isFound = item.userId.filter(
              (u) => u.toString() === uuId.toString(),
            );

            if (isFound && isFound.length > 0) {
              oTeam._id = item._id;
              oTeam.name = item.name;
            }
          });
          opUsers[ij].Team = oTeam;
        }

        totalUserList = [...totalUserList, ...opUsers];
      }

      const ballotStart = moment(parentBallot.ballotStartDate).format(
        'DD-MM-YYYY',
      );
      const ballotEnd = moment(parentBallot.ballotEndDate).format('DD-MM-YYYY');
      let applied = groupByA(parentBallot.appliedStaff, (item) => [
        item.userId,
        item.opsGroupId,
        item.opsTeamId,
        parentBallot.ballotRound,
      ]);

      let won = groupByA(parentBallot.wonStaff, (item) => [
        item.userId,
        item.opsGroupId,
        item.opsTeamId,
        parentBallot.ballotRound,
      ]);

      if (parentBallot.childBallots && parentBallot.childBallots.length > 0) {
        const promiseData = [];
        const parentBallotListCall = async (child) => {
          const childBallot = await Ballot.findOne({
            _id: parentBallot.childBallots[child],
          });

          if (!childBallot) {
            return res.json({
              status: false,
              message: "Coulden't find requested ballot ",
            });
          }

          const appliedC = groupByA(childBallot.appliedStaff, (item) => [
            item.userId,
            item.opsGroupId,
            item.opsTeamId,
            childBallot.ballotRound,
          ]);

          applied = applied.concat(appliedC);
          const wonC = groupByA(childBallot.wonStaff, (item) => [
            item.userId,
            item.opsGroupId,
            item.opsTeamId,
            childBallot.ballotRound,
          ]);

          won = won.concat(wonC);
          return null;
        };

        for (
          let child = 0;
          child <= parentBallot.childBallots.length - 1;
          child += 1
        ) {
          promiseData.push(parentBallotListCall(child));
        }

        await Promise.all(promiseData);
      }

      const appliedData = groupBySingle(applied);
      const appliedKeys = Object.keys(appliedData);
      const appliedKeysTemp = Object.keys(appliedData);
      const wonData = groupBySingle(won);
      const wonKeys = Object.keys(wonData);
      const finalData = {};

      if (wonKeys && wonKeys.length > 0) {
        for (let i = 0; i < wonKeys.length; i += 1) {
          const uId = wonKeys[i];

          if (appliedData[uId]) {
            const index = appliedKeysTemp.indexOf(uId);

            if (index !== -1) {
              appliedKeysTemp.splice(index, 1);
            }

            finalData[uId] = {};
            for (let j = 0; j < appliedData[uId].length; j += 1) {
              if (j === 0) {
                finalData[uId] = appliedData[uId][j];
              } else {
                finalData[uId].data = finalData[uId].data.concat(
                  appliedData[uId][j].data,
                );
              }
            }

            for (let j = 0; j < wonData[uId].length; j += 1) {
              if (j === 0) {
                finalData[uId].wonData = wonData[uId][j].data;
              } else {
                finalData[uId].wonData = finalData[uId].wonData.concat(
                  wonData[uId][j].data,
                );
              }
            }
          } else {
            finalData[uId] = {};
            finalData[uId].data = [];
            for (let j = 0; j < wonData[uId].length; j += 1) {
              if (j === 0) {
                finalData[uId].wonData = wonData[uId][j].data;
              } else {
                finalData[uId].wonData = finalData[uId].wonData.concat(
                  wonData[uId][j].data,
                );
              }
            }
          }
        }
      } else {
        for (let i = 0; i < appliedKeys.length; i += 1) {
          const uId = appliedKeys[i];

          if (appliedData[uId]) {
            const index = appliedKeysTemp.indexOf(uId);

            if (index !== -1) {
              appliedKeysTemp.splice(index, 1);
            }

            finalData[uId] = {};
            for (let j = 0; j < appliedData[uId].length; j += 1) {
              if (j === 0) {
                finalData[uId] = appliedData[uId][j];
              } else {
                finalData[uId].data = finalData[uId].data.concat(
                  appliedData[uId][j].data,
                );
              }
            }
          }
        }
      }

      if (appliedKeysTemp.length > 0) {
        for (let i = 0; i < appliedKeysTemp.length; i += 1) {
          const uId = appliedKeysTemp[i];

          if (appliedData[uId]) {
            finalData[uId] = {};
            for (let j = 0; j < appliedData[uId].length; j += 1) {
              if (j === 0) {
                finalData[uId] = appliedData[uId][j];
              } else {
                finalData[uId].data = finalData[uId].data.concat(
                  appliedData[uId][j].data,
                );
              }
            }
          }
        }
      }

      let maxWin = 0;
      let maxApplied = 0;

      for (let uIndex = 0; uIndex < totalUserList.length; uIndex += 1) {
        const currentOpsUser = totalUserList[uIndex];

        if (finalData[currentOpsUser._id]) {
          finalData[currentOpsUser._id].user = {
            _id: currentOpsUser._id,
            parentBussinessUnitId: currentOpsUser.parentBussinessUnitId,
            staffId: currentOpsUser.staffId,
            name: currentOpsUser.name,
          };
          finalData[currentOpsUser._id].Ops = currentOpsUser.Ops;
          finalData[currentOpsUser._id].Team = currentOpsUser.Team;
        } else {
          finalData[currentOpsUser._id] = {};
          finalData[currentOpsUser._id].user = {
            _id: currentOpsUser._id,
            parentBussinessUnitId: currentOpsUser.parentBussinessUnitId,
            staffId: currentOpsUser.staffId,
            name: currentOpsUser.name,
          };
          finalData[currentOpsUser._id].Ops = currentOpsUser.Ops;
          finalData[currentOpsUser._id].Team = currentOpsUser.Team;
          finalData[currentOpsUser._id].data = [];
          finalData[currentOpsUser._id].wonData = [];
        }
      }
      for (const key of Object.keys(finalData)) {
        const user = {};

        user.appliedData = finalData[key].data;
        user.Ops = finalData[key].Ops;
        user.Team = finalData[key].Team;
        user.user = finalData[key].user;
        if (maxApplied < user.appliedData.length) {
          maxApplied = user.appliedData.length;
        }

        user.wonData = finalData[key].wonData;
        if (user.wonData && maxWin < user.wonData.length) {
          maxWin = user.wonData.length;
        }

        user.ballotPeriod = `${ballotStart} to ${ballotEnd}`;
        userList.push(user);
      }

      const dataObj = await this.getStaffLeave(userList, req.user.companyId);

      userList = dataObj.userList;
      const leaveTypeArr = dataObj.leaveTypeArrFinal;

      return this.sendDetailsDataExport(
        userList,
        res,
        maxWin,
        maxApplied,
        parentBallot.weekRange,
        leaveTypeArr,
      );
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong',
      });
    }
  }

  async getStaffLeave(userList, companyId) {
    const annualLeave = await leaveType.findOne({
      name: 'Annual Leave',
      isActive: true,
      companyId,
    });

    if (!annualLeave) {
      return { userList, leaveTypeArrFinal: [] };
    }

    const annualLeaveId = annualLeave._id;
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const prevYear = currentYear - 1;
    const yearArr = [prevYear, currentYear, nextYear];
    const leaveTypeArr = [];

    const promiseData = [];
    const staffLeaveListCall = async (data) => {
      const { user } = data;

      if (user && user._id) {
        const staffLeaveData = await staffLeave
          .findOne({ userId: user._id, isActive: true })
          .populate([
            {
              path: 'leaveDetails.leaveTypeId',
              select: 'name',
            },
          ])
          .sort({ 'leaveDetails.leaveTypeId.name': 1, 'leaveDetails.year': 1 });

        if (staffLeaveData) {
          for (let j = 0; j < staffLeaveData.leaveDetails.length; j += 1) {
            const leaveDetails = staffLeaveData.leaveDetails[j];

            if (
              annualLeaveId.toString() ===
              leaveDetails.leaveTypeId._id.toString()
            ) {
              const leaveName = leaveDetails.leaveTypeId.name;
              const { year } = leaveDetails;
              const { planQuota } = leaveDetails;

              if (yearArr.includes(year)) {
                if (!leaveTypeArr.includes(leaveName)) {
                  leaveTypeArr.push(leaveName);
                }

                data[`${leaveName} Plan Quota(${year})`] = leaveDetails.total;
                data[`${leaveName} Plan Quota Balance(${year})`] = planQuota;
              }
            }
          }
        }
      }
    };

    for (let i = 0; i < userList.length; i += 1) {
      promiseData.push(staffLeaveListCall(userList[i]));
    }

    await Promise.all(promiseData);

    const leaveTypeArrFinal = [];

    for (let ik = 0; ik < leaveTypeArr.length; ik += 1) {
      const name = leaveTypeArr[ik];

      for (let y = 0; y < yearArr.length; y += 1) {
        leaveTypeArrFinal.push(`${name} Plan Quota(${yearArr[y]})`);
        leaveTypeArrFinal.push(`${name} Plan Quota Balance(${yearArr[y]})`);
      }
    }
    return { userList, leaveTypeArrFinal };
  }

  async sendDetailsDataExport(
    results,
    res,
    maxSuccess,
    maxApplied,
    week,
    leaveTypeArr,
  ) {
    const csvData = [];
    let keys = [
      'Staff Name',
      'StaffId',
      'Business Unit Name',
      'Ops Group',
      'Ops Team',
      'Ballot Period',
      'Total Applied Slot',
    ];

    for (let iii = 1; iii <= maxApplied; iii += 1) {
      keys.push(`Applied Dates ${iii}`);
    }
    keys.push('Successfull Ballots');
    for (let iii = 1; iii <= maxSuccess; iii += 1) {
      keys.push(`Leave Dates ${iii}`);
    }
    keys = keys.concat(leaveTypeArr);
    for (let ji = 0; ji < results.length; ji += 1) {
      const item = results[ji];

      if (item.user) {
        const appliedRound = [];

        const obj = {};

        obj['Staff Name'] = item.user.name;
        obj.StaffId = item.user.staffId;
        obj[
          'Business Unit Name'
        ] = `${item.user.parentBussinessUnitId.sectionId.departmentId.companyId.name}->${item.user.parentBussinessUnitId.sectionId.departmentId.name}->${item.user.parentBussinessUnitId.sectionId.name}->${item.user.parentBussinessUnitId.name}`;
        obj['Ops Group'] = item.Ops.opsGroupName;
        obj['Ops Team'] = item.Team.name;
        obj['Ballot Period'] = item.ballotPeriod;
        for (let k = 1; k <= maxApplied; k += 1) {
          if (item.appliedData.length >= k) {
            const aa = item.appliedData[k - 1];
            const sNo = aa.weekNo + 1;

            obj[`Applied Dates ${k}`] = `(slot${sNo}) ${moment(
              new Date(week[aa.weekNo].start),
            ).format('DD-MM-YYYY')} - ${moment(
              new Date(week[aa.weekNo].end),
            ).format('DD-MM-YYYY')}`;
            const round = parseInt(aa.ballotRound, 10) - 1;
            let prev = appliedRound[round];

            if (prev) {
              prev += 1;
            } else {
              prev = 1;
            }

            appliedRound[round] = prev;
          } else {
            obj[`Applied Dates ${k}`] = '-';
          }
        }
        let appliedRoundStr = '';

        for (let ap = 1; ap <= appliedRound.length; ap += 1) {
          if (appliedRound[ap - 1]) {
            appliedRoundStr = `${appliedRoundStr}${
              appliedRound[ap - 1]
            } R(${ap})  `;
          }
        }
        obj['Total Applied Slot'] = appliedRoundStr;
        obj['Successfull Ballots'] = item.wonData ? item.wonData.length : 0;
        for (let k = 1; k <= maxSuccess; k += 1) {
          if (item.wonData && item.wonData.length >= k) {
            const aa = item.wonData[k - 1];

            obj[`Leave Dates ${k}`] = `${moment(
              new Date(week[aa.weekNo].start),
            ).format('DD-MM-YYYY')} - ${moment(
              new Date(week[aa.weekNo].end),
            ).format('DD-MM-YYYY')} R(${aa.ballotRound})`;
          } else {
            obj[`Leave Dates ${k}`] = '-';
          }
        }
        for (let m = 0; m < leaveTypeArr.length; m += 1) {
          const nn = leaveTypeArr[m];

          if (item[nn] || item[nn] === 0) {
            obj[nn] = item[nn];
          } else {
            obj[nn] = '-';
          }
        }
        csvData.push(obj);
      }
    }
    const csv1 = await json2csv(csvData, keys);

    res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
    res.set('Content-Type', 'application/csv');
    res.status(200).json({ csv: csv1, noData: true });
    // });
  }

  async saveBallotAsDraft(req, res) {
    try {
      // check required filed
      req.body.createdBy = req.user._id;
      req.body.companyId = req.user.companyId;
      const data = req.body;

      if (data.applicationOpenDateTime) {
        data.applicationOpenDateTime = moment(
          data.applicationOpenDateTime,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }

      if (data.applicationCloseDateTime) {
        data.applicationCloseDateTime = moment(
          data.applicationCloseDateTime,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }

      if (data.ballotStartDate) {
        data.ballotStartDate = moment(
          data.ballotStartDate,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }

      if (data.ballotEndDate) {
        data.ballotEndDate = moment(data.ballotEndDate, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      }

      if (data.resultRelease && data.resultRelease === '1') {
        data.resultReleaseDateTime = moment(
          data.resultReleaseDateTime,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }

      return new Ballot(data)
        .save()
        .then((ressss) => {
          let message = 'Ballot successfully created';

          if (data.isDraft) {
            message = 'Ballot saved as a draft';
          } else {
            this.ballotEvent(ressss, 'createBallot', false);
            // notification for publish ballot
          }

          if (data.parentBallot) {
            this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
          }

          return res.json({ status: true, message });
        })
        .catch((err) =>
          res.json({ status: false, message: 'Something went wrong', err }),
        );
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong1', e });
    }
  }

  async getBallotDataToAutoAssing(req, res) {
    try {
      const { id } = req.params;
      const ballot = await Ballot.findOne({ _id: id });

      if (!ballot) {
        return res.json({
          status: false,
          message: "Couldn't find requested ballot. ",
        });
      }

      if (ballot.userFrom === 2) {
        // for BU do it later
      } else {
        let leaveFormat = 5;
        const startYear = new Date(ballot.ballotStartDate).getFullYear();

        if (ballot.leaveConfiguration === 2) {
          leaveFormat = 6;
        } else if (ballot.leaveConfiguration === 3) {
          leaveFormat = 7;
        }

        if (ballot.leaveType === 2) {
          leaveFormat = 1;
        }

        const slots = ballot.slotCreation;

        const promiseData2 = [];
        const totalBallotBalanceListCall = async (i) => {
          let totalQuota = 0;
          const opsGrpid = slots[i].opsGroup.opsId;

          slots[i].totalBallotBalance = 0;

          slots[i].opsGroup.unassignBalanace = 0;
          slots[i].opsGroup.BallotBalance = 0;
          let opsQuota = 0;
          let teamQuota = 0;
          const opsGroupUser = await OpsGroup.findOne(
            { _id: slots[i].opsGroup.opsId },
            { userId: 1, _id: 0 },
          ).lean();
          const leaveBallanceData = await this.checkIsAnnualLeaveArr(
            opsGroupUser.userId,
            req.user.companyId,
            startYear,
          );
          let opsUnassign = 0;

          leaveBallanceData.staffArr.forEach((item) => {
            opsUnassign += Math.floor(
              item.leaveTypeData.planQuota / leaveFormat,
            );
          });
          slots[i].opsGroup.unassignBalanace = opsUnassign;

          const promiseData1 = [];
          const unassignBalanaceCall = async (j) => {
            let hasTeam = false;
            const currentweek = `${j}A`;

            const found = ballot.wonStaff.filter(
              (element) =>
                element.opsGroupId.toString() === opsGrpid.toString() &&
                element.weekNo === j,
            );

            slots[i].weekRangeSlot[currentweek].value -= found.length;
            opsQuota = slots[i].weekRangeSlot[currentweek].value;
            const currentOpsSlotValueIs =
              slots[i].weekRangeSlot[currentweek].value;

            // Ops Team is there
            let slotValueOfTeams = 0;

            if (slots[i].opsTeam.length > 0) {
              hasTeam = true;

              const promiseData = [];
              const opsTeamListCall = async (d) => {
                slots[i].opsTeam[d].unassignBalanace = 0;
                const currentweek1 = `OG${j}OT${d.toString()}`;

                const found1 = ballot.wonStaff.filter((element) => {
                  if (element.opsTeamId) {
                    return (
                      element.opsTeamId.toString() ===
                        slots[i].opsTeam[d]._id.toString() &&
                      element.weekNo === j
                    );
                  }

                  return (
                    element.opsGroupId === opsGrpid &&
                    !element.opsTeamId &&
                    element.weekNo === j
                  );
                });

                slots[i].weekRangeSlot[currentweek1].value -= found1.length;

                slotValueOfTeams += slots[i].weekRangeSlot[currentweek1].value;

                teamQuota += slots[i].weekRangeSlot[currentweek1].value;
                if (slots[i].opsTeam[d].BallotBalance) {
                  slots[i].opsTeam[d].BallotBalance +=
                    slots[i].weekRangeSlot[currentweek1].value;
                } else {
                  slots[i].opsTeam[d].BallotBalance = 0;
                  slots[i].opsTeam[d].BallotBalance +=
                    slots[i].weekRangeSlot[currentweek1].value;
                }

                // to find Unassigned per team

                const opsTeamUser = await OpsTeam.findOne(
                  { _id: slots[i].opsTeam[d]._id },
                  { userId: 1, _id: 0 },
                ).lean();
                const leaveBallanceData1 = await this.checkIsAnnualLeaveArr(
                  opsTeamUser.userId,
                  req.user.companyId,
                  startYear,
                );
                let teamUnassign = 0;

                leaveBallanceData1.staffArr.forEach((item) => {
                  teamUnassign += Math.floor(
                    item.leaveTypeData.ballotLeaveBalanced / leaveFormat,
                  );
                });

                slots[i].opsTeam[d].unassignBalanace = teamUnassign;
                slots[i].opsTeam[d].ratioForBalnceQuota = RATIO;
              };

              for (let d = 0; d <= slots[i].opsTeam.length - 1; d += 1) {
                promiseData.push(opsTeamListCall(d));
              }

              await Promise.all(promiseData);
            }

            if (hasTeam) {
              // if has team is true.
              if (slotValueOfTeams > currentOpsSlotValueIs) {
                slots[i].opsGroup.BallotBalance += currentOpsSlotValueIs;
              } else {
                slots[i].opsGroup.BallotBalance += slotValueOfTeams;
              }
            } else {
              // if hasteam is false i.e only opsgroup is there.
              slots[i].opsGroup.BallotBalance += currentOpsSlotValueIs;
            }

            slots[i].opsGroup.ratioForBalnceQuota = RATIO;

            if (opsQuota > teamQuota) {
              totalQuota += teamQuota;
            } else {
              totalQuota += opsQuota;
            }

            if (teamQuota === 0) {
              totalQuota += opsQuota;
            }

            slots[i].totalBallotBalance = totalQuota;
          };

          for (let j = 0; j <= slots[i].arr.length - 1; j += 1) {
            promiseData1.push(unassignBalanaceCall(j));
          }

          await Promise.all(promiseData1);
        };

        for (let i = 0; i <= slots.length - 1; i += 1) {
          promiseData2.push(totalBallotBalanceListCall(i));
        }

        await Promise.all(promiseData2);
        for (let i = 0; i <= slots.length - 1; i += 1) {
          slots[i].totalUnassignedIs = 0;

          const opsRatio = slots[i].opsGroup.ratioForBalnceQuota;
          let totalinAssign = 0;

          if (slots[i].opsTeam.length > 0) {
            for (let t = 0; t <= slots[i].opsTeam.length - 1; t += 1) {
              totalinAssign += slots[i].opsTeam[t].unassignBalanace;
            }
            if (totalinAssign > slots[i].opsGroup.unassignBalanace) {
              slots[i].totalUnassignedIs += slots[i].opsGroup.unassignBalanace;
            } else {
              slots[i].totalUnassignedIs += totalinAssign;
            }
          } else {
            slots[i].totalUnassignedIs += slots[i].opsGroup.unassignBalanace;
          }

          for (let j = 0; j <= slots[i].arr.length - 1; j += 1) {
            const currentweek = `${j}A`;

            slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = 0;

            slots[i].weekRangeSlot[currentweek].balanceToBeAssigned =
              slots[i].weekRangeSlot[currentweek].value * opsRatio;
            if (slots[i].opsTeam.length > 0) {
              for (let d = 0; d <= slots[i].opsTeam.length - 1; d += 1) {
                const teamRatio = slots[i].opsTeam[d].ratioForBalnceQuota;
                const currentweek1 = `OG${j}OT${d.toString()}`;

                slots[i].weekRangeSlot[currentweek1].balanceToBeAssigned = 0;
                slots[i].weekRangeSlot[currentweek1].balanceToBeAssigned =
                  slots[i].weekRangeSlot[currentweek1].value * teamRatio;
              }
            }
          }
        }
        const data = { slot: slots };

        return res
          .status(201)
          .json({ status: true, data, message: 'Received data.' });
      }

      return null;
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong1', e });
    }
  }

  async checkIsAnnualLeaveArr(
    userId,
    companyId,
    year = new Date().getFullYear(),
    isFixedBallotingLeaveType = false,
    leaveTypeId = null,
  ) {
    let annualLeave;

    if (isFixedBallotingLeaveType) {
      annualLeave = await leaveType.findOne({
        _id: leaveTypeId,
        isActive: true,
        companyId,
      });
    } else {
      annualLeave = await leaveType.findOne({
        name: 'Annual Leave',
        isActive: true,
        companyId,
      });
    }

    if (annualLeave) {
      const staffLevaeData = await staffLeave.find({
        userId: { $in: userId },
        'leaveDetails.leaveTypeId': annualLeave._id,
      });

      if (staffLevaeData) {
        const staffArr = [];

        for (let i = 0; i < staffLevaeData.length; i += 1) {
          const item = staffLevaeData[i];
          const leaveTypeData = item.leaveDetails.filter(
            (leave) =>
              leave.leaveTypeId.toString() === annualLeave._id.toString() &&
              leave.year === year,
          );

          if (leaveTypeData && leaveTypeData.length > 0) {
            staffArr.push({
              userId: item.userId,
              leaveTypeData: leaveTypeData[0],
              leaveGroupId: item.leaveGroupId,
              businessUnitId: item.businessUnitId,
            });
          }
        }
        return { status: true, staffArr };
      }

      return { status: false };
    }

    return { status: false };
  }

  async checkIsAnnualLeave(
    userId,
    companyId,
    year,
    isFixedBallotingLeaveType = false,
    leaveTypeId = null,
  ) {
    let annualLeave;

    if (isFixedBallotingLeaveType) {
      annualLeave = await leaveType.findOne({
        _id: leaveTypeId,
        isActive: true,
        companyId,
      });
    } else {
      annualLeave = await leaveType.findOne({
        name: 'Annual Leave',
        isActive: true,
        companyId,
      });
    }

    if (annualLeave) {
      const staffLevaeData = await staffLeave.findOne({
        userId,
        'leaveDetails.leaveTypeId': annualLeave._id,
      });

      if (staffLevaeData) {
        if (!year) {
          const leaveTypeData = staffLevaeData.leaveDetails.filter(
            (leave) =>
              leave.leaveTypeId.toString() === annualLeave._id.toString(),
          )[0];

          return {
            leaveTypeData,
            status: true,
            leaveGroupId: staffLevaeData.leaveGroupId,
            businessUnitId: staffLevaeData.businessUnitId,
          };
        }

        let leaveTypeData = staffLevaeData.leaveDetails.filter(
          (leave) =>
            leave.leaveTypeId.toString() === annualLeave._id.toString() &&
            leave.year === year,
        );

        let status = true;

        if (leaveTypeData && leaveTypeData.length > 0) {
          [leaveTypeData] = leaveTypeData;
        } else {
          status = false;
          leaveTypeData = {};
          leaveTypeData.planQuota = 0;
        }

        return {
          leaveTypeData,
          status,
          leaveGroupId: staffLevaeData.leaveGroupId,
          businessUnitId: staffLevaeData.businessUnitId,
        };
      }

      return { status: false };
    }

    return { status: false };
  }

  async managePlanLeave(
    userId,
    leaveQuota,
    leaveTypeData,
    startYear = new Date().getFullYear(),
  ) {
    const updateStaffLeave = await staffLeave.findOneAndUpdate(
      {
        userId,
        leaveDetails: {
          $elemMatch: {
            year: startYear,
            leaveTypeId: leaveTypeData.leaveTypeId,
          },
        },
      },
      {
        $inc: {
          'leaveDetails.$.planQuota': leaveQuota,
          'leaveDetails.$.request': leaveQuota,
        },
      },
    );

    return updateStaffLeave;
  }

  async getBallotDataToAssignByStaff(req, res) {
    try {
      const ballotId = req.params.id;
      const ballot = await Ballot.findOne({ _id: ballotId });

      if (!ballot) {
        return res.json({
          status: false,
          message: "Couldn't find requested ballot. ",
        });
      }

      const startYear = new Date(ballot.ballotStartDate).getFullYear();
      let leaveFormat = 5;

      if (ballot.leaveConfiguration === 2) {
        leaveFormat = 6;
      } else if (ballot.leaveConfiguration === 3) {
        leaveFormat = 7;
      }

      if (ballot.leaveType === 2) {
        leaveFormat = 1;
      }

      let newBallot = JSON.stringify(ballot);

      newBallot = JSON.parse(newBallot);

      if (ballot.userFrom === 2) {
        // for BU do it later
      } else {
        const slots = newBallot.slotCreation;
        const users = [];

        const promiseData = [];
        const opsGroupUserList = async (i) => {
          slots[i].opsGroup.Users = [];
          const opsGroupUser = await OpsGroup.findOne(
            { _id: slots[i].opsGroup.opsId },
            { userId: 1, _id: 0 },
          ).lean();
          let leaveBallanceOpsData = await this.checkIsAnnualLeaveArr(
            opsGroupUser.userId,
            req.user.companyId,
            startYear,
          );

          if (slots[i].opsTeam.length > 0) {
            const promiseData2 = [];
            const opsTeamUserListCall = async (j) => {
              slots[i].opsTeam[j].Users = [];
              const opsTeamUser = await OpsTeam.findOne(
                { _id: slots[i].opsTeam[j]._id },
                { userId: 1, _id: 0 },
              ).lean();

              let leaveBallanceData;

              if (ballot !== null && ballot.fixedBallotingLeaveType) {
                leaveBallanceData = await this.checkIsAnnualLeaveArr(
                  opsTeamUser.userId,
                  req.user.companyId,
                  startYear,
                  true,
                  ballot.leaveTypeId,
                );
              } else {
                leaveBallanceData = await this.checkIsAnnualLeaveArr(
                  opsTeamUser.userId,
                  req.user.companyId,
                  startYear,
                  false,
                );
              }

              leaveBallanceData.staffArr.forEach((item) => {
                const user = {
                  opsG: slots[i].opsGroup.opsId,
                  opsT: slots[i].opsTeam[j]._id,
                  teamIndex: j,
                  userId: item.userId,
                  leaveTypeId: item.leaveTypeData.leaveTypeId,
                  leaveGroupId: item.leaveGroupId,
                  ballotLeaveBalance: parseInt(
                    item.leaveTypeData.planQuota / leaveFormat,
                    10,
                  ),
                };

                users.push(user);
              });
            };

            for (let j = 0; j <= slots[i].opsTeam.length - 1; j += 1) {
              promiseData2.push(opsTeamUserListCall(j));
            }

            await Promise.all(promiseData2);
          } else {
            if (ballot.leaveType === 2) {
              leaveBallanceOpsData = await this.checkIsAnnualLeaveArr(
                opsGroupUser.userId,
                req.user.companyId,
                startYear,
                true,
                ballot.leaveTypeId,
              );
            }

            leaveBallanceOpsData.staffArr.forEach((item) => {
              const user = {
                opsG: slots[i].opsGroup.opsId,
                opsT: null,
                userId: item.userId,

                leaveTypeId: item.leaveTypeData.leaveTypeId,
                leaveGroupId: item.leaveGroupId,
                ballotLeaveBalance: parseInt(
                  item.leaveTypeData.planQuota / leaveFormat,
                  10,
                ),
              };

              users.push(user);
            });
          }
        };

        for (let i = 0; i <= slots.length - 1; i += 1) {
          promiseData.push(opsGroupUserList(i));
        }

        await Promise.all(promiseData);

        if (users.length > 0) {
          const promiseData1 = [];
          const userListCall1 = async (u) => {
            const username = await User.findOne(
              { _id: users[u].userId },
              { _id: 0, name: 1, staffId: 1, parentBussinessUnitId: 1 },
            );

            users[u].name = username.name;
            users[u].staffId = username.staffId;
            users[u].parentBu = username.parentBussinessUnitId;
          };

          for (let u = 0; u <= users.length - 1; u += 1) {
            promiseData1.push(userListCall1(u));
          }

          await Promise.all(promiseData1);
          return res.json({
            status: true,
            data: users,
            message: 'Successfully received data.',
          });
        }

        // send users as it is
        return res.json({
          status: true,
          data: users,
          message: 'Successfully received data.',
        });
      }

      return null;
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong1', e });
    }
  }

  async checkforUserResrictions(users, newBallot, res) {
    try {
      if (users.length > 0) {
        const promiseData = [];
        const userListCall = async (u) => {
          users[u].wonWeeks = [];
          const deepClone = JSON.parse(JSON.stringify(users[u].weekRange));
          const username = await User.findOne(
            { _id: users[u].userId },
            { _id: 0, name: 1, staffId: 1, parentBussinessUnitId: 1 },
          );

          users[u].name = username.name;
          users[u].staffId = username.staffId;
          users[u].parentBu = username.parentBussinessUnitId;
          if (users[u].opsT === null) {
            const filteredData = newBallot.wonStaff.filter(
              (userWon) =>
                userWon.userId.toString() === users[u].userId.toString() &&
                userWon.opsGroupId.toString() === users[u].opsG.toString(),
            );

            for (let f = 0; f <= filteredData.length - 1; f += 1) {
              const weekIs = filteredData[f].weekNo;
              const opsWeekIs = `${weekIs}A`;

              deepClone[opsWeekIs].isRestrict = true;
              deepClone[opsWeekIs].isWon = true;

              // check for consecutive and restrict
              if (
                newBallot.maxConsecutiveBallot !== null &&
                newBallot.maxConsecutiveBallot > 0
              ) {
                const nextInd = weekIs + newBallot.maxConsecutiveBallot;

                if (weekIs < newBallot.maxConsecutiveBallot) {
                  const prevInd = weekIs - newBallot.maxConsecutiveBallot;

                  if (deepClone[`${prevInd}A`]) {
                    deepClone[`${prevInd}A`].isRestrict = true;
                  }
                }

                if (deepClone[`${nextInd}A`]) {
                  deepClone[`${nextInd}A`].isRestrict = true;
                }
              }
            }
          } else {
            const filteredData = newBallot.wonStaff.filter(
              (userWon) =>
                userWon.userId.toString() === users[u].userId.toString() &&
                userWon.opsGroupId.toString() === users[u].opsG.toString() &&
                userWon.opsTeamId.toString() === users[u].opsT.toString(),
            );

            for (let f = 0; f <= filteredData.length - 1; f += 1) {
              const weekIs = filteredData[f].weekNo;
              const opsWeekIs = `${weekIs}A`;

              deepClone[opsWeekIs].isRestrict = true;
              deepClone[opsWeekIs].isWon = true;
              const teamWeekIs = `${weekIs}${users[u].teamIndex}`;

              deepClone[teamWeekIs].isRestrict = true;
              deepClone[teamWeekIs].isWon = true;

              // check for consecutive and restrict

              if (
                newBallot.maxConsecutiveBallot !== null &&
                newBallot.maxConsecutiveBallot > 0
              ) {
                const nextInd = weekIs + newBallot.maxConsecutiveBallot;

                if (!(weekIs < newBallot.maxConsecutiveBallot)) {
                  const prevInd = weekIs - newBallot.maxConsecutiveBallot;

                  if (deepClone[`${prevInd}A`]) {
                    deepClone[`${prevInd}A`].isRestrict = true;
                    deepClone[
                      `${prevInd}${users[u].teamIndex}`
                    ].isRestrict = true;
                  }
                }

                if (deepClone[`${nextInd}A`]) {
                  deepClone[`${nextInd}A`].isRestrict = true;
                  deepClone[
                    `${nextInd}${users[u].teamIndex}`
                  ].isRestrict = true;
                }
              }
            }
          }

          delete users[u].weekRange;
          users[u].deepClone = deepClone;

          if (newBallot.isRestrict) {
            const staffRestriction = [];

            newBallot.staffRestriction.forEach((item) => {
              let isPresent = false;
              let staffRestrictionObj = {};

              isPresent = item.userList.some((user) => {
                if (user.id.toString() === users[u].userId.toString()) {
                  staffRestrictionObj = {
                    slot: item.slot,
                    startDate: item.startDate,
                    endDate: new Date(
                      new Date(item.endDate).setDate(
                        new Date(item.endDate).getDate() + 6,
                      ),
                    ),
                  };
                  return true;
                }

                return false;
              });
              if (isPresent) {
                const slot = this.getWeekIndex(
                  item.startDate,
                  newBallot.weekRange,
                  'start',
                  newBallot.leaveType,
                );

                staffRestrictionObj.slotNo = slot;
                staffRestriction.push(staffRestrictionObj);
              }
            });
            if (staffRestriction.length > 0) {
              for (let r = 0; r <= staffRestriction.length - 1; r += 1) {
                if (users[u].opsT === null) {
                  const weekIs = staffRestriction[r].slotNo;
                  const opsWeekIs = `${weekIs}A`;

                  deepClone[opsWeekIs].isRestrict = true;
                  deepClone[opsWeekIs].isStaffRestricted = true;
                } else {
                  const weekIs = staffRestriction[r].slotNo;
                  const opsWeekIs = `${weekIs}A`;

                  deepClone[opsWeekIs].isRestrict = true;
                  deepClone[opsWeekIs].isStaffRestricted = true;
                  const teamWeekIs = `${weekIs}${users[u].teamIndex}`;

                  deepClone[teamWeekIs].isRestrict = true;
                  deepClone[teamWeekIs].isStaffRestricted = true;
                }
              }
            }

            const segmentRestriction = [];

            newBallot.maxSegment.forEach((item) => {
              const startSlot = this.getWeekIndex(
                item.startDate,
                newBallot.weekRange,
                'start',
                newBallot.leaveType,
              );
              const endSlot = this.getWeekIndex(
                item.endDate,
                newBallot.weekRange,
                'end',
                newBallot.leaveType,
              );
              const slotRange = [];

              for (let i = startSlot; i <= endSlot; i += 1) {
                slotRange.push(i);
              }
              const segmentRestrictionObj = {
                startSlot,
                endSlot,
                slotRange,
                maxBallot: item.maxBallot,
              };

              segmentRestriction.push(segmentRestrictionObj);
            });

            if (segmentRestriction.length > 0) {
              for (let sg = 0; sg <= segmentRestriction.length - 1; sg += 1) {
                const wonFilterd = newBallot.wonStaff.filter(
                  (winers) =>
                    segmentRestriction[sg].slotRange.includes(winers.weekNo) &&
                    winers.userId.toString() === users[u].userId.toString(),
                );

                if (segmentRestriction[sg].maxBallot === wonFilterd.length) {
                  for (
                    let slot = 0;
                    slot <= segmentRestriction[sg].slotRange.length - 1;
                    slot += 1
                  ) {
                    const indexAtSegment =
                      segmentRestriction[sg].slotRange[slot];

                    if (users[u].opsT === null) {
                      users[u].deepClone[
                        `${indexAtSegment}A`
                      ].isRestrict = true;
                    } else {
                      users[u].deepClone[
                        `${indexAtSegment}A`
                      ].isRestrict = true;
                      users[u].deepClone[
                        `${indexAtSegment}${users[u].teamIndex}`
                      ].isRestrict = true;
                    }
                  }
                } else {
                  if (!wonFilterd.length > 0) {
                    const show =
                      segmentRestriction[sg].slotRange[
                        Math.floor(
                          Math.random() *
                            segmentRestriction[sg].slotRange.length,
                        )
                      ];

                    users[u].deepClone[`${show}A`].isRestrict = true;
                    if (users[u].opsT !== null) {
                      users[u].deepClone[
                        `${show}${users[u].teamIndex}`
                      ].isRestrict = true;
                    }
                  }

                  for (
                    let slot = 0;
                    slot <= segmentRestriction[sg].slotRange.length - 1;
                    slot += 1
                  ) {
                    const weekNo = `${segmentRestriction[sg].slotRange[slot]}A`;

                    if (users[u].deepClone[weekNo].isRestrict) {
                      // its consicative so here again check for consecutive
                      if (
                        newBallot.maxConsecutiveBallot !== null &&
                        newBallot.maxConsecutiveBallot > 0
                      ) {
                        const nextInd =
                          segmentRestriction[sg].slotRange[slot] +
                          newBallot.maxConsecutiveBallot;

                        if (
                          segmentRestriction[sg].slotRange[slot] <
                          newBallot.maxConsecutiveBallot
                        ) {
                          const prevInd =
                            segmentRestriction[sg].slotRange[slot] -
                            newBallot.maxConsecutiveBallot;

                          users[u].deepClone[`${prevInd}A`].isRestrict = true;
                        }

                        if (users[u].deepClone[`${nextInd}A`]) {
                          users[u].deepClone[`${nextInd}A`].isRestrict = true;
                        }
                      }
                    }

                    if (users[u].opsT !== null) {
                      const weekNo1 = `${segmentRestriction[sg].slotRange[slot]}${users[u].teamIndex}`;

                      if (users[u].deepClone[weekNo1].isRestrict) {
                        // its consicative so here again check for consecutive
                        if (
                          newBallot.maxConsecutiveBallot !== null &&
                          newBallot.maxConsecutiveBallot > 0
                        ) {
                          const nextInd =
                            segmentRestriction[sg].slotRange[slot] +
                            newBallot.maxConsecutiveBallot;

                          if (
                            segmentRestriction[sg].slotRange[slot] <
                            newBallot.maxConsecutiveBallot
                          ) {
                            const prevInd =
                              segmentRestriction[sg].slotRange[slot] -
                              newBallot.maxConsecutiveBallot;

                            users[u].deepClone[
                              `${prevInd}${users[u].teamIndex}`
                            ].isRestrict = true;
                          }

                          if (
                            users[u].deepClone[
                              `${nextInd}${users[u].teamIndex}`
                            ]
                          ) {
                            users[u].deepClone[
                              `${nextInd}${users[u].teamIndex}`
                            ].isRestrict = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // finally the only maxConsecutive ballots to check
          if (
            newBallot.maxConsecutiveBallot !== null &&
            newBallot.maxConsecutiveBallot > 0
          ) {
            const check = checkForIsRestrict(users[u].deepClone);

            if (check === true) {
              for (let ar = 0; ar <= users[u].arr.length - 1; ar += 1) {
                // for ops group here
                const nextOfar = ar + newBallot.maxConsecutiveBallot;

                // writting random no logic here..
                const ballarr = [ar, nextOfar];
                const show =
                  ballarr[Math.floor(Math.random() * ballarr.length)];

                if (users[u].deepClone[`${ar}A`].isRestrict) {
                  logInfo('Adding in Future');
                } else if (users[u].deepClone[`${nextOfar}A`]) {
                  if (users[u].deepClone[`${nextOfar}A`].isRestrict) {
                    logInfo('Adding in Future');
                  } else {
                    users[u].deepClone[`${show}A`].isRestrict = true;
                  }
                }

                // For ops teams
                if (users[u].opsT !== null) {
                  if (
                    users[u].deepClone[`${ar}${users[u].teamIndex}`].isRestrict
                  ) {
                    logInfo('Adding in Future');
                  } else if (users[u].deepClone[`${nextOfar}A`]) {
                    if (
                      users[u].deepClone[`${nextOfar}${users[u].teamIndex}`]
                        .isRestrict
                    ) {
                      logInfo('Adding in Future');
                    } else {
                      users[u].deepClone[
                        `${show}${users[u].teamIndex}`
                      ].isRestrict = true;
                    }
                  }
                }
              }
            } else {
              for (let ar = 0; ar <= users[u].arr.length - 1; ar += 1) {
                // for ops group here
                const nextOfar = ar + newBallot.maxConsecutiveBallot;
                // writting random no logic here..
                const ballarr = [ar, nextOfar];
                const show =
                  ballarr[Math.floor(Math.random() * ballarr.length)];

                if (users[u].deepClone[`${ar}A`].isRestrict) {
                  logInfo('Adding in Future');
                } else if (users[u].deepClone[`${nextOfar}A`]) {
                  if (users[u].deepClone[`${nextOfar}A`].isRestrict) {
                    logInfo('Adding in Future');
                  } else {
                    users[u].deepClone[`${show}A`].isRestrict = true;
                  }
                }

                // For ops teams
                if (users[u].opsT !== null) {
                  if (
                    users[u].deepClone[`${ar}${users[u].teamIndex}`].isRestrict
                  ) {
                    logInfo('Adding in Future');
                  } else if (users[u].deepClone[`${nextOfar}A`]) {
                    if (
                      users[u].deepClone[`${nextOfar}${users[u].teamIndex}`]
                        .isRestrict
                    ) {
                      logInfo('Adding in Future');
                    } else {
                      users[u].deepClone[
                        `${show}${users[u].teamIndex}`
                      ].isRestrict = true;
                    }
                  }
                }
              }
            }

            delete users[u].arr;
          }
        };

        for (let u = 0; u <= users.length - 1; u += 1) {
          promiseData.push(userListCall(u));
        }

        await Promise.all(promiseData);
      } else {
        // This case will never happen.In case is happens by mistake We are returning all users list without applying any Restrictions.
      }

      return res.json({
        status: true,
        data: users,
        message: 'Successfully received data.',
      });
    } catch (e) {
      return res.json({
        status: false,
        data: e,
        message: 'cannot receive data.',
      });
    }
  }

  async getAutoAssignedUsers(req, res) {
    try {
      const ballotId = req.params.id;

      let finalWonStaff = [];
      const ballotData = await Ballot.findById(
        { _id: ballotId },
        { _id: 0, ballotName: 1, wonStaff: 1 },
      );
      let newBallot = JSON.stringify(ballotData);

      newBallot = JSON.parse(newBallot);

      const result = newBallot.wonStaff.filter(
        (staff) => staff.isAutoAssign === true,
      );

      if (result.length > 0) {
        const promiseData = [];
        const finalWonStaffCall = async (r) => {
          const user = await User.findOne(
            { _id: result[r].userId },
            { _id: 0, name: 1, staffId: 1 },
          );

          result[r].userData = user;
          finalWonStaff.push(result[r]);
        };

        for (let r = 0; r <= result.length - 1; r += 1) {
          promiseData.push(finalWonStaffCall(r));
        }

        await Promise.all(promiseData);
      } else {
        finalWonStaff = result;
      }

      finalWonStaff = groupBy(finalWonStaff, 'userId');

      return res.json({
        message: 'Successfully auto assign done',
        success: true,
        finalWonStaff,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ status: false, message: 'Something went wrong1', e });
    }
  }

  async ballotDetailsForAutoAssigned(req, res) {
    try {
      const ballotId = req.params.id;
      const parentBallot = await Ballot.findOne({ _id: ballotId });
      const userList = [];

      if (!parentBallot.isAutoAssign) {
        res
          .status(201)
          .json({ status: false, message: 'ballot is not yet AutoAssigned' });
      }

      const won = groupByAuto(parentBallot.wonStaff, (item) => [
        item.userId,
        item.opsGroupId,
        item.opsTeamId,
        item.isAutoAssign,
      ]);
      const opsGroupD = {};
      const opsTeamD = {};

      const promiseData = [];
      const winsListCall = async (wins) => {
        if (won[wins].isAuto) {
          const user = {};

          user.user = await User.findOne(
            { _id: won[wins].userId },
            { _id: 1, name: 1, staffId: 1 },
          );
          if (!opsGroupD[won[wins].opsId]) {
            user.Ops = await OpsGroup.findOne(
              { _id: won[wins].opsId },
              { _id: 1, opsGroupName: 1 },
            );
            opsGroupD[won[wins].opsId] = user.Ops;
          } else {
            user.Ops = opsGroupD[won[wins].opsId];
          }

          if (won[wins].teamId !== null || won[wins].teamId !== undefined) {
            if (!opsTeamD[won[wins].teamId]) {
              user.Team = await OpsTeam.findOne(
                { _id: won[wins].teamId },
                { _id: 1, name: 1 },
              );
              opsTeamD[won[wins].teamId] = user.Team;
            } else {
              user.Team = opsTeamD[won[wins].teamId];
            }
          } else {
            user.Team = {};
            user.Team.name = ' ';
          }

          user.userId = won[wins].userId;
          user.opsId = won[wins].opsId;
          user.teamId = won[wins].teamId;
          user.ballotId = parentBallot._id;
          user.applied = 0;
          user.ballotRound = parentBallot.ballotRound + 1;
          user.wonCount = won[wins].data.length;
          userList.push(user);
        }
      };

      for (let wins = 0; wins <= won.length - 1; wins += 1) {
        promiseData.push(winsListCall(wins));
      }

      await Promise.all(promiseData);

      return res.status(200).json({
        status: true,
        message: 'Successfully got data',
        data: userList,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ status: false, message: 'Something went wrong1', e });
    }
  }

  async exportleavebalance(req, res) {
    const appliedStaff = await Ballot.findOne(
      { _id: '5ddba42b6253dc44cbcc1dac' },
      { _id: 0, appliedStaff: 1, opsGroupId: 1 },
    );
    const userId = [];
    const opsIds = [];

    appliedStaff.opsGroupId.forEach((item) => {
      opsIds.push(item);
    });
    const opsD = await OpsGroup.find(
      { _id: { $in: opsIds } },
      { _id: 1, userId: 1 },
    ).lean();

    for (let j = 0; j <= opsD.length - 1; j += 1) {
      userId.push(opsD[j].userId);
    }
    let IDS = [];

    for (let k = 0; k <= userId.length - 1; k += 1) {
      IDS = IDS.concat(userId[k]);
    }
    const data = await StaffSapData.find(
      { staff_Id: { $in: IDS } },
      {
        staff_Id: 1,
        postBallotBalance: 1,
        daysBallotApplied: 1,
        ballotLeaveBalanced: 1,
        leavesBalanced: 1,
        leavesAvailed: 1,
        leavesEntitled: 1,
      },
    ).populate([{ path: 'staff_Id', select: '_id name' }]);
    const findaData = [];

    data.forEach((item) => {
      const obj = JSON.parse(JSON.stringify(item));

      obj.userId = item.staff_Id._id;
      obj.userName = item.staff_Id.name;
      delete obj.staff_Id;
      findaData.push(obj);
    });
    res.send({ findaData });
  }

  async revertBallot(req, res) {
    const ballotData = await Ballot.findOne(
      { _id: '5db8f61142053834e4903aee' },
      {
        _id: 0,
        weekRange: 1,
        appliedStaff: 1,
        wonStaff: 1,
        leaveConfiguration: 1,
      },
    );
    const finalWonStaff = groupBy(ballotData.wonStaff, 'weekNo');
    const applied = groupBy(ballotData.appliedStaff, 'weekNo');
    const wonStaffIdWeekWise = [];
    const appliedStaffIdWeekwise = [];
    let leave = 5;

    if (ballotData.leaveConfiguration === 2) {
      leave = 6;
    } else if (ballotData.leaveConfiguration === 3) {
      leave = 7;
    }

    for (let i = 0; i < ballotData.weekRange.length; i += 1) {
      if (finalWonStaff[`${i}`]) {
        const arr = finalWonStaff[`${i}`];
        const userId = [];

        arr.forEach((item) => {
          userId.push(item.userId.toString());
        });
        wonStaffIdWeekWise.push(userId);
      } else {
        wonStaffIdWeekWise.push([]);
      }

      if (applied[`${i}`]) {
        const arr = applied[`${i}`];
        const userId = [];

        arr.forEach((item) => {
          userId.push(item.userId.toString());
        });
        appliedStaffIdWeekwise.push(userId);
      } else {
        appliedStaffIdWeekwise.push([]);
      }
    }

    const unsuccessfullStaff = [];

    for (let j = 0; j < ballotData.weekRange.length; j += 1) {
      const arr1 = appliedStaffIdWeekwise[j];
      const arr2 = wonStaffIdWeekWise[j];

      const diffUserId = [];

      arr1.forEach((item) => {
        if (!arr2.includes(item)) {
          diffUserId.push(item);
        }
      });
      if (diffUserId.length === 0) {
        unsuccessfullStaff.push([]);
      } else {
        unsuccessfullStaff.push(diffUserId);
      }
    }

    for (let i = 0; i < ballotData.weekRange.length; i += 1) {
      const userId = unsuccessfullStaff[i];

      if (userId.length > 0) {
        StaffSapData.updateMany(
          { staff_Id: { $in: userId } },
          { $inc: { ballotLeaveBalanced: -leave } },
        );
      }
    }
    res.send({ unsuccessfullStaff });
  }

  async BallotDataByUserTestExport(req, res) {
    const All = [];
    const BallotR = await Ballot.findOne({ _id: '5db8f88242053834e4903b00' });
    const applied = groupByOU(BallotR.appliedStaff, (item) => [
      item.userId,
      item.opsGroupId,
      item.opsTeamId,
    ]);
    const wons = groupByOU(BallotR.wonStaff, (item) => [
      item.userId,
      item.opsGroupId,
      item.opsTeamId,
    ]);

    const promiseData = [];
    const appliedUserCall = async (apply) => {
      const user = await User.findOne(
        { _id: applied[apply].userId },
        { _id: 1, name: 1, staffId: 1 },
      ).populate({
        path: 'parentBussinessUnitId',
        select: 'name sectionId',
        populate: {
          path: 'sectionId',
          select: 'name departmentId',
          populate: {
            path: 'departmentId',
            select: 'name companyId',
            populate: {
              path: 'companyId',
              select: 'name status',
            },
          },
        },
      });
      const ops = await OpsGroup.findOne(
        { _id: applied[apply].opsId },
        { _id: 0, opsGroupName: 1 },
      );
      const team = await OpsTeam.findOne(
        { _id: applied[apply].teamId },
        { _id: 0, name: 1 },
      );
      const row = {};

      row.name = user.name;
      row.staffId = user.staffId;
      row.parentBussinessUnitId = `${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;
      row.opsGroupName = ops.opsGroupName;
      if (team !== null) {
        row.opsTeamName = team.name;
      } else {
        row.opsTeamName = '';
      }

      row.appliedCount = applied[apply].data.length;
      row.slotSubmitted = [];
      for (let k = 0; k <= applied[apply].data.length - 1; k += 1) {
        const week = applied[apply].data[k].weekNo + 1;
        const dates = `${
          BallotR.weekRange[applied[apply].data[k].weekNo].start
        }to${BallotR.weekRange[applied[apply].data[k].weekNo].end}`;
        const slot = `slot-${week}-> ${dates}`;

        row.slotSubmitted.push(slot);
      }

      for (let won = 0; won <= wons.length - 1; won += 1) {
        if (
          applied[apply].userId === wons[won].userId &&
          applied[apply].opsId === wons[won].opsId &&
          applied[apply].teamId === wons[won].teamId
        ) {
          row.wonCount = wons[won].data.length;
          row.slotSuccessfull = [];
          for (let k = 0; k <= wons[won].data.length - 1; k += 1) {
            const week = wons[won].data[k].weekNo + 1;
            const dates = `${
              BallotR.weekRange[wons[won].data[k].weekNo].start
            }to${BallotR.weekRange[wons[won].data[k].weekNo].end}`;
            const slot = `slot-${week}-> ${dates}`;

            row.slotSuccessfull.push(slot);

            row.unSuccessfull = [];
            const difference = row.slotSubmitted.filter(
              (x) => !row.slotSuccessfull.includes(x),
            );

            row.unSuccessfull.push(difference);
          }
        }
      }
      All.push(row);
    };

    for (let apply = 0; apply <= applied.length - 1; apply += 1) {
      promiseData.push(appliedUserCall(apply));
    }

    await Promise.all(promiseData);

    return res.json({ All });
  }

  async AutoAssignBallot(req, res) {
    const { id } = req.params;
    const ballot = await Ballot.findOne({ _id: id }).populate([
      {
        path: 'adminId',
        select: '_id name staffId',
      },
      { path: 'opsGroupId', model: 'OpsGroup', select: '_id opsGroupName' },
    ]);

    if (!ballot) {
      return res
        .status(500)
        .json({ success: false, message: 'Requested ballot not found' });
    }

    if (ballot.isAutoAssign) {
      return res.status(402).json({
        success: false,
        message: 'Requested ballot Already Auto assigned.',
      });
    }

    let newballot = JSON.stringify(ballot);

    newballot = JSON.parse(newballot);
    newballot.parentBallot = ballot._id;
    newballot.ballotStartDate = moment(newballot.ballotStartDate).format(
      'MM-DD-YYYY',
    );
    newballot.ballotEndDate = moment(newballot.ballotEndDate).format(
      'MM-DD-YYYY',
    );

    // start with remainng quotas
    const slots = ballot.slotCreation;

    if (newballot.userFrom === 2) {
      // FOr BU's
      for (let i = 0; i <= slots.length - 1; i += 1) {
        for (let j = 0; j <= slots[i].arr.length - 1; j + 1) {
          const found = ballot.wonStaff.filter(
            (element) =>
              element.buId.toString() === slots[i].buId.toString() &&
              element.weekNo === j,
          );

          slots[i].arr[j].value -= found.length;
        }
      }
    } else {
      // For Ops groups
      for (let i = 0; i <= slots.length - 1; i += 1) {
        const opsGrpid = slots[i].opsGroup.opsId;

        for (let j = 0; j <= slots[i].arr.length - 1; j += 1) {
          let currentweek = `${j}A`;
          const found = ballot.wonStaff.filter(
            (element) =>
              element.opsGroupId.toString() === opsGrpid.toString() &&
              element.weekNo === j,
          );

          slots[i].weekRangeSlot[currentweek].value -= found.length;
          if (slots[i].opsTeam.length > 0) {
            slots[i].opsTeam.forEach((team, d) => {
              currentweek = `OG${j}OT${d.toString()}`;
              const found1 = ballot.wonStaff.filter((element) => {
                if (element.opsTeamId) {
                  return (
                    element.opsTeamId.toString() === team._id.toString() &&
                    element.weekNo === j
                  );
                }

                return (
                  element.opsGroupId === opsGrpid &&
                  !element.opsTeamId &&
                  element.weekNO === j
                );
              });

              slots[i].weekRangeSlot[currentweek].value -= found1.length;
            });
          }
        }
      }
    }

    newballot.ballotName += '-AutoAssign';
    newballot.slotCreation = slots;
    newballot.appliedStaff = [];
    newballot.isPublish = false;
    newballot.isDraft = false;
    newballot.isResultRelease = false;
    newballot.isAutoAssign = true;
    newballot.isConduct = false;
    delete newballot._id;
    delete newballot.updatedAt;
    delete newballot.createdAt;
    delete newballot.__v;
    delete newballot.resultReleaseDateTime;
    return this.getslotsCalculated(newballot, res);
  }

  async getslotsCalculated(ballot, res) {
    try {
      const startYear = new Date(ballot.ballotStartDate).getFullYear();
      let leaveFormat = 5;

      if (ballot.leaveConfiguration === 2) {
        leaveFormat = 6;
      } else if (ballot.leaveConfiguration === 3) {
        leaveFormat = 7;
      }

      if (ballot.leaveType === 2) {
        leaveFormat = 1;
      }

      const slots = ballot.slotCreation;
      let totUnAssign = 0;
      let totBQ = 0;

      for (let i = 0; i <= slots.length - 1; i += 1) {
        slots[i].totalUnassignedIs = 0;

        slots[i].totalBallotBalance = 0;

        slots[i].opsGroup.unassignBalanace = 0;
        slots[i].opsGroup.BallotBalance = 0;
        let totalinAssign = 0;
        const opsGroupUser = await OpsGroup.findOne(
          { _id: slots[i].opsGroup.opsId },
          { userId: 1, _id: 0 },
        ).lean();

        let leaveBallanceData;

        if (ballot !== null && ballot.fixedBallotingLeaveType) {
          leaveBallanceData = await this.checkIsAnnualLeaveArr(
            opsGroupUser.userId,
            ballot.companyId,
            startYear,
            true,
            ballot.leaveTypeId,
          );
        } else {
          leaveBallanceData = await this.checkIsAnnualLeaveArr(
            opsGroupUser.userId,
            ballot.companyId,
            startYear,
            false,
          );
        }

        let opsUnassign = 0;

        leaveBallanceData.staffArr.forEach((item) => {
          opsUnassign += Math.floor(item.leaveTypeData.planQuota / leaveFormat);
        });
        slots[i].opsGroup.unassignBalanace = opsUnassign;
        for (let j = 0; j <= slots[i].arr.length - 1; j += 1) {
          let hasTeam = false;
          const currentweek = `${j}A`;

          const currentOpsSlotValueIs =
            slots[i].weekRangeSlot[currentweek].value;

          // Ops Team is there
          let slotValueOfTeams = 0;

          if (slots[i].opsTeam.length > 0) {
            hasTeam = true;
            for (let d = 0; d <= slots[i].opsTeam.length - 1; d += 1) {
              slots[i].opsTeam[d].unassignBalanace = 0;

              const currentweek1 = `OG${j}OT${d.toString()}`;

              slotValueOfTeams += slots[i].weekRangeSlot[currentweek1].value;
              if (slots[i].opsTeam[d].BallotBalance) {
                slots[i].opsTeam[d].BallotBalance +=
                  slots[i].weekRangeSlot[currentweek1].value;
              } else {
                slots[i].opsTeam[d].BallotBalance = 0;
                slots[i].opsTeam[d].BallotBalance +=
                  slots[i].weekRangeSlot[currentweek1].value;
              }

              const opsTeamUser = await OpsTeam.findOne(
                { _id: slots[i].opsTeam[d]._id },
                { userId: 1, _id: 0 },
              ).lean();

              let leaveBallanceData1;

              if (ballot !== null && ballot.fixedBallotingLeaveType) {
                leaveBallanceData1 = await this.checkIsAnnualLeaveArr(
                  opsTeamUser.userId,
                  ballot.companyId,
                  startYear,
                  true,
                  ballot.leaveTypeId,
                );
              } else {
                leaveBallanceData1 = await this.checkIsAnnualLeaveArr(
                  opsTeamUser.userId,
                  ballot.companyId,
                  startYear,
                  false,
                );
              }

              let teamUnassign = 0;

              leaveBallanceData1.staffArr.forEach((item) => {
                teamUnassign += Math.floor(
                  item.leaveTypeData.planQuota / leaveFormat,
                );
              });
              slots[i].opsTeam[d].unassignBalanace = teamUnassign;
              totalinAssign += slots[i].opsTeam[d].unassignBalanace;
              slots[i].opsTeam[d].ratioForBalnceQuota = RATIO;
            }
          }

          if (hasTeam) {
            if (slotValueOfTeams > currentOpsSlotValueIs) {
              slots[i].opsGroup.BallotBalance += currentOpsSlotValueIs;
            } else {
              slots[i].opsGroup.BallotBalance += slotValueOfTeams;
            }
          } else {
            slots[i].opsGroup.BallotBalance += currentOpsSlotValueIs;
          }

          slots[i].opsGroup.ratioForBalnceQuota = RATIO;

          slots[i].totalBallotBalance = slots[i].opsGroup.BallotBalance;
        }
        if (slots[i].opsTeam.length > 0) {
          if (totalinAssign > slots[i].opsGroup.unassignBalanace) {
            slots[i].totalUnassignedIs += slots[i].opsGroup.unassignBalanace;
          } else {
            slots[i].totalUnassignedIs += totalinAssign;
          }
        } else {
          slots[i].totalUnassignedIs += slots[i].opsGroup.unassignBalanace;
        }

        totBQ += slots[i].totalBallotBalance;
        totUnAssign += slots[i].totalUnassignedIs;
      }

      ballot.TotBQ = totBQ;
      ballot.totUN = totUnAssign;
      ballot.RATio = RATIO;
      // Ratio;
      for (let i = 0; i <= slots.length - 1; i += 1) {
        for (let j = 0; j <= slots[i].arr.length - 1; j += 1) {
          const currentweek = `${j}A`;

          slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = 0;
          slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = Math.round(
            slots[i].weekRangeSlot[currentweek].value * ballot.RATio,
          );
          if (slots[i].opsTeam.length > 0) {
            for (let d = 0; d <= slots[i].opsTeam.length - 1; d += 1) {
              const currentweek2 = `OG${j}OT${d.toString()}`;

              slots[i].weekRangeSlot[currentweek2].balanceToBeAssigned = 0;
              slots[i].weekRangeSlot[currentweek2].balanceToBeAssigned =
                Math.round(
                  slots[i].weekRangeSlot[currentweek2].value * ballot.RATio,
                );
            }
          }
        }
      }

      ballot.wonStaff = [];
      return res
        .status(201)
        .json({ status: true, data: ballot, message: 'Received data.' });
    } catch (e) {
      return res.json({ status: false, message: 'Something went wrong1', e });
    }
  }

  async getSwapDetailChanges(req, res) {
    const reqdata = req.body;
    const ballot = await Ballot.findOne(
      { _id: reqdata.ballotId },
      { weekRange: 1, wonStaff: 1 },
    );
    const slotDates = {
      start: ballot.weekRange[reqdata.slotNo].start,
      end: ballot.weekRange[reqdata.slotNo].end,
    };
    const ops = await OpsGroup.findOne(
      { userId: req.user._id, isDelete: false },
      { opsGroupName: 1, swopSetup: 1, userId: 1 },
    ).populate({
      path: 'userId',
      select: 'name staffId',
    });

    if (ops) {
      const swopSetup = parseInt(ops.swopSetup, 10);
      let users = [];

      if (swopSetup === 1) {
        users = ops.userId;
      } else {
        const opsTeam = await OpsTeam.findOne(
          { userId: req.user._id, isDeleted: false },
          { userId: 1 },
        ).populate({ path: 'userId', select: 'name staffId' });

        if (opsTeam) {
          users = opsTeam.userId;
        } else {
          return res.status(300).json({
            success: false,
            data: null,
            message: "Couldn't find ops group data of you.",
          });
        }
      }

      const currentuser = await User.findOne(
        { _id: req.user._id },
        { _id: 0, parentBussinessUnitId: 1 },
      ).populate({
        path: 'parentBussinessUnitId',
        select: 'name',
        populate: {
          path: 'sectionId',
          select: 'name',
          populate: {
            path: 'departmentId',
            select: 'name',
            populate: {
              path: 'companyId',
              select: 'name',
            },
          },
        },
      });
      const BU = `${currentuser.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${currentuser.parentBussinessUnitId.sectionId.departmentId.name} > ${currentuser.parentBussinessUnitId.sectionId.name} > ${currentuser.parentBussinessUnitId.name}`;

      const resObj = {
        Bu: BU,
        opsName: ops.opsGroupName,
        opsGroupId: ops._id,
        type: 'Balloted',
        leavedays: 5,
        currentdates: slotDates,
        slotNo: reqdata.slotNo,
        users,
        ballotId: reqdata.ballotId,
      };

      return res.status(201).json({
        success: true,
        data: resObj,
        message: 'received!',
      });
    }

    return res.status(300).json({
      success: false,
      data: null,
      message: "Couldn't find ops group data of you.",
    });
  }

  async getslotswonByUser(req, res) {
    const ballot = await Ballot.findOne(
      { _id: req.body.ballotId },
      { wonStaff: 1, weekRange: 1 },
    );

    if (ballot && ballot.wonStaff.length > 0) {
      const users = ballot.wonStaff.filter(
        (wq) => wq.userId.toString() === req.body.userId.toString(),
      );

      const resArr = [];

      for (let i = 0; i <= users.length - 1; i += 1) {
        const currObj = {};

        currObj.slotNo = users[i].weekNo;
        currObj.start = ballot.weekRange[users[i].weekNo].start;
        currObj.end = ballot.weekRange[users[i].weekNo].end;
        resArr.push(currObj);
      }
      return res.status(201).json({
        success: true,
        data: resArr,
        message: 'received!',
      });
    }

    return res.status(300).json({
      success: false,
      data: null,
      message: "Couldn't find requested ballots and won users.",
    });
  }

  async saveWonsAllAsLeave(wonStaff, weekRange, round, id) {
    const leaveObjects = [];

    if (wonStaff.length > 0) {
      for (let i = 0; i <= wonStaff.length - 1; i += 1) {
        const leave = {};

        leave.ballotId = id;
        leave.slotNo = wonStaff[i].weekNo;
        leave.userId = wonStaff[i].userId;
        leave.status = 'Balloted';
        leave.type = 1;
        leave.fromdate = weekRange[wonStaff[i].weekNo].start;
        leave.todate = weekRange[wonStaff[i].weekNo].end;
        leave.ballotRound = round + 1;
        leaveObjects.push(leave);
      }
      userLeaves.insertMany(leaveObjects);
    }
  }

  async createLeaves(req) {
    const ballot = await Ballot.findOne({ _id: req.body.id });
    const leaveObjects = [];

    if (ballot.wonStaff.length > 0) {
      for (let i = 0; i <= ballot.wonStaff.length - 1; i += 1) {
        const leave = {};

        leave.ballotId = ballot._id;
        leave.slotNo = ballot.wonStaff[i].weekNo;
        leave.userId = ballot.wonStaff[i].userId;
        leave.status = 'Balloted';
        leave.type = 1;
        leave.fromdate = ballot.weekRange[ballot.wonStaff[i].weekNo].start;
        leave.todate = ballot.weekRange[ballot.wonStaff[i].weekNo].end;
        leave.ballotRound = ballot.ballotRound + 1;
        leaveObjects.push(leave);
      }
      userLeaves.insertMany(leaveObjects);
    }
  }
}

async function pushLeaveToLeaveApplied(ballotData) {
  if (ballotData.staffLeave) {
    const promiseData = [];
    const leaveAppliedCall = async (leave) => {
      await new LeaveApplied(leave).save();
    };

    for (let i = 0; i < ballotData.staffLeave.length; i += 1) {
      promiseData.push(leaveAppliedCall(ballotData.staffLeave[i]));
    }

    await Promise.all(promiseData);
  }

  return false;
}

async function sendResultReleaseNotification(item) {
  const currentTime = new Date();

  if (item.userFrom === 1) {
    const userIDArr = await OpsGroup.find(
      { _id: { $in: item.opsGroupId }, isDelete: false },
      { userId: 1, _id: 0 },
    );
    let userId = [];

    userIDArr.forEach((items) => {
      userId = userId.concat(items.userId);
    });
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select('deviceToken')
      .lean();
    const usersDeviceTokens = [];

    unAssignUser.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: 'Balloting Excercise results are released.',
        body: `Balloting Excercise "${item.ballotName}" results are released,  please check the results.`,
        bodyText: `Balloting Excercise "${item.ballotName}" results are released, please check the results.`,
        bodyTime: currentTime,
        bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
      };
      const collapseKey = item._id; /* unique id for this particular ballot */

      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }

    await Ballot.update({ _id: item._id }, { isNotified: 4 });
  } else {
    // user from bu
    const userList = await User.find(
      { parentBussinessUnitId: { $in: item.businessUnitId } },
      { _id: 0, deviceToken: 1 },
    );
    const usersDeviceTokens = [];

    userList.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: 'Balloting Excercise results are released.',
        body: `Balloting Excercise "${item.ballotName}" results are released,  please check the results.`,
        bodyText: `Balloting Excercise "${item.ballotName}" results are released, please check the results.`,
        bodyTime: currentTime,
        bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
      };
      const collapseKey = item._id; /* unique id for this particular ballot */

      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }

    await Ballot.update({ _id: item._id }, { isNotified: 4 });
  }
}
// result release
async function resultReleaseFun(ballotId) {
  try {
    logInfo('resultReleaseFun called', ballotId);
    const ballotList = await Ballot.findOne({
      isDeleted: false,
      isCanceled: false,
      isPublish: true,
      isDraft: false,
      isConduct: true,
      isResultRelease: false,
      resultRelease: 1,
      _id: ballotId,
    });

    if (ballotList) {
      ballotList.isResultRelease = true;
      sendResultReleaseNotification(ballotList);
      pushLeaveToLeaveApplied(ballotList);
      await Ballot.findByIdAndUpdate(ballotList._id, {
        $set: { isResultRelease: true },
      });
    }

    return true;
  } catch (e) {
    logError('resultReleaseFun ballot has error', e);
    logError('resultReleaseFun ballot has error', e.stack);
    return false;
  }
}
// publish ballot
async function publishBallot(ballotId) {
  try {
    logInfo('publish ballot called', ballotId);
    const item = await Ballot.findOne({
      isDeleted: false,
      isCanceled: false,
      isPublish: false,
      isDraft: false,
      _id: ballotId,
    });

    if (item) {
      // get user
      // update ballot ispublish
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

        userIDArr.forEach((items) => {
          userId = userId.concat(items.userId);
        });
        const unAssignUser = await User.find({ _id: { $in: userId } })
          .select('deviceToken')
          .lean();
        const usersDeviceTokens = [];

        unAssignUser.forEach((token) => {
          if (token.deviceToken) {
            usersDeviceTokens.push(token.deviceToken);
          }
        });

        if (usersDeviceTokens.length > 0) {
          const pushData = {
            title: 'New Balloting Exercise',
            body: `" ${item.ballotName}" Ballot Available. `,
            bodyText: `${item.ballotName} ballot created.`,
            bodyTime: [item.applicationCloseDateTime],
            bodyTimeFormat: ['dd MMM'],
          };
          const collapseKey =
            item._id; /* unique id for this particular ballot */

          FCM.push(usersDeviceTokens, pushData, collapseKey);
        }

        await Ballot.update({ _id: item._id }, { isPublish: true });
      } else {
        // user from bu
        const userList = await User.find(
          { parentBussinessUnitId: { $in: item.businessUnitId } },
          {
            _id: 0,
            deviceToken: 1,
          },
        );
        const usersDeviceTokens = [];

        userList.forEach((token) => {
          if (token.deviceToken) {
            usersDeviceTokens.push(token.deviceToken);
          }
        });

        if (usersDeviceTokens.length > 0) {
          const pushData = {
            title: 'New Balloting Exercise',
            body: `" ${item.ballotName}" Ballot Available.`,
            bodyText: `${item.ballotName} ballot created.`,
            bodyTime: [item.applicationCloseDateTime],
            bodyTimeFormat: ['dd MMM'],
          };
          const collapseKey =
            item._id; /* unique id for this particular ballot */

          FCM.push(usersDeviceTokens, pushData, collapseKey);
        }

        await Ballot.update({ _id: item._id }, { isPublish: true });
      }
    }

    return true;
  } catch (e) {
    logError('publish ballot has error', e);
    logError('publish ballot has error', e.stack);
    return false;
  }
}

async function conductBallot(id) {
  try {
    logInfo('conductBallot called', id);
    const ballotId = id;
    let ballotResult = await Ballot.findOne({
      _id: ballotId,
      isConduct: false,
    }); // isConduct: false

    if (ballotResult) {
      // result for BU
      let totalDeducated = 5;

      if (ballotResult.leaveConfiguration === 2) {
        totalDeducated = 6;
      } else if (ballotResult.leaveConfiguration === 3) {
        totalDeducated = 7;
      }

      if (ballotResult.leaveType === 2) {
        totalDeducated = 1;
      }

      if (ballotResult.userFrom === 2) {
        ballotResult = JSON.stringify(ballotResult);
        ballotResult = JSON.parse(ballotResult);
        let shuffleData = [];

        shuffleData = ballotResult.slotCreation;
        ballotResult.appliedStaff.forEach((appliedStaff) => {
          const indexOfBu = ballotResult.slotCreation.findIndex(
            (x) => x.buId.toString() === appliedStaff.buId.toString(),
          );

          if (shuffleData[indexOfBu].arr[appliedStaff.weekNo].appliedStaff) {
            shuffleData[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(
              appliedStaff,
            );
          } else {
            shuffleData[indexOfBu].arr[appliedStaff.weekNo].appliedStaff = [];
            shuffleData[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(
              appliedStaff,
            );
          }
        });
        let finalWinStaff = [];

        shuffleData.forEach((staffShuffle) => {
          staffShuffle.arr.forEach((slotWise) => {
            const howMuchWin = slotWise.value;

            if (
              slotWise.appliedStaff &&
              slotWise.appliedStaff.length <= howMuchWin
            ) {
              finalWinStaff = finalWinStaff.concat(slotWise.appliedStaff);
            } else if (slotWise.appliedStaff) {
              const randomStaff = getRandomNumber(
                slotWise.appliedStaff.length,
                howMuchWin,
              );

              randomStaff.forEach((randomSelectedStaff) => {
                finalWinStaff.push(slotWise.appliedStaff[randomSelectedStaff]);
              });
            }
          });
        });
        const updateWin = await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: {
              wonStaff: finalWinStaff,
              isConduct: true,
              isResultRelease: false,
            },
          },
        );

        insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
        unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
      } else {
        // for ops group
        ballotResult = JSON.stringify(ballotResult);
        ballotResult = JSON.parse(ballotResult);

        const opsGroupQuota = [];

        const appliedStaffArray = [];

        for (let i = 0; i < ballotResult.slotCreation.length; i += 1) {
          const opsGroupSlot = ballotResult.slotCreation[i];
          // get quato for ops group
          // get quato for team
          const slotValue = {
            opsGroupId: opsGroupSlot.opsGroup.opsId,
            slotQuota: [],
          };

          opsGroupSlot.arr.forEach((arrItem, arrIndex) => {
            const key = `${arrIndex}A`;
            const slotNumber = arrIndex;
            const slotOpsGroupValue = parseInt(
              opsGroupSlot.weekRangeSlot[key].value,
              10,
            );
            const teamValue = [];
            let totalTeamQuota = 0;

            opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
              const key1 = `OG${arrIndex}OT${teamIndex}`;

              totalTeamQuota += parseInt(
                opsGroupSlot.weekRangeSlot[key1].value,
                10,
              );
              teamValue.push(
                parseInt(opsGroupSlot.weekRangeSlot[key1].value, 10),
              );
            });
            const obj = {
              slot: slotNumber,
              opsGroupQuotaValue: slotOpsGroupValue,
              opsTeamQuotaValue: teamValue,
              totalTeamQuota,
            };

            slotValue.slotQuota.push(obj);
          });
          opsGroupQuota.push(slotValue);
          let appliedStaffObject = {};

          appliedStaffObject = groupBy(ballotResult.appliedStaff, 'opsTeamId');
          const opsGroupSlotWithTeam = {
            opsGroupId: opsGroupSlot.opsGroup.opsId,
            opsTeamValue: [],
          };

          if (opsGroupSlot.opsTeam && opsGroupSlot.opsTeam.length > 0) {
            opsGroupSlot.opsTeam.forEach((teamItem) => {
              if (appliedStaffObject[teamItem._id]) {
                const ayaya = groupBy(
                  appliedStaffObject[teamItem._id],
                  'weekNo',
                );

                opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
              } else {
                opsGroupSlotWithTeam.opsTeamValue.push({});
              }
            });
          } else if (isEmpty(appliedStaffObject)) {
            // Object is empty (Would return true in this example)
          } else if (appliedStaffObject.undefined) {
            // Object is NOT empty

            const staffAyaya = appliedStaffObject.undefined.filter(
              (sta) =>
                sta.opsGroupId.toString() ===
                opsGroupSlot.opsGroup.opsId.toString(),
            );

            appliedStaffObject.undefined = [];
            appliedStaffObject.undefined = staffAyaya;
            const ayaya = groupBy(appliedStaffObject.undefined, 'weekNo');

            opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
          }

          appliedStaffArray.push(opsGroupSlotWithTeam);
        }

        let finalWinStaff = [];

        opsGroupQuota.forEach((item, topIndex) => {
          const objA = {
            opsGroupId: item.opsGroupId,
          };

          item.slotQuota.forEach((slll) => {
            objA.slot = slll.slot;
            if (slll.opsTeamQuotaValue.length === 0) {
              objA.isTeamPresent = false;
              objA.opsGroupQuotaValue = slll.opsGroupQuotaValue;
              if (
                appliedStaffArray[topIndex].opsTeamValue[0] &&
                appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`]
              ) {
                if (
                  slll.opsGroupQuotaValue >=
                  appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`]
                    .length
                ) {
                  finalWinStaff = finalWinStaff.concat(
                    appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`],
                  );
                } else {
                  const randomStaff = getRandomNumber(
                    appliedStaffArray[topIndex].opsTeamValue[0][`${slll.slot}`]
                      .length,
                    slll.opsGroupQuotaValue,
                  );

                  randomStaff.forEach((ppp) => {
                    finalWinStaff.push(
                      appliedStaffArray[topIndex].opsTeamValue[0][
                        `${slll.slot}`
                      ][ppp],
                    );
                  });
                }
              }
            } else if (slll.opsGroupQuotaValue >= slll.totalTeamQuota) {
              // all team quota should win
              slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                if (
                  appliedStaffArray[topIndex].opsTeamValue[
                    opsTeamQuotaValueIndex
                  ] &&
                  appliedStaffArray[topIndex].opsTeamValue[
                    opsTeamQuotaValueIndex
                  ][`${slll.slot}`]
                ) {
                  const len =
                    appliedStaffArray[topIndex].opsTeamValue[
                      opsTeamQuotaValueIndex
                    ][`${slll.slot}`].length;

                  // p means no of win
                  // len means no of applied
                  if (len > p) {
                    const randomStaff = getRandomNumber(len, p);

                    randomStaff.forEach((randomSelectedStaff) => {
                      finalWinStaff.push(
                        appliedStaffArray[topIndex].opsTeamValue[
                          opsTeamQuotaValueIndex
                        ][`${slll.slot}`][randomSelectedStaff],
                      );
                    });
                  } else {
                    for (let x = 0; x < len; x += 1) {
                      finalWinStaff.push(
                        appliedStaffArray[topIndex].opsTeamValue[
                          opsTeamQuotaValueIndex
                        ][`${slll.slot}`][x],
                      );
                    }
                  }
                }
              });
            } else {
              // if ops group quota value is less then total team quota
              let allAppliedStaff = [];

              slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                if (
                  appliedStaffArray[topIndex].opsTeamValue[
                    opsTeamQuotaValueIndex
                  ] &&
                  appliedStaffArray[topIndex].opsTeamValue[
                    opsTeamQuotaValueIndex
                  ][`${slll.slot}`]
                ) {
                  if (
                    p >=
                    appliedStaffArray[topIndex].opsTeamValue[
                      opsTeamQuotaValueIndex
                    ][`${slll.slot}`].length
                  ) {
                    allAppliedStaff = allAppliedStaff.concat(
                      appliedStaffArray[topIndex].opsTeamValue[
                        opsTeamQuotaValueIndex
                      ][`${slll.slot}`],
                    );
                  } else {
                    const randomStaff = getRandomNumber(
                      appliedStaffArray[topIndex].opsTeamValue[
                        opsTeamQuotaValueIndex
                      ][`${slll.slot}`].length,
                      p,
                    );

                    randomStaff.forEach((ppp) => {
                      allAppliedStaff.push(
                        appliedStaffArray[topIndex].opsTeamValue[
                          opsTeamQuotaValueIndex
                        ][`${slll.slot}`][ppp],
                      );
                    });
                  }
                }
              });
              if (allAppliedStaff.length > 0) {
                const finalAppliedStaff = [];
                const randomStaff = getRandomNumber(
                  allAppliedStaff.length,
                  allAppliedStaff.length,
                );

                randomStaff.forEach((ppp) => {
                  finalAppliedStaff.push(allAppliedStaff[ppp]);
                });
                const finalRandomStaff = getRandomNumber(
                  allAppliedStaff.length,
                  slll.opsGroupQuotaValue,
                );

                finalRandomStaff.forEach((ppp) => {
                  finalWinStaff.push(finalAppliedStaff[ppp]);
                });
              }
            }
          });
        });
        const updateWin = await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: {
              wonStaff: finalWinStaff,
              isConduct: true,
              isResultRelease: false,
            },
          },
        );

        insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
        unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
      }
    }

    logInfo('conductBallot not found', id);
    return true;
  } catch (e) {
    logError('conductBallot has error', e);
    logError('conductBallot has error', e.stack);
    return false;
  }
}

const ballot = new BallotController();

module.exports = { ballot, conductBallot, publishBallot, resultReleaseFun };
