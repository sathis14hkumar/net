// Controller Code Starts here
const moment = require('moment');
const async = require('async');
const Shift = require('../../models/shift');
const ShiftDetails = require('../../models/shiftDetails');
const ShiftLog = require('../../models/shiftLog');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class ShiftLogController {
  async create(data, res) {
    try {
      const insert = {
        userId: data.userId,
        requestedShift: data.requestedShift,
        existingShift: data.existingShift,
        businessUnitId: data.businessUnitId,
        status: data.status,
        weekNumber: data.weekNumber,
        weekRangeStartsAt: data.weekRangeStartsAt,
        weekRangeEndsAt: data.weekRangeEndsAt,
        newTiming: data.newTiming,
      };

      if (data.status === 1) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `Planning`;
      }

      if (data.status === 3) {
        insert.description = `New Template Saved`;
      }

      if (data.status === 4) {
        insert.description = `Template Edited`;
      }

      if (data.status === 5) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.adjustedShift = await this.getStringifiedShiftData(
          res,
          data.adjustedShift,
          false,
        );
        insert.description = `${data.oldCount} adjusted to ${data.newCount}`;
      }

      if (data.status === 6) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.pendingShift = await this.getStringifiedShiftData(
          res,
          data.pendingShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
        insert.description = `Pending Acceptance`;
      }

      if (data.status === 7) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.acceptedShift = await this.getStringifiedShiftData(
          res,
          data.acceptedShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
        insert.description = `Request change - Accepted`;
      }

      if (data.status === 8) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.rejectedShift = await this.getStringifiedShiftData(
          res,
          data.rejectedShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
        insert.description = `Request change - Rejected`;
      }

      if (data.status === 9) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.requestedShift = await this.getStringifiedShiftData(
          res,
          data.requestedShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
        insert.description = `Shift Request change`;
      }

      if (data.status === 10) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.requestedShift = await this.getStringifiedShiftData(
          res,
          data.requestedShift,
          false,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
        insert.description = `Shift Request change Stopped`;
      }

      if (data.status === 11) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
        insert.description = `Shift Cancelled`;
      }

      if (data.status === 12) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `Shift Extension Request sent successfully`;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 13) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `Shift Extension - Accepted`;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 14) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `Shift Extension - Declined`;

        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 15) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
        let st = 'On Rest Day';

        if (data.isOff) {
          st = 'On Off Day';
        }

        insert.description = `Recall request sent - ${st}`;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 16) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
        let st = 'On Rest Day';

        if (data.isOff) {
          st = 'On Off Day';
        }

        let isAs = 'accepted';

        if (data.isRecallAccepted === 3) {
          isAs = 'declined';
        }

        insert.description = `Recall request ${isAs} - ${st} `;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 17) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `Shift Extention Request Stopped`;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 18) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `This user has booked a confirmed shift successfully`;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 19) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `This user has booked a StandBy shift successfully`;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 20) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `This user has cancelled his confirmed booked shift successfully`;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      if (data.status === 21) {
        insert.shiftId = await this.getStringifiedShiftData(
          res,
          data.shiftId,
          true,
        );
        insert.description = `This user has cancelled his Standby booked shift successfully`;
        insert.existingShift = await this.getStringifiedShiftData(
          res,
          data.existingShift,
          false,
        );
      }

      await new ShiftLog(insert).save();

      __.log('Log created successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  /* Returns stringified shift data for logs */
  async getStringifiedShiftData(res, id, list) {
    /* True for shiftList and false for shiftDetails */
    try {
      if (list) {
        const data = await Shift.findOne({
          _id: id,
        })
          .populate([
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
            {
              path: 'shiftDetails',
              populate: [
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
              ],
            },
          ])
          .lean();

        return JSON.stringify(data);
      }

      const data = await ShiftDetails.findOne({
        _id: id,
      })
        .populate([
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
            path: 'dedicatedRequestTo',
            select: 'name',
          },
        ])
        .lean();

      logInfo('shiftLog/read API ends here!');
      return JSON.stringify(data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      logInfo('shiftLog/read API Start!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });

      let findOrFindOne;

      if (req.body.shiftLogId) {
        findOrFindOne = ShiftLog.findById(req.body.shiftLogId);
      } else {
        const requiredResult = await __.checkRequiredFields(req, [
          'businessUnitId',
          'startDate',
          'status',
        ]);

        if (requiredResult.status === false) {
          logError(
            `shiftLog/read API, Required fields missing `,
            requiredResult.missingFields,
          );
          logError(`shiftLog/read API, request payload `, req.body);
          return __.out(res, 400, requiredResult.missingFields);
        }

        let status;

        if (Number(req.body.status) >= 5) {
          status = {
            $gte: 5,
          };
        } else {
          status = Number(req.body.status);
        }

        const startDate = moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
        const weekNumber = await __.weekNoStartWithMonday(startDate);
        const yearOfWeek = new Date(req.body.startDate).getFullYear();

        findOrFindOne = ShiftLog.find({
          status,
          businessUnitId: req.body.businessUnitId,
          weekNumber,
          $expr: { $eq: [{ $year: '$weekRangeStartsAt' }, yearOfWeek] },
        });
      }

      const result = await findOrFindOne
        .sort({
          createdAt: -1,
        })
        .populate([
          {
            path: 'userId',
            select: 'name staffId',
          },
        ]);
      let isResponseSend = false;

      if (result.length > 0) {
        if (Number(req.body.status) >= 5) {
          const resultLength = result.length;

          if (Number(req.body.status) === 5) {
            async.eachSeries(result, (item, next) => {
              let goNext = true;
              const index = result.indexOf(item) + 1;
              let adjustedShift = {};
              let from = 0;

              if (item.adjustedShift) {
                adjustedShift = JSON.parse(item.adjustedShift);
                from = 1;
              } else if (item.existingShift) {
                adjustedShift = JSON.parse(item.existingShift);
                from = 2;
              } else {
                goNext = false;
                next();
              }

              if (goNext) {
                if (adjustedShift && adjustedShift.isSplitShift) {
                  ShiftDetails.findOne({
                    shiftId: adjustedShift.shiftId,
                    isSplitShift: true,
                    day: adjustedShift.day,
                    _id: { $ne: adjustedShift._id },
                  })
                    .then((splitShift) => {
                      if (splitShift) {
                        adjustedShift.splitShiftStartTime =
                          splitShift.startTime;
                        adjustedShift.splitShiftEndTime = splitShift.endTime;
                        adjustedShift.splitShiftId = splitShift._id;
                        if (from === 1) {
                          item.adjustedShift = JSON.stringify(adjustedShift);
                        } else if (from === 2) {
                          item.existingShift = JSON.stringify(adjustedShift);
                        }
                      }

                      if (resultLength === index) {
                        logInfo('shiftLog/read API ends here!', {
                          name: req.user.name,
                          staffId: req.user.staffId,
                        });
                        __.out(res, 201, result);
                      } else {
                        next();
                      }
                    })
                    .catch((err) => {
                      logError(
                        `shiftLog/read API, there is an error `,
                        err.toString(),
                      );
                      if (resultLength === index) {
                        __.out(res, 201, result);
                      } else {
                        next();
                      }
                    });
                } else if (resultLength === index) {
                  logInfo('shiftLog/read API ends here!', {
                    name: req.user.name,
                    staffId: req.user.staffId,
                  });
                  isResponseSend = true;
                  __.out(res, 201, result);
                } else {
                  next();
                }
              }
            });
            if (!isResponseSend) {
              logInfo('shiftLog/read API ends here!', {
                name: req.user.name,
                staffId: req.user.staffId,
              });
              __.out(res, 201, result);
            }
          } else {
            logInfo('shiftLog/read API ends here!', {
              name: req.user.name,
              staffId: req.user.staffId,
            });
            __.out(res, 201, result);
          }
        } else {
          logInfo('shiftLog/read API ends here!', {
            name: req.user.name,
            staffId: req.user.staffId,
          });
          result.forEach((item) => {
            item.shiftId = JSON.parse(item.shiftId);
            if (item.shiftId.shiftDetails) {
              item.shiftId.shiftDetails.forEach(
                (splitShift, splitShiftIndex) => {
                  if (splitShift.isSplitShift) {
                    item.shiftId.shiftDetails.forEach(
                      (splitShiftNew, splitShiftIndexNew) => {
                        if (
                          splitShiftNew.isSplitShift &&
                          splitShiftIndex !== splitShiftIndexNew &&
                          new Date(splitShift.date).getTime() ===
                            new Date(splitShiftNew.date).getTime() &&
                          splitShift.shiftId === splitShiftNew.shiftId
                        ) {
                          splitShift.splitShiftStartTime =
                            splitShiftNew.startTime;
                          splitShift.splitShiftEndTime = splitShiftNew.endTime;
                          splitShift.splitShiftId = splitShiftNew._id;
                          item.shiftId.shiftDetails.splice(
                            splitShiftIndexNew,
                            1,
                          );
                        }
                      },
                    );
                  }
                },
              );
            }

            item.shiftId = JSON.stringify(item.shiftId);
          });
          logInfo('shiftLog/read API ends here!', {
            name: req.user.name,
            staffId: req.user.staffId,
          });
          if (result && result.length > 0) {
            __.out(res, 201, result);
          } else {
            __.out(res, 201, []);
          }
        }
      }

      logInfo('shiftLog/read API ends here!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, result);
    } catch (err) {
      logError(`shiftLog/read API, there is an error `, err.toString());
      __.log(err);
      return __.out(res, 500);
    }
  }
}

module.exports = new ShiftLogController();
