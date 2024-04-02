const moment = require('moment');
const _ = require('lodash');
const json2csv = require('json2csv').parse;
const { validationResult } = require('express-validator');
const LeaveType = require('../../models/leaveType');
const LeaveApplied = require('../../models/leaveApplied');
const OpsTeam = require('../../models/opsTeam');
const opsLeaves = require('../../models/opsLeaves');
const LeaveLog = require('../../models/leaveLogs');
const OpsGroup = require('../../models/ops');
const User = require('../../models/user');
const staffLeave = require('../../models/staffLeave');
const ops = require('../../models/ops');
const pageSetting = require('../../models/pageSetting');
const __ = require('../../../helpers/globalFunctions');

class NewLeavePlannerController {
  // /leavetype
  async getLeaveType(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      // get leaves
      // find leave applied on that date
      const { body } = req;
      let leaveType = await LeaveType.find(
        { companyId: req.user.companyId, isActive: true },
        { name: 1 },
      );
      let userIdArr = [];

      if (body.opsTeamId) {
        const userId = await OpsTeam.findOne(
          { _id: body.opsTeamId },
          { userId: 1 },
        );

        if (userId) {
          userIdArr = userId.userId;
        }
      } else if (body.opsGroupId) {
        const userId = await OpsGroup.findOne(
          { _id: body.opsGroupId, isDelete: false },
          { userId: 1 },
        );

        if (userId) {
          userIdArr = userId.userId;
        }
      } else {
        return res.json({ success: false, message: 'Ops Group is missing' });
      }

      const date = moment(new Date(body.date)).utc(body.timeZone).format();

      const leaveApplied = await LeaveApplied.find({
        status: { $in: [0, 1, 3, 4] },
        userId: { $in: userIdArr },
        startDate: { $lte: date },
        endDate: { $gte: date },
      });
      const grouped = _.mapValues(
        _.groupBy(leaveApplied, 'leaveTypeId'),
        (clist) =>
          clist.map((leaveApplied1) => _.omit(leaveApplied1, 'leaveTypeId')),
      );

      leaveType = JSON.parse(JSON.stringify(leaveType));
      for (let i = 0; i < leaveType.length; i += 1) {
        if (grouped[leaveType[i]._id]) {
          leaveType[i].total = grouped[leaveType[i]._id].length;
        } else {
          leaveType[i].total = 0;
        }
      }
      return res.json({ leaveType, success: true });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  // /leavetype/bu
  async getLeaveTypeBu(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      // get leaves
      // find leave applied on that date
      const { body } = req;
      let leaveType = await LeaveType.find(
        { companyId: req.user.companyId, isActive: true },
        { name: 1 },
      );
      const userIdArr = [];

      if (body.buId) {
        const userId = await User.find(
          { parentBussinessUnitId: body.buId },
          { _id: 1 },
        );

        if (userId) {
          userId.forEach((it) => {
            userIdArr.push(it._id);
          });
        }
      } else {
        return res.json({ success: false, message: 'Bu is missing' });
      }

      // return res.json({ userIdArr });
      const date = moment(new Date(body.date)).utc(body.timeZone).format();

      const leaveApplied = await LeaveApplied.find({
        status: { $in: [0, 1, 3, 4] },
        userId: { $in: userIdArr },
        startDate: { $lte: date },
        endDate: { $gte: date },
      });
      const grouped = _.mapValues(
        _.groupBy(leaveApplied, 'leaveTypeId'),
        (clist) =>
          clist.map((leaveApplied1) => _.omit(leaveApplied1, 'leaveTypeId')),
      );

      leaveType = JSON.parse(JSON.stringify(leaveType));
      for (let i = 0; i < leaveType.length; i += 1) {
        if (grouped[leaveType[i]._id]) {
          leaveType[i].total = grouped[leaveType[i]._id].length;
        } else {
          leaveType[i].total = 0;
        }
      }
      return res.json({ leaveType, success: true });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  // /usersbydate
  async getUsersByDate(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      // get leaves
      // find leave applied on that date
      const { body } = req;
      let userIdArr = [];
      let opsGroupName = '';

      const opsData = await OpsGroup.findOne(
        { _id: body.opsGroupId, isDelete: false },
        { userId: 1, opsGroupName: 1, opsTeamId: 1 },
      ).populate([
        {
          path: 'opsTeamId',
          select: 'name userId',
        },
      ]);

      if (opsData) {
        opsGroupName = opsData.opsGroupName;
      }

      if (body.opsTeamId) {
        const userId = await OpsTeam.findOne(
          { _id: body.opsTeamId },
          { userId: 1, name: 1 },
        );

        if (userId) {
          userIdArr = userId.userId;
        }
      } else if (body.opsGroupId) {
        const userId = await OpsGroup.findOne(
          { _id: body.opsGroupId, isDelete: false },
          { userId: 1, opsGroupName: 1 },
        );

        if (userId) {
          userIdArr = userId.userId;
          opsGroupName = userId.opsGroupName;
        }
      } else {
        return res.json({ success: false, message: 'Ops Group is missing' });
      }

      const opsleave = await opsLeaves.findOne(
        { opsGroupId: body.opsGroupId },
        { _id: 1, perDayQuota: 1, opsTeamId: 1, users: 1 },
      );
      const date = moment(new Date(body.date)).utc(body.timeZone).format();
      const dateF = moment(new Date(body.date))
        .utc(body.timeZone)
        .format('DD-MM-YYYY');

      const data = {};

      // return res.json({ opsleave })
      if (opsleave) {
        if (!body.opsTeamId) {
          if (opsleave.perDayQuota && opsleave.perDayQuota.quota.length > 0) {
            const yeardata = opsleave.perDayQuota.quota.filter((q) => {
              if (Object.prototype.hasOwnProperty.call(q, body.year)) {
                return true;
              }

              return false;
            });

            // return res.json({ yeardata })
            if (yeardata.length > 0) {
              // find quota for that date and the users.
              const key = Object.keys(yeardata[0])[0];
              const thatdateIs = yeardata[0][key].filter(
                (qa) => qa.date === dateF,
              );

              [data.date] = thatdateIs;
            }
          }
        } else if (
          opsleave &&
          opsleave.perDayQuota &&
          opsleave.perDayQuota.opsTeams &&
          opsleave.perDayQuota.opsTeams.length > 0
        ) {
          let perDayTeamQuota = opsleave.perDayQuota.opsTeams.filter(
            (pTeam) => pTeam.id === body.opsTeamId,
          );

          if (perDayTeamQuota.length > 0) {
            [perDayTeamQuota] = perDayTeamQuota;
            // return res.json({ perDayTeamQuota })
            const yeardata = perDayTeamQuota.quota.filter((q) => {
              if (Object.prototype.hasOwnProperty.call(q, body.year)) {
                return q;
              }

              return false;
            });

            // return res.json({ yeardata })
            if (yeardata.length > 0) {
              // find quota for that date and the users.
              const key = Object.keys(yeardata[0])[0];
              const thatdateIs = yeardata[0][key].filter(
                (qa) => qa.date === dateF,
              );

              [data.date] = thatdateIs;
            }
          }
        }

        const leaveAppliedData = await LeaveApplied.find({
          userId: { $in: userIdArr },
          startDate: { $lte: date },
          endDate: { $gte: date },
          status: { $nin: [2, 9] },
        }).populate([
          {
            path: 'userId',
            select:
              'name staffId parentBussinessUnitId email contactNumber appointmentId profilePicture status',
            populate: [
              {
                path: 'appointmentId',
                select: 'name',
              },
              {
                path: 'parentBussinessUnitId',
                select: 'orgName',
                // populate: {
                //   path: "sectionId",
                //   select: "name",
                //   populate: {
                //     path: "departmentId",
                //     select: "name status",
                //     populate: {
                //       path: "companyId",
                //       select: "name status",
                //     },
                //   },
                // },
              },
            ],
          },
          {
            path: 'leaveTypeId',
            select: 'name',
          },
          {
            path: 'leaveGroupId',
            select: 'name',
          },
          {
            path: 'cancelledBy',
            select: 'staffId name',
          },
          {
            path: 'approvalHistory.approvalBy',
            select: 'staffId name',
          },
          {
            path: 'swapLogId',
            populate: [
              {
                path: 'fromUserId',
                select: 'name staffId',
              },
              {
                path: 'toUserId',
                select: 'name staffId',
              },
            ],
          },
        ]);

        let leaveApplied = leaveAppliedData.filter(
          (item) => item.userId.status !== 2,
        );

        let total = 0;

        leaveApplied = JSON.parse(JSON.stringify(leaveApplied));
        for (let i = 0; i < leaveApplied.length; i += 1) {
          leaveApplied[i].opsGroupName = opsGroupName;
          opsData.opsTeamId.forEach((team) => {
            if (team.userId.includes(leaveApplied[i].userId._id)) {
              leaveApplied[i].opsTeam = team.name;
            }
          });
          if (leaveApplied[i].status !== 2 && leaveApplied[i].status !== 5) {
            total += 1;
          }
        }
        data.totalLeaveApplied = total;
        if (data.date) {
          data.balance = data.date.value - total;
        }

        return res.json({ data, leaveApplied, success: true });
      }

      return res
        .status(200)
        .json({ message: 'Ops Leave Data Not Found', success: false });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  // /usersbydate/bu
  async getUsersByDateBu(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      // get leaves
      // find leave applied on that date
      const { body } = req;
      const userIdArr = [];

      const date = moment(new Date(body.date)).utc(body.timeZone).format();

      if (body.buId) {
        const userId = await User.find(
          { parentBussinessUnitId: body.buId },
          { _id: 1 },
        );

        if (userId) {
          userId.forEach((it) => {
            userIdArr.push(it._id);
          });
        }
      } else {
        return res.json({ success: false, message: 'Bu is missing' });
      }

      const opsGroupData = await OpsGroup.find(
        { userId: { $in: userIdArr }, isDelete: false, isDraft: false },
        { opsGroupName: 1, userId: 1, opsTeamId: 1 },
      )
        .populate([{ path: 'opsTeamId', select: 'name userId' }])
        .sort({
          updatedAt: -1,
        });
      const leaveAppliedData = await LeaveApplied.find({
        userId: { $in: userIdArr },
        startDate: { $lte: date },
        endDate: { $gte: date },
      }).populate([
        {
          path: 'userId',
          select:
            'name staffId parentBussinessUnitId email contactNumber appointmentId profilePicture status',
          populate: [
            {
              path: 'appointmentId',
              select: 'name',
            },
            {
              path: 'parentBussinessUnitId',
              select: 'orgName',
            },
          ],
        },
        {
          path: 'leaveTypeId',
          select: 'name',
        },
        {
          path: 'leaveGroupId',
          select: 'name',
        },
        {
          path: 'approvalHistory.approvalBy',
          select: 'staffId name',
        },
        {
          path: 'swapLogId',
          populate: [
            {
              path: 'fromUserId',
              select: 'name staffId',
            },
            {
              path: 'toUserId',
              select: 'name staffId',
            },
          ],
        },
      ]);
      let leaveApplied = leaveAppliedData.filter(
        (item) => item.userId.status !== 2,
      );

      leaveApplied = JSON.parse(JSON.stringify(leaveApplied));
      const len = leaveApplied.length;

      for (let i = 0; i < len; i += 1) {
        const item = leaveApplied[i];
        const opsG = opsGroupData.filter((op) => {
          const aa = op.userId.map(String);

          return aa.includes(item.userId._id.toString());
        });

        opsGroupData.forEach((data) => {
          data.opsTeamId.forEach((team) => {
            if (team.userId.includes(leaveApplied[i].userId._id)) {
              leaveApplied[i].opsTeam = team.name;
            }
          });
        });
        if (opsG && opsG.length > 0) {
          leaveApplied[i].opsGroup = {
            name: opsG[0].opsGroupName,
            opsGroupId: opsG[0]._id,
          };
        }
      }
      // for (let i = 0; i < leaveApplied.length; i++) {
      //   leaveApplied[i].opsGroupName = opsGroupName;
      //   if (leaveApplied[i].status != 2) {
      //     total += 1;
      //   }
      // }
      // data.totalLeaveApplied = total;
      // data.balance = data.date.value - total;
      return res.json({ leaveApplied, success: true });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  // /mobilescreenforleaves
  async mobileScreenForLeaves(req, res) {
    try {
      const { body } = req;
      const opsGroupNameData = await ops.findOne(
        { userId: body.userId, isDelete: false },
        { opsGroupName: 1 },
      );
      const { opsGroupName } = opsGroupNameData;
      const userData = await User.findOne(
        { _id: body.userId },
        { parentBussinessUnitId: 1 },
      ).populate([
        {
          path: 'parentBussinessUnitId',
          select: 'name',
          populate: {
            path: 'sectionId',
            select: 'name',
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
      ]);
      const userInfo = {
        opsGroupName,
        buDetails: userData.parentBussinessUnitId,
      };
      // const body = req.body;
      const leaveApplied = await LeaveApplied.find({
        $expr: { $eq: [{ $year: '$startDate' }, body.year] },
        userId: body.userId,
      })
        .populate([
          {
            path: 'leaveTypeId',
            select: 'name',
          },
        ])
        .sort({ startDate: 1 });

      return res.json({ success: true, data: leaveApplied, userInfo });
    } catch (e) {
      return res.json({ success: false, message: 'something went wrong', e });
    }
  }

  // /staffleavetype
  async getStaffLeaveType(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      // get leaves
      // find leave applied on that date
      const { body } = req;
      const leaveTypeData = [];
      const leaveGroupData = await staffLeave
        .findOne({ userId: body.userId })
        .populate([
          {
            path: 'leaveGroupId',
            select: 'name leaveType.leaveTypeId leaveType.leavePlanning',
            populate: [
              {
                path: 'leaveType.leaveTypeId',
                select: 'name',
              },
            ],
          },
        ]);

      if (leaveGroupData && leaveGroupData.leaveGroupId) {
        const leaveTypeFromLG = leaveGroupData.leaveGroupId.leaveType;
        const { leaveDetails } = leaveGroupData;

        leaveDetails.forEach((details) => {
          let obj = {};
          const matchLt = leaveTypeFromLG.filter(
            (lt) =>
              lt.leaveTypeId._id.toString() ===
                details.leaveTypeId.toString() && details.year === body.year,
          );

          if (matchLt.length > 0) {
            obj = JSON.parse(JSON.stringify(details));
            obj.leaveTypeName = matchLt[0].leaveTypeId.name;
            obj.isAdminAllocate = matchLt[0].leavePlanning.isAdminAllocate;
            // if (obj.isAdminAllocate) {
            leaveTypeData.push(obj);
            // }
          }
        });
      }

      const leaveApplied = await LeaveApplied.find({
        $expr: { $eq: [{ $year: '$startDate' }, body.year] },
        userId: body.userId,
        status: { $nin: [2, 9] },
      })
        .populate([
          {
            path: 'leaveTypeId',
            select: 'name',
          },
        ])
        .sort({ startDate: 1 });

      return res.json({
        leaveApplied,
        leaveTypeData,
        success: true,
        leaveGroupId: leaveGroupData.leaveGroupId._id,
      });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  async readLeaveConfiguration(res, companyId) {
    try {
      const pageData = await pageSetting.findOne({ companyId });

      if (
        pageData &&
        pageData.opsGroup &&
        pageData.opsGroup.blockLeaveConfiguration
      ) {
        if (pageData.opsGroup.blockLeaveConfiguration === 1) {
          return { total: 5, restOff: 2 };
        }

        if (pageData.opsGroup.blockLeaveConfiguration === 2) {
          return { total: 6, restOff: 1 };
        }

        return { total: 7, restOff: 0 };
      }

      return { total: 5, restOff: 2 };
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async checkLeaveConfig(res, leaveType) {
    try {
      if (leaveType.total === 0) {
        return true;
      }

      const leaveTypeData = await LeaveType.findOne({
        _id: leaveType.leaveTypeId,
      });

      return leaveTypeData.isQuotaExceed;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // /allocateleave
  async allocateLeave(req, res) {
    try {
      const { body } = req;

      body.year = new Date(body.startDate).getFullYear();
      const { userId } = body;
      const staffLeaveData = await staffLeave.findOne({ userId });
      let leaveType;

      if (staffLeaveData) {
        leaveType = staffLeaveData.leaveDetails.filter(
          (type) =>
            type.leaveTypeId === body.leaveTypeId && type.year === body.year,
        );

        if (leaveType && leaveType.length > 0) {
          [leaveType] = leaveType;
          const startDate = moment(body.startDate); // .format('DD-MM-YYYY');

          const endDate = moment(body.endDate); // .format('DD-MM-YYYY');
          let diff = endDate.diff(startDate, 'days') + 1;

          if (body.startAt.toLowerCase() !== body.endAt.toLowerCase()) {
            diff -= 0.5;
          }

          let totalDeducated = diff;
          let totalRestOff = 0;
          const leaveConfig = await this.readLeaveConfiguration(
            res,
            req.user.companyId,
          );

          if (diff >= 7) {
            totalRestOff = parseInt(diff / 7, 10) * leaveConfig.restOff;
            totalDeducated -= totalRestOff;
          }

          const isPlanQuota = leaveType.planQuota - totalDeducated;
          const isQuotaCheck = await this.checkLeaveConfig(res, leaveType);

          if (isPlanQuota >= 0 || isQuotaCheck) {
            const obj = {
              isQuotaCheck: !isQuotaCheck,
              userId,
              startDate,
              endDate,
              totalDeducated,
              totalRestOff,
              leaveTypeId: body.leaveTypeId,
              leaveGroupId: staffLeaveData.leaveGroupId,
              remark: body.remark,
              timeZone: body.timeZone,
              totalDay: diff,
              attachment: body.attachment,
              businessUnitId: body.bussinessUnitId,
              isSwappable: body.isSwappable,
              status: 3,
              startAt: body.startAt,
              endAt: body.endAt,
            };
            const saveLeave = new LeaveApplied(obj).save();

            await staffLeave.findOneAndUpdate(
              {
                userId,
                leaveDetails: {
                  $elemMatch: {
                    year: body.year,
                    leaveTypeId: body.leaveTypeId,
                  },
                },
              },
              {
                $set: { 'leaveDetails.$.planQuota': isPlanQuota },
                $inc: { 'leaveDetails.$.request': totalDeducated },
              },
            );

            return res.json({
              saveLeave,
              success: true,
              message: 'Leave Successfully applied',
            });
          }

          return res.json({
            isPlanQuota,
            success: false,
            message: 'Plan Quota is not present to take leave',
          });
        }

        return res.json({
          success: false,
          message: 'Leave type not found for this staff',
        });
      }

      return res.json({
        leaveType,
        success: false,
        message: 'Leave group not found for this staff',
      });
    } catch (e) {
      return res.json({ success: false, message: 'something went wrong', e });
    }
  }

  // /cancel
  async cancelAllocation(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const { body } = req;
      const leaveAppliedData = await LeaveApplied.findOneAndUpdate(
        {
          _id: body.leaveAppliedId,
        },
        {
          $set: {
            status: 5,
            cancelledBy: req.user._id,
            cancelledDateTime: new Date(),
          },
        },
        { new: true },
      );
      const lLog = JSON.parse(JSON.stringify(leaveAppliedData));

      delete lLog._id;
      lLog.changeDateHistory = [];
      lLog.isChangeDate = false;
      new LeaveLog(lLog).save();
      await this.managePlanLeave(
        res,
        leaveAppliedData.userId,
        leaveAppliedData.totalDeducated,
        leaveAppliedData,
      );

      return res.json({
        success: true,
        message: 'Leave successfully cancelled',
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async managePlanLeave(res, userId, leaveQuota, leaveTypeData) {
    try {
      const year = new Date(leaveTypeData.startDate).getFullYear();

      if (
        leaveTypeData.submittedFrom === 1 ||
        (leaveTypeData.submittedFrom === 2 && leaveTypeData.status === 8) ||
        (leaveTypeData.submittedFrom === 3 && leaveTypeData.status === 1) ||
        (leaveTypeData.submittedFrom === 4 && leaveTypeData.status === 1)
      ) {
        const updateStaffLeave = await staffLeave.findOneAndUpdate(
          {
            userId,
            leaveDetails: {
              $elemMatch: {
                year,
                leaveTypeId: leaveTypeData.leaveTypeId,
              },
            },
          },
          {
            $inc: {
              'leaveDetails.$.planQuota': leaveQuota,
              'leaveDetails.$.quota': leaveQuota,
              'leaveDetails.$.request': -leaveQuota,
              'leaveDetails.$.taken': -leaveQuota,
            },
          },
        );

        return updateStaffLeave;
      }

      const updateStaffLeave = await staffLeave.findOneAndUpdate(
        {
          userId,
          leaveDetails: {
            $elemMatch: { year, leaveTypeId: leaveTypeData.leaveTypeId },
          },
        },
        {
          $inc: {
            'leaveDetails.$.planQuota': leaveQuota,
            'leaveDetails.$.request': -leaveQuota,
          },
        },
      );

      return updateStaffLeave;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Export
  async export(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      // get leaves
      // find leave applied on that date
      const { body } = req;
      let opsGroupName = [];
      let opsTeamName = null;
      let userIdArr = [];

      if (body.opsTeamId) {
        const userId = await OpsTeam.findOne(
          { _id: body.opsTeamId },
          { userId: 1, name: 1 },
        );

        if (userId) {
          userIdArr = [userId.userId];
        }

        opsTeamName = userId.name;
        if (body.opsGroupId && body.opsGroupId.length === 1) {
          const opsDetails = await OpsGroup.findOne(
            { _id: { $in: body.opsGroupId }, isDelete: false },
            { userId: 1, opsGroupName: 1 },
          );

          opsGroupName = [opsDetails.opsGroupName];
        }
        // } else {
        //   return res.json({ success: false, message: body.opsGroupId ? "Only 1 Ops Group needed!" : "Ops Group is missing!" });
        // }
      } else if (body.opsGroupId) {
        const userId = await OpsGroup.find(
          { _id: { $in: body.opsGroupId }, isDelete: false },
          { userId: 1, opsGroupName: 1 },
        );

        if (userId) {
          userId.forEach((item) => {
            userIdArr.push(item.userId);
            opsGroupName.push(item.opsGroupName);
          });
        }
      } else {
        return res.json({ success: false, message: 'Ops Group is missing' });
      }

      const date = moment(new Date(body.startDate)).utc(body.timeZone).format();
      const dateE = moment(new Date(body.endDate)).utc(body.timeZone).format();
      const data = [];
      const keys = [
        'STAFF NAME',
        'STAFF ID',
        'Ops Group name',
        'Ops Team Name',
        'Leave Submitted On',
        'LEAVE START',
        'LEAVE END',
        'TOTAL DAYS',
        'LEAVE TYPE',
        'LEAVE PLAN STATUS',
        'LEAVE APPLICATION Status',
        'TOTAL DEDUCTED',
        'TOTAL REST OFF',
        'REMARKS',
        'Approver Name',
        'Approver ID',
        'Approver Date & Time',
        'Cancelled By',
        'Cancelled Date & Time',
      ];

      if (userIdArr && userIdArr.length) {
        const promiseData = [];
        const userIdArrListCall = async (index, userItem) => {
          //
          // startDate: { $lte: date },
          // endDate: { $gte: date },
          // 12<=16 && 15>=11 11-16
          const leaveApplied = await LeaveApplied.find({
            userId: { $in: userItem },
            startDate: { $lte: dateE },
            endDate: { $gte: date },
          }).populate([
            {
              path: 'userId',
              select:
                'name primaryMobileNumber staffId parentBussinessUnitId email contactNumber appointmentId',
              populate: [
                {
                  path: 'appointmentId',
                  select: 'name',
                },
                {
                  path: 'parentBussinessUnitId',
                  select: 'name',
                  populate: {
                    path: 'sectionId',
                    select: 'name',
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
              ],
            },
            {
              path: 'leaveTypeId',
              select: 'name',
            },
            {
              path: 'leaveGroupId',
              select: 'name',
            },
            {
              path: 'cancelledBy',
              select: 'staffId name',
            },
            {
              path: 'approvalHistory.approvalBy',
              select: 'staffId name',
            },
          ]);

          if (leaveApplied && leaveApplied.length > 0) {
            const promiseData1 = [];
            const leaveAppliedListCall = async (leave) => {
              const userObj = {};
              let obj = {};

              if (userObj[leave.userId._id]) {
                obj = userObj[leave.userId._id];
              } else {
                userObj[leave.userId._id] = {};
                obj = {
                  'STAFF NAME': leave.userId.name,
                  'STAFF ID': leave.userId.staffId,
                  phone: leave.userId.primaryMobileNumber,
                  email: leave.userId.email,
                };
              }

              let opsTeamN = opsTeamName;

              if (!opsTeamName) {
                const opsTeamDetails = await OpsTeam.findOne(
                  { userId: leave.userId._id, isDeleted: false },
                  { name: 1 },
                );

                opsTeamN = opsTeamDetails ? opsTeamDetails.name : '';
              }

              obj['Ops Group name'] = opsGroupName[index];
              obj['Ops Team Name'] = opsTeamN;
              obj['Leave Submitted On'] = moment(
                new Date(leave.createdAt),
              ).format('DD-MM-YYYY');
              obj['LEAVE START'] = moment(new Date(leave.startDate)).format(
                'DD-MM-YYYY',
              );
              obj['LEAVE END'] = moment(new Date(leave.endDate)).format(
                'DD-MM-YYYY',
              ); // ;leave.endDate;
              obj['TOTAL DAYS'] = leave.totalDay;
              // ddmmyyyy
              obj['LEAVE TYPE'] = leave.leaveTypeId.name;
              // leave.submittedFrom == 1?'Apply Leave':leave.submittedFrom == 2?'Leave Request':leave.submittedFrom == 3 && leave.status != 4?'Allocated':'Bid Successful'

              if (leave.submittedFrom === 1) {
                obj['LEAVE PLAN STATUS'] = 'Apply Leave';
              } else if (leave.submittedFrom === 2) {
                obj['LEAVE PLAN STATUS'] = 'Leave Request';
              } else if (leave.submittedFrom === 3 && leave.status !== 4) {
                obj['LEAVE PLAN STATUS'] = 'Allocated';
              } else {
                obj['LEAVE PLAN STATUS'] = 'Bid Successful';
              }
              // leave.status;
              // leave.status == 0?'Pending Approval':leave.status == 1?'Approved':leave.status == 2?'Rejected':leave.status==5?'Cancelled':leave.status == 3?'-':'-'

              if (leave.status === 0) {
                obj['LEAVE APPLICATION Status'] = 'Pending Approval';
              } else if (leave.status === 1) {
                obj['LEAVE APPLICATION Status'] = 'Approved';
              } else if (leave.status === 2) {
                obj['LEAVE APPLICATION Status'] = 'Rejected';
              } else if (leave.status === 5) {
                obj['LEAVE APPLICATION Status'] = 'Cancelled';
              } else if (leave.status === 3) {
                obj['LEAVE APPLICATION Status'] = '-';
              } else {
                obj['LEAVE APPLICATION Status'] = '-';
              }

              // leave.status;
              obj['TOTAL DEDUCTED'] = leave.totalDeducated;
              obj['TOTAL REST OFF'] = leave.totalRestOff;
              obj.REMARKS = leave.remark;
              if (leave.approvalHistory && leave.approvalHistory.length > 0) {
                const len = leave.approvalHistory.length - 1;
                const app = leave.approvalHistory[len];

                obj['Approver Name'] = app.approvalBy.name;
                obj['Approver ID'] = app.approvalBy.staffId;
                obj['Approver Date & Time'] = moment(
                  new Date(app.approvalDateTime),
                )
                  .utcOffset(body.timeZone)
                  .format('DD-MM-YYYY hh:mm'); // app.approvalDateTime;
              } else {
                obj['Approver Name'] = '-';
                obj['Approver ID'] = '-';
                obj['Approver Date & Time'] = '-';
              }

              obj['Cancelled By'] = leave.cancelledBy
                ? leave.cancelledBy.name
                : '-';
              obj['Cancelled Date & Time'] = leave.cancelledDateTime
                ? moment(new Date(leave.cancelledDateTime))
                    .utcOffset(body.timeZone)
                    .format('DD-MM-YYYY hh:mm')
                : '-'; // leave.cancelledDateTime:'-';
              data.push(obj);
              // 'TOTAL DAYS','LEAVE TYPE',
              // 'LEAVE PLAN STATUS','LEAVE APPLICATION','TOTAL DEDUCTED',
              // 'TOTAL REST OFF','REMARKS','Approver Name','Approver ID',
              // 'Approver Date & Time','Cancelled By',
              // 'Cancelled Date & Time'
            };

            for (let i = 0; i < leaveApplied.length; i += 1) {
              promiseData1.push(leaveAppliedListCall(leaveApplied[i]));
            }

            await Promise.all(promiseData1);
          }
        };

        for (const [index, userItem] of userIdArr.entries()) {
          promiseData.push(userIdArrListCall(index, userItem));
        }

        await Promise.all(promiseData);
        // return res.json({data})
        // json2csv({ data: data, fields: keys }, function (err, csv) {
        //   //  res.send(csv);
        //   //  fs.writeFile('file.csv', csv, function(err) {
        //   //      if (err) throw err;
        //   //  });
        //   res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
        //   res.set('Content-Type', 'application/csv');
        //   res.status(200).send(csv);
        //   return
        // });
        const csv = await json2csv(data, keys);

        res.setHeader(
          'Content-disposition',
          'attachment; filename=testing.csv',
        );
        res.set('Content-Type', 'application/csv');
        res.status(200).json({ csv, noData: true });
        // return res.json({data})
      }

      return res
        .status(200)
        .json({ message: 'No Leave data for this period', success: false });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }
}

module.exports = new NewLeavePlannerController();
