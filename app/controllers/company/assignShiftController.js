// Controller Code Starts here
const mongoose = require('mongoose');
const _ = require('lodash');
const multiparty = require('multiparty');
const async = require('async');
const moment = require('moment');
const json2csv = require('json2csv').parse;
const fs = require('fs');
const csv = require('csvtojson');
const { validationResult } = require('express-validator');
const Shift = require('../../models/shift');
const ShiftDetails = require('../../models/shiftDetails');
const StaffLimit = require('../../models/staffLimit');
const AppliedStaff = require('../../models/appliedStaff');
const Appointment = require('../../models/appointment');
const AssignShiftLog = require('../../models/assignShiftLog');
const Attendance = require('../../models/attendance');
const SubSection = require('../../models/subSection');
const User = require('../../models/user');
const ReportingLocation = require('../../models/reportingLocation');
const __ = require('../../../helpers/globalFunctions');
const OpsGroup = require('../../models/ops');
const AssignShift = require('../../models/assignShift');
const FCM = require('../../../helpers/fcm');
const pageSetting = require('../../models/pageSetting');
const { logInfo, logError } = require('../../../helpers/logger.helper');

let uploadFilePath = '';

function diffArray(a, b) {
  return a.filter((i) => b.indexOf(i) < 0);
}

function getDates(startDate, stopDate) {
  const dateArray1 = [];
  let currentDate = moment(startDate);
  const stopDates = moment(stopDate);

  while (currentDate <= stopDates) {
    dateArray1.push(moment(currentDate).format('MM-DD-YYYY'));
    currentDate = moment(currentDate).add(1, 'days');
  }
  return dateArray1;
}
class AssignShiftController {
  getDayName(dateString) {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const d = new Date(dateString);
    const dayName = days[d.getDay()];

    return dayName;
  }

