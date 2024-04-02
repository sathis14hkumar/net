/*
const json2csv = require('json2csv').parse;
const mongoose = require('mongoose'),
  Shift = require('../app/models/shift'),
  Attendance = require('../app/models/attendance');
const SubSection = require('../app/models/subSection'),
  ShiftDetails = require('../app/models/shiftDetails'),
  AssignShift = require('../app/models/assignShift'),
  _ = require('lodash'),
  __ = require('./globalFunctions');
const CronJob = require('cron').CronJob;
var moment = require('moment');
const redisClient = require('../helpers/redis.js');
const WeeklyStaffData = require('../app/controllers/company/weeklyStaffingController');
const OpsGroup = require('../app/models/ops'),
  User = require('../app/models/user');
let buIdsArr = [];
let buIdsWithWeek = [];

class redisData {
  async check(from) {
    //console.log("env ", process.env.LOCAL_DB_HOST)
    //console.log("cron check for redis " + from)
  }
  // timesheet dashbaord api start
  async readModifyAshish(buIds) {
    //console.log("Redis Call Read Modify")
    let allBuId = [];
    if (!buIds) {
      allBuId = buIdsArr;
      // get all BU
    } else {
      allBuId.push(buIds);
    }
    // redis key businessUnitId+timeDashbaord
    let date = new Date(moment.utc().format());
    let timeZone = '+0800';
    let currentDateTime = new Date(
      moment(new Date()).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
    );
    let currentDateTimeStart = new Date(
      moment(new Date()).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
    );
    date = new Date(
      moment(date).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
    );
    date = new Date(date.setHours(0, 0, 0, 0));
    let daysBefore = 3;
    let startDateTime = new Date(
      new Date(date).getTime() - daysBefore * 24 * 60 * 60 * 1000,
    );
    startDateTime = new Date(startDateTime).toUTCString();
    date = new Date(moment.utc().format());
    date = new Date(date.setHours(0, 0, 0, 0));
    let endDateTime = new Date(
      currentDateTime.setHours(currentDateTime.getHours() + 18),
    );
    let newStartTime = new Date(
      currentDateTimeStart.setHours(currentDateTimeStart.getHours() - 18),
    );
    for (let b = 0; b < allBuId.length; b++) {
      // async.eachSeries(
      //     results, (item, next) => {
      const buId = allBuId[b];
      //console.log("buId", buId)
      Shift.aggregate([
        {
          $match: {
            businessUnitId: mongoose.Types.ObjectId(buId),
            weekRangeStartsAt: {
              $lte: new Date(new Date(endDateTime).toISOString()),
            },
            weekRangeEndsAt: {
              $gte: new Date(new Date(startDateTime).toISOString()),
            },
          },
        },

        {
          $lookup: {
            from: 'shiftdetails',
            localField: '_id',
            foreignField: 'shiftId',
            as: 'shiftDetails',
          },
        },
        {
          $unwind: '$shiftDetails',
        },
        {
          $match: {
            'shiftDetails.status': 1,
            'shiftDetails.startTime': {
              $lte: new Date(new Date(endDateTime).toISOString()),
            },
            'shiftDetails.endTime': {
              $gte: new Date(new Date(newStartTime).toISOString()),
            },
          },
        },
        {
          $unwind: '$shiftDetails.confirmedStaffs',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'shiftDetails.confirmedStaffs',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: '$userInfo',
        },
        {
          $lookup: {
            from: 'appointments',
            localField: 'userInfo.appointmentId',
            foreignField: '_id',
            as: 'appointmentInfo',
          },
        },
        {
          $unwind: '$appointmentInfo',
        },
        { $sort: { 'shiftDetails.date': -1 } },
        {
          $project: {
            _id: 1,
            businessUnitId: 1,
            weekRangeStartsAt: 1,
            weekRangeEndsAt: 1,
            'userInfo.name': 1,
            'userInfo.facialId': 1,
            'userInfo._id': 1,
            'userInfo.staffId': 1,
            'userInfo.contactNumber': 1,
            'userInfo.appointmentId': 1,
            'shiftDetails.startTime': 1,
            'shiftDetails.endTime': 1,
            'shiftDetails.day': 1,
            'shiftDetails.date': 1,
            'shiftDetails._id': 1,
            'shiftDetails.confirmedStaffs': 1,
            'shiftDetails.shiftId': 1,
            'shiftDetails.isExtendedShift': 1,
            'shiftDetails.extendedStaff': 1,
            'shiftDetails.isSplitShift': 1,
            'shiftDetails.isAssignShift': 1,
            'appointmentInfo.name': 1,
          },
        },
      ])
        .then(async (results) => {
          //console.log('total shift found', results.length);
          const hours_6_mili = 60000 * 540;
          if (results.length > 0) {
            const finalResult = [];
            results.forEach((item, index) => {
              let startMili = 0;
              if (item.shiftDetails.startTime) {
                startMili = new Date(item.shiftDetails.startTime).getTime();
              }
              let endMili = 0;
              if (item.shiftDetails.endTime) {
                endMili = new Date(item.shiftDetails.endTime).getTime();
              }
              if (
                startMili - new Date().getTime() <= hours_6_mili &&
                new Date().getTime() - endMili <= hours_6_mili
              ) {
                item.isFacial = false;
                if (item.userInfo.facialId) {
                  item.isFacial = true;
                }
                finalResult.push(
                  this.getAttendanceDataForReadModifyAshish(item),
                );
              }
            });
            results = await Promise.all(finalResult);
            //console.log("ALl resiltt", results.length)
            this.filterDataForDashbaord(results, buId);
          } else {
            this.setRedisData(`${buId}timeDashboard`, []);
          }
        })
        .catch((err) => {
          this.setRedisData(`${buId}timeDashboard`, []);
        });
    }
  }
  async getAttendanceDataForReadModifyAshish(item) {
    return new Promise((resolve, reject) => {
      if (item.userInfo) {
        Attendance.findOne({
          userId: item.userInfo._id,
          shiftDetailId: item.shiftDetails._id,
        })
          .then((attendance) => {
            item.attendance = attendance;
            if (!attendance) {
              delete item.attendance;
            }
            resolve(item);
          })
          .catch((err) => {
            resolve(null);
          });
      } else {
        resolve(null);
      }
    });
  }
  async filterDataForDashbaord(results, buId) {
    const newResult = [];
    results.forEach((item, index) => {
      if (item) {
        const timeZoneP = item.shiftDetails.timeZone
          ? item.shiftDetails.timeZone
          : '+0800';
        const dayP = item.day;
        const dayPN = moment(new Date(item.shiftDetails.date))
          .utcOffset(timeZoneP)
          .format('DD-MM-YYYY');
        item.shiftDetails.day = dayPN;

        if (
          !item.attendance ||
          (item.attendance && item.attendance.status != 2)
        ) {
          newResult.push(item);
        }
      }
    });
    if (newResult.length > 0) {
      newResult.forEach((item, index) => {
        if (item.shiftDetails.isExtendedShift) {
          const userId = item.userInfo._id;
          const extendData = item.shiftDetails.extendedStaff.find(
            (extendData) => {
              return (
                extendData.userId.toString() === userId.toString() &&
                extendData.confirmStatus === 2
              );
            },
          );
          if (extendData) {
            item.shiftDetails.extendedStaff = [];
            item.shiftDetails.extendedStaff[0] = extendData;
            item.shiftDetails.startTime = extendData.startDateTime;
            item.shiftDetails.endTime = extendData.endDateTime;
          } else {
            item.shiftDetails.extendedStaff = [];
          }
        }
        if (item.shiftDetails.isSplitShift) {
          newResult.some((splitItem, splitIndex) => {
            if (
              index !== splitIndex &&
              splitItem.shiftDetails.isSplitShift &&
              item.shiftDetails.shiftId.toString() ==
                splitItem.shiftDetails.shiftId.toString() &&
              new Date(item.shiftDetails.date).getTime() ==
                new Date(splitItem.shiftDetails.date).getTime() &&
              item.shiftDetails.confirmedStaffs.toString() ==
                splitItem.shiftDetails.confirmedStaffs.toString()
            ) {
              if (
                item.shiftDetails.startTime < splitItem.shiftDetails.startTime
              ) {
                //console.log(item.shiftDetails.day);
                if (splitItem.attendance) {
                  item.splitAttendance = splitItem.attendance;
                }
                item.shiftDetails.splitShiftObj = splitItem.shiftDetails;
                newResult.splice(splitIndex, 1);
              } else {
                if (item.attendance) {
                  splitItem.splitAttendance = item.attendance;
                }
                splitItem.shiftDetails.splitShiftObj = item.shiftDetails;
                newResult.splice(index, 1);
              }
              return true;
            }
          });
        }
      });
      newResult.sort(function (a, b) {
        return a.shiftDetails.startTime && b.shiftDetails.startTime
          ? new Date(a.shiftDetails.startTime).getTime() -
              new Date(b.shiftDetails.startTime).getTime()
          : null;
      });
      this.setRedisData(`${buId}timeDashboard`, newResult);
    } else {
      this.setRedisData(`${buId}timeDashboard`, []);
    }
  }
  // timesheet dashbaord api end
  setRedisData(key, data) {
    redisClient.set(key, JSON.stringify(data), 'EX', 10 * 60, (err) => {
      //cache for 10mins
      if (err) {
      }

      //other operations will go here
      //probably respond back to the request
    });
  }
  // timesheet timesheet api start
  async timesheetData(buIds) {
    // timesheet page businessUnitId+timeTimesheet
    //console.log("Redis Call timesheetData")
    let allBuId = [];
    if (!buIds) {
      allBuId = buIdsArr;
      // get all BU
    } else {
      allBuId.push(buIds);
    }
    let date = new Date(moment.utc().format());
    date = new Date(date.setHours(0, 0, 0, 0));
    let startDateTime = date.setHours(date.getHours() - 19);
    startDateTime = new Date(startDateTime).toUTCString();
    date = new Date(moment.utc().format());
    date = new Date(date.setHours(0, 0, 0, 0));
    let endDateTime = date.setHours(date.getHours() + 43);
    endDateTime = new Date(endDateTime).toUTCString();
    //console.log('start', new Date(startDateTime), new Date(endDateTime))
    for (let b = 0; b < allBuId.length; b++) {
      const buId = allBuId[b];
      const redisKey = `${buId}timeTimesheet`;
      Shift.aggregate([
        {
          $match: {
            businessUnitId: mongoose.Types.ObjectId(buId),
            weekRangeStartsAt: {
              $lte: new Date(new Date(endDateTime).toISOString()),
            },
            weekRangeEndsAt: {
              $gte: new Date(new Date(startDateTime).toISOString()),
            },
          },
        },

        {
          $lookup: {
            from: 'shiftdetails',
            localField: '_id',
            foreignField: 'shiftId',
            as: 'shiftDetails',
          },
        },
        {
          $unwind: '$shiftDetails',
        },
        {
          $match: {
            'shiftDetails.status': 1,
            'shiftDetails.date': {
              $lte: new Date(new Date(endDateTime).toISOString()),
              $gte: new Date(new Date(startDateTime).toISOString()),
            },
            'shiftDetails.startTime': { $ne: null },
          },
        },

        {
          $unwind: '$shiftDetails.confirmedStaffs',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'shiftDetails.confirmedStaffs',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: '$userInfo',
        },
        {
          $lookup: {
            from: 'schemes',
            localField: 'userInfo.schemeId',
            foreignField: '_id',
            as: 'schemeInfo',
          },
        },
        {
          $unwind: {
            path: '$schemeInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            businessUnitId: 1,
            weekRangeStartsAt: 1,
            weekRangeEndsAt: 1,
            'userInfo.name': 1,
            'userInfo._id': 1,
            'userInfo.staffId': 1,
            'userInfo.contactNumber': 1,
            'userInfo.appointmentId': 1,
            'userInfo.schemeId': 1,
            'shiftDetails.startTime': 1,
            'shiftDetails.endTime': 1,
            'shiftDetails.day': 1,
            'shiftDetails.date': 1,
            'shiftDetails._id': 1,
            'shiftDetails.shiftId': 1,
            'shiftDetails.duration': 1,
            'shiftDetails.isSplitShift': 1,
            'shiftDetails.confirmedStaffs': 1,
            'shiftDetails.isExtendedShift': 1,
            'shiftDetails.extendedStaff': 1,
            'shiftDetails.isAssignShift': 1,
            'schemeInfo.shiftSetup': 1,
          },
        },
      ])
        .then(async (results) => {
          if (results.length > 0) {
            const final = [];
            for (let i = 0; i < results.length; i++) {
              final.push(this.getAttendanceDataForTimesheetData(results[i]));
            }

            const allData = await Promise.all(final);
            this.sendTimesheetData(allData, redisKey);
          } else {
            this.setRedisData(redisKey, []);
          }
        })
        .catch((err) => {});
    }
  }
  async getAttendanceDataForTimesheetData(item) {
    return new Promise((resolve, reject) => {
      if (item.userInfo) {
        Attendance.findOne({
          userId: item.userInfo._id,
          shiftDetailId: item.shiftDetails._id,
        })
          .then((attendance) => {
            if (attendance) {
              attendance = JSON.stringify(attendance);
              attendance = JSON.parse(attendance);
              item.attendance = attendance;
              if (
                item.attendance.approval.breakTime &&
                item.attendance.approval.breakTime.length === 0
              ) {
                item.attendance.approval.breakTime = null;
              }
              if (
                item.attendance.approval.breakTime &&
                item.attendance.approval.breakTime.length === 1
              ) {
                if (!item.attendance.approval.breakTime[0]) {
                  item.attendance.approval.breakTime.length = 0;
                  item.attendance.approval.breakTime = null;
                }
              }
              resolve(item);
            } else {
              resolve(item);
            }
          })
          .catch((err) => {
            resolve(null);
          });
      } else {
        resolve(null);
      }
    });
  }
  async sendTimesheetData(results, redisKey) {
    // //console.log('aaaher');
    results.sort(function (a, b) {
      return a &&
        a.shiftDetails &&
        a.shiftDetails.date &&
        b &&
        b.shiftDetails &&
        b.shiftDetails.date
        ? new Date(a.shiftDetails.date).getTime() -
            new Date(b.shiftDetails.date).getTime()
        : null;
    });
    results.sort(function (a, b) {
      return a &&
        a.shiftDetails &&
        a.shiftDetails.startTime &&
        b &&
        b.shiftDetails &&
        b.shiftDetails.startTime
        ? new Date(a.shiftDetails.startTime).getTime() -
            new Date(b.shiftDetails.startTime).getTime()
        : null;
    });
    const newArrayResult = [];
    results.forEach((item, index) => {
      if (item) {
        if (item.schemeInfo) {
          item.schemeInfo = item.schemeInfo.shiftSetup;
        }
        if (item.shiftDetails.isExtendedShift) {
          //console.log('inside')
          const userId = item.userInfo._id;
          const extendData = item.shiftDetails.extendedStaff.find(
            (extendData) => {
              return (
                extendData.userId.toString() === userId.toString() &&
                extendData.confirmStatus === 2
              );
            },
          );
          if (extendData) {
            item.shiftDetails.extendedStaff = [];
            item.shiftDetails.extendedStaff[0] = extendData;
            //  item.shiftDetails.startTime = extendData.startDateTime;
            //item.shiftDetails.endTime = extendData.endDateTime;
          } else {
            item.shiftDetails.extendedStaff = [];
          }
        }
        if (!newArrayResult.includes(item)) {
          if (item.shiftDetails.isSplitShift) {
            // //console.log('aaaaa');
            let isFound = false;
            results.some((splitItem, splitIndex) => {
              if (
                index !== splitIndex &&
                splitItem.shiftDetails.isSplitShift &&
                item.shiftDetails.shiftId.toString() ==
                  splitItem.shiftDetails.shiftId.toString() &&
                new Date(item.shiftDetails.date).getTime() ==
                  new Date(splitItem.shiftDetails.date).getTime() &&
                item.shiftDetails.confirmedStaffs.toString() ==
                  splitItem.shiftDetails.confirmedStaffs.toString()
              ) {
                // //console.log('insplit');
                isFound = true;
                if (
                  item.shiftDetails.startTime < splitItem.shiftDetails.startTime
                ) {
                  item.position = 1;
                  splitItem.position = 2;
                  newArrayResult.push(item);
                  newArrayResult.push(splitItem);
                } else {
                  item.position = 2;
                  splitItem.position = 1;
                  newArrayResult.push(splitItem);
                  newArrayResult.push(item);
                }
                return true;
              }
            });
            if (!isFound) {
              newArrayResult.push(item);
            }
          } else {
            newArrayResult.push(item);
          }
        }
      }
    });
    this.setRedisData(`${redisKey}`, newArrayResult);
  }
  // timesheet timesheet api end

  // timesheet history api start
  async history(buIds) {
    //console.log("Redis Call history")
    let allBuId = [];
    if (!buIds) {
      allBuId = buIdsArr;
    } else {
      allBuId.push(buIds);
    }
    // 5cda857e94827c2775164834+his+2020-12-31+2021-01-06
    // {"startDate":"2020-12-31","endDate":"2021-01-06"}
    const bodyEnd = moment().format('YYYY-MM-DD').toString();
    const bodyStart = moment()
      .subtract(6, 'days')
      .format('YYYY-MM-DD')
      .toString();

    //console.log("bodyStart", bodyStart, bodyEnd, typeof bodyStart)
    let startDateTime = new Date(bodyStart);
    startDateTime = startDateTime.setDate(startDateTime.getDate() - 1);
    startDateTime = new Date(startDateTime);
    let endDateTime = new Date(bodyEnd);
    endDateTime = endDateTime.setDate(endDateTime.getDate());
    endDateTime = new Date(endDateTime);
    //console.log(startDateTime, endDateTime)
    //console.log("ISO ", new Date(new Date(endDateTime).toISOString()), new Date(new Date(startDateTime).toISOString()))
    for (let b = 0; b < allBuId.length; b++) {
      const buId = allBuId[b];
      //console.log("buId", buId)
      const redisKey = `${buId}his${bodyStart.replace(
        /-/g,
        '_',
      )}${bodyEnd.replace(/-/g, '_')}`;
      Shift.aggregate([
        {
          $match: {
            businessUnitId: mongoose.Types.ObjectId(buId),
            weekRangeStartsAt: {
              $lte: new Date(new Date(endDateTime).toISOString()),
            },
            weekRangeEndsAt: {
              $gte: new Date(new Date(startDateTime).toISOString()),
            },
          },
        },

        {
          $lookup: {
            from: 'shiftdetails',
            localField: '_id',
            foreignField: 'shiftId',
            as: 'shiftDetails',
          },
        },
        {
          $unwind: '$shiftDetails',
        },
        {
          $match: {
            'shiftDetails.status': 1,
            'shiftDetails.date': {
              $lte: new Date(new Date(endDateTime).toISOString()),
              $gte: new Date(new Date(startDateTime).toISOString()),
            },
          },
        },

        {
          $unwind: '$shiftDetails.confirmedStaffs',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'shiftDetails.confirmedStaffs',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: '$userInfo',
        },
        {
          $lookup: {
            from: 'schemes',
            localField: 'userInfo.schemeId',
            foreignField: '_id',
            as: 'schemeInfo',
          },
        },
        {
          $unwind: {
            path: '$schemeInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            businessUnitId: 1,
            weekRangeStartsAt: 1,
            weekRangeEndsAt: 1,
            'userInfo.name': 1,
            'userInfo._id': 1,
            'userInfo.staffId': 1,
            'userInfo.contactNumber': 1,
            'userInfo.appointmentId': 1,
            'userInfo.schemeId': 1,
            'shiftDetails.startTime': 1,
            'shiftDetails.endTime': 1,
            'shiftDetails.day': 1,
            'shiftDetails.date': 1,
            'shiftDetails._id': 1,
            'shiftDetails.shiftId': 1,
            'shiftDetails.duration': 1,
            'shiftDetails.isSplitShift': 1,
            'shiftDetails.confirmedStaffs': 1,
            'shiftDetails.isExtendedShift': 1,
            'shiftDetails.extendedStaff': 1,
            'shiftDetails.isAssignShift': 1,
            'schemeInfo.shiftSetup': 1,
          },
        },
      ]).then(async (results) => {
        const len = results.length;
        //console.log("lenrfee", len)
        const getAllData = [];
        if (len > 0) {
          for (let i = 0; i < len; i++) {
            getAllData.push(this.getAttendanceDataTimeSheet(results[i]));
          }
          const resultAll = await Promise.all(getAllData);
          this.sendTimesheetData(resultAll, redisKey);
        } else {
          this.setRedisData(`${redisKey}`, []);
        }
      });
    }
  }
  async getAttendanceDataTimeSheet(item) {
    return new Promise((resolve, reject) => {
      if (item.userInfo) {
        Attendance.findOne({
          userId: item.userInfo._id,
          shiftDetailId: item.shiftDetails._id,
        })
          .then((attendance) => {
            if (attendance) {
              attendance = JSON.stringify(attendance);
              attendance = JSON.parse(attendance);
              item.attendance = attendance;
              if (item.attendance.approval.breakTime.length === 0) {
                item.attendance.approval.breakTime = null;
              }
              if (item.attendance.approval.breakTime.length === 1) {
                if (!item.attendance.approval.breakTime[0]) {
                  item.attendance.approval.breakTime.length = 0;
                  item.attendance.approval.breakTime = null;
                }
              }
              resolve(item);
            } else {
              resolve(item);
            }
          })
          .catch((err) => {
            resolve(item);
          });
      } else {
        resolve(item);
      }
    });
  }
  // timesheet history api end

  //shift read API

  async readNewNext(buIds) {
    try {
      //shiftR{currentDate}
      let allBuId = [];
      if (!buIds) {
        allBuId = buIdsWithWeek;
      } else {
        const weekDetails = await SubSection.findOne(
          { _id: buIds },
          { noOfWeek: 1 },
        );
        allBuId.push({ buId: buIds, week: weekDetails.noOfWeek });
      }
      //console.log('callee');
      // //console.log("all BU ", allBuId.length)
      const mondayDate = getMonday(new Date());
      for (let buIndex = 0; buIndex < allBuId.length; buIndex++) {
        const noOfWeek = allBuId[buIndex].week;
        // //console.log("noOfWeek", noOfWeek)
        const buId = allBuId[buIndex].buId;
        for (let weekIndex = 0; weekIndex < noOfWeek; weekIndex++) {
          const currentDate = moment(new Date(mondayDate))
            .add(weekIndex * 7, 'days')
            .utcOffset(480)
            .format('MM-DD-YYYY');
          //console.log("CurrentDate ", currentDate);
          const body = {
            startDate: `${currentDate} 00:00:00 GMT+0800`,
            date: `${currentDate} 00:00:00 GMT+0800`,
            businessUnitId: buId,
          };
          const redisKey = `shiftR${buId}${currentDate}`;
          // //console.log("redisKey", redisKey)
          if (false) {
          } else {
            var where = {
                status: 1,
              },
              findOrFindOne;
            //console.log(body)
            var timeZone = moment
                .parseZone(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
                .format('Z'),
              startDate = moment(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
                .utc()
                .format(), //.add(1,'days') remove to get monday shift
              endDate = moment(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
                .add(5, 'days')
                .add(23, 'hours')
                .add(60, 'minutes')
                .add(59, 'seconds')
                .utc()
                .format(); //86399 => add 23:59:59
            //console.log('startDate11', startDate)
            //console.log("endsdhhd", endDate)
            const aa = new Date(startDate).setUTCHours(0, 0, 0, 0);
            const bb = new Date(endDate).setUTCHours(24, 0, 0, 0);
            startDate = new Date(aa);
            endDate = new Date(bb);
            //console.log('startDate', startDate);
            //console.log('endddd', endDate);
            var startUnixDateTime = moment(startDate).unix(),
              endUnixDateTime = moment(endDate).unix();
            const ddd = moment(new Date(body.startDate))
              .utc()
              .format('MM-DD-YYYY HH:mm:ss Z');
            const year = new Date(ddd).getFullYear();
            const month = new Date(ddd).getMonth() + 1;
            const day = new Date(ddd).getDate(); //-1; // remove comment for local ashish
            //console.log('yy', year, month, day);
            const whereShift = {
              //  staff_id:{$in: usersOfBu},
              businessUnitId: body.businessUnitId,
              status: 1,
              $and: [
                { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
                { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
                {
                  $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] },
                },
              ],
            };
            var shift = await Shift.find(whereShift)
              .select('shiftDetails')
              .lean();
            //console.log('shofttttt', shift.length)
            function plucker(prop) {
              return function (o) {
                return o[prop];
              };
            }
            var shiftDetailsArray = shift.map(plucker('shiftDetails'));
            shiftDetailsArray = _.flatten(shiftDetailsArray);

            shiftDetailsArray = Array.from(new Set(shiftDetailsArray));

            var weekNumber = await __.weekNoStartWithMonday(startDate);
            where = {
              status: 1,
              _id: {
                $in: shiftDetailsArray,
              },
            };
            where.date = {
              $gte: startDate,
              $lte: endDate,
            };
            findOrFindOne = ShiftDetails.find(where);
            let shifts = await findOrFindOne
              .populate([
                { path: 'appliedStaffs' },
                {
                  path: 'draftId',
                  select:
                    'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
                },
                {
                  path: 'shiftId',
                  select: '-shiftDetails',
                  match: {
                    businessUnitId: mongoose.Types.ObjectId(
                      body.businessUnitId,
                    ),
                  },
                  populate: [
                    {
                      path: 'plannedBy',
                      select: 'name staffId',
                    },
                    {
                      path: 'businessUnitId',
                      select:
                        'name adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'sectionId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                        populate: {
                          path: 'departmentId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                          populate: {
                            path: 'companyId',
                            select: 'name status',
                            match: {
                              status: 1,
                            },
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  path: 'reportLocationId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'subSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'skillSetId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
                {
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'confirmedStaffs',
                  select:
                    'name email contactNumber profilePicture subSkillSets mainSkillSets status,schemeId staffId',
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                    {
                      path: 'schemeId',
                      select: 'shiftSetup ',
                      match: {
                        status: true,
                      },
                    },
                  ],
                },
                {
                  path: 'backUpStaffs',
                  select:
                    'name email contactNumber profilePicture mainSkillSets subSkillSets status,schemeId staffId',
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                    {
                      path: 'schemeId',
                      select: 'shiftSetup',
                      match: {
                        status: true,
                      },
                    },
                  ],
                },
                {
                  path: 'requestedShifts',
                },
                {
                  path: 'currentReqShift',
                  populate: {
                    path: 'reportLocationId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
                {
                  path: 'requestedUsers.userId',
                  match: {
                    status: 1,
                  },
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                  ],
                },
              ])
              .sort({
                startTime: -1,
              });
            if (!body.shiftDetailsId) {
              var listData = {},
                graphData = {},
                graphDataWeb = {},
                dashboardGraphData = {
                  plannedFlexiHours: 0,
                  plannedFlexiShifts: 0,
                  bookedFlexiHours: 0,
                  bookedFlexiShifts: 0,
                  assignFlexiHours: 0,
                  assignFlexiShifts: 0,
                  assignFlexiStaff: 0,
                },
                customShiftDetails = [];
              shifts = shifts.filter((iii) => {
                return iii.shiftId;
              });
              await shifts.forEach((element) => {
                element = JSON.parse(JSON.stringify(element));
                //console.log('element', element.isAssignShift)
                let totalExtension = 0;
                let totalExtensionHrs = 0;
                if (
                  (((element.mainSkillSets && element.mainSkillSets.length) ||
                    (element.subSkillSets && element.subSkillSets.length)) &&
                    element.reportLocationId &&
                    element.shiftId &&
                    element.shiftId.businessUnitId) ||
                  element.isAssignShift
                ) {
                  let tz = element.timeZone;
                  if (!tz) {
                    tz = '+0800';
                  }
                  var key = __.getDateStringFormat(element.date, tz);
                  for (let ki = 0; ki < element.confirmedStaffs.length; ki++) {
                    // console.log('I am here in comfired');
                    const uCI = element.confirmedStaffs[ki];
                    let startDI = element.startTime;
                    let endDI = element.endTime;
                    if (element.isExtendedShift) {
                      const uCIResult = element.extendedStaff.filter((uI) => {
                        return (
                          uI.userId.toString() == uCI._id &&
                          uI.confirmStatus == 2
                        );
                      });
                      if (uCIResult.length > 0) {
                        if (uCIResult[0].confirmStatus == 2) {
                          totalExtension = totalExtension + 1;
                          totalExtensionHrs =
                            totalExtensionHrs + uCIResult[0].duration;
                        }
                        startDI = uCIResult[0].startDateTime;
                        endDI = uCIResult[0].endDateTime;
                      }
                    }
                    element.confirmedStaffs[ki].startTime = moment(
                      new Date(startDI),
                    )
                      .utcOffset(timeZone)
                      .format('HH:mm');
                    element.confirmedStaffs[ki].endTime = moment(
                      new Date(endDI),
                    )
                      .utcOffset(timeZone)
                      .format('HH:mm');
                    element.confirmedStaffs[ki].startDate = moment(
                      new Date(startDI),
                    )
                      .utcOffset(timeZone)
                      .format('DD-MM-YYYY');
                    element.confirmedStaffs[ki].endDate = moment(
                      new Date(endDI),
                    )
                      .utcOffset(timeZone)
                      .format('DD-MM-YYYY');
                  }
                  if (element.status == 1) {
                    // dashboard graph data starts
                    //console.log('element.isAssignShift', element.isAssignShift)
                    if (!element.isAssignShift) {
                      var confirmedStaffsCount = element.confirmedStaffs.length;
                      dashboardGraphData.plannedFlexiHours +=
                        (element.staffNeedCount - totalExtension) *
                          element.duration +
                        totalExtensionHrs;

                      dashboardGraphData.plannedFlexiShifts +=
                        element.staffNeedCount;

                      dashboardGraphData.bookedFlexiHours +=
                        (confirmedStaffsCount - totalExtension) *
                          element.duration +
                        totalExtensionHrs;

                      dashboardGraphData.bookedFlexiShifts +=
                        confirmedStaffsCount;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        var confirmedStaffsCount =
                          element.confirmedStaffs.length;
                        if (element.isExtendedShift) {
                          const extendStaff = element.extendedStaff[0];
                          var hours =
                            Math.abs(
                              new Date(extendStaff.startDateTime).getTime() -
                                new Date(extendStaff.endDateTime).getTime(),
                            ) / 36e5;
                          dashboardGraphData.assignFlexiHours += hours;
                        } else {
                          dashboardGraphData.assignFlexiHours +=
                            element.staffNeedCount * element.duration;
                        }

                        dashboardGraphData.assignFlexiShifts +=
                          element.staffNeedCount;
                        dashboardGraphData.assignFlexiStaff +=
                          element.staffNeedCount;
                      }
                    }
                  }
                  //dashboard graph data ends 

                  // Remove Cancelled Shifts on Calculation

                  if (listData[key]) {
                    // if date already keyed in array 
                    listData[key].push(element);
                    // Add Hours in calculation only it is active shift
                    if (element.status == 1 && !element.isAssignShift) {
                      //console.log('1', key);
                      graphData[key].totalHours +=
                        element.duration *
                          (element.staffNeedCount - totalExtension) +
                        totalExtensionHrs;
                      graphData[key].totalShifts += element.staffNeedCount;
                      graphDataWeb[key].totalHours.need +=
                        element.duration *
                          (element.staffNeedCount - totalExtension) +
                        totalExtensionHrs;

                      graphDataWeb[key].totalHours.booked +=
                        element.duration *
                          (element.confirmedStaffs.length - totalExtension) +
                        totalExtensionHrs;

                      graphDataWeb[key].numberOfShifts.need +=
                        element.staffNeedCount;

                      graphDataWeb[key].numberOfShifts.booked +=
                        element.confirmedStaffs.length;

                      graphDataWeb[key].totalHours.needAssign += 0;
                      graphDataWeb[key].numberOfShifts.needAssign += 0;
                      graphData[key].totalHoursAssign += 0;
                      graphData[key].totalShiftsAssign += 0;
                      graphData[key].assignFlexiStaff += 0;
                    } else {
                      if (element.status == 1) {
                        var isRecalled =
                          element.isRest || element.isOff ? true : false;
                        if (
                          (!isRecalled ||
                            (isRecalled && element.isRecallAccepted == 2)) &&
                          body.from != 'viewbooking'
                        ) {
                          //console.log('11', key);
                          graphData[key].totalHoursAssign +=
                            element.duration * element.staffNeedCount;
                          graphData[key].totalShiftsAssign +=
                            element.staffNeedCount;
                          graphData[key].assignFlexiStaff +=
                            element.staffNeedCount;
                          graphDataWeb[key].totalHours.needAssign +=
                            element.duration * element.staffNeedCount;
                          graphDataWeb[key].numberOfShifts.needAssign +=
                            element.staffNeedCount;

                          graphData[key].totalHours += 0;
                          graphData[key].totalShifts += 0;
                          graphDataWeb[key].totalHours.need += 0;

                          graphDataWeb[key].totalHours.booked += 0;

                          graphDataWeb[key].numberOfShifts.need += 0;

                          graphDataWeb[key].numberOfShifts.booked += 0;
                        }
                      }
                    }
                  } else {
                    // else create a new key by date in array
                    listData[key] = [];
                    listData[key].push(element);
                    graphData[key] = {};
                    graphData[key].totalHours = 0;
                    graphData[key].totalShifts = 0;
                    graphData[key].totalHoursAssign = 0;
                    graphData[key].totalShiftsAssign = 0;
                    graphData[key].assignFlexiStaff = 0;
                    graphDataWeb[key] = {
                      totalHours: {
                        need: 0,
                        booked: 0,
                        needAssign: 0,
                      },
                      numberOfShifts: {
                        need: 0,
                        booked: 0,
                        needAssign: 0,
                      },
                    };
                    // Add Hours in calculation only it is active shift
                    if (element.status == 1 && !element.isAssignShift) {
                      graphData[key].totalHours =
                        element.duration *
                          (element.staffNeedCount - totalExtension) +
                        totalExtensionHrs;
                      graphData[key].totalShifts = element.staffNeedCount;
                      graphDataWeb[key] = {
                        totalHours: {
                          need:
                            element.duration *
                              (element.staffNeedCount - totalExtension) +
                            totalExtensionHrs,
                          booked:
                            element.duration *
                              (element.confirmedStaffs.length -
                                totalExtension) +
                            totalExtensionHrs,
                          needAssign: 0,
                        },
                        numberOfShifts: {
                          need: element.staffNeedCount,
                          booked: element.confirmedStaffs.length,
                          needAssign: 0,
                        },
                      };

                      graphData[key].totalHoursAssign = 0;
                      graphData[key].totalShiftsAssign = 0;
                      graphData[key].assignFlexiStaff = 0;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;

                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        //  //console.log('all here')
                        graphData[key].totalHoursAssign =
                          element.duration * element.staffNeedCount;
                        graphData[key].totalShiftsAssign =
                          element.staffNeedCount;
                        graphData[key].assignFlexiStaff =
                          element.staffNeedCount;
                        graphDataWeb[key] = {
                          totalHours: {
                            needAssign:
                              element.duration * element.staffNeedCount,
                          },
                          numberOfShifts: {
                            needAssign: element.staffNeedCount,
                          },
                        };

                        graphData[key].totalHours = 0;
                        graphData[key].totalShifts = 0;
                        graphDataWeb[key].totalHours.need = 0;

                        graphDataWeb[key].totalHours.booked = 0;

                        graphDataWeb[key].numberOfShifts.need = 0;

                        graphDataWeb[key].numberOfShifts.booked = 0;
                      }
                    }
                  }

                  var customElement = _.omit(element, [
                    'shiftId',
                    'reportLocationId',
                    'subSkillSets',
                    'mainSkillSets',
                  ]);
                  customShiftDetails.push(customElement);
                }
              });

              // weeklyGraph starts

              var staffNeedWeekdaysObj = {
                  monday: {},
                  tuesday: {},
                  wednesday: {},
                  thursday: {},
                  friday: {},
                  saturday: {},
                  sunday: {},
                },
                staffAppliedWeekdaysObj = _.cloneDeep(staffNeedWeekdaysObj);
              var staffNeedWeekdaysObjAssign = {
                  monday: {},
                  tuesday: {},
                  wednesday: {},
                  thursday: {},
                  friday: {},
                  saturday: {},
                  sunday: {},
                },
                staffAppliedWeekdaysObjAssign = _.cloneDeep(
                  staffNeedWeekdaysObjAssign,
                );
              startUnixDateTime += 86400;
              endUnixDateTime += 86400;
              for (let i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
                var dateTimeUnix = i * 1000;
                customShiftDetails = JSON.parse(
                  JSON.stringify(customShiftDetails),
                );
                await customShiftDetails.forEach(async (element) => {
                  var weekDay = __.getDayStringFormatFromUnix(i, 'GMT+0000'),
                    staffNeedCount = 0,
                    appliedStaffCount = 0,
                    staffNeedCountAssign = 0,
                    appliedStaffCountAssing = 0;

                  // if(element.isAssignShift){
                  //     //console.log('aaaaaaaaaa');
                  //     //console.log(i, element.startTimeInSeconds)
                  //     element.startTimeInSeconds = element.startTimeInSeconds/1000;
                  //     element.endTimeInSeconds = element.endTimeInSeconds/1000;
                  //     //console.log(i, element.startTimeInSeconds)

                  // }
                  //   //console.log(i, element.startTimeInSeconds)
                  if (
                    i >= element.startTimeInSeconds &&
                    i <= element.endTimeInSeconds
                  ) {
                    //shift matches the time then it will take the count else it will assign 0 by default 
                    if (!element.isAssignShift) {
                      //console.log('inthis')
                      staffNeedCount = element.staffNeedCount;
                      appliedStaffCount = element.confirmedStaffs.length;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        staffNeedCountAssign = element.staffNeedCount;
                        appliedStaffCountAssing =
                          element.confirmedStaffs.length;
                      }
                    }
                  }
                  //if(!element.isAssignShift){
                  if (
                    typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it

                    staffNeedWeekdaysObj[weekDay][dateTimeUnix] +=
                      staffNeedCount;
                  } else {
                    staffNeedWeekdaysObj[weekDay][dateTimeUnix] =
                      staffNeedCount;
                  }

                  if (
                    typeof staffAppliedWeekdaysObj[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it staffAppliedWeekdaysObj[
                      weekDay
                    ][dateTimeUnix] += appliedStaffCount;
                  } else {
                    staffAppliedWeekdaysObj[weekDay][dateTimeUnix] =
                      appliedStaffCount;
                  }
                  // }else {
                  // assign code
                  if (
                    typeof staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it

                    staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] +=
                      staffNeedCountAssign;
                  } else {
                    staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                      staffNeedCountAssign;
                  }

                  if (
                    typeof staffAppliedWeekdaysObjAssign[weekDay][
                      dateTimeUnix
                    ] != 'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it staffAppliedWeekdaysObjAssign[
                      weekDay
                    ][dateTimeUnix] += appliedStaffCountAssing;
                  } else {
                    staffAppliedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                      appliedStaffCountAssing;
                  }
                  // }
                });
              }

              // deleteMany
              //FORMAT THE RESPONSE (for both need and applied datas) AS {'monday':[[1514223000000,2],[1514223000000,2]],'tuesday':[[1514223000000,2],[1514223000000,2]],....} 
              var formattedAppliedStaffData = {},
                formattedNeedStaffData = {};
              var formattedAppliedStaffDataAssign = {},
                formattedNeedStaffDataAssing = {};

              for (let appliedElement in staffAppliedWeekdaysObj) {
                formattedAppliedStaffData[appliedElement] = [];

                for (let time in staffAppliedWeekdaysObj[appliedElement]) {
                  var array = [
                    Number(time),
                    Number(staffAppliedWeekdaysObj[appliedElement][time]),
                  ];
                  if (formattedAppliedStaffData[appliedElement].length < 48) {
                    formattedAppliedStaffData[appliedElement].push(array);
                  }
                }
              }
              for (let needElement in staffNeedWeekdaysObj) {
                formattedNeedStaffData[needElement] = [];

                for (let time in staffNeedWeekdaysObj[needElement]) {
                  var array = [
                    Number(time),
                    Number(staffNeedWeekdaysObj[needElement][time]),
                  ];
                  if (formattedNeedStaffData[needElement].length < 48) {
                    formattedNeedStaffData[needElement].push(array);
                  }
                }
              }
              // assign code
              for (let appliedElement in staffAppliedWeekdaysObjAssign) {
                formattedAppliedStaffDataAssign[appliedElement] = [];

                for (let time in staffAppliedWeekdaysObjAssign[
                  appliedElement
                ]) {
                  var array = [
                    Number(time),
                    Number(staffAppliedWeekdaysObjAssign[appliedElement][time]),
                  ];
                  if (
                    formattedAppliedStaffDataAssign[appliedElement].length < 48
                  ) {
                    formattedAppliedStaffDataAssign[appliedElement].push(array);
                  }
                }
              }
              for (let needElement in staffNeedWeekdaysObjAssign) {
                formattedNeedStaffDataAssing[needElement] = [];

                for (let time in staffNeedWeekdaysObjAssign[needElement]) {
                  var array = [
                    Number(time),
                    Number(staffNeedWeekdaysObjAssign[needElement][time]),
                  ];
                  if (formattedNeedStaffDataAssing[needElement].length < 48) {
                    formattedNeedStaffDataAssing[needElement].push(array);
                  }
                }
              }

              var data = {
                  businessUnitId: body.businessUnitId,
                  weekNumber: weekNumber,
                },
                clientWeeklyStaffData =
                  await WeeklyStaffData.weeklyStaffingData(data),
                weeklyStaffGraphData = {
                  clientFlexiStaffData: {},
                  clientStaffData: {},
                  staffNeedData: formattedNeedStaffData,
                  staffAppliedData: formattedAppliedStaffData,
                  staffNeedDataAssing: formattedNeedStaffDataAssing,
                  staffAppliedDataAssing: formattedAppliedStaffDataAssign,
                };

              if (clientWeeklyStaffData) {
                if (clientWeeklyStaffData.flexiStaffData)
                  weeklyStaffGraphData.clientFlexiStaffData =
                    clientWeeklyStaffData.flexiStaffData;

                if (clientWeeklyStaffData.staffData)
                  weeklyStaffGraphData.clientStaffData =
                    clientWeeklyStaffData.staffData;
              }

              //weeklyGraph ends 

              var updatedDashboardGraphData = {};

              for (let each in dashboardGraphData) {
                updatedDashboardGraphData[each] =
                  dashboardGraphData[each].toFixed(2);
              }
              // __.log(listData)
              var templistData = JSON.stringify(listData);
              listData = JSON.parse(templistData);
              for (let date in listData) {
                listData[date].forEach((item, index) => {
                  if (item.isLimit) {
                    const isLimitedStaff = item.appliedStaffs.filter(
                      (limit) => {
                        return limit.status == 1 && limit.isLimit;
                      },
                    );
                    if (isLimitedStaff.length > 0) {
                      for (let kk = 0; kk < item.confirmedStaffs.length; kk++) {
                        const staffCheck = item.confirmedStaffs[kk];
                        let isLimitStaffId = isLimitedStaff.filter((limit) => {
                          return limit.flexiStaff == staffCheck._id;
                        });
                        if (isLimitStaffId.length > 0) {
                          item.confirmedStaffs[kk].isLimit = true;
                        }
                      }
                    }
                  }
                  if (item.isExtendedShift) {
                    ////console.log('present');
                    if (item.extendedStaff) {
                      item.extendedStaff.forEach((extendedStaffItem) => {
                        if (item.confirmedStaffs) {
                          item.confirmedStaffs.forEach(
                            (confirmedStaffsItem) => {
                              // //console.log(typeof confirmedStaffs._id, confirmedStaffs._id,extendedStaff.userId )
                              if (
                                confirmedStaffsItem._id.toString() ===
                                extendedStaffItem.userId.toString()
                              ) {
                                confirmedStaffsItem.confirmStatus =
                                  extendedStaffItem.confirmStatus;
                                confirmedStaffsItem.endDateTime =
                                  extendedStaffItem.endDateTime;
                                confirmedStaffsItem.startDateTime =
                                  extendedStaffItem.startDateTime;
                                confirmedStaffsItem.isLimit =
                                  extendedStaffItem.isLimit;
                                //console.log('match')
                              }
                            },
                          );
                        }
                      });
                    }
                  }
                  if (item.isSplitShift) {
                    listData[date].forEach((splitItem, splitIndex) => {
                      if (splitIndex !== index) {
                        if (
                          splitItem.isSplitShift &&
                          new Date(splitItem.date).getTime() ===
                            new Date(item.date).getTime() &&
                          splitItem.shiftId._id === item.shiftId._id
                        ) {
                          item.splitShiftStartTime = splitItem.startTime;
                          item.splitShiftEndTime = splitItem.endTime;
                          item.splitShiftId = splitItem._id;
                          listData[date].splice(splitIndex, 1);
                        }
                      }
                    });
                  }
                });
              }

              for (let prop in graphData) {
                if (Object.prototype.hasOwnProperty.call(graphData, prop)) {
                  // do stuff
                  if (
                    graphData[prop].totalHours % 1 != 0 &&
                    graphData[prop].totalHours > 0
                  )
                    graphData[prop].totalHours = parseFloat(
                      graphData[prop].totalHours.toFixed(2),
                    );
                }
              }
              for (let prop in graphDataWeb) {
                if (Object.prototype.hasOwnProperty.call(graphDataWeb, prop)) {
                  // do stuff
                  if (
                    graphDataWeb[prop].totalHours.need % 1 != 0 &&
                    graphDataWeb[prop].totalHours.need
                  )
                    graphDataWeb[prop].totalHours.need = parseFloat(
                      graphDataWeb[prop].totalHours.need.toFixed(2),
                    );
                  if (
                    graphDataWeb[prop].totalHours.booked % 1 != 0 &&
                    graphDataWeb[prop].totalHours.booked
                  )
                    graphDataWeb[prop].totalHours.booked = parseFloat(
                      graphDataWeb[prop].totalHours.booked.toFixed(2),
                    );
                }
              }
              const finalResulttt = {
                list: listData,
                graph: graphData,
                graphDataWeb: graphDataWeb,
                dashboardGraphData: updatedDashboardGraphData,
                weeklyStaffGraphData: weeklyStaffGraphData,
              };
              this.setRedisData(redisKey, finalResulttt);
              // __.out(res, 201, {
              //     list: listData,
              //     graph: graphData,
              //     graphDataWeb: graphDataWeb,
              //     dashboardGraphData: updatedDashboardGraphData,
              //     weeklyStaffGraphData: weeklyStaffGraphData
              // });
            } else {
              // __.out(res, 201, {
              //     shifts: shifts
              // });
            }
          }
        }
      }
    } catch (err) {
      //console.log(err)
    }
  }
  async readNewPrev(buIds) {
    try {
      //shiftR{currentDate}
      let allBuId = [];
      if (!buIds) {
        allBuId = buIdsWithWeek;
      } else {
        const weekDetails = await SubSection.findOne(
          { _id: buIds },
          { noOfWeek: 1 },
        );
        allBuId.push({ buId: buIds, week: weekDetails.noOfWeek });
      }
      //console.log('callee');

      const mondayDate = getMonday(new Date());
      for (let buIndex = 0; buIndex < allBuId.length; buIndex++) {
        const noOfWeek = allBuId[buIndex].week;
        const buId = allBuId[buIndex].buId;
        for (let weekIndex = 1; weekIndex <= noOfWeek; weekIndex++) {
          const currentDate = moment(new Date(mondayDate))
            .add(-1 * weekIndex * 7, 'days')
            .utcOffset(480)
            .format('MM-DD-YYYY');
          //console.log("CurrentDate ", currentDate);
          const body = {
            startDate: `${currentDate} 00:00:00 GMT+0800`,
            date: `${currentDate} 00:00:00 GMT+0800`,
            businessUnitId: buId,
          };
          const redisKey = `shiftR${buId}${currentDate}`;
          if (false) {
          } else {
            var where = {
                status: 1,
              },
              findOrFindOne;
            //console.log(body)
            var timeZone = moment
                .parseZone(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
                .format('Z'),
              startDate = moment(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
                .utc()
                .format(), //.add(1,'days') remove to get monday shift
              endDate = moment(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
                .add(5, 'days')
                .add(23, 'hours')
                .add(60, 'minutes')
                .add(59, 'seconds')
                .utc()
                .format(); //86399 => add 23:59:59
            //console.log('startDate11', startDate)
            //console.log("endsdhhd", endDate)
            const aa = new Date(startDate).setUTCHours(0, 0, 0, 0);
            const bb = new Date(endDate).setUTCHours(24, 0, 0, 0);
            startDate = new Date(aa);
            endDate = new Date(bb);
            //console.log('startDate', startDate);
            //console.log('endddd', endDate);
            var startUnixDateTime = moment(startDate).unix(),
              endUnixDateTime = moment(endDate).unix();
            const ddd = moment(new Date(body.startDate))
              .utc()
              .format('MM-DD-YYYY HH:mm:ss Z');
            const year = new Date(ddd).getFullYear();
            const month = new Date(ddd).getMonth() + 1;
            const day = new Date(ddd).getDate(); //-1; // remove comment for local ashish
            //console.log('yy', year, month, day);
            const whereShift = {
              //  staff_id:{$in: usersOfBu},
              businessUnitId: body.businessUnitId,
              status: 1,
              $and: [
                { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
                { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
                {
                  $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] },
                },
              ],
            };
            var shift = await Shift.find(whereShift)
              .select('shiftDetails')
              .lean();
            //console.log('shofttttt', shift.length)
            function plucker(prop) {
              return function (o) {
                return o[prop];
              };
            }
            var shiftDetailsArray = shift.map(plucker('shiftDetails'));
            shiftDetailsArray = _.flatten(shiftDetailsArray);

            shiftDetailsArray = Array.from(new Set(shiftDetailsArray));

            var weekNumber = await __.weekNoStartWithMonday(startDate);
            where = {
              status: 1,
              _id: {
                $in: shiftDetailsArray,
              },
            };
            where.date = {
              $gte: startDate,
              $lte: endDate,
            };
            findOrFindOne = ShiftDetails.find(where);
            let shifts = await findOrFindOne
              .populate([
                { path: 'appliedStaffs' },
                {
                  path: 'draftId',
                  select:
                    'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
                },
                {
                  path: 'shiftId',
                  select: '-shiftDetails',
                  match: {
                    businessUnitId: mongoose.Types.ObjectId(
                      body.businessUnitId,
                    ),
                  },
                  populate: [
                    {
                      path: 'plannedBy',
                      select: 'name staffId',
                    },
                    {
                      path: 'businessUnitId',
                      select:
                        'name adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'sectionId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                        populate: {
                          path: 'departmentId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                          populate: {
                            path: 'companyId',
                            select: 'name status',
                            match: {
                              status: 1,
                            },
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  path: 'reportLocationId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'subSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'skillSetId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
                {
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'confirmedStaffs',
                  select:
                    'name email contactNumber profilePicture subSkillSets mainSkillSets status,schemeId staffId',
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                    {
                      path: 'schemeId',
                      select: 'shiftSetup ',
                      match: {
                        status: true,
                      },
                    },
                  ],
                },
                {
                  path: 'backUpStaffs',
                  select:
                    'name email contactNumber profilePicture mainSkillSets subSkillSets status,schemeId staffId',
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                    {
                      path: 'schemeId',
                      select: 'shiftSetup',
                      match: {
                        status: true,
                      },
                    },
                  ],
                },
                {
                  path: 'requestedShifts',
                },
                {
                  path: 'currentReqShift',
                  populate: {
                    path: 'reportLocationId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
                {
                  path: 'requestedUsers.userId',
                  match: {
                    status: 1,
                  },
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                  ],
                },
              ])
              .sort({
                startTime: -1,
              });
            if (!body.shiftDetailsId) {
              var listData = {},
                graphData = {},
                graphDataWeb = {},
                dashboardGraphData = {
                  plannedFlexiHours: 0,
                  plannedFlexiShifts: 0,
                  bookedFlexiHours: 0,
                  bookedFlexiShifts: 0,
                  assignFlexiHours: 0,
                  assignFlexiShifts: 0,
                  assignFlexiStaff: 0,
                },
                customShiftDetails = [];
              shifts = shifts.filter((iii) => {
                return iii.shiftId;
              });
              await shifts.forEach((element) => {
                element = JSON.parse(JSON.stringify(element));
                //console.log('element', element.isAssignShift)
                let totalExtension = 0;
                let totalExtensionHrs = 0;
                if (
                  (((element.mainSkillSets && element.mainSkillSets.length) ||
                    (element.subSkillSets && element.subSkillSets.length)) &&
                    element.reportLocationId &&
                    element.shiftId &&
                    element.shiftId.businessUnitId) ||
                  element.isAssignShift
                ) {
                  let tz = element.timeZone;
                  if (!tz) {
                    tz = '+0800';
                  }
                  var key = __.getDateStringFormat(element.date, tz);
                  for (let ki = 0; ki < element.confirmedStaffs.length; ki++) {
                    // console.log('I am here in comfired');
                    const uCI = element.confirmedStaffs[ki];
                    let startDI = element.startTime;
                    let endDI = element.endTime;
                    if (element.isExtendedShift) {
                      const uCIResult = element.extendedStaff.filter((uI) => {
                        return (
                          uI.userId.toString() == uCI._id &&
                          uI.confirmStatus == 2
                        );
                      });
                      if (uCIResult.length > 0) {
                        if (uCIResult[0].confirmStatus == 2) {
                          totalExtension = totalExtension + 1;
                          totalExtensionHrs =
                            totalExtensionHrs + uCIResult[0].duration;
                        }
                        startDI = uCIResult[0].startDateTime;
                        endDI = uCIResult[0].endDateTime;
                      }
                    }
                    element.confirmedStaffs[ki].startTime = moment(
                      new Date(startDI),
                    )
                      .utcOffset(timeZone)
                      .format('HH:mm');
                    element.confirmedStaffs[ki].endTime = moment(
                      new Date(endDI),
                    )
                      .utcOffset(timeZone)
                      .format('HH:mm');
                    element.confirmedStaffs[ki].startDate = moment(
                      new Date(startDI),
                    )
                      .utcOffset(timeZone)
                      .format('DD-MM-YYYY');
                    element.confirmedStaffs[ki].endDate = moment(
                      new Date(endDI),
                    )
                      .utcOffset(timeZone)
                      .format('DD-MM-YYYY');
                  }
                  if (element.status == 1) {
                    //dashboard graph data starts
                    //console.log('element.isAssignShift', element.isAssignShift)
                    if (!element.isAssignShift) {
                      var confirmedStaffsCount = element.confirmedStaffs.length;
                      dashboardGraphData.plannedFlexiHours +=
                        (element.staffNeedCount - totalExtension) *
                          element.duration +
                        totalExtensionHrs;

                      dashboardGraphData.plannedFlexiShifts +=
                        element.staffNeedCount;

                      dashboardGraphData.bookedFlexiHours +=
                        (confirmedStaffsCount - totalExtension) *
                          element.duration +
                        totalExtensionHrs;

                      dashboardGraphData.bookedFlexiShifts +=
                        confirmedStaffsCount;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        var confirmedStaffsCount =
                          element.confirmedStaffs.length;
                        if (element.isExtendedShift) {
                          const extendStaff = element.extendedStaff[0];
                          var hours =
                            Math.abs(
                              new Date(extendStaff.startDateTime).getTime() -
                                new Date(extendStaff.endDateTime).getTime(),
                            ) / 36e5;
                          dashboardGraphData.assignFlexiHours += hours;
                        } else {
                          dashboardGraphData.assignFlexiHours +=
                            element.staffNeedCount * element.duration;
                        }

                        dashboardGraphData.assignFlexiShifts +=
                          element.staffNeedCount;
                        dashboardGraphData.assignFlexiStaff +=
                          element.staffNeedCount;
                      }
                    }
                  }
                  //dashboard graph data ends 

                  // Remove Cancelled Shifts on Calculation

                  if (listData[key]) {
                    //if date already keyed in array 
                    listData[key].push(element);
                    // Add Hours in calculation only it is active shift
                    if (element.status == 1 && !element.isAssignShift) {
                      //console.log('1', key);
                      graphData[key].totalHours +=
                        element.duration *
                          (element.staffNeedCount - totalExtension) +
                        totalExtensionHrs;
                      graphData[key].totalShifts += element.staffNeedCount;
                      graphDataWeb[key].totalHours.need +=
                        element.duration *
                          (element.staffNeedCount - totalExtension) +
                        totalExtensionHrs;

                      graphDataWeb[key].totalHours.booked +=
                        element.duration *
                          (element.confirmedStaffs.length - totalExtension) +
                        totalExtensionHrs;

                      graphDataWeb[key].numberOfShifts.need +=
                        element.staffNeedCount;

                      graphDataWeb[key].numberOfShifts.booked +=
                        element.confirmedStaffs.length;

                      graphDataWeb[key].totalHours.needAssign += 0;
                      graphDataWeb[key].numberOfShifts.needAssign += 0;
                      graphData[key].totalHoursAssign += 0;
                      graphData[key].totalShiftsAssign += 0;
                      graphData[key].assignFlexiStaff += 0;
                    } else {
                      if (element.status == 1) {
                        var isRecalled =
                          element.isRest || element.isOff ? true : false;
                        if (
                          (!isRecalled ||
                            (isRecalled && element.isRecallAccepted == 2)) &&
                          body.from != 'viewbooking'
                        ) {
                          //console.log('11', key);
                          graphData[key].totalHoursAssign +=
                            element.duration * element.staffNeedCount;
                          graphData[key].totalShiftsAssign +=
                            element.staffNeedCount;
                          graphData[key].assignFlexiStaff +=
                            element.staffNeedCount;
                          graphDataWeb[key].totalHours.needAssign +=
                            element.duration * element.staffNeedCount;
                          graphDataWeb[key].numberOfShifts.needAssign +=
                            element.staffNeedCount;

                          graphData[key].totalHours += 0;
                          graphData[key].totalShifts += 0;
                          graphDataWeb[key].totalHours.need += 0;

                          graphDataWeb[key].totalHours.booked += 0;

                          graphDataWeb[key].numberOfShifts.need += 0;

                          graphDataWeb[key].numberOfShifts.booked += 0;
                        }
                      }
                    }
                  } else {
                    //else create a new key by date in array 
                    listData[key] = [];
                    listData[key].push(element);
                    graphData[key] = {};
                    graphData[key].totalHours = 0;
                    graphData[key].totalShifts = 0;
                    graphData[key].totalHoursAssign = 0;
                    graphData[key].totalShiftsAssign = 0;
                    graphData[key].assignFlexiStaff = 0;
                    graphDataWeb[key] = {
                      totalHours: {
                        need: 0,
                        booked: 0,
                        needAssign: 0,
                      },
                      numberOfShifts: {
                        need: 0,
                        booked: 0,
                        needAssign: 0,
                      },
                    };
                    // Add Hours in calculation only it is active shift
                    if (element.status == 1 && !element.isAssignShift) {
                      graphData[key].totalHours =
                        element.duration *
                          (element.staffNeedCount - totalExtension) +
                        totalExtensionHrs;
                      graphData[key].totalShifts = element.staffNeedCount;
                      graphDataWeb[key] = {
                        totalHours: {
                          need:
                            element.duration *
                              (element.staffNeedCount - totalExtension) +
                            totalExtensionHrs,
                          booked:
                            element.duration *
                              (element.confirmedStaffs.length -
                                totalExtension) +
                            totalExtensionHrs,
                          needAssign: 0,
                        },
                        numberOfShifts: {
                          need: element.staffNeedCount,
                          booked: element.confirmedStaffs.length,
                          needAssign: 0,
                        },
                      };

                      graphData[key].totalHoursAssign = 0;
                      graphData[key].totalShiftsAssign = 0;
                      graphData[key].assignFlexiStaff = 0;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;

                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        //  //console.log('all here')
                        graphData[key].totalHoursAssign =
                          element.duration * element.staffNeedCount;
                        graphData[key].totalShiftsAssign =
                          element.staffNeedCount;
                        graphData[key].assignFlexiStaff =
                          element.staffNeedCount;
                        graphDataWeb[key] = {
                          totalHours: {
                            needAssign:
                              element.duration * element.staffNeedCount,
                          },
                          numberOfShifts: {
                            needAssign: element.staffNeedCount,
                          },
                        };

                        graphData[key].totalHours = 0;
                        graphData[key].totalShifts = 0;
                        graphDataWeb[key].totalHours.need = 0;

                        graphDataWeb[key].totalHours.booked = 0;

                        graphDataWeb[key].numberOfShifts.need = 0;

                        graphDataWeb[key].numberOfShifts.booked = 0;
                      }
                    }
                  }

                  var customElement = _.omit(element, [
                    'shiftId',
                    'reportLocationId',
                    'subSkillSets',
                    'mainSkillSets',
                  ]);
                  customShiftDetails.push(customElement);
                }
              });

              //weeklyGraph starts 

              var staffNeedWeekdaysObj = {
                  monday: {},
                  tuesday: {},
                  wednesday: {},
                  thursday: {},
                  friday: {},
                  saturday: {},
                  sunday: {},
                },
                staffAppliedWeekdaysObj = _.cloneDeep(staffNeedWeekdaysObj);
              var staffNeedWeekdaysObjAssign = {
                  monday: {},
                  tuesday: {},
                  wednesday: {},
                  thursday: {},
                  friday: {},
                  saturday: {},
                  sunday: {},
                },
                staffAppliedWeekdaysObjAssign = _.cloneDeep(
                  staffNeedWeekdaysObjAssign,
                );
              startUnixDateTime += 86400;
              endUnixDateTime += 86400;
              for (let i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
                var dateTimeUnix = i * 1000;
                customShiftDetails = JSON.parse(
                  JSON.stringify(customShiftDetails),
                );
                await customShiftDetails.forEach(async (element) => {
                  var weekDay = __.getDayStringFormatFromUnix(i, 'GMT+0000'),
                    staffNeedCount = 0,
                    appliedStaffCount = 0,
                    staffNeedCountAssign = 0,
                    appliedStaffCountAssing = 0;

                  // if(element.isAssignShift){
                  //     //console.log('aaaaaaaaaa');
                  //     //console.log(i, element.startTimeInSeconds)
                  //     element.startTimeInSeconds = element.startTimeInSeconds/1000;
                  //     element.endTimeInSeconds = element.endTimeInSeconds/1000;
                  //     //console.log(i, element.startTimeInSeconds)

                  // }
                  //   //console.log(i, element.startTimeInSeconds)
                  if (
                    i >= element.startTimeInSeconds &&
                    i <= element.endTimeInSeconds
                  ) {
                    //shift matches the time then it will take the count else it will assign 0 by default 
                    if (!element.isAssignShift) {
                      //console.log('inthis')
                      staffNeedCount = element.staffNeedCount;
                      appliedStaffCount = element.confirmedStaffs.length;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        staffNeedCountAssign = element.staffNeedCount;
                        appliedStaffCountAssing =
                          element.confirmedStaffs.length;
                      }
                    }
                  }
                  //if(!element.isAssignShift){
                  if (
                    typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it

                    staffNeedWeekdaysObj[weekDay][dateTimeUnix] +=
                      staffNeedCount;
                  } else {
                    staffNeedWeekdaysObj[weekDay][dateTimeUnix] =
                      staffNeedCount;
                  }

                  if (
                    typeof staffAppliedWeekdaysObj[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it
                    staffAppliedWeekdaysObj[
                      weekDay
                    ][dateTimeUnix] += appliedStaffCount;
                  } else {
                    staffAppliedWeekdaysObj[weekDay][dateTimeUnix] =
                      appliedStaffCount;
                  }
                  // }else {
                  // assign code
                  if (
                    typeof staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it

                    staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] +=
                      staffNeedCountAssign;
                  } else {
                    staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                      staffNeedCountAssign;
                  }

                  if (
                    typeof staffAppliedWeekdaysObjAssign[weekDay][
                      dateTimeUnix
                    ] != 'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it
                    staffAppliedWeekdaysObjAssign[
                      weekDay
                    ][dateTimeUnix] += appliedStaffCountAssing;
                  } else {
                    staffAppliedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                      appliedStaffCountAssing;
                  }
                  // }
                });
              }

              // deleteMany
              //FORMAT THE RESPONSE (for both need and applied datas) AS {'monday':[[1514223000000,2],[1514223000000,2]],'tuesday':[[1514223000000,2],[1514223000000,2]],....} 
              var formattedAppliedStaffData = {},
                formattedNeedStaffData = {};
              var formattedAppliedStaffDataAssign = {},
                formattedNeedStaffDataAssing = {};

              for (let appliedElement in staffAppliedWeekdaysObj) {
                formattedAppliedStaffData[appliedElement] = [];

                for (let time in staffAppliedWeekdaysObj[appliedElement]) {
                  var array = [
                    Number(time),
                    Number(staffAppliedWeekdaysObj[appliedElement][time]),
                  ];
                  if (formattedAppliedStaffData[appliedElement].length < 48) {
                    formattedAppliedStaffData[appliedElement].push(array);
                  }
                }
              }
              for (let needElement in staffNeedWeekdaysObj) {
                formattedNeedStaffData[needElement] = [];

                for (let time in staffNeedWeekdaysObj[needElement]) {
                  var array = [
                    Number(time),
                    Number(staffNeedWeekdaysObj[needElement][time]),
                  ];
                  if (formattedNeedStaffData[needElement].length < 48) {
                    formattedNeedStaffData[needElement].push(array);
                  }
                }
              }
              // assign code
              for (let appliedElement in staffAppliedWeekdaysObjAssign) {
                formattedAppliedStaffDataAssign[appliedElement] = [];

                for (let time in staffAppliedWeekdaysObjAssign[
                  appliedElement
                ]) {
                  var array = [
                    Number(time),
                    Number(staffAppliedWeekdaysObjAssign[appliedElement][time]),
                  ];
                  if (
                    formattedAppliedStaffDataAssign[appliedElement].length < 48
                  ) {
                    formattedAppliedStaffDataAssign[appliedElement].push(array);
                  }
                }
              }
              for (let needElement in staffNeedWeekdaysObjAssign) {
                formattedNeedStaffDataAssing[needElement] = [];

                for (let time in staffNeedWeekdaysObjAssign[needElement]) {
                  var array = [
                    Number(time),
                    Number(staffNeedWeekdaysObjAssign[needElement][time]),
                  ];
                  if (formattedNeedStaffDataAssing[needElement].length < 48) {
                    formattedNeedStaffDataAssing[needElement].push(array);
                  }
                }
              }

              var data = {
                  businessUnitId: body.businessUnitId,
                  weekNumber: weekNumber,
                },
                clientWeeklyStaffData =
                  await WeeklyStaffData.weeklyStaffingData(data),
                weeklyStaffGraphData = {
                  clientFlexiStaffData: {},
                  clientStaffData: {},
                  staffNeedData: formattedNeedStaffData,
                  staffAppliedData: formattedAppliedStaffData,
                  staffNeedDataAssing: formattedNeedStaffDataAssing,
                  staffAppliedDataAssing: formattedAppliedStaffDataAssign,
                };

              if (clientWeeklyStaffData) {
                if (clientWeeklyStaffData.flexiStaffData)
                  weeklyStaffGraphData.clientFlexiStaffData =
                    clientWeeklyStaffData.flexiStaffData;

                if (clientWeeklyStaffData.staffData)
                  weeklyStaffGraphData.clientStaffData =
                    clientWeeklyStaffData.staffData;
              }

              //weeklyGraph ends 

              var updatedDashboardGraphData = {};

              for (let each in dashboardGraphData) {
                updatedDashboardGraphData[each] =
                  dashboardGraphData[each].toFixed(2);
              }
              // __.log(listData)
              var templistData = JSON.stringify(listData);
              listData = JSON.parse(templistData);
              for (let date in listData) {
                listData[date].forEach((item, index) => {
                  if (item.isLimit) {
                    const isLimitedStaff = item.appliedStaffs.filter(
                      (limit) => {
                        return limit.status == 1 && limit.isLimit;
                      },
                    );
                    if (isLimitedStaff.length > 0) {
                      for (let kk = 0; kk < item.confirmedStaffs.length; kk++) {
                        const staffCheck = item.confirmedStaffs[kk];
                        let isLimitStaffId = isLimitedStaff.filter((limit) => {
                          return limit.flexiStaff == staffCheck._id;
                        });
                        if (isLimitStaffId.length > 0) {
                          item.confirmedStaffs[kk].isLimit = true;
                        }
                      }
                    }
                  }
                  if (item.isExtendedShift) {
                    ////console.log('present');
                    if (item.extendedStaff) {
                      item.extendedStaff.forEach((extendedStaffItem) => {
                        if (item.confirmedStaffs) {
                          item.confirmedStaffs.forEach(
                            (confirmedStaffsItem) => {
                              // //console.log(typeof confirmedStaffs._id, confirmedStaffs._id,extendedStaff.userId )
                              if (
                                confirmedStaffsItem._id.toString() ===
                                extendedStaffItem.userId.toString()
                              ) {
                                confirmedStaffsItem.confirmStatus =
                                  extendedStaffItem.confirmStatus;
                                confirmedStaffsItem.endDateTime =
                                  extendedStaffItem.endDateTime;
                                confirmedStaffsItem.startDateTime =
                                  extendedStaffItem.startDateTime;
                                confirmedStaffsItem.isLimit =
                                  extendedStaffItem.isLimit;
                                //console.log('match')
                              }
                            },
                          );
                        }
                      });
                    }
                  }
                  if (item.isSplitShift) {
                    listData[date].forEach((splitItem, splitIndex) => {
                      if (splitIndex !== index) {
                        if (
                          splitItem.isSplitShift &&
                          new Date(splitItem.date).getTime() ===
                            new Date(item.date).getTime() &&
                          splitItem.shiftId._id === item.shiftId._id
                        ) {
                          item.splitShiftStartTime = splitItem.startTime;
                          item.splitShiftEndTime = splitItem.endTime;
                          item.splitShiftId = splitItem._id;
                          listData[date].splice(splitIndex, 1);
                        }
                      }
                    });
                  }
                });
              }

              for (let prop in graphData) {
                if (Object.prototype.hasOwnProperty.call(graphData, prop)) {
                  // do stuff
                  if (
                    graphData[prop].totalHours % 1 != 0 &&
                    graphData[prop].totalHours > 0
                  )
                    graphData[prop].totalHours = parseFloat(
                      graphData[prop].totalHours.toFixed(2),
                    );
                }
              }
              for (let prop in graphDataWeb) {
                if (Object.prototype.hasOwnProperty.call(graphDataWeb, prop)) {
                  // do stuff
                  if (
                    graphDataWeb[prop].totalHours.need % 1 != 0 &&
                    graphDataWeb[prop].totalHours.need
                  )
                    graphDataWeb[prop].totalHours.need = parseFloat(
                      graphDataWeb[prop].totalHours.need.toFixed(2),
                    );
                  if (
                    graphDataWeb[prop].totalHours.booked % 1 != 0 &&
                    graphDataWeb[prop].totalHours.booked
                  )
                    graphDataWeb[prop].totalHours.booked = parseFloat(
                      graphDataWeb[prop].totalHours.booked.toFixed(2),
                    );
                }
              }
              const finalResulttt = {
                list: listData,
                graph: graphData,
                graphDataWeb: graphDataWeb,
                dashboardGraphData: updatedDashboardGraphData,
                weeklyStaffGraphData: weeklyStaffGraphData,
              };
              this.setRedisData(redisKey, finalResulttt);
              // __.out(res, 201, {
              //     list: listData,
              //     graph: graphData,
              //     graphDataWeb: graphDataWeb,
              //     dashboardGraphData: updatedDashboardGraphData,
              //     weeklyStaffGraphData: weeklyStaffGraphData
              // });
            } else {
              // __.out(res, 201, {
              //     shifts: shifts
              // });
            }
          }
        }
      }
    } catch (err) {
      //console.log(err)
    }
  }
  async readAssignShiftNext(
    buIds,
    isFromController = false,
    dateFromController = null,
    redisTimeZone = 'GMT+0800',
  ) {
    try {
      //   console.log('called readAssignShiftNext');
      let allBuId = [];
      if (!buIds) {
        allBuId = buIdsWithWeek;
      } else if (!isFromController) {
        const weekDetails = await SubSection.findOne(
          { _id: buIds },
          { noOfWeek: 1 },
        );
        allBuId.push({ buId: buIds, week: weekDetails.noOfWeek });
      } else {
        allBuId.push({ buId: buIds, week: 1 });
      }
      let mondayDate = null;
      if (isFromController) {
        mondayDate = dateFromController;
      } else {
        mondayDate = getMonday(new Date());
      }
      //   console.log('called readAssignShiftNext', allBuId, mondayDate);
      const allCalls = [];
      for (let buIndex = 0; buIndex < allBuId.length; buIndex++) {
        // console.log('buIndex', buIndex);
        const noOfWeek = allBuId[buIndex].week;
        const buId = allBuId[buIndex].buId;
        for (let weekIndex = 0; weekIndex < noOfWeek; weekIndex++) {
          allCalls.push(
            this.calculateAssignNext(
              mondayDate,
              weekIndex,
              buId,
              redisTimeZone,
            ),
          );
        }
      }
      const finalResult = await Promise.all(allCalls);
    } catch (e) {
      console.log(e);
    }
  }
  async calculateAssignNext(mondayDate, weekIndex, buId, redisTimeZone) {
    return new Promise(async (resolve, reject) => {
      //   console.log('calculateAssignNext', mondayDate, weekIndex, buId);
      const timeDD = redisTimeZone == 'GMT+0800' ? 480 : 330;
      let currentDate = moment(new Date(mondayDate))
        .add(weekIndex * 7, 'days')
        .utcOffset(timeDD)
        .format('MM-DD-YYYY');
      //   console.log('CurrentDate ', new Date(currentDate));
      // let checkDate = new Date(currentDate);
      let mondayDateD = new Date(currentDate);
      if (mondayDateD.getDay() !== 1) {
        const addD = (1 + 7 - mondayDateD.getDay()) % 7;
        let finalAdd = addD;
        if (addD !== 1) {
          finalAdd = addD - 7;
        }
        mondayDateD = new Date(
          mondayDateD.setDate(mondayDateD.getDate() + finalAdd),
        );

        currentDate = moment(new Date(mondayDateD)).format('MM-DD-YYYY');
      }
      //   console.log('final current Date', currentDate);
      const body = {
        weekRangeStartsAt: `${currentDate} 00:00:00 ${redisTimeZone}`,
        weekRangeEndsAt: '',
        businessUnitId: buId,
        timeZone: timeDD,
      };
      //   console.log('body, body', body);
      const redisKey = `assingShiftR${buId}${currentDate}`;

      const ddd = moment(new Date(body.weekRangeStartsAt))
        .utc()
        .format('MM-DD-YYYY HH:mm:ss Z');
      const year = new Date(ddd).getFullYear();
      const month = new Date(ddd).getMonth() + 1;
      const day = new Date(ddd).getDate(); //-1; // ashish
      //   console.log('yy', year, month, day);
      const where = {
        //  staff_id:{$in: usersOfBu},
        businessUnitId: body.businessUnitId,
        $and: [
          { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
          { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
          { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
        ],
      };
      const findOrFindOne = AssignShift.find(where);
      let shifts1 = await findOrFindOne
        .select(
          'staff_id staffAppointmentId staffRoleId _id date reportLocationId startTime endTime day status ' +
            'shiftChangeRequestStatus subSkillSets shiftRead draftStatus shiftChangeRequestMessage duration shiftDetailId schemeDetails alertMessage isLimit isAlert isAllowPublish isOff isRest splitStartTime splitEndTime isSplitShift isRecalled isRecallAccepted isEmpty mainSkillSets skillSetTierType',
        )
        .populate([
          {
            path: 'staff_id',
            select:
              'name contactNumber email profilePicture staffId schemeId subSkillSets mainSkillSets',
            populate: [
              {
                path: 'schemeId',
                select: 'schemeName',
              },
              {
                path: 'mainSkillSets',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
              {
                path: 'subSkillSets',
                select: 'name status',
                match: {
                  status: 1,
                },
                populate: {
                  path: 'skillSetId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
              },
            ],
          },
          {
            path: 'shiftDetailId',
            select: 'isExtendedShift extendedStaff',
          },
          {
            path: 'mainSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'subSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'skillSetId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
          },
          // , {
          //     path: 'staffAppointmentId',
          //     select: 'name'
          // },{
          //     path: 'staffRoleId',
          //     select: 'name'
          // }
        ])
        .sort({ staffId: -1 });

      let shifts = JSON.stringify(shifts1);
      shifts = JSON.parse(shifts);
      //   console.log('shifts: ', shifts.length);

      if (shifts.length > 0) {
        const callShiftData = [];
        var days = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        for (let i = 0; i <= shifts.length - 1; i++) {
          let item = shifts[i];
          callShiftData.push(this.getAssingShiftInto(item, body, days));
        }
        shifts = await Promise.all(callShiftData);
        shifts = _.mapValues(_.groupBy(shifts, 'dayName'));
        var newShifts = {
          Monday: shifts.Monday,
          Tuesday: shifts.Tuesday,
          Wednesday: shifts.Wednesday,
          Thursday: shifts.Thursday,
          Friday: shifts.Friday,
          Saturday: shifts.Saturday,
          Sunday: shifts.Sunday,
        };
        // //console.log('shifts', JSON.stringify(shifts))

        const finalObj = {
          status: true,
          shifts: newShifts,
          message: 'Week Data',
        };
        console.log('set redis result ******************');
        this.setRedisData(redisKey, finalObj);
        resolve(true);
      } else {
        // console.log("set not data redis result &&&&&&&&&&&&&&&")
        const finalObj = {
          status: false,
          shifts: [],
          message: 'No Week Data Found',
        };

        this.setRedisData(redisKey, finalObj);
        resolve(true);
      }
    });
  }
  async getAssingShiftInto(item, body, days) {
    return new Promise(async (resolve, reject) => {
      let ops = await OpsGroup.findOne(
        { userId: item.staff_id._id },
        { _id: 1, opsGroupName: 1 },
      );
      let user = await User.findOne(
        { _id: item.staff_id._id },
        { _id: 0, role: 1, appointmentId: 1 },
      ).populate([
        {
          path: 'role',
          select: 'name',
        },
        { path: 'appointmentId', select: 'name' },
      ]);
      let attendance = await Attendance.findOne({
        shiftDetailId: item.shiftDetailId,
        userId: item.staff_id,
      });
      if (attendance) {
        item.attendance = attendance;
      } else {
        item.attendance = null;
      }
      if (user) {
        item.staffAppointmentId = user.appointmentId;
        item.staffRoleId = user.role;
      }
      //console.log('item.startTime', item.startTime, item._id);
      //console.log('item.date', item.date)
      var d = moment(new Date(item.date))
        .utcOffset(body.timeZone)
        .format('MM-DD-YYYY'); //new Date(item.startTime);
      //console.log('d', d);
      const date = moment(d, 'MM-DD-YYYY');
      const dow = date.day();
      //console.log(dow);
      // //console.log('item.startTime',d, new Date(d))
      var dayName = days[dow];
      item.dayName = dayName;
      if (item.shiftDetailId && item.shiftDetailId.isExtendedShift) {
        // //console.log('item.shiftDetailId.isExtendedShift', item.shiftDetailId.isExtendedShift);
        item.startTime = item.shiftDetailId.extendedStaff[0].startDateTime;
        item.endTime = item.shiftDetailId.extendedStaff[0].endDateTime;

        item.isExtendedShift = item.shiftDetailId.isExtendedShift;
        item.shiftDetailId = item.shiftDetailId._id;
      }
      if (ops) {
        item.staff_id['opsGroupName'] = ops.opsGroupName;
      }
      resolve(item);
      //   //console.log("ITEM IS: ",item);
    });
  }
  async readAssignShiftPrev(buIds) {
    let allBuId = [];
    if (!buIds) {
      allBuId = buIdsWithWeek;
    } else {
      const weekDetails = await SubSection.findOne(
        { _id: buIds },
        { noOfWeek: 1 },
      );
      allBuId.push({ buId: buIds, week: weekDetails.noOfWeek });
    }
    const mondayDate = getMonday(new Date());
    for (let buIndex = 0; buIndex < allBuId.length; buIndex++) {
      const noOfWeek = allBuId[buIndex].week;
      const buId = allBuId[buIndex].buId;
      for (let weekIndex = 1; weekIndex <= noOfWeek; weekIndex++) {
        const currentDate = moment(new Date(mondayDate))
          .add(-1 * weekIndex * 7, 'days')
          .utcOffset(480)
          .format('MM-DD-YYYY');
        //console.log("CurrentDate ", currentDate);
        const body = {
          weekRangeStartsAt: `${currentDate} 00:00:00 GMT+0800`,
          weekRangeEndsAt: '',
          businessUnitId: buId,
          timeZone: 480,
        };
        const redisKey = `assingShiftR${buId}${currentDate}`;

        const ddd = moment(new Date(body.weekRangeStartsAt))
          .utc()
          .format('MM-DD-YYYY HH:mm:ss Z');
        const year = new Date(ddd).getFullYear();
        const month = new Date(ddd).getMonth() + 1;
        const day = new Date(ddd).getDate(); //-1; // ashish
        //console.log('yy', year, month, day);
        const where = {
          //  staff_id:{$in: usersOfBu},
          businessUnitId: body.businessUnitId,
          $and: [
            { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
            { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
            { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
          ],
        };
        const findOrFindOne = AssignShift.find(where);
        let shifts1 = await findOrFindOne
          .select(
            'staff_id staffAppointmentId staffRoleId _id date reportLocationId startTime endTime day status ' +
              'shiftChangeRequestStatus subSkillSets shiftRead draftStatus shiftChangeRequestMessage duration shiftDetailId schemeDetails alertMessage isLimit isAlert isAllowPublish isOff isRest splitStartTime splitEndTime isSplitShift isRecalled isRecallAccepted isEmpty mainSkillSets skillSetTierType',
          )
          .populate([
            {
              path: 'staff_id',
              select:
                'name contactNumber email profilePicture staffId schemeId subSkillSets mainSkillSets',
              populate: [
                {
                  path: 'schemeId',
                  select: 'schemeName',
                },
                {
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'subSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'skillSetId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
              ],
            },
            {
              path: 'shiftDetailId',
              select: 'isExtendedShift extendedStaff',
            },
            {
              path: 'mainSkillSets',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'subSkillSets',
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'skillSetId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
            },
            // , {
            //     path: 'staffAppointmentId',
            //     select: 'name'
            // },{
            //     path: 'staffRoleId',
            //     select: 'name'
            // }
          ])
          .sort({ staffId: -1 });

        let shifts = JSON.stringify(shifts1);
        shifts = JSON.parse(shifts);
        //console.log("shifts: ", shifts.length);
        if (shifts.length > 0) {
          var days = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ];
          for (let i = 0; i <= shifts.length - 1; i++) {
            let item = shifts[i];

            let ops = await OpsGroup.findOne(
              { userId: item.staff_id._id },
              { _id: 1, opsGroupName: 1 },
            );
            let user = await User.findOne(
              { _id: item.staff_id._id },
              { _id: 0, role: 1, appointmentId: 1 },
            ).populate([
              {
                path: 'role',
                select: 'name',
              },
              { path: 'appointmentId', select: 'name' },
            ]);
            let attendance = await Attendance.findOne({
              shiftDetailId: item.shiftDetailId,
              userId: item.staff_id,
            });
            if (attendance) {
              item.attendance = attendance;
            } else {
              item.attendance = null;
            }
            if (user) {
              item.staffAppointmentId = user.appointmentId;
              item.staffRoleId = user.role;
            }
            //console.log('item.startTime', item.startTime, item._id);
            //console.log('item.date', item.date)
            var d = moment(new Date(item.date))
              .utcOffset(body.timeZone)
              .format('MM-DD-YYYY'); //new Date(item.startTime);
            //console.log('d', d);
            const date = moment(d, 'MM-DD-YYYY');
            const dow = date.day();
            //console.log(dow);
            // //console.log('item.startTime',d, new Date(d))
            var dayName = days[dow];
            item.dayName = dayName;
            if (item.shiftDetailId && item.shiftDetailId.isExtendedShift) {
              // //console.log('item.shiftDetailId.isExtendedShift', item.shiftDetailId.isExtendedShift);
              item.startTime =
                item.shiftDetailId.extendedStaff[0].startDateTime;
              item.endTime = item.shiftDetailId.extendedStaff[0].endDateTime;

              item.isExtendedShift = item.shiftDetailId.isExtendedShift;
              item.shiftDetailId = item.shiftDetailId._id;
            }
            if (ops) {
              item.staff_id['opsGroupName'] = ops.opsGroupName;
            }
            //   //console.log("ITEM IS: ",item);
          }

          shifts = _.mapValues(_.groupBy(shifts, 'dayName'));
          var newShifts = {
            Monday: shifts.Monday,
            Tuesday: shifts.Tuesday,
            Wednesday: shifts.Wednesday,
            Thursday: shifts.Thursday,
            Friday: shifts.Friday,
            Saturday: shifts.Saturday,
            Sunday: shifts.Sunday,
          };
          // //console.log('shifts', JSON.stringify(shifts))

          const finalObj = {
            status: true,
            shifts: newShifts,
            message: 'Week Data',
          };
          this.setRedisData(redisKey, finalObj);
        } else {
          const finalObj = {
            status: false,
            shifts: [],
            message: 'No Week Data Found',
          };
          this.setRedisData(redisKey, finalObj);
        }
      }
    }
  }
  async viewBookingsNext(buIds) {
    try {
      let allBuId = [];
      if (!buIds) {
        allBuId = buIdsWithWeek;
      } else {
        const weekDetails = await SubSection.findOne(
          { _id: buIds },
          { noOfWeek: 1 },
        );
        allBuId.push({ buId: buIds, week: weekDetails.noOfWeek });
      }
      const mondayDate = getMonday(new Date());
      for (let buIndex = 0; buIndex < allBuId.length; buIndex++) {
        const noOfWeek = allBuId[buIndex].week;
        const buId = allBuId[buIndex].buId;
        for (let weekIndex = 0; weekIndex < noOfWeek; weekIndex++) {
          const currentDate = moment(new Date(mondayDate))
            .add(weekIndex * 7, 'days')
            .utcOffset(480)
            .format('MM-DD-YYYY');
          //console.log("CurrentDate ", currentDate);
          const body = {
            startDate: `${currentDate} 00:00:00 GMT+0800`,
            weekRangeEndsAt: '',
            businessUnitId: buId,
            timeZone: 480,
            cancelledShifts: true,
          };
          const redisKey = `ViewBooking${buId}${currentDate}`;
          var timeZone = moment
              .parseZone(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
              .format('Z'),
            startDate = moment(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
              .utc()
              .format(),
            endDate = moment(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
              .add(5, 'days')
              .add(23, 'hours')
              .add(60, 'minutes')
              .add(59, 'seconds')
              .utc()
              .format(),
            weekNumber = await __.weekNoStartWithMonday(startDate);
          var startUnixDateTime = moment(startDate).unix(),
            endUnixDateTime = moment(endDate).unix();
          //use in future if giving problem
          const ddd = moment(new Date(body.startDate))
            .utc()
            .format('MM-DD-YYYY HH:mm:ss Z');
          const year = new Date(ddd).getFullYear();
          const month = new Date(ddd).getMonth() + 1;
          const day = new Date(ddd).getDate(); //-1; // remove comment for local ashish
          //console.log('yy', year, month, day);
          const whereShift = {
            businessUnitId: body.businessUnitId,
            status: 1,
            $and: [
              { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
              { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
              { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
            ],
          };
          var shift = await Shift.find(whereShift)
            .select('shiftDetails')
            .lean();
          //console.log('shofttttt', shift.length)
          function plucker(prop) {
            return function (o) {
              return o[prop];
            };
          }
          var shiftDetailsArray = shift.map(plucker('shiftDetails'));
          shiftDetailsArray = _.flatten(shiftDetailsArray);

          shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
          if (shiftDetailsArray.length == 0) {
            this.setRedisData(redisKey, shiftDetailsArray);
            //__.out(res, 201, shiftDetailsArray)
          } else {
            var where = {
              status: 1,
              _id: {
                $in: shiftDetailsArray,
              },
              'appliedStaffs.0': {
                $exists: true,
              },
              isAssignShift: false,
            };
            where.date = {
              $gte: startDate,
              $lte: endDate,
            };

            // __.log(moment(endDate).endOf('day').utc().format(), moment(startDate).startOf('day').utc().format(), 'formatIssues')

            // Show Cancelled Shifts Also
            if (body.cancelledShifts && body.cancelledShifts === true) {
              where.status = {
                $in: [1, 2],
              };
            }

            var findOrFindOne = ShiftDetails.find(where); //.select('appliedStaffs');

            let shifts = await findOrFindOne
              .populate([
                { path: 'appliedStaffs' },
                {
                  path: 'draftId',
                  select:
                    'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
                },
                {
                  path: 'shiftId',
                  select: '-shiftDetails',
                  match: {
                    businessUnitId: mongoose.Types.ObjectId(
                      body.businessUnitId,
                    ),
                  },
                  populate: [
                    {
                      path: 'plannedBy',
                      select: 'name staffId',
                    },
                    {
                      path: 'businessUnitId',
                      select:
                        'name adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'sectionId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                        populate: {
                          path: 'departmentId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                          populate: {
                            path: 'companyId',
                            select: 'name status',
                            match: {
                              status: 1,
                            },
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  path: 'reportLocationId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'subSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'skillSetId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
                {
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'confirmedStaffs',
                  select:
                    'name email contactNumber profilePicture subSkillSets mainSkillSets status,schemeId staffId',
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                    {
                      path: 'schemeId',
                      select: 'shiftSetup ',
                      match: {
                        status: true,
                      },
                    },
                  ],
                },
                {
                  path: 'backUpStaffs',
                  select:
                    'name email contactNumber profilePicture mainSkillSets subSkillSets status,schemeId staffId',
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                    {
                      path: 'schemeId',
                      select: 'shiftSetup',
                      match: {
                        status: true,
                      },
                    },
                  ],
                },
                {
                  path: 'requestedShifts',
                },
                {
                  path: 'currentReqShift',
                  populate: {
                    path: 'reportLocationId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
                {
                  path: 'requestedUsers.userId',
                  match: {
                    status: 1,
                  },
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                  ],
                },
              ])
              .sort({
                startTime: 1,
              });
            if (!body.shiftDetailsId) {
              var listData = {},
                graphData = {},
                graphDataWeb = {},
                dashboardGraphData = {
                  plannedFlexiHours: 0,
                  plannedFlexiShifts: 0,
                  bookedFlexiHours: 0,
                  bookedFlexiShifts: 0,
                  assignFlexiHours: 0,
                  assignFlexiShifts: 0,
                  assignFlexiStaff: 0,
                },
                customShiftDetails = [];
              shifts = shifts.filter((iii) => {
                return iii.shiftId;
              });
              await shifts.forEach((element) => {
                //console.log('element', element.isAssignShift)
                if (
                  (((element.mainSkillSets && element.mainSkillSets.length) ||
                    (element.subSkillSets && element.subSkillSets.length)) &&
                    element.reportLocationId &&
                    element.shiftId &&
                    element.shiftId.businessUnitId) ||
                  element.isAssignShift
                ) {
                  let tz = element.timeZone;
                  if (!tz) {
                    tz = '+0800';
                  }
                  var key = __.getDateStringFormat(element.date, tz);
                  // Remove Cancelled Shifts on Calculation
                  if (element.status == 1) {
                    //dashboard graph data starts
                    //console.log('element.isAssignShift', element.isAssignShift)
                    if (!element.isAssignShift) {
                      var confirmedStaffsCount = element.confirmedStaffs.length;
                      dashboardGraphData.plannedFlexiHours +=
                        element.staffNeedCount * element.duration;

                      dashboardGraphData.plannedFlexiShifts +=
                        element.staffNeedCount;
                      //backUpStaffs.length
                      dashboardGraphData.bookedFlexiHours +=
                        confirmedStaffsCount * element.duration;

                      dashboardGraphData.bookedFlexiShifts +=
                        confirmedStaffsCount;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        var confirmedStaffsCount =
                          element.confirmedStaffs.length;
                        if (element.isExtendedShift) {
                          const extendStaff = element.extendedStaff[0];
                          var hours =
                            Math.abs(
                              new Date(extendStaff.startDateTime).getTime() -
                                new Date(extendStaff.endDateTime).getTime(),
                            ) / 36e5;
                          dashboardGraphData.assignFlexiHours += hours;
                        } else {
                          dashboardGraphData.assignFlexiHours +=
                            element.staffNeedCount * element.duration;
                        }

                        dashboardGraphData.assignFlexiShifts +=
                          element.staffNeedCount;
                        dashboardGraphData.assignFlexiStaff +=
                          element.staffNeedCount;
                      }
                    }
                  }
                  //dashboard graph data ends 

                  // Remove Cancelled Shifts on Calculation
                  if (listData[key]) {
                    //if date already keyed in array 
                    listData[key].push(element);
                    // Add Hours in calculation only it is active shift
                    if (element.status == 1 && !element.isAssignShift) {
                      //console.log('1', key);
                      graphData[key].totalHours +=
                        element.duration * element.staffNeedCount;
                      graphData[key].confirmedHours +=
                        element.duration * element.confirmedStaffs.length;
                      graphData[key].standByHours +=
                        element.duration * element.backUpStaffs.length;
                      graphData[key].totalShifts += element.staffNeedCount;
                      graphDataWeb[key].totalHours.need +=
                        element.duration * element.staffNeedCount;

                      graphDataWeb[key].totalHours.booked +=
                        element.duration * element.confirmedStaffs.length;

                      graphDataWeb[key].numberOfShifts.need +=
                        element.staffNeedCount;

                      graphDataWeb[key].numberOfShifts.booked +=
                        element.confirmedStaffs.length;

                      graphDataWeb[key].totalHours.needAssign += 0;
                      graphDataWeb[key].numberOfShifts.needAssign += 0;
                      graphData[key].totalHoursAssign += 0;
                      graphData[key].totalShiftsAssign += 0;
                      graphData[key].assignFlexiStaff += 0;
                    } else {
                      if (element.status == 1) {
                        var isRecalled =
                          element.isRest || element.isOff ? true : false;
                        if (
                          (!isRecalled ||
                            (isRecalled && element.isRecallAccepted == 2)) &&
                          body.from != 'viewbooking'
                        ) {
                          //console.log('11', key);
                          graphData[key].totalHoursAssign +=
                            element.duration * element.staffNeedCount;
                          graphData[key].totalShiftsAssign +=
                            element.staffNeedCount;
                          graphData[key].assignFlexiStaff +=
                            element.staffNeedCount;
                          graphDataWeb[key].totalHours.needAssign +=
                            element.duration * element.staffNeedCount;
                          graphDataWeb[key].numberOfShifts.needAssign +=
                            element.staffNeedCount;

                          graphData[key].totalHours += 0;
                          graphData[key].totalShifts += 0;
                          graphDataWeb[key].totalHours.need += 0;

                          graphDataWeb[key].totalHours.booked += 0;

                          graphDataWeb[key].numberOfShifts.need += 0;

                          graphDataWeb[key].numberOfShifts.booked += 0;
                        }
                      }
                    }
                  } else {
                    //else create a new key by date in array 
                    listData[key] = [];
                    listData[key].push(element);
                    graphData[key] = {};
                    graphData[key].totalHours = 0;
                    graphData[key].totalShifts = 0;
                    graphData[key].confirmedHours = 0;
                    graphData[key].standByHours = 0;
                    graphData[key].totalHoursAssign = 0;
                    graphData[key].totalShiftsAssign = 0;
                    graphData[key].assignFlexiStaff = 0;
                    graphDataWeb[key] = {
                      totalHours: {
                        need: 0,
                        booked: 0,
                        needAssign: 0,
                      },
                      numberOfShifts: {
                        need: 0,
                        booked: 0,
                        needAssign: 0,
                      },
                    };
                    // Add Hours in calculation only it is active shift
                    if (element.status == 1 && !element.isAssignShift) {
                      graphData[key].totalHours =
                        element.duration * element.staffNeedCount;
                      graphData[key].confirmedHours +=
                        element.duration * element.confirmedStaffs.length;
                      graphData[key].standByHours +=
                        element.duration * element.backUpStaffs.length;
                      graphData[key].totalShifts = element.staffNeedCount;
                      graphDataWeb[key] = {
                        totalHours: {
                          need: element.duration * element.staffNeedCount,
                          booked:
                            element.duration * element.confirmedStaffs.length,
                          needAssign: 0,
                        },
                        numberOfShifts: {
                          need: element.staffNeedCount,
                          booked: element.confirmedStaffs.length,
                          needAssign: 0,
                        },
                      };

                      graphData[key].totalHoursAssign = 0;
                      graphData[key].totalShiftsAssign = 0;
                      graphData[key].assignFlexiStaff = 0;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        //console.log('all here')
                        graphData[key].totalHoursAssign =
                          element.duration * element.staffNeedCount;
                        graphData[key].totalShiftsAssign =
                          element.staffNeedCount;
                        graphData[key].assignFlexiStaff =
                          element.staffNeedCount;
                        graphDataWeb[key] = {
                          totalHours: {
                            needAssign:
                              element.duration * element.staffNeedCount,
                          },
                          numberOfShifts: {
                            needAssign: element.staffNeedCount,
                          },
                        };

                        graphData[key].totalHours = 0;
                        graphData[key].totalShifts = 0;
                        graphDataWeb[key].totalHours.need = 0;

                        graphDataWeb[key].totalHours.booked = 0;

                        graphDataWeb[key].numberOfShifts.need = 0;

                        graphDataWeb[key].numberOfShifts.booked = 0;
                      }
                    }
                  }

                  var customElement = _.omit(element, [
                    'shiftId',
                    'reportLocationId',
                    'subSkillSets',
                    'mainSkillSets',
                  ]);
                  customShiftDetails.push(customElement);
                }
              });

              //weeklyGraph starts 

              var staffNeedWeekdaysObj = {
                  monday: {},
                  tuesday: {},
                  wednesday: {},
                  thursday: {},
                  friday: {},
                  saturday: {},
                  sunday: {},
                },
                staffAppliedWeekdaysObj = _.cloneDeep(staffNeedWeekdaysObj);
              var staffNeedWeekdaysObjAssign = {
                  monday: {},
                  tuesday: {},
                  wednesday: {},
                  thursday: {},
                  friday: {},
                  saturday: {},
                  sunday: {},
                },
                staffAppliedWeekdaysObjAssign = _.cloneDeep(
                  staffNeedWeekdaysObjAssign,
                );
              for (let i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
                var dateTimeUnix = i * 1000;
                customShiftDetails = JSON.parse(
                  JSON.stringify(customShiftDetails),
                );
                await customShiftDetails.forEach(async (element) => {
                  var weekDay = __.getDayStringFormatFromUnix(i, timeZone),
                    staffNeedCount = 0,
                    appliedStaffCount = 0,
                    staffNeedCountAssign = 0,
                    appliedStaffCountAssing = 0;
                  if (
                    i >= element.startTimeInSeconds &&
                    i <= element.endTimeInSeconds
                  ) {
                    //shift matches the time then it will take the count else it will assign 0 by default 
                    if (!element.isAssignShift) {
                      //console.log('inthis')
                      staffNeedCount = element.staffNeedCount;
                      appliedStaffCount = element.confirmedStaffs.length;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        staffNeedCountAssign = element.staffNeedCount;
                        appliedStaffCountAssing =
                          element.confirmedStaffs.length;
                      }
                    }
                  }
                  //if(!element.isAssignShift){
                  if (
                    typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it

                    staffNeedWeekdaysObj[weekDay][dateTimeUnix] +=
                      staffNeedCount;
                  } else {
                    staffNeedWeekdaysObj[weekDay][dateTimeUnix] =
                      staffNeedCount;
                  }

                  if (
                    typeof staffAppliedWeekdaysObj[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it 
                    staffAppliedWeekdaysObj[
                      weekDay
                    ][dateTimeUnix] += appliedStaffCount;
                  } else {
                    staffAppliedWeekdaysObj[weekDay][dateTimeUnix] =
                      appliedStaffCount;
                  }
                  // }else {
                  // assign code
                  if (
                    typeof staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it

                    staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] +=
                      staffNeedCountAssign;
                  } else {
                    staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                      staffNeedCountAssign;
                  }

                  if (
                    typeof staffAppliedWeekdaysObjAssign[weekDay][
                      dateTimeUnix
                    ] != 'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it 
                    staffAppliedWeekdaysObjAssign[
                      weekDay
                    ][dateTimeUnix] += appliedStaffCountAssing;
                  } else {
                    staffAppliedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                      appliedStaffCountAssing;
                  }
                  // }
                });
              }

              // deleteMany
              //FORMAT THE RESPONSE (for both need and applied datas) AS {'monday':[[1514223000000,2],[1514223000000,2]],'tuesday':[[1514223000000,2],[1514223000000,2]],....} 
              var formattedAppliedStaffData = {},
                formattedNeedStaffData = {};
              var formattedAppliedStaffDataAssign = {},
                formattedNeedStaffDataAssing = {};

              for (let appliedElement in staffAppliedWeekdaysObj) {
                formattedAppliedStaffData[appliedElement] = [];

                for (let time in staffAppliedWeekdaysObj[appliedElement]) {
                  var array = [
                    Number(time),
                    Number(staffAppliedWeekdaysObj[appliedElement][time]),
                  ];

                  formattedAppliedStaffData[appliedElement].push(array);
                }
              }
              for (let needElement in staffNeedWeekdaysObj) {
                formattedNeedStaffData[needElement] = [];

                for (let time in staffNeedWeekdaysObj[needElement]) {
                  var array = [
                    Number(time),
                    Number(staffNeedWeekdaysObj[needElement][time]),
                  ];

                  formattedNeedStaffData[needElement].push(array);
                }
              }
              // assign code
              for (let appliedElement in staffAppliedWeekdaysObjAssign) {
                formattedAppliedStaffDataAssign[appliedElement] = [];

                for (let time in staffAppliedWeekdaysObjAssign[
                  appliedElement
                ]) {
                  var array = [
                    Number(time),
                    Number(staffAppliedWeekdaysObjAssign[appliedElement][time]),
                  ];

                  formattedAppliedStaffDataAssign[appliedElement].push(array);
                }
              }
              for (let needElement in staffNeedWeekdaysObjAssign) {
                formattedNeedStaffDataAssing[needElement] = [];

                for (let time in staffNeedWeekdaysObjAssign[needElement]) {
                  var array = [
                    Number(time),
                    Number(staffNeedWeekdaysObjAssign[needElement][time]),
                  ];

                  formattedNeedStaffDataAssing[needElement].push(array);
                }
              }

              var data = {
                  businessUnitId: body.businessUnitId,
                  weekNumber: weekNumber,
                },
                clientWeeklyStaffData =
                  await WeeklyStaffData.weeklyStaffingData(data),
                weeklyStaffGraphData = {
                  clientFlexiStaffData: {},
                  clientStaffData: {},
                  staffNeedData: formattedNeedStaffData,
                  staffAppliedData: formattedAppliedStaffData,
                  staffNeedDataAssing: formattedNeedStaffDataAssing,
                  staffAppliedDataAssing: formattedAppliedStaffDataAssign,
                };

              if (clientWeeklyStaffData) {
                if (clientWeeklyStaffData.flexiStaffData)
                  weeklyStaffGraphData.clientFlexiStaffData =
                    clientWeeklyStaffData.flexiStaffData;

                if (clientWeeklyStaffData.staffData)
                  weeklyStaffGraphData.clientStaffData =
                    clientWeeklyStaffData.staffData;
              }

              //weeklyGraph ends 

              var updatedDashboardGraphData = {};

              for (let each in dashboardGraphData) {
                updatedDashboardGraphData[each] =
                  dashboardGraphData[each].toFixed(2);
              }
              // __.log(listData)
              var templistData = JSON.stringify(listData);
              listData = JSON.parse(templistData);
              for (let date in listData) {
                listData[date].forEach((item, index) => {
                  if (item.isLimit) {
                    const isLimitedStaff = item.appliedStaffs.filter(
                      (limit) => {
                        return limit.status == 1 && limit.isLimit;
                      },
                    );
                    if (isLimitedStaff.length > 0) {
                      for (let kk = 0; kk < item.confirmedStaffs.length; kk++) {
                        const staffCheck = item.confirmedStaffs[kk];
                        let isLimitStaffId = isLimitedStaff.filter((limit) => {
                          return limit.flexiStaff == staffCheck._id;
                        });
                        if (isLimitStaffId.length > 0) {
                          item.confirmedStaffs[kk].isLimit = true;
                        }
                      }
                    }
                  }
                  if (item.isExtendedShift) {
                    //console.log('present');
                    if (item.extendedStaff) {
                      item.extendedStaff.forEach((extendedStaffItem) => {
                        if (item.confirmedStaffs) {
                          item.confirmedStaffs.forEach(
                            (confirmedStaffsItem) => {
                              // //console.log(typeof confirmedStaffs._id, confirmedStaffs._id,extendedStaff.userId )
                              if (
                                confirmedStaffsItem._id.toString() ===
                                extendedStaffItem.userId.toString()
                              ) {
                                confirmedStaffsItem.confirmStatus =
                                  extendedStaffItem.confirmStatus;
                                confirmedStaffsItem.endDateTime =
                                  extendedStaffItem.endDateTime;
                                confirmedStaffsItem.startDateTime =
                                  extendedStaffItem.startDateTime;
                                confirmedStaffsItem.isLimit =
                                  extendedStaffItem.isLimit;
                                //console.log('match')
                              }
                            },
                          );
                        }
                      });
                    }
                  }
                  if (item.isSplitShift) {
                    listData[date].forEach((splitItem, splitIndex) => {
                      if (splitIndex !== index) {
                        if (
                          splitItem.isSplitShift &&
                          new Date(splitItem.date).getTime() ===
                            new Date(item.date).getTime() &&
                          splitItem.shiftId._id === item.shiftId._id
                        ) {
                          item.splitShiftStartTime = splitItem.startTime;
                          item.splitShiftEndTime = splitItem.endTime;
                          item.splitShiftId = splitItem._id;
                          listData[date].splice(splitIndex, 1);
                        }
                      }
                    });
                  }
                });
              }

              for (let prop in graphData) {
                if (Object.prototype.hasOwnProperty.call(graphData, prop)) {
                  // do stuff
                  if (
                    graphData[prop].totalHours % 1 != 0 &&
                    graphData[prop].totalHours > 0
                  )
                    graphData[prop].totalHours = parseFloat(
                      graphData[prop].totalHours.toFixed(2),
                    );
                }
              }
              for (let prop in graphDataWeb) {
                if (Object.prototype.hasOwnProperty.call(graphDataWeb, prop)) {
                  // do stuff
                  if (
                    graphDataWeb[prop].totalHours.need % 1 != 0 &&
                    graphDataWeb[prop].totalHours.need
                  )
                    graphDataWeb[prop].totalHours.need = parseFloat(
                      graphDataWeb[prop].totalHours.need.toFixed(2),
                    );
                  if (
                    graphDataWeb[prop].totalHours.booked % 1 != 0 &&
                    graphDataWeb[prop].totalHours.booked
                  )
                    graphDataWeb[prop].totalHours.booked = parseFloat(
                      graphDataWeb[prop].totalHours.booked.toFixed(2),
                    );
                }
              }
              var templistData = JSON.stringify(listData);
              listData = JSON.parse(templistData);
              var newListData = {};
              for (let date in listData) {
                newListData[date] = [];
                listData[date].forEach((item, index) => {
                  item.confirmedStaffs.forEach((staf) => {
                    var temp = JSON.parse(JSON.stringify(item));
                    if (temp.isExtendedShift) {
                      temp.extendedStaff = temp.extendedStaff.filter(
                        (extStaff) =>
                          extStaff.userId == staf._id &&
                          extStaff.confirmStatus == 2,
                      );
                      if (temp.extendedStaff.length == 0) {
                        temp.isExtendedShift = false;
                      }
                    }
                    temp.confirmedStaffs = staf;
                    newListData[date].push(temp);
                  });
                });
              }

              this.setRedisData(redisKey, {
                list: newListData,
                graph: graphData,
              });
              // __.out(res, 201, {
              //     list: newListData,
              //     graph: graphData
              // });
            } else {
              // __.out(res, 201, {
              //     shifts: shifts
              // });
            }
          }
        }
      }
    } catch (err) {
      // //console.log(err);
    }
  }
  async viewBookingsPrev(buIds) {
    try {
      let allBuId = [];
      if (!buIds) {
        allBuId = buIdsWithWeek;
      } else {
        const weekDetails = await SubSection.findOne(
          { _id: buIds },
          { noOfWeek: 1 },
        );
        allBuId.push({ buId: buIds, week: weekDetails.noOfWeek });
      }
      const mondayDate = getMonday(new Date());
      for (let buIndex = 0; buIndex < allBuId.length; buIndex++) {
        const noOfWeek = allBuId[buIndex].week;
        const buId = allBuId[buIndex].buId;
        for (let weekIndex = 1; weekIndex <= noOfWeek; weekIndex++) {
          const currentDate = moment(new Date(mondayDate))
            .add(-1 * weekIndex * 7, 'days')
            .utcOffset(480)
            .format('MM-DD-YYYY');
          //console.log("CurrentDate ", currentDate);
          const body = {
            startDate: `${currentDate} 00:00:00 GMT+0800`,
            weekRangeEndsAt: '',
            businessUnitId: buId,
            timeZone: 480,
            cancelledShifts: true,
          };
          const redisKey = `ViewBooking${buId}${currentDate}`;
          var timeZone = moment
              .parseZone(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
              .format('Z'),
            startDate = moment(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
              .utc()
              .format(),
            endDate = moment(body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
              .add(5, 'days')
              .add(23, 'hours')
              .add(60, 'minutes')
              .add(59, 'seconds')
              .utc()
              .format(),
            weekNumber = await __.weekNoStartWithMonday(startDate);
          var startUnixDateTime = moment(startDate).unix(),
            endUnixDateTime = moment(endDate).unix();
          //use in future if giving problem
          const ddd = moment(new Date(body.startDate))
            .utc()
            .format('MM-DD-YYYY HH:mm:ss Z');
          const year = new Date(ddd).getFullYear();
          const month = new Date(ddd).getMonth() + 1;
          const day = new Date(ddd).getDate(); //-1; // remove comment for local ashish
          //console.log('yy', year, month, day);
          const whereShift = {
            businessUnitId: body.businessUnitId,
            status: 1,
            $and: [
              { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
              { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
              { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
            ],
          };
          var shift = await Shift.find(whereShift)
            .select('shiftDetails')
            .lean();
          //console.log('shofttttt', shift.length)
          function plucker(prop) {
            return function (o) {
              return o[prop];
            };
          }
          var shiftDetailsArray = shift.map(plucker('shiftDetails'));
          shiftDetailsArray = _.flatten(shiftDetailsArray);

          shiftDetailsArray = Array.from(new Set(shiftDetailsArray));
          if (shiftDetailsArray.length == 0) {
            this.setRedisData(redisKey, shiftDetailsArray);
            //__.out(res, 201, shiftDetailsArray)
          } else {
            var where = {
              status: 1,
              _id: {
                $in: shiftDetailsArray,
              },
              'appliedStaffs.0': {
                $exists: true,
              },
              isAssignShift: false,
            };
            where.date = {
              $gte: startDate,
              $lte: endDate,
            };

            // __.log(moment(endDate).endOf('day').utc().format(), moment(startDate).startOf('day').utc().format(), 'formatIssues')

            // Show Cancelled Shifts Also
            if (body.cancelledShifts && body.cancelledShifts === true) {
              where.status = {
                $in: [1, 2],
              };
            }

            var findOrFindOne = ShiftDetails.find(where); //.select('appliedStaffs');

            let shifts = await findOrFindOne
              .populate([
                { path: 'appliedStaffs' },
                {
                  path: 'draftId',
                  select:
                    'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
                },
                {
                  path: 'shiftId',
                  select: '-shiftDetails',
                  match: {
                    businessUnitId: mongoose.Types.ObjectId(
                      body.businessUnitId,
                    ),
                  },
                  populate: [
                    {
                      path: 'plannedBy',
                      select: 'name staffId',
                    },
                    {
                      path: 'businessUnitId',
                      select:
                        'name adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'sectionId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                        populate: {
                          path: 'departmentId',
                          select: 'name status',
                          match: {
                            status: 1,
                          },
                          populate: {
                            path: 'companyId',
                            select: 'name status',
                            match: {
                              status: 1,
                            },
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  path: 'reportLocationId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'subSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'skillSetId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
                {
                  path: 'mainSkillSets',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
                {
                  path: 'confirmedStaffs',
                  select:
                    'name email contactNumber profilePicture subSkillSets mainSkillSets status,schemeId staffId',
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                    {
                      path: 'schemeId',
                      select: 'shiftSetup ',
                      match: {
                        status: true,
                      },
                    },
                  ],
                },
                {
                  path: 'backUpStaffs',
                  select:
                    'name email contactNumber profilePicture mainSkillSets subSkillSets status,schemeId staffId',
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                    {
                      path: 'schemeId',
                      select: 'shiftSetup',
                      match: {
                        status: true,
                      },
                    },
                  ],
                },
                {
                  path: 'requestedShifts',
                },
                {
                  path: 'currentReqShift',
                  populate: {
                    path: 'reportLocationId',
                    select: 'name status',
                    match: {
                      status: 1,
                    },
                  },
                },
                {
                  path: 'requestedUsers.userId',
                  match: {
                    status: 1,
                  },
                  populate: [
                    {
                      path: 'subSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                      populate: {
                        path: 'skillSetId',
                        select: 'name status',
                        match: {
                          status: 1,
                        },
                      },
                    },
                    {
                      path: 'mainSkillSets',
                      select: 'name status',
                      match: {
                        status: 1,
                      },
                    },
                  ],
                },
              ])
              .sort({
                startTime: 1,
              });
            if (!body.shiftDetailsId) {
              var listData = {},
                graphData = {},
                graphDataWeb = {},
                dashboardGraphData = {
                  plannedFlexiHours: 0,
                  plannedFlexiShifts: 0,
                  bookedFlexiHours: 0,
                  bookedFlexiShifts: 0,
                  assignFlexiHours: 0,
                  assignFlexiShifts: 0,
                  assignFlexiStaff: 0,
                },
                customShiftDetails = [];
              shifts = shifts.filter((iii) => {
                return iii.shiftId;
              });
              await shifts.forEach((element) => {
                //console.log('element', element.isAssignShift)
                if (
                  (((element.mainSkillSets && element.mainSkillSets.length) ||
                    (element.subSkillSets && element.subSkillSets.length)) &&
                    element.reportLocationId &&
                    element.shiftId &&
                    element.shiftId.businessUnitId) ||
                  element.isAssignShift
                ) {
                  let tz = element.timeZone;
                  if (!tz) {
                    tz = '+0800';
                  }
                  var key = __.getDateStringFormat(element.date, tz);
                  // Remove Cancelled Shifts on Calculation
                  if (element.status == 1) {
                    //dashboard graph data starts
                    //console.log('element.isAssignShift', element.isAssignShift)
                    if (!element.isAssignShift) {
                      var confirmedStaffsCount = element.confirmedStaffs.length;
                      dashboardGraphData.plannedFlexiHours +=
                        element.staffNeedCount * element.duration;

                      dashboardGraphData.plannedFlexiShifts +=
                        element.staffNeedCount;
                      //backUpStaffs.length
                      dashboardGraphData.bookedFlexiHours +=
                        confirmedStaffsCount * element.duration;

                      dashboardGraphData.bookedFlexiShifts +=
                        confirmedStaffsCount;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        var confirmedStaffsCount =
                          element.confirmedStaffs.length;
                        if (element.isExtendedShift) {
                          const extendStaff = element.extendedStaff[0];
                          var hours =
                            Math.abs(
                              new Date(extendStaff.startDateTime).getTime() -
                                new Date(extendStaff.endDateTime).getTime(),
                            ) / 36e5;
                          dashboardGraphData.assignFlexiHours += hours;
                        } else {
                          dashboardGraphData.assignFlexiHours +=
                            element.staffNeedCount * element.duration;
                        }

                        dashboardGraphData.assignFlexiShifts +=
                          element.staffNeedCount;
                        dashboardGraphData.assignFlexiStaff +=
                          element.staffNeedCount;
                      }
                    }
                  }
                  //dashboard graph data ends 

                  // Remove Cancelled Shifts on Calculation
                  if (listData[key]) {
                    //if date already keyed in array 
                    listData[key].push(element);
                    // Add Hours in calculation only it is active shift
                    if (element.status == 1 && !element.isAssignShift) {
                      //console.log('1', key);
                      graphData[key].totalHours +=
                        element.duration * element.staffNeedCount;
                      graphData[key].confirmedHours +=
                        element.duration * element.confirmedStaffs.length;
                      graphData[key].standByHours +=
                        element.duration * element.backUpStaffs.length;
                      graphData[key].totalShifts += element.staffNeedCount;
                      graphDataWeb[key].totalHours.need +=
                        element.duration * element.staffNeedCount;

                      graphDataWeb[key].totalHours.booked +=
                        element.duration * element.confirmedStaffs.length;

                      graphDataWeb[key].numberOfShifts.need +=
                        element.staffNeedCount;

                      graphDataWeb[key].numberOfShifts.booked +=
                        element.confirmedStaffs.length;

                      graphDataWeb[key].totalHours.needAssign += 0;
                      graphDataWeb[key].numberOfShifts.needAssign += 0;
                      graphData[key].totalHoursAssign += 0;
                      graphData[key].totalShiftsAssign += 0;
                      graphData[key].assignFlexiStaff += 0;
                    } else {
                      if (element.status == 1) {
                        var isRecalled =
                          element.isRest || element.isOff ? true : false;
                        if (
                          (!isRecalled ||
                            (isRecalled && element.isRecallAccepted == 2)) &&
                          body.from != 'viewbooking'
                        ) {
                          //console.log('11', key);
                          graphData[key].totalHoursAssign +=
                            element.duration * element.staffNeedCount;
                          graphData[key].totalShiftsAssign +=
                            element.staffNeedCount;
                          graphData[key].assignFlexiStaff +=
                            element.staffNeedCount;
                          graphDataWeb[key].totalHours.needAssign +=
                            element.duration * element.staffNeedCount;
                          graphDataWeb[key].numberOfShifts.needAssign +=
                            element.staffNeedCount;

                          graphData[key].totalHours += 0;
                          graphData[key].totalShifts += 0;
                          graphDataWeb[key].totalHours.need += 0;

                          graphDataWeb[key].totalHours.booked += 0;

                          graphDataWeb[key].numberOfShifts.need += 0;

                          graphDataWeb[key].numberOfShifts.booked += 0;
                        }
                      }
                    }
                  } else {
                    //else create a new key by date in array 
                    listData[key] = [];
                    listData[key].push(element);
                    graphData[key] = {};
                    graphData[key].totalHours = 0;
                    graphData[key].totalShifts = 0;
                    graphData[key].confirmedHours = 0;
                    graphData[key].standByHours = 0;
                    graphData[key].totalHoursAssign = 0;
                    graphData[key].totalShiftsAssign = 0;
                    graphData[key].assignFlexiStaff = 0;
                    graphDataWeb[key] = {
                      totalHours: {
                        need: 0,
                        booked: 0,
                        needAssign: 0,
                      },
                      numberOfShifts: {
                        need: 0,
                        booked: 0,
                        needAssign: 0,
                      },
                    };
                    // Add Hours in calculation only it is active shift
                    if (element.status == 1 && !element.isAssignShift) {
                      graphData[key].totalHours =
                        element.duration * element.staffNeedCount;
                      graphData[key].confirmedHours +=
                        element.duration * element.confirmedStaffs.length;
                      graphData[key].standByHours +=
                        element.duration * element.backUpStaffs.length;
                      graphData[key].totalShifts = element.staffNeedCount;
                      graphDataWeb[key] = {
                        totalHours: {
                          need: element.duration * element.staffNeedCount,
                          booked:
                            element.duration * element.confirmedStaffs.length,
                          needAssign: 0,
                        },
                        numberOfShifts: {
                          need: element.staffNeedCount,
                          booked: element.confirmedStaffs.length,
                          needAssign: 0,
                        },
                      };

                      graphData[key].totalHoursAssign = 0;
                      graphData[key].totalShiftsAssign = 0;
                      graphData[key].assignFlexiStaff = 0;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        //console.log('all here')
                        graphData[key].totalHoursAssign =
                          element.duration * element.staffNeedCount;
                        graphData[key].totalShiftsAssign =
                          element.staffNeedCount;
                        graphData[key].assignFlexiStaff =
                          element.staffNeedCount;
                        graphDataWeb[key] = {
                          totalHours: {
                            needAssign:
                              element.duration * element.staffNeedCount,
                          },
                          numberOfShifts: {
                            needAssign: element.staffNeedCount,
                          },
                        };

                        graphData[key].totalHours = 0;
                        graphData[key].totalShifts = 0;
                        graphDataWeb[key].totalHours.need = 0;

                        graphDataWeb[key].totalHours.booked = 0;

                        graphDataWeb[key].numberOfShifts.need = 0;

                        graphDataWeb[key].numberOfShifts.booked = 0;
                      }
                    }
                  }

                  var customElement = _.omit(element, [
                    'shiftId',
                    'reportLocationId',
                    'subSkillSets',
                    'mainSkillSets',
                  ]);
                  customShiftDetails.push(customElement);
                }
              });

              //weeklyGraph starts 

              var staffNeedWeekdaysObj = {
                  monday: {},
                  tuesday: {},
                  wednesday: {},
                  thursday: {},
                  friday: {},
                  saturday: {},
                  sunday: {},
                },
                staffAppliedWeekdaysObj = _.cloneDeep(staffNeedWeekdaysObj);
              var staffNeedWeekdaysObjAssign = {
                  monday: {},
                  tuesday: {},
                  wednesday: {},
                  thursday: {},
                  friday: {},
                  saturday: {},
                  sunday: {},
                },
                staffAppliedWeekdaysObjAssign = _.cloneDeep(
                  staffNeedWeekdaysObjAssign,
                );
              for (let i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
                var dateTimeUnix = i * 1000;
                customShiftDetails = JSON.parse(
                  JSON.stringify(customShiftDetails),
                );
                await customShiftDetails.forEach(async (element) => {
                  var weekDay = __.getDayStringFormatFromUnix(i, timeZone),
                    staffNeedCount = 0,
                    appliedStaffCount = 0,
                    staffNeedCountAssign = 0,
                    appliedStaffCountAssing = 0;
                  if (
                    i >= element.startTimeInSeconds &&
                    i <= element.endTimeInSeconds
                  ) {
                    //shift matches the time then it will take the count else it will assign 0 by default 
                    if (!element.isAssignShift) {
                      //console.log('inthis')
                      staffNeedCount = element.staffNeedCount;
                      appliedStaffCount = element.confirmedStaffs.length;
                    } else {
                      var isRecalled =
                        element.isRest || element.isOff ? true : false;
                      if (
                        (!isRecalled ||
                          (isRecalled && element.isRecallAccepted == 2)) &&
                        body.from != 'viewbooking'
                      ) {
                        staffNeedCountAssign = element.staffNeedCount;
                        appliedStaffCountAssing =
                          element.confirmedStaffs.length;
                      }
                    }
                  }
                  //if(!element.isAssignShift){
                  if (
                    typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it

                    staffNeedWeekdaysObj[weekDay][dateTimeUnix] +=
                      staffNeedCount;
                  } else {
                    staffNeedWeekdaysObj[weekDay][dateTimeUnix] =
                      staffNeedCount;
                  }

                  if (
                    typeof staffAppliedWeekdaysObj[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it 
                    staffAppliedWeekdaysObj[
                      weekDay
                    ][dateTimeUnix] += appliedStaffCount;
                  } else {
                    staffAppliedWeekdaysObj[weekDay][dateTimeUnix] =
                      appliedStaffCount;
                  }
                  // }else {
                  // assign code
                  if (
                    typeof staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] !=
                    'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it

                    staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] +=
                      staffNeedCountAssign;
                  } else {
                    staffNeedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                      staffNeedCountAssign;
                  }

                  if (
                    typeof staffAppliedWeekdaysObjAssign[weekDay][
                      dateTimeUnix
                    ] != 'undefined'
                  ) {
                    //dont change to if condition bcoz it may be zero so it fails in it 
                    staffAppliedWeekdaysObjAssign[
                      weekDay
                    ][dateTimeUnix] += appliedStaffCountAssing;
                  } else {
                    staffAppliedWeekdaysObjAssign[weekDay][dateTimeUnix] =
                      appliedStaffCountAssing;
                  }
                  // }
                });
              }

              // deleteMany
              //FORMAT THE RESPONSE (for both need and applied datas) AS {'monday':[[1514223000000,2],[1514223000000,2]],'tuesday':[[1514223000000,2],[1514223000000,2]],....} 
              var formattedAppliedStaffData = {},
                formattedNeedStaffData = {};
              var formattedAppliedStaffDataAssign = {},
                formattedNeedStaffDataAssing = {};

              for (let appliedElement in staffAppliedWeekdaysObj) {
                formattedAppliedStaffData[appliedElement] = [];

                for (let time in staffAppliedWeekdaysObj[appliedElement]) {
                  var array = [
                    Number(time),
                    Number(staffAppliedWeekdaysObj[appliedElement][time]),
                  ];

                  formattedAppliedStaffData[appliedElement].push(array);
                }
              }
              for (let needElement in staffNeedWeekdaysObj) {
                formattedNeedStaffData[needElement] = [];

                for (let time in staffNeedWeekdaysObj[needElement]) {
                  var array = [
                    Number(time),
                    Number(staffNeedWeekdaysObj[needElement][time]),
                  ];

                  formattedNeedStaffData[needElement].push(array);
                }
              }
              // assign code
              for (let appliedElement in staffAppliedWeekdaysObjAssign) {
                formattedAppliedStaffDataAssign[appliedElement] = [];

                for (let time in staffAppliedWeekdaysObjAssign[
                  appliedElement
                ]) {
                  var array = [
                    Number(time),
                    Number(staffAppliedWeekdaysObjAssign[appliedElement][time]),
                  ];

                  formattedAppliedStaffDataAssign[appliedElement].push(array);
                }
              }
              for (let needElement in staffNeedWeekdaysObjAssign) {
                formattedNeedStaffDataAssing[needElement] = [];

                for (let time in staffNeedWeekdaysObjAssign[needElement]) {
                  var array = [
                    Number(time),
                    Number(staffNeedWeekdaysObjAssign[needElement][time]),
                  ];

                  formattedNeedStaffDataAssing[needElement].push(array);
                }
              }

              var data = {
                  businessUnitId: body.businessUnitId,
                  weekNumber: weekNumber,
                },
                clientWeeklyStaffData =
                  await WeeklyStaffData.weeklyStaffingData(data),
                weeklyStaffGraphData = {
                  clientFlexiStaffData: {},
                  clientStaffData: {},
                  staffNeedData: formattedNeedStaffData,
                  staffAppliedData: formattedAppliedStaffData,
                  staffNeedDataAssing: formattedNeedStaffDataAssing,
                  staffAppliedDataAssing: formattedAppliedStaffDataAssign,
                };

              if (clientWeeklyStaffData) {
                if (clientWeeklyStaffData.flexiStaffData)
                  weeklyStaffGraphData.clientFlexiStaffData =
                    clientWeeklyStaffData.flexiStaffData;

                if (clientWeeklyStaffData.staffData)
                  weeklyStaffGraphData.clientStaffData =
                    clientWeeklyStaffData.staffData;
              }

              //weeklyGraph ends 

              var updatedDashboardGraphData = {};

              for (let each in dashboardGraphData) {
                updatedDashboardGraphData[each] =
                  dashboardGraphData[each].toFixed(2);
              }
              // __.log(listData)
              var templistData = JSON.stringify(listData);
              listData = JSON.parse(templistData);
              for (let date in listData) {
                listData[date].forEach((item, index) => {
                  if (item.isLimit) {
                    const isLimitedStaff = item.appliedStaffs.filter(
                      (limit) => {
                        return limit.status == 1 && limit.isLimit;
                      },
                    );
                    if (isLimitedStaff.length > 0) {
                      for (let kk = 0; kk < item.confirmedStaffs.length; kk++) {
                        const staffCheck = item.confirmedStaffs[kk];
                        let isLimitStaffId = isLimitedStaff.filter((limit) => {
                          return limit.flexiStaff == staffCheck._id;
                        });
                        if (isLimitStaffId.length > 0) {
                          item.confirmedStaffs[kk].isLimit = true;
                        }
                      }
                    }
                  }
                  if (item.isExtendedShift) {
                    //console.log('present');
                    if (item.extendedStaff) {
                      item.extendedStaff.forEach((extendedStaffItem) => {
                        if (item.confirmedStaffs) {
                          item.confirmedStaffs.forEach(
                            (confirmedStaffsItem) => {
                              // //console.log(typeof confirmedStaffs._id, confirmedStaffs._id,extendedStaff.userId )
                              if (
                                confirmedStaffsItem._id.toString() ===
                                extendedStaffItem.userId.toString()
                              ) {
                                confirmedStaffsItem.confirmStatus =
                                  extendedStaffItem.confirmStatus;
                                confirmedStaffsItem.endDateTime =
                                  extendedStaffItem.endDateTime;
                                confirmedStaffsItem.startDateTime =
                                  extendedStaffItem.startDateTime;
                                confirmedStaffsItem.isLimit =
                                  extendedStaffItem.isLimit;
                                //console.log('match')
                              }
                            },
                          );
                        }
                      });
                    }
                  }
                  if (item.isSplitShift) {
                    listData[date].forEach((splitItem, splitIndex) => {
                      if (splitIndex !== index) {
                        if (
                          splitItem.isSplitShift &&
                          new Date(splitItem.date).getTime() ===
                            new Date(item.date).getTime() &&
                          splitItem.shiftId._id === item.shiftId._id
                        ) {
                          item.splitShiftStartTime = splitItem.startTime;
                          item.splitShiftEndTime = splitItem.endTime;
                          item.splitShiftId = splitItem._id;
                          listData[date].splice(splitIndex, 1);
                        }
                      }
                    });
                  }
                });
              }

              for (let prop in graphData) {
                if (Object.prototype.hasOwnProperty.call(graphData, prop)) {
                  // do stuff
                  if (
                    graphData[prop].totalHours % 1 != 0 &&
                    graphData[prop].totalHours > 0
                  )
                    graphData[prop].totalHours = parseFloat(
                      graphData[prop].totalHours.toFixed(2),
                    );
                }
              }
              for (let prop in graphDataWeb) {
                if (Object.prototype.hasOwnProperty.call(graphDataWeb, prop)) {
                  // do stuff
                  if (
                    graphDataWeb[prop].totalHours.need % 1 != 0 &&
                    graphDataWeb[prop].totalHours.need
                  )
                    graphDataWeb[prop].totalHours.need = parseFloat(
                      graphDataWeb[prop].totalHours.need.toFixed(2),
                    );
                  if (
                    graphDataWeb[prop].totalHours.booked % 1 != 0 &&
                    graphDataWeb[prop].totalHours.booked
                  )
                    graphDataWeb[prop].totalHours.booked = parseFloat(
                      graphDataWeb[prop].totalHours.booked.toFixed(2),
                    );
                }
              }
              var templistData = JSON.stringify(listData);
              listData = JSON.parse(templistData);
              var newListData = {};
              for (let date in listData) {
                newListData[date] = [];
                listData[date].forEach((item, index) => {
                  item.confirmedStaffs.forEach((staf) => {
                    var temp = JSON.parse(JSON.stringify(item));
                    if (temp.isExtendedShift) {
                      temp.extendedStaff = temp.extendedStaff.filter(
                        (extStaff) =>
                          extStaff.userId == staf._id &&
                          extStaff.confirmStatus == 2,
                      );
                      if (temp.extendedStaff.length == 0) {
                        temp.isExtendedShift = false;
                      }
                    }
                    temp.confirmedStaffs = staf;
                    newListData[date].push(temp);
                  });
                });
              }

              this.setRedisData(redisKey, {
                list: newListData,
                graph: graphData,
              });
              // __.out(res, 201, {
              //     list: newListData,
              //     graph: graphData
              // });
            } else {
              // __.out(res, 201, {
              //     shifts: shifts
              // });
            }
          }
        }
      }
    } catch (err) {
      // //console.log(err);
    }
  }
}
///timesheet/read/
// /timesheet/buid
// /timesheet/history/
redisData = new redisData();
module.exports = redisData;
//setTimeout(() => {
new CronJob({
  cronTime: '/2 * * * *',
  onTick: async function () {
    console.log('timeshet redis cron');
    const buIdss = await SubSection.find(
      { 'scheme.0': { $exists: true } },
      { _id: 1, noOfWeek: 1 },
    );
    buIdsArr = [];
    buIdsWithWeek = [];
    buIdss.forEach((item) => {
      buIdsArr.push(item._id);
      buIdsWithWeek.push({ buId: item._id, week: item.noOfWeek });
    });
    redisData.readModifyAshish();
    redisData.timesheetData();
    redisData.history();
    // redisData.readNewNext();
    //redisData.readAssignShiftNext()
    // if (new Date().getMinutes() % 10 == 0) {
    //     redisData.readNewPrev();
    //     redisData.readAssignShiftPrev();
    // }
  },
  start: true,
  runOnInit: false,
});
// }, 3000)
new CronJob({
  cronTime: '4 * * * *',
  onTick: async function () {
    console.log('shift redis cron');
    const buIdss = await SubSection.find(
      { 'scheme.0': { $exists: true } },
      { _id: 1, noOfWeek: 1 },
    );
    buIdsArr = [];
    buIdsWithWeek = [];
    buIdss.forEach((item) => {
      buIdsArr.push(item._id);
      buIdsWithWeek.push({ buId: item._id, week: item.noOfWeek });
    });
    //redisData.readModifyAshish();
    // redisData.timesheetData();
    //redisData.history();
    redisData.readNewNext();
    redisData.viewBookingsNext();
    redisData.readAssignShiftNext();
    if (new Date().getMinutes() % 10 == 0) {
      redisData.readNewPrev();
      redisData.viewBookingsPrev();
      redisData.readAssignShiftPrev();
    }
  },
  start: true,
  runOnInit: false,
});
setTimeout(() => {
  new CronJob({
    cronTime: '2 * * * *',
    onTick: async function () {
      console.log('Worksssss');
      const buIdss = await SubSection.find(
        { 'scheme.0': { $exists: true } },
        { _id: 1, noOfWeek: 1 },
      );
      buIdsArr = [];
      buIdsWithWeek = [];
      buIdss.forEach((item) => {
        buIdsArr.push(item._id);
        buIdsWithWeek.push({ buId: item._id, week: item.noOfWeek });
      });
      redisData.readModifyAshish();
      redisData.timesheetData();
      redisData.history();
      redisData.readNewNext();
      redisData.viewBookingsNext();
      redisData.readAssignShiftNext();
      redisData.readNewPrev();
      redisData.viewBookingsPrev();
      redisData.readAssignShiftPrev();
    },
    start: false,
    runOnInit: true,
  });
}, 2500);

function getMonday(d) {
  d = new Date(d);
  var day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}
*/
