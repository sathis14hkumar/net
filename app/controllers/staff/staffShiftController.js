// Controller Code Starts here
const mongoose = require('mongoose');
const moment = require('moment');
const { validationResult } = require('express-validator');
const _ = require('lodash');
const AppliedStaffs = require('../../models/appliedStaff');
const AssignShift = require('../../models/assignShift');
const Shift = require('../../models/shift');
const ShiftDetails = require('../../models/shiftDetails');
const OtherNotification = require('../../models/otherNotifications');
const shiftLogController = require('../company/shiftLogController');
const StaffLimit = require('../../models/staffLimit');
const User = require('../../models/user');
const FCM = require('../../../helpers/fcm');
const PageSettingModel = require('../../models/pageSetting');
const Attendance = require('../../models/attendance');
const __ = require('../../../helpers/globalFunctions');
const ShiftHelper = require('../../../helpers/shiftHelper');
const SubSection = require('../../models/subSection');
const { logInfo, logError } = require('../../../helpers/logger.helper');

function sortObject(obj) {
  return Object.keys(obj)
    .sort(
      (a, b) =>
        moment(a, 'DD/MM/YYYY').toDate() - moment(b, 'DD/MM/YYYY').toDate(),
    )
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
}

class StaffShiftController {
  async recalledShiftConfirmation(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult1 = await __.checkRequiredFields(req, [
        'shiftDetailId',
        'isRecallAccepted',
      ]);

      if (requiredResult1.status === false) {
        return __.out(res, 400, requiredResult1.missingFields);
      }

      let isRecalled = true;

      if (req.body.isRecallAccepted === 3) {
        isRecalled = false;
      }

      const data = await ShiftDetails.findOneAndUpdate(
        { _id: req.body.shiftDetailId, isAssignShift: true },
        { $set: { isRecallAccepted: req.body.isRecallAccepted, isRecalled } },
      );

      if (data) {
        await AssignShift.findOneAndUpdate(
          { _id: data.draftId },
          {
            isRecallAccepted: req.body.isRecallAccepted,
          },
        );

        // await this.updateRedis(assingShiftData.businessUnitId);
        Shift.findById(data.shiftId).then((shiftInfo) => {
          const statusLogData = {
            userId: req.user._id,
            status: 16,
            /* shift created */
            shiftId: data.shiftId,
            weekRangeStartsAt: shiftInfo.weekRangeStartsAt,
            weekRangeEndsAt: shiftInfo.weekRangeEndsAt,
            weekNumber: shiftInfo.weekNumber,
            newTiming: {
              start: data.startTime,
              end: data.endTime,
            },
            businessUnitId: shiftInfo.businessUnitId,
            existingShift: data._id,
            isOff: data.isOff,
            isRest: data.isRest,
            isRecallAccepted: req.body.isRecallAccepted,
          };

          shiftLogController.create(statusLogData, res);
        });
        return __.out(res, 200, 'Shift Updated Successfully');
      }

      return __.out(res, 300, 'Shift not found');
    } catch (e) {
      return __.out(res, 500);
    }
  }

  async matchingShifts(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        status: 1,
        confirmedStaffs: {
          $nin: [req.user._id],
        },
        backUpStaffs: {
          $nin: [req.user._id],
        },
        startTime: {
          $gt: moment().utc().format(),
        },
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.shiftId) {
        where._id = req.body.shiftId;
        findOrFindOne = ShiftDetails.findOne(where);
      } else findOrFindOne = ShiftDetails.find(where);

      let shifts = await findOrFindOne
        .populate([
          {
            path: 'shiftId',
            populate: [
              {
                path: 'plannedBy',
                select: 'name staffId',
              },
              {
                path: 'businessUnitId',
                select: 'name status',
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
          },
          {
            path: 'mainSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'skillSetId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
        ])
        .lean();

      const pageSettingData = await PageSettingModel.findOne(
        {
          companyId: req.user.companyId,
          status: 1,
        },
        { opsGroup: 1 },
      );
      const { tierType } = pageSettingData.opsGroup;

      /* To remove null parents (since parents may get disabled) */
      shifts = await _.filter(shifts, (o) => {
        /* check all skill set matching  */
        let shiftSkillSets = [];
        let notMatchingSkillsArray = [];

        if (tierType === 2) {
          shiftSkillSets = o.subSkillSets.map((x) => x._id);
          notMatchingSkillsArray = _.differenceWith(
            shiftSkillSets,
            req.user.subSkillSets,
            _.isEqual,
          );
        } else {
          shiftSkillSets = o.mainSkillSets.map((x) => x._id);
          notMatchingSkillsArray = _.differenceWith(
            shiftSkillSets,
            req.user.mainSkillSets,
            _.isEqual,
          );
        }

        return (
          shiftSkillSets.length !== 0 &&
          (req.user.subSkillSets.length !== 0 ||
            req.user.mainSkillSets.length !== 0) &&
          notMatchingSkillsArray.length === 0 &&
          ((o.confirmedStaffs && o.confirmedStaffs.length < o.staffNeedCount) ||
            (o.backUpStaffs && o.backUpStaffs.length < o.backUpStaffNeedCount))
        );
      });

      /* get other notifications */

      const shiftNotifications = shifts.map((x) => {
        x.type = 0;
        return x;
      });

      const notificationData = await OtherNotification.find({
        user: req.user._id,
      })
        .select('-fromUser -__v')
        .lean();

      const combinedNotifications = [
        ...shiftNotifications,
        ...notificationData,
      ];

      const sorted = combinedNotifications.sort(__.sortByDate);

      return __.out(res, 201, {
        data: sorted,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async bookingsList(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo('staffshift/bookingslist API Start!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      const requiredResult1 = await __.checkRequiredFields(req, [
        'startDate',
        'type',
      ]);

      if (requiredResult1.status === false) {
        logError(
          `staffshift/bookingslist API, Required fields missing `,
          requiredResult1.missingFields,
        );
        logError(`staffshift/bookingslist API, request payload `, req.body);
        return __.out(res, 400, requiredResult1.missingFields);
      }

      const timeZones = moment
        .parseZone(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z');
      const startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
        .utc()
        .format();
      const endDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
        .add(6, 'days')
        .add(23, 'hours')
        .add(59, 'minutes')
        .add(59, 'seconds')
        .utc()
        .format();
      const pageSettingData = await PageSettingModel.findOne(
        {
          companyId: req.user.companyId,
          status: 1,
        },
        { opsGroup: 1 },
      );
      const companyData = req.user.company;
      const { tierType } = pageSettingData.opsGroup;
      const requestData = {
        userId: req.user._id,
        timeZones,
        startDate,
        endDate,
        userSubSkillSets: req.user.subSkillSets,
        userMainSkillSets: req.user.mainSkillSets,
        tierType,
        schemeType: req.user.schemeId ? req.user.schemeId.shiftSchemeType : 0,
      };

      if (requestData.schemeType === 0) {
        logError(
          `staffshift/bookingslist API, 'scheme not found for staff' `,
          requestData,
        );
        return __.out(res, 400, 'scheme not found for staff');
      }

      if (req.body.shiftDetailsId)
        requestData.shiftDetailsId = req.body.shiftDetailsId;

      // Show Cancelled Shifts Also
      if (req.body.cancelledShifts && req.body.cancelledShifts === true) {
        requestData.cancelledShifts = true;
      }

      // my Bookings

      if (req.body.type === 'myBookings') {
        const myBookings = await this.myBookings(
          requestData,
          res,
          'myBookings',
        );
        const { timeZone } = myBookings;
        let newMyBookingData = JSON.stringify(myBookings);

        newMyBookingData = JSON.parse(newMyBookingData);
        const oneDay = 24 * 3600 * 1000;
        const currentDateFormatArray = [];

        for (let i = 0; i < 7; i += 1) {
          const d = new Date(req.body.startDate).getTime() + i * oneDay;

          currentDateFormatArray.push(
            moment(new Date(d), 'DD-MM-YYYY')
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY'),
          );
        }
        const dateData = [];

        for (const date of Object.keys(newMyBookingData.list)) {
          dateData.push(date);
          newMyBookingData.list[date].forEach((item, index) => {
            item.companyData = companyData;
            if (item.isExtendedShift) {
              const obj = item.extendedStaff.filter(
                (extendedS) =>
                  extendedS.userId.toString() === req.user._id.toString(),
              );

              if (obj.length > 0) {
                item.extendedStaff = {};
                [item.extendedStaff] = obj;
              }
            }

            if (item.isSplitShift) {
              newMyBookingData.list[date].forEach((splitItem, splitIndex) => {
                if (splitIndex !== index) {
                  if (
                    item.randomShiftId &&
                    splitItem.randomShiftId &&
                    splitItem.isSplitShift &&
                    new Date(splitItem.date).getTime() ===
                      new Date(item.date).getTime() &&
                    splitItem.randomShiftId.toString() ===
                      item.randomShiftId.toString()
                  ) {
                    if (splitItem.isParent === 2) {
                      item.splitShiftStartTime = splitItem.startTime;
                      item.splitShiftEndTime = splitItem.endTime;
                      item.splitShiftId = splitItem._id;
                      item.duration += splitItem.duration;
                      newMyBookingData.list[date].splice(splitIndex, 1);
                    } else {
                      const splitShiftStartTime = item.startTime;
                      const splitShiftEndTime = item.endTime;
                      const splitShiftId = item._id;

                      item.startTime = splitItem.startTime;
                      item.endTime = splitItem.endTime;
                      item._id = splitItem._id;
                      item.duration += splitItem.duration;
                      item.splitShiftStartTime = splitShiftStartTime;
                      item.splitShiftEndTime = splitShiftEndTime;
                      item.splitShiftId = splitShiftId;
                      newMyBookingData.list[date].splice(splitIndex, 1);
                    }
                  }
                }
              });
            }
          });
        }
        const missingDateData = currentDateFormatArray.filter(
          (obj) => dateData.indexOf(obj) === -1,
        );

        for (let i = 0; i < missingDateData.length; i += 1) {
          newMyBookingData.list[missingDateData[i]] = [];
        }

        newMyBookingData.list = sortObject(newMyBookingData.list);
        logInfo('staffshift/bookingslist API ends here', {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return __.out(res, 201, newMyBookingData);
      }

      return Promise.all([
        this.myBookings(requestData, res, 'none'),
        this.availableShifts(requestData, res),
      ]).then((values) => {
        let newMyBookingData = JSON.stringify(values[0]);

        newMyBookingData = JSON.parse(newMyBookingData);
        const oneDay = 24 * 3600 * 1000;
        const { timeZone } = newMyBookingData;
        const currentDateFormatArray = [];

        for (let i = 0; i < 7; i += 1) {
          const d = new Date(req.body.startDate).getTime() + i * oneDay;

          currentDateFormatArray.push(
            moment(new Date(d), 'DD-MM-YYYY')
              .utcOffset(`${timeZone}`)
              .format('DD-MM-YYYY'),
          );
        }
        const dateData = [];

        for (const date of Object.keys(newMyBookingData.list)) {
          dateData.push(date);
          newMyBookingData.list[date].forEach((item, index) => {
            item.companyData = companyData;
            if (item.isExtendedShift) {
              const obj = item.extendedStaff.filter(
                (extendedS) =>
                  extendedS.userId.toString() === req.user._id.toString(),
              );

              if (obj.length > 0) {
                item.extendedStaff = obj;
                if (obj[0].confirmStatus === 1 || obj[0].confirmStatus === 2) {
                  [item.extendedStaff] = obj;
                }
              }
            }

            if (item.isSplitShift) {
              newMyBookingData.list[date].forEach((splitItem, splitIndex) => {
                if (splitIndex !== index) {
                  if (
                    item.randomShiftId &&
                    splitItem.randomShiftId &&
                    splitItem.isSplitShift &&
                    new Date(splitItem.date).getTime() ===
                      new Date(item.date).getTime() &&
                    splitItem.randomShiftId.toString() ===
                      item.randomShiftId.toString()
                  ) {
                    if (splitItem.isParent === 2) {
                      item.splitShiftStartTime = splitItem.startTime;
                      item.splitShiftEndTime = splitItem.endTime;
                      item.splitShiftId = splitItem._id;
                      item.duration += splitItem.duration;
                      newMyBookingData.list[date].splice(splitIndex, 1);
                    } else {
                      const splitShiftStartTime = item.startTime;
                      const splitShiftEndTime = item.endTime;
                      const splitShiftId = item._id;

                      item.startTime = splitItem.startTime;
                      item.endTime = splitItem.endTime;
                      item._id = splitItem._id;
                      item.duration += splitItem.duration;
                      item.splitShiftStartTime = splitShiftStartTime;
                      item.splitShiftEndTime = splitShiftEndTime;
                      item.splitShiftId = splitShiftId;
                      newMyBookingData.list[date].splice(splitIndex, 1);
                    }
                  }
                }
              });
            }
          });
        }
        const missingDateData = currentDateFormatArray.filter(
          (obj) => dateData.indexOf(obj) === -1,
        );

        for (let i = 0; i < missingDateData.length; i += 1) {
          newMyBookingData.list[missingDateData[i]] = [];
        }
        newMyBookingData.list = sortObject(newMyBookingData.list);
        const availableData = values[1];

        for (const date of Object.keys(availableData)) {
          availableData[date].forEach((item, index) => {
            item.companyData = companyData;
            if (item.isExtendedShift) {
              const obj = item.extendedStaff.filter(
                (extendedS) =>
                  extendedS.userId.toString() === req.user._id.toString(),
              );

              if (obj.length > 0) {
                item.extendedStaff = {};
                if (obj[0].confirmStatus === 1 || obj[0].confirmStatus === 2) {
                  [item.extendedStaff] = obj;
                }
              }
            }

            if (item.isSplitShift) {
              availableData[date].forEach((splitItem, splitIndex) => {
                if (splitIndex !== index) {
                  if (
                    item.randomShiftId &&
                    splitItem.randomShiftId &&
                    splitItem.isSplitShift &&
                    new Date(splitItem.date).getTime() ===
                      new Date(item.date).getTime() &&
                    splitItem.randomShiftId.toString() ===
                      item.randomShiftId.toString()
                  ) {
                    if (splitItem.isParent === 2) {
                      item.splitShiftStartTime = splitItem.startTime;
                      item.splitShiftEndTime = splitItem.endTime;
                      item.splitShiftId = splitItem._id;
                      item.duration += splitItem.duration;
                      availableData[date].splice(splitIndex, 1);
                    } else {
                      const splitShiftStartTime = item.startTime;
                      const splitShiftEndTime = item.endTime;
                      const splitShiftId = item._id;

                      item.startTime = splitItem.startTime;
                      item.endTime = splitItem.endTime;
                      item._id = splitItem._id;
                      item.duration += splitItem.duration;
                      item.splitShiftStartTime = splitShiftStartTime;
                      item.splitShiftEndTime = splitShiftEndTime;
                      item.splitShiftId = splitShiftId;
                      availableData[date].splice(splitIndex, 1);
                    }
                  }
                }
              });
            }
          });
        }
        logInfo('staffshift/bookingslist API ends here', {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return __.out(res, 201, {
          myBookings: newMyBookingData,
          availableShifts: availableData,
        });
      });
    } catch (err) {
      logError(`staffshift/bookingslist API, Caught an error `, err.toString());
      return __.out(res, 500);
    }
  }

  async availableShifts(reqestData, res) {
    try {
      if (reqestData.schemeType === 2) {
        return {};
      }

      const where = {
        status: 1,
        confirmedStaffs: {
          $nin: [reqestData.userId],
        },
        backUpStaffs: {
          $nin: [reqestData.userId],
        },
        date: {
          $gte: moment(reqestData.startDate).utc().format(),
          $lte: moment(reqestData.endDate).utc().format(),
        },
      };

      where.userId = reqestData.userId;
      const listData = {};
      const shifts = await this.shiftDetails(where, res); // getting shift details

      await shifts.forEach((element) => {
        const key = __.getDateStringFormat(element.date, element.timeZone);
        let shiftSkillSets = [];
        let notMatchingSkillsArray = [];

        /* check all skill set matching  */
        if (reqestData.tierType === 1) {
          if (element.mainSkillSets) {
            shiftSkillSets = Array.from(element.mainSkillSets, (x) => x._id);
            /* check diff btwn user skill set and shift skill set and list skillsets that not match with user */
            reqestData.userSubSkillSets = [];
            notMatchingSkillsArray = _.differenceWith(
              shiftSkillSets,
              reqestData.userMainSkillSets,
              _.isEqual,
            );
          }
        } else if (element.subSkillSets) {
          shiftSkillSets = Array.from(element.subSkillSets, (x) => x._id);
          /* check diff btwn user skill set and shift skill set and list skillsets that not match with user */
          reqestData.userMainSkillSets = [];
          notMatchingSkillsArray = _.differenceWith(
            shiftSkillSets,
            reqestData.userSubSkillSets,
            _.isEqual,
          );
        }

        if (
          shiftSkillSets.length !== 0 &&
          (reqestData.userSubSkillSets.length !== 0 ||
            reqestData.userMainSkillSets.length !== 0) &&
          notMatchingSkillsArray.length === 0
        ) {
          /* only if all shift skillset match with user */
          if (
            !element.confirmedStaffs ||
            (element.confirmedStaffs &&
              element.confirmedStaffs.length < element.staffNeedCount)
          ) {
            /* check the confirm slots available */
            element.isConfirmed = 1;
          } else if (
            !element.backUpStaffs ||
            (element.backUpStaffs &&
              element.backUpStaffs.length < element.backUpStaffNeedCount)
          ) {
            /* else check the stand by slots available */
            element.isConfirmed = 0;
          } else {
            /* booking full (both confirm & backup slots so skip it) */
            return; /* skip this iteration */
          }

          if (!listData[key]) {
            /* create a new key by date in array */
            listData[key] = [];
          }

          listData[key].push(element);
        }
      });

      return listData;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getAttendanceTotal(res, shifts, userId) {
    try {
      let totalApprovedDuration = 0;

      const promiseData = [];
      const attendanceListCall = async (element) => {
        const attendanceData = await Attendance.findOne(
          { userId, shiftDetailId: element._id },
          { approval: 1 },
        );
        let duration = 0;

        if (
          attendanceData &&
          (attendanceData.approval.neither ||
            attendanceData.approval.clocked ||
            attendanceData.approval.shift)
        ) {
          duration = attendanceData.approval.duration;
        }

        totalApprovedDuration += duration;
      };

      for (let i = 0; i < shifts.length; i += 1) {
        promiseData.push(attendanceListCall(shifts[i]));
      }

      await Promise.all(promiseData);

      return totalApprovedDuration;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async myBookings(requestData, res, from) {
    // 'status': 1,
    try {
      const where = {
        date: {
          $gte: moment(requestData.startDate).utc().format(),
          $lte: moment(requestData.endDate).utc().format(),
        },
        $or: [
          {
            confirmedStaffs: requestData.userId,
          },
          {
            backUpStaffs: requestData.userId,
          },
        ],
      };

      where.userId = requestData.userId;
      if (from !== 'myBookings') {
        where.isRest = false;
        where.isOff = false;
      }

      // Show Cancelled Shifts Also
      if (requestData.cancelledShifts && requestData.cancelledShifts === true) {
        where.status = {
          $in: [1, 2],
        };
      }

      let timeZone = '+0800';

      if (requestData.shiftDetailsId) where._id = requestData.shiftDetailsId;

      const shifts = await this.shiftDetails(where, res);
      const totalApprovedDuration = await this.getAttendanceTotal(
        res,
        shifts,
        requestData.userId,
      );

      const listData = {};

      await shifts.forEach((element) => {
        timeZone = element.timeZone;
        if (!element.appliedStaffs[0]) return;

        if (element.isExtendedShift) {
          let extendedStaff = element.extendedStaff.filter(
            (item) => item.userId.toString() === requestData.userId.toString(),
          );

          if (extendedStaff.length > 0) {
            [extendedStaff] = extendedStaff;
            if (extendedStaff.confirmStatus === 2) {
              element.duration = extendedStaff.duration;
            }
          }
        }

        if (element.isAssignShift && (element.isRest || element.isOff)) {
          if (element.isRecallAccepted !== 2) {
            element.duration = 0;
          }
        }

        const key = __.getDateStringFormat(element.date, element.timeZone);

        if (listData[key]) {
          /* if date already keyed in array */
          listData[key].push(element);
        } else {
          /* else create a new key by date in array */
          listData[key] = [];
          listData[key].push(element);
        }
      });
      return {
        list: listData,
        timeZone,
        totalApprovedDuration: await this.getDuration(totalApprovedDuration),
      };
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getDuration(time) {
    if (time) {
      time = parseFloat(time);
      time *= 60;
      const hours = Math.floor(time / 60);
      const minutes = Math.round(time % 60);

      return `${hours}h:${minutes}min`;
    }

    return '0';
  }

  async shiftDetails(where, res) {
    try {
      let findOrFindOne;
      const { userId } = where;

      delete where.userId;
      if (where._id) findOrFindOne = ShiftDetails.findOne(where);
      else findOrFindOne = ShiftDetails.find(where);

      const shiftDetails = await findOrFindOne
        .select('-__v -createdAt -updatedAt')
        .populate([
          {
            path: 'draftId',
            select:
              'shiftRead shiftChangeRequestStatus shiftChangeRequestMessage',
          },
          {
            path: 'shiftId',
            select: '-__v -shiftDetails -createdAt -updatedAt',
            populate: [
              {
                path: 'plannedBy',
                select: 'name staffId',
              },
              {
                path: 'businessUnitId',
                select: 'name status shiftTimeInMinutes',
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
            path: 'appliedStaffs',
            select: 'status',
            match: {
              flexiStaff: userId,
              status: {
                $in: [1, 2] /* only confirmed and stanby slots */,
              },
            },
          },
          {
            path: 'reportLocationId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
          {
            path: 'geoReportingLocation',
            select: '_id name',
            match: {
              status: 'active',
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
            path: 'requestedShifts',
            match: {
              status: 0,
              dedicatedRequestTo: userId,
            },
          },
        ])
        .sort({
          startTime: 1,
        })
        .lean();

      return shiftDetails; // final result
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async makeBooking(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isConfirmed',
      ]);

      if (
        requiredResult.status === false ||
        (req.body.isSplitShift && req.body.splitShiftDetailsId === '')
      ) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const userId = req.user._id;
        let updateObj = {};

        if (req.body.isConfirmed) {
          updateObj = {
            $push: {
              confirmedStaffs: req.user._id,
            },
          };
        } else {
          updateObj = {
            $push: {
              backUpStaffs: req.user._id,
            },
          };
        }

        const currentShiftDetails = await ShiftDetails.findOneAndUpdate(
          {
            _id: req.body.shiftDetailsId,
            status: 1,
            startTime: {
              $gt: moment().utc().format(),
            },
          },
          updateObj,
        ).populate([
          {
            path: 'shiftId',
            select: 'weekNumber businessUnitId',
          },
        ]);

        if (!currentShiftDetails) {
          await this.reduceLimit(res, userId, req.body.shiftDetailsId);
          __.out(res, 300, 'Invalid Shift / Shift Expired');
        }

        let currentShiftDetailsSplit = null;

        if (req.body.isSplitShift) {
          currentShiftDetailsSplit = await ShiftDetails.findOneAndUpdate(
            {
              _id: req.body.splitShiftDetailsId,
              status: 1,
              startTime: {
                $gt: moment().utc().format(),
              },
            },
            updateObj,
          ).populate([
            {
              path: 'shiftId',
              select: 'businessUnitId weekNumber',
            },
          ]);
          currentShiftDetails.duration += currentShiftDetailsSplit.duration;
        }

        if (
          !currentShiftDetails ||
          (req.body.isSplitShift && !currentShiftDetailsSplit)
        ) {
          if (req.body.isConfirmed) {
            await ShiftDetails.update(
              { _id: req.body.shiftDetailsId },
              { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
            );
            if (req.body.isSplitShift) {
              await ShiftDetails.update(
                { _id: req.body.splitShiftDetailsId },
                { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
              );
            }
          } else {
            await ShiftDetails.update(
              { _id: req.body.shiftDetailsId },
              { $pull: { backUpStaffs: { $in: [req.user._id] } } },
            );
            if (req.body.isSplitShift) {
              await ShiftDetails.update(
                { _id: req.body.splitShiftDetailsId },
                { $pull: { backUpStaffs: { $in: [req.user._id] } } },
              );
            }
          }

          await this.reduceLimit(res, userId, currentShiftDetails);
          __.out(res, 300, 'Invalid Shift / Shift Expired');
        } else {
          const { staffNeedCount } = currentShiftDetails;
          const { backUpStaffNeedCount } = currentShiftDetails;
          const confirmedStaffsLength =
            currentShiftDetails.confirmedStaffs.length;
          const backUpStaffsLength = currentShiftDetails.backUpStaffs.length;
          const { isConfirmed } = req.body;

          if (
            (isConfirmed === 1 && staffNeedCount > confirmedStaffsLength) ||
            (isConfirmed === 0 && backUpStaffNeedCount > backUpStaffsLength)
          ) {
            // check staff available time
            const data = {
              startTime: currentShiftDetails.startTime,
              endTime: currentShiftDetails.endTime,
              flexiStaffId: req.user._id,
              shiftId: req.body.shiftDetailsId,
            };
            const checkStaffAvailableInGivenTime =
              await this.checkStaffAvailableInGivenTime(data, res);
            let checkStaffAvailableInGivenTimeSplit = false;

            if (req.body.isSplitShift) {
              const newData = {
                startTime: currentShiftDetailsSplit.startTime,
                endTime: currentShiftDetailsSplit.endTime,
                flexiStaffId: req.user._id,
                shiftId: req.body.splitShiftDetailsId,
              };

              checkStaffAvailableInGivenTimeSplit =
                await this.checkStaffAvailableInGivenTime(newData, res);
            }

            if (
              checkStaffAvailableInGivenTime &&
              (!req.body.isSplitShift ||
                (req.body.isSplitShift && checkStaffAvailableInGivenTimeSplit))
            ) {
              const addTosetObj = {};
              const set = {};
              let status;
              let statusString = '';

              if (staffNeedCount > confirmedStaffsLength) {
                status = 1;
                if (staffNeedCount >= confirmedStaffsLength + 1) {
                  __.log('am here both are equal');
                  set.isShortTimeCancel = 0;
                }

                statusString = `You have booked a confirmed shift.
                            
              Note that any last minute cancellation of booking or no - show will be penalized.`;
              } else if (
                isConfirmed === 0 &&
                backUpStaffNeedCount >= backUpStaffsLength + 1
              ) {
                status = 2;
                statusString = `You have booked a standby shift.
                            
                You shall be notified and automatically upgraded in the event of an available confirmed slot.`;
              } else if (isConfirmed === 1) {
                /* tried for confirm but confirm slot filled */

                await ShiftDetails.update(
                  { _id: req.body.shiftDetailsId },
                  { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                );
                if (req.body.isSplitShift) {
                  await ShiftDetails.update(
                    { _id: req.body.splitShiftDetailsId },
                    { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                  );
                }

                __.out(
                  res,
                  300,
                  'Your booking is unsuccessful as the confirm slot has been assigned.Please try for standby slot.',
                );
                // this.updateRedis(redisBuId)
                //   .then((uRedisResult) => {
                //   })
                //   .catch((eRedisResult) => {
                //   });
                return;
              } else {
                /* tried for standby but standby slot filled */
                await ShiftDetails.update(
                  { _id: req.body.shiftDetailsId },
                  { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                );
                if (req.body.isSplitShift) {
                  await ShiftDetails.update(
                    { _id: req.body.splitShiftDetailsId },
                    { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                  );
                }

                __.out(
                  res,
                  300,
                  'Your booking is unsuccessful as the standby slot has been assigned.',
                );
                // this.updateRedis(redisBuId)
                //   .then((uRedisResult) => {
                //   })
                //   .catch((eRedisResult) => {
                //   });
                return;
              }

              const limitData = {
                status: 1,
                isLimit: false,
              };

              if (limitData.status === 1) {
                // check confirmed staff here as well
                const insertAppliedStaffs = await new AppliedStaffs({
                  shiftId: currentShiftDetails.shiftId,
                  shiftDetailsId: currentShiftDetails._id,
                  flexiStaff: req.user._id,
                  status,
                  isLimit: limitData.isLimit, // req.body.limit,
                }).save();
                const insertAppliedStaffId = insertAppliedStaffs._id;

                addTosetObj.appliedStaffs = insertAppliedStaffId;
                if (limitData.isLimit) {
                  set.isLimit = true;
                }

                await ShiftDetails.update(
                  {
                    _id: currentShiftDetails._id,
                  },
                  {
                    $addToSet: addTosetObj,
                    $set: set,
                  },
                  {
                    new: true,
                  },
                );

                // added by ashish
                if (req.body.isSplitShift) {
                  await new AppliedStaffs({
                    shiftId: currentShiftDetails.shiftId,
                    shiftDetailsId: req.body.splitShiftDetailsId,
                    flexiStaff: req.user._id,
                    status,
                  }).save();

                  addTosetObj.appliedStaffs = insertAppliedStaffId;

                  await ShiftDetails.update(
                    {
                      _id: req.body.splitShiftDetailsId,
                    },
                    {
                      $addToSet: addTosetObj,
                      $set: set,
                    },
                    {
                      new: true,
                    },
                  );
                }

                // this.updateRedis(redisBuId)
                //   .then((uRedisResult) => {
                //   })
                //   .catch((eRedisResult) => {
                //   });
                __.out(res, 201, statusString); // +' \n'+limitData.message
              }

              if (req.body.isConfirmed) {
                await ShiftDetails.update(
                  { _id: req.body.shiftDetailsId },
                  { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                );
                if (req.body.isSplitShift) {
                  await ShiftDetails.update(
                    { _id: req.body.splitShiftDetailsId },
                    { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                  );
                }
              } else {
                await ShiftDetails.update(
                  { _id: req.body.shiftDetailsId },
                  { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                );
                if (req.body.isSplitShift) {
                  await ShiftDetails.update(
                    { _id: req.body.splitShiftDetailsId },
                    { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                  );
                }
              }

              // this.updateRedis(redisBuId)
              //   .then((uRedisResult) => {
              //   })
              //   .catch((eRedisResult) => {
              //   });
              __.out(res, 300, limitData.message);
            }

            // if staff has overlap booking
            if (req.body.isConfirmed) {
              await this.reduceLimit(res, userId, currentShiftDetails);
              await ShiftDetails.update(
                { _id: req.body.shiftDetailsId },
                { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
              );
              if (req.body.isSplitShift) {
                await ShiftDetails.update(
                  { _id: req.body.splitShiftDetailsId },
                  { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
                );
              }
            } else {
              await ShiftDetails.update(
                { _id: req.body.shiftDetailsId },
                { $pull: { backUpStaffs: { $in: [req.user._id] } } },
              );
              if (req.body.isSplitShift) {
                await ShiftDetails.update(
                  { _id: req.body.splitShiftDetailsId },
                  { $pull: { backUpStaffs: { $in: [req.user._id] } } },
                );
              }
            }

            // this.updateRedis(redisBuId)
            //   .then((uRedisResult) => {
            //   })
            //   .catch((eRedisResult) => {
            //   });
            __.out(res, 300, 'You have another shift at the same time.');
          }

          let statusString = '';

          if (req.body.isConfirmed) {
            await ShiftDetails.update(
              { _id: req.body.shiftDetailsId },
              { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
            );
            if (req.body.isSplitShift) {
              await ShiftDetails.update(
                { _id: req.body.splitShiftDetailsId },
                { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
              );
            }
          } else {
            await ShiftDetails.update(
              { _id: req.body.shiftDetailsId },
              { $pull: { backUpStaffs: { $in: [req.user._id] } } },
            );
            if (req.body.isSplitShift) {
              await ShiftDetails.update(
                { _id: req.body.splitShiftDetailsId },
                { $pull: { backUpStaffs: { $in: [req.user._id] } } },
              );
            }
          }

          if (isConfirmed === 1) {
            await this.reduceLimit(res, userId, currentShiftDetails);
            statusString =
              'Your booking is unsuccessful as the slot has been assigned.Please view other available shifts.'; // 'Confirm slots are fully booked.Now you can book backup slots if available';
          } else {
            statusString =
              'Your booking is unsuccessful as the slot has been assigned.Please view other available shifts.'; // 'Standby slots are fully booked.Currently no slots available to book.';
          }

          // this.updateRedis(redisBuId)
          //   .then((uRedisResult) => {
          //   })
          //   .catch((eRedisResult) => {
          //   });
          __.out(res, 300, statusString);
        }
      }
    } catch (err) {
      __.log(err);
      try {
        if (req.body.isConfirmed) {
          await ShiftDetails.update(
            { _id: req.body.shiftDetailsId },
            { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
          );
          if (req.body.isSplitShift) {
            await ShiftDetails.update(
              { _id: req.body.splitShiftDetailsId },
              { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
            );
          }

          await this.reduceLimit(res, req.user._id, req.body.shiftDetailsId, 0);
        } else {
          await ShiftDetails.update(
            { _id: req.body.shiftDetailsId },
            { $pull: { backUpStaffs: { $in: [req.user._id] } } },
          );
          if (req.body.isSplitShift) {
            await ShiftDetails.update(
              { _id: req.body.splitShiftDetailsId },
              { $pull: { backUpStaffs: { $in: [req.user._id] } } },
            );
          }
        }
      } catch (error) {
        __.out(error, 500);
      }
      __.out(res, 500);
    }
  }

  async makeBookingNew(req, res) {
    logInfo('staffshift/checklimit API Start!', {
      name: req.user.name,
      staffId: req.user.staffId,
    });
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isConfirmed',
      ]);

      if (
        requiredResult.status === false ||
        (req.body.isSplitShift && req.body.splitShiftDetailsId === '')
      ) {
        logError(
          `staffshift/checklimit API, Required fields missing `,
          requiredResult.missingFields,
        );
        logError(`staffshift/checklimit API, request payload `, req.body);
        return __.out(res, 400, requiredResult.missingFields);
      }

      const userId = req.user._id;
      let updateObj = {};
      let pullObj = {};
      const where = {
        _id: req.body.shiftDetailsId,
        status: 1,
        startTime: {
          $gt: moment().utc().format(),
        },
      };

      if (req.body.isConfirmed) {
        updateObj = {
          $push: {
            confirmedStaffs: userId,
          },
        };
        pullObj = {
          $pull: {
            confirmedStaffs: userId,
          },
        };
        where.confirmedStaffs = { $ne: userId };
      } else {
        updateObj = {
          $push: {
            backUpStaffs: userId,
          },
        };
        pullObj = {
          $pull: {
            backUpStaffs: userId,
          },
        };
        where.backUpStaffs = { $ne: userId };
      }

      // in new code we can remove populate by adding buId, weekNumber inside shiftDetails
      const currentShiftDetails = await ShiftDetails.findOneAndUpdate(
        where,
        updateObj,
      ).populate([
        {
          path: 'shiftId',
          select: 'weekNumber businessUnitId',
        },
      ]);

      if (!currentShiftDetails) {
        logError(
          `staffshift/checklimit API, 'Invalid Shift / Shift Expired'`,
          currentShiftDetails,
        );
        return __.out(res, 300, 'Invalid Shift / Shift Expired');
      }

      let currentShiftDetailsSplit = null;

      if (req.body.isSplitShift) {
        currentShiftDetailsSplit = await ShiftDetails.findOneAndUpdate(
          {
            _id: req.body.splitShiftDetailsId,
            status: 1,
            startTime: {
              $gt: moment().utc().format(),
            },
          },
          updateObj,
        );
        if (!currentShiftDetailsSplit) {
          logError(
            `staffshift/checklimit API, 'Invalid Shift / Shift Expired'`,
            currentShiftDetailsSplit,
          );
          return __.out(res, 300, 'Invalid Shift / Shift Expired');
        }

        currentShiftDetails.duration += currentShiftDetailsSplit.duration;
      }

      const { staffNeedCount } = currentShiftDetails;
      const { backUpStaffNeedCount } = currentShiftDetails;
      const confirmedStaffsLength = currentShiftDetails.confirmedStaffs.length;
      const backUpStaffsLength = currentShiftDetails.backUpStaffs.length;
      const { isConfirmed } = req.body;

      if (
        !(isConfirmed === 1 && staffNeedCount > confirmedStaffsLength) &&
        !(isConfirmed === 0 && backUpStaffNeedCount > backUpStaffsLength)
      ) {
        // if slot is already full remove push data.
        const statusString =
          'Your booking is unsuccessful as the slot has been assigned.Please view other available shifts';

        await ShiftDetails.updateOne({ _id: req.body.shiftDetailsId }, pullObj);
        if (req.body.isSplitShift) {
          await ShiftDetails.updateOne(
            { _id: req.body.splitShiftDetailsId },
            pullObj,
          );
        }

        logInfo('staffshift/checklimit API api end!', {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return __.out(res, 300, statusString);
      }

      // check staff available time
      const data = {
        startTime: currentShiftDetails.startTime,
        endTime: currentShiftDetails.endTime,
        flexiStaffId: userId,
        shiftId: req.body.shiftDetailsId,
      };
      // if present getting false value
      const checkStaffAvailableInGivenTime =
        await this.checkStaffAvailableInGivenTime(data, res);
      let checkStaffAvailableInGivenTimeSplit = false;

      if (req.body.isSplitShift) {
        const newData = {
          startTime: currentShiftDetailsSplit.startTime,
          endTime: currentShiftDetailsSplit.endTime,
          flexiStaffId: userId,
          shiftId: req.body.splitShiftDetailsId,
        };

        checkStaffAvailableInGivenTimeSplit =
          await this.checkStaffAvailableInGivenTime(newData, res);
      }

      // check below condition is working for split shift or not
      if (
        !checkStaffAvailableInGivenTime ||
        (req.body.isSplitShift && !checkStaffAvailableInGivenTimeSplit)
      ) {
        // if staff has overlap booking
        await ShiftDetails.updateOne({ _id: req.body.shiftDetailsId }, pullObj);
        if (req.body.isSplitShift) {
          await ShiftDetails.updateOne(
            { _id: req.body.splitShiftDetailsId },
            pullObj,
          );
        }

        logError(
          `staffshift/checklimit API`,
          'You have another shift at the same time.',
        );
        return __.out(res, 300, 'You have another shift at the same time.');
      }

      const addTosetObj = {};
      const set = {};
      let status;
      let statusString = '';

      if (staffNeedCount > confirmedStaffsLength && isConfirmed === 1) {
        status = 1;
        if (staffNeedCount >= confirmedStaffsLength + 1) {
          __.log('am here both are equal');
          set.isShortTimeCancel = 0;
        }

        statusString = `You have booked a confirmed shift. Note that any last minute cancellation of booking or no - show will be penalized.`;
      } else if (
        isConfirmed === 0 &&
        backUpStaffNeedCount >= backUpStaffsLength + 1
      ) {
        status = 2;
        statusString = `You have booked a standby shift. You shall be notified and automatically upgraded in the event of an available confirmed slot.`;
      } else {
        /* tried for standby but standby slot filled */
        await ShiftDetails.updateOne({ _id: req.body.shiftDetailsId }, pullObj);
        if (req.body.isSplitShift) {
          await ShiftDetails.updateOne(
            { _id: req.body.splitShiftDetailsId },
            pullObj,
          );
        }

        const msg =
          isConfirmed === 1
            ? 'Your booking is unsuccessful as the confirm slot has been assigned.Please try for standby slot.'
            : 'Your booking is unsuccessful as the standby slot has been assigned.';

        logError(`staffshift/checklimit API`, msg);
        return __.out(res, 300, msg);
      }

      let limitData = {
        status: 1,
        limit: false,
      };

      limitData = await this.checkLimitNew(
        res,
        userId,
        currentShiftDetails,
        currentShiftDetailsSplit,
        true,
      );
      if (limitData.limit) {
        await ShiftDetails.updateOne({ _id: req.body.shiftDetailsId }, pullObj);
        if (req.body.isSplitShift) {
          await ShiftDetails.updateOne(
            { _id: req.body.splitShiftDetailsId },
            pullObj,
          );
        }

        logInfo('staffshift/checklimit API end!', {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return res
          .status(201)
          .json({ limit: true, status: 0, message: limitData.message });
      }

      // check interval and limit
      // check confirmed staff here as well
      const insertAppliedStaffs = await new AppliedStaffs({
        shiftId: currentShiftDetails.shiftId,
        shiftDetailsId: currentShiftDetails._id,
        flexiStaff: userId,
        status,
      }).save();
      const insertAppliedStaffId = insertAppliedStaffs._id;

      addTosetObj.appliedStaffs = insertAppliedStaffId;
      let updObj = {
        $addToSet: addTosetObj,
      };

      if (!_.isEmpty(set)) {
        updObj = {
          $addToSet: addTosetObj,
          $set: set,
        };
      }

      await ShiftDetails.updateOne(
        {
          _id: currentShiftDetails._id,
        },
        updObj,
        {
          new: true,
        },
      );

      if (req.body.isSplitShift) {
        await new AppliedStaffs({
          shiftId: currentShiftDetails.shiftId,
          shiftDetailsId: req.body.splitShiftDetailsId,
          flexiStaff: userId,
          status,
        }).save();

        addTosetObj.appliedStaffs = insertAppliedStaffId;

        if (!_.isEmpty(set)) {
          updObj = {
            $addToSet: addTosetObj,
            $set: set,
          };
        }

        await ShiftDetails.updateOne(
          {
            _id: req.body.splitShiftDetailsId,
          },
          updObj,
          {
            new: true,
          },
        );
      }

      let shiftLogStatus = 0;

      if (req.body.isConfirmed === 1) {
        shiftLogStatus = 18;
      } else {
        shiftLogStatus = 19;
      }

      /* Create Shift Log */
      const logMetaData = await Shift.findOne({
        _id: currentShiftDetails.shiftId,
      })
        .select(
          'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
        )
        .lean();

      /* Add to log */
      const statusLogData = {
        userId: req.user._id,
        status: shiftLogStatus,
        /* shift created */
        shiftId: currentShiftDetails.shiftId,
        weekRangeStartsAt: logMetaData.weekRangeStartsAt,
        weekRangeEndsAt: logMetaData.weekRangeEndsAt,
        weekNumber: logMetaData.weekNumber,
        businessUnitId: logMetaData.businessUnitId,
        existingShift: currentShiftDetails._id,
      };

      await shiftLogController.create(statusLogData, res);

      logInfo('staffshift/checklimit API ends here!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, statusString);
    } catch (err) {
      __.log(err);
      try {
        if (req.body.isConfirmed) {
          await ShiftDetails.updateOne(
            { _id: req.body.shiftDetailsId },
            { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
          );
          if (req.body.isSplitShift) {
            await ShiftDetails.updateOne(
              { _id: req.body.splitShiftDetailsId },
              { $pull: { confirmedStaffs: { $in: [req.user._id] } } },
            );
          }
        } else {
          await ShiftDetails.updateOne(
            { _id: req.body.shiftDetailsId },
            { $pull: { backUpStaffs: { $in: [req.user._id] } } },
          );
          if (req.body.isSplitShift) {
            await ShiftDetails.updateOne(
              { _id: req.body.splitShiftDetailsId },
              { $pull: { backUpStaffs: { $in: [req.user._id] } } },
            );
          }
        }
      } catch (error) {
        logError(
          `staffshift/checklimit API, there is an error`,
          error.toString(),
        );
        return __.out(error, 500);
      }
      logError(`staffshift/checklimit API, there is an error`, err.toString());
      return __.out(res, 500);
    }
  }

  async checkLimitNew(
    res,
    userId,
    shiftDetails,
    currentShiftDetailsSplit,
    bookNewShift = false,
  ) {
    try {
      // check if we can remove this query
      let schemeDetails = await User.findById(userId, {
        schemeId: 1,
        _id: 0,
      }).populate([
        {
          path: 'schemeId',
          match: {
            status: true,
          },
        },
      ]);

      if (schemeDetails.schemeId) {
        schemeDetails = schemeDetails.schemeId;

        // check cutOffDaysForBookingAndCancelling
        const subSectionForBU = await SubSection.findOne({
          _id: shiftDetails.shiftId.businessUnitId,
        }).lean();

        if (subSectionForBU.cutOffDaysForBookingAndCancelling) {
          if (subSectionForBU.cutOffDaysForBookingAndCancelling > 0) {
            const a = shiftDetails.timeZone;
            const hr = a[1] + a[2];
            const min = a[3] + a[4];
            const min1 = parseInt(hr, 10) * 60 + parseInt(min, 10);
            const newStartTime = moment(shiftDetails.startTime).add(
              min1,
              'minutes',
            );
            const currTime = moment().add(min1, 'minutes');
            const shiftStartTime = moment(newStartTime).format('LL');
            const currentTime = moment(currTime).format('LL');

            const hoursLeftToStartShift = __.getDurationInHours(
              currentTime,
              shiftStartTime,
            );

            const days = (hoursLeftToStartShift / 24).toFixed(0); // in days

            const shiftExactStartTime = moment(shiftDetails.startTime);
            const currentExactTime = moment();

            const exactHoursLeftToStartShift = __.getDurationInHours(
              currentExactTime,
              shiftExactStartTime,
            );

            if (
              subSectionForBU.cutOffDaysForBookingAndCancelling >
                parseInt(days, 10) &&
              parseInt(exactHoursLeftToStartShift, 10) > 0
            ) {
              return {
                limit: true,
                status: 0,
                message:
                  'You cannot book this shift as it falls within the cut-off time.',
              };
            }
          }
        }

        // check if shift interval is require
        if (schemeDetails.isShiftInterval) {
          const intervalRequireTime = schemeDetails.shiftIntervalTotal - 1; // shiftIntervalTotal is in min
          const intervalResult = await ShiftHelper.checkShiftInterval(
            userId,
            shiftDetails.startTime,
            shiftDetails.endTime,
            intervalRequireTime,
            shiftDetails._id,
          );
          let isSplitInterval = false;

          if (currentShiftDetailsSplit) {
            isSplitInterval = await ShiftHelper.checkShiftInterval(
              userId,
              currentShiftDetailsSplit.startTime,
              currentShiftDetailsSplit.endTime,
              intervalRequireTime,
              shiftDetails._id,
              currentShiftDetailsSplit._id,
            );
          }

          if (intervalResult || isSplitInterval) {
            return {
              limit: true,
              status: 0,
              message:
                'Minimum interval between shift is not met. Kindly choose another shift with required interval.',
            };
          }
        }

        let isOt = false;

        if (
          schemeDetails.shiftSchemeType === 1 ||
          schemeDetails.shiftSchemeType === 3
        ) {
          let otDuration = 0;
          let normalDuration = 0;

          if (
            schemeDetails.shiftSetup.openShift &&
            schemeDetails.shiftSetup.openShift.normal
          ) {
            normalDuration = parseInt(shiftDetails.duration, 10);
          } else {
            isOt = true;
            otDuration = parseInt(shiftDetails.duration, 10);
          }

          if (shiftDetails.isExtendedShift) {
            let extendedStaff = shiftDetails.extendedStaff.filter(
              (item) => item.userId.toString() === userId.toString(),
            );

            if (extendedStaff.length > 0) {
              [extendedStaff] = extendedStaff;
              if (
                schemeDetails.shiftSetup.openShift &&
                schemeDetails.shiftSetup.openShift.normal
              ) {
                normalDuration = extendedStaff.duration;
              } else {
                otDuration = extendedStaff.duration;
              }
            }
          }

          const { weekNumber } = shiftDetails.shiftId;
          const date = new Date(shiftDetails.date);
          const y = date.getFullYear();
          const m = date.getMonth();
          const weekDays = {
            monday: 6,
            tuesday: 5,
            wednesday: 4,
            thursday: 3,
            friday: 2,
            saturday: 1,
            sunday: 0,
          };
          const startWeek = moment(`'${y}'`)
            .add(weekNumber, 'weeks')
            .startOf('isoweek');
          let firstDay = new Date(y, m, 1);
          let lastDay = new Date(y, m + 1, 0);
          const weekDay = moment(lastDay).format('dddd');

          lastDay = moment(lastDay)
            .add(weekDays[weekDay.toLowerCase()], 'days')
            .format('YYYY-MM-DDT23:59:59.000+00:00');
          if (!moment(firstDay).isBefore(startWeek)) {
            const inverseOffset = moment(startWeek).utcOffset() * -1;

            firstDay = moment().utcOffset(inverseOffset);
          }

          const data = await StaffLimit.find({
            userId,
            shiftDetailId: { $exists: true },
            date: {
              $lte: new Date(new Date(lastDay).toISOString()),
              $gte: new Date(new Date(firstDay).toISOString()),
            },
          }).lean();

          let dailyDuration = shiftDetails.duration;
          let weeklyDuration = shiftDetails.duration;
          let monthlyDuration = shiftDetails.duration;
          let dailyOverall = dailyDuration;
          let weekLlyOverall = dailyDuration;
          let monthlyOverall = dailyDuration;

          let isPresent = false;
          let shiftDuration = 0;
          let staffLimitPresentData = {};

          if (!isOt) {
            data.forEach((item) => {
              // daily calculation
              if (new Date(item.date).getDate() === new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() === shiftDetails._id.toString()
                ) {
                  shiftDuration = item.normalDuration;
                  isPresent = true;
                  staffLimitPresentData = item;
                }

                dailyDuration += item.normalDuration;
                dailyOverall += item.normalDuration;
                dailyOverall += item.otDuration;
              }

              // month calculation
              if (
                new Date(item.date).getMonth() === new Date(date).getMonth()
              ) {
                monthlyDuration += item.normalDuration;
                monthlyOverall += item.normalDuration;
                monthlyOverall += item.otDuration;
              }

              // week calculation
              if (item.weekNumber === weekNumber) {
                weeklyDuration += item.normalDuration;
                weekLlyOverall += item.normalDuration;
                weekLlyOverall += item.otDuration;
              }
            });
          } else {
            // ot hr
            data.forEach((item) => {
              if (new Date(item.date).getDate() === new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() === shiftDetails._id.toString()
                ) {
                  isPresent = true;
                  shiftDuration = item.otDuration + item.normalDuration;
                  staffLimitPresentData = item;
                }

                dailyDuration += item.otDuration;
                dailyOverall += item.otDuration;
                dailyOverall += item.normalDuration;
              }

              if (
                new Date(item.date).getMonth() === new Date(date).getMonth()
              ) {
                monthlyDuration += item.otDuration;
                monthlyOverall += item.otDuration;
                monthlyOverall += item.normalDuration;
              }

              if (item.weekNumber === weekNumber) {
                weeklyDuration += item.otDuration;
                weekLlyOverall += item.otDuration;
                weekLlyOverall += item.normalDuration;
              }
            });
          }

          let dayLimit = schemeDetails.shiftSetup.limits.normalHr.day;
          let weekLimit = schemeDetails.shiftSetup.limits.normalHr.week;
          let monthLimit = schemeDetails.shiftSetup.limits.normalHr.month;
          const dayOverallLimit = schemeDetails.shiftSetup.limits.dayOverall;
          const weekOverallLimit = schemeDetails.shiftSetup.limits.weekOverall;
          const monthOverallLimit =
            schemeDetails.shiftSetup.limits.monthOverall;

          let { disallow } = dayLimit;

          if (shiftDetails.isAssignShift) {
            disallow = !schemeDetails.shiftSetup.limits.otHr.day.disallow;
          }

          if (isOt) {
            dayLimit = schemeDetails.shiftSetup.limits.otHr.day;
            weekLimit = schemeDetails.shiftSetup.limits.otHr.week;
            monthLimit = schemeDetails.shiftSetup.limits.otHr.month;
          }

          if (
            parseInt(dayLimit.value, 10) &&
            parseInt(dayLimit.value, 10) < parseInt(dailyDuration, 10)
          ) {
            return {
              limit: true,
              message: 'Exceeds Daily limit',
              flag: 'day',
              details: dayLimit,
              status: disallow ? 0 : 1,
            }; // dayLimit.disallow?0:1
          }

          if (
            parseInt(weekLimit.value, 10) &&
            parseInt(weekLimit.value, 10) < parseInt(weeklyDuration, 10)
          ) {
            return {
              limit: true,
              message: 'Exceeds Weekly limit',
              flag: 'week',
              details: weekLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (
            parseInt(monthLimit.value, 10) &&
            parseInt(monthLimit.value, 10) < parseInt(monthlyDuration, 10)
          ) {
            return {
              limit: true,
              message: 'Exceeds Monthly limit',
              flag: 'month',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (
            parseInt(dayOverallLimit, 10) &&
            parseInt(dayOverallLimit, 10) < parseInt(dailyOverall, 10)
          ) {
            return {
              limit: true,
              message: 'Exceeds Daily Overall limit',
              flag: 'dayoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (
            parseInt(weekOverallLimit, 10) &&
            parseInt(weekOverallLimit, 10) < parseInt(weekLlyOverall, 10)
          ) {
            return {
              limit: true,
              message: 'Exceeds Weekly Overall limit',
              flag: 'weekoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (
            parseInt(monthOverallLimit, 10) &&
            parseInt(monthOverallLimit, 10) < parseInt(monthlyOverall, 10)
          ) {
            return {
              limit: true,
              message: 'Exceeds Monthly Overall limit',
              flag: 'monthoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (!isPresent) {
            const splitShiftData = await ShiftDetails.findOne({
              randomShiftId: shiftDetails.randomShiftId,
              isParent: 2,
            });
            const obj = {
              userId,
              shiftId: shiftDetails.shiftId._id,
              shiftDetailId: shiftDetails._id,
              date: shiftDetails.date,
              normalDuration,
              otDuration,
              weekNumber,
              businessUnitId: shiftDetails.shiftId.businessUnitId,
              startTime: shiftDetails.startTime,
              endTime: shiftDetails.endTime,
              splitStartTime: splitShiftData?.startTime
                ? splitShiftData.startTime
                : null,
              splitEndTime: splitShiftData?.endTime
                ? splitShiftData.endTime
                : null,
            };

            // add new
            const insertAppliedStaffs = await new StaffLimit(obj).save();

            if (shiftDetails.isSplitShift === false) {
              await StaffLimit.updateOne(
                { _id: insertAppliedStaffs._id },
                {
                  $unset: {
                    splitStartTime: 1,
                    splitEndTime: 1,
                  },
                },
              );
            }
          } else {
            // update
            if ((bookNewShift && shiftDuration === 0) || !bookNewShift) {
              await StaffLimit.findByIdAndUpdate(staffLimitPresentData._id, {
                $inc: {
                  normalDuration,
                  otDuration,
                },
              });
            }

            return { message: 'Shift Already Booked', booked: true };
          }

          return { limit: false, status: 1, message: '' };
        }

        return {
          limit: true,
          status: 0,
          message: "You don't have open shift scheme assign",
        }; // status 0 not allowed to create, 1 allowed to create
      }

      return {
        limit: true,
        status: 0,
        message: "You don't have open shift scheme assign",
      }; // status 0 not allowed to create, 1 allowed to create
    } catch (error) {
      return {
        limit: true,
        status: 0,
        message: 'Something went wrong',
      };
    }
  }

  async checkLimit(
    res,
    userId,
    shiftDetails,
    currentShiftDetailsSplit,
    bookNewShift = false,
  ) {
    try {
      let schemeDetails = await User.findById(userId, {
        schemeId: 1,
        _id: 0,
      }).populate([
        {
          path: 'schemeId',
          match: {
            status: true,
          },
        },
      ]);

      if (schemeDetails.schemeId) {
        schemeDetails = schemeDetails.schemeId;

        // check cutOffDaysForBookingAndCancelling
        const subSectionForBU = await SubSection.findOne({
          _id: shiftDetails.shiftId.businessUnitId,
        }).lean();

        if (subSectionForBU.cutOffDaysForBookingAndCancelling) {
          if (subSectionForBU.cutOffDaysForBookingAndCancelling > 0) {
            const a = shiftDetails.timeZone;
            const hr = a[1] + a[2];
            const min = a[3] + a[4];
            const min1 = parseInt(hr, 10) * 60 + parseInt(min, 10);
            const newStartTime = moment(shiftDetails.startTime).add(
              min1,
              'minutes',
            );
            const currTime = moment().add(min1, 'minutes');
            const shiftStartTime = moment(newStartTime).format('LL');
            const currentTime = moment(currTime).format('LL');

            const hoursLeftToStartShift = __.getDurationInHours(
              currentTime,
              shiftStartTime,
            );

            const days = (hoursLeftToStartShift / 24).toFixed(0); // in days

            const shiftExactStartTime = moment(newStartTime);
            const currentExactTime = moment();

            const exactHoursLeftToStartShift = __.getDurationInHours(
              currentExactTime,
              shiftExactStartTime,
            );

            if (
              subSectionForBU.cutOffDaysForBookingAndCancelling >
                parseInt(days, 10) &&
              parseInt(exactHoursLeftToStartShift, 10) > 0
            ) {
              return {
                limit: true,
                status: 0,
                message:
                  'You cannot book this shift as it falls within the cut-off time.',
              };
            }
          }
        }

        // check if shift interval is require
        if (schemeDetails.isShiftInterval) {
          const intervalRequireTime = schemeDetails.shiftIntervalTotal - 1;
          const intervalResult = await ShiftHelper.checkShiftInterval(
            userId,
            shiftDetails.startTime,
            shiftDetails.endTime,
            intervalRequireTime,
          );
          let isSplitInterval = false;

          if (currentShiftDetailsSplit) {
            isSplitInterval = await ShiftHelper.checkShiftInterval(
              userId,
              currentShiftDetailsSplit.startTime,
              currentShiftDetailsSplit.endTime,
              intervalRequireTime,
            );
          }

          if (intervalResult || isSplitInterval) {
            return { isInterval: true };
          }
        }

        let isOt = false;

        if (
          schemeDetails.shiftSchemeType === 1 ||
          schemeDetails.shiftSchemeType === 3
        ) {
          let otDuration = 0;
          let normalDuration = 0;

          if (
            schemeDetails.shiftSetup.openShift &&
            schemeDetails.shiftSetup.openShift.normal
          ) {
            normalDuration = parseInt(shiftDetails.duration, 10);
          } else {
            isOt = true;
            otDuration = parseInt(shiftDetails.duration, 10);
          }

          if (shiftDetails.isExtendedShift) {
            let extendedStaff = shiftDetails.extendedStaff.filter(
              (item) => item.userId.toString() === userId.toString(),
            );

            if (extendedStaff.length > 0) {
              [extendedStaff] = extendedStaff;
              if (
                schemeDetails.shiftSetup.openShift &&
                schemeDetails.shiftSetup.openShift.normal
              ) {
                normalDuration = extendedStaff.duration;
              } else {
                otDuration = extendedStaff.duration;
              }
            }
          }

          const { weekNumber } = shiftDetails.shiftId;
          const date = new Date(shiftDetails.date);
          const y = date.getFullYear();
          const m = date.getMonth();
          const weekDays = {
            monday: 6,
            tuesday: 5,
            wednesday: 4,
            thursday: 3,
            friday: 2,
            saturday: 1,
            sunday: 0,
          };
          const startWeek = moment(`'${y}'`)
            .add(weekNumber, 'weeks')
            .startOf('isoweek');
          let firstDay = new Date(y, m, 1);
          let lastDay = new Date(y, m + 1, 0);
          const weekDay = moment(lastDay).format('dddd');

          lastDay = moment(lastDay)
            .add(weekDays[weekDay.toLowerCase()], 'days')
            .format('YYYY-MM-DDT23:59:59.000+00:00');
          if (!moment(firstDay).isBefore(startWeek)) {
            const inverseOffset = moment(startWeek).utcOffset() * -1;

            firstDay = moment().utcOffset(inverseOffset);
          }

          const data = await StaffLimit.find({
            userId,
            shiftDetailId: { $exists: true },
            date: {
              $lte: new Date(new Date(lastDay).toISOString()),
              $gte: new Date(new Date(firstDay).toISOString()),
            },
          }).lean();
          let dailyDuration = shiftDetails.duration;
          let weeklyDuration = shiftDetails.duration;
          let monthlyDuration = shiftDetails.duration;
          let dailyOverall = dailyDuration;
          let weekLlyOverall = dailyDuration;
          let monthlyOverall = dailyDuration;

          let isPresent = false;
          let shiftDuration = 0;
          let staffLimitPresentData = {};

          if (!isOt) {
            data.forEach((item) => {
              if (new Date(item.date).getDate() === new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() === shiftDetails._id.toString()
                ) {
                  shiftDuration = item.normalDuration;
                  isPresent = true;
                  staffLimitPresentData = item;
                }

                dailyDuration += item.normalDuration;
                dailyOverall += item.normalDuration;
                dailyOverall += item.otDuration;
              }

              if (
                new Date(item.date).getMonth() === new Date(date).getMonth()
              ) {
                monthlyDuration += item.normalDuration;
                monthlyOverall += item.normalDuration;
                monthlyOverall += item.otDuration;
              }

              if (item.weekNumber === weekNumber) {
                weeklyDuration += item.normalDuration;
                weekLlyOverall += item.normalDuration;
                weekLlyOverall += item.otDuration;
              }
            });
          } else {
            // ot hr
            data.forEach((item) => {
              if (new Date(item.date).getDate() === new Date(date).getDate()) {
                if (
                  item.shiftDetailId.toString() === shiftDetails._id.toString()
                ) {
                  isPresent = true;
                  shiftDuration = item.otDuration + item.normalDuration;
                  staffLimitPresentData = item;
                }

                dailyDuration += item.otDuration;
                dailyOverall += item.otDuration;
                dailyOverall += item.normalDuration;
              }

              if (
                new Date(item.date).getMonth() === new Date(date).getMonth()
              ) {
                monthlyDuration += item.otDuration;
                monthlyOverall += item.otDuration;
                monthlyOverall += item.normalDuration;
              }

              if (item.weekNumber === weekNumber) {
                weeklyDuration += item.otDuration;
                weekLlyOverall += item.otDuration;
                weekLlyOverall += item.normalDuration;
              }
            });
          }

          let dayLimit = schemeDetails.shiftSetup.limits.normalHr.day;
          let weekLimit = schemeDetails.shiftSetup.limits.normalHr.week;
          let monthLimit = schemeDetails.shiftSetup.limits.normalHr.month;
          const dayOverallLimit = schemeDetails.shiftSetup.limits.dayOverall;
          const weekOverallLimit = schemeDetails.shiftSetup.limits.weekOverall;
          const monthOverallLimit =
            schemeDetails.shiftSetup.limits.monthOverall;
          let isAllow = dayLimit.alert;
          let { disallow } = dayLimit;

          if (shiftDetails.isAssignShift) {
            isAllow = !schemeDetails.shiftSetup.limits.otHr.day.alert;
            disallow = !schemeDetails.shiftSetup.limits.otHr.day.disallow;
          }

          if (isOt) {
            dayLimit = schemeDetails.shiftSetup.limits.otHr.day;
            weekLimit = schemeDetails.shiftSetup.limits.otHr.week;
            monthLimit = schemeDetails.shiftSetup.limits.otHr.month;
          }

          // add data to staff Limit
          if (!isPresent) {
            const obj = {
              userId,
              shiftId: shiftDetails.shiftId._id,
              shiftDetailId: shiftDetails._id,
              date: shiftDetails.date,
              normalDuration,
              otDuration,
              weekNumber,
              businessUnitId: shiftDetails.shiftId.businessUnitId,
            };

            await new StaffLimit(obj).save();
            // add new
          } else {
            // update
            if ((bookNewShift && shiftDuration === 0) || !bookNewShift) {
              await StaffLimit.findByIdAndUpdate(staffLimitPresentData._id, {
                $inc: {
                  normalDuration,
                  otDuration,
                },
              });
            }

            return { message: 'Shift Already Booked', booked: true };
          }

          if (
            parseInt(dayLimit.value, 10) &&
            parseInt(dayLimit.value, 10) < parseInt(dailyDuration, 10)
          ) {
            if (!isAllow) {
              await this.reduceLimit(res, userId, shiftDetails);
            }

            return {
              limit: true,
              message: 'Exceeds Daily limit',
              flag: 'day',
              details: dayLimit,
              status: disallow ? 0 : 1,
            }; // dayLimit.disallow?0:1
          }

          if (
            parseInt(weekLimit.value, 10) &&
            parseInt(weekLimit.value, 10) < parseInt(weeklyDuration, 10)
          ) {
            if (!isAllow) {
              await this.reduceLimit(res, userId, shiftDetails);
            }

            return {
              limit: true,
              message: 'Exceeds Weekly limit',
              flag: 'week',
              details: weekLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (
            parseInt(monthLimit.value, 10) &&
            parseInt(monthLimit.value, 10) < parseInt(monthlyDuration, 10)
          ) {
            if (!isAllow) {
              await this.reduceLimit(res, userId, shiftDetails);
            }

            return {
              limit: true,
              message: 'Exceeds Monthly limit',
              flag: 'month',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (
            parseInt(dayOverallLimit, 10) &&
            parseInt(dayOverallLimit, 10) < parseInt(dailyOverall, 10)
          ) {
            if (!isAllow) {
              await this.reduceLimit(res, userId, shiftDetails);
            }

            return {
              limit: true,
              message: 'Exceeds Daily Overall limit',
              flag: 'dayoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (
            parseInt(weekOverallLimit, 10) &&
            parseInt(weekOverallLimit, 10) < parseInt(weekLlyOverall, 10)
          ) {
            if (!isAllow) {
              await this.reduceLimit(res, userId, shiftDetails);
            }

            return {
              limit: true,
              message: 'Exceeds Weekly Overall limit',
              flag: 'weekoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

          if (
            parseInt(monthOverallLimit, 10) &&
            parseInt(monthOverallLimit, 10) < parseInt(monthlyOverall, 10)
          ) {
            if (!isAllow) {
              await this.reduceLimit(res, userId, shiftDetails);
            }

            return {
              limit: true,
              message: 'Exceeds Monthly Overall limit',
              flag: 'monthoverall',
              details: monthLimit,
              status: disallow ? 0 : 1,
            };
          }

          return { limit: false, status: 1, message: '' };
        }

        return {
          limit: true,
          status: 0,
          message: "You don't have open shift scheme assign",
        }; // status 0 not allowed to create, 1 allowed to create
      }

      return {
        limit: true,
        status: 0,
        message: "You don't have open shift scheme assign",
      }; // status 0 not allowed to create, 1 allowed to create
    } catch (error) {
      return __.out(res, 300, 'Something went wrong');
    }
  }

  async checkLimitBeforeBooking(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo('staffshift/checklimit API Start!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (req.body.from === 'makebooking') {
        return this.makeBookingNew(req, res);
      }

      let userId;

      if (req.body.userId) {
        userId = req.body.userId;
      } else {
        userId = req.user._id;
      }

      const shiftDetailId = req.body.shiftDetailsId;

      const shiftDetails = await ShiftDetails.findOne({ _id: shiftDetailId })
        .populate([
          {
            path: 'shiftId',
            select: 'weekNumber businessUnitId',
          },
        ])
        .lean();

      if (!shiftDetails) {
        logError(`staffshift/checklimit API, Shift Not found`, req.body);
        return res
          .status(201)
          .json({ limit: true, message: 'Shift Not found' });
      }

      let currentShiftDetailsSplit = null;

      if (req.body.isSplitShift) {
        currentShiftDetailsSplit = await ShiftDetails.findOne({
          _id: req.body.splitShiftDetailsId,
          status: 1,
          startTime: {
            $gt: moment().utc().format(),
          },
        }).lean();
        if (!currentShiftDetailsSplit) {
          logError(`staffshift/checklimit API, Shift Not found`, req.body);
          return res
            .status(201)
            .json({ limit: true, message: 'Shift Not found' });
        }

        shiftDetails.duration += currentShiftDetailsSplit.duration;
      }

      let limitData = {
        status: 1,
        limit: false,
      };

      limitData = await this.checkLimit(
        res,
        userId,
        shiftDetails,
        currentShiftDetailsSplit,
        true,
      );
      if (limitData && limitData.isInterval) {
        logError(
          `staffshift/checklimit API, 'Minimum interval between shift is not met. Kindly choose another shift with required interval.'`,
          limitData,
        );
        return __.out(
          res,
          300,
          'Minimum interval between shift is not met. Kindly choose another shift with required interval.',
        );
      }

      if (limitData.limit) {
        if (!limitData.status) {
          logInfo('staffshift/checklimit API ends here!', {
            name: req.user.name,
            staffId: req.user.staffId,
          });
          return res
            .status(201)
            .json({ limit: true, status: 0, message: limitData.message });
        }

        logInfo('staffshift/checklimit API ends here!', {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return res
          .status(201)
          .json({ limit: true, status: 1, message: limitData.message });
      }

      if (req.body.from === 'makebooking' && !limitData.booked) {
        return this.makeBooking(req, res);
      }

      if (req.body.from === 'makebooking' && limitData.booked) {
        logError(
          `staffshift/checklimit API, 'You have already booked this shift.'`,
          limitData,
        );
        return res.status(201).json({
          limit: true,
          message: 'You have already booked this shift.',
        });
      }

      if (
        req.body.from.toLowerCase() === 'responseconfirmslotrequestaftercancel'
      ) {
        return this.responseConfirmSlotRequestAfterCancel(req, res);
      }

      if (
        req.body.from.toLowerCase() === 'responseconfirmslotrequestafteradjust'
      ) {
        return this.responseConfirmSlotRequestAfterAdjust(req, res);
      }

      if (req.body.from.toLowerCase() === 'responsefornewshiftrequest') {
        return this.responseForNewShiftRequest(req, res);
      }

      logError(`staffshift/checklimit API, 'missing parameter from'`, req.body);
      return res
        .status(201)
        .json({ limit: true, message: 'missing parameter from' });
    } catch (error) {
      logError(`shift/create API, there is an error`, error.toString());
      return __.out(res, 500, 'Something went wrong');
    }
  }

  async reduceLimitAfterAlert(req, res) {
    try {
      let userId;

      if (req.body.userId) {
        userId = req.body.userId;
      } else {
        userId = req.user._id;
      }

      const shiftDetailId = req.body.shiftDetailsId;
      const shiftDetails = await ShiftDetails.findOne({ _id: shiftDetailId })
        .populate([
          {
            path: 'shiftId',
            select: 'weekNumber businessUnitId',
          },
        ])
        .lean();

      const value = await this.reduceLimit(res, userId, shiftDetails);

      return res
        .status(201)
        .json({ success: true, message: 'Successfully updated', value });
    } catch (error) {
      return __.out(res, 500, 'Something went wrong');
    }
  }

  async cancel(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo('staffshift/cancel API Start!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (req.body.isSplitShift) {
        return this.cancelSplitShift(req, res);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
      ]);

      if (requiredResult.status === false) {
        logError(
          `staffshift/cancel API, You've entered malicious input `,
          req.body,
        );
        logError(
          `staffshift/cancel API, Required fields missing `,
          requiredResult.missingFields,
        );
        return __.out(res, 400, requiredResult.missingFields);
      }

      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(req.body.shiftDetailsId)) {
        logError(`staffshift/cancel API, 'Invalid Shift Id'`, req.body);
        return __.out(res, 300, 'Invalid Shift Id');
      }

      const shiftDetails = await ShiftDetails.findOne({
        _id: req.body.shiftDetailsId,
        status: 1,
        startTime: {
          $gt: moment().utc().format(),
        },
        $or: [
          {
            confirmedStaffs: req.user._id,
          },
          {
            backUpStaffs: req.user._id,
          },
        ],
      }).populate([
        {
          path: 'appliedStaffs',
          match: {
            status: 2,
          },
          options: {
            sort: {
              createdAt: 1,
            },
          },
          populate: {
            path: 'flexiStaff',
            select: 'deviceToken',
          },
        },
        {
          path: 'shiftId',
          select: 'weekNumber businessUnitId',
        },
      ]);

      if (!shiftDetails) {
        logError(
          `staffshift/cancel API, 'Invalid Shift / Shift Expired'`,
          req.body,
        );
        return __.out(res, 300, 'Invalid Shift / Shift Expired');
      }

      const subSectionForBU = await SubSection.findOne({
        _id: shiftDetails.shiftId.businessUnitId,
      }).lean();

      if (subSectionForBU.cutOffDaysForBookingAndCancelling) {
        if (subSectionForBU.cutOffDaysForBookingAndCancelling > 0) {
          const a = shiftDetails.timeZone;
          const hr = a[1] + a[2];
          const min = a[3] + a[4];
          const min1 = parseInt(hr, 10) * 60 + parseInt(min, 10);
          const newStartTime = moment(shiftDetails.startTime).add(
            min1,
            'minutes',
          );
          const currTime = moment().add(min1, 'minutes');
          const shiftStartTime = moment(newStartTime).format('LL');
          const currentTime = moment(currTime).format('LL');

          const hoursLeftToStartShift = __.getDurationInHours(
            currentTime,
            shiftStartTime,
          );
          const days = (hoursLeftToStartShift / 24).toFixed(0); // in days

          if (
            subSectionForBU.cutOffDaysForBookingAndCancelling >
            parseInt(days, 10)
          ) {
            logError(
              `staffshift/cancel API, 'You cannot cancel this shift as it falls within the cut-off time.'`,
              req.body,
            );
            return __.out(
              res,
              300,
              'You cannot cancel this shift as it falls within the cut-off time.',
            );
          }
        }
      }

      // reduce duration

      // Get Shift Main Details ( Shift Collection )
      const shiftMainDetails = await Shift.findOne({
        _id: shiftDetails.shiftId,
      })
        .populate({
          path: 'businessUnitId',
        })
        .lean();

      const shiftStartsWithInMinutes = (
        __.getDurationInHours(moment().utc().format(), shiftDetails.startTime) *
        60
      ).toFixed(2);
      const updateJson = {
        $push: {
          cancelledBy: {
            otherReason: req.body.otherReason,
            cancelledUserId: req.user._id,
            minutesToShiftStartTime: shiftStartsWithInMinutes,
            createdAt: moment().utc().format(),
          },
        },
      };

      const logMetaData = await Shift.findOne({
        _id: shiftDetails.shiftId,
      })
        .select(
          'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
        )
        .lean();

      /* Add to log */
      const statusLogData = {
        userId: req.user._id,
        status: 0,
        /* shift created */
        shiftId: shiftDetails.shiftId,
        weekRangeStartsAt: logMetaData.weekRangeStartsAt,
        weekRangeEndsAt: logMetaData.weekRangeEndsAt,
        weekNumber: logMetaData.weekNumber,
        businessUnitId: logMetaData.businessUnitId,
        existingShift: shiftDetails._id,
      };

      if (
        shiftDetails.confirmedStaffs.some(
          (x) => x.toString() === req.user._id.toString(),
        )
      ) {
        const [appliedStaffIdToRemove] = await Promise.all([
          this.reduceLimit(res, userId, shiftDetails),
          AppliedStaffs.findOneAndRemove({
            flexiStaff: req.user._id,
            shiftDetailsId: req.body.shiftDetailsId,
          }).lean(),
        ]);

        if (!appliedStaffIdToRemove) {
          return __.out(res, 300, 'Invalid Shift Id');
        }

        updateJson.$pull = {
          confirmedStaffs: req.user._id,
          appliedStaffs: appliedStaffIdToRemove._id,
        };
        if (shiftDetails.isExtendedShift) {
          updateJson.$pull = {
            extendedStaff: { userId: req.user._id },
            confirmedStaffs: req.user._id,
            appliedStaffs: appliedStaffIdToRemove._id,
          };
        }

        const clonedShiftDetails = _.cloneDeep(shiftDetails);
        let deviceTokens = [];

        if (shiftDetails.appliedStaffs.length > 0) {
          const shiftStartsWithIn = __.getDurationInHours(
            moment().utc().format(),
            shiftDetails.startTime,
          );
          let shiftCancelHours = process.env.CANCELLATION_SHIFT_CHECK_HOURS;

          if (shiftMainDetails.businessUnitId.shiftCancelHours) {
            shiftCancelHours = shiftMainDetails.businessUnitId.shiftCancelHours;
          }

          if (Number(shiftStartsWithIn) >= Number(shiftCancelHours)) {
            __.log('am greater than 12 hr');
            /* if shift start time greater or equal to custom number then confirm the stand by staff who applied first */
            // here apply limit logic
            const appliedStaffId = shiftDetails.appliedStaffs[0]._id;
            const firstStandByUserId =
              shiftDetails.appliedStaffs[0].flexiStaff._id;

            if (firstStandByUserId) {
              updateJson.$pull.backUpStaffs =
                mongoose.Types.ObjectId(firstStandByUserId);
              deviceTokens = [
                shiftDetails.appliedStaffs[0].flexiStaff.deviceToken,
              ];
              await Promise.all([
                AppliedStaffs.update(
                  {
                    _id: appliedStaffId,
                  },
                  {
                    $set: {
                      status: 1,
                    },
                  },
                ),
                ShiftDetails.findOneAndUpdate(
                  {
                    _id: req.body.shiftDetailsId,
                  },
                  {
                    $addToSet: {
                      confirmedStaffs: firstStandByUserId,
                    },
                  },
                ),
              ]);

              if (deviceTokens && deviceTokens.length > 0) {
                const pushData = {
                  title: 'You are activated!',
                  body: `Standby shift has been activated`,
                  bodyText: `Standby shift on XXX to XXX has been activated`,
                  bodyTime: [
                    shiftDetails.startTimeInSeconds,
                    shiftDetails.endTimeInSeconds,
                  ],
                  bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                };
                const collapseKey =
                  req.body
                    .shiftDetailsId; /* unique id for this particular shift */

                FCM.push(deviceTokens, pushData, collapseKey);
                deviceTokens = [];
              }
            }
          } else {
            /* if shift start time less than custom number then send notification to all standby staffs to confirm */
            __.log('am lesser than 12 hr');
            // no need to check limit as confirmation is required
            updateJson.$set = {
              isShortTimeCancel: 1,
              shortTimeRequestRecjectedFlexistaffs: [],
            };

            deviceTokens = shiftDetails.appliedStaffs.map(
              (a) => a.flexiStaff.deviceToken,
            );
            if (deviceTokens && deviceTokens.length > 0) {
              const pushData = {
                title: 'Confirm your standby shift now!',
                body: `Standby shift is available for confirmation`,
                bodyText: `Standby shift on XXX to XXX is available for confirmation`,
                bodyTime: [
                  shiftDetails.startTimeInSeconds,
                  shiftDetails.endTimeInSeconds,
                ],
                bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
              };
              const collapseKey =
                req.body
                  .shiftDetailsId; /* unique id for this particular shift */

              FCM.push(deviceTokens, pushData, collapseKey);
              deviceTokens = [];
            }
          }
        } else {
          __.log('clonedShiftDetails', clonedShiftDetails);
          // no need to check limit as confirmation is required
          const pageSettingData = await PageSettingModel.findOne(
            {
              companyId: req.user.companyId,
              status: 1,
            },
            { opsGroup: 1 },
          );
          const { tierType } = pageSettingData.opsGroup;

          this.matchingStaffs(clonedShiftDetails, res, tierType)
            .then((deviceTokensR) => {
              deviceTokens = deviceTokensR;
              if (deviceTokens && deviceTokens.length > 0) {
                const pushData = {
                  title: 'Immediate shift for Booking!',
                  body: `Shift is available for booking`,
                  bodyText: `Standby shift on XXX to XXX is available for booking`,
                  bodyTime: [
                    shiftDetails.startTimeInSeconds,
                    shiftDetails.endTimeInSeconds,
                  ],
                  bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                };
                const collapseKey =
                  req.body
                    .shiftDetailsId; /* unique id for this particular shift */

                FCM.push(deviceTokens, pushData, collapseKey);
                deviceTokens = [];
              }
            })
            .catch((deviceTokensError) => {
              logError(
                `staffshift/cancel API, there is an error`,
                deviceTokensError,
              );
            });
        }

        await ShiftDetails.findOneAndUpdate(
          { _id: req.body.shiftDetailsId },
          updateJson,
        );
        /* Create Shift Log */
        statusLogData.status = 20;
        await shiftLogController.create(statusLogData, res);
        logInfo(
          `staffshift/cancel API 'Booking (confirmed) has been cancelled successfully' api ends here!`,
          { name: req.user.name, staffId: req.user.staffId },
        );
        return __.out(
          res,
          201,
          'Booking (confirmed) has been cancelled successfully',
        );
      }

      if (
        shiftDetails.backUpStaffs.some(
          (x) => x.toString() === req.user._id.toString(),
        )
      ) {
        /* if backup staff us there (take the one who applied first by date) */
        // no need to check limit as we are cancelling standby
        /* set cancel user flag in applied staff  */
        const [appliedStaffIdToRemove] = await Promise.all([
          AppliedStaffs.findOneAndRemove({
            flexiStaff: req.user._id,
            shiftDetailsId: req.body.shiftDetailsId,
          }).lean(),
          this.reduceLimit(res, userId, shiftDetails),
        ]);

        updateJson.$pull = {
          backUpStaffs: req.user._id,
          appliedStaffs: appliedStaffIdToRemove._id,
        };
        await ShiftDetails.findOneAndUpdate(
          { _id: req.body.shiftDetailsId },
          updateJson,
        );
        statusLogData.status = 21;
        await shiftLogController.create(statusLogData, res);
        logInfo(
          `staffshift/cancel API 'Booking (standby) has been cancelled successfully' api ends here!`,
          { name: req.user.name, staffId: req.user.staffId },
        );
        return __.out(
          res,
          201,
          'Booking (standby) has been cancelled successfully',
        );
      }

      /* user id not found either in confirmed staff or backuped staff */
      logError(`staffshift/cancel API`, 'Something went wrong');
      return __.out(res, 300, 'Something went wrong');
    } catch (err) {
      logError(`staffshift/cancel API, there is an error`, err.toString());
      return __.out(res, 500);
    }
  }

  async reduceLimit(res, userId, shiftDetails, from = 1) {
    try {
      let schemeDetails = await User.findOne({ _id: userId }).populate([
        {
          path: 'schemeId',
        },
      ]);

      schemeDetails = schemeDetails.schemeId;
      if (!from) {
        shiftDetails = await ShiftDetails.findOne({ _id: shiftDetails })
          .populate([
            {
              path: 'shiftId',
              select: 'weekNumber businessUnitId',
            },
          ])
          .lean();
      }

      let otDuration = 0;
      let normalDuration = 0;

      if (
        schemeDetails.shiftSetup.openShift &&
        schemeDetails.shiftSetup.openShift.normal
      ) {
        normalDuration = 0;
      } else {
        otDuration = 0;
      }

      let value;

      if (shiftDetails.isRequested) {
        value = await StaffLimit.findOneAndUpdate(
          { userId, childShiftId: shiftDetails._id },
          { normalDuration, otDuration },
        );
      } else
        value = await StaffLimit.findOneAndUpdate(
          { userId, shiftDetailId: shiftDetails._id },
          { normalDuration, otDuration },
        );

      return value;
    } catch (error) {
      __.log(error);
      return __.out(error, 500);
    }
  }

  async cancelSplitShift(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isMedicalReason',
        'otherReason',
      ]);

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else if (
        mongoose.Types.ObjectId.isValid(req.body.shiftDetailsId) &&
        mongoose.Types.ObjectId.isValid(req.body.splitShiftDetailsId)
      ) {
        const userId = req.user._id;
        const shiftDetails = await ShiftDetails.findOne({
          _id: req.body.shiftDetailsId,
          status: 1,
          startTime: {
            $gt: moment().utc().format(),
          },
          $or: [
            {
              confirmedStaffs: req.user._id,
            },
            {
              backUpStaffs: req.user._id,
            },
          ],
        })

          .populate([
            {
              path: 'appliedStaffs',
              match: {
                status: 2,
              },
              options: {
                sort: {
                  createdAt: 1,
                },
              },
              populate: {
                path: 'flexiStaff',
                select: 'deviceToken',
              },
            },
            {
              path: 'shiftId',
              select: 'weekNumber businessUnitId',
            },
          ])
          .lean();

        const shiftDetailsSplit = await ShiftDetails.findOne({
          _id: req.body.splitShiftDetailsId,
          status: 1,
          startTime: {
            $gt: moment().utc().format(),
          },
          $or: [
            {
              confirmedStaffs: req.user._id,
            },
            {
              backUpStaffs: req.user._id,
            },
          ],
        })
          .populate({
            path: 'appliedStaffs',
            match: {
              status: 2,
            },
            options: {
              sort: {
                createdAt: 1,
              },
            },
            populate: {
              path: 'flexiStaff',
              select: 'deviceToken',
            },
          })
          .lean();

        if (shiftDetails && shiftDetailsSplit) {
          // check cutOffDaysForBookingAndCancelling
          const subSectionForBU = await SubSection.findOne({
            _id: shiftDetails.shiftId.businessUnitId,
          }).lean();

          if (subSectionForBU.cutOffDaysForBookingAndCancelling) {
            if (subSectionForBU.cutOffDaysForBookingAndCancelling > 0) {
              const a = shiftDetails.timeZone;
              const hr = a[1] + a[2];
              const min = a[3] + a[4];
              const min1 = parseInt(hr, 10) * 60 + parseInt(min, 10);
              const newStartTime = moment(shiftDetails.startTime).add(
                min1,
                'minutes',
              );
              const currTime = moment().add(min1, 'minutes');
              const shiftStartTime = moment(newStartTime).format('LL');
              const currentTime = moment(currTime).format('LL');

              const hoursLeftToStartShift = __.getDurationInHours(
                currentTime,
                shiftStartTime,
              );

              const days = (hoursLeftToStartShift / 24).toFixed(0); // in days

              if (
                subSectionForBU.cutOffDaysForBookingAndCancelling >
                parseInt(days, 10)
              ) {
                return __.out(
                  res,
                  300,
                  'You cannot cancel this shift as it falls within the cut-off time.',
                );
              }
            }
          }

          // Get Shift Main Details ( Shift Collection )
          shiftDetails.duration += shiftDetailsSplit.duration;
          const shiftMainDetails = await Shift.findOne({
            _id: shiftDetails.shiftId,
          })
            .populate({
              path: 'businessUnitId',
            })
            .lean();

          __.log(shiftMainDetails, 'shiftDetails.shiftId');

          const shiftStartsWithInMinutes = await (
            __.getDurationInHours(
              moment().utc().format(),
              shiftDetails.startTime,
            ) * 60
          ).toFixed(2);

          const updateJson = {
            $push: {
              cancelledBy: {
                otherReason: req.body.otherReason,
                cancelledUserId: req.user._id,
                minutesToShiftStartTime: shiftStartsWithInMinutes,
                createdAt: moment().utc().format(),
              },
            },
          };
          const updateJsonSplit = {
            $push: {
              cancelledBy: {
                isMedicalReason: req.body.isMedicalReason,
                otherReason: req.body.otherReason,
                cancelledUserId: req.user._id,
                minutesToShiftStartTime: shiftStartsWithInMinutes,
                createdAt: moment().utc().format(),
              },
            },
          };

          if (
            shiftDetails.confirmedStaffs.some(
              (x) => x.toString() === req.user._id.toString(),
            )
          ) {
            /* includes like in_array */ /* set cancel user flag in applied staff  */
            await this.reduceLimit(res, userId, shiftDetails);
            const appliedStaffIdToRemove = await AppliedStaffs.findOne({
              flexiStaff: req.user._id,
              shiftDetailsId: req.body.shiftDetailsId,
            }).lean();
            const appliedStaffIdToRemoveSplit = await AppliedStaffs.findOne({
              flexiStaff: req.user._id,
              shiftDetailsId: req.body.splitShiftDetailsId,
            }).lean();

            if (appliedStaffIdToRemove && appliedStaffIdToRemoveSplit) {
              updateJson.$pull = {
                confirmedStaffs: req.user._id,
                appliedStaffs: appliedStaffIdToRemove._id,
              };
              updateJsonSplit.$pull = {
                confirmedStaffs: req.user._id,
                appliedStaffs: appliedStaffIdToRemoveSplit._id,
              };
              await AppliedStaffs.remove({
                _id: appliedStaffIdToRemove._id,
              });
              await AppliedStaffs.remove({
                _id: appliedStaffIdToRemoveSplit._id,
              });
            } else {
              return __.out(res, 300, 'Invalid Shift Id');
            }

            const clonedShiftDetails = _.cloneDeep(shiftDetails);
            let deviceTokens = [];

            if (shiftDetails.appliedStaffs.length > 0) {
              const shiftStartsWithIn = __.getDurationInHours(
                moment().utc().format(),
                shiftDetails.startTime,
              );
              let shiftCancelHours = process.env.CANCELLATION_SHIFT_CHECK_HOURS;

              if (shiftMainDetails.businessUnitId.shiftCancelHours) {
                shiftCancelHours =
                  shiftMainDetails.businessUnitId.shiftCancelHours;
              }

              if (Number(shiftStartsWithIn) >= Number(shiftCancelHours)) {
                __.log('am greater than 12 hr');
                /* if shift start time greater or equal to custom number then confirm the stand by staff who applied first */
                const appliedStaffId = shiftDetails.appliedStaffs[0]._id;
                const appliedStaffIdSplit =
                  shiftDetailsSplit.appliedStaffs[0]._id;
                const firstStandByUserId =
                  shiftDetails.appliedStaffs[0].flexiStaff._id;
                const firstStandByUserIdSplit =
                  shiftDetailsSplit.appliedStaffs[0].flexiStaff._id;

                if (firstStandByUserId) {
                  updateJson.$pull.backUpStaffs =
                    mongoose.Types.ObjectId(firstStandByUserId);
                  updateJsonSplit.$pull.backUpStaffs = mongoose.Types.ObjectId(
                    firstStandByUserIdSplit,
                  );
                  deviceTokens = [
                    shiftDetails.appliedStaffs[0].flexiStaff.deviceToken,
                  ];
                  await AppliedStaffs.update(
                    {
                      _id: appliedStaffId,
                    },
                    {
                      $set: {
                        status: 1,
                      },
                    },
                  );
                  await AppliedStaffs.update(
                    {
                      _id: appliedStaffIdSplit,
                    },
                    {
                      $set: {
                        status: 1,
                      },
                    },
                  );

                  /* seperate update operation since we cant push and pull for same property at same time */
                  await ShiftDetails.update(
                    {
                      _id: req.body.shiftDetailsId,
                    },
                    {
                      $addToSet: {
                        confirmedStaffs: firstStandByUserId,
                      },
                    },
                  );
                  await ShiftDetails.update(
                    {
                      _id: req.body.splitShiftDetailsId,
                    },
                    {
                      $addToSet: {
                        confirmedStaffs: firstStandByUserIdSplit,
                      },
                    },
                  );

                  /* push notification for newly confirmed user */
                  if (deviceTokens && deviceTokens.length > 0) {
                    const pushData = {
                      title: 'You are activated!',
                      body: `Standby Split shift has been activated`,
                      bodyText: `Standby shift on XXX to XXX has been activated`,
                      bodyTime: [
                        shiftDetails.startTimeInSeconds,
                        shiftDetailsSplit.endTimeInSeconds,
                      ],
                      bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                    };
                    const collapseKey =
                      req.body
                        .shiftDetailsId; /* unique id for this particular shift */

                    FCM.push(deviceTokens, pushData, collapseKey);
                    deviceTokens = [];
                  }
                }
              } else {
                /* if shift start time less than custom number then send notification to all standby staffs to confirm */
                __.log('am lesser than 12 hr');
                updateJson.$set = {
                  isShortTimeCancel: 1,
                  shortTimeRequestRecjectedFlexistaffs: [],
                };
                updateJsonSplit.$set = {
                  isShortTimeCancel: 1,
                  shortTimeRequestRecjectedFlexistaffs: [],
                };

                deviceTokens = shiftDetails.appliedStaffs.map(
                  (a) => a.flexiStaff.deviceToken,
                );
                if (deviceTokens && deviceTokens.length > 0) {
                  const pushData = {
                    title: 'Confirm your standby split shift now!',
                    body: `Standby Split shift is available for confirmation`,
                    bodyText: `Standby split shift on XXX to XXX is available for confirmation`,
                    bodyTime: [
                      shiftDetails.startTimeInSeconds,
                      shiftDetailsSplit.endTimeInSeconds,
                    ],
                    bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                  };
                  const collapseKey =
                    req.body
                      .shiftDetailsId; /* unique id for this particular shift */

                  FCM.push(deviceTokens, pushData, collapseKey);
                  deviceTokens = [];
                }
              }
            } else {
              __.log('clonedShiftDetails', clonedShiftDetails);
              const pageSettingData = await PageSettingModel.findOne(
                {
                  companyId: req.user.companyId,
                  status: 1,
                },
                { opsGroup: 1 },
              );
              const { tierType } = pageSettingData.opsGroup;

              deviceTokens = await this.matchingStaffs(
                clonedShiftDetails,
                res,
                tierType,
              );
              if (deviceTokens && deviceTokens.length > 0) {
                const pushData = {
                  title: 'Immediate shift for Booking!',
                  body: `Shift is available for booking`,
                  bodyText: `Standby shift on XXX to XXX is available for booking`,
                  bodyTime: [
                    shiftDetails.startTimeInSeconds,
                    shiftDetails.endTimeInSeconds,
                  ],
                  bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                };
                const collapseKey =
                  req.body
                    .shiftDetailsId; /* unique id for this particular shift */

                await FCM.push(deviceTokens, pushData, collapseKey);
                deviceTokens = [];
              }
            }

            await ShiftDetails.update(
              {
                _id: req.body.shiftDetailsId,
              },
              updateJson,
            );
            await ShiftDetails.update(
              {
                _id: req.body.splitShiftDetailsId,
              },
              updateJsonSplit,
            );

            return __.out(
              res,
              201,
              'Booking (confirmed) has been cancelled successfully',
            );
          }

          if (
            shiftDetails.backUpStaffs.some(
              (x) => x.toString() === req.user._id.toString(),
            )
          ) {
            /* if backup staff us there (take the one who applied first by date) */
            /* set cancel user flag in applied staff  */
            await this.reduceLimit(res, userId, shiftDetails);
            const appliedStaffIdToRemove = await AppliedStaffs.findOne({
              flexiStaff: req.user._id,
              shiftDetailsId: req.body.shiftDetailsId,
            }).lean();
            const appliedStaffIdToRemoveSplit = await AppliedStaffs.findOne({
              flexiStaff: req.user._id,
              shiftDetailsId: req.body.splitShiftDetailsId,
            }).lean();

            updateJson.$pull = {
              backUpStaffs: req.user._id,
              appliedStaffs: appliedStaffIdToRemove._id,
            };
            updateJsonSplit.$pull = {
              backUpStaffs: req.user._id,
              appliedStaffs: appliedStaffIdToRemoveSplit._id,
            };
            await AppliedStaffs.remove({
              _id: appliedStaffIdToRemove._id,
            });
            await AppliedStaffs.remove({
              _id: appliedStaffIdToRemoveSplit._id,
            });
            await ShiftDetails.update(
              {
                _id: req.body.shiftDetailsId,
              },
              updateJson,
            );
            await ShiftDetails.update(
              {
                _id: req.body.splitShiftDetailsId,
              },
              updateJsonSplit,
            );

            return __.out(
              res,
              201,
              'Booking (standby) has been cancelled successfully',
            );
          }

          /* user id not found either in confirmed staff or backuped staff */
          return __.out(res, 300, 'Something went wrong');
        }

        return __.out(res, 300, 'Invalid Shift / Shift Expired');
      } else {
        return __.out(res, 300, 'Invalid Shift Id');
      }

      return __.out(res, 500, 'Something Went Wrong');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async responseConfirmSlotRequestAfterCancel(req, res) {
    try {
      __.log('responseConfirmSlotRequestAfterCancel api', req.body);
      const requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isAccepted',
      ]);

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const userId = req.user._id;
        const shiftDetails = await ShiftDetails.findOne({
          _id: req.body.shiftDetailsId,
          status: 1,
          startTime: {
            $gt: moment().utc().format(),
          },
          backUpStaffs: req.user._id,
        })
          .populate([
            {
              path: 'shiftId',
              select: 'businessUnitId weekNumber',
            },
          ])
          .lean();

        if (shiftDetails) {
          if (req.body.isAccepted === 1) {
            if (
              shiftDetails.isShortTimeCancel === 1 &&
              shiftDetails.staffNeedCount > shiftDetails.confirmedStaffs.length
            ) {
              const limitData = {
                status: 1,
                isLimit: false,
              };

              if (limitData.status === 1) {
                let limit = shiftDetails.isLimit;

                if (limitData.limit) {
                  limit = true;
                }

                const updateJson = {
                  $addToSet: {
                    confirmedStaffs: req.user._id,
                  },
                  $pull: {
                    backUpStaffs: req.user._id,
                  },
                };

                if (
                  shiftDetails.staffNeedCount ===
                  shiftDetails.confirmedStaffs.length + 1
                ) {
                  /* check after this update confirmed staffs slot was filled or not. if  so set isShortTimeCancel =0 */
                  updateJson.$set = {
                    isShortTimeCancel: 0,
                  };
                }

                await ShiftDetails.update(
                  {
                    _id: req.body.shiftDetailsId,
                  },
                  updateJson,
                );

                await AppliedStaffs.update(
                  {
                    flexiStaff: req.user._id,
                    shiftDetailsId: req.body.shiftDetailsId,
                  },
                  {
                    $set: {
                      status: 1,
                      /* change the status to confirmed */
                      isLimit: limit,
                      message: limitData.message,
                    },
                  },
                );
                __.out(res, 201, 'Booked in confirmed slot ');
                // await this.updateRedis(redisBuId); //+limitData.message
              } else {
                __.out(res, 300, limitData.message);
                // await this.updateRedis(redisBuId);
              }
            } else {
              this.reduceLimit(res, userId, shiftDetails);
              __.out(res, 300, 'This confirmed slot has already been filled');
              // await this.updateRedis(redisBuId);
            }
          } else {
            /* push flexistaff id who rejects the request */
            await ShiftDetails.update(
              {
                _id: req.body.shiftDetailsId,
              },
              {
                $addToSet: {
                  shortTimeRequestRecjectedFlexistaffs: req.user._id,
                },
              },
            );
            __.out(res, 201, 'Request has been rejected successfully');
            // await this.updateRedis(redisBuId);
          }
        } else {
          // checked ******
          this.reduceLimit(res, userId, shiftDetails);
          __.out(res, 300, 'Invalid shift / Shift expired');
        }
      }
    } catch (err) {
      __.log(err);
      try {
        await this.reduceLimit(res, req.user._id, req.body.shiftDetailsId, 0);
      } catch (error) {
        __.out(res, 500);
      }
      __.out(res, 500);
    }
  }

  async responseConfirmSlotRequestAfterAdjust(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isAccepted',
      ]);

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const userId = req.user._id;
        const shiftDetails = await ShiftDetails.findOne({
          _id: req.body.shiftDetailsId,
          status: 1,
          startTime: {
            $gt: moment().utc().format(),
          },
          backUpStaffs: req.user._id,
        })
          .populate([
            {
              path: 'shiftId',
              select: 'businessUnitId weekNumber',
            },
          ])
          .lean();

        if (shiftDetails) {
          if (req.body.isAccepted === 1) {
            if (
              shiftDetails.isShortTimeAdjust === 1 &&
              shiftDetails.staffNeedCount > shiftDetails.confirmedStaffs.length
            ) {
              const limitData = {
                status: 1,
                isLimit: false,
              };

              if (limitData.status === 1) {
                const updateJson = {
                  $addToSet: {
                    confirmedStaffs: req.user._id,
                  },
                  $pull: {
                    backUpStaffs: req.user._id,
                  },
                };

                if (
                  shiftDetails.staffNeedCount ===
                  shiftDetails.confirmedStaffs.length + 1
                ) {
                  /* check after this update confirmed staffs slot was filled or not. if  so set isShortTimeCancel =0 */
                  updateJson.$set = {
                    isShortTimeAdjust: 0,
                  };
                }

                await ShiftDetails.update(
                  {
                    _id: req.body.shiftDetailsId,
                  },
                  updateJson,
                );

                await AppliedStaffs.update(
                  {
                    flexiStaff: req.user._id,
                    shiftDetailsId: req.body.shiftDetailsId,
                  },
                  {
                    $set: {
                      status: 1 /* change the status to confirmed */,
                    },
                  },
                );
                __.out(res, 201, 'Booked in confirmed slot');
              } else {
                __.out(res, 300, limitData.message);
              }
            } else {
              await this.reduceLimit(res, userId, shiftDetails);
              __.out(res, 300, 'This confirmed slot has already been filled');
            }
          } else {
            /* push flexistaff id who rejects the request */
            await ShiftDetails.update(
              {
                _id: req.body.shiftDetailsId,
              },
              {
                $addToSet: {
                  shortTimeAdjustRequestRecjectedFlexistaffs: req.user._id,
                },
              },
            );
            __.out(res, 201, 'Request has been rejected successfully');
          }
        } else {
          // checked ******
          if (req.body.isAccepted === 1) {
            await this.reduceLimit(res, userId, shiftDetails);
          }

          __.out(res, 300, 'Invalid shift / Shift expired');
        }
      }
    } catch (err) {
      __.log(err);
      if (req.body.isAccepted === 1) {
        try {
          await this.reduceLimit(res, req.user._id, req.body.shiftDetailsId, 0);
        } catch (error) {
          __.out(res, 500);
        }
      }

      __.out(res, 500);
    }
  }

  async responseForNewShiftRequest(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isAccepted',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const userId = req.user._id;
      const shiftDetails = await ShiftDetails.findOne({
        _id: req.body.shiftDetailsId,
        dedicatedRequestTo: req.user._id,
        status: 0,
        startTime: {
          $gt: moment().utc().format(),
        },
      })
        .populate({
          path: 'shiftId',
          select:
            'plannedBy businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
          populate: {
            path: 'plannedBy',
            select: 'name deviceToken',
          },
        })
        .lean();

      if (!shiftDetails) {
        if (req.body.isAccepted === 1) {
          this.reduceLimit(res, userId, shiftDetails);
        }

        return __.out(res, 300, 'Shift Expired.');
      }

      let userDeviceToken = false;
      const shiftIdforMetaData = shiftDetails.shiftId;
      let dateForPush = null;

      if (shiftDetails) {
        if (
          shiftDetails.shiftId &&
          shiftDetails.shiftId.plannedBy &&
          shiftDetails.shiftId.plannedBy.deviceToken &&
          shiftDetails.shiftId.plannedBy.deviceToken !== ''
        ) {
          userDeviceToken = shiftDetails.shiftId.plannedBy.deviceToken;
          __.log(
            'userdevixeToken',
            shiftDetails.shiftId.plannedBy,
            userDeviceToken,
          );

          dateForPush = shiftDetails.startTimeInSeconds;
        } else __.log('userdevice toekn else called ');

        if (req.body.isAccepted === 1) {
          /* accept the request */
          const data = {
            startTime: shiftDetails.startTime,
            endTime: shiftDetails.endTime,
            flexiStaffId: req.user._id,
            shiftDetailsId: shiftDetails.referenceShiftDetailsId,
          };
          const checkStaffAvailableInGivenTime =
            await this.checkStaffAvailableInGivenTime(data, res);

          if (checkStaffAvailableInGivenTime) {
            const limitData = {
              status: 1,
              isLimit: false,
            };

            if (limitData.status === 1) {
              const appliedStaffDetails = await AppliedStaffs.findOne({
                shiftDetailsId: shiftDetails.referenceShiftDetailsId,
                flexiStaff: req.user._id,
              });

              if (appliedStaffDetails) {
                appliedStaffDetails.shiftDetailsId = shiftDetails._id;
                await appliedStaffDetails.save();
                await ShiftDetails.update(
                  {
                    _id: req.body.shiftDetailsId,
                  },
                  {
                    $addToSet: {
                      confirmedStaffs: req.user._id,
                      appliedStaffs: appliedStaffDetails._id,
                    },
                    $set: {
                      status: 1,
                    },
                  },
                );

                /* remove the user from existing shift */
                await ShiftDetails.update(
                  {
                    _id: shiftDetails.referenceShiftDetailsId,
                  },
                  {
                    $inc: {
                      staffNeedCount: -1,
                      totalStaffNeedCount: -1,
                    },
                    $pull: {
                      confirmedStaffs: req.user._id,
                      appliedStaffs: appliedStaffDetails._id,
                    },
                  },
                );
                /* push new shift details id in shift document */
                await Shift.findOneAndUpdate(
                  {
                    _id: shiftDetails.shiftId,
                  },
                  {
                    $addToSet: {
                      shiftDetails: req.body.shiftDetailsId,
                    },
                  },
                  {
                    new: true,
                  },
                ).lean();

                if (userDeviceToken) {
                  const pushData = {
                    title: 'Accepted Shift Change!',
                    body: `${req.user.name} accepted shift change`,
                    bodyText: `${req.user.name} accepted shift change for XXX shift`,
                    bodyTime: [dateForPush],
                    bodyTimeFormat: ['dd MMM'],
                  };
                  const collapseKey =
                    req.body
                      .shiftDetailsId; /* unique id for this particular shift */

                  FCM.push([userDeviceToken], pushData, collapseKey);
                }

                /* Add to log */

                const logMetaData = await Shift.findOne({
                  _id: shiftIdforMetaData,
                })
                  .select(
                    'businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
                  )
                  .lean();

                const statusLogData = {
                  userId: req.user._id,
                  status: 7,
                  businessUnitId: logMetaData.businessUnitId,
                  weekNumber: logMetaData.weekNumber,
                  weekRangeStartsAt: logMetaData.weekRangeStartsAt,
                  weekRangeEndsAt: logMetaData.weekRangeEndsAt,
                  shiftId: shiftIdforMetaData,
                  acceptedShift: req.body.shiftDetailsId,
                  existingShift: shiftDetails.referenceShiftDetailsId,
                };

                await shiftLogController.create(statusLogData, res);

                // this.updateRedis(redisBuId);
                return __.out(
                  res,
                  201,
                  'Request shift has been accepted successfully',
                );
              }

              if (req.body.isAccepted === 1) {
                this.reduceLimit(res, userId, shiftDetails);
              }

              return __.out(res, 300, 'Something went wrong');
            }

            return __.out(res, 300, limitData.message);
          }

          if (req.body.isAccepted === 1) {
            this.reduceLimit(res, userId, shiftDetails);
          }

          // this.updateRedis(redisBuId);
          return __.out(res, 300, 'You have another shift at the same time.');
        }

        /* reject the request */
        await ShiftDetails.findOneAndUpdate(
          {
            _id: req.body.shiftDetailsId,
          },
          {
            $set: {
              status: 2,
            },
          },
          {
            new: true,
          },
        )
          .populate({
            path: 'shiftId',
            select: 'businessUnitId',
          })
          .lean();

        if (userDeviceToken) {
          const pushData = {
            title: 'Rejected Shift Change!',
            body: `${req.user.name} rejected shift change`,
            bodyText: `${req.user.name} rejected shift change for XXX shift`,
            bodyTime: [dateForPush],
            bodyTimeFormat: ['dd MMM'],
          };
          const collapseKey =
            req.body.shiftDetailsId; /* unique id for this particular shift */

          FCM.push([userDeviceToken], pushData, collapseKey);
        }
        /* Add to log */

        const logMetaData = await Shift.findOne({
          _id: shiftIdforMetaData,
        })
          .select('businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt')
          .lean();

        const statusLogData = {
          userId: req.user._id,
          status: 8,
          businessUnitId: logMetaData.businessUnitId,
          weekNumber: logMetaData.weekNumber,
          weekRangeStartsAt: logMetaData.weekRangeStartsAt,
          weekRangeEndsAt: logMetaData.weekRangeEndsAt,
          shiftId: shiftIdforMetaData,
          acceptedShift: req.body.shiftDetailsId,
          existingShift: shiftDetails.referenceShiftDetailsId,
        };

        await shiftLogController.create(statusLogData, res);
        // this.updateRedis(redisBuId);
        return __.out(res, 201, 'Request shift has been rejected successfully');
      }

      // checked ******
      // this.reduceLimit(userId, shiftDetails);
      if (req.body.isAccepted === 1) {
        this.reduceLimit(res, userId, shiftDetails);
      }

      return __.out(res, 300, 'Invalid shift / Shift expired');
    } catch (err) {
      __.log(err);
      if (req.body.isAccepted === 1) {
        try {
          await this.reduceLimit(res, req.user._id, req.body.shiftDetailsId, 0);
        } catch (error) {
          return __.out(res, 500);
        }
      }

      return __.out(res, 500);
    }
  }

  async checkStaffAvailableInGivenTime(data, res) {
    try {
      const where = {
        $or: [
          {
            _id: { $ne: data.shiftId },
            confirmedStaffs: data.flexiStaffId,
            startTime: {
              $lt: moment(data.endTime).utc().format(),
            },
            endTime: {
              $gt: moment(data.startTime).utc().format(),
            },
            status: 1,
          },
          {
            _id: { $ne: data.shiftId },
            backUpStaffs: data.flexiStaffId,
            startTime: {
              $lt: moment(data.endTime).utc().format(),
            },
            endTime: {
              $gt: moment(data.startTime).utc().format(),
            },
            status: 1,
          },
        ],
      };

      if (data.shiftDetailsId) {
        /* only for request shift (to avoid the current shift) */
        where.$or[0]._id = { $ne: data.shiftDetailsId };
        where.$or[1]._id = { $ne: data.shiftDetailsId };
      }

      const checkAnyShiftAlreadyExists = await ShiftDetails.findOne(
        where,
      ).lean();

      return !checkAnyShiftAlreadyExists;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async matchingStaffs(shiftDetails, res, tierType = 2) {
    try {
      const orArray = [];
      let userIdsToSkip = [];

      if (!Array.isArray(shiftDetails)) {
        userIdsToSkip = [
          ...shiftDetails.confirmedStaffs,
          ...shiftDetails.backUpStaffs,
        ];
        shiftDetails = [shiftDetails];
      }

      shiftDetails.forEach((shift) => {
        /* or condition for any of the shift skill set matches the user */
        if (tierType === 2) {
          orArray.push({
            subSkillSets: {
              $all: shift.subSkillSets,
            },
          });
        } else {
          orArray.push({
            mainSkillSets: {
              $all: shift.mainSkillSets,
            },
          });
        }
      });

      const users = await User.find({
        _id: {
          $nin: userIdsToSkip,
        },
        $or: orArray,
        $and: [
          {
            deviceToken: {
              $exists: true,
            },
          },
          {
            deviceToken: {
              $ne: '',
            },
          },
        ],
      })
        .populate({
          path: 'role',
          match: {
            status: 1,
            isFlexiStaff: 1,
          },
          select: 'name',
        })
        .select('role deviceToken')
        .lean();
      const deviceTokens = [];

      for (const x of users) {
        if (x.role) /* only flexistaff */ deviceTokens.push(x.deviceToken);
      }
      return deviceTokens;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async resRequestShiftChange(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'shiftDetailsId',
        'isAccepted',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Get Current Shift Details
      const requestedShiftDetails = await ShiftDetails.findOne({
        _id: req.body.shiftDetailsId,
        status: {
          $in: [0, 1],
        },
        startTime: {
          $gt: moment().utc().format(),
        },
      }).populate({
        path: 'requestedBy',
        select: 'name deviceToken',
      });
      const setStatus = req.body.isAccepted
        ? parseInt(req.body.isAccepted, 10)
        : 2;

      if (!requestedShiftDetails) {
        return __.out(res, 300, 'Invalid shift / Shift expired');
      }

      // Get Current Shift Details
      const parentShiftDetails = await ShiftDetails.findOne({
        _id: requestedShiftDetails.referenceShiftDetailsId,
        status: {
          $in: [0, 1],
        },
        startTime: {
          $gt: moment().utc().format(),
        },
      }).populate({
        path: 'requestedUsers',
        select: 'name deviceToken',
      });
      const userId = req.user._id;

      if (!parentShiftDetails) {
        return __.out(res, 300, 'Invalid Parent shift / Shift expired');
      }

      if (
        requestedShiftDetails.confirmedStaffs.length ===
        requestedShiftDetails.staffNeedCount
      ) {
        return __.out(res, 300, 'Shift Confirmed Slot is already filled');
      }

      if (parentShiftDetails.activeStatus === false) {
        return __.out(res, 300, 'Request change has been manually stopped');
      }

      const dateForPush = requestedShiftDetails.startTimeInSeconds;

      // Check Staff has another shift this time
      const newShiftTimings = {
        startTime: requestedShiftDetails.startTime,
        endTime: requestedShiftDetails.endTime,
        flexiStaffId: req.user._id,
        shiftDetailsId: parentShiftDetails._id,
      };
      const checkStaffAvailableInGivenTime =
        await this.checkStaffAvailableInGivenTime(newShiftTimings, res);

      if (setStatus === 1) {
        if (!checkStaffAvailableInGivenTime) {
          if (setStatus === 1) {
            this.reduceLimit(res, userId, requestedShiftDetails);
          }

          return __.out(res, 300, 'You have another shift at the same time.');
        }
      }

      // Set in Parent Shift
      let int = 0;
      let checkAllReplied = true;

      parentShiftDetails.requestedUsers =
        parentShiftDetails.requestedUsers || [];
      for (const elem of parentShiftDetails.requestedUsers) {
        if (
          req.user._id.equals(elem.userId) &&
          requestedShiftDetails._id.equals(elem.shiftDetailsId)
        ) {
          // Change Status in
          parentShiftDetails.requestedUsers.map((e) => {
            if (
              (setStatus === 1 || setStatus === 2) &&
              req.user._id.toString() === e.userId.toString()
            ) {
              e.status = setStatus;
            }

            return e;
          });
        }

        if (
          parentShiftDetails.requestedUsers[int].status === 0 &&
          requestedShiftDetails._id.equals(elem.shiftDetailsId)
        ) {
          checkAllReplied = false;
        }

        int += 1;
      }

      // Set Status on Applied Staffs
      await AppliedStaffs.findOneAndUpdate(
        {
          flexiStaff: req.user._id,
          shiftDetailsId: req.body.shiftDetailsId,
        },
        {
          status: setStatus,
        },
      );

      /* Create Shift Log */
      const logMetaData = await Shift.findOne({
        _id: parentShiftDetails.shiftId,
      })
        .select(
          'shiftId businessUnitId weekNumber weekRangeStartsAt weekRangeEndsAt',
        )
        .lean();
      /* Add to log */
      const statusLogData = {
        userId: req.user._id,
        shiftId: parentShiftDetails.shiftId,
        weekRangeStartsAt: logMetaData.weekRangeStartsAt,
        weekRangeEndsAt: logMetaData.weekRangeEndsAt,
        weekNumber: logMetaData.weekNumber,
        businessUnitId: logMetaData.businessUnitId,
        existingShift: parentShiftDetails._id,
      };

      // Accept
      if (setStatus === 1) {
        // Add in requested shift confirmed
        requestedShiftDetails.confirmedStaffs =
          requestedShiftDetails.confirmedStaffs || [];
        let isFirstStaff = true;

        if (requestedShiftDetails.confirmedStaffs.length > 0) {
          isFirstStaff = false;
        }

        requestedShiftDetails.confirmedStaffs.push(req.user._id);
        requestedShiftDetails.status = 1;
        await requestedShiftDetails.save();

        // Stop Requesting If confirmed slot is filled
        if (
          requestedShiftDetails.confirmedStaffs.length ===
          requestedShiftDetails.staffNeedCount
        ) {
          parentShiftDetails.activeStatus = false;
          parentShiftDetails.currentReqShift = null;
        }

        // Stop Request Change if all responded
        if (checkAllReplied === true) {
          parentShiftDetails.activeStatus = false;
          parentShiftDetails.currentReqShift = null;
        }

        // Remove user parent shift confirmed
        const userIndex = parentShiftDetails.confirmedStaffs.indexOf(
          req.user._id,
        );

        parentShiftDetails.confirmedStaffs.splice(userIndex, 1);
        if (isFirstStaff) {
          parentShiftDetails.staffNeedCount -=
            requestedShiftDetails.staffNeedCount;
        }

        await parentShiftDetails.save();

        // Remove from Parent Shift
        await AppliedStaffs.findOneAndUpdate(
          {
            flexiStaff: req.user._id,
            shiftDetailsId: parentShiftDetails._id,
          },
          {
            status: 3,
          },
        );

        if (requestedShiftDetails.requestedBy.deviceToken) {
          const pushData = {
            title: 'Accepted Shift Change!',
            body: `${req.user.name} accepted shift change`,
            bodyText: `${req.user.name} accepted shift change for XXX shift`,
            bodyTime: [dateForPush],
            bodyTimeFormat: ['dd MMM'],
          };
          const collapseKey =
            requestedShiftDetails._id.toString(); /* unique id for this particular shift */

          __.log(
            'pushSent',
            [requestedShiftDetails.requestedBy.deviceToken],
            pushData,
            collapseKey,
          );
          FCM.push(
            [requestedShiftDetails.requestedBy.deviceToken],
            pushData,
            collapseKey,
          );
        }

        // Log Created
        statusLogData.status = 7;
        statusLogData.acceptedShift = requestedShiftDetails._id;
        // await this.updateRedis(redisBuId);
        await shiftLogController.create(statusLogData, res);
        return __.out(
          res,
          201,
          'Request shift change has been accepted successfully',
        );
      }

      // Reject
      if (setStatus === 2) {
        // Stop Request Change if all responded
        if (checkAllReplied === true) {
          parentShiftDetails.activeStatus = false;
          parentShiftDetails.currentReqShift = null;
        }

        await parentShiftDetails.save();
        if (requestedShiftDetails.requestedBy.deviceToken) {
          const pushData = {
            title: 'Rejected Shift Change!',
            body: `${req.user.name} rejected shift change`,
            bodyText: `${req.user.name} rejected shift change for XXX shift`,
            bodyTime: [dateForPush],
            bodyTimeFormat: ['dd MMM'],
          };
          const collapseKey =
            requestedShiftDetails._id.toString(); /* unique id for this particular shift */

          __.log(
            'pushSent',
            [requestedShiftDetails.requestedBy.deviceToken],
            pushData,
            collapseKey,
          );
          FCM.push(
            [requestedShiftDetails.requestedBy.deviceToken],
            pushData,
            collapseKey,
          );
        }

        // Log Created
        statusLogData.status = 8;
        statusLogData.rejectedShift = requestedShiftDetails._id;
        await shiftLogController.create(statusLogData, res);
        // await this.updateRedis(redisBuId);
        return __.out(
          res,
          201,
          'Request shift change has been rejected successfully',
        );
      }

      return __.out(res, 400, 'Something Went Wrong');
    } catch (err) {
      __.log(err);

      return __.out(res, 500);
    }
  }

  async checkLimitRequestShiftChange(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo('staffshift/resRequestShiftChange/checklimit API Start!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      let userId = req.user._id;

      if (req.body.userId) {
        userId = req.body.userId;
      }

      const shiftDetailId = req.body.shiftDetailsId;
      let schemeDetails = await User.findById(userId, {
        schemeId: 1,
        _id: 0,
      }).populate([
        {
          path: 'schemeId',
          match: {
            status: true,
          },
        },
      ]);

      const shiftDetails = await ShiftDetails.findOne({ _id: shiftDetailId })
        .populate([
          {
            path: 'shiftId',
            select: 'weekNumber businessUnitId',
          },
        ])
        .lean();

      if (shiftDetails) {
        const referenceShiftDetails = await ShiftDetails.findOne({
          _id: shiftDetails.referenceShiftDetailsId,
        });

        if (referenceShiftDetails && schemeDetails.schemeId) {
          schemeDetails = schemeDetails.schemeId;
          if (schemeDetails.isShiftInterval) {
            const intervalRequireTime = schemeDetails.shiftIntervalTotal - 1;

            const intervalResult = await ShiftHelper.checkShiftInterval(
              userId,
              shiftDetails.startTime,
              shiftDetails.endTime,
              intervalRequireTime,
              referenceShiftDetails._id,
            );

            if (intervalResult) {
              logError(
                `staffshift/resRequestShiftChange/checklimit API, 'Minimum interval between shift is not met. Kindly choose another shift with required interval.'`,
                req.body,
              );
              return __.out(
                res,
                300,
                'Minimum interval between shift is not met. Kindly choose another shift with required interval.',
              );
            }
          }

          let isOt = false;
          const durationChange =
            shiftDetails.duration - referenceShiftDetails.duration;

          if (
            schemeDetails.shiftSchemeType === 1 ||
            (referenceShiftDetails?.isAssignShift
              ? schemeDetails.shiftSchemeType === 2
              : false) ||
            schemeDetails.shiftSchemeType === 3
          ) {
            let otDuration = 0;
            let normalDuration = 0;

            if (
              schemeDetails.shiftSetup.openShift &&
              schemeDetails.shiftSetup.openShift.normal
            ) {
              normalDuration = parseInt(durationChange, 10);
            } else {
              isOt = true;
              otDuration = parseInt(durationChange, 10);
            }

            const date = new Date(shiftDetails.date);
            const y = date.getFullYear();
            const m = date.getMonth();
            const firstDay = new Date(y, m, 1);
            const lastDay = new Date(y, m + 1, 0);
            const data = await StaffLimit.find({
              userId,
              shiftDetailId: { $exists: true },
              date: {
                $lte: new Date(new Date(lastDay).toISOString()),
                $gte: new Date(new Date(firstDay).toISOString()),
              },
            }).lean();
            let dailyDuration = durationChange;
            let weeklyDuration = durationChange;
            let monthlyDuration = durationChange;
            const { weekNumber } = shiftDetails.shiftId;
            let dailyOverall = dailyDuration;
            let weekLlyOverall = dailyDuration;
            let monthlyOverall = dailyDuration;
            let isPresent = false;
            let staffLimitPresentData = {};

            if (!isOt) {
              data.forEach((item) => {
                if (
                  new Date(item.date).getDate() === new Date(date).getDate()
                ) {
                  if (
                    item.shiftDetailId.toString() ===
                    shiftDetails.referenceShiftDetailsId.toString()
                  ) {
                    isPresent = true;
                    staffLimitPresentData = item;
                  }

                  dailyDuration += item.normalDuration;
                  dailyOverall += item.normalDuration;
                  dailyOverall += item.otDuration;
                }

                if (
                  new Date(item.date).getMonth() === new Date(date).getMonth()
                ) {
                  monthlyDuration += item.normalDuration;
                  monthlyOverall += item.normalDuration;
                  monthlyOverall += item.otDuration;
                }

                if (item.weekNumber === weekNumber) {
                  weeklyDuration += item.normalDuration;
                  weekLlyOverall += item.normalDuration;
                  weekLlyOverall += item.otDuration;
                }
              });
            } else {
              data.forEach((item) => {
                if (
                  new Date(item.date).getDate() === new Date(date).getDate()
                ) {
                  if (
                    item.shiftDetailId.toString() ===
                    shiftDetails.referenceShiftDetailsId.toString()
                  ) {
                    (isPresent = true)((staffLimitPresentData = item));
                  }

                  dailyDuration += item.otDuration;
                  dailyOverall += item.otDuration;
                  dailyOverall += item.normalDuration;
                }

                if (
                  new Date(item.date).getMonth() === new Date(date).getMonth()
                ) {
                  monthlyDuration += item.otDuration;
                  monthlyOverall += item.otDuration;
                  monthlyOverall += item.normalDuration;
                }

                if (item.weekNumber === weekNumber) {
                  weeklyDuration += item.otDuration;
                  weekLlyOverall += item.otDuration;
                  weekLlyOverall += item.normalDuration;
                }
              });
            }

            let dayLimit = schemeDetails.shiftSetup.limits.normalHr.day;
            let weekLimit = schemeDetails.shiftSetup.limits.normalHr.week;
            let monthLimit = schemeDetails.shiftSetup.limits.normalHr.month;
            const dayOverallLimit = schemeDetails.shiftSetup.limits.dayOverall;
            const weekOverallLimit =
              schemeDetails.shiftSetup.limits.weekOverall;
            const monthOverallLimit =
              schemeDetails.shiftSetup.limits.monthOverall;
            let isAllow = dayLimit.alert;
            let { disallow } = dayLimit;

            if (shiftDetails.isAssignShift) {
              isAllow = !schemeDetails.shiftSetup.limits.otHr.day.alert;
              disallow = !schemeDetails.shiftSetup.limits.otHr.day.disallow;
            }

            if (isOt) {
              dayLimit = schemeDetails.shiftSetup.limits.otHr.day;
              weekLimit = schemeDetails.shiftSetup.limits.otHr.week;
              monthLimit = schemeDetails.shiftSetup.limits.otHr.month;
            }

            // add data to staff Limit
            if (!isPresent) {
              const obj = {
                userId,
                shiftId: shiftDetails.shiftId._id,
                shiftDetailId: shiftDetails._id,
                date: shiftDetails.date,
                normalDuration,
                otDuration,
                weekNumber,
                businessUnitId: shiftDetails.shiftId.businessUnitId,
              };

              await new StaffLimit(obj).save();
              // add new
            }

            const oldStartTime = new Date(referenceShiftDetails.startTime);
            const newStartTime = new Date(shiftDetails.startTime);
            const currentTime = new Date(moment().utc().format());

            if ((oldStartTime || newStartTime) >= currentTime) {
              await StaffLimit.findByIdAndUpdate(staffLimitPresentData._id, {
                $inc: {
                  normalDuration,
                  otDuration,
                },
                $set: { childShiftId: shiftDetails._id },
              });
            }

            if (
              parseInt(dayLimit.value, 10) &&
              parseInt(dayLimit.value, 10) < parseInt(dailyDuration, 10)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }

              return res.status(201).json({
                limit: true,
                message: 'Exceeds Daily limit',
                flag: 'day',
                details: dayLimit,
                status: disallow ? 0 : 1,
              }); // dayLimit.disallow?0:1
            }

            if (
              parseInt(weekLimit.value, 10) &&
              parseInt(weekLimit.value, 10) < parseInt(weeklyDuration, 10)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }

              return res.status(201).json({
                limit: true,
                message: 'Exceeds Weekly limit',
                flag: 'week',
                details: weekLimit,
                status: disallow ? 0 : 1,
              });
            }

            if (
              parseInt(monthLimit.value, 10) &&
              parseInt(monthLimit.value, 10) < parseInt(monthlyDuration, 10)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }

              logInfo(
                `staffshift/resRequestShiftChange/checklimit 'Exceeds Monthly limit' API api end!`,
                { name: req.user.name, staffId: req.user.staffId },
              );
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Monthly limit',
                flag: 'month',
                details: monthLimit,
                status: disallow ? 0 : 1,
              });
            }

            if (
              parseInt(dayOverallLimit, 10) &&
              parseInt(dayOverallLimit, 10) < parseInt(dailyOverall, 10)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }

              logInfo(
                `staffshift/resRequestShiftChange/checklimit 'Exceeds Daily Overall limit' API api end!`,
                { name: req.user.name, staffId: req.user.staffId },
              );
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Daily Overall limit',
                flag: 'dayoverall',
                details: monthLimit,
                status: disallow ? 0 : 1,
              });
            }

            if (
              parseInt(weekOverallLimit, 10) &&
              parseInt(weekOverallLimit, 10) < parseInt(weekLlyOverall, 10)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }

              logInfo(
                `staffshift/resRequestShiftChange/checklimit 'Exceeds Weekly Overall limit' API api end!`,
                { name: req.user.name, staffId: req.user.staffId },
              );
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Weekly Overall limit',
                flag: 'weekoverall',
                details: monthLimit,
                status: disallow ? 0 : 1,
              });
            }

            if (
              parseInt(monthOverallLimit, 10) &&
              parseInt(monthOverallLimit, 10) < parseInt(monthlyOverall, 10)
            ) {
              if (!isAllow) {
                await this.reduceLimitRequestShiftChange(
                  res,
                  userId,
                  shiftDetails,
                );
              }

              logInfo(
                `staffshift/resRequestShiftChange/checklimit 'Exceeds Monthly Overall limit' API api end!`,
                { name: req.user.name, staffId: req.user.staffId },
              );
              return res.status(201).json({
                limit: true,
                message: 'Exceeds Monthly Overall limit',
                flag: 'monthoverall',
                details: monthLimit,
                status: disallow ? 0 : 1,
              });
            }

            // call method from here
            this.resRequestShiftChange(req, res);
          } else {
            logInfo(
              `staffshift/resRequestShiftChange/checklimit 'You don't have open shift scheme assign' API api end!`,
              { name: req.user.name, staffId: req.user.staffId },
            );
            return res.status(201).json({
              limit: true,
              status: 0,
              message: "You don't have open shift scheme assign",
            }); // status 0 not allowed to create, 1 allowed to create
          }
        } else {
          logInfo(
            `staffshift/resRequestShiftChange/checklimit 'You don't have open shift scheme assign' API api end!`,
            { name: req.user.name, staffId: req.user.staffId },
          );
          return res.status(201).json({
            limit: true,
            status: 0,
            message: "You don't have open shift scheme assign",
          }); // status 0 not allowed to create, 1 allowed to create
        }
      }

      return null;
    } catch (error) {
      logError(
        `staffshift/resRequestShiftChange/checklimit API, there is an error`,
        error.toString(),
      );
      return __.out(res, 500);
    }
  }

  async reduceLimitRequestShiftChange(res, userId, shiftDetails, from = 1) {
    try {
      let schemeDetails = await User.findOne({ _id: userId }).populate([
        {
          path: 'schemeId',
        },
      ]);

      schemeDetails = schemeDetails.schemeId;
      if (!from) {
        shiftDetails = await ShiftDetails.findOne({ _id: shiftDetails })
          .populate([
            {
              path: 'shiftId',
              select: 'weekNumber businessUnitId',
            },
          ])
          .lean();
      }

      const referenceShiftDetails = await ShiftDetails.findOne({
        _id: shiftDetails.referenceShiftDetailsId,
      });
      const changeDuration =
        shiftDetails.duration - referenceShiftDetails.duration;
      let otDuration = 0;
      let normalDuration = 0;

      if (
        schemeDetails.shiftSetup.openShift &&
        schemeDetails.shiftSetup.openShift.normal
      ) {
        normalDuration = -1 * changeDuration;
      } else {
        otDuration = -1 * changeDuration;
      }

      const value = await StaffLimit.update(
        { userId, shiftDetailId: shiftDetails.referenceShiftDetailsId },
        { $inc: { normalDuration, otDuration } },
      );

      return value;
    } catch (error) {
      return __.out(res, 500);
    }
  }

  async reduceLimitRSC(req, res) {
    try {
      let userId = req.user._id;
      const shiftDetailId = req.body.shiftDetailsId;

      if (req.body.userId) {
        userId = req.body.userId;
      }

      const shiftDetails = await ShiftDetails.findOne({ _id: shiftDetailId });

      await this.reduceLimitRequestShiftChange(res, userId, shiftDetails);

      return res
        .status(201)
        .json({ status: true, message: 'Successfully Proceed' });
    } catch (error) {
      return __.out(res, 500);
    }
  }
}
const staffShift = new StaffShiftController();

module.exports = staffShift;
