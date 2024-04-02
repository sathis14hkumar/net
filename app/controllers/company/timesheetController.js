const json2csv = require('json2csv').parse;
const mongoose = require('mongoose');
const moment = require('moment');
const async = require('async');
const { validationResult } = require('express-validator');
const Shift = require('../../models/shift');
const ShiftDetails = require('../../models/shiftDetails');
const User = require('../../models/user');
const StaffLimit = require('../../models/staffLimit');
const QrCode = require('../../models/qrCode');
const FacialData = require('../../models/facialData');
const Attendance = require('../../models/attendance');
const Company = require('../../models/company');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

function getDataAsPerUser(req, res, useThis, startDateTime, endDateTime) {
  Shift.aggregate([
    {
      $match: {
        businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
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
      $match: {
        'shiftDetails.confirmedStaffs': mongoose.Types.ObjectId(
          req.body.userId,
        ),
      },
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
        'shiftDetails.confirmedStaffs': 1,
        'shiftDetails.isExtendedShift': 1,
        'shiftDetails.extendedStaff': 1,
        'shiftDetails.isAssignShift': 1,
        'schemeInfo.shiftSetup': 1,
      },
    },
  ])
    .then((results) => {
      if (results.length > 0) {
        async.eachSeries(results, (item, next) => {
          const index = results.indexOf(item);

          if (item.userInfo) {
            Attendance.findOne({
              userId: item.userInfo._id,
              shiftDetailId: item.shiftDetails._id,
            })
              .then((attendance) => {
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

                if (index === results.length - 1) {
                  return useThis.sendTimesheetData(results, res);
                }

                return next();
              })
              .catch(() => {
                if (index === results.length - 1) {
                  return useThis.sendTimesheetData(results, res);
                }

                return next();
              });
          } else {
            if (index === results.length - 1) {
              return useThis.sendTimesheetData(results, res);
            }

            next();
          }

          return res.json({
            status: 2,
            message: 'No Data Found',
            data: null,
          });
        });
      } else {
        logInfo(
          `timesheet/history/5bd723a8c1e35a7a250d562a API 'No Data Found' ends here!`,
          { name: req.user.name, staffId: req.user.staffId },
        );
        return res.json({
          status: 2,
          message: 'No Data Found',
          data: null,
        });
      }

      return res.json({
        status: 2,
        message: 'No Data Found',
        data: null,
      });
    })
    .catch((err) => {
      logError(
        `timesheet/history/5bd723a8c1e35a7a250d562a  API, there is an error`,
        err.toString(),
      );
      return res.json({
        status: 3,
        message: 'Something Went Wrong',
        data: null,
      });
    });
}