  async createStaffListing(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`assginshift/stafflisting API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      const bodyData = req.body;
      const weekStart = moment(
        bodyData.weekRangeStartsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      const weekEnd = moment(bodyData.weekRangeEndsAt, 'MM-DD-YYYY HH:mm:ss Z')
        .utc()
        .format();
      const wholeWeekData = [];
      const weekNumber = __.weekNoStartWithMonday(weekStart);
      const userData = await User.findOne({ _id: bodyData.userId });
      const year = new Date(weekStart).getFullYear();

      const assignShiftDataPresent = await AssignShift.find({
        weekNumber,
        staff_id: userData._id,
        $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] },
      });
      const dayWiseData = [];

      if (assignShiftDataPresent.length === 0) {
        for (let i = 0; i < 7; i += 1) {
          const date = moment(new Date(weekStart)).add('days', i);
          const day = moment(new Date(weekStart))
            .utcOffset(bodyData.timeFormat)
            .add('days', i);
          const obj = {
            staffId: userData.staffId,
            businessUnitId: bodyData.businessUnitId,
            staff_id: userData._id,
            staffRoleId: userData.role,
            staffAppointmentId: userData.appointmentId,
            timeZone: bodyData.timeFormat,
            weekNumber,
            weekRangeStartsAt: weekStart,
            weekRangeEndsAt: weekEnd,
            plannedBy: bodyData.plannedBy,
            confirmedStaffs: [userData._id],
            date,
            day: moment(day).format('YYYY-MM-DD'),
            isEmpty: true,
          };

          wholeWeekData.push(obj);
        }
        const insert = await AssignShift.insertMany(wholeWeekData);

        for (let i = 0; i < insert.length; i += 1) {
          const item = insert[i];

          const obj = {
            day: this.getDayName(item.date),
            assginShiftId: item._id,
            date: item.day,
          };

          dayWiseData.push(obj);
        }
      } else {
        for (let i = 0; i < assignShiftDataPresent.length; i += 1) {
          const item = assignShiftDataPresent[i];

          const obj = {
            day: this.getDayName(item.date),
            assginShiftId: item._id,
            date: item.day,
          };

          dayWiseData.push(obj);
        }
      }

      logInfo(`assginshift/stafflisting API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return res.status(200).json({
        success: true,
        msg: 'shift list created successfully',
        dayWiseData,
      });
    } catch (error) {
      logError(
        `assginshift/stafflisting API, there is an error`,
        error.toString(),
      );
      return res
        .status(500)
        .json({ success: false, msg: 'something went wrong', error });
    }
  }

  async createEmptyShift(data, req, res) {
    try {
      const { shift } = data;
      const { companyId } = req.user;
      const { shiftDetails } = data;
      const wholeWeekData = [];
      let staffId = new Set();
      const weekNumber = __.weekNoStartWithMonday(shift.weekRangeStartsAt);
      const yearE = new Date(shift.weekRangeStartsAt).getFullYear();

      for (let i = 0; i < shiftDetails.length; i += 1) {
        if (shiftDetails[i] && shiftDetails[i].staffId)
          staffId.add(shiftDetails[i].staffId);
      }
      staffId = Array.from(staffId);

      const promiseData = [];
      const staffIdListCall = async (j) => {
        const userData = await User.findOne(
          { staffId: staffId[j], companyId },
          { _id: 1, role: 1, staffId: 1, appointmentId: 1 },
        );

        await AssignShift.deleteMany({
          staff_id: userData._id,
          weekNumber,
          $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, yearE] },
        });

        for (let i = 0; i < 7; i += 1) {
          const date = moment(new Date(shift.weekRangeStartsAt)).add('days', i);
          const day = moment(new Date(shift.weekRangeStartsAt))
            .utc(shift.timeFormat)
            .add('days', i);
          const obj = {
            staffId: userData.staffId,
            businessUnitId: shift.businessUnitId,
            staff_id: userData._id,
            staffRoleId: userData.role,
            staffAppointmentId: userData.appointmentId,
            timeZone: shift.timeFormat,
            weekNumber,
            weekRangeStartsAt: shift.weekRangeStartsAt,
            weekRangeEndsAt: shift.weekRangeEndsAt,
            plannedBy: shift.plannedBy,
            confirmedStaffs: [userData._id],
            date,
            day: moment(day).format('YYYY-MM-DD'),
            isEmpty: true,
          };

          wholeWeekData.push(obj);
        }
      };

      for (let j = 0; j < staffId.length; j += 1) {
        promiseData.push(staffIdListCall(j));
      }

      await Promise.all(promiseData);

      // return wholeWeekData;
      if (wholeWeekData.length > 0) {
        await AssignShift.insertMany(wholeWeekData);
      }

      return undefined;
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async create(req, res) {
    try {
      const bodyData = await this.getBodyData(res, req);
      const jsonArray = bodyData.shiftDetails;
      const fieldsArray = Object.keys(jsonArray[0]);
      // return res.json({ fieldsArray, jsonArray })
      const csvDD = await json2csv(jsonArray, fieldsArray);

      const fileName = `assignshift_import_${moment().format(
        'DD-MM-YYYY HH-mm',
      )}`;
      const filePath = `/public/uploads/assingshift/${fileName}.csv`;

      uploadFilePath = filePath;

      fs.writeFile(
        `./public/uploads/assingshift/${fileName}.csv`,
        csvDD,
        (err) => {
          if (err) {
            __.log('Error writing the file:', err);
          } else {
            __.log('File has been written successfully.');
          }
        },
      );

      if (bodyData) {
        bodyData.shift.weekRangeStartsAt = moment(
          bodyData.shift.weekRangeStartsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        bodyData.shift.weekRangeEndsAt = moment(
          bodyData.shift.weekRangeEndsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        const { timeFormat } = bodyData.shift;

        bodyData.shift.plannedBy = req.user._id;
        const planBussinessUnitId = await User.findOne(
          { _id: req.user._id },
          { _id: 0, planBussinessUnitId: 1 },
        );
        //  const planBussinessUnitIdArr = planBussinessUnitId.planBussinessUnitId;
        const planBussinessUnitIdArr = [];

        for (const planBu of planBussinessUnitId.planBussinessUnitId) {
          planBussinessUnitIdArr.push(planBu.toString());
        }

        await this.createEmptyShift(bodyData, req, res);

        delete bodyData.shift.timeFormat;
        req.body.data = {};
        req.body.data = bodyData.shift;
        req.body.shift = bodyData.shift;
        const selectedBuID = bodyData.shift.businessUnitId;

        const companySetup = await pageSetting.findOne(
          { companyId: req.user.companyId },
          { opsGroup: 1 },
        );
        const tierSetup = companySetup.opsGroup.tierType;
        const formatDataCreateArr = [];

        for (let i = 0; i < bodyData.shiftDetails.length; i += 1) {
          const item = bodyData.shiftDetails[i];

          if (item) {
            formatDataCreateArr.push(
              this.formatDataCreate(
                res,
                bodyData,
                item,
                planBussinessUnitIdArr,
                req,
                tierSetup,
                timeFormat,
                selectedBuID,
              ),
            );
          }
        }
        const formatDataCreateResult = await Promise.all(formatDataCreateArr);

        bodyData.shiftDetails = [];
        const fail = [];
        const valid = [];

        for (let i = 0; i < formatDataCreateResult.length; i += 1) {
          if (formatDataCreateResult[i].success) {
            valid.push(formatDataCreateResult[i].validShift[0]);
          } else {
            fail.push(formatDataCreateResult[i].failedShift[0]);
          }

          bodyData.shiftDetails.push(formatDataCreateResult[i].bodyDataObj);

          if (formatDataCreateResult[i].failedShift.length > 0) {
            fail.push(formatDataCreateResult[i].failedShift[0]);
          }
        }
        if (valid.length > 0) {
          // const updateResult = await this.updateRedis(
          //   redisObj.redisBuId,
          //   true,
          //   redisObj.mondayDate,
          //   redisObj.redisTimeZone,
          // );

          this.failedShiftInsert(res, fail, req, valid, 0);
          return res.json({
            status: true,
            code: 1,
            message: 'Successfully uploaded',
          });
        }

        this.failedShiftInsert(res, fail, req, valid, 0);
        return res.json({
          status: false,
          code: 1,
          message: 'there was some problem in upload',
        });
      }

      return __.out(res, 500, 'BodyData Not Found');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async formatDataCreate(
    res,
    bodyData,
    item,
    planBussinessUnitIdArr,
    req,
    tierSetup,
    timeFormat,
    selectedBuID,
  ) {
    try {
      let bodyDataObj = {};
      const failedShift = [];

      if (item.staffId) {
        bodyDataObj = { ...bodyData.shift, ...item };
        item.startTime = this.getDateInUTCFormatNew(
          item.StartDate,
          item.StartTime,
          timeFormat,
        );
        item.endTime = this.getDateInUTCFormatNew(
          item.EndDate,
          item.EndTime,
          timeFormat,
        );
        const userInfo = await User.findOne(
          { staffId: item.staffId, companyId: req.user.companyId },
          {
            _id: 1,
            appointmentId: 1,
            role: 1,
            mainSkillSets: 1,
            subSkillSets: 1,
            schemeId: 1,
            parentBussinessUnitId: 1,
            name: 1,
          },
        ).populate([
          {
            path: 'schemeId',
            select: 'shiftSchemeType shiftSetup',
          },
          {
            path: 'subSkillSets',
            select: 'name',
            populate: {
              path: 'skillSetId',
              select: 'name',
            },
          },
          {
            path: 'mainSkillSets',
            select: 'name',
          },
        ]);

        if (userInfo) {
          if (
            planBussinessUnitIdArr.includes(
              userInfo.parentBussinessUnitId.toString(),
            )
          ) {
            if (
              userInfo.schemeId &&
              (userInfo.schemeId.shiftSchemeType === 2 ||
                userInfo.schemeId.shiftSchemeType === 3)
            ) {
              bodyDataObj.staff_id = userInfo._id;
              bodyDataObj.selectedBuID = selectedBuID;
              bodyDataObj.name = userInfo.name;
              bodyDataObj.shiftScheme = userInfo.schemeId;
              bodyDataObj.staffAppointmentId = userInfo.appointmentId;
              bodyDataObj.confirmedStaffs = [];
              bodyDataObj.confirmedStaffs[0] = userInfo._id;
              bodyDataObj.staffRoleId = userInfo.role;
              const dateSplit = item.Date.split('/');

              item.Date = `${dateSplit[1]}-${dateSplit[0]}-${dateSplit[2]}`;
              const twoMonth =
                dateSplit[1].length === 2 ? dateSplit[1] : `0${dateSplit[1]}`;
              const twoDate =
                dateSplit[0].length === 2 ? dateSplit[0] : `0${dateSplit[0]}`;

              // bodyDataObj.day = dateSplit[2] + '-' + dateSplit[1] + '-' + dateSplit[0];
              bodyDataObj.day = `${dateSplit[2]}-${twoMonth}-${twoDate}`;
              bodyDataObj.date = moment(item.Date, 'MM-DD-YYYY HH:mm:ss Z')
                .utc()
                .format();
              bodyDataObj.weekNumber = __.weekNoStartWithMonday(
                bodyData.shift.weekRangeStartsAt,
              ); // moment(bodyData.shiftDetails[asyncIndex].date).format('ww');

              bodyDataObj.isOff = false;
              bodyDataObj.isRest = false;
              const isOffRest = item.OFF_REST.trim();

              if (!isOffRest) {
                let isSkillSet = false;
                const subSkillArr = [];

                if (tierSetup === 2) {
                  if (item.speciality1.trim()) {
                    isSkillSet = false;

                    for (let k = 0; k < userInfo.subSkillSets.length; k += 1) {
                      const subSkill = userInfo.subSkillSets[k];

                      if (
                        subSkill.name === item.speciality1 &&
                        subSkill.skillSetId &&
                        subSkill.skillSetId.name === item.Skillsets1
                      ) {
                        isSkillSet = true;
                        subSkillArr.push(subSkill._id);
                        break;
                      }
                    }
                  }

                  if (item.speciality2.trim()) {
                    isSkillSet = false;
                    for (let k = 0; k < userInfo.subSkillSets.length; k += 1) {
                      const subSkill = userInfo.subSkillSets[k];

                      if (
                        subSkill.name === item.speciality2 &&
                        subSkill.skillSetId &&
                        subSkill.skillSetId.name === item.Skillsets2
                      ) {
                        isSkillSet = true;
                        subSkillArr.push(subSkill._id);
                        break;
                      }
                    }
                  }

                  if (item.speciality3.trim()) {
                    isSkillSet = false;
                    for (let k = 0; k < userInfo.subSkillSets.length; k += 1) {
                      const subSkill = userInfo.subSkillSets[k];

                      if (
                        subSkill.name === item.speciality3 &&
                        subSkill.skillSetId &&
                        subSkill.skillSetId.name === item.Skillsets3
                      ) {
                        isSkillSet = true;
                        subSkillArr.push(subSkill._id);
                        break;
                      }
                    }
                  }
                } else {
                  // tier 1 logic
                  if (item.Skillsets1.trim()) {
                    isSkillSet = false;
                    for (let k = 0; k < userInfo.mainSkillSets.length; k += 1) {
                      const subSkill = userInfo.mainSkillSets[k];

                      if (subSkill.name === item.Skillsets1.trim()) {
                        isSkillSet = true;
                        subSkillArr.push(subSkill._id);
                        break;
                      }
                    }
                  }

                  if (item.Skillsets2.trim()) {
                    isSkillSet = false;
                    for (let k = 0; k < userInfo.mainSkillSets.length; k += 1) {
                      const subSkill = userInfo.mainSkillSets[k];

                      if (subSkill.name === item.Skillsets2.trim()) {
                        isSkillSet = true;
                        subSkillArr.push(subSkill._id);
                        break;
                      }
                    }
                  }

                  if (item.Skillsets3.trim()) {
                    isSkillSet = false;
                    for (let k = 0; k < userInfo.mainSkillSets.length; k += 1) {
                      const subSkill = userInfo.mainSkillSets[k];

                      if (subSkill.name === item.Skillsets3.trim()) {
                        isSkillSet = true;
                        subSkillArr.push(subSkill._id);
                        break;
                      }
                    }
                  }
                }

                if (isSkillSet) {
                  if (tierSetup === 2) {
                    bodyDataObj.subSkillSets = subSkillArr;
                    bodyDataObj.skillSetTierType = 2;
                    bodyDataObj.mainSkillSets = [];
                  } else {
                    bodyDataObj.subSkillSets = [];
                    bodyDataObj.skillSetTierType = 1;
                    bodyDataObj.mainSkillSets = subSkillArr;
                  }

                  bodyDataObj.timeZone = timeFormat;
                  const startTimeArrSplit = item.StartTime.split(':');

                  if (startTimeArrSplit.length <= 2) {
                    item.StartTime += ':00';
                  }

                  const endTimeArrSplit = item.EndTime.split(':');

                  if (endTimeArrSplit.length <= 2) {
                    item.EndTime += ':00';
                  }

                  bodyDataObj.startTime = this.getDateInUTCFormatNew(
                    item.StartDate,
                    item.StartTime,
                    timeFormat,
                  );
                  bodyDataObj.endTime = this.getDateInUTCFormatNew(
                    item.EndDate,
                    item.EndTime,
                    timeFormat,
                  );
                  bodyDataObj.startTimeInSeconds = moment(
                    new Date(bodyDataObj.startTime),
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                  bodyDataObj.endTimeInSeconds = moment(
                    new Date(bodyDataObj.endTime),
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .unix(); // new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                  const startSecond = new Date(bodyDataObj.startTime).getTime();
                  const endSecond = new Date(bodyDataObj.endTime).getTime();

                  bodyDataObj.duration = (endSecond - startSecond) / 3600000;
                  const isSplitShift = !!item.SplitStartDate.trim();

                  if (isSplitShift) {
                    bodyDataObj.splitStartTime = this.getDateInUTCFormatNew(
                      item.SplitStartDate,
                      item.SplitStartTime,
                      timeFormat,
                    );
                    bodyDataObj.splitEndTime = this.getDateInUTCFormatNew(
                      item.SplitEndDate,
                      item.SplitEndTime,
                      timeFormat,
                    );
                    bodyDataObj.splitStartTimeInSeconds = moment(
                      new Date(bodyDataObj.splitStartTime),
                      'MM-DD-YYYY HH:mm:ss Z',
                    )
                      .utc()
                      .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                    bodyDataObj.splitEndTimeInSeconds = moment(
                      new Date(bodyDataObj.splitEndTime),
                      'MM-DD-YYYY HH:mm:ss Z',
                    )
                      .utc()
                      .unix(); // new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                    const startSecondSplit = new Date(
                      bodyDataObj.splitStartTime,
                    ).getTime();
                    const endSecondSplit = new Date(
                      bodyDataObj.splitEndTime,
                    ).getTime();

                    bodyDataObj.duration +=
                      (endSecondSplit - startSecondSplit) / 3600000;
                    bodyDataObj.isSplitShift = true;
                  }

                  const escapedName = item.reportLocationName
                    .trim()
                    .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

                  const location = await ReportingLocation.findOne(
                    {
                      name: {
                        $regex: `^${escapedName}$`,
                        $options: 'i',
                      },

                      status: 1,
                    },
                    { name: 1, _id: 1 },
                  );

                  if (location) {
                    bodyDataObj.reportLocationId = location._id;
                  } else {
                    const createLocation = {
                      name: item.reportLocationName,
                      companyId: req.user.companyId,
                      status: 1,
                    };
                    const locationCreate = await new ReportingLocation(
                      createLocation,
                    ).save();

                    this.updateBu(res, locationCreate._id, selectedBuID);
                    bodyDataObj.reportLocationId = locationCreate._id;
                  }
                } else {
                  // skill error
                  item.faildMessage =
                    'Skillsets are not matching, please enter exact  Skillsets of the staff'; // 'User Not Belong to Plan Business Unit';
                  item.status = 0;
                  item.name = userInfo.name;
                  failedShift.push(item);
                  bodyDataObj = null;
                }
              } else {
                // off rest
                bodyDataObj.endTime = null;
                bodyDataObj.startTime = null;
                bodyDataObj.reportLocationId = null;
                bodyDataObj.alertMessage = null;
                bodyDataObj.schemeId = null;
                if (isOffRest.toUpperCase() === 'OFF') {
                  bodyDataObj.isOff = true;
                } else {
                  bodyDataObj.isRest = true;
                }
              }
            } else {
              item.faildMessage = 'User Does not have valid scheme'; // 'User Not Belong to Plan Business Unit';
              item.status = 0;
              item.name = userInfo.name;
              failedShift.push(item);
              bodyDataObj = null;
            }
          } else {
            // plan BU not
            item.faildMessage = 'User Not Belong to Plan Business Unit'; // 'User Not Belong to Plan Business Unit';
            item.status = 0;
            item.name = userInfo.name;
            failedShift.push(item);
            bodyDataObj = null;
          }
        } else {
          item.faildMessage = 'Staff ID not Found'; // 'User Not Belong to Plan Business Unit';
          item.status = 0;
          failedShift.push(item);
          bodyDataObj = null;
        }
      } else {
        bodyDataObj = null;
      }

      if (failedShift.length > 0 || !bodyDataObj) {
        return { success: false, failedShift };
      }

      const finalResult = await this.insertSendResponse(res, bodyDataObj, req);

      if (finalResult.failedShift.length > 0) {
        return {
          success: false,
          failedShift: finalResult.failedShift,
        };
      }

      return {
        success: true,
        validShift: finalResult.validShift,
        redisObj: finalResult.redis,
        failedShift: [],
      };
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  getDateInUTCFormatNew(date, time, timeZone) {
    const dateSplit = date.split('/');

    date = `${dateSplit[1]}-${dateSplit[0]}-${dateSplit[2]}`;
    const dateTime = `${date} ${time} ${timeZone}`;

    return moment(dateTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
  }

  updateBu(res, locationData, bu) {
    try {
      return SubSection.update(
        { _id: bu },
        { $push: { reportingLocation: locationData } },
      );
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async createStaff(req, res) {
    try {
      const bodyData = await this.getBodyDataStaff(res, req);
      const planBussinessUnitId = await User.findOne(
        { _id: req.user._id },
        { _id: 0, planBussinessUnitId: 1 },
      );

      const planBussinessUnitIdArr = [];

      for (const planBu of planBussinessUnitId.planBussinessUnitId) {
        planBussinessUnitIdArr.push(planBu.toString());
      }

      if (bodyData) {
        const csvLength = bodyData.shiftDetails.length;

        bodyData.shift.weekRangeStartsAt = moment(
          bodyData.shift.weekRangeStartsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        bodyData.shift.weekRangeEndsAt = moment(
          bodyData.shift.weekRangeEndsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        const { timeFormat } = bodyData.shift;

        delete bodyData.shift.timeFormat;
        const failedShift = [];
        const reportLocation = [];

        bodyData.shift.plannedBy = req.user._id;
        req.body.data = {};
        req.body.data = bodyData.shift;

        let asyncIndex = 0;

        await async.eachSeries(bodyData.shiftDetails, (item, next) => {
          bodyData.shiftDetails[asyncIndex] = { ...bodyData.shift, ...item };
          item.startTime = this.getDateInUTCFormat(
            item.StartDate,
            item.StartTime,
            timeFormat,
          );
          item.endTime = this.getDateInUTCFormat(
            item.EndDate,
            item.EndTime,
            timeFormat,
          );
          User.findOne(
            { staffId: item.staffId, companyId: req.user.companyId },
            {
              _id: 1,
              appointmentId: 1,
              role: 1,
              subSkillSets: 1,
              parentBussinessUnitId: 1,
              schemeId: 1,
              name: 1,
            },
          )
            .populate([
              {
                path: 'schemeId',
                select: 'shiftSchemeType shiftSetup',
              },
            ])
            .then((userInfo) => {
              if (userInfo) {
                if (
                  userInfo.schemeId &&
                  (userInfo.schemeId.shiftSchemeType === 2 ||
                    userInfo.schemeId.shiftSchemeType === 3)
                ) {
                  bodyData.shiftDetails[asyncIndex].shiftScheme =
                    userInfo.schemeId;
                  bodyData.shiftDetails[asyncIndex].staff_id = userInfo._id;
                  bodyData.shiftDetails[asyncIndex].name = userInfo.name;
                  bodyData.shiftDetails[asyncIndex].staffAppointmentId =
                    userInfo.appointmentId;
                  bodyData.shiftDetails[asyncIndex].staffRoleId = userInfo.role;
                  bodyData.shiftDetails[asyncIndex].subSkillSets =
                    item.subSkillSets;
                  bodyData.shiftDetails[asyncIndex].confirmedStaffs = [];
                  bodyData.shiftDetails[asyncIndex].confirmedStaffs[0] =
                    userInfo._id;
                  bodyData.shiftDetails[asyncIndex].startTime =
                    this.getDateInUTCFormat(
                      item.StartDate,
                      item.StartTime,
                      timeFormat,
                    );
                  bodyData.shiftDetails[asyncIndex].endTime =
                    this.getDateInUTCFormat(
                      item.EndDate,
                      item.EndTime,
                      timeFormat,
                    );
                  bodyData.shiftDetails[asyncIndex].startTimeInSeconds = moment(
                    new Date(bodyData.shiftDetails[asyncIndex].startTime),
                    'MM-DD-YYYY HH:mm:ss Z',
                  ).utc();
                  bodyData.shiftDetails[asyncIndex].endTimeInSeconds = moment(
                    new Date(bodyData.shiftDetails[asyncIndex].endTime),
                    'MM-DD-YYYY HH:mm:ss Z',
                  ).utc();
                  const startSecond = new Date(
                    bodyData.shiftDetails[asyncIndex].startTime,
                  ).getTime();
                  const endSecond = new Date(
                    bodyData.shiftDetails[asyncIndex].endTime,
                  ).getTime();

                  bodyData.shiftDetails[asyncIndex].duration =
                    (endSecond - startSecond) / 3600000;
                  if (item.isSplitShift) {
                    bodyData.shiftDetails[asyncIndex].splitStartTime =
                      this.getDateInUTCFormat(
                        item.StartDate,
                        item.splitStartTime,
                        timeFormat,
                      );
                    bodyData.shiftDetails[asyncIndex].splitEndTime =
                      this.getDateInUTCFormat(
                        item.EndDate,
                        item.splitEndTime,
                        timeFormat,
                      );

                    bodyData.shiftDetails[asyncIndex].splitStartTimeInSeconds =
                      moment(
                        new Date(
                          bodyData.shiftDetails[asyncIndex].splitStartTime,
                        ),
                        'MM-DD-YYYY HH:mm:ss Z',
                      )
                        .utc()
                        .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                    bodyData.shiftDetails[asyncIndex].splitEndTimeInSeconds =
                      moment(
                        new Date(
                          bodyData.shiftDetails[asyncIndex].splitEndTime,
                        ),
                        'MM-DD-YYYY HH:mm:ss Z',
                      )
                        .utc()
                        .unix(); // new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                    const startSecondSplit = new Date(
                      bodyData.shiftDetails[asyncIndex].splitStartTime,
                    ).getTime();
                    const endSecondSplit = new Date(
                      bodyData.shiftDetails[asyncIndex].splitEndTime,
                    ).getTime();

                    bodyData.shiftDetails[asyncIndex].duration +=
                      (endSecondSplit - startSecondSplit) / 3600000;
                  }

                  const dateSplit = item.Date.split('-');

                  item.Date = `${dateSplit[1]}-${dateSplit[0]}-${dateSplit[2]}`;
                  const twoMonth =
                    dateSplit[1].length === 2
                      ? dateSplit[1]
                      : `0${dateSplit[1]}`;
                  const twoDate =
                    dateSplit[0].length === 2
                      ? dateSplit[0]
                      : `0${dateSplit[0]}`;

                  bodyData.shiftDetails[
                    asyncIndex
                  ].day = `${dateSplit[2]}-${twoMonth}-${twoDate}`;
                  bodyData.shiftDetails[asyncIndex].date = moment(
                    item.Date,
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .format();
                  bodyData.shiftDetails[asyncIndex].weekNumber =
                    __.weekNoStartWithMonday(bodyData.shift.weekRangeStartsAt); // moment(bodyData.shiftDetails[asyncIndex].date).format('ww');

                  const locationFind = reportLocation.find(
                    (locationItem) =>
                      locationItem.name.toLowerCase() ===
                      item.reportLocationName.toLowerCase(),
                  );

                  if (locationFind) {
                    bodyData.shiftDetails[asyncIndex].reportLocationId =
                      locationFind._id;
                    asyncIndex += 1;
                    if (asyncIndex === csvLength) {
                      this.sendResponse(
                        bodyData.shiftDetails,
                        res,
                        failedShift,
                        req,
                        0,
                      );
                    }

                    next();
                  } else {
                    ReportingLocation.findOne(
                      {
                        name: {
                          $regex: `/^${item.reportLocationName}$/i`,
                        },
                        status: 1,
                      },
                      { name: 1, _id: 1 },
                    )
                      .then((location) => {
                        if (location) {
                          reportLocation.push(location);
                          bodyData.shiftDetails[asyncIndex].reportLocationId =
                            location._id;
                          asyncIndex += 1;
                          if (asyncIndex === csvLength) {
                            this.sendResponse(
                              bodyData.shiftDetails,
                              res,
                              failedShift,
                              req,
                              0,
                            );
                          }

                          next();
                        } else {
                          const createLocation = {
                            name: item.reportLocationName,
                            companyId: '5a9d162b36ab4f444b4271c8',
                            status: 1,
                          };

                          new ReportingLocation(createLocation)
                            .save()
                            .then((locationCreate) => {
                              reportLocation.push(locationCreate);
                              bodyData.shiftDetails[
                                asyncIndex
                              ].reportLocationId = locationCreate._id;
                              asyncIndex += 1;
                              if (asyncIndex === csvLength) {
                                this.sendResponse(
                                  bodyData.shiftDetails,
                                  res,
                                  failedShift,
                                  req,
                                  0,
                                );
                              }

                              next();
                            })
                            .catch(() => {
                              item.faildMessage = 'Location create Error';
                              item.status = 0;
                              item.name = userInfo.name;
                              failedShift.push(item);
                              bodyData.shiftDetails[asyncIndex] = null;
                              asyncIndex += 1;
                              if (asyncIndex === csvLength) {
                                this.sendResponse(
                                  bodyData.shiftDetails,
                                  res,
                                  failedShift,
                                  req,
                                  0,
                                );
                              }

                              next();
                            });
                        }
                      })
                      .catch(() => {
                        bodyData.shiftDetails[asyncIndex] = null;
                        asyncIndex += 1;
                        item.faildMessage = 'Location Error';
                        item.status = 0;
                        item.name = userInfo.name;
                        failedShift.push(item);
                        if (asyncIndex === csvLength) {
                          this.sendResponse(
                            bodyData.shiftDetails,
                            res,
                            failedShift,
                            req,
                            0,
                          );
                        }

                        next();
                      });
                  }
                } else {
                  item.faildMessage = 'User Does not have valid scheme'; // 'User Not Belong to Plan Business Unit';
                  item.status = 0;
                  item.name = userInfo.name;
                  failedShift.push(item);
                  bodyData.shiftDetails[asyncIndex] = null;
                  asyncIndex += 1;
                  if (asyncIndex === csvLength) {
                    this.sendResponse(
                      bodyData.shiftDetails,
                      res,
                      failedShift,
                      req,
                      0,
                    );
                  }

                  next();
                }
              } else {
                item.faildMessage = 'UserNotfound';
                item.status = 0;
                failedShift.push(item);
                bodyData.shiftDetails[asyncIndex] = null;
                asyncIndex += 1;
                if (asyncIndex === csvLength) {
                  this.sendResponse(
                    bodyData.shiftDetails,
                    res,
                    failedShift,
                    req,
                    0,
                  );
                }

                next();
              }
            })
            .catch(() => {
              item.faildMessage = 'Error';
              item.status = 0;
              failedShift.push(item);
              bodyData.shiftDetails[asyncIndex] = null;
              asyncIndex += 1;
              if (asyncIndex === csvLength) {
                this.sendResponse(
                  bodyData.shiftDetails,
                  res,
                  failedShift,
                  req,
                  0,
                );
              }

              next();
            });
        });
      }

      return res.json({
        status: false,
        code: 1,
        message: 'Something went wrong',
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async createStaffAsRestOrOff(req, res) {
    try {
      const bodyData = await this.getBodyDataStaff(res, req);
      const planBussinessUnitId = await User.findOne(
        { _id: req.user._id },
        { _id: 0, planBussinessUnitId: 1 },
      );

      const planBussinessUnitIdArr = [];

      for (const planBu of planBussinessUnitId.planBussinessUnitId) {
        planBussinessUnitIdArr.push(planBu.toString());
      }

      if (bodyData) {
        const csvLength = bodyData.shiftDetails.length;

        bodyData.shift.weekRangeStartsAt = moment(
          bodyData.shift.weekRangeStartsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
        bodyData.shift.weekRangeEndsAt = moment(
          bodyData.shift.weekRangeEndsAt,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();

        delete bodyData.shift.timeFormat;
        const failedShift = [];

        const reportLocation = [];

        bodyData.shift.plannedBy = req.user._id;
        req.body.data = {};
        req.body.data = bodyData.shift;
        let asyncIndex = 0;

        await async.eachSeries(bodyData.shiftDetails, (item, next) => {
          bodyData.shiftDetails[asyncIndex] = { ...bodyData.shift, ...item };

          User.findOne(
            { staffId: item.staffId, companyId: req.user.companyId },
            {
              _id: 1,
              appointmentId: 1,
              role: 1,
              subSkillSets: 1,
              parentBussinessUnitId: 1,
              schemeId: 1,
              name: 1,
            },
          )
            .populate([
              {
                path: 'schemeId',
                select: 'shiftSchemeType shiftSetup',
              },
            ])
            .then((userInfo) => {
              if (userInfo) {
                if (
                  userInfo.schemeId &&
                  (userInfo.schemeId.shiftSchemeType === 2 ||
                    userInfo.schemeId.shiftSchemeType === 3)
                ) {
                  bodyData.shiftDetails[asyncIndex].shiftScheme =
                    userInfo.schemeId;
                  bodyData.shiftDetails[asyncIndex].staff_id = userInfo._id;
                  bodyData.shiftDetails[asyncIndex].name = userInfo.name;
                  bodyData.shiftDetails[asyncIndex].staffAppointmentId =
                    userInfo.appointmentId;
                  bodyData.shiftDetails[asyncIndex].staffRoleId = userInfo.role;
                  bodyData.shiftDetails[asyncIndex].subSkillSets =
                    userInfo.subSkillSets;
                  bodyData.shiftDetails[asyncIndex].confirmedStaffs = [];
                  bodyData.shiftDetails[asyncIndex].confirmedStaffs[0] =
                    userInfo._id;
                  bodyData.shiftDetails[asyncIndex].startTime = null; // this.getDateInUTCFormat(item.StartDate, item.StartTime, timeFormat);
                  bodyData.shiftDetails[asyncIndex].endTime = null; // this.getDateInUTCFormat(item.EndDate, item.EndTime, timeFormat);
                  bodyData.shiftDetails[asyncIndex].startTimeInSeconds = null; // moment(new Date(bodyData.shiftDetails[asyncIndex].startTime), 'MM-DD-YYYY HH:mm:ss Z').utc().unix();// new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
                  bodyData.shiftDetails[asyncIndex].endTimeInSeconds = null; // moment(new Date(bodyData.shiftDetails[asyncIndex].endTime), 'MM-DD-YYYY HH:mm:ss Z').utc().unix();//new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
                  const dateSplit = item.Date.split('-');

                  item.Date = `${dateSplit[1]}-${dateSplit[0]}-${dateSplit[2]}`;
                  bodyData.shiftDetails[
                    asyncIndex
                  ].day = `${dateSplit[2]}-${dateSplit[1]}-${dateSplit[0]}`;
                  bodyData.shiftDetails[asyncIndex].date = moment(
                    item.Date,
                    'MM-DD-YYYY HH:mm:ss Z',
                  )
                    .utc()
                    .format();
                  bodyData.shiftDetails[asyncIndex].weekNumber =
                    __.weekNoStartWithMonday(bodyData.shift.weekRangeStartsAt); // moment(bodyData.shiftDetails[asyncIndex].date).format('ww');

                  bodyData.shiftDetails[asyncIndex].duration = 0;

                  const locationFind = reportLocation.find(
                    (locationItem) =>
                      locationItem.name.toLowerCase() ===
                      item.reportLocationName.toLowerCase(),
                  );

                  if (locationFind) {
                    bodyData.shiftDetails[asyncIndex].reportLocationId =
                      locationFind._id;
                    asyncIndex += 1;
                    if (asyncIndex === csvLength) {
                      this.sendResponseAsRestOrOff(
                        bodyData.shiftDetails,
                        res,
                        failedShift,
                        req,
                        0,
                      );
                    }

                    next();
                  } else {
                    ReportingLocation.findOne(
                      {
                        name: {
                          $regex: `/^${item.reportLocationName}$/i`,
                        },
                        status: 1,
                      },
                      { name: 1, _id: 1 },
                    )
                      .then((location) => {
                        if (location) {
                          reportLocation.push(location);
                          bodyData.shiftDetails[asyncIndex].reportLocationId =
                            location._id;
                          asyncIndex += 1;
                          if (asyncIndex === csvLength) {
                            this.sendResponseAsRestOrOff(
                              bodyData.shiftDetails,
                              res,
                              failedShift,
                              req,
                              0,
                            );
                          }

                          next();
                        } else {
                          const createLocation = {
                            name: item.reportLocationName,
                            companyId: '5a9d162b36ab4f444b4271c8',
                            status: 1,
                          };

                          new ReportingLocation(createLocation)
                            .save()
                            .then((locationCreate) => {
                              reportLocation.push(locationCreate);
                              bodyData.shiftDetails[
                                asyncIndex
                              ].reportLocationId = locationCreate._id;
                              asyncIndex += 1;
                              if (asyncIndex === csvLength) {
                                this.sendResponseAsRestOrOff(
                                  bodyData.shiftDetails,
                                  res,
                                  failedShift,
                                  req,
                                  0,
                                );
                              }

                              next();
                            })
                            .catch(() => {
                              item.faildMessage = 'Location create Error';
                              item.status = 0;
                              item.name = userInfo.name;
                              failedShift.push(item);
                              bodyData.shiftDetails[asyncIndex] = null;
                              asyncIndex += 1;
                              if (asyncIndex === csvLength) {
                                this.sendResponseAsRestOrOff(
                                  bodyData.shiftDetails,
                                  res,
                                  failedShift,
                                  req,
                                  0,
                                );
                              }

                              next();
                            });
                        }
                      })
                      .catch(() => {
                        bodyData.shiftDetails[asyncIndex] = null;
                        asyncIndex += 1;
                        item.faildMessage = 'Location Error';
                        item.status = 0;
                        item.name = userInfo.name;
                        failedShift.push(item);
                        if (asyncIndex === csvLength) {
                          this.sendResponseAsRestOrOff(
                            bodyData.shiftDetails,
                            res,
                            failedShift,
                            req,
                            0,
                          );
                        }

                        next();
                      });
                  }
                } else {
                  item.faildMessage = 'User Does not have valid scheme'; // 'User Not Belong to Plan Business Unit';
                  item.status = 0;
                  item.name = userInfo.name;
                  failedShift.push(item);
                  bodyData.shiftDetails[asyncIndex] = null;
                  asyncIndex += 1;
                  if (asyncIndex === csvLength) {
                    this.sendResponseAsRestOrOff(
                      bodyData.shiftDetails,
                      res,
                      failedShift,
                      req,
                      0,
                    );
                  }

                  next();
                }
              } else {
                item.faildMessage = 'UserNotfound';
                item.status = 0;
                failedShift.push(item);
                bodyData.shiftDetails[asyncIndex] = null;
                asyncIndex += 1;
                if (asyncIndex === csvLength) {
                  this.sendResponseAsRestOrOff(
                    bodyData.shiftDetails,
                    res,
                    failedShift,
                    req,
                    0,
                  );
                }

                next();
              }
            })
            .catch(() => {
              item.faildMessage = 'Error';
              item.status = 0;
              failedShift.push(item);
              bodyData.shiftDetails[asyncIndex] = null;
              asyncIndex += 1;
              if (asyncIndex === csvLength) {
                this.sendResponseAsRestOrOff(
                  bodyData.shiftDetails,
                  res,
                  failedShift,
                  req,
                  0,
                );
              }

              next();
            });
        });
      }

      return res.json({
        status: false,
        code: 1,
        message: 'Something went wrong',
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  getDateInUTCFormat(date, time, timeZone) {
    const dateSplit = date.split('-');

    date = `${dateSplit[1]}-${dateSplit[0]}-${dateSplit[2]}`;
    const dateTime = `${date} ${time} ${timeZone}`;

    return moment(dateTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
  }

  async insertSendResponse(res, item, req) {
    try {
      const { isMobile } = req.body.shift;
      const validShift = [];
      const failedShift = [];
      let redisBuId;
      let mondayDate;
      let redisTimeZone;
      const assignShiftIdArr = [];

      if (item && item.staffId) {
        item.isLimit = false;
        item.isAlert = false;
        const weekStart = __.weekNoStartWithMonday(item.weekRangeStartsAt);
        const weekDate = __.weekNoStartWithMonday(item.date);
        const weekEnd = __.weekNoStartWithMonday(item.weekRangeEndsAt);

        if (
          weekStart === weekDate ||
          weekDate === weekEnd ||
          (new Date(item.weekRangeStartsAt).getTime() <=
            new Date(item.date).getTime() &&
            new Date(item.weekRangeEndsAt).getTime() >=
              new Date(item.date).getTime())
        ) {
          const shiftResult = await AssignShift.find({
            staff_id: item.staff_id,
            date: item.date,
            isEmpty: false,
          });
          const shiftDetailsF = await ShiftDetails.find({
            $or: [
              { confirmedStaffs: item.staff_id },
              { backUpStaffs: item.staff_id },
            ],
            date: item.date,
          });
          const yearDt = parseInt(
            moment(item.date).utcOffset(-330).format('YYYY'),
            10,
          );
          const monthDt = parseInt(
            moment(item.date).utcOffset(-330).format('MM'),
            10,
          );
          const dayDt = parseInt(
            moment(item.date).utcOffset(-330).format('DD'),
            10,
          );
          const whereDt = {
            staff_id: item.staff_id,
            isEmpty: true,
            $and: [
              { $expr: { $eq: [{ $year: '$date' }, yearDt] } },
              { $expr: { $eq: [{ $month: '$date' }, monthDt] } },
              { $expr: { $eq: [{ $dayOfMonth: '$date' }, dayDt] } },
            ],
          };

          AssignShift.deleteMany(whereDt).then(() => {});
          if (
            (shiftResult && shiftResult.length > 0) ||
            (shiftDetailsF && shiftDetailsF.length > 0)
          ) {
            const shiftAlreadyPresent = shiftResult.filter(
              (shiftAl) =>
                new Date(shiftAl.startTime).getTime() ===
                  new Date(item.startTime).getTime() &&
                new Date(shiftAl.endTime).getTime() ===
                  new Date(item.endTime).getTime(),
            );
            const shiftAlreadyPresentDetails = shiftDetailsF.filter(
              (shiftAl) =>
                new Date(shiftAl.startTime).getTime() ===
                  new Date(item.startTime).getTime() &&
                new Date(shiftAl.endTime).getTime() ===
                  new Date(item.endTime).getTime(),
            );

            if (
              (shiftAlreadyPresent && shiftAlreadyPresent.length > 0) ||
              (shiftAlreadyPresentDetails &&
                shiftAlreadyPresentDetails.length > 0)
            ) {
              item.faildMessage = 'Shift Already Present';
              item.status = 0;
              failedShift.push(item);
            }

            let shiftOverlapping = [];
            let shiftOverlappingDetails = [];

            if (
              shiftAlreadyPresent.length === 0 &&
              shiftAlreadyPresentDetails.length === 0
            ) {
              shiftOverlapping = shiftResult.filter(
                (shiftOverl) =>
                  (new Date(shiftOverl.startTime).getTime() <=
                    new Date(item.startTime).getTime() &&
                    new Date(shiftOverl.endTime).getTime() >=
                      new Date(item.startTime).getTime()) ||
                  (new Date(shiftOverl.startTime).getTime() <=
                    new Date(item.endTime).getTime() &&
                    new Date(shiftOverl.endTime).getTime() >=
                      new Date(item.endTime).getTime()),
              );
              shiftOverlappingDetails = shiftDetailsF.filter(
                (shiftOverl) =>
                  (new Date(shiftOverl.startTime).getTime() <=
                    new Date(item.startTime).getTime() &&
                    new Date(shiftOverl.endTime).getTime() >=
                      new Date(item.startTime).getTime()) ||
                  (new Date(shiftOverl.startTime).getTime() <=
                    new Date(item.endTime).getTime() &&
                    new Date(shiftOverl.endTime).getTime() >=
                      new Date(item.endTime).getTime()),
              );
              if (
                (shiftOverlapping && shiftOverlapping.length > 0) ||
                (shiftOverlappingDetails && shiftOverlappingDetails.length > 0)
              ) {
                item.faildMessage = 'Shift is Overlapping';
                item.status = 0;
                failedShift.push(item);
              }
            }

            if (
              shiftOverlapping.length === 0 &&
              shiftAlreadyPresent.length === 0 &&
              shiftAlreadyPresentDetails.length === 0
            ) {
              const isLimit = await this.checkLimit(res, item);

              let isSave = true;

              if (isLimit.limit) {
                item.isLimitExceed = true;
                item.isAllowPublish = false;
                item.alertMessage = isLimit.message;
                item.isLimit = true;
                item.schemeDetails = isLimit.details;
                item.isAlert = false;
                if (isLimit.status) {
                  isSave = true;
                  item.isAlert = true;
                }
              }

              if (isSave) {
                delete item.shiftScheme;
                item.isMobile = isMobile;
                const saveShift = await new AssignShift(item).save();

                redisBuId = saveShift.businessUnitId;
                mondayDate = this.getMondayDate(saveShift.weekRangeStartsAt);
                redisTimeZone = saveShift.timeZone
                  ? saveShift.timeZone
                  : 'GMT+0800';

                isLimit.staffLimitData.assignShiftId = saveShift._id;
                new StaffLimit(isLimit.staffLimitData).save();
                assignShiftIdArr.push(saveShift._id);
                validShift.push(item);
              } else {
                item.faildMessage = `Staff timing limit is crossing for a ${isLimit.flag}`;
                item.status = 0;
                failedShift.push(item);
              }
            }
          } else {
            const isLimit = await this.checkLimit(res, item);
            let isSave = true;

            if (isLimit.limit) {
              item.isLimitExceed = true;
              item.isAllowPublish = false;
              item.alertMessage = isLimit.message;
              item.isLimit = true;
              item.schemeDetails = isLimit.details;
              item.isAlert = false;
              if (isLimit.status) {
                isSave = true;
                item.isAlert = true;
              }
            }

            if (isSave) {
              delete item.shiftScheme;
              const saveShift = await new AssignShift(item).save();

              redisBuId = saveShift.businessUnitId;
              mondayDate = this.getMondayDate(saveShift.weekRangeStartsAt);
              redisTimeZone = saveShift.timeZone
                ? saveShift.timeZone
                : 'GMT+0800';

              isLimit.staffLimitData.assignShiftId = saveShift._id;
              assignShiftIdArr.push(saveShift._id);
              new StaffLimit(isLimit.staffLimitData).save();
              item.status = 1;
              validShift.push(item);
            } else {
              // limit don't save
              item.faildMessage = `Staff timing limit is crossing for a ${isLimit.flag}`;
              item.status = 0;
              failedShift.push(item);
            }
          }
        } else {
          item.faildMessage = 'Shift is not between the week';
          item.status = 0;
          failedShift.push(item);
        }
      }

      return {
        redis: { redisBuId, mondayDate, redisTimeZone },
        failedShift,
        validShift,
      };
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async sendResponse(bodyData, res, failedShift, req, from = 1) {
    let isFailed = false;
    let isLimitExceed = false;
    let isAlert = false;

    bodyData = bodyData.filter((stf) => stf && stf.staffId);

    const { isMobile } = req.body.shift;
    const assignShiftIdArr = [];

    try {
      const totalShift = bodyData.length;
      let i = 0;
      const validShift = [];

      // let redisBuId = bodyData[0].selectedBuID;
      async.eachSeries(bodyData, async (item, next) => {
        i += 1;
        isLimitExceed = false;
        isAlert = false;
        if (item && item.staffId) {
          // ignore failed shift

          item.isLimit = false;
          item.isAlert = false;

          const weekStart = __.weekNoStartWithMonday(item.weekRangeStartsAt);
          const weekDate = __.weekNoStartWithMonday(item.date);
          const weekEnd = __.weekNoStartWithMonday(item.weekRangeEndsAt);

          if (
            weekStart === weekDate ||
            weekDate === weekEnd ||
            (new Date(item.weekRangeStartsAt).getTime() <=
              new Date(item.date).getTime() &&
              new Date(item.weekRangeEndsAt).getTime() >=
                new Date(item.date).getTime())
          ) {
            AssignShift.find({
              staff_id: item.staff_id,
              date: item.date,
              isEmpty: false,
            })
              .then(async (shiftResult) => {
                const yearDt = parseInt(
                  moment(item.date).utcOffset(-330).format('YYYY'),
                  10,
                );
                const monthDt = parseInt(
                  moment(item.date).utcOffset(-330).format('MM'),
                  10,
                );
                const dayDt = parseInt(
                  moment(item.date).utcOffset(-330).format('DD'),
                  10,
                );

                const whereDt = {
                  staff_id: item.staff_id,
                  isEmpty: true,
                  $and: [
                    { $expr: { $eq: [{ $year: '$date' }, yearDt] } },
                    { $expr: { $eq: [{ $month: '$date' }, monthDt] } },
                    { $expr: { $eq: [{ $dayOfMonth: '$date' }, dayDt] } },
                  ],
                };

                AssignShift.deleteMany(whereDt).then(() => {});
                if (shiftResult && shiftResult.length > 0) {
                  const shiftAlreadyPresent = shiftResult.filter(
                    (shiftAl) =>
                      new Date(shiftAl.startTime).getTime() ===
                        new Date(item.startTime).getTime() &&
                      new Date(shiftAl.endTime).getTime() ===
                        new Date(item.endTime).getTime(),
                  );

                  if (shiftAlreadyPresent && shiftAlreadyPresent.length > 0) {
                    item.faildMessage = 'Shift Already Present';
                    item.status = 0;
                    failedShift.push(item);
                  }

                  let shiftOverlapping = [];

                  if (shiftAlreadyPresent.length === 0) {
                    shiftOverlapping = shiftResult.filter(
                      (shiftOverl) =>
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.startTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                            new Date(item.startTime).getTime()) ||
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.endTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                            new Date(item.endTime).getTime()),
                    );
                    if (shiftOverlapping && shiftOverlapping.length > 0) {
                      item.faildMessage = 'Shift is Overlapping';
                      item.status = 0;
                      failedShift.push(item);
                    }
                  }

                  if (
                    shiftOverlapping.length === 0 &&
                    shiftAlreadyPresent.length === 0
                  ) {
                    const isLimit = await this.checkLimit(res, item);
                    let isSave = true;

                    if (isLimit.limit) {
                      isLimitExceed = true;
                      item.isAllowPublish = false;
                      item.alertMessage = isLimit.message;
                      item.isLimit = true;
                      item.schemeDetails = isLimit.details;
                      item.isAlert = false;
                      if (isLimit.status) {
                        isSave = true;
                        item.isAlert = true;
                      }
                    }

                    if (isSave) {
                      delete item.shiftScheme;
                      item.isMobile = isMobile;
                      new AssignShift(item).save().then(async (saveShift) => {
                        isLimit.staffLimitData.assignShiftId = saveShift._id;
                        new StaffLimit(isLimit.staffLimitData).save();
                        assignShiftIdArr.push(saveShift._id);
                        validShift.push(item);
                        if (i === totalShift) {
                          this.failedShiftInsert(
                            res,
                            failedShift,
                            req,
                            validShift,
                            0,
                          );
                          if (failedShift.length > 0 && !from) {
                            isFailed = true;
                          }

                          // publishshift assignShiftIdArr
                          if (isMobile) {
                            this.publishAllFromMobile(res, assignShiftIdArr);
                          }

                          // const updateResult = await this.updateRedis(
                          //   redisBuId,
                          //   true,
                          //   mondayDate,
                          //   redisTimeZone,
                          // );
                          res.json({
                            isAlert,
                            isLimitExceed,
                            isFailed,
                            status: true,
                            code: 1,
                            message: 'shift draft created successfully',
                          });
                        }

                        next();
                      });
                    } else {
                      // limit don't save
                      item.faildMessage = `Staff timing limit is crossing for a ${isLimit.flag}`;
                      item.status = 0;
                      failedShift.push(item);
                      if (i === totalShift) {
                        // const updateResult = await this.updateRedis(
                        //   redisBuId,
                        //   true,
                        //   mondayDate,
                        //   redisTimeZone,
                        // );
                        this.failedShiftInsert(
                          res,
                          failedShift,
                          req,
                          validShift,
                          0,
                        );
                        if (failedShift.length > 0 && !from) {
                          isFailed = true;
                        }

                        // publishshift assignShiftIdArr
                        if (isMobile) {
                          this.publishAllFromMobile(res, assignShiftIdArr);
                        }

                        res.json({
                          isAlert,
                          isLimitExceed,
                          isFailed,
                          status: true,
                          code: 1,
                          message: 'shift draft created successfully',
                        });
                      }
                    }
                  } else {
                    if (i === totalShift) {
                      // const updateResult = await this.updateRedis(
                      //   redisBuId,
                      //   true,
                      //   mondayDate,
                      //   redisTimeZone,
                      // );
                      this.failedShiftInsert(
                        res,
                        failedShift,
                        req,
                        validShift,
                        0,
                      );
                      if (failedShift.length > 0 && !from) {
                        isFailed = true;
                      }

                      // publishshift assignShiftIdArr
                      if (isMobile) {
                        this.publishAllFromMobile(res, assignShiftIdArr);
                      }

                      res.json({
                        isAlert,
                        isLimitExceed,
                        isFailed,
                        status: true,
                        code: 1,
                        message: 'shift draft created successfully',
                      });
                    }

                    next();
                  }
                } else {
                  const isLimit = await this.checkLimit(res, item);
                  let isSave = true;

                  if (isLimit.limit) {
                    isLimitExceed = true;
                    item.isAllowPublish = false;
                    item.alertMessage = isLimit.message;
                    item.isLimit = true;
                    item.schemeDetails = isLimit.details;
                    item.isAlert = false;
                    if (isLimit.status) {
                      isSave = true;
                      item.isAlert = true;
                    }
                    // if(!isLimit.status){
                    //     isSave = false;
                    // }else{
                    //     isAlert = true;
                    //     item.alertMessage = "Staff timing limit is crossing for a "+isLimit.flag;
                    //     item.isLimit = true;
                    //     item.schemeDetails = isLimit.details;
                    // }
                  }

                  if (isSave) {
                    delete item.shiftScheme;
                    new AssignShift(item).save().then(async (saveShift) => {
                      isLimit.staffLimitData.assignShiftId = saveShift._id;
                      assignShiftIdArr.push(saveShift._id);
                      new StaffLimit(isLimit.staffLimitData).save();

                      item.status = 1;

                      validShift.push(item);
                      if (i === totalShift) {
                        // const updateResult = await this.updateRedis(
                        //   redisBuId,
                        //   true,
                        //   mondayDate,
                        //   redisTimeZone,
                        // );
                        this.failedShiftInsert(
                          res,
                          failedShift,
                          req,
                          validShift,
                          0,
                        );
                        if (failedShift.length > 0 && !from) {
                          isFailed = true;
                        }

                        // publishshift assignShiftIdArr
                        if (isMobile) {
                          this.publishAllFromMobile(res, assignShiftIdArr);
                        }

                        res.json({
                          isAlert,
                          isFailed,
                          isLimitExceed,
                          status: true,
                          code: 1,
                          message: 'shift draft created successfully',
                        });
                        // res.json({status: false, code: 1, message:'Something went wrong'});
                        // res.json({validShift, failedShift});
                      }

                      next();
                    });
                  } else {
                    // limit don't save
                    item.faildMessage = `Staff timing limit is crossing for a ${isLimit.flag}`;
                    item.status = 0;
                    failedShift.push(item);
                    if (i === totalShift) {
                      // const updateResult = await this.updateRedis(
                      //   redisBuId,
                      //   true,
                      //   mondayDate,
                      //   redisTimeZone,
                      // );
                      this.failedShiftInsert(
                        res,
                        failedShift,
                        req,
                        validShift,
                        0,
                      );
                      if (failedShift.length > 0 && !from) {
                        isFailed = true;
                      }

                      // publishshift assignShiftIdArr
                      if (isMobile) {
                        this.publishAllFromMobile(res, assignShiftIdArr);
                      }

                      res.json({
                        isAlert,
                        isFailed,
                        isLimitExceed,
                        status: true,
                        code: 1,
                        message: 'shift draft created successfully',
                      });
                    }
                  }
                }
              })
              .catch(async () => {
                if (i === totalShift) {
                  // const updateResult = await this.updateRedis(
                  //   redisBuId,
                  //   true,
                  //   mondayDate,
                  //   redisTimeZone,
                  // );
                  this.failedShiftInsert(res, failedShift, req, validShift, 0);
                  if (failedShift.length > 0 && !from) {
                    isFailed = true;
                  }

                  // publishshift assignShiftIdArr
                  if (isMobile) {
                    this.publishAllFromMobile(res, assignShiftIdArr);
                  }

                  res.json({
                    isAlert,
                    isFailed,
                    isLimitExceed,
                    status: true,
                    code: 1,
                    message: 'shift draft created successfully',
                  });
                }

                next();
              });
          } else {
            item.faildMessage = 'Shift is not between the week';
            item.status = 0;
            failedShift.push(item);
            if (i === totalShift) {
              // const updateResult = await this.updateRedis(
              //   redisBuId,
              //   true,
              //   mondayDate,
              //   redisTimeZone,
              // );
              if (failedShift.length > 0 && !from) {
                isFailed = true;
              }

              this.failedShiftInsert(res, failedShift, req, validShift, 0);
              // publishshift assignShiftIdArr
              if (isMobile) {
                this.publishAllFromMobile(res, assignShiftIdArr);
              }

              res.json({
                isAlert,
                isFailed,
                isLimitExceed,
                status: true,
                code: 1,
                message: 'shift draft created successfully',
              });
              // res.json({validShift, failedShift});
            }

            next();
          }
        } else {
          if (i === totalShift) {
            // const updateResult = await this.updateRedis(
            //   redisBuId,
            //   true,
            //   mondayDate,
            //   redisTimeZone,
            // );
            this.failedShiftInsert(res, failedShift, req, validShift, 0);
            if (failedShift.length > 0 && !from) {
              isFailed = true;
            }

            // publishshift assignShiftIdArr
            if (isMobile) {
              this.publishAllFromMobile(res, assignShiftIdArr);
            }

            res.json({
              isAlert,
              isFailed,
              isLimitExceed,
              status: true,
              code: 1,
              message: 'shift draft created successfully',
            });
          }

          next();
        }
      });
      return res.json({
        code: 0,
        message: 'Something Went Wrong',
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async sendResponseAsRestOrOff(bodyData, res, failedShift, req, from = 1) {
    let isFailed = false;
    let isLimitExceed = false;
    let isAlert = false;

    try {
      const totalShift = bodyData.length;
      let i = 0;
      const validShift = [];

      async.eachSeries(bodyData, (item, next) => {
        i += 1;
        isLimitExceed = false;
        isAlert = false;
        if (item && item.staffId) {
          // ignore failed shift
          item.isLimit = false;
          item.isAlert = false;

          const weekStart = __.weekNoStartWithMonday(item.weekRangeStartsAt);
          const weekDate = __.weekNoStartWithMonday(item.date);
          const weekEnd = __.weekNoStartWithMonday(item.weekRangeEndsAt);

          if (
            weekStart === weekDate ||
            weekDate === weekEnd ||
            (new Date(item.weekRangeStartsAt).getTime() <=
              new Date(item.date).getTime() &&
              new Date(item.weekRangeEndsAt).getTime() >=
                new Date(item.date).getTime())
          ) {
            AssignShift.find({ staff_id: item.staff_id, date: item.date })
              .then(async (shiftResult) => {
                if (shiftResult && shiftResult.length > 0) {
                  const shiftAlreadyPresent = shiftResult.filter(
                    (shiftAl) =>
                      new Date(shiftAl.startTime).getTime() ===
                        new Date(item.startTime).getTime() &&
                      new Date(shiftAl.endTime).getTime() ===
                        new Date(item.endTime).getTime(),
                  );

                  if (shiftAlreadyPresent && shiftAlreadyPresent.length > 0) {
                    item.faildMessage = 'Shift Already Present';
                    item.status = 0;
                    failedShift.push(item);
                  }

                  let shiftOverlapping = [];

                  if (shiftAlreadyPresent.length === 0) {
                    shiftOverlapping = shiftResult.filter(
                      (shiftOverl) =>
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.startTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                            new Date(item.startTime).getTime()) ||
                        (new Date(shiftOverl.startTime).getTime() <=
                          new Date(item.endTime).getTime() &&
                          new Date(shiftOverl.endTime).getTime() >=
                            new Date(item.endTime).getTime()),
                    );
                    if (shiftOverlapping && shiftOverlapping.length > 0) {
                      item.faildMessage = 'Shift is Overlapping';
                      item.status = 0;
                      failedShift.push(item);
                    }
                  }

                  if (
                    shiftOverlapping.length === 0 &&
                    shiftAlreadyPresent.length === 0
                  ) {
                    const isLimit = await this.checkLimit(item);
                    const isSave = true;

                    if (isSave) {
                      delete item.shiftScheme;
                      new AssignShift(item).save().then(() => {
                        validShift.push(item);
                        if (i === totalShift) {
                          this.failedShiftInsert(
                            res,
                            failedShift,
                            req,
                            validShift,
                            0,
                          );
                          if (failedShift.length > 0 && !from) {
                            isFailed = true;
                          }

                          res.json({
                            isAlert,
                            isLimitExceed,
                            isFailed,
                            status: true,
                            code: 1,
                            message: 'shift draft created successfully',
                          });
                        }

                        next();
                      });
                    } else {
                      // limit don't save
                      item.faildMessage = `Staff timing limit is crossing for a ${isLimit.flag}`;
                      item.status = 0;
                      failedShift.push(item);
                      if (i === totalShift) {
                        this.failedShiftInsert(
                          res,
                          failedShift,
                          req,
                          validShift,
                          0,
                        );
                        if (failedShift.length > 0 && !from) {
                          isFailed = true;
                        }

                        res.json({
                          isAlert,
                          isLimitExceed,
                          isFailed,
                          status: true,
                          code: 1,
                          message: 'shift draft created successfully',
                        });
                      }
                    }
                  } else {
                    if (i === totalShift) {
                      this.failedShiftInsert(
                        res,
                        failedShift,
                        req,
                        validShift,
                        0,
                      );
                      if (failedShift.length > 0 && !from) {
                        isFailed = true;
                      }

                      res.json({
                        isAlert,
                        isLimitExceed,
                        isFailed,
                        status: true,
                        code: 1,
                        message: 'shift draft created successfully',
                      });
                    }

                    next();
                  }
                } else {
                  const isLimit = await this.checkLimit(item);
                  const isSave = true;

                  if (isSave) {
                    delete item.shiftScheme;
                    new AssignShift(item).save().then(() => {
                      item.status = 1;
                      validShift.push(item);
                      if (i === totalShift) {
                        this.failedShiftInsert(
                          res,
                          failedShift,
                          req,
                          validShift,
                          0,
                        );
                        if (failedShift.length > 0 && !from) {
                          isFailed = true;
                        }

                        res.json({
                          isAlert,
                          isFailed,
                          isLimitExceed,
                          status: true,
                          code: 1,
                          message: 'shift draft created successfully',
                        });
                        // res.json({status: false, code: 1, message:'Something went wrong'});
                        // res.json({validShift, failedShift});
                      }

                      next();
                    });
                  } else {
                    // limit don't save
                    item.faildMessage = `Staff timing limit is crossing for a ${isLimit.flag}`;
                    item.status = 0;
                    failedShift.push(item);
                    if (i === totalShift) {
                      this.failedShiftInsert(
                        res,
                        failedShift,
                        req,
                        validShift,
                        0,
                      );
                      if (failedShift.length > 0 && !from) {
                        isFailed = true;
                      }

                      res.json({
                        isAlert,
                        isFailed,
                        isLimitExceed,
                        status: true,
                        code: 1,
                        message: 'shift draft created successfully',
                      });
                    }
                  }
                }
              })
              .catch(() => {
                if (i === totalShift) {
                  this.failedShiftInsert(res, failedShift, req, validShift, 0);
                  if (failedShift.length > 0 && !from) {
                    isFailed = true;
                  }

                  res.json({
                    isAlert,
                    isFailed,
                    isLimitExceed,
                    status: true,
                    code: 1,
                    message: 'shift draft created successfully',
                  });
                }

                next();
              });
          } else {
            item.faildMessage = 'Shift is not between the week';
            item.status = 0;
            failedShift.push(item);
            if (i === totalShift) {
              if (failedShift.length > 0 && !from) {
                isFailed = true;
              }

              this.failedShiftInsert(res, failedShift, req, validShift, 0);
              return res.json({
                isAlert,
                isFailed,
                isLimitExceed,
                status: true,
                code: 1,
                message: 'shift draft created successfully',
              });
              // res.json({validShift, failedShift});
            }

            next();
          }
        } else {
          if (i === totalShift) {
            this.failedShiftInsert(res, failedShift, req, validShift, 0);
            if (failedShift.length > 0 && !from) {
              isFailed = true;
            }

            return res.json({
              isAlert,
              isFailed,
              isLimitExceed,
              status: true,
              code: 1,
              message: 'shift draft created successfully',
            });
          }

          return next();
        }

        return null;
      });
      return res.json({
        code: 0,
        message: 'Something Went Wrong',
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async getHourType(schemeDetails) {
    if (schemeDetails.shiftSetup.assignShift.normal) {
      return { valid: true, isOtHour: false };
    }

    return { valid: true, isOtHour: true };
  }

  async checkLimit(res, details) {
    try {
      const schemeDetails = details.shiftScheme;
      const hourTypeData = await this.getHourType(schemeDetails);
      let otDuration = 0;
      let normalDuration = 0;

      if (!hourTypeData.isOtHour) {
        normalDuration = details.duration;
      } else {
        otDuration = details.duration;
      }

      const date = new Date(details.date);
      const y = date.getFullYear();
      const m = date.getMonth();
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      const data = await StaffLimit.find({
        userId: details.staff_id,
        isAssignShift: true,
        date: {
          $lte: new Date(new Date(lastDay).toISOString()),
          $gte: new Date(new Date(firstDay).toISOString()),
        },
      }).lean();
      let dailyDuration = details.duration;
      let weeklyDuration = details.duration;
      let monthlyDuration = details.duration;
      const { weekNumber } = details;
      let dailyOverall = dailyDuration;
      let weekLlyOverall = dailyDuration;
      let monthlyOverall = dailyDuration;

      if (!hourTypeData.isOtHour) {
        data.forEach((item) => {
          if (new Date(item.date).getDate() === new Date(date).getDate()) {
            dailyDuration += item.normalDuration;
            dailyOverall += item.normalDuration;
            dailyOverall += item.otDuration;
          }

          if (new Date(item.date).getMonth() === new Date(date).getMonth()) {
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
            dailyDuration += item.otDuration;
            dailyOverall += item.otDuration;
            dailyOverall += item.normalDuration;
          }

          if (new Date(item.date).getMonth() === new Date(date).getMonth()) {
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

      let dayLimit = details.shiftScheme.shiftSetup.limits.normalHr.day;
      let weekLimit = details.shiftScheme.shiftSetup.limits.normalHr.week;
      let monthLimit = details.shiftScheme.shiftSetup.limits.normalHr.month;
      const disallow = !details.shiftScheme.shiftSetup.limits.otHr.day.disallow;

      // if(schemeDetails.shiftSchemeType == 3){
      //     disallow = !disallow;
      // }
      if (hourTypeData.isOtHour) {
        dayLimit = details.shiftScheme.shiftSetup.limits.otHr.day;
        weekLimit = details.shiftScheme.shiftSetup.limits.otHr.week;
        monthLimit = details.shiftScheme.shiftSetup.limits.otHr.month;
      }

      const dayOverallLimit = schemeDetails.shiftSetup.limits.dayOverall;
      const weekOverallLimit = schemeDetails.shiftSetup.limits.weekOverall;
      const monthOverallLimit = schemeDetails.shiftSetup.limits.monthOverall;
      const staffLimitData = {
        normalDuration,
        otDuration,
        isAssignShift: true,
        userId: details.staff_id,
        date: details.date,
        weekNumber,
        businessUnitId: details.businessUnitId,
      };

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
          staffLimitData,
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
          staffLimitData,
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
          staffLimitData,
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
          staffLimitData,
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
          staffLimitData,
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
          staffLimitData,
        };
      }

      return { limit: false, staffLimitData };
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  failedShiftInsert(res, failed, user, success = [], status = 0) {
    try {
      let d = {};
      let description = 'Uploading CSV for Draft';
      let staffId;

      if (status === 1) {
        d = user.body;
        user.body.data = {};
        user.body.data = d;
        staffId = user.user._id;
        description = 'Publishing Shift';
      } else {
        staffId = user.body.data.plannedBy;
      }

      const obj = {
        filePath: uploadFilePath,
        businessUnitId: user.body.data.businessUnitId,
        staffId,
        weekRangeEndsAt: user.body.data.weekRangeEndsAt,
        weekRangeStartsAt: user.body.data.weekRangeStartsAt,
        weekNumber: user.body.data.weekNumber,
        failedShift: failed,
        status,
        successShift: success,
        description,
      };

      return new AssignShiftLog(obj).save();
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  getBodyDataStaff(res, req) {
    try {
      return new Promise((resolve) => {
        const dataRequiredObj = {
          shift: req.body.shift,
          shiftDetails: Array.isArray(req.body.user)
            ? req.body.user
            : [req.body.user],
        };

        resolve(dataRequiredObj);
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  getBodyData(res, req) {
    try {
      return new Promise((resolve, reject) => {
        const form = new multiparty.Form();

        form.parse(req, (err, fields, files) => {
          // fields fields fields
          const pathCSV = files.ff[0].path;

          csv()
            .fromFile(pathCSV)
            .then((jsonObj) => {
              const dataRequiredObj = {
                shift: JSON.parse(fields.shift[0]),
                shiftDetails: jsonObj,
              };

              resolve(dataRequiredObj);
            })
            .catch(() => {
              reject(err);
            });
        });
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  createShift(shift) {
    return new Promise((resolve, reject) => {
      new Shift(shift)
        .save()
        .then((insertedShift) => {
          resolve(insertedShift._id);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async updateStaffAsRestOrOff(req, res) {
    try {
      const data = await AssignShift.findOneAndUpdate(
        { _id: req.body.assignShiftId },
        {
          $set: {
            isOff: req.body.isOff,
            isRest: req.body.isRest,
            duration: 0,
            startTime: null,
            endTime: null,
            startTimeInSeconds: null,
            endTimeInSeconds: null,
            isEmpty: false,
          },
        },
      );

      if (data) {
        // notificationStart
        const userId = [];

        if (data && data.shiftDetailId) {
          await ShiftDetails.findOneAndUpdate(
            { _id: data.shiftDetailId },
            {
              $set: {
                isOff: req.body.isOff,
                isRest: req.body.isRest,
                duration: 0,
                startTime: null,
                endTime: null,
                startTimeInSeconds: null,
                endTimeInSeconds: null,
                isRecalled: false,
                isRecallAccepted: 1,
              },
            },
          );
        }

        userId.push(data.staff_id);

        // const updateResult = await this.updateRedis(
        //   redisBuId,
        //   true,
        //   mondayDate,
        //   redisTimeZone,
        // );

        // this.sendNotification(userId, notificationObj, collapseKey);
        return res.json({ success: true, msg: 'Assign Shift updated' });
      }

      return res.json({ success: false, msg: 'Assign Shift not found' });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async updateStaffShift(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`assginshift/staff/update API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(`assginshift/staff/update entered malicious input `, req.body);
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['user']);

      if (requiredResult.status === false) {
        logError(
          `assginshift/staff/update API, Required fields missing `,
          requiredResult.missingFields,
        );
        logError(`assginshift/staff/update API, request payload `, req.body);
        return res.json({
          success: false,
          msg: `missing fields ${requiredResult.missingFields.toString()}`,
        });
      }

      const { user } = req.body;
      const companySetup = await pageSetting.findOne(
        { companyId: req.user.companyId },
        { opsGroup: 1 },
      );
      const tierSetup = companySetup.opsGroup.tierType;
      const callResultArr = [];

      for (let i = 0; i < user.length; i += 1) {
        const item = user[i];

        callResultArr.push(this.createDayWiseShift(res, item, tierSetup));
      }
      const callResult = await Promise.all(callResultArr);
      const obj = callResult[0];

      if (obj.success) {
        logInfo(
          `assginshift/staff/update API 'Shift is Overlapping' ends here!`,
          { name: req.user.name, staffId: req.user.staffId },
        );
        return res.json({ success: false, message: 'Shift is Overlapping' });
      }

      logInfo(`assginshift/staff/update API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return res.json({ success: true, msg: 'Assign Shift updated' });
    } catch (err) {
      logError(
        `assginshift/staff/update API, there is an error`,
        err.toString(),
      );
      return res.json({ success: false, msg: 'Something went wrong' });
    }
  }

  async createDayWiseShift(res, item, tierSetup) {
    try {
      return new Promise((resolve) => {
        // Removed 'async' keyword
        const successUpdate = [];
        const failedUpdate = [];
        const publishArr = [];
        const { timeFormat } = item;
        const startTime = this.getDateInUTCFormat(
          item.StartDate,
          item.StartTime,
          timeFormat,
        );
        const endTime = this.getDateInUTCFormat(
          item.EndDate,
          item.EndTime,
          timeFormat,
        );
        const startTimeInSeconds = moment(
          new Date(startTime),
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .unix();
        const endTimeInSeconds = moment(
          new Date(endTime),
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .unix();
        let duration = (endTimeInSeconds - startTimeInSeconds) / 3600;
        let splitStartTime = null;
        let splitEndTime = null;
        let splitStartTimeInSeconds = null;
        let splitEndTimeInSeconds = null;

        if (item.isSplitShift) {
          splitStartTime = this.getDateInUTCFormat(
            item.StartDate,
            item.splitStartTime,
            timeFormat,
          );
          splitEndTime = this.getDateInUTCFormat(
            item.EndDate,
            item.splitEndTime,
            timeFormat,
          );
          splitStartTimeInSeconds = moment(
            new Date(splitStartTime),
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
          splitEndTimeInSeconds = moment(
            new Date(splitEndTime),
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .unix(); // new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
          const startSecondSplit = new Date(splitStartTime).getTime();
          const endSecondSplit = new Date(splitEndTime).getTime();

          duration += (endSecondSplit - startSecondSplit) / 3600000;
        }

        // Inside the Promise executor function, you can still use asynchronous functions
        AssignShift.findOne({ _id: item.assignShiftId })
          .then(async (details) => {
            if (!details) {
              return res
                .status(404)
                .json({ success: false, message: 'Assign Shift Not Found' });
            }

            const bStart = new Date(startTime).getTime();
            const bEnd = new Date(endTime).getTime();
            const shiftDetails = await ShiftDetails.find({
              $or: [
                { confirmedStaffs: details.staff_id },
                { backUpStaffs: details.staff_id },
              ],
              date: details.date,
              isAssignShift: false,
            });
            const shiftOverlappingDetails = shiftDetails.filter(
              (shiftOverl) => {
                // return (new Date(shiftOverl.startTime).getTime() <= new Date(endTime).getTime() &&
                //     new Date(shiftOverl.endTime).getTime() >= new Date(startTime).getTime()
                // ) || (new Date(shiftOverl.startTime).getTime() <= new Date(endTime).getTime() &&
                //     new Date(shiftOverl.endTime).getTime() >= new Date(startTime).getTime()
                //     )
                const aStart = new Date(shiftOverl.startTime).getTime();
                const aEnd = new Date(shiftOverl.endTime).getTime();

                if (aStart <= bStart && bStart <= aEnd) return true; // b starts in a

                if (aStart <= bEnd && bEnd <= aEnd) return true; // b ends in a

                if (bStart < aStart && aEnd < bEnd) return true; // a in b

                return false;
              },
            );

            // resolve({ shiftDetails, shiftOverlappingDetails, startTime, endTime })
            if (shiftOverlappingDetails && shiftOverlappingDetails.length > 0) {
              return resolve({
                success: true,
                message: 'Shift is Overlapping',
              });
            }

            const redisBuId = details.businessUnitId;
            const mondayDate = this.getMondayDate(details.weekRangeStartsAt);
            const redisTimeZone = details.timeZone
              ? details.timeZone
              : 'GMT+0800';

            // Here, you can use async/await as needed
            const limitData = await this.checkLimitDuringTime(
              res,
              details,
              duration,
            );
            const isLimit = limitData.limit;
            const schemeDetails = limitData.details;
            const alertMessage = limitData.message;
            let isAlert = false;

            if (limitData.status) {
              isAlert = true;
            }

            const data = await AssignShift.findOneAndUpdate(
              { _id: item.assignShiftId },
              {
                $set: {
                  startTime,
                  endTime,
                  startTimeInSeconds,
                  endTimeInSeconds,
                  duration,
                  subSkillSets: item.subSkillSets,
                  reportLocationId: item.reportLocationId,
                  isOff: false,
                  mainSkillSets: item.mainSkillSets,
                  skillSetTierType: tierSetup,
                  isRest: false,
                  isLimit,
                  schemeDetails,
                  alertMessage,
                  isAlert,
                  isEmpty: false,
                  isRecallAccepted: 1,
                  isRecalled: false,
                  isMobile: !!item.isMobile,
                  isSplitShift: item.isSplitShift,
                  splitStartTime,
                  splitEndTime,
                  splitStartTimeInSeconds,
                  splitEndTimeInSeconds,
                  geoReportingLocation: item.geoReportingLocation,
                  isProximityEnabled: item.isProximityEnabled,
                  isCheckInEnabled: item.isCheckInEnabled,
                  proximity: item.proximity,
                },
              },
            );

            if (data) {
              // notificationStart
              if (data && data.shiftDetailId) {
                if (!details.isSplitShift && item.isSplitShift) {
                  const shiftDetailData = await ShiftDetails.findOne({
                    _id: data.shiftDetailId,
                  });
                  const { shiftId } = shiftDetailData;

                  await ShiftDetails.deleteMany({
                    _id: data.shiftDetailId,
                  });
                  await Shift.deleteMany({ _id: shiftId });

                  publishArr.push(data._id);
                  // before it was not split but now it is split
                } else if (details.isSplitShift && !item.isSplitShift) {
                  const shiftDetailData = await ShiftDetails.findOne({
                    _id: data.shiftDetailId,
                  });
                  const { shiftId } = shiftDetailData;

                  await Shift.deleteMany({ _id: shiftId });
                  await ShiftDetails.deleteMany({
                    draftId: data._id,
                  });

                  publishArr.push(data._id);
                  // it was split but now it is not split
                } else if (details.isSplitShift && item.isSplitShift) {
                  const shiftDetailData = await ShiftDetails.findOne({
                    _id: data.shiftDetailId,
                  });
                  const { shiftId } = shiftDetailData;

                  await Shift.deleteMany({ _id: shiftId });
                  await ShiftDetails.deleteMany({
                    draftId: data._id,
                  });

                  publishArr.push(data._id);
                  item.isMobile = true;
                  // it was split and now it is split
                } else {
                  await ShiftDetails.findOneAndUpdate(
                    { _id: data.shiftDetailId },
                    {
                      startTime,
                      endTime,
                      startTimeInSeconds,
                      endTimeInSeconds,
                      duration,
                      subSkillSets: item.subSkillSets,
                      mainSkillSets: item.mainSkillSets,
                      skillSetTierType: tierSetup,
                      reportLocationId: item.reportLocationId,
                      isOff: false,
                      isRest: false,
                      isLimit,
                      isAlert,
                      isEmpty: false,
                      isRecallAccepted: 1,
                      isRecalled: false,
                    },
                  );
                }
              }

              if (item.isMobile) {
                publishArr.push(data._id);
              }

              const userId = [];

              userId.push(data.staff_id);

              data.msg = 'Assign Shift Updated';
              successUpdate.push(data);
            } else {
              item.msg = 'Assign Shift Not Found';
              failedUpdate.push(item);
              // return res.json({success: false,msg:'Assign Shift not found'})
            }

            if (publishArr.length > 0) {
              await this.publishAllFromMobile(res, publishArr);
            }

            return resolve({ redisBuId, redisTimeZone, mondayDate });
          })
          .catch((error) => {
            __.log(error);
            return __.out(res, 500, error);
          });
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // async createDayWiseShift(res, item, tierSetup) {
  //   try {
  //     return new Promise(async (resolve, reject) => {
  //       const successUpdate = [];
  //       const failedUpdate = [];
  //       const publishArr = [];
  //       const { timeFormat } = item;
  //       const startTime = this.getDateInUTCFormat(
  //         item.StartDate,
  //         item.StartTime,
  //         timeFormat,
  //       );
  //       const endTime = this.getDateInUTCFormat(
  //         item.EndDate,
  //         item.EndTime,
  //         timeFormat,
  //       );
  //       const startTimeInSeconds = moment(
  //         new Date(startTime),
  //         'MM-DD-YYYY HH:mm:ss Z',
  //       )
  //         .utc()
  //         .unix();
  //       const endTimeInSeconds = moment(
  //         new Date(endTime),
  //         'MM-DD-YYYY HH:mm:ss Z',
  //       )
  //         .utc()
  //         .unix();
  //       let duration = (endTimeInSeconds - startTimeInSeconds) / 3600;
  //       let splitStartTime = null;
  //       let splitEndTime = null;
  //       let splitStartTimeInSeconds = null;
  //       let splitEndTimeInSeconds = null;

  //       if (item.isSplitShift) {
  //         splitStartTime = this.getDateInUTCFormat(
  //           item.StartDate,
  //           item.splitStartTime,
  //           timeFormat,
  //         );
  //         splitEndTime = this.getDateInUTCFormat(
  //           item.EndDate,
  //           item.splitEndTime,
  //           timeFormat,
  //         );
  //         splitStartTimeInSeconds = moment(
  //           new Date(splitStartTime),
  //           'MM-DD-YYYY HH:mm:ss Z',
  //         )
  //           .utc()
  //           .unix(); // new Date(bodyData.shiftDetails[asyncIndex].startTime).getTime();
  //         splitEndTimeInSeconds = moment(
  //           new Date(splitEndTime),
  //           'MM-DD-YYYY HH:mm:ss Z',
  //         )
  //           .utc()
  //           .unix(); // new Date(bodyData.shiftDetails[asyncIndex].endTime).getTime();
  //         const startSecondSplit = new Date(splitStartTime).getTime();
  //         const endSecondSplit = new Date(splitEndTime).getTime();

  //         duration += (endSecondSplit - startSecondSplit) / 3600000;
  //       }

  //       const details = await AssignShift.findOne({ _id: item.assignShiftId });
  //       const bStart = new Date(startTime).getTime();
  //       const bEnd = new Date(endTime).getTime();
  //       const shiftDetails = await ShiftDetails.find({
  //         $or: [
  //           { confirmedStaffs: details.staff_id },
  //           { backUpStaffs: details.staff_id },
  //         ],
  //         date: details.date,
  //         isAssignShift: false,
  //       });
  //       const shiftOverlappingDetails = shiftDetails.filter((shiftOverl) => {
  //         // return (new Date(shiftOverl.startTime).getTime() <= new Date(endTime).getTime() &&
  //         //     new Date(shiftOverl.endTime).getTime() >= new Date(startTime).getTime()
  //         // ) || (new Date(shiftOverl.startTime).getTime() <= new Date(endTime).getTime() &&
  //         //     new Date(shiftOverl.endTime).getTime() >= new Date(startTime).getTime()
  //         //     )
  //         const aStart = new Date(shiftOverl.startTime).getTime();
  //         const aEnd = new Date(shiftOverl.endTime).getTime();

  //         if (aStart <= bStart && bStart <= aEnd) return true; // b starts in a

  //         if (aStart <= bEnd && bEnd <= aEnd) return true; // b ends in a

  //         if (bStart < aStart && aEnd < bEnd) return true; // a in b

  //         return false;
  //       });

  //       // resolve({ shiftDetails, shiftOverlappingDetails, startTime, endTime })
  //       if (shiftOverlappingDetails && shiftOverlappingDetails.length > 0) {
  //         return resolve({ success: true, message: 'Shift is Overlapping' });
  //       }

  //       const redisBuId = details.businessUnitId;
  //       const mondayDate = this.getMondayDate(details.weekRangeStartsAt);
  //       const redisTimeZone = details.timeZone ? details.timeZone : 'GMT+0800';
  //       // const redisBuId = details.businessUnitId;
  //       const limitData = await this.checkLimitDuringTime(
  //         res,
  //         details,
  //         duration,
  //       );
  //       const isLimit = limitData.limit;
  //       const schemeDetails = limitData.details;
  //       const alertMessage = limitData.message;
  //       let isAlert = false;

  //       if (limitData.status) {
  //         isAlert = true;
  //       }

  //       const data = await AssignShift.findOneAndUpdate(
  //         { _id: item.assignShiftId },
  //         {
  //           $set: {
  //             startTime,
  //             endTime,
  //             startTimeInSeconds,
  //             endTimeInSeconds,
  //             duration,
  //             subSkillSets: item.subSkillSets,
  //             reportLocationId: item.reportLocationId,
  //             isOff: false,
  //             mainSkillSets: item.mainSkillSets,
  //             skillSetTierType: tierSetup,
  //             isRest: false,
  //             isLimit,
  //             schemeDetails,
  //             alertMessage,
  //             isAlert,
  //             isEmpty: false,
  //             isRecallAccepted: 1,
  //             isRecalled: false,
  //             isMobile: !!item.isMobile,
  //             isSplitShift: item.isSplitShift,
  //             splitStartTime,
  //             splitEndTime,
  //             splitStartTimeInSeconds,
  //             splitEndTimeInSeconds,
  //             geoReportingLocation: item.geoReportingLocation,
  //             isProximityEnabled: item.isProximityEnabled,
  //             isCheckInEnabled: item.isCheckInEnabled,
  //             proximity: item.proximity,
  //           },
  //         },
  //       );

  //       if (data) {
  //         // notificationStart
  //         if (data && data.shiftDetailId) {
  //           if (!details.isSplitShift && item.isSplitShift) {
  //             const shiftDetailData = await ShiftDetails.findOne({
  //               _id: data.shiftDetailId,
  //             });
  //             const { shiftId } = shiftDetailData;

  //             await ShiftDetails.deleteMany({
  //               _id: data.shiftDetailId,
  //             });
  //             await Shift.deleteMany({ _id: shiftId });

  //             publishArr.push(data._id);
  //             // before it was not split but now it is split
  //           } else if (details.isSplitShift && !item.isSplitShift) {
  //             const shiftDetailData = await ShiftDetails.findOne({
  //               _id: data.shiftDetailId,
  //             });
  //             const { shiftId } = shiftDetailData;

  //             await Shift.deleteMany({ _id: shiftId });
  //             await ShiftDetails.deleteMany({
  //               draftId: data._id,
  //             });

  //             publishArr.push(data._id);
  //             // it was split but now it is not split
  //           } else if (details.isSplitShift && item.isSplitShift) {
  //             const shiftDetailData = await ShiftDetails.findOne({
  //               _id: data.shiftDetailId,
  //             });
  //             const { shiftId } = shiftDetailData;

  //             await Shift.deleteMany({ _id: shiftId });
  //             await ShiftDetails.deleteMany({
  //               draftId: data._id,
  //             });

  //             publishArr.push(data._id);
  //             item.isMobile = true;
  //             // it was split and now it is split
  //           } else {
  //             await ShiftDetails.findOneAndUpdate(
  //               { _id: data.shiftDetailId },
  //               {
  //                 startTime,
  //                 endTime,
  //                 startTimeInSeconds,
  //                 endTimeInSeconds,
  //                 duration,
  //                 subSkillSets: item.subSkillSets,
  //                 mainSkillSets: item.mainSkillSets,
  //                 skillSetTierType: tierSetup,
  //                 reportLocationId: item.reportLocationId,
  //                 isOff: false,
  //                 isRest: false,
  //                 isLimit,
  //                 isAlert,
  //                 isEmpty: false,
  //                 isRecallAccepted: 1,
  //                 isRecalled: false,
  //               },
  //             );
  //           }
  //         }

  //         if (item.isMobile) {
  //           publishArr.push(data._id);
  //         }

  //         const userId = [];

  //         userId.push(data.staff_id);

  //         data.msg = 'Assign Shift Updated';
  //         successUpdate.push(data);
  //       } else {
  //         item.msg = 'Assign Shift Not Found';
  //         failedUpdate.push(item);
  //         // return res.json({success: false,msg:'Assign Shift not found'})
  //       }

  //       if (publishArr.length > 0) {
  //         await this.publishAllFromMobile(res, publishArr);
  //       }

  //       resolve({ redisBuId, redisTimeZone, mondayDate });
  //     });
  //   } catch (error) {
  //     __.log(error);
  //     return __.out(res, 500, error);
  //   }
  // }

  async updateStaffShiftRestOff(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'assignShiftId',
        'StartTime',
        'EndTime',
        'reportLocationId',
      ]);

      if (requiredResult.status === false) {
        return res.json({
          success: false,
          msg: `missing fields ${requiredResult.missingFields.toString()}`,
        });
      }

      const item = req.body;
      const { timeFormat } = item;
      const startTime = this.getDateInUTCFormat(
        item.StartDate,
        item.StartTime,
        timeFormat,
      );
      const endTime = this.getDateInUTCFormat(
        item.EndDate,
        item.EndTime,
        timeFormat,
      );
      const startTimeInSeconds = moment(
        new Date(startTime),
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .unix();
      const endTimeInSeconds = moment(
        new Date(endTime),
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .unix();
      const duration = (endTimeInSeconds - startTimeInSeconds) / 3600;
      const data = await AssignShift.findOneAndUpdate(
        { _id: item.assignShiftId },
        {
          $set: {
            startTime,
            endTime,
            startTimeInSeconds,
            endTimeInSeconds,
            duration,
            subSkillSets: item.subSkillSets,
            reportLocationId: item.reportLocationId,
          },
        },
      );

      if (data) {
        // const updateResult = await this.updateRedis(
        //   redisBuId,
        //   true,
        //   mondayDate,
        //   redisTimeZone,
        // );
        if (data.shiftDetailId) {
          const updateShift = await ShiftDetails.findOneAndUpdate(
            { _id: data.shiftDetailId },
            {
              $set: {
                startTime,
                endTime,
                startTimeInSeconds,
                endTimeInSeconds,
                duration,
                subSkillSets: item.subSkillSets,
                reportLocationId: item.reportLocationId,
              },
            },
          );

          if (updateShift) {
            return res.json({
              success: true,
              msg: 'Assign Shift and Open shift updated',
            });
          }

          return res.json({ success: true, msg: 'Assign Shift updated' });
        }

        return res.json({ success: true, msg: 'Assign Shift updated' });
      }

      return res.json({ success: false, msg: 'Assign Shift not found' });
    } catch (e) {
      return res.json({ success: false, msg: 'Something went wrong' });
    }
  }

  async read(req, res) {
    try {
      logInfo(`assginshift/read API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      await User.find(
        {
          $or: [
            { parentBussinessUnitId: req.body.businessUnitId },
            { viewBussinessUnitId: req.body.businessUnitId },
            { planBussinessUnitId: req.body.businessUnitId },
          ],
        },
        { _id: 1 },
      );

      const ddd = moment(new Date(req.body.weekRangeStartsAt))
        .utc()
        .format('MM-DD-YYYY HH:mm:ss Z');

      const year = new Date(ddd).getFullYear();
      const month = new Date(ddd).getMonth() + 1;
      const day = new Date(ddd).getDate(); // - 1; comment out for local
      const where = {
        businessUnitId: req.body.businessUnitId,
        $and: [
          { $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, year] } },
          { $expr: { $eq: [{ $month: '$weekRangeStartsAt' }, month] } },
          { $expr: { $eq: [{ $dayOfMonth: '$weekRangeStartsAt' }, day] } },
        ],
      };
      const findOrFindOne = AssignShift.find(where);
      const shifts1 = await findOrFindOne
        .select(
          'staffId staff_id staffAppointmentId staffRoleId _id date reportLocationId startTime endTime day status ' +
            'shiftChangeRequestStatus subSkillSets shiftRead draftStatus shiftChangeRequestMessage duration shiftDetailId schemeDetails alertMessage isLimit isAlert isAllowPublish isOff isRest splitStartTime splitEndTime isSplitShift isRecalled isRecallAccepted isEmpty mainSkillSets skillSetTierType geoReportingLocation proximity isCheckInEnabled isProximityEnabled',
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
          {
            path: 'reportLocationId',
            select: '_id name',
            match: {
              status: 1,
            },
          },
          {
            path: 'geoReportingLocation',
            select: '_id name',
          },
        ])
        .sort({ staffId: -1 });

      let shifts = JSON.stringify(shifts1);

      shifts = JSON.parse(shifts);
      if (shifts.length > 0) {
        const days = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];

        const promiseData = [];
        const shiftsListCall = async (item) => {
          const ops = await OpsGroup.findOne(
            { userId: item.staff_id._id },
            { _id: 1, opsGroupName: 1 },
          );
          const user = await User.findOne(
            { _id: item.staff_id._id },
            { _id: 0, role: 1, appointmentId: 1 },
          ).populate([
            {
              path: 'role',
              select: 'name',
            },
            { path: 'appointmentId', select: 'name' },
          ]);
          const attendance = await Attendance.findOne({
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

          const d = moment(new Date(item.date))
            .utcOffset(req.body.timeZone)
            .format('MM-DD-YYYY'); // new Date(item.startTime);
          const date = moment(d, 'MM-DD-YYYY');
          const dow = date.day();
          const dayName = days[dow];

          item.dayName = dayName;
          if (item.shiftDetailId && item.shiftDetailId.isExtendedShift) {
            item.startTime = item.shiftDetailId.extendedStaff[0].startDateTime;
            item.endTime = item.shiftDetailId.extendedStaff[0].endDateTime;
            item.isExtendedShift = item.shiftDetailId.isExtendedShift;
            item.shiftDetailId = item.shiftDetailId._id;
          }

          if (ops) {
            item.staff_id.opsGroupName = ops.opsGroupName;
          }
        };

        for (let i = 0; i <= shifts.length - 1; i += 1) {
          promiseData.push(shiftsListCall(shifts[i]));
        }

        await Promise.all(promiseData);

        shifts = _.mapValues(_.groupBy(shifts, 'dayName'));
        const newShifts = {
          Monday: shifts.Monday,
          Tuesday: shifts.Tuesday,
          Wednesday: shifts.Wednesday,
          Thursday: shifts.Thursday,
          Friday: shifts.Friday,
          Saturday: shifts.Saturday,
          Sunday: shifts.Sunday,
        };

        logInfo(`assginshift/read API ends here!`, {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return res.json({
          status: true,
          shifts: newShifts,
          message: 'Week Data',
        });
      }

      logInfo(`assginshift/read API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return res.json({
        status: false,
        shifts: [],
        message: 'No Week Data Found',
      });
    } catch (error) {
      logError(`assginshift/read API, there is an error`, error.toString());
      return __.out(res, 500, error);
    }
  }

  async shiftView(req, res) {
    try {
      await AssignShift.updateMany(
        { _id: { $in: req.body.assignShiftIds } },
        { shiftRead: 1 },
      );

      return res.json({ status: true, message: 'Shift Read Successfully' });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async changeRequest(req, res) {
    try {
      await AssignShift.updateMany(
        { _id: req.body.assignShiftId },
        {
          shiftRead: 1,
          shiftChangeRequestMessage: req.body.message,
          shiftChangeRequestStatus: 1,
        },
      );
      // await this.updateRedis(redisBuId)

      // const updateResult = await this.updateRedis(
      //   redisBuId,
      //   true,
      //   mondayDate,
      //   redisTimeZone,
      // );
      return res.json({ status: true, message: 'Requested Successfully' });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async approveRequest(req, res) {
    try {
      if (req.body.isApprove) {
        AssignShift.findOneAndUpdate(
          { _id: req.body.assignShiftId },
          {
            shiftRead: 0,
            shiftChangeRequestStatus: 2,
          },
          { upsert: true },
        ).then((result) => {
          if (result) {
            // this.updateRedis(redisBuId);
            // const shiftDetailId = result.
            return res.json(result);
          }

          return res.json({ status: 1, message: 'Assign Shift Not Found' });
        });
      } else {
        await AssignShift.updateMany(
          { _id: req.body.assignShiftId },
          {
            shiftRead: 0,
            shiftChangeRequestStatus: 3,
          },
        );
      }

      return res.json({ status: 0, message: 'AssignShift Updated Success' });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  getDateInUTCFormat1(date, time, timeZone) {
    const dateTime = `${date} ${time} ${timeZone}`;

    return moment(dateTime, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
  }

  async reduceLimit(res, schemeDetails, details, from = 0, limitData = null) {
    try {
      const hourTypeData = await this.getHourType(schemeDetails);
      let otDuration = 0;
      let normalDuration = 0;

      if (from === 0) {
        if (hourTypeData.isOtHour) {
          otDuration = -1 * details.duration;
        } else {
          normalDuration = -1 * details.duration;
        }
      } else if (hourTypeData.isOtHour) {
        otDuration = 1 * details.duration;
      } else {
        normalDuration = 1 * details.duration;
      }

      const value = await StaffLimit.updateOne(
        { userId: details.staff_id, assignShiftId: details._id },
        { $inc: { normalDuration, otDuration } },
      );

      if (value.matchedCount === 0 && from === 1 && limitData) {
        const obj = limitData.staffLimitData;

        obj.assignShiftId = details._id;
        const insertAppliedStaffs = await new StaffLimit(obj).save();

        await StaffLimit.updateOne(
          { _id: insertAppliedStaffs._id },
          {
            $unset: {
              splitStartTime: 1,
              splitEndTime: 1,
              startTime: 1,
              endTime: 1,
            },
          },
        );
        // limitData
      }

      return value;
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async reduceLimitDelete(res, schemeDetails, details) {
    try {
      const value = await StaffLimit.deleteMany({
        userId: details.staff_id,
        assignShiftId: details._id,
      });

      return value;
    } catch (error) {
      __.log(error);
      logError(
        `reduceLimitDelete function, there is an error`,
        error.toString(),
      );
      return __.out(res, 500, error);
    }
  }

  async checkLimitDuringTime(res, details, duration) {
    try {
      let schemeDetails = await User.findOne({
        _id: details.staff_id,
      }).populate([
        {
          path: 'schemeId',
        },
      ]);

      schemeDetails = schemeDetails.schemeId;
      // decrease duration to zero
      await this.reduceLimit(res, schemeDetails, details, 0);

      // check limit with this duration
      details.duration = duration;
      details.shiftScheme = schemeDetails;
      const limitData = await this.checkLimit(res, details);

      // add this duration to that
      await this.reduceLimit(res, schemeDetails, details, 1, limitData);

      return limitData;
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async alertAction(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`assginshift/alertaction API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (req.body.from === 'yes') {
        await AssignShift.findOneAndUpdate(
          { _id: req.body.assignShiftId },
          { isAllowPublish: true, isLimit: false, isAlert: false },
        );

        logInfo(`assginshift/alertaction API ends here!`, {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return res.json({
          status: true,
          message: 'You have selected to proceed',
        });
      }

      await AssignShift.findOneAndUpdate(
        { _id: req.body.assignShiftId },
        {
          isAllowPublish: false,
          draftStatus: 1,
          isLimit: true,
          isAlert: true,
        },
      );

      logInfo(`assginshift/alertaction API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return res.json({
        status: true,
        message: 'You have selected not to proceed',
      });
    } catch (error) {
      logError(
        `assginshift/alertaction API, there is an error`,
        error.toString(),
      );
      return __.out(res, 500, error);
    }
  }

  async changeShiftTime(req, res) {
    try {
      const dateSplit = req.body.startDateTime.split('GMT');
      let timeZone = dateSplit[1];

      timeZone = timeZone.substr(1);
      const timeFormatSign = dateSplit[1][0] === '+' ? '-' : '+';
      // dateSplit[1][0] = timeFormatSign;
      const newDate = `${dateSplit[0]}GMT${timeFormatSign}${timeZone}`;

      if (
        new Date(req.body.startDateTime).getTime() >=
        new Date(req.body.endDateTime).getTime()
      ) {
        return res.json({
          status: false,
          message: 'Assign Shift start time is grater then end time',
        });
      }

      if (new Date().getTime() > new Date(newDate).getTime()) {
        return res.json({ status: false, message: 'Assign Shift was ended' });
      }

      const result = await AssignShift.findOne({ _id: req.body.assignShiftId });

      if (result) {
        const startSecond = new Date(req.body.startDateTime).getTime();
        const endSecond = new Date(req.body.endDateTime).getTime();
        const newDuration = (endSecond - startSecond) / 3600000;
        const limitData = await this.checkLimitDuringTime(
          res,
          result,
          newDuration,
        );
        let { isLimit } = result;
        let { isAlert } = result;
        let { alertMessage } = result;
        let { schemeDetails } = result;
        let { isAllowPublish } = result;

        if (limitData.limit) {
          isLimit = true;
          isAllowPublish = false;
          // isAllowPublish
          schemeDetails = limitData.details;
          alertMessage = limitData.message;
          if (limitData.status) {
            isAlert = true;
          } else {
            isAlert = false;
          }
        } else {
          isAllowPublish = true;
          isLimit = false;
          isAlert = false;
          alertMessage = '';
        }

        AssignShift.findOneAndUpdate(
          { _id: req.body.assignShiftId },
          {
            shiftRead: 0,
            startTime: req.body.startDateTime,
            startTimeInSeconds: new Date(req.body.startDateTime).getTime(),
            endTimeInSeconds: new Date(req.body.endDateTime).getTime(),
            endTime: req.body.endDateTime,
            duration: newDuration,
            isLimit,
            isAlert,
            alertMessage,
            schemeDetails,
            isAllowPublish,
          },
          { new: true },
        ).then(async () => {
          if (!result.draftStatus) {
            return res.json({
              status: true,
              message: 'Assign Shift updated.',
              result,
            });
          }

          await ShiftDetails.findOneAndUpdate(
            { _id: result.shiftDetailId },
            {
              startTime: req.body.startDateTime,
              duration: newDuration,
              startTimeInSeconds: new Date(req.body.startDateTime).getTime(),
              endTimeInSeconds: new Date(req.body.endDateTime).getTime(),
              endTime: req.body.endDateTime,
            },
          );

          return res.json({
            status: true,
            message: 'Assign Shift updated.',
            result,
          });
        });

        const userId = [];

        userId.push(result.staff_id);
        const collapseKey = req.body.assignShiftId;
        const notificationObj = {
          title: 'Hi!',
          body: 'Your assigned shift timings have been updated.',
          bodyTime: req.body.startDateTime,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };

        this.sendNotification(res, userId, notificationObj, collapseKey);
      }

      return res.json({ status: false, message: 'Assign Shift Not Found' });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async publishAll(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`assginshift/publishAll API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      const failPublish = [];
      const insertedShift = [];
      let notificationObj = {};
      let colKey = null;
      const userIdForNotification = [];

      const allShifts = await this.getAllDraftShift(req.body.assignShiftIds);

      if (allShifts && allShifts.length > 0) {
        const weekStart = moment(allShifts[0].weekRangeStartsAt, 'DD MMM')
          .utcOffset(allShifts[0].timeZone)
          .format('DD MMMM');

        this.getMondayDate(new Date(allShifts[0].weekRangeStartsAt));
        const weekEnd = moment(allShifts[0].weekRangeEndsAt, 'DD MMM')
          .utcOffset(allShifts[0].timeZone)
          .format('DD MMMM');

        notificationObj = {
          body: `Your shifts for ${weekStart} to ${weekEnd} has been updated.`,
          title: `Hi!`,
          bodyTime: allShifts[0].date,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };

        const shiftPromises = allShifts.map(async (item) => {
          const insertShift = await this.addShift(item);

          if (insertShift) {
            const randomShiftId = new mongoose.Types.ObjectId();

            item.randomShiftId = randomShiftId;
            let insertShiftDetail = await this.addShiftDetail(
              item,
              insertShift,
            );
            let insertShiftDetailSplit;

            if (item.isSplitShift) {
              insertShiftDetailSplit = await this.addShiftDetailSplit(
                item,
                insertShift,
              );
            }

            if (insertShiftDetail) {
              const appliedStaff = await this.addAppliedStaff(
                insertShift._id,
                insertShiftDetail._id,
                item.staff_id,
              );
              let appliedStaffSplit;

              if (item.isSplitShift) {
                appliedStaffSplit = await this.addAppliedStaff(
                  insertShift._id,
                  insertShiftDetailSplit._id,
                  item.staff_id,
                );
              }

              if (appliedStaff) {
                await this.updateShift(insertShift._id, insertShiftDetail._id);

                if (item.isSplitShift) {
                  await this.updateShift(
                    insertShift._id,
                    insertShiftDetailSplit._id,
                    true,
                  );
                }

                await this.updateShiftDetail(
                  appliedStaff._id,
                  insertShiftDetail._id,
                );

                if (item.isSplitShift) {
                  await this.updateShiftDetail(
                    appliedStaffSplit._id,
                    insertShiftDetailSplit._id,
                  );
                }

                await this.updateAssignShift(insertShiftDetail._id, item._id);

                insertShiftDetail = JSON.stringify(insertShiftDetail);
                insertShiftDetail = JSON.parse(insertShiftDetail);
                insertShiftDetail.status = 1;

                const splitShiftData = await ShiftDetails.findOne({
                  draftId: insertShiftDetail.draftId,
                  isParent: 2,
                });
                let query = {};

                if (insertShiftDetail.isSplitShift) {
                  query = {
                    $set: {
                      shiftDetailId: insertShiftDetail._id,
                      shiftId: insertShift._id,
                      startTime: insertShiftDetail.startTime,
                      endTime: insertShiftDetail.endTime,
                      splitStartTime: splitShiftData?.startTime
                        ? splitShiftData.startTime
                        : null,
                      splitEndTime: splitShiftData?.endTime
                        ? splitShiftData.endTime
                        : null,
                    },
                  };
                } else {
                  query = {
                    $set: {
                      shiftDetailId: insertShiftDetail._id,
                      shiftId: insertShift._id,
                      startTime: insertShiftDetail.startTime,
                      endTime: insertShiftDetail.endTime,
                    },
                  };
                }

                await StaffLimit.updateOne({ assignShiftId: item._id }, query);

                insertShiftDetail.reportLocationName = item.reportLocationName;
                insertShiftDetail.faildMessage = 'Shift Publish Successfully';
                colKey = item._id;
                userIdForNotification.push(item.staff_id);
                insertedShift.push(insertShiftDetail);
              }
            } else {
              logError(
                `assginshift/publishAll API, there is an error`,
                'Shift Adding Error',
              );
              item.faildMessage = 'Shift Adding Error';
              item.status = 0;
              failPublish.push(item);
            }
          }
        });

        const insertedShiftResults = await Promise.all(shiftPromises);

        this.failedShiftInsert(res, failPublish, req, insertedShiftResults, 1);

        if (colKey) {
          this.sendNotification(
            res,
            userIdForNotification,
            notificationObj,
            colKey,
          );
        }

        logInfo(`assginshift/publishAll API ends here!`, {
          name: req.user.name,
          staffId: req.user.staffId,
        });

        res.json({
          status: true,
          message: 'Published Succesfully',
          code: 1,
          data: allShifts,
          insertedShift: insertedShiftResults,
        });
      } else {
        logError(
          `assginshift/publishAll API, there is an error`,
          'Something went wrong',
        );
        res.json({ status: false, message: 'Something went wrong', code: 0 });
      }
    } catch (err) {
      logError(`assginshift/publishAll API, there is an error`, err.toString());
      __.out(res, 500, err);
    }
  }

  getMondayDate(mondayDate) {
    mondayDate = new Date(mondayDate);
    if (mondayDate.getDay() !== 1) {
      const addD = (1 + 7 - mondayDate.getDay()) % 7;
      let finalAdd = addD;

      if (addD !== 1) {
        finalAdd = addD - 7;
      }

      mondayDate = new Date(
        mondayDate.setDate(mondayDate.getDate() + finalAdd),
      );
    }

    return mondayDate;
  }

  async publishAllFromMobile(res, assignShiftIds) {
    try {
      const failPublish = [];
      const insertedShift = [];
      let notificationObj = {};
      const publishUserId = [];
      const allShifts = await this.getAllDraftShift(assignShiftIds);

      if (allShifts && allShifts.length > 0) {
        const weekStart = moment(allShifts[0].weekRangeStartsAt, 'DD MMM')
          .utcOffset(allShifts[0].timeZone)
          .format('DD MMMM');

        const weekEnd = moment(allShifts[0].weekRangeEndsAt, 'DD MMM')
          .utcOffset(allShifts[0].timeZone)
          .format('DD MMMM');

        notificationObj = {
          title: 'Hi!',
          body: `Your shifts for ${weekStart} to ${weekEnd} has been updated.`,
          bodyTime: allShifts[0].date,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };

        const promises = allShifts.map(async (item) => {
          const insertShift = await this.addShift(item);

          if (insertShift) {
            const randomShiftId = new mongoose.Types.ObjectId();

            item.randomShiftId = randomShiftId;
            let insertShiftDetail = await this.addShiftDetail(
              item,
              insertShift,
            );
            let insertShiftDetailSplit;

            if (item.isSplitShift) {
              insertShiftDetailSplit = await this.addShiftDetailSplit(
                item,
                insertShift,
              );
            }

            if (insertShiftDetail) {
              const appliedStaff = await this.addAppliedStaff(
                insertShift._id,
                insertShiftDetail._id,
                item.staff_id,
              );
              let appliedStaffSplit;

              if (item.isSplitShift) {
                appliedStaffSplit = await this.addAppliedStaff(
                  insertShift._id,
                  insertShiftDetailSplit._id,
                  item.staff_id,
                );
              }

              if (appliedStaff) {
                await this.updateShift(insertShift._id, insertShiftDetail._id);

                if (item.isSplitShift) {
                  await this.updateShift(
                    insertShift._id,
                    insertShiftDetailSplit._id,
                    true,
                  );
                }

                await this.updateShiftDetail(
                  appliedStaff._id,
                  insertShiftDetail._id,
                );

                if (item.isSplitShift) {
                  await this.updateShiftDetail(
                    appliedStaffSplit._id,
                    insertShiftDetailSplit._id,
                  );
                }

                await this.updateAssignShift(insertShiftDetail._id, item._id);

                insertShiftDetail = JSON.stringify(insertShiftDetail);
                insertShiftDetail = JSON.parse(insertShiftDetail);
                insertShiftDetail.status = 1;

                await StaffLimit.updateOne(
                  { assignShiftId: item._id },
                  {
                    $set: {
                      shiftDetailId: insertShiftDetail._id,
                      shiftId: insertShift._id,
                    },
                  },
                );

                insertShiftDetail.reportLocationName = item.reportLocationName;
                insertShiftDetail.faildMessage = 'Shift Published Successfully';
                publishUserId.push(item.staff_id);
                insertedShift.push(insertShiftDetail);
              } else {
                item.faildMessage = 'Applying error';
                item.status = 0;
                failPublish.push(item);
              }
            } else {
              item.faildMessage = 'Shift Detail Adding Error';
              item.status = 0;
              failPublish.push(item);
            }
          } else {
            item.faildMessage = 'Shift Adding Error';
            item.status = 0;
            failPublish.push(item);
          }
        });

        await Promise.all(promises);

        return this.sendNotification(res, publishUserId, notificationObj, 1);
      }

      return res.json({
        status: false,
        message: 'No shifts to publish',
        code: 0,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async sendNotification(res, userId, obj, collapsekey) {
    try {
      const unAssignUser = await User.find({ _id: { $in: userId } })
        .select('_id deviceToken')
        .lean();

      const usersDeviceTokens = [];

      for (let j = 0; j <= unAssignUser.length - 1; j += 1) {
        const token = unAssignUser[j];

        if (token.deviceToken) {
          usersDeviceTokens.push(token.deviceToken);
        }
      }
      const collapseKey = collapsekey;

      return FCM.push(usersDeviceTokens, obj, collapseKey);
      // let collapseKey = 1; /*unique id for this particular ballot */
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async dateList(req, res) {
    try {
      const obj = {};

      obj.weekRangeStartsAt = moment(
        req.body.weekRangeStartsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      obj.weekRangeEndsAt = moment(
        req.body.weekRangeEndsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      obj.businessUnitId = req.body.businessUnitId;
      obj.userId = req.body.userId;
      const startDate = new Date(obj.weekRangeStartsAt);
      const endDate = new Date(obj.weekRangeEndsAt);
      const dateArray = getDates(startDate, endDate); // Assuming you have a getDates function defined

      const result = await AssignShift.find(
        {
          staff_id: obj.userId,
          businessUnitId: obj.businessUnitId,
          weekRangeStartsAt: obj.weekRangeStartsAt,
          weekRangeEndsAt: obj.weekRangeEndsAt,
        },
        { day: 1, _id: 0 },
      );

      const userDate = result.map((item) => item.day);
      const shiftNotPresent = diffArray(dateArray, userDate);

      return res.json({ data: result, dateArray, userDate, shiftNotPresent });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getRole(req, res) {
    try {
      const where = {
        companyId: req.user.companyId,
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.roleId) {
        where._id = req.body.roleId;
        findOrFindOne = Appointment.findOne(where);
      } else findOrFindOne = Appointment.find(where);

      const roles = await findOrFindOne.lean();

      __.out(res, 201, {
        roles,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async readLog(req, res) {
    try {
      logInfo(`assginshift/log API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      const where = {
        businessUnitId: req.body.businessUnitId,
      };
      const data = await AssignShiftLog.find(where)
        .populate([
          {
            path: 'staff_id',
            select: 'name staffId',
          },
        ])
        .sort({ _id: -1 });

      logInfo(`assginshift/log API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return res.json({ status: true, data });
    } catch (err) {
      logError(`assginshift/log API, there is an error`, err.toString());
      return __.out(res, 500, err);
    }
  }

  async updateAssignShift(shiftDetailId, assginShiftId) {
    try {
      const result = await AssignShift.updateOne(
        {
          _id: assginShiftId,
        },
        {
          $set: {
            shiftDetailId,
            draftStatus: 1,
          },
        },
      );

      return result;
    } catch (err) {
      logError(`there is an error`, err.toString());
      return __.out(500, err);
    }
  }

  getAllDraftShift(shiftId) {
    return new Promise((resolve, reject) => {
      AssignShift.find({ _id: { $in: shiftId } })
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  addAppliedStaff(shiftId, shiftDetailsId, flexiStaff) {
    return new Promise((resolve, reject) => {
      const obj = {
        shiftId,
        shiftDetailsId,
        flexiStaff,
        status: 1,
      };

      new AppliedStaff(obj)
        .save()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  addShift(shift) {
    return new Promise((resolve, reject) => {
      const shiftObj = {
        businessUnitId: shift.businessUnitId,
        weekRangeStartsAt: shift.weekRangeStartsAt,
        weekRangeEndsAt: shift.weekRangeEndsAt,
        weekNumber: shift.weekNumber,
        plannedBy: shift.plannedBy,
        status: 1,
      };

      new Shift(shiftObj)
        .save()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  updateShift(shiftId, shiftDetailId, isSplitShift = false) {
    return new Promise((resolve, reject) => {
      if (!isSplitShift) {
        const insertedShiftDetailsIdArray = [];

        insertedShiftDetailsIdArray.push(shiftDetailId);
        Shift.updateOne(
          {
            _id: shiftId,
          },
          {
            $set: {
              shiftDetails: insertedShiftDetailsIdArray,
            },
          },
        )
          .then((result) => {
            resolve(result);
          })
          .catch((err) => {
            reject(err);
          });
      } else {
        Shift.updateOne(
          {
            _id: shiftId,
          },
          {
            $push: {
              shiftDetails: shiftDetailId,
            },
          },
        )
          .then((result) => {
            resolve(result);
          })
          .catch((err) => {
            reject(err);
          });
      }
    });
  }

  addShiftDetail(shiftDetail, shift) {
    return new Promise((resolve, reject) => {
      const shiftObj = {
        date: shiftDetail.date,
        startTime: shiftDetail.startTime,
        endTime: shiftDetail.endTime,
        reportLocationId: shiftDetail.reportLocationId,
        startTimeInSeconds: shiftDetail.startTimeInSeconds,
        endTimeInSeconds: shiftDetail.endTimeInSeconds,
        shiftId: shift._id,
        duration: shiftDetail.duration,
        day: shiftDetail.day,
        confirmedStaffs: shiftDetail.confirmedStaffs,
        subSkillSets: shiftDetail.subSkillSets,
        mainSkillSets: shiftDetail.mainSkillSets,
        skillSetTierType: shiftDetail.skillSetTierType,
        isAssignShift: true,
        draftId: shiftDetail._id,
        backUpStaffNeedCount: 0,
        staffNeedCount: 1,
        totalStaffNeedCount: 1,
        status: 1,
        isOff: shiftDetail.isOff,
        isRest: shiftDetail.isRest,
        isSplitShift: shiftDetail.isSplitShift,
        geoReportingLocation: shiftDetail.geoReportingLocation,
        proximity: shiftDetail.proximity,
        isCheckInEnabled: shiftDetail.isCheckInEnabled,
        isProximityEnabled: shiftDetail.isProximityEnabled,
        isParent: shiftDetail.isSplitShift ? 1 : null,
        randomShiftId: shiftDetail.isSplitShift
          ? shiftDetail.randomShiftId
          : null,
      };

      new ShiftDetails(shiftObj)
        .save()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  addShiftDetailSplit(shiftDetail, shift) {
    return new Promise((resolve, reject) => {
      const shiftObj = {
        date: shiftDetail.date,
        startTime: shiftDetail.splitStartTime,
        endTime: shiftDetail.splitEndTime,
        reportLocationId: shiftDetail.reportLocationId,
        startTimeInSeconds: shiftDetail.splitStartTimeInSeconds,
        endTimeInSeconds: shiftDetail.splitEndTimeInSeconds,
        shiftId: shift._id,
        duration: shiftDetail.duration,
        day: shiftDetail.day,
        confirmedStaffs: shiftDetail.confirmedStaffs,
        subSkillSets: shiftDetail.subSkillSets,
        mainSkillSets: shiftDetail.mainSkillSets,
        skillSetTierType: shiftDetail.skillSetTierType,
        isAssignShift: true,
        draftId: shiftDetail._id,
        backUpStaffNeedCount: 0,
        staffNeedCount: 1,
        totalStaffNeedCount: 1,
        status: 1,
        isOff: shiftDetail.isOff,
        isRest: shiftDetail.isRest,
        isSplitShift: true,
        isParent: 2,
        randomShiftId: shiftDetail.randomShiftId,
      };

      new ShiftDetails(shiftObj)
        .save()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  updateShiftDetail(appliedId, shiftDetailId) {
    return new Promise((resolve, reject) => {
      const insertedShiftDetailsIdArray = [];

      insertedShiftDetailsIdArray.push(appliedId);
      ShiftDetails.updateOne(
        {
          _id: shiftDetailId,
        },
        {
          $set: {
            appliedStaffs: insertedShiftDetailsIdArray,
          },
        },
      )
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async getStaffById(req, res) {
    try {
      logInfo(`assginshift/stafflist/:staffId API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      let user = await User.findOne(
        {
          staffId: req.params.staffId,
          companyId: req.user.companyId,
          status: 1,
        },
        {
          _id: 1,
          mainSkillSets: 1,
          subSkillSets: 1,
        },
      ).populate([
        { path: 'mainSkillSets', select: 'name' },
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
          path: 'schemeId',
          select: 'shiftSchemeType shiftSetup',
        },
      ]);
      const companySetup = await pageSetting.findOne(
        { companyId: req.user.companyId },
        { opsGroup: 1 },
      );
      const tierSetup = companySetup.opsGroup.tierType;

      user = JSON.parse(JSON.stringify(user));
      if (tierSetup === 1) {
        delete user.subSkillSets;
      } else {
        delete user.mainSkillSets;
      }

      logInfo(`assginshift/stafflist/:staffId API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      res.json({
        status: true,
        isScheme: true,
        user,
        message: 'Week Data',
      });
    } catch (err) {
      logError(
        `assginshift/stafflist/:staffId API, there is an error`,
        err.toString(),
      );
      __.out(res, 500, err);
    }
  }

  async deleteShift(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`assginshift/staff/delete API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      const { assignShiftId } = req.body;

      if (assignShiftId.length === 1) {
        this.deleteShiftSingle(req, res);
      } else {
        const { userId } = req.body;

        const schemeDetails = await User.findOne({ _id: userId }).populate([
          {
            path: 'schemeId',
          },
        ]);

        const deleleResultArr = [];

        for (let i = 0; i < assignShiftId.length; i += 1) {
          const id = assignShiftId[i];

          deleleResultArr.push(
            this.deleteMultiple(res, id, userId, i, schemeDetails),
          );
        }
        await Promise.all(deleleResultArr);

        logInfo(`assginshift/staff/delete API ends here!`, {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return res
          .status(200)
          .json({ success: true, msg: 'Deleted Successfully' });
      }

      return null;
    } catch (err) {
      logError(
        `assginshift/staff/delete API, there is an error`,
        err.toString(),
      );
      return res
        .status(500)
        .json({ success: false, msg: 'Something went wrong' });
    }
  }

  async deleteMultiple(res, id, userId, i, schemeDetails) {
    try {
      const assignShiftData = await AssignShift.findOneAndRemove({
        _id: id,
        staff_id: userId,
      });

      if (
        assignShiftData &&
        !assignShiftData.isEmpty &&
        assignShiftData.duration !== 0
      ) {
        const reducedData = await this.reduceLimitDelete(
          res,
          schemeDetails.schemeId,
          assignShiftData,
        );

        if (reducedData && reducedData.shiftDetailId) {
          const shiftDetailData = await ShiftDetails.findOneAndRemove({
            _id: reducedData.shiftDetailId,
          });

          if (shiftDetailData) {
            await Shift.findOneAndRemove({
              _id: shiftDetailData.shiftId,
            });
          }
        }

        const redisBuId = assignShiftData.businessUnitId;
        const mondayDate = this.getMondayDate(
          assignShiftData.weekRangeStartsAt,
        );
        const redisTimeZone = assignShiftData.timeZone || 'GMT+0800';

        return { redisBuId, mondayDate, redisTimeZone };
      }

      return null;
    } catch (err) {
      logError(`there is an error`, err.toString());
      return res
        .status(500)
        .json({ success: false, msg: 'Something went wrong' });
    }
  }

  async deleteShiftSingle(req, res) {
    try {
      logInfo(`assginshift/staff/delete/single API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      const { assignShiftId } = req.body;
      const { userId } = req.body;
      const schemeDetails = await User.findOne({ _id: userId }).populate([
        {
          path: 'schemeId',
        },
      ]);

      const id = assignShiftId[0];

      const assignShiftData = await AssignShift.findOneAndUpdate(
        { _id: id, staff_id: userId },
        {
          startTime: null,
          endTime: null,
          startTimeInSeconds: null,
          endTimeInSeconds: null,
          duration: 0,
          subSkillSets: [],
          reportLocationId: null,
          isOff: false,
          isRest: false,
          isLimit: null,
          schemeDetails: null,
          alertMessage: null,
          isAlert: null,
          isEmpty: true,
          draftStatus: 0,
        },
      );

      if (
        assignShiftData &&
        !assignShiftData.isEmpty &&
        assignShiftData.duration !== 0
      ) {
        await this.reduceLimitDelete(
          res,
          schemeDetails.schemeId,
          assignShiftData,
        );
      }

      if (assignShiftData && assignShiftData.shiftDetailId) {
        const shiftDetailData = await ShiftDetails.findOneAndRemove({
          _id: assignShiftData.shiftDetailId,
        });

        if (shiftDetailData) {
          await Shift.findOneAndRemove({
            _id: shiftDetailData.shiftId,
          });
        }
      }

      logInfo(`assginshift/staff/delete/single API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return res
        .status(200)
        .json({ success: true, msg: 'Deleted Single Shift Successfully' });
    } catch (err) {
      logError(
        `assginshift/staff/delete/single API, there is an error`,
        err.toString(),
      );
      return res
        .status(500)
        .json({ success: false, msg: 'Something went wrong' });
    }
  }

  async readTierSetup(req, res) {
    try {
      const pageSettingData = await pageSetting.findOne(
        {
          companyId: req.user.companyId,
          status: 1,
        },
        { opsGroup: 1 },
      );
      const { tierType } = pageSettingData.opsGroup;

      return res.status(200).json({ tierType });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
/* */
const assignShift = new AssignShiftController();

module.exports = assignShift;
