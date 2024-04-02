// Controller Code Starts here
const mongoose = require('mongoose');
const moment = require('moment');
const _ = require('lodash');
const { validationResult } = require('express-validator');
const Template = require('../../models/template');
const shiftLogController = require('./shiftLogController');
const businessUnitController = require('./businessUnitController');
const { logInfo, logError } = require('../../../helpers/logger.helper');
const __ = require('../../../helpers/globalFunctions');

function objectsAreSameCall(x1, y1) {
  let objectsAreSame = true;

  // var objectsAreSame = true;
  for (let xy = 0; xy < x1.length; xy += 1) {
    if (
      x1[xy].mainName !== y1[xy].mainName &&
      x1[xy].subName !== y1[xy].subName
    ) {
      objectsAreSame = false;
      break;
    }
  }
  return objectsAreSame;
}

class TemplateController {
  async createOrUpdate(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo('template/create api Start!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `template/create API, there is something wrong in request payload`,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult1 = await __.checkRequiredFields(
        req,
        ['businessUnitId', 'weekRangeStartsAt', 'weekRangeEndsAt', 'shifts'],
        'shift',
      );

      if (requiredResult1.status === false) {
        logError(
          `template/create API, Required fields missing `,
          requiredResult1.missingFields,
        );
        logError(`template/create API, request payload `, req.body);
        return __.out(res, 400, requiredResult1.missingFields);
      }

      // Formatting Shift based on below functionalities
      const shiftsNewFormat = [];
      let isSplitShift = false;
      const separateShiftPerDay = function () {
        for (const elementData of req.body.shifts) {
          const uniqueId = new mongoose.Types.ObjectId();

          for (const elem of elementData.dayDate) {
            if (elem.isSplitShift) {
              isSplitShift = true;
            }

            const shiftSeparated = {
              subSkillSets: elementData.subSkillSets,
              mainSkillSets: elementData.mainSkillSets,
              skillSetTierType: elementData.skillSetTierType,
              staffNeedCount: elementData.staffNeedCount,
              backUpStaffNeedCount: elementData.backUpStaffNeedCount || 0,
              date: elem.date,
              day: elem.day,
              isSplitShift: elem.isSplitShift,
              startTime: elem.startTime,
              endTime: elem.endTime,
              reportLocationId: elementData.reportLocationId,
              status: elementData.status,
              splitStartTime: elem.splitStartTime,
              splitEndTime: elem.splitEndTime,
              _id: new mongoose.Types.ObjectId(),
              uniqueId,
            };

            shiftsNewFormat.push(shiftSeparated);
          }
        }
        req.body.shifts = shiftsNewFormat;
      };

      if (req.body.platform && req.body.platform === 'web') {
        separateShiftPerDay();
      }

      let requiredResult2;

      /* check required fields in shifts array of objects */
      if (req.body.skillSetTierType !== 1) {
        requiredResult2 = await __.customCheckRequiredFields(
          req.body.shifts,
          [
            'subSkillSets',
            'staffNeedCount',
            'backUpStaffNeedCount',
            'date',
            'startTime',
            'endTime',
            'reportLocationId',
            'status',
          ],
          'shiftDetails',
        );
      } else {
        requiredResult2 = await __.customCheckRequiredFields(
          req.body.shifts,
          [
            'mainSkillSets',
            'staffNeedCount',
            'backUpStaffNeedCount',
            'date',
            'startTime',
            'endTime',
            'reportLocationId',
            'status',
          ],
          'shiftDetails',
        );
      }

      if (requiredResult2.status === false) {
        logError(
          `template/create API, Required fields missing `,
          requiredResult2.missingFields,
        );
        logError(`template/create API, request payload `, req.body);
        return __.out(res, 400, requiredResult2.missingFields);
      }

      /* compose the date variables */
      const weekRangeStartsAt = moment(
        req.body.weekRangeStartsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      const weekRangeEndsAt = moment(
        req.body.weekRangeEndsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      const weekNumber = await __.weekNoStartWithMonday(weekRangeStartsAt);

      const composeShiftsFn = (shifts) => {
        const composedShiftsArray = [];

        for (const shiftObj of shifts) {
          /* converting to utc time */
          shiftObj.date = moment(shiftObj.date, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
          shiftObj.startTime = moment(
            shiftObj.startTime,
            'MM-DD-YYYY HH:mm:ss Z',
          )
            .utc()
            .format();
          shiftObj.endTime = moment(shiftObj.endTime, 'MM-DD-YYYY HH:mm:ss Z')
            .utc()
            .format();
          shiftObj.startTimeInSeconds = moment(shiftObj.startTime).unix();
          shiftObj.endTimeInSeconds = moment(shiftObj.endTime).unix();
          shiftObj.totalStaffNeedCount =
            Number(shiftObj.staffNeedCount) +
            Number(shiftObj.backUpStaffNeedCount);
          composedShiftsArray.push(shiftObj);
        }
        return composedShiftsArray;
      };

      const composedShifts = await composeShiftsFn(req.body.shifts);
      const insertOrUpdateObj = {
        businessUnitId: req.body.businessUnitId,
        weekNumber,
        weekRangeStartsAt,
        weekRangeEndsAt,
        plannedBy: req.user._id,
        isSplitShift,
        shifts: composedShifts,
        status: 1,
      };
      const statusLogData = {
        userId: req.user._id,
        weekNumber,
        weekRangeStartsAt,
        weekRangeEndsAt,
        businessUnitId: req.body.businessUnitId,
      };

      if (req.body.templateId) {
        const templateId = {
          _id: req.body.templateId,
        };

        delete req.body.templateId;
        delete insertOrUpdateObj.name;
        const templateDoc = await Template.findOneAndUpdate(
          templateId,
          {
            $set: insertOrUpdateObj,
          },
          {
            new: true,
            setDefaultsOnInsert: true,
          },
        );

        req.body.templateId = templateDoc._id;
        statusLogData.status = 4; /* temaplate updated */
      } else {
        /* insert */
        delete req.body.templateId;
        const countTemplatesForGivenWeek = await Template.count({
          plannedBy: req.user._id,
          businessUnitId: req.body.businessUnitId,
        }).lean();
        const data = {
          businessUnitId: req.body.businessUnitId,
        };

        const businessUnitName = await businessUnitController.getName(
          data,
          res,
        );

        const templateName = `${req.user.name}_${businessUnitName}_${
          countTemplatesForGivenWeek + 1
        }`;

        insertOrUpdateObj.name = templateName;
        __.log(insertOrUpdateObj);
        const templateDoc = await new Template(insertOrUpdateObj).save();

        req.body.templateId = templateDoc._id;
        statusLogData.status = 3; /* tempalte created */
      }

      shiftLogController.create(statusLogData, res); /* log insert */
      logInfo('template/create api ends!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, 'Template created successfully');
    } catch (err) {
      logError(`template/create API, there is an error `, err.toString());
      __.log(err);
      return __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);

      if (requiredResult1.status === false) {
        return __.out(res, 400, requiredResult1.missingFields);
      }

      /* compose the date variables */
      const where = {
        status: 1,
        businessUnitId: req.body.businessUnitId,
        // plannedBy: req.user._id,
      };
      let findOrFindOne;

      if (req.body.templateId) {
        where._id = req.body.templateId;
        findOrFindOne = Template.findOne(where);
      } else findOrFindOne = Template.find(where);

      const templates = await findOrFindOne
        .select('-__v -createdAt -updatedAt -shifts._id')
        .populate([
          {
            path: 'plannedBy',
            select: 'name staffId',
          },
          {
            path: 'businessUnitId',
            select: 'name status',
            populate: {
              path: 'sectionId',
              select: 'name status',
              populate: {
                path: 'departmentId',
                select: 'name status',
                populate: {
                  path: 'companyId',
                  select: 'name status',
                },
              },
            },
          },
        ])
        .populate({
          path: 'shifts.reportLocationId',
          select: 'name status',
        })
        .populate({
          path: 'shifts.subSkillSets',
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
        })
        .populate({
          path: 'shifts.mainSkillSets',
          select: 'name status',
          match: {
            status: 1,
          },
        })
        .lean();

      let result;

      if (Array.isArray(templates)) {
        result = templates;
      } else {
        const listData = {};
        const graphData = {};
        const graphDataWeb = {};
        const dashboardGraphData = {
          plannedFlexiHours: 0,
          plannedFlexiShifts: 0,
        };
        const customShiftDetails = [];
        const timeZone = moment
          .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
          .format('Z');

        await templates.shifts.forEach((element) => {
          if (
            (element.mainSkillSets.length || element.subSkillSets.length) &&
            element.reportLocationId
          ) {
            const key = __.getDateStringFormat(element.date, timeZone);
            const duration = __.getDurationInHours(
              element.startTime,
              element.endTime,
            );

            /* dashboard graph data starts */
            dashboardGraphData.plannedFlexiHours +=
              element.staffNeedCount * duration;
            dashboardGraphData.plannedFlexiShifts += element.staffNeedCount;
            /* dashboard graph data ends */
            if (listData[key]) {
              /* if date already keyed in array */
              listData[key].push(element);
              graphData[key].totalHours += duration * element.staffNeedCount;
              graphData[key].totalShifts += element.staffNeedCount;
              graphDataWeb[key].totalHours.need +=
                duration * element.staffNeedCount;
              graphDataWeb[key].numberOfShifts.need += element.staffNeedCount;
              graphDataWeb[key].numberOfShifts.backup +=
                element.backUpStaffNeedCount;
            } else {
              /* else create a new key by date in array */
              listData[key] = [];
              graphData[key] = {};
              listData[key].push(element);
              graphData[key].totalHours = duration * element.staffNeedCount;
              graphData[key].totalShifts = element.staffNeedCount;
              graphDataWeb[key] = {
                totalHours: {
                  need: duration * element.staffNeedCount,
                },
                numberOfShifts: {
                  need: element.staffNeedCount,
                  backup: element.backUpStaffNeedCount,
                },
              };
            }

            const customElement = _.omit(element, [
              'shiftId',
              'reportLocationId',
              'subSkillSets',
              'mainSkillSets',
            ]);

            customShiftDetails.push(customElement);
          }
        });
        /* weeklyGraph starts */
        const staffNeedWeekdaysObj = {
          monday: {},
          tuesday: {},
          wednesday: {},
          thursday: {},
          friday: {},
          saturday: {},
          sunday: {},
        };
        const mondayOfShift = moment(
          customShiftDetails[0].startTimeInSeconds * 1000,
        )
          .startOf('isoweek')
          .format();
        const sundayOfShift = moment(mondayOfShift)
          .add(6, 'days')
          .add(23, 'hours')
          .add(59, 'minutes')
          .add(59, 'seconds')
          .utc()
          .format();
        const startUnixDateTime = moment(mondayOfShift).unix();
        const endUnixDateTime = moment(sundayOfShift).unix();

        const promiseData = [];
        const unixDateTimeCall = async (i) => {
          const dateTimeUnix = i * 1000;

          await customShiftDetails.forEach(async (element) => {
            const weekDay = __.getDayStringFormatFromUnix(i, timeZone);
            let staffNeedCount = 0;

            if (
              i >= element.startTimeInSeconds &&
              i <= element.endTimeInSeconds
            ) {
              /* shift matches the time then it will take the count else it will assign 0 by default */
              staffNeedCount = element.staffNeedCount;
            }

            if (
              typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !== 'undefined'
            ) {
              /* dont change to if condition bcoz it may be zero so it fails in it */
              staffNeedWeekdaysObj[weekDay][dateTimeUnix] += staffNeedCount;
            } else {
              staffNeedWeekdaysObj[weekDay][dateTimeUnix] = staffNeedCount;
            }
          });
        };

        for (let i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
          promiseData.push(unixDateTimeCall(i));
        }

        await Promise.all(promiseData);
        const formattedNeedStaffData = {};

        for (const needElement of Object.keys(staffNeedWeekdaysObj)) {
          formattedNeedStaffData[needElement] = [];
          for (const time of Object.keys(staffNeedWeekdaysObj[needElement])) {
            const array = [
              Number(time),
              Number(staffNeedWeekdaysObj[needElement][time]),
            ];

            formattedNeedStaffData[needElement].push(array);
          }
        }
        const weeklyStaffGraphData = {
          formattedNeedStaffData,
        };

        /* weeklyGraph ends */
        result = {
          template: templates,
          listData,
          graphData,
          graphDataWeb,
          dashboardGraphData,
          weeklyStaffGraphData,
        };
      }

      return __.out(res, 201, {
        templates: result,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async exportTemplateDataForBu(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
        'date',
      ]);

      if (requiredResult1.status === false) {
        __.out(res, 400, requiredResult1.missingFields);
      } else {
        const where = {
          status: 1,
          businessUnitId: req.body.businessUnitId,
        };
        let findOrFindOne;

        if (req.body.templateId) {
          where._id = req.body.templateId;
          findOrFindOne = Template.findOne(where);
        } else findOrFindOne = Template.find(where);

        const templates = await findOrFindOne
          .select('-__v -createdAt -updatedAt -shifts._id')
          .populate([
            {
              path: 'plannedBy',
              select: 'name staffId',
            },
            {
              path: 'businessUnitId',
              select: 'name status',
              populate: {
                path: 'sectionId',
                select: 'name status',
                populate: {
                  path: 'departmentId',
                  select: 'name status',
                  populate: {
                    path: 'companyId',
                    select: 'name status',
                  },
                },
              },
            },
          ])
          .populate({
            path: 'shifts.reportLocationId',
            select: 'name status',
          })
          .populate({
            path: 'shifts.subSkillSets',
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
          })
          .populate({
            path: 'shifts.mainSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          })
          .lean();
        // send template graph data only for findOne

        if (!Array.isArray(templates)) {
          const listData = {};
          const graphData = {};
          const graphDataWeb = {};
          const dashboardGraphData = {
            plannedFlexiHours: 0,
            plannedFlexiShifts: 0,
          };
          const customShiftDetails = [];
          const timeZone = moment
            .parseZone(req.body.date, 'MM-DD-YYYY HH:mm:ss Z')
            .format('Z');

          await templates.shifts.forEach((element) => {
            if (
              (element.mainSkillSets.length || element.subSkillSets.length) &&
              element.reportLocationId
            ) {
              const key = __.getDateStringFormat(element.date, timeZone);
              const duration = __.getDurationInHours(
                element.startTime,
                element.endTime,
              );

              /* dashboard graph data starts */
              dashboardGraphData.plannedFlexiHours +=
                element.staffNeedCount * duration;
              dashboardGraphData.plannedFlexiShifts += element.staffNeedCount;
              /* dashboard graph data ends */
              if (listData[key]) {
                /* if date already keyed in array */
                listData[key].push(element);
                graphData[key].totalHours += duration * element.staffNeedCount;
                graphData[key].totalShifts += element.staffNeedCount;
                graphDataWeb[key].totalHours.need +=
                  duration * element.staffNeedCount;
                graphDataWeb[key].numberOfShifts.need += element.staffNeedCount;
                graphDataWeb[key].numberOfShifts.backup +=
                  element.backUpStaffNeedCount;
              } else {
                /* else create a new key by date in array */
                listData[key] = [];
                graphData[key] = {};
                listData[key].push(element);
                graphData[key].totalHours = duration * element.staffNeedCount;
                graphData[key].totalShifts = element.staffNeedCount;
                graphDataWeb[key] = {
                  totalHours: {
                    need: duration * element.staffNeedCount,
                  },
                  numberOfShifts: {
                    need: element.staffNeedCount,
                    backup: element.backUpStaffNeedCount,
                  },
                };
              }

              const customElement = _.omit(element, [
                'shiftId',
                'reportLocationId',
                'subSkillSets',
                'mainSkillSets',
              ]);

              customShiftDetails.push(customElement);
            }
          });
          /* weeklyGraph starts */
          const staffNeedWeekdaysObj = {
            monday: {},
            tuesday: {},
            wednesday: {},
            thursday: {},
            friday: {},
            saturday: {},
            sunday: {},
          };
          const mondayOfShift = moment(
            customShiftDetails[0].startTimeInSeconds * 1000,
          )
            .startOf('isoweek')
            .format();
          const sundayOfShift = moment(mondayOfShift)
            .add(6, 'days')
            .add(23, 'hours')
            .add(59, 'minutes')
            .add(59, 'seconds')
            .utc()
            .format();
          const startUnixDateTime = moment(mondayOfShift).unix();
          const endUnixDateTime = moment(sundayOfShift).unix();

          const promiseData = [];
          const unixDateTimeCall = async (i) => {
            const dateTimeUnix = i * 1000;

            await customShiftDetails.forEach(async (element) => {
              const weekDay = __.getDayStringFormatFromUnix(i, timeZone);
              let staffNeedCount = 0;

              if (
                i >= element.startTimeInSeconds &&
                i <= element.endTimeInSeconds
              ) {
                /* shift matches the time then it will take the count else it will assign 0 by default */
                staffNeedCount = element.staffNeedCount;
              }

              if (
                typeof staffNeedWeekdaysObj[weekDay][dateTimeUnix] !==
                'undefined'
              ) {
                /* dont change to if condition bcoz it may be zero so it fails in it */
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] += staffNeedCount;
              } else {
                staffNeedWeekdaysObj[weekDay][dateTimeUnix] = staffNeedCount;
              }
            });
          };

          for (let i = startUnixDateTime; i <= endUnixDateTime; i += 1800) {
            promiseData.push(unixDateTimeCall(i));
          }

          await Promise.all(promiseData);

          const formattedNeedStaffData = {};

          for (const needElement of Object.keys(staffNeedWeekdaysObj)) {
            formattedNeedStaffData[needElement] = [];
            for (const time of Object.keys(staffNeedWeekdaysObj[needElement])) {
              const array = [
                Number(time),
                Number(staffNeedWeekdaysObj[needElement][time]),
              ];

              formattedNeedStaffData[needElement].push(array);
            }
          }

          /* weeklyGraph ends */
        }

        const finalData = [];
        const $scope = {
          selectTemplate: templates,
          fullDataCreateDummy: {
            location: '',
            'Template Name': '',
            'Confirmed count': '',
            shifts: [],
            status: '1',
            businessUnitName: '',
          },
        };
        let a;

        for (let index = 0; index < $scope.selectTemplate.length; index += 1) {
          const ShiftData = [];

          $scope.fullDataCreateDummy = {
            location: '',
            'Template Name': '',
            'Confirmed count': '',
            shifts: [],
            status: '1',
            businessUnitName: '',
            name: $scope.selectTemplate[index].name,
          };
          for (a = 0; a < $scope.selectTemplate[index].shifts.length; a += 1) {
            const aaaa = $scope.selectTemplate[index].shifts[a];
            const tempStartDate = moment(aaaa.endTime, 'YYYY-MM-DD').format(
              'MM-DD-YYYY',
            );
            const tempEndDate = moment(aaaa.endTime, 'YYYY-MM-DD').format(
              'MM-DD-YYYY',
            );
            const { backUpStaffNeedCount } =
              $scope.selectTemplate[index].shifts[a];
            const reportLocationId =
              $scope.selectTemplate[index].shifts[a].reportLocationId._id;
            const reportLocationName =
              $scope.selectTemplate[index].shifts[a].reportLocationId.name;
            const { staffNeedCount } = $scope.selectTemplate[index].shifts[a];
            const { status } = $scope.selectTemplate[index].shifts[a];

            let mainSkillSets;

            const subSkillSetsList =
              $scope.selectTemplate[index].shifts[a].subSkillSets;
            const subSkillSets = [];

            for (let x = 0; x < subSkillSetsList.length; x += 1) {
              subSkillSets.push({
                mainName: subSkillSetsList[x].skillSetId.name,
                subName: subSkillSetsList[x].name,
                id: subSkillSetsList[x]._id,
                name: `${subSkillSetsList[x].skillSetId.name}->${subSkillSetsList[x].name}`,
              });
            }
            ShiftData.push({
              subSkillSets,
              mainSkillSets,
              staffNeedCount,
              plannedBy: $scope.selectTemplate[index].plannedBy.name,
              plannedByStaffId: $scope.selectTemplate[index].plannedBy.staffId,
              backUpStaffNeedCount: parseInt(backUpStaffNeedCount, 10),
              dayDate: {
                date: `${tempStartDate} 00:00:00 GMT${moment().format('ZZ')}`,
                day: moment
                  .utc($scope.selectTemplate[index].shifts[a].date)
                  .local()
                  .format('dddd'),
                startTime: `${tempStartDate} ${moment(
                  $scope.selectTemplate[index].shifts[a].startTime,
                ).format('HH:mm')}:00 GMT${moment().format('ZZ')}`,
                endTime: `${tempEndDate} ${moment(
                  $scope.selectTemplate[index].shifts[a].endTime,
                ).format('HH:mm')}:00 GMT${moment().format('ZZ')}`,
                isSplitShift:
                  $scope.selectTemplate[index].shifts[a].isSplitShift,
              },
              reportLocationId,
              status,
              reportLocationName,
              name: $scope.selectTemplate[index].name,
            });
          }
          ShiftData.forEach((x) => {
            if ($scope.fullDataCreateDummy.shifts.length > 0) {
              let isDuplicate = false;
              let dayDateIndex;

              $scope.fullDataCreateDummy.shifts.forEach((y, $index) => {
                dayDateIndex = $index;
                if (y.staffNeedCount === x.staffNeedCount) {
                  if (y.backUpStaffNeedCount === x.backUpStaffNeedCount) {
                    if (y.reportLocationId === x.reportLocationId) {
                      if (y.subSkillSets.length === x.subSkillSets.length) {
                        isDuplicate = false;

                        y.dayDate.forEach((z) => {
                          if (
                            moment(z.startTime).format('HH:mm') ===
                            moment(x.dayDate.startTime).format('HH:mm')
                          ) {
                            if (
                              moment(z.endTime).format('HH:mm') ===
                              moment(x.dayDate.endTime).format('HH:mm')
                            ) {
                              const isSame = objectsAreSameCall(
                                y.subSkillSets,
                                x.subSkillSets,
                              );

                              if (isSame) {
                                isDuplicate = true;
                              }
                            }
                          }
                        });
                        return isDuplicate;
                      }
                    }
                  }
                }

                return false;
              });
              if (!isDuplicate && !x.isSplitShift) {
                $scope.fullDataCreateDummy.shifts.push(x);
                const shiftIndex = $scope.fullDataCreateDummy.shifts.length;

                $scope.fullDataCreateDummy.shifts[shiftIndex - 1].dayDate = [
                  x.dayDate,
                ];
              } else {
                $scope.fullDataCreateDummy.shifts[dayDateIndex].dayDate.push(
                  x.dayDate,
                );
              }
            } else {
              $scope.fullDataCreateDummy.shifts.push(x);
              $scope.fullDataCreateDummy.shifts[0].dayDate = [x.dayDate];
            }
          });
          finalData.push($scope.fullDataCreateDummy.shifts);
        }
        const lastFinal = [];

        for (let e = 0; e < finalData.length; e += 1) {
          const shifts = finalData[e];

          for (let j = 0; j < shifts.length; j += 1) {
            const shift = shifts[j];
            const obj = {
              templatename: shift.name,
              startTime: moment(shift.dayDate[0].startTime).format('HH:mm'),
              endTime: moment(shift.dayDate[0].endTime).format('HH:mm'),
              confirmStaff: shift.staffNeedCount,
              standbyStaff: shift.backUpStaffNeedCount,
              plannedBy: shift.plannedBy,
              plannedByStaffId: shift.plannedByStaffId,
              reportLocationName: shift.reportLocationName,
            };
            let skillSet = '';

            shift.subSkillSets.forEach((skill) => {
              skillSet += `,${skill.name}`;
            });
            let days = '';

            shift.dayDate.forEach((day) => {
              days += `,${day.day}`;
            });
            obj.skillSets = skillSet;
            obj.days = days;
            lastFinal.push(obj);
          }
        }
        return __.out(res, 201, { lastFinal });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
    return null;
  }

  async remove(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      __.log(req.body, 'template/remove');
      const requiredResult = await __.checkRequiredFields(req, ['templateId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        _id: req.body.templateId,
        plannedBy: req.user._id,
        status: {
          $nin: [3],
        },
      };
      const templateData = await Template.findOne(where);

      if (!templateData) {
        return __.out(res, 300, 'Template Not Found');
      }

      templateData.status = 3;
      await templateData.save();
      return __.out(res, 201, 'Template deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async renameTemplate(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      __.log(req.body, 'template/renameTemplate');
      const requiredResult = await __.checkRequiredFields(req, [
        'templateId',
        'name',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const templateObj = await Template.updateOne(
        { _id: mongoose.Types.ObjectId(req.body.templateId), status: 1 },
        { name: req.body.name },
      );

      if (templateObj.modifiedCount === 1) {
        return __.out(res, 200, 'Successfully updated');
      }

      return __.out(res, 300, 'Error while updating Template');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async deleteShiftInTemplate(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      __.log(req.body, 'template/remove');
      const requiredResult = await __.checkRequiredFields(req, [
        'templateId',
        'planShiftToDelete',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        _id: req.body.templateId,
        plannedBy: req.user._id,
        status: {
          $nin: [3],
        },
      };
      const templateData = await Template.findOne(where);

      if (!templateData) {
        return __.out(res, 300, 'Template Not Found');
      }

      templateData.shifts = templateData.shifts.filter(
        (i) =>
          i._doc.uniqueId.toString() !== req.body.planShiftToDelete.toString(),
      );
      await templateData.save();
      return __.out(res, 201, 'Plan Shift deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
}

module.exports = new TemplateController();