class TimeSheetController {
  async read(req, res) {
    try {
      logInfo(`attendance/breakTime API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });

      if (!__.checkHtmlContent(req.params)) {
        logError(
          `attendance/breakTime API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      let date = new Date(moment.utc().format());
      let currentDateTime = new Date(moment.utc().format());
      let { timeZone } = req.body;

      if (!timeZone) {
        timeZone = '+0800';
      }

      date = new Date(
        moment(date).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
      );
      currentDateTime = new Date(
        moment(currentDateTime).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
      );
      date = new Date(date.setHours(0, 0, 0, 0));
      let startDateTime = new Date(
        new Date(date).getTime() - 7 * 24 * 60 * 60 * 1000,
      );

      startDateTime = new Date(startDateTime).toUTCString();
      date = new Date(moment.utc().format());
      date = new Date(date.setHours(0, 0, 0, 0));
      let endDateTime = currentDateTime.setHours(
        currentDateTime.getHours() + 12,
      );

      endDateTime = new Date(endDateTime).toUTCString();

      const results = await Shift.aggregate([
        {
          $match: {
            businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
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
            'userInfo._id': 1,
            'userInfo.facialId': 1,
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
      ]);

      if (results.length > 0) {
        const promiseData = [];
        const userInfoListCall = async (item) => {
          if (item.userInfo) {
            item.isFacial = false;
            if (item.userInfo.facialId) {
              item.isFacial = true;
            }

            const attendance = await Attendance.findOne({
              userId: item.userInfo._id,
              shiftDetailId: item.shiftDetails._id,
            });

            item.attendance = attendance || null;
          }
        };

        for (const item of results) {
          promiseData.push(userInfoListCall(item));
        }

        await Promise.all(promiseData);

        return res.json({
          status: 1,
          message: 'Success',
          data: results,
        });
      }

      logInfo(`attendance/breakTime API 'No Data Found 1' ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return res.json({
        status: 2,
        message: 'No Data Found 1',
        data: null,
      });
    } catch (error) {
      logError(`attendance/breakTime API, there is an error`, error.toString());
      return res.json({
        status: 3,
        message: 'Something Went wrong',
        data: null,
      });
    }
  }

  async readModifyAshish(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // redis key businessUnitId+timeDashbaord
      // const redisData = await redisClient.get(
      //   `${req.params.businessUnitId}timeDashboard`,
      // );
      // if (redisData) {
      //   return res.json({
      //     status: 1,
      //     message: 'Data Found',
      //     data: JSON.parse(redisData),
      //   });
      // }
      let date = new Date(moment.utc().format());
      let { timeZone } = req.body;

      if (!timeZone) {
        timeZone = '+0800';
      }

      const currentDateTime = new Date(
        moment(new Date()).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
      );
      const currentDateTimeStart = new Date(
        moment(new Date()).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
      );

      date = new Date(
        moment(date).utcOffset(timeZone).format('MM/DD/YYYY HH:mm'),
      );
      date = new Date(date.setHours(0, 0, 0, 0));
      const daysBefore = 3;
      let startDateTime = new Date(
        new Date(date).getTime() - daysBefore * 24 * 60 * 60 * 1000,
      );

      startDateTime = new Date(startDateTime).toUTCString();
      date = new Date(moment.utc().format());
      date = new Date(date.setHours(0, 0, 0, 0));
      const endDateTime = new Date(
        currentDateTime.setHours(currentDateTime.getHours() + 18),
      );
      const newStartTime = new Date(
        currentDateTimeStart.setHours(currentDateTimeStart.getHours() - 18),
      );

      return Shift.aggregate([
        {
          $match: {
            businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
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
        {
          $lookup: {
            from: 'reportinglocations',
            localField: 'shiftDetails.reportLocationId',
            foreignField: '_id',
            as: 'reportingLocation',
          },
        },
        {
          $unwind: {
            path: '$reportingLocation',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'georeportinglocations',
            localField: 'shiftDetails.geoReportingLocation',
            foreignField: '_id',
            as: 'georeportinglocations',
          },
        },
        {
          $unwind: {
            path: '$georeportinglocations',
            preserveNullAndEmptyArrays: true,
          },
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
            'shiftDetails.startTime': 1,
            'shiftDetails.reportLocationId': 1,
            'shiftDetails.geoReportingLocation': 1,
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
            'reportingLocation.name': 1,
            'georeportinglocations.name': 1,
          },
        },
      ])
        .then(async (results) => {
          const hours6mili = 60000 * 540;

          if (results.length > 0) {
            const finalResult = [];

            results.forEach((item) => {
              let startMili = 0;

              if (item.shiftDetails.startTime) {
                startMili = new Date(item.shiftDetails.startTime).getTime();
              }

              let endMili = 0;

              if (item.shiftDetails.endTime) {
                endMili = new Date(item.shiftDetails.endTime).getTime();
              }

              if (
                startMili - new Date().getTime() <= hours6mili &&
                new Date().getTime() - endMili <= hours6mili
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
            this.filterDataForDashbaord(results, res);
            return undefined;
          }

          // this.setRedisData(`${req.params.businessUnitId}timeDashboard`, []);
          return res.json({
            status: 2,
            message: 'No Data Found 1',
            data: null,
          });
        })
        .catch(() =>
          res.json({
            status: 3,
            message: 'Something Went wrong',
            data: null,
          }),
        );
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  // setRedisData(key, data) {
  //   redisClient.set(key, JSON.stringify(data), 'EX', 10 * 60, (err) => {});
  // }
  async getAttendanceDataForReadModifyAshish(item) {
    return new Promise((resolve) => {
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
          .catch(() => {
            resolve(null);
          });
      } else {
        resolve(null);
      }
    });
  }

  async filterDataForDashbaord(results, res) {
    const newResult = [];
    const resultData = [];

    results.forEach((item) => {
      if (item) {
        const timeZoneP = item.shiftDetails.timeZone
          ? item.shiftDetails.timeZone
          : '+0800';

        const dayPN = moment(new Date(item.shiftDetails.date))
          .utcOffset(timeZoneP)
          .format('DD-MM-YYYY');

        item.shiftDetails.day = dayPN;
        if (
          !item.attendance ||
          (item.attendance && item.attendance.status !== 2)
        ) {
          resultData.push(item);
        }
      }
    });
    resultData.forEach((item, index) => {
      if (item) {
        if (item.shiftDetails.isExtendedShift) {
          const userId = item.userInfo._id;
          const extendData = item.shiftDetails.extendedStaff.find(
            (extendDatas) =>
              extendDatas.userId.toString() === userId.toString() &&
              extendDatas.confirmStatus === 2,
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

        if (!newResult.includes(item)) {
          if (item.shiftDetails.isSplitShift) {
            let isFound = false;

            resultData.some((splitItem, splitIndex) => {
              if (
                index !== splitIndex &&
                splitItem.shiftDetails.isSplitShift &&
                item.shiftDetails.shiftId.toString() ===
                  splitItem.shiftDetails.shiftId.toString() &&
                new Date(item.shiftDetails.date).getTime() ===
                  new Date(splitItem.shiftDetails.date).getTime() &&
                item.shiftDetails.confirmedStaffs.toString() ===
                  splitItem.shiftDetails.confirmedStaffs.toString()
              ) {
                isFound = true;
                if (
                  item.shiftDetails.startTime < splitItem.shiftDetails.startTime
                ) {
                  if (splitItem.attendance) {
                    item.splitAttendance = splitItem.attendance;
                  }

                  item.position = 1;
                  splitItem.position = 2;
                  newResult.push(item);
                  newResult.push(splitItem);
                } else {
                  if (item.attendance) {
                    splitItem.splitAttendance = item.attendance;
                  }

                  item.position = 2;
                  splitItem.position = 1;
                  newResult.push(splitItem);
                  newResult.push(item);
                }

                return true;
              }

              return false;
            });
            if (!isFound) {
              newResult.push(item);
            }
          } else {
            newResult.push(item);
          }
        }
      }
    });
    newResult.sort((a, b) =>
      a.shiftDetails.startTime && b.shiftDetails.startTime
        ? a.shiftDetails.startTime.getTime() -
          b.shiftDetails.startTime.getTime()
        : null,
    );
    // this.setRedisData(`${req.params.businessUnitId}timeDashboard`, newResult);
    return res.json({ status: 1, message: 'Data Found', data: newResult });
    // } else {
    //   // this.setRedisData(`${req.params.businessUnitId}timeDashboard`, []);
    //   return res.json({ status: 2, message: 'No Data Found 11', data: null });
    // }
  }

  async readUserForDashboard(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    return FacialData.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(req.params.userID),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
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
      {
        $project: {
          _id: 1,
          facialInfo: 1,
          userId: 1,
          'userInfo.name': 1,
          'userInfo.staffId': 1,
          'userInfo._id': 1,
          'userInfo.contactNumber': 1,
          'appointmentInfo.name': 1,
          'userInfo.appointmentId': 1,
        },
      },
    ])
      .then((results) => {
        let endDate = new Date();
        let startDate = new Date();
        let date = new Date(moment.utc().format());

        date = new Date(date.setHours(0, 0, 0, 0));
        endDate.setHours(date.getHours() + 36);
        endDate = new Date(endDate);
        startDate.setHours(date.getHours() - 12);
        startDate = new Date(startDate);
        if (results.length > 0) {
          const data = results[0];

          data.isFacial = true;
          ShiftDetails.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(req.params.shiftDetailId),
              },
            },
            {
              $project: {
                date: 1,
                startTime: 1,
                endTime: 1,
                shiftId: 1,
                duration: 1,
                attendanceInfo: 1,
                isExtendedShift: 1,
                extendedStaff: 1,
              },
            },
          ])
            .then((shiftDetail) => {
              shiftDetail = JSON.stringify(shiftDetail);
              shiftDetail = JSON.parse(shiftDetail);
              let i = 0;

              async.eachSeries(shiftDetail, (item, next) => {
                this.getAttendance(item._id, req.params.userID).then(
                  (attendanceData) => {
                    if (attendanceData) {
                      item.attendance = attendanceData;
                    } else item.attendance = null;

                    if (shiftDetail.length - 1 === i) {
                      data.shiftDetail = shiftDetail;
                      this.sendReadUser(data, res);
                    }

                    i += 1;
                    next();
                  },
                );
              });
            })
            .catch((err) =>
              res.json({
                status: 3,
                data: null,
                msg: 'Something went wrong',
                err,
              }),
            );
        } else {
          const data = {};

          data.isFacial = false;
          User.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(req.params.userID),
              },
            },
            {
              $lookup: {
                from: 'appointments',
                localField: 'appointmentId',
                foreignField: '_id',
                as: 'appointmentInfo',
              },
            },
            {
              $unwind: '$appointmentInfo',
            },
            {
              $project: {
                _id: 1,
                name: 1,
                staffId: 1,
                contactNumber: 1,
                'appointmentInfo.name': 1,
                appointmentId: 1,
              },
            },
          ]).then((userDetails) => {
            data.appointmentInfo = {};
            data.appointmentInfo.name = userDetails[0].appointmentInfo.name;
            delete userDetails[0].appointmentInfo;
            [data.userInfo] = userDetails;
            ShiftDetails.aggregate([
              {
                $match: {
                  _id: mongoose.Types.ObjectId(req.params.shiftDetailId),
                },
              },
              {
                $project: {
                  date: 1,
                  startTime: 1,
                  endTime: 1,
                  shiftId: 1,
                  duration: 1,
                  attendanceInfo: 1,
                },
              },
            ]).then((shiftDetail) => {
              if (shiftDetail.length > 0) {
                let i = 0;

                async.eachSeries(shiftDetail, (item, next) => {
                  this.getAttendance(item._id, req.params.userID).then(
                    (attendanceData) => {
                      if (attendanceData) item.attendance = attendanceData;
                      else item.attendance = null;

                      if (shiftDetail.length - 1 === i) {
                        data.message = 'No facial Info Found';
                        data.shiftDetail = shiftDetail;
                        this.sendReadUser(data, res);
                      }

                      i += 1;
                      next();
                    },
                  );
                });
              } else {
                data.message = 'No facial Info and Shift Data Found';
                data.shiftDetail = [];
                return res.json({ status: 2, data });
              }

              return null;
            });
          });
        }
      })
      .catch((err) => res.send(err));
  }

  async readUser(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    return FacialData.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(req.params.userID),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
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
      {
        $project: {
          _id: 1,
          facialInfo: 1,
          userId: 1,
          'userInfo._id': 1,
          'userInfo.name': 1,
          'userInfo.staffId': 1,
          'userInfo.contactNumber': 1,
          'appointmentInfo.name': 1,
          'userInfo.appointmentId': 1,
        },
      },
    ])
      .then((results) => {
        let endDate = new Date();
        let startDate = new Date();
        let date = new Date(moment.utc().format());

        date = new Date(date.setHours(0, 0, 0, 0));
        endDate = endDate.setHours(date.getHours() + 36);
        endDate = new Date(endDate);
        startDate = startDate.setHours(date.getHours() - 12);
        startDate = new Date(startDate);
        if (results.length > 0) {
          const data = results[0];

          data.isFacial = true;
          ShiftDetails.aggregate([
            {
              $match: {
                confirmedStaffs: {
                  $in: [mongoose.Types.ObjectId(req.params.userID)],
                },
                date: { $lte: endDate, $gte: startDate },
              },
            },
            {
              $project: {
                date: 1,
                startTime: 1,
                endTime: 1,
                shiftId: 1,
                duration: 1,
                attendanceInfo: 1,
              },
            },
          ])
            .then((shiftDetail) => {
              shiftDetail = JSON.stringify(shiftDetail);
              shiftDetail = JSON.parse(shiftDetail);
              let i = 0;

              async.eachSeries(shiftDetail, (item, next) => {
                this.getAttendance(item._id, req.params.userID).then(
                  (attendanceData) => {
                    if (attendanceData) item.attendance = attendanceData;
                    else item.attendance = null;

                    if (shiftDetail.length - 1 === i) {
                      data.shiftDetail = shiftDetail;
                      this.sendReadUser(data, res);
                    }

                    i += 1;
                    next();
                  },
                );
              });
            })
            .catch((err) =>
              res.json({
                status: 3,
                data: null,
                msg: 'Something went wrong',
                err,
              }),
            );
        } else {
          const data = {};

          data.isFacial = false;
          User.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(req.params.userID),
              },
            },
            {
              $lookup: {
                from: 'appointments',
                localField: 'appointmentId',
                foreignField: '_id',
                as: 'appointmentInfo',
              },
            },
            {
              $unwind: '$appointmentInfo',
            },
            {
              $project: {
                _id: 1,
                name: 1,
                staffId: 1,
                contactNumber: 1,
                'appointmentInfo.name': 1,
                appointmentId: 1,
              },
            },
          ]).then((userDetails) => {
            data.appointmentInfo = {};
            data.appointmentInfo.name = userDetails[0].appointmentInfo.name;
            delete userDetails[0].appointmentInfo;
            [data.userInfo] = userDetails;
            ShiftDetails.aggregate([
              {
                $match: {
                  confirmedStaffs: {
                    $in: [mongoose.Types.ObjectId(req.params.userID)],
                  },
                  date: { $lte: endDate, $gte: startDate },
                },
              },
              {
                $project: {
                  date: 1,
                  startTime: 1,
                  endTime: 1,
                  shiftId: 1,
                  duration: 1,
                  attendanceInfo: 1,
                },
              },
            ]).then((shiftDetail) => {
              if (shiftDetail.length > 0) {
                let i = 0;

                async.eachSeries(shiftDetail, (item, next) => {
                  this.getAttendance(item._id, req.params.userID).then(
                    (attendanceData) => {
                      if (attendanceData) item.attendance = attendanceData;
                      else item.attendance = null;

                      if (shiftDetail.length - 1 === i) {
                        data.message = 'No facial Info Found';
                        data.shiftDetail = shiftDetail;
                        this.sendReadUser(data, res);
                      }

                      i += 1;
                      next();
                    },
                  );
                });
              } else {
                data.message = 'No facial Info and Shift Data Found';
                data.shiftDetail = [];
                return res.json({ status: 2, data });
              }

              return null;
            });
          });
        }
      })
      .catch((err) => res.send(err));
  }

  async readUserImage(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    const userFaceData = await FacialData.findOne({
      userId: req.params.userID,
    });

    return res.json({ userData: userFaceData });
  }

  async getAttendance(shiftId, userID) {
    return new Promise((resolve) => {
      Attendance.findOne({ shiftDetailId: shiftId, userId: userID }).then(
        (data) => {
          resolve(data);
        },
      );
    });
  }

  async matchFace(req, res) {
    res.send('hey');
  }

  async qrCode(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    try {
      const doc = await User.findOne({
        _id: mongoose.Types.ObjectId(req.params.userId),
      });

      if (doc === null) {
        __.log('Invalid staff id');
        res.json({ status: 1, message: 'Invalid staff Id', data: null });
      } else {
        let endDate = new Date();
        let startDate = new Date();

        endDate.setHours(endDate.getHours() + 12);
        endDate = new Date(endDate);
        startDate.setHours(startDate.getHours() - 12);
        startDate = new Date(startDate);
        return ShiftDetails.findOne(
          {
            _id: mongoose.Types.ObjectId(req.params.shiftDetailId),
            confirmedStaffs: {
              $in: [mongoose.Types.ObjectId(req.params.userId)],
            },
          },
          { date: 1, startTime: 1, endTime: 1, shiftId: 1, duration: 1 },
        ).then((shiftDetail) => {
          if (shiftDetail) {
            const qrCode = `${req.params.userId}_${shiftDetail._id}_${shiftDetail.shiftId}`;
            const qrCodeObj = {
              qrCode,
              userId: req.params.userId,
              shiftId: shiftDetail.shiftId,
              shiftDetailId: shiftDetail._id,
            };

            QrCode.find({
              userId: mongoose.Types.ObjectId(req.params.userId),
              shiftId: mongoose.Types.ObjectId(shiftDetail.shiftId),
              status: 1,
              shiftDetailId: mongoose.Types.ObjectId(qrCodeObj.shiftDetailId),
            }).then((userQrData) => {
              if (userQrData.length > 0) {
                return res.json({
                  data: {
                    massage: 'QR already Generated',
                  },
                  status: 2,
                });
              }

              const qr = new QrCode(qrCodeObj);

              qr.save(qrCodeObj).then(() => {});
              return res.json({ status: 1, data: { qrCode } });
            });
          } else {
            return res.json({
              status: 2,
              message: 'No Shift Data Found',
              data: null,
            });
          }

          return null;
        });
      }

      return res.json({
        status: 2,
        message: 'Something Went Wrong',
        data: null,
      });
    } catch (err) {
      __.log(err);
      return res.json({ status: 3, shiftDetail: 'Something Went wrong' });
    }
  }

  async checkQrCodeStatus(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    return QrCode.find({
      userId: mongoose.Types.ObjectId(req.params.userId),
      status: 1,
      shiftDetailId: mongoose.Types.ObjectId(req.params.shiftDetailId),
    })
      .then((result) => {
        if (result.length > 0) {
          return res.json({
            data: {
              qrCodePresent: true,
              message: 'Qr Code is persent',
            },
            status: 1,
          });
        }

        return res.json({
          data: {
            qrCodePresent: false,
            message: 'Qr code is not present',
          },
          status: 2,
        });
      })
      .catch(() =>
        res.json({
          data: {
            qrCodePresent: false,
            message: 'Something went wrong',
          },
          status: 3,
        }),
      );
  }

  async timesheetData(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    // timesheet page businessUnitId+timeTimesheet
    // const redisKey = `${req.params.businessUnitId}timeTimesheet`;
    // const redisData = await redisClient.get(`${redisKey}`);
    // if (redisData) {
    //   return res.json({
    //     status: 1,
    //     message: 'Data Found',
    //     data: JSON.parse(redisData),
    //   });
    // }
    let date = new Date(moment.utc().format());

    date = new Date(date.setHours(0, 0, 0, 0));
    let startDateTime = date.setHours(date.getHours() - 19);

    startDateTime = new Date(startDateTime).toUTCString();
    date = new Date(moment.utc().format());
    date = new Date(date.setHours(0, 0, 0, 0));
    let endDateTime = date.setHours(date.getHours() + 43);

    endDateTime = new Date(endDateTime).toUTCString();
    return Shift.aggregate([
      {
        $match: {
          businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
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
          const final = await Promise.all(
            results.map(async (result) =>
              this.getAttendanceDataForTimesheetData(result),
            ),
          );

          const allData = await Promise.all(final);

          this.sendTimesheetData(allData, res);
        } else {
          // this.setRedisData(`${req.params.businessUnitId}timeTimesheet`, []);
          return res.json({ status: 2, message: 'No Data Found', data: null });
        }

        return null;
      })
      .catch(() =>
        res.json({
          status: 3,
          message: 'Something Went Wrong',
          data: null,
        }),
      );
  }

  async getAttendanceDataForTimesheetData(item) {
    return new Promise((resolve) => {
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
          .catch(() => {
            resolve(null);
          });
      } else {
        resolve(null);
      }
    });
  }

  async sendReadUser(item, res) {
    try {
      if (item.shiftDetail.isExtendedShift) {
        const userId = item.userInfo._id;
        const extendData = item.shiftDetail.extendedStaff.find(
          (extendDatas) =>
            extendDatas.userId.toString() === userId.toString() &&
            extendDatas.confirmStatus === 2,
        );

        if (extendData) {
          item.shiftDetail.startTime = extendData.startDateTime;
          item.shiftDetail.endTime = extendData.endDateTime;
        }
      }

      return res.json({ status: 1, message: 'Data Found', data: item });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async sendTimesheetData(results, res) {
    try {
      results.sort((a, b) =>
        a &&
        a.shiftDetails &&
        a.shiftDetails.date &&
        b &&
        b.shiftDetails &&
        b.shiftDetails.date
          ? a.shiftDetails.date.getTime() - b.shiftDetails.date.getTime()
          : null,
      );
      results.sort((a, b) =>
        a &&
        a.shiftDetails &&
        a.shiftDetails.startTime &&
        b &&
        b.shiftDetails &&
        b.shiftDetails.startTime
          ? a.shiftDetails.startTime.getTime() -
            b.shiftDetails.startTime.getTime()
          : null,
      );
      const newArrayResult = [];

      results.forEach((item, index) => {
        if (item) {
          if (item.schemeInfo) {
            item.schemeInfo = item.schemeInfo.shiftSetup;
          }

          if (item.shiftDetails.isExtendedShift) {
            const userId = item.userInfo._id;
            const extendData = item.shiftDetails.extendedStaff.find(
              (extendDatas) =>
                extendDatas.userId.toString() === userId.toString() &&
                extendDatas.confirmStatus === 2,
            );

            if (extendData) {
              item.shiftDetails.extendedStaff = [];
              item.shiftDetails.extendedStaff[0] = extendData;
            } else {
              item.shiftDetails.extendedStaff = [];
            }
          }

          if (!newArrayResult.includes(item)) {
            if (item.shiftDetails.isSplitShift) {
              let isFound = false;

              results.some((splitItem, splitIndex) => {
                if (
                  index !== splitIndex &&
                  splitItem.shiftDetails.isSplitShift &&
                  item.shiftDetails.shiftId.toString() ===
                    splitItem.shiftDetails.shiftId.toString() &&
                  new Date(item.shiftDetails.date).getTime() ===
                    new Date(splitItem.shiftDetails.date).getTime() &&
                  item.shiftDetails.confirmedStaffs.toString() ===
                    splitItem.shiftDetails.confirmedStaffs.toString()
                ) {
                  isFound = true;
                  if (
                    item.shiftDetails.startTime <
                    splitItem.shiftDetails.startTime
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

                return false;
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
      // this.setRedisData(`${redisKey}`, newArrayResult);
      return res.json({
        status: 1,
        message: 'Data Found',
        data: newArrayResult,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getHourType(schemeDetails, shiftDetails, isShiftExtented) {
    if (shiftDetails.isAssignShift) {
      return { valid: false };
    }

    if (
      schemeDetails.shiftSchemeType === 1 ||
      schemeDetails.shiftSchemeType === 3
    ) {
      if (isShiftExtented) {
        if (
          schemeDetails.shiftSetup.openShift &&
          schemeDetails.shiftSetup.openShift.allowShiftExtension.normal
        ) {
          return { valid: true, isOtHour: false };
        }

        return { valid: true, isOtHour: true };
      }

      if (
        schemeDetails.shiftSetup.openShift &&
        schemeDetails.shiftSetup.openShift.normal
      ) {
        return { valid: true, isOtHour: false };
      }

      return { valid: true, isOtHour: true };
    }

    return { valid: false };
  }

  async checkBTLap(btStartTime, shiftObj) {
    if (
      new Date(btStartTime).getTime() > new Date(shiftObj.normalStartTime) &&
      new Date(btStartTime).getTime() < new Date(shiftObj.normalEndTime)
    ) {
      return 'no';
    }

    if (
      new Date(btStartTime).getTime() > new Date(shiftObj.extendedStartTime) &&
      new Date(btStartTime).getTime() < new Date(shiftObj.extendedEndTime)
    ) {
      return 'yes';
    }

    return -1;
  }

  async checkLimit(userId, shiftDetails, attendanceObj, isShiftExtentend) {
    if (attendanceObj.breakTime.length > 0) {
      let schemeDetails = await User.findById(userId, {
        schemeId: 1,
        _id: 0,
      }).populate([
        {
          path: 'schemeId',
        },
      ]);

      schemeDetails = schemeDetails.schemeId;
      const hourTypeData = this.getHourType(
        schemeDetails,
        shiftDetails,
        isShiftExtentend,
      );
      let otDuration = 0;
      let normalDuration = 0;

      if (isShiftExtentend) {
        const normalStartTime = shiftDetails.startTime;
        const normalEndTime = shiftDetails.endTime;
        let extendedStartTime = null;
        let extendedEndTime = null;
        let extendedStaff = shiftDetails.extendedStaff.filter(
          (item) => item.userId.toString() === userId.toString(),
        );

        if (extendedStaff.length > 0) {
          [extendedStaff] = extendedStaff;
          extendedStartTime = extendedStaff.startDateTime;
          extendedEndTime = extendedStaff.endDateTime;
        }

        const shiftObj = {
          normalStartTime,
          normalEndTime,
          extendedStartTime,
          extendedEndTime,
        };

        const promiseData = [];
        const breakTimeListCall = async (btObj) => {
          const isExtendted = await this.checkBTLap(btObj.startTime, shiftObj);

          if (isExtendted === 'yes') {
            if (
              schemeDetails.shiftSetup.openShift &&
              schemeDetails.shiftSetup.openShift.allowShiftExtension.normal
            ) {
              normalDuration += btObj.duration; // normal
            } else {
              otDuration += btObj.duration; // ot
            }
          } else if (isExtendted === 'no') {
            if (
              schemeDetails.shiftSetup.openShift &&
              schemeDetails.shiftSetup.openShift.normal
            ) {
              normalDuration += btObj.duration; // normal normalDuration
            } else {
              otDuration += btObj.duration; // ot
            }
          }
        };

        for (let i = 0; attendanceObj.breakTime.length; i += 1) {
          promiseData.push(breakTimeListCall(attendanceObj.breakTime[i]));
        }

        await Promise.all(promiseData);
      } else {
        if (!hourTypeData.isOtHour) {
          normalDuration = attendanceObj.totalBreakDuration / 60; // in hours;
        }

        otDuration = attendanceObj.totalBreakDuration / 60;

        // direct reduce  BT duration from hourtype
      }

      // reduce
      normalDuration *= -1;
      otDuration *= -1;
      await StaffLimit.update(
        { userId, shiftDetailId: shiftDetails._id },
        { $inc: { normalDuration, otDuration } },
      );

      return { limit: false, status: 1, message: '' };
    }

    return { limit: false, status: 1, message: '' };
  }

  async approval(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (req.body.neither && !req.body.neitherMessage) {
        return __.out(res, 300, `Enter valid neitherMessage`);
      }

      logInfo(`timesheet/approval API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `timesheet/approval API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      let isAbsent = false;

      if (req.body.isAbsent) {
        isAbsent = req.body.isAbsent;
      }

      let otHr = 0;
      let breakTimeForLimit = [];

      if (req.body.userInfo) {
        const { body } = req;

        if (body.shift) {
          const normalHr =
            (new Date(body.userInfo.shiftDetails.endTime) -
              new Date(body.userInfo.shiftDetails.startTime)) /
            (1000 * 60 * 60);
          const normalHrOT =
            (new Date(body.userInfo.shiftDetails.extendedStaff[0].endDateTime) -
              new Date(
                body.userInfo.shiftDetails.extendedStaff[0].startDateTime,
              )) /
            (1000 * 60 * 60);

          otHr = normalHrOT - normalHr;
        }

        if (body.clocked) {
          const normalHr =
            (new Date(body.userInfo.shiftDetails.endTime) -
              new Date(body.userInfo.shiftDetails.startTime)) /
            (1000 * 60 * 60);
          const normalHrOT =
            (new Date(body.approveClockOutTime) -
              new Date(body.approveClockInTime)) /
            (1000 * 60 * 60);

          otHr = normalHrOT - normalHr;
          if (otHr < 0) {
            otHr = 0;
          }
        }

        // later check absent flag
        if (!body.isAbsent) {
          const normalHr =
            (new Date(body.userInfo.shiftDetails.endTime) -
              new Date(body.userInfo.shiftDetails.startTime)) /
            (1000 * 60 * 60);
          const normalHrOT =
            (new Date(body.approveClockOutTime) -
              new Date(body.approveClockInTime)) /
            (1000 * 60 * 60);

          otHr = normalHrOT - normalHr;
          if (otHr < 0) {
            otHr = 0;
          }
        }
      }

      let status = 2;
      let totalBreakDuration = 0;
      let duration = 0;

      if (req.body.shift || req.body.clocked || req.body.neither) {
        status = 3;
        if (!isAbsent) {
          duration =
            (new Date(req.body.approveClockOutTime) -
              new Date(req.body.approveClockInTime)) /
            (1000 * 60 * 60);
          if (
            req.body.breakTime &&
            req.body.breakTime.length > 0 &&
            req.body.breakTime[0] !== 0
          ) {
            req.body.breakTime.forEach((item) => {
              item.duration =
                (new Date(item.endTime) - new Date(item.startTime)) /
                (60 * 60 * 1000);
              totalBreakDuration += item.duration;
            });
            breakTimeForLimit = req.body.breakTime;
          } else {
            req.body.breakTime = [];
            breakTimeForLimit = [];
          }
        }
      } else {
        req.body.neitherMessage = '';
        req.body.breakTime = [];
        req.body.approveClockInTime = '';
        req.body.approveClockOutTime = '';
      }

      if (req.body._id) {
        const btObj = [];
        let totalBT = 0;

        if (req.body.breakTime && req.body.breakTime.length > 0) {
          const btObjTemp = JSON.parse(JSON.stringify(req.body.breakTime));

          breakTimeForLimit = [];
          btObjTemp.forEach((btItem) => {
            const startTimeDate = btItem.startTime;
            const endTimeDate = btItem.endTime;
            const diff = Math.abs(
              new Date(startTimeDate) - new Date(endTimeDate),
            );
            const min = Math.floor(diff / 1000 / 60); // diffrenece in min
            const duration1 =
              (new Date(btItem.endTime) - new Date(btItem.startTime)) /
              (60 * 60 * 1000);

            totalBT += min;
            const obj = {
              startTime: new Date(startTimeDate),
              endTime: endTimeDate,
              duration: min,
            };

            btItem.duration = duration1;
            breakTimeForLimit.push({ btItem });
            btObj.push(obj);
          });
        }

        Attendance.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(req.body._id) },
          {
            $set: {
              'approval.shift': req.body.shift,
              'approval.clocked': req.body.clocked,
              'approval.neither': req.body.neither,
              'approval.neitherMessage': req.body.neitherMessage,
              'approval.duration': duration,
              'approval.breakTime': req.body.breakTime,
              'approval.totalBreakDuration': totalBreakDuration,
              'approval.approveClockInTime': req.body.approveClockInTime,
              'approval.approveClockOutTime': req.body.approveClockOutTime,
              status,
              otDuration: otHr,
              isAbsent,
              breakTime: btObj,
              totalBreakDuration: totalBT,
            },
          },
          { new: true },
        )
          .then(async (result) => {
            if (result) {
              logInfo(
                `timesheet/approval API ends here! 'Successfully Updated'`,
                { name: req.user.name, staffId: req.user.staffId },
              );
              return res.json({
                status: 1,
                message: 'Successfully Updated',
                data: result,
              });
            }

            logInfo(`timesheet/approval API ends here! 'No attendance Found'`, {
              name: req.user.name,
              staffId: req.user.staffId,
            });
            return res.json({
              status: 2,
              message: 'No attendance Found',
              data: null,
            });
          })
          .catch((err) => {
            logError(
              `timesheet/approval API, there is an error`,
              err.toString(),
            );
            return res.json({
              status: 3,
              message: 'Something went wrong',
              data: null,
              err,
            });
          });
      } else {
        if (!isAbsent) {
          duration =
            (new Date(req.body.approveClockOutTime) -
              new Date(req.body.approveClockInTime)) /
            (1000 * 60 * 60);
        }

        req.body.approval = {
          shift: req.body.shift,
          clocked: req.body.clocked,
          neither: req.body.neither,
          duration,
          neitherMessage: req.body.neitherMessage,
          approveClockInTime: req.body.approveClockInTime,
          approveClockOutTime: req.body.approveClockOutTime,
        };
        req.body.status = status;
        req.body.otDuration = otHr;
        req.body.isAbsent = isAbsent;

        new Attendance(req.body)
          .save()
          .then(async (re) => {
            logInfo(`timesheet/approval API ends here, 'Successfully Added'`, {
              name: req.user.name,
              staffId: req.user.staffId,
            });
            return res.json({
              status: 1,
              message: 'Successfully Added',
              data: re,
            });
          })
          .catch((e) => {
            logError(`timesheet/approval API, there is an error`, e.toString());
            return res.json({
              status: 3,
              message: 'Something went wrong',
              data: null,
              e,
            });
          });
      }

      return null;
    } catch (err) {
      logError(`timesheet/approval API, there is an error`, err.toString());
      return __.out(res, 500, err);
    }
  }

  async lock(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const result = await Attendance.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.body._id) },
        {
          $set: {
            IsLock: true,
          },
        },
        { new: true },
      );

      if (result) {
        // const rR = await this.updateRedisSingle(
        //   result.businessUnitId,
        //   result.shiftDetailId,
        // );
        // this.updateRedis(result.businessUnitId, 'add');
        return res.json({
          status: 1,
          message: 'Successfully Updated',
          data: result,
        });
      }

      return res.json({
        status: 2,
        message: 'No attendance Found',
        data: null,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async timeSheetLock(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const searchQuery = {
        _id: mongoose.Types.ObjectId(req.body.staffId), // Default SATS as Company
        status: {
          $ne: 3,
        },
      };

      if (req.body.companyName) {
        const selectedCompany = await Company.findOne({
          name: {
            $regex: `^${req.body.companyName}$`,
            $options: 'i',
          },
          status: 1,
        }).lean();

        __.log(selectedCompany, 'selectedCompany');
        if (selectedCompany) {
          searchQuery.companyId = selectedCompany._id;
        } else {
          return __.out(res, 300, 'Company Not Found');
        }
      }

      return User.findOne(searchQuery, { password: 1 }).then((userData) => {
        if (userData) {
          const validPassword = userData.validPassword(req.body.password);

          if (validPassword) {
            if (req.params.isLock === '1')
              return res.json({
                status: 1,
                message: 'Timesheet Is in Staff View',
              });

            return res.json({
              status: 2,
              message: 'Timesheet Is in Normal View',
            });
          }

          return res.json({ status: 0, message: 'Incorrect Password' });
        }

        return res.json({ status: 0, message: 'User Not Found' });
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async history(req, res) {
    try {
      logInfo(`timesheet/history/5bd723a8c1e35a7a250d562a  API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `timesheet/history/5bd723a8c1e35a7a250d562a  API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      // const redisKey = `${
      //   req.params.businessUnitId
      // }his${req.body.startDate.replace(/-/g, '_')}${req.body.endDate.replace(
      //   /-/g,
      //   '_',
      // )}`;

      let startDateTime = new Date(req.body.startDate);

      startDateTime = startDateTime.setDate(startDateTime.getDate() - 1);
      startDateTime = new Date(startDateTime);
      let endDateTime = new Date(req.body.endDate);

      endDateTime = endDateTime.setDate(endDateTime.getDate());
      endDateTime = new Date(endDateTime);

      if (req.body.userId) {
        getDataAsPerUser(req, res, this, startDateTime, endDateTime);
      } else {
        const results = await Shift.aggregate([
          {
            $match: {
              businessUnitId: mongoose.Types.ObjectId(
                req.params.businessUnitId,
              ),
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
        ]);
        const len = results.length;
        const getAllData = [];

        if (len > 0) {
          for (let i = 0; i < len; i += 1) {
            getAllData.push(this.getAttendanceDataTimeSheet(results[i]));
          }
          const resultAll = await Promise.all(getAllData);

          this.sendTimesheetData(resultAll, res);
        }
      }

      return null;
    } catch (err) {
      logError(
        `timesheet/history/5bd723a8c1e35a7a250d562a  API, there is an error`,
        err.toString(),
      );
      return __.out(res, 500, err);
    }
  }

  async getAttendanceDataTimeSheet(item) {
    return new Promise((resolve) => {
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
          .catch(() => {
            resolve(item);
          });
      } else {
        resolve(item);
      }
    });
  }

  async play(req, res) {
    const ddd = moment('2019-05-30T04:00:00.000Z').format('MM/DD/YYYY HH:MM');

    res.send(ddd);
  }

  async timesheetDataExport(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let date = new Date(moment.utc().format());

      date = new Date(date.setHours(0, 0, 0, 0));
      let startDateTime = date.setHours(date.getHours() - 19);

      startDateTime = new Date(startDateTime).toUTCString();
      date = new Date(moment.utc().format());
      date = new Date(date.setHours(0, 0, 0, 0));
      let endDateTime = date.setHours(date.getHours() + 43);

      endDateTime = new Date(endDateTime).toUTCString();
      return Shift.aggregate([
        {
          $match: {
            businessUnitId: mongoose.Types.ObjectId(req.params.businessUnitId),
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
            'shiftDetails.timeZone': 1,
            'shiftDetails.duration': 1,
            'shiftDetails.confirmedStaffs': 1,
            'shiftDetails.isExtendedShift': 1,
            'shiftDetails.extendedStaff': 1,
            'schemeInfo.shiftSetup': 1,
          },
        },
      ])
        .then((results) => {
          if (results.length > 0) {
            async.eachSeries(results, (item, next) => {
              const index = results.indexOf(item);

              if (item.userInfo) {
                Attendance.findOne({
                  userId: item.userInfo._id,
                  shiftDetailId: item.shiftDetails._id,
                })
                  .then((attendance) => {
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

                    if (index === results.length - 1) {
                      return this.sendTimesheetDataExport(results, res);
                    }

                    return next();
                  })
                  .catch(() => {
                    if (index === results.length - 1) {
                      return this.sendTimesheetDataExport(results, res);
                    }

                    return next();
                  });
              } else {
                if (index === results.length - 1) {
                  return this.sendTimesheetDataExport(results, res);
                }

                return next();
              }

              return null;
            });
          } else {
            return res.json({
              status: 2,
              message: 'No Data Found',
              data: null,
            });
          }

          return null;
        })
        .catch(() =>
          res.json({
            status: 3,
            message: 'Something Went Wrong',
            data: null,
          }),
        );
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  getDuration(time) {
    if (time) {
      time = parseFloat(time);
      time = time * 1000 * 3600;
      const date = new Date(time);

      return `${date.getUTCHours()}:${date.getUTCMinutes()}`;
    }

    return '0';
  }

  hourMin(date) {
    if (date) {
      const d = new Date(date);

      return `${d.getHours()}:${d.getMinutes()}`;
    }

    return '';
  }

  hourMinNew(date, timeZone = '+0800') {
    if (date) {
      return moment(date).utcOffset(timeZone).format('HH:mm');
    }

    return '';
  }

  getDateFormat(date, timeZone) {
    if (date) {
      if (!timeZone) {
        timeZone = '+0800';
      }

      return moment(date).utcOffset(timeZone).format('DD/MM/YYYY HH:mm');
    }

    return '';
  }

  async sendTimesheetDataExport(results, res) {
    try {
      results.forEach((item) => {
        if (item.schemeInfo) {
          item.schemeInfo = item.schemeInfo.shiftSetup;
        }

        if (item.shiftDetails.isExtendedShift) {
          const userId = item.userInfo._id;
          const extendData = item.shiftDetails.extendedStaff.find(
            (extendDatas) =>
              extendDatas.userId.toString() === userId.toString() &&
              extendDatas.confirmStatus === 2,
          );

          if (extendData) {
            item.shiftDetails.extendedStaff = [];
            item.shiftDetails.extendedStaff[0] = extendData;
          } else {
            item.shiftDetails.extendedStaff = [];
          }
        }
      });
      const csvData = [];
      const keys = [
        'Date',
        'StaffId',
        'Staff Name',
        'Shift Start Time',
        'Shift End Time',
        'Extended Start Time',
        'Extended End Time',
        'ClockIn',
        'ClockOut',
        'Break 1 start',
        'Break 1 end',
        'Break 2 start',
        'Break 2 end',
        'Break 3 start',
        'Break 3 end',
        'Total Break Duration',
        'Approve Type',
        'Approve ClockIn',
        'Approve ClockOut',
        'Normal Hours',
        'Ot Hours',
        'Total Hours',
        'Approve Remark',
        'Absent',
      ];

      results.forEach((item) => {
        let { timeZone } = item.shiftDetails;

        if (!timeZone) {
          timeZone = '+0800';
        }

        const obj = {};
        const date = moment(item.shiftDetails.date)
          .utcOffset(timeZone)
          .format('D-MMM');

        obj.Date = date;
        obj.StaffId = item.userInfo.staffId;
        obj['Staff Name'] = item.userInfo.name;
        obj['Shift Start Time'] = this.getDateFormat(
          item.shiftDetails.startTime,
          timeZone,
        );
        obj['Shift End Time'] = this.getDateFormat(
          item.shiftDetails.endTime,
          timeZone,
        );
        if (item.shiftDetails.extendedStaff.length > 0) {
          obj['Extended Start Time'] = this.getDateFormat(
            item.shiftDetails.extendedStaff[0].startDateTime,
            timeZone,
          );
          obj['Extended End Time'] = this.getDateFormat(
            item.shiftDetails.extendedStaff[0].endDateTime,
            timeZone,
          );
        } else {
          obj['Extended Start Time'] = '';
          obj['Extended End Time'] = '';
        }

        if (item.attendance && !item.attendance.isAbsent) {
          obj.ClockIn = this.getDateFormat(
            item.attendance.clockInDateTime,
            timeZone,
          );
          obj.ClockOut = this.getDateFormat(
            item.attendance.clockOutDateTime,
            timeZone,
          );
          if (item.attendance.breakTime.length > 0) {
            if (item.attendance.breakTime[0]) {
              obj['Break 1 start'] = this.hourMinNew(
                item.attendance.breakTime[0].startTime,
                timeZone,
              );
              obj['Break 1 end'] = this.hourMinNew(
                item.attendance.breakTime[0].endTime,
                timeZone,
              );
            } else {
              obj['Break 1 start'] = '';
              obj['Break 1 end'] = '';
            }

            if (item.attendance.breakTime[1]) {
              obj['Break 2 start'] = this.hourMinNew(
                item.attendance.breakTime[1].startTime,
                timeZone,
              );
              obj['Break 2 end'] = this.hourMinNew(
                item.attendance.breakTime[1].endTime,
                timeZone,
              );
            } else {
              obj['Break 2 start'] = '';
              obj['Break 2 end'] = '';
            }

            if (item.attendance.breakTime[2]) {
              obj['Break 3 start'] = this.hourMinNew(
                item.attendance.breakTime[2].startTime,
                timeZone,
              );
              obj['Break 3 end'] = this.hourMinNew(
                item.attendance.breakTime[2].endTime,
                timeZone,
              );
            } else {
              obj['Break 3 start'] = '';
              obj['Break 3 end'] = '';
            }

            obj['Total Break Duration'] = item.attendance.totalBreakDuration;
          } else {
            obj['Break 1 start'] = '';
            obj['Break 1 end'] = '';
            obj['Break 2 start'] = '';
            obj['Break 2 end'] = '';
            obj['Break 3 start'] = '';
            obj['Break 3 end'] = '';
            obj['Total Break Duration'] = 0;
          }

          if (
            item.attendance.approval &&
            (item.attendance.approval.neither ||
              item.attendance.approval.clocked ||
              item.attendance.approval.shift)
          ) {
            if (item.attendance.approval.neither) {
              obj['Approve Type'] = 'Neither';
            } else if (item.attendance.approval.clocked) {
              obj['Approve Type'] = 'Clocked';
            } else {
              obj['Approve Type'] = 'Shift';
            }

            obj['Approve ClockIn'] = this.getDateFormat(
              item.attendance.approval.approveClockInTime,
              timeZone,
            );
            obj['Approve ClockOut'] = this.getDateFormat(
              item.attendance.approval.approveClockOutTime,
              timeZone,
            );
            if (
              item.schemeInfo &&
              item.schemeInfo.openShift.allowShiftExtension.ot
            ) {
              obj['Normal Hours'] = this.getDuration(
                item.attendance.approval.duration - item.attendance.otDuration,
              );
              obj['Ot Hours'] = this.getDuration(item.attendance.otDuration);
            } else {
              obj['Normal Hours'] = this.getDuration(
                item.attendance.approval.duration,
              );
              obj['Ot Hours'] = 0;
            }

            obj['Total Hours'] = this.getDuration(
              item.attendance.approval.duration,
            );
            obj['Approve Remark'] = item.attendance.approval.neitherMessage;
          } else {
            obj['Approve Type'] = '';
            obj['Approve ClockIn'] = '';
            obj['Approve ClockOut'] = '';
            obj['Normal Hours'] = '';
            obj['Ot Hours'] = '';
            obj['Total Hours'] = '';
            obj['Approve Remark'] = '';
          }

          if (item.attendance && item.attendance.isAbsent) {
            obj.Absent = 'Yes';
          } else {
            obj.Absent = 'No';
          }
        } else {
          obj.ClockIn = '';
          obj.ClockOut = '';
          obj['Break 1 start'] = '';
          obj['Break 1 end'] = '';
          obj['Break 2 start'] = '';
          obj['Break 2 end'] = '';
          obj['Break 3 start'] = '';
          obj['Break 3 end'] = '';
          obj['Total Break Duration'] = 0;
          obj['Approve Type'] = '';
          obj['Approve ClockIn'] = '';
          obj['Approve ClockOut'] = '';
          obj['Normal Hours'] = '';
          obj['Ot Hours'] = '';
          obj['Total Hours'] = '';
          obj['Approve Remark'] = '';
          if (item.attendance && item.attendance.isAbsent) {
            obj.Absent = 'Yes';
          } else {
            obj.Absent = 'No';
          }
        }

        csvData.push(obj);
      });
      csvData.sort(
        (a, b) =>
          moment(a['Shift Start Time'], 'DD/MM/YYYY HH:mm').valueOf() -
          moment(b['Shift Start Time'], 'DD/MM/YYYY HH:mm').valueOf(),
      );

      const csv = await json2csv(csvData, keys);

      res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
      res.set('Content-Type', 'application/csv');
      return res.status(200).json({ csv, noData: true });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async historyExport(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let startDateTime = req.body.startDate.split('-');
      let endDateTime = req.body.endDate.split('-');

      startDateTime = `${startDateTime[1]}-${startDateTime[0]}-${startDateTime[2]}`;

      endDateTime = `${endDateTime[1]}-${endDateTime[0]}-${endDateTime[2]}`;
      endDateTime = new Date(endDateTime);
      endDateTime = endDateTime.setDate(endDateTime.getDate() + 1);
      endDateTime = new Date(endDateTime);
      if (req.body.userId) {
        getDataAsPerUser(req, res, this, startDateTime, endDateTime);
      } else {
        Shift.aggregate([
          {
            $match: {
              businessUnitId: mongoose.Types.ObjectId(
                req.params.businessUnitId,
              ),
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
              'shiftDetails.timeZone': 1,
              'shiftDetails.duration': 1,
              'shiftDetails.confirmedStaffs': 1,
              'shiftDetails.isExtendedShift': 1,
              'shiftDetails.extendedStaff': 1,
              'schemeInfo.shiftSetup': 1,
            },
          },
        ])
          .then((results) => {
            if (results.length > 0) {
              async.eachSeries(results, (item, next) => {
                const index = results.indexOf(item);

                if (item.userInfo) {
                  return Attendance.findOne({
                    userId: item.userInfo._id,
                    shiftDetailId: item.shiftDetails._id,
                  })
                    .then((attendance) => {
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

                      if (index === results.length - 1) {
                        return this.sendTimesheetDataExport(results, res);
                      }

                      return next();
                    })
                    .catch(() => {
                      if (index === results.length - 1) {
                        return this.sendTimesheetDataExport(results, res);
                      }

                      return next();
                    });
                }

                if (index === results.length - 1) {
                  return this.sendTimesheetDataExport(results, res);
                }

                return next();
              });
            } else {
              return res.json({
                status: 2,
                message: 'No Data Found',
                data: null,
              });
            }

            return null;
          })
          .catch(() =>
            res.json({
              status: 3,
              message: 'Something Went Wrong',
              data: null,
            }),
          );
      }

      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async lockAllAtOnce(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { ids } = req.body;
      const successfullyLocked = [];
      const failedToLock = [];

      if (ids.length > 0) {
        const promiseData = [];
        const attendanceListCall = async (id, i) => {
          try {
            const result = await Attendance.findOneAndUpdate(
              { _id: mongoose.Types.ObjectId(id[i]) },
              {
                $set: {
                  IsLock: true,
                },
              },
              { new: true },
            );

            if (result) {
              successfullyLocked.push(result._id);
            } else {
              failedToLock.push(id[i]);
            }
          } catch (error) {
            failedToLock.push(id[i]);
          }
        };

        for (let i = 0; i < ids.length; i += 1) {
          promiseData.push(attendanceListCall(ids, i));
        }

        await Promise.all(promiseData);

        return res.json({
          status: 1,
          message: 'Successfully Updated',
          data: { success: successfullyLocked, failed: failedToLock },
        });
      }

      return res.json({
        status: 3,
        message: `You've entered malicious input`,
        data: null,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
}
module.exports = new TimeSheetController();
