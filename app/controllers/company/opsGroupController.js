const json2csv = require('json2csv').parse;
const mongoose = require('mongoose');
const moment = require('moment');
const multiparty = require('multiparty');
const csv = require('csvtojson');
const async = require('async');
const { validationResult } = require('express-validator');
const OpsGroup = require('../../models/ops');
const OpsTeam = require('../../models/opsTeam');
const User = require('../../models/user');
const SubSection = require('../../models/subSection');
const OpsGroupSystemAdmin = require('../../models/opsGroupSystemAdmin');
const Privilege = require('../../models/privilege');
const Role = require('../../models/role');
const OpsLog = require('../../models/opsGroupLogs');
const __ = require('../../../helpers/globalFunctions');
const leaveType = require('../../models/leaveType');
const staffLeave = require('../../models/staffLeave');
const Ballot = require('../../models/ballot');

// API to create OpsGroup
module.exports.create = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errorMessage: errors.array() });
    }

    const requiredResult = await __.checkRequiredFields(req, [
      'userId',
      'buId',
      'adminId',
      'opsGroupName',
      'opsTeam',
      'noOfTeam',
    ]);

    if (requiredResult.status === false) {
      return __.out(res, 400, requiredResult.missingFields);
    }

    const insertObj = {
      userId: req.body.userId,
      buId: req.body.buId,
      opsGroupName: req.body.opsGroupName,
      adminId: req.body.adminId,
      noOfTeam: req.body.noOfTeam,
      createdBy: req.user._id,
      companyId: req.user.companyId,
      isDraft: req.body.isDraft,
      swopSetup: req.body.swopSetup,
    };
    const opsTeamByName = await OpsGroup.findOne({
      opsGroupName: insertObj.opsGroupName,
    });

    if (!opsTeamByName) {
      const ops = await new OpsGroup(insertObj).save();

      if (ops) {
        const opsTeamId = [];
        const promiseData = [];
        const opsTeamCall = async (team) => {
          const teamObj = {
            name: team.name,
            adminId: team.admin,
            userId: team.userId,
            opsGroupId: ops._id,
            buId: req.body.buId,
            createdBy: req.user._id,
          };
          const opsTeam = await new OpsTeam(teamObj).save();

          opsTeamId.push(opsTeam._id.toString());
        };

        for (let i = 0; i < insertObj.noOfTeam; i += 1) {
          promiseData.push(opsTeamCall(req.body.opsTeam[i]));
        }
        await Promise.all(promiseData);
        if (opsTeamId.length > 0) {
          await OpsGroup.update({ _id: ops._id }, { $set: { opsTeamId } });
        }

        return res.status(200).json({
          success: true,
          message: 'Ops Group created successfully',
          OpsGroup: ops,
        });
      }

      return res.status(201).json({
        success: false,
        message: "Couldn't create Ops Group",
      });
    }

    return res.status(201).json({
      success: false,
      message: 'Duplicate Ops Group Name',
    });
  } catch (err) {
    return res.status(201).json({
      success: false,
      message: 'Something Went Wrong',
    });
  }
};

module.exports.readAll = async (req, res) => {
  try {
    const companyId = mongoose.Types.ObjectId(req.user.companyId);
    const data = await OpsGroup.find(
      {
        companyId,
        isDelete: false,
        adminId: req.user._id,
        opsGroupName: { $regex: `.*${req.body.search}.*`, $options: 'i' },
      },
      { adminId: 0, companyId: 0 },
    ).populate([
      {
        path: 'opsTeamId',
        select: ['name', '_id'],
      },
      {
        path: 'createdBy',
        select: ['name', 'email', 'doj'],
      },
    ]);

    if (data) {
      return res.json({
        success: true,
        data,
      });
    }

    return res.json({
      success: false,
      message: 'No OPS Group Found',
    });
  } catch (err) {
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};

// API to fetch data of OPS GROUP
module.exports.read = async (req, res) => {
  try {
    const { privilage } = req.body;

    const companyId = mongoose.Types.ObjectId(req.user.companyId);

    if (privilage === true) {
      const buId = [];
      const user = await User.findById(req.user._id);

      buId.push(user.parentBussinessUnitId);
      if (user.viewBussinessUnitId.length > 0) {
        for (let i = 0; i <= user.viewBussinessUnitId[i]; i += 1) {
          buId.push(user.viewBussinessUnitId[i]);
        }
      }

      if (user.planBussinessUnitId.length > 0) {
        for (let i = 0; i <= user.planBussinessUnitId[i]; i += 1) {
          buId.push(user.planBussinessUnitId[i]);
        }
      }

      const data = await OpsGroup.find(
        { companyId, isDelete: false, buId: { $in: buId } },
        { adminId: 0, companyId: 0 },
      ).populate([
        {
          path: 'createdBy',
          select: ['name', 'email', 'doj'],
        },
      ]);

      if (data) {
        return res.json({
          success: true,
          data,
        });
      }

      return res.json({
        success: false,
        message: 'No OPS Group Found',
      });
    }

    const buId = await OpsGroupSystemAdmin.findOne(
      { userId: req.user._id },
      { buId: 1, _id: 0 },
    );

    const data = await OpsGroup.find(
      { companyId, isDelete: false, buId: { $in: buId.buId } },
      { adminId: 0, companyId: 0 },
    ).populate([
      {
        path: 'createdBy',
        select: ['name', 'email', 'doj'],
      },
    ]);

    if (data) {
      return res.json({
        success: true,
        data,
      });
    }

    return res.json({
      success: false,
      message: 'No OPS Group Found',
    });
  } catch (err) {
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};
module.exports.readWithTeam = async (req, res) => {
  try {
    const buId = mongoose.Types.ObjectId(req.user.companyId);
    const data = await OpsGroup.find(
      { companyId: buId, adminId: req.user._id, isDelete: false },
      { adminId: 0, companyId: 0 },
    ).populate([
      {
        path: 'opsTeamId',
        select: ['name', '_id'],
      },
    ]);

    if (data) {
      return res.json({
        success: true,
        data,
      });
    }

    return res.json({
      success: false,
      message: 'No OPS Group Found',
    });
  } catch (err) {
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};
module.exports.readDropDown = async (req, res) => {
  try {
    const { buId } = req.body;
    const data = await OpsGroup.find(
      { buId: { $in: buId }, isDelete: false },
      { _id: 1, opsGroupName: 1 },
    ).lean();

    if (data) {
      return res.json({
        success: true,
        data,
      });
    }

    return res.json({
      success: false,
      message: 'No OPS Group Found',
    });
  } catch (err) {
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};
module.exports.delete = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errorMessage: errors.array() });
    }

    const { opsGroupId } = req.params;
    const updatedBy = {
      userId: req.user._id,
    };
    const data = await OpsGroup.findOneAndUpdate(
      { _id: opsGroupId },
      { $set: { isDelete: true }, $push: { updatedBy } },
      { new: true },
    );

    if (data) {
      await OpsTeam.update(
        { _id: { $in: data.opsTeamId } },
        { $set: { isDeleted: true }, $push: { updatedBy } },
        { multi: true },
      );

      return res.json({
        success: true,
        message: 'Ops Group Deleted Successfully',
      });
    }

    return res.json({
      success: false,
      message: 'Ops Group Not Deleted Successfully',
    });
  } catch (e) {
    return res.json({
      success: false,
      message: 'Something went wrong',
    });
  }
};
module.exports.opsDetails = async (req, res) => {
  try {
    const { opsGroupId } = req.params;
    const data = await OpsGroup.find({ _id: opsGroupId, isDelete: false })
      .populate([
        {
          path: 'createdBy',
          select: [
            'name',
            'email',
            'doj',
            'contactNumber',
            'staffId',
            'parentBussinessUnitId',
          ],
        },
        {
          path: 'userId',
          select: [
            'name',
            'email',
            'doj',
            'contactNumber',
            'staffId',
            'parentBussinessUnitId',
          ],
          populate: [
            {
              path: 'appointmentId',
              select: ['name', 'status'],
            },
            {
              path: 'parentBussinessUnitId',
              select: 'orgName',
            },
          ],
        },
        {
          path: 'opsTeamId',
          populate: [
            {
              path: 'userId',
              select: [
                'name',
                'email',
                'doj',
                'contactNumber',
                'staffId',
                'parentBussinessUnitId',
              ],
              populate: [
                {
                  path: 'appointmentId',
                  select: ['name', 'status'],
                },
                {
                  path: 'parentBussinessUnitId',
                  select: 'orgName',
                },
              ],
            },
            {
              path: 'adminId',
              select: ['name', 'email', 'doj'],
              populate: {
                path: 'appointmentId',
                select: ['name', 'status'],
              },
            },
          ],
        },
        {
          path: 'removeOpsTeamId.teamId',
          select: 'name',
        },
        {
          path: 'removeOpsTeamId.userId',
          select: 'name',
        },
        {
          path: 'adminId',
          select: ['name', 'email', 'doj'],
          populate: {
            path: 'appointmentId',
            select: ['name', 'status'],
          },
        },
        {
          path: 'buId',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        },
      ])
      .lean();

    if (data) {
      return res.json({
        success: true,
        data,
      });
    }

    return res.json({
      success: false,
      message: 'Data not found',
    });
  } catch (err) {
    return res.json({
      success: false,
      message: 'Something Went wrong',
    });
  }
};
module.exports.adminList = async (req, res) => {
  try {
    const requiredResult = await __.checkRequiredFields(req, ['buId']);

    if (requiredResult.status === false) {
      return __.out(res, 400, requiredResult.missingFields);
    }

    const adminList = await User.find(
      { parentBussinessUnitId: { $in: req.body.buId } },
      { _id: 1, name: 1 },
    );

    return res.json({ success: true, adminList });
  } catch (e) {
    return res.json({ success: false, adminList: [] });
  }
};
module.exports.validateOpsGroup = async (req, res) => {
  try {
    const { name } = req.params;

    const result = await OpsGroup.findOne({
      opsGroupName: name,
      isDelete: false,
    });

    if (result) {
      return res.json({
        success: true,
        message: 'Ops Group Name already present',
      });
    }

    return res.json({ success: false });
  } catch (e) {
    return res.json({
      success: false,
      message: 'Something Went wrong',
    });
  }
};

module.exports.unAssignStaffList = async (req, res) => {
  try {
    const requiredResult = await __.checkRequiredFields(req, ['buId']);

    if (requiredResult.status === false) {
      return __.out(res, 400, requiredResult.missingFields);
    }

    let limit = 0;
    let skip = 0;

    if (req.query.pageno) {
      skip = (parseInt(req.query.pageno, 10) - 1) * 10;
      limit = 10;
    }

    const userIDArr = await OpsGroup.find(
      { buId: { $in: req.body.buId }, isDelete: false },
      { userId: 1, _id: 0 },
    );
    let userId = [];

    userIDArr.forEach((item) => {
      userId = userId.concat(item.userId);
    });

    let userDetails = await User.find(
      {
        _id: { $nin: userId },
        parentBussinessUnitId: { $in: req.body.buId },
      },
      { _id: 1 },
    );

    userDetails = userDetails.map((user) => user._id);

    const unAssignUser = await User.find({ _id: { $in: userDetails } })
      .select(
        '_id parentBussinessUnitId name role appointmentId staffId doj contactNumber',
      )
      .populate([
        {
          path: 'appointmentId',
          select: 'name',
        },
        {
          path: 'role',
          select: 'name description',
        },
        {
          path: 'parentBussinessUnitId',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        },
      ])
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, data: unAssignUser });
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.assignStaffList = async (req, res) => {
  try {
    const requiredResult = await __.checkRequiredFields(req, ['buId']);

    if (requiredResult.status === false) {
      return __.out(res, 400, requiredResult.missingFields);
    }

    let limit = 0;
    let skip = 0;

    if (req.query.pageno) {
      skip = (parseInt(req.query.pageno, 10) - 1) * 10;
      limit = 10;
    }

    const userIDArr = await OpsGroup.find(
      { buId: { $in: req.body.buId }, isDelete: false },
      { userId: 1, _id: 0 },
    );
    let userId = [];

    userIDArr.forEach((item) => {
      userId = userId.concat(item.userId);
    });
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select('_id parentBussinessUnitId name role appointmentId')
      .populate([
        {
          path: 'appointmentId',
          select: 'name',
        },
        {
          path: 'role',
          select: 'name description',
        },
        {
          path: 'parentBussinessUnitId',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        },
      ])
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, data: unAssignUser });
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong', e });
  }
};
module.exports.teamStaff = async (req, res) => {
  try {
    const requiredResult = await __.checkRequiredFields(req, [
      'opsTeamId',
      'opsGroupId',
    ]);

    if (requiredResult.status === false) {
      return __.out(res, 400, requiredResult.missingFields);
    }

    let limit = 0;
    let skip = 0;

    if (req.query.pageno) {
      skip = (parseInt(req.query.pageno, 10) - 1) * 10;
      limit = 10;
    }

    const userIDArr = await OpsTeam.find(
      { _id: { $in: req.body.opsTeamId }, isDeleted: false },
      { userId: 1, _id: 0 },
    );
    let userId = [];

    userIDArr.forEach((item) => {
      userId = userId.concat(item.userId);
    });
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select(
        '_id parentBussinessUnitId name role appointmentId doj contactNumber staffId',
      )
      .populate([
        {
          path: 'appointmentId',
          select: 'name',
        },
        {
          path: 'role',
          select: 'name description',
        },
        {
          path: 'parentBussinessUnitId',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        },
      ])
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, data: unAssignUser });
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.opsGroupStaff = async (req, res) => {
  try {
    const requiredResult = await __.checkRequiredFields(req, ['opsGroupId']);

    if (requiredResult.status === false) {
      return __.out(res, 400, requiredResult.missingFields);
    }

    const userIDArr = await OpsGroup.find(
      { _id: { $in: req.body.opsGroupId }, isDelete: false },
      { userId: 1, _id: 0 },
    );
    let userId = [];

    userIDArr.forEach((item) => {
      userId = userId.concat(item.userId);
    });
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select(
        '_id parentBussinessUnitId name role appointmentId doj contactNumber staffId',
      )
      .populate([
        {
          path: 'appointmentId',
          select: 'name',
        },
        {
          path: 'role',
          select: 'name description',
        },
        {
          path: 'parentBussinessUnitId',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        },
      ])
      .lean();

    return res.status(200).json({ success: true, data: unAssignUser });
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.opsGroupTeam = async (req, res) => {
  try {
    const requiredResult = await __.checkRequiredFields(req, ['opsGroupId']);

    if (requiredResult.status === false) {
      return __.out(res, 400, requiredResult.missingFields);
    }

    const opsTeamIdObj = await OpsGroup.find(
      { _id: { $in: req.body.opsGroupId }, isDelete: false },
      { opsTeamId: 1, _id: 0 },
    );
    let opsTeamIdArr = [];

    opsTeamIdObj.forEach((item) => {
      opsTeamIdArr = opsTeamIdArr.concat(item.opsTeamId);
    });
    const unAssignUser = await OpsTeam.find({
      _id: { $in: opsTeamIdArr },
      isDeleted: false,
    })
      .select('_id name')
      .lean();
    let team = JSON.stringify(unAssignUser);

    team = JSON.parse(team);
    team.forEach((item) => {
      item.checkbox = false;
    });
    return res.status(200).json({ success: true, data: unAssignUser });
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.transferToOpsGroup = async (req, res) => {
  try {
    const { data } = req.body;
    const promiseData = [];
    const opsGroupData = async (userId) => {
      await OpsGroup.update({ userId }, { $pull: { userId } });

      await OpsTeam.update({ userId }, { $pull: { userId } });
      await OpsGroup.findOneAndUpdate(
        { _id: data.destinationOpsGroupId },
        { $push: { userId } },
      );

      if (data.destinationOpsTeamId) {
        await OpsTeam.findOneAndUpdate(
          { _id: data.destinationOpsTeamId },
          { $push: { userId } },
        );
      }
    };

    for (let i = 0; i < data.idArr.length; i += 1) {
      promiseData.push(opsGroupData(data.idArr[i]));
    }

    await Promise.all(promiseData);

    return res
      .status(200)
      .json({ success: true, message: 'Staff Transferred Successfully' });
  } catch (e) {
    return res
      .status(400)
      .json({ success: false, message: 'Something went wrong', e });
  }
};
module.exports.removeStaffByUserId = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errorMessage: errors.array() });
    }

    const requiredResult = await __.checkRequiredFields(req, ['userId']);

    if (requiredResult.status === false) {
      return __.out(res, 400, requiredResult.missingFields);
    }

    let annualLeaveId = await leaveType.findOne({
      isActive: true,
      name: 'Annual Leave',
      companyId: req.user.companyId,
    });

    if (annualLeaveId) {
      annualLeaveId = annualLeaveId._id;
    }

    if (!annualLeaveId) {
      return res.json({
        success: false,
        message: 'No annual leave found for this company',
      });
    }

    if (req.body.teamId) {
      const obj = {
        teamId: req.body.teamId,
        deletedDateTime: new Date(),
        userId: req.user._id,
      };

      await OpsGroup.update(
        { opsTeamId: req.body.teamId },
        {
          $pull: { opsTeamId: req.body.teamId },
          $push: { removeOpsTeamId: obj },
          $inc: { noOfTeam: -1 },
        },
      );
      await OpsTeam.update(
        { _id: req.body.teamId },
        { $set: { isDeleted: true } },
      );
    }

    const userIdArr = req.body.userId;
    const promiseData = [];
    const userIdsArrCall = async (userId, id) => {
      id = mongoose.Types.ObjectId(id);
      await OpsGroup.update({ userId }, { $pull: { userId } });

      await OpsTeam.findOneAndUpdate(
        { userId: { $in: [id] } },
        {
          $pull: { userId: id },
        },
      );

      const ballotData = await Ballot.find({
        isConduct: false,
        appliedStaff: { $elemMatch: { userId: id } },
      });
      let total = 0;

      if (ballotData && ballotData.length > 0) {
        const promiseData1 = [];
        const ballotAppliedCall = async (bal, ballotApplied) => {
          let leaveFormat = 5;

          if (bal.leaveConfiguration === 2) {
            leaveFormat = 6;
          } else if (bal.leaveConfiguration === 3) {
            leaveFormat = 7;
          }

          if (bal.leaveType === 2) {
            leaveFormat = 1;
          }

          if (ballotApplied) {
            let totalApplied = 0;

            for (let k = 0; k < ballotApplied.length; k += 1) {
              const stf = ballotApplied[k];

              if (stf.userId.toString() === userId) {
                totalApplied += 1;
                ballotApplied.splice(k, 1);
                k -= 1;
              }
            }
            total += leaveFormat * totalApplied;
          }

          // update ballot
          // ballotApplied
          await Ballot.findOneAndUpdate(
            { _id: bal._id },
            { $set: { appliedStaff: ballotApplied } },
          );
          // remove quota total
          const year = new Date(bal.weekRange[0].end).getFullYear();

          // total = -1 * total;
          await staffLeave.findOneAndUpdate(
            {
              userId,
              leaveDetails: {
                $elemMatch: { year, leaveTypeId: annualLeaveId },
              },
            },
            {
              $inc: {
                'leaveDetails.$.planQuota': total,
                'leaveDetails.$.request': total,
              },
            },
          );
        };

        for (let j = 0; j < ballotData.length; j += 1) {
          promiseData1.push(
            ballotAppliedCall(ballotData[j], ballotData[j].appliedStaff),
          );
        }
        await Promise.all(promiseData1);
      }
    };

    for (let i = 0; i < userIdArr.length; i += 1) {
      promiseData.push(userIdsArrCall(userIdArr[i], userIdArr[i]));
    }
    await Promise.all(promiseData);
    return res.json({ success: true, message: 'Staff Removed Successfully' });
  } catch (e) {
    return res
      .status(200)
      .json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.getSysAdmin = async (req, res) => {
  try {
    const { companyId } = req.user;
    const admin = await OpsGroupSystemAdmin.find({
      companyId,
    }).populate([
      {
        path: 'userId',
        select: 'name',
      },
      {
        path: 'userBuId',
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
      {
        path: 'buId',
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

    return res.json({ success: true, data: admin });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong' });
  }
};
module.exports.addSysAdmin = async (req, res) => {
  try {
    const data = {
      userId: req.body.userId,
      userBuId: req.body.userBuId,
      buId: req.body.buId,
      companyId: req.user.companyId,
      createdBy: req.user._id,
      hasAccess: req.body.hasAccess,
    };
    const opsGroupAdmin = await new OpsGroupSystemAdmin(data).save();

    if (data.hasAccess === 0) {
      await User.findOneAndUpdate(
        { _id: data.userId },
        { $set: { isUsedInOpsGroup: true } },
      );
      await SubSection.updateMany(
        { _id: { $in: data.buId } },
        { $set: { isUsedInOpsGroup: true } },
      );
    } else {
      await User.findOneAndUpdate(
        { _id: data.userId },
        { $set: { isUserInOpsViewOnly: true } },
      );
      await SubSection.updateMany(
        { _id: { $in: data.buId } },
        { $set: { isUserInOpsViewOnly: true } },
      );
    }

    return res.json({ success: true, message: 'Admin Created', opsGroupAdmin });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

module.exports.updateSysAdmin = async (req, res) => {
  const data = req.body;

  try {
    if (data.hasAccess === 0) {
      if (data.deletedBu && data.deletedBu.length > 0) {
        const delArr = data.deletedBu;

        await OpsGroupSystemAdmin.update(
          { _id: data.staffId },
          { $pullAll: { buId: data.deletedBu } },
        );
        await SubSection.updateMany(
          { _id: { $in: delArr } },
          { $set: { isUsedInOpsGroup: false } },
        );
      }

      const opsgrpSystem = await OpsGroupSystemAdmin.findById(data.staffId);
      const missing = data.buId.filter(
        (item) => opsgrpSystem.buId.indexOf(item) < 0,
      );

      if (missing.length > 0) {
        await OpsGroupSystemAdmin.update(
          { _id: data.staffId },
          { $push: { buId: { $each: missing } } },
        );
        await SubSection.updateMany(
          { _id: { $in: missing } },
          { $set: { isUsedInOpsGroup: true } },
        );
      }

      return res.json({ success: true, message: 'updated Successfully' });
    }

    if (data.deletedBu && data.deletedBu.length > 0) {
      const delArr = data.deletedBu;

      await OpsGroupSystemAdmin.update(
        { _id: data.staffId },
        { $pullAll: { buId: data.deletedBu } },
      );
      await SubSection.updateMany(
        { _id: { $in: delArr } },
        { $set: { isUserInOpsViewOnly: false } },
      );
    }

    const opsgrpSystem = await OpsGroupSystemAdmin.findById(data.staffId);
    const missing = data.buId.filter(
      (item) => opsgrpSystem.buId.indexOf(item) < 0,
    );

    if (missing.length > 0) {
      await OpsGroupSystemAdmin.update(
        { _id: data.staffId },
        { $push: { buId: { $each: missing } } },
      );
      await SubSection.updateMany(
        { _id: { $in: missing } },
        { $set: { isUserInOpsViewOnly: true } },
      );
    }

    return res.json({ success: true, message: 'updated Successfully' });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

module.exports.unusedAdmin = async (req, res) => {
  try {
    const privilege = await Privilege.find(
      { 'flags.createEditOPSGroup': true },
      { _id: 1 },
    );
    const privilegeArr = [];

    privilege.forEach((item) => {
      privilegeArr.push(item);
    });
    const role = await Role.find(
      { companyId: req.user.companyId, privileges: { $in: privilegeArr } },
      { _id: 1 },
    );
    const roleArr = [];

    role.forEach((item) => {
      roleArr.push(item);
    });
    const user = await User.find(
      {
        companyId: req.user.companyId,
        role: { $in: roleArr },
        isUsedInOpsGroup: { $ne: true },
      },
      { _id: 1, parentBussinessUnitId: 1, staffId: 1, name: 1 },
    );

    return res.json({ success: true, data: user, roleArr });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong1', e });
  }
};
module.exports.getUnassignBu = async (req, res) => {
  try {
    const bu = await SubSection.find({ isUsedInOpsGroup: { $ne: true } })
      .populate({
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
      })
      .populate({
        path: 'appointments',
        select: 'name status',
      })
      .lean();
    const found = bu.filter((bUnit) => {
      if (bUnit.sectionId !== null) {
        return false;
      }

      return (
        bUnit.sectionId.departmentId.companyId._id.toString() ===
        req.user.companyId.toString()
      );
    });

    return res.json({ success: true, data: found });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong1', e });
  }
};
module.exports.getUnassignBuForViewOnly = async (req, res) => {
  try {
    const bu = await SubSection.find({ isUserInOpsViewOnly: { $ne: true } })
      .populate({
        path: 'sectionId',
        select: 'name',
        populate: {
          path: 'departmentId',
          select: 'name status',
          populate: {
            path: 'companyId',
            select: '_id name status',
          },
        },
      })
      .populate({
        path: 'appointments',
        select: 'name status',
      })
      .lean();

    const found = bu.filter((bUnit) => {
      if (bUnit.sectionId == null) {
        return false;
      }

      return (
        bUnit.sectionId.departmentId.companyId._id.toString() ===
        req.user.companyId.toString()
      );
    });

    return res.json({ success: true, data: found });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong1', e });
  }
};

module.exports.getAdminDeatils = async (req, res) => {
  try {
    let userId = req.user._id;

    if (req.params.id !== '0') {
      userId = req.params.id;
    }

    const admin = await OpsGroupSystemAdmin.findOne({
      userId,
    }).populate([
      {
        path: 'userId',
        select: 'name',
      },
      {
        path: 'userBuId',
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
      {
        path: 'buId',
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

    return res.json({ success: true, data: admin });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

// API to update OPS TEAM
module.exports.update = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errorMessage: errors.array() });
    }

    const insertObj = {
      userId: req.body.userId,
      buId: req.body.buId,
      opsGroupName: req.body.opsGroupName,
      adminId: req.body.adminId,
      noOfTeam: req.body.noOfTeam,
      createdBy: req.user._id,
      companyId: req.user.companyId,
      isDraft: req.body.isDraft,
      swopSetup: req.body.swopSetup,
    };
    const ops = await OpsGroup.findOneAndUpdate(
      { _id: req.body._id },
      insertObj,
    );
    const opsTeamId = [];
    const promiseData = [];
    const opsTeamIdCall = async (team) => {
      const teamObj = {
        name: team.name,
        adminId: team.admin,
        userId: team.userId,
        opsGroupId: ops._id,
        buId: req.body.buId,
        createdBy: req.user._id,
      };

      if (team._id) {
        await OpsTeam.findOneAndUpdate({ _id: team._id }, teamObj);

        opsTeamId.push(team._id.toString());
      } else {
        const opsTeam = await new OpsTeam(teamObj).save();

        opsTeamId.push(opsTeam._id.toString());
      }
    };

    for (let i = 0; i < insertObj.noOfTeam; i += 1) {
      promiseData.push(opsTeamIdCall(req.body.opsTeam[i]));
    }
    await Promise.all(promiseData);
    if (opsTeamId.length > 0) {
      await OpsGroup.update({ _id: ops._id }, { $set: { opsTeamId } });
    }

    return res.status(200).json({
      success: true,
      message: 'Ops Group Updated Successfully',
      OpsGroup: ops,
    });
  } catch (err) {
    __.log(err);
    return __.out(res, 500);
  }
};

// API to delete created Group
module.exports.remove = async (req, res) => {
  try {
    const where = {
      _id: req.body._id,
    };
    const data = await OpsGroup.findOneAndRemove(where);

    if (data) {
      return res.status(201).json({
        success: true,
        message: 'Group deleted Successfully',
        OpsGroup: data,
      });
    }

    return res.status(201).json({
      success: false,
      message: 'Failed',
      OpsGroup: data,
    });
  } catch (err) {
    __.log(err);
    return __.out(res, 500);
  }
};

// API to fetch buNmae of specific ops group
module.exports.buName = async (req, res) => {
  try {
    const buName = await OpsGroup.find({ _id: req.body._id }).populate([
      {
        path: 'buId',
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
    ]);

    return __.out(res, 201, {
      buList: buName != null ? buName : [],
    });
  } catch (err) {
    __.log(err);
    return __.out(res, 500);
  }
};

// API to fetch users from bu
module.exports.getUsersByBuId = async (req, res) => {
  try {
    const buIds = req.body.businessUnitId;
    const buIdData = [];
    const promises = buIds.map(async (buId) => {
      const where = {
        companyId: req.user.companyId,
        status: 1,
      };

      where.parentBussinessUnitId = mongoose.Types.ObjectId(buId);
      const users = await User.find(where)
        .populate({
          path: 'companyId',
          select: 'name',
        })
        .populate([
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
                select: 'name',
              },
            },
          },
        ]);

      buIdData.push(users);
    });

    return Promise.all(promises).then(() => __.out(res, 201, buIdData));
  } catch (err) {
    __.log(err);
    return __.out(res, 500, err);
  }
};

// Api for mobile, display no of users in ops grp with details
module.exports.getOpsUsers = async (req, res) => {
  try {
    const where = {
      buId: req.body.buId,
      _id: req.body._id,
    };
    const data = await OpsGroup.find(where)
      .lean()
      .populate({
        path: 'userId',
        populate: {
          path: 'appointmentId',
          select: 'name',
        },
      });

    return __.out(res, 201, {
      opsGroupUsers: data != null ? data : [],
    });
  } catch (err) {
    __.log(err);
    return __.out(res, 500, err);
  }
};

// Api for mobile, display no of grp in bu
module.exports.getOpsList = async (req, res) => {
  try {
    const where = { buId: req.body.buId };
    const data = await OpsGroup.find(where).lean();

    return __.out(res, 201, {
      opsGroupList: data != null ? data : [],
    });
  } catch (err) {
    __.log(err);
    return __.out(res, 500, err);
  }
};

module.exports.unusedStaffReadOnly = async (req, res) => {
  try {
    const privilege = await Privilege.find(
      {
        $and: [
          { 'flags.viewOPSGroup': true },
          { 'flags.setupOPSGroup:': { $exists: false } },
        ],
      },
      { _id: 1 },
    );
    const onlyviewPrivillege = await Privilege.find(
      { 'flags.setupOPSGroup': true },
      { _id: 1 },
    );
    const privilegeArr = [];
    const onlyP = [];

    onlyviewPrivillege.forEach((it) => {
      onlyP.push(it);
    });
    privilege.forEach((item) => {
      privilegeArr.push(item);
    });
    const role = await Role.find(
      {
        $and: [
          { companyId: req.user.companyId, privileges: { $in: privilegeArr } },
          { companyId: req.user.companyId, privileges: { $nin: onlyP } },
        ],
      },
      { _id: 1 },
    );

    const roleArr = [];

    role.forEach((item) => {
      roleArr.push(item);
    });
    const user = await User.find(
      {
        companyId: req.user.companyId,
        role: { $in: roleArr },
        isUserInOpsViewOnly: { $ne: true },
      },
      { _id: 1, parentBussinessUnitId: 1, staffId: 1, name: 1 },
    );

    return res.json({ success: true, data: user, roleArr });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong1', e });
  }
};

module.exports.removeBuFromOpsGroup = async (req, res) => {
  try {
    const data = req.body;
    const removeBuFromOpsGroup = await OpsGroup.findOneAndUpdate(
      { _id: data.opsGroupId },
      { $pull: { buId: data.buID } },
    );

    const promiseData = [];
    const opsGroupBuTeamCall = async (teamId) => {
      await OpsTeam.update({ _id: teamId }, { $pull: { buId: data.buID } });
    };

    for (let i = 0; i < removeBuFromOpsGroup.opsTeamId.length; i += 1) {
      promiseData.push(opsGroupBuTeamCall(removeBuFromOpsGroup.opsTeamId[i]));
    }

    await Promise.all(promiseData);

    const userIdArr = req.body.userId;

    const promiseData1 = [];
    const opsGroupBuUserCall = async (userId) => {
      await OpsGroup.update({ userId }, { $pull: { userId } });

      await OpsTeam.update({ userId }, { $pull: { userId } });
    };

    for (let i = 0; i < userIdArr.length; i += 1) {
      promiseData1.push(opsGroupBuUserCall(userIdArr[i]));
    }

    await Promise.all(promiseData1);

    const OpsGroupDetails = await OpsGroup.findOne({
      _id: data.opsGroupId,
      isDelete: false,
    })
      .populate([
        {
          path: 'userId',
          select: [
            'name',
            'email',
            'doj',
            'contactNumber',
            'staffId',
            'parentBussinessUnitId',
          ],
          populate: [
            {
              path: 'appointmentId',
              select: ['name', 'status'],
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
          path: 'opsTeamId',
          populate: [
            {
              path: 'userId',
              select: [
                'name',
                'email',
                'doj',
                'contactNumber',
                'staffId',
                'parentBussinessUnitId',
              ],
              populate: [
                {
                  path: 'appointmentId',
                  select: ['name', 'status'],
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
              path: 'adminId',
              select: ['name', 'email', 'doj'],
              populate: {
                path: 'appointmentId',
                select: ['name', 'status'],
              },
            },
          ],
        },
        {
          path: 'adminId',
          select: ['name', 'email', 'doj'],
          populate: {
            path: 'appointmentId',
            select: ['name', 'status'],
          },
        },
        {
          path: 'buId',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        },
      ])
      .lean();

    return res.json({
      success: true,
      message: 'Source Bu Deleted Successfully',
      data: OpsGroupDetails,
    });
  } catch (e) {
    return res.json({ success: false, message: 'Something went wrong', e });
  }
};
module.exports.exportOpsGroup = async (req, res) => {
  try {
    const opsData = req.body;
    const currentYear = moment().year();
    const previousYear = currentYear - 1;
    const nextYear = currentYear + 1;
    const isAnnualLeave = await leaveType.findOne({
      name: 'Annual Leave',
      isActive: true,
      companyId: req.user.companyId,
    });
    let csvAll = null;

    if (isAnnualLeave) {
      const keys = [
        'Ops Group Name',
        'Staff Id',
        'Staff name',
        'Staff Parent Bu',
        'Staff Email',
        'Staff Phone',
        'Date Added',
        'Last Modified',
        'Admin Name',
        'Leave Group Name',
        `Plan Quota (${previousYear})`,
        `Annual Leave ${previousYear} (Remaining Plan quota)`,
        `Plan Quota (${currentYear})`,
        `Annual Leave ${currentYear} (Remaining Plan quota)`,
        `Plan Quota (${nextYear})`,
        `Annual Leave ${nextYear} (Remaining Plan quota)`,
      ];
      let isTeamPresent = false;

      if (opsData.opsTeamId && opsData.opsTeamId.length > 0) {
        keys.splice(1, 0, 'Ops Team Name');
        isTeamPresent = true;
      }

      const csvData = [];

      if (isTeamPresent) {
        const promiseAll = [];
        const csvDataIfCall = async (i, j) => {
          const csvObj = {
            'Ops Group Name': opsData.opsGroupName,
            'Ops Team Name': opsData.opsTeamId[i].name,
            'Staff Id': opsData.opsTeamId[i].userId[j].staffId,
            'Staff name': opsData.opsTeamId[i].userId[j].name,
            'Staff Parent Bu':
              opsData.opsTeamId[i].userId[j].parentBussinessUnitId.orgName,
            'Staff Email': opsData.opsTeamId[i].userId[j].email,
            'Staff Phone': opsData.opsTeamId[i].userId[j].contactNumber,
            'Date Added': moment(opsData.createdAt).format('MM-DD-YYYY'),
            'Last Modified': moment(opsData.updatedAt).format(
              'MM-DD-YYYY HH:mm',
            ),
            'Admin Name': opsData.createdBy ? opsData.createdBy.name : '',
          };
          const userSapData = await staffLeave
            .findOne(
              { userId: opsData.opsTeamId[i].userId[j]._id },
              { leaveGroupId: 1, leaveDetails: 1 },
            )
            .populate([
              {
                path: 'leaveGroupId',
                select: 'name',
              },
            ]);

          if (userSapData) {
            let userSap = JSON.stringify(userSapData);

            userSap = JSON.parse(userSap);
            csvObj['Leave Group Name'] = userSap.leaveGroupId.name;
            // previous year data
            const leaveDetailsPreviousYear = userSap.leaveDetails.filter(
              (leave) =>
                leave.leaveTypeId.toString() === isAnnualLeave._id.toString() &&
                leave.year === previousYear,
            );

            if (
              leaveDetailsPreviousYear &&
              leaveDetailsPreviousYear.length > 0
            ) {
              const [leaveDetailsPreviousYearItem] = leaveDetailsPreviousYear;

              csvObj[`Plan Quota (${previousYear})`] =
                leaveDetailsPreviousYearItem.total;
              csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                leaveDetailsPreviousYearItem.planQuota;
            } else {
              csvObj[`Plan Quota (${previousYear})`] = '-';
              csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                '-';
            }

            // current year data
            const leaveDetailsCurrentYear = userSap.leaveDetails.filter(
              (leave) =>
                leave.leaveTypeId.toString() === isAnnualLeave._id.toString() &&
                leave.year === currentYear,
            );

            if (leaveDetailsCurrentYear && leaveDetailsCurrentYear.length > 0) {
              const [leaveDetailsCurrentYearItem] = leaveDetailsCurrentYear;

              csvObj[`Plan Quota (${currentYear})`] =
                leaveDetailsCurrentYearItem.total;
              csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                leaveDetailsCurrentYearItem.planQuota;
            } else {
              csvObj[`Plan Quota (${currentYear})`] = '-';
              csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                '-';
            }

            // next year data
            const leaveDetailsNextYear = userSap.leaveDetails.filter(
              (leave) =>
                leave.leaveTypeId.toString() === isAnnualLeave._id.toString() &&
                leave.year === nextYear,
            );

            if (leaveDetailsNextYear && leaveDetailsNextYear.length > 0) {
              const [leaveDetailsNextYearItem] = leaveDetailsNextYear;

              csvObj[`Plan Quota (${nextYear})`] =
                leaveDetailsNextYearItem.total;
              csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] =
                leaveDetailsNextYearItem.planQuota;
            } else {
              csvObj[`Plan Quota (${nextYear})`] = '-';
              csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] = '-';
            }
          } else {
            csvObj['Leave Group Name'] = '-';
            csvObj[`Plan Quota (${previousYear})`] = '-';
            csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] = '-';
            csvObj[`Plan Quota (${currentYear})`] = '-';
            csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] = '-';
            csvObj[`Plan Quota (${nextYear})`] = '-';
            csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] = '-';
          }

          csvData.push(csvObj);
        };

        for (let i = 0; i <= opsData.opsTeamId.length - 1; i += 1) {
          for (let j = 0; j <= opsData.opsTeamId[i].userId.length - 1; j += 1) {
            promiseAll.push(csvDataIfCall(i, j));
          }
        }
        await Promise.all(promiseAll);
      } else {
        const promiseAll1 = [];
        const csvDataElseCall = async (k) => {
          const csvObj = {
            'Ops Group Name': opsData.opsGroupName,
            'Staff Id': opsData.userId[k].staffId,
            'Staff name': opsData.userId[k].name,
            'Staff Parent Bu': opsData.userId[k].parentBussinessUnitId.orgName,
            'Staff Email': opsData.userId[k].email,
            'Staff Phone': opsData.userId[k].contactNumber,
            'Date Added': moment(opsData.createdAt).format('MM-DD-YYYY'),
            'Last Modified': moment(opsData.updatedAt).format(
              'MM-DD-YYYY HH:mm',
            ),
            'Admin Name': opsData.createdBy.name,
          };

          const userSapData = await staffLeave
            .findOne(
              { userId: opsData.userId[k]._id },
              { leaveGroupId: 1, leaveDetails: 1 },
            )
            .populate([
              {
                path: 'leaveGroupId',
                select: 'name',
              },
            ]);

          if (userSapData) {
            let userSap = JSON.stringify(userSapData);

            userSap = JSON.parse(userSap);
            csvObj['Leave Group Name'] = userSap.leaveGroupId.name;

            // previous year data
            const leaveDetailsPreviousYear = userSap.leaveDetails.filter(
              (leave) =>
                leave.leaveTypeId.toString() === isAnnualLeave._id.toString() &&
                leave.year === 2021,
            );

            if (
              leaveDetailsPreviousYear &&
              leaveDetailsPreviousYear.length > 0
            ) {
              const [leaveDetailsPreviousYearItem] = leaveDetailsPreviousYear;

              csvObj[`Plan Quota (${previousYear})`] =
                leaveDetailsPreviousYearItem.total;
              csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                leaveDetailsPreviousYearItem.planQuota;
            } else {
              csvObj[`Plan Quota (${previousYear})`] = '-';
              csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] =
                '-';
            }

            // current year data
            const leaveDetailsCurrentYear = userSap.leaveDetails.filter(
              (leave) =>
                leave.leaveTypeId.toString() === isAnnualLeave._id.toString() &&
                leave.year === 2022,
            );

            if (leaveDetailsCurrentYear && leaveDetailsCurrentYear.length > 0) {
              const [leaveDetailsCurrentYearItem] = leaveDetailsCurrentYear;

              csvObj[`Plan Quota (${currentYear})`] =
                leaveDetailsCurrentYearItem.total;
              csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                leaveDetailsCurrentYearItem.planQuota;
            } else {
              csvObj[`Plan Quota (${currentYear})`] = '-';
              csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] =
                '-';
            }

            // next year data
            const leaveDetailsNextYear = userSap.leaveDetails.filter(
              (leave) =>
                leave.leaveTypeId.toString() === isAnnualLeave._id.toString() &&
                leave.year === nextYear,
            );

            if (leaveDetailsNextYear && leaveDetailsNextYear.length > 0) {
              const [leaveDetailsNextYearItem] = leaveDetailsNextYear;

              csvObj[`Plan Quota (${nextYear})`] =
                leaveDetailsNextYearItem.total;
              csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] =
                leaveDetailsNextYearItem.planQuota;
            } else {
              csvObj[`Plan Quota (${nextYear})`] = '-';
              csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] = '-';
            }
          } else {
            csvObj['Leave Group Name'] = '-';
            csvObj[`Plan Quota (${previousYear})`] = '-';
            csvObj[`Annual Leave ${previousYear} (Remaining Plan quota)`] = '-';
            csvObj[`Plan Quota (${currentYear})`] = '-';
            csvObj[`Annual Leave ${currentYear} (Remaining Plan quota)`] = '-';
            csvObj[`Plan Quota (${nextYear})`] = '-';
            csvObj[`Annual Leave ${nextYear} (Remaining Plan quota)`] = '-';
          }

          csvData.push(csvObj);
        };

        for (let k = 0; k <= opsData.userId.length - 1; k += 1) {
          promiseAll1.push(csvDataElseCall(k));
        }
        await Promise.all(promiseAll1);
      }

      csvAll = await json2csv(csvData, keys);
    }

    res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
    res.set('Content-Type', 'application/csv');
    return res.status(200).json({ csv: csvAll, noData: true });
  } catch (err) {
    __.log(err);
    return __.out(res, 500, err);
  }
};

const checkIfHasId = (arrayvar, id) => {
  let result = false;

  result = arrayvar.includes(id);

  return result;
};

const getBodyData1 = (req) =>
  new Promise((resolve, reject) => {
    const form = new multiparty.Form();

    form.parse(req, (err, fields, files) => {
      const pathCSV = files.file[0].path;

      csv()
        .fromFile(pathCSV)
        .then((jsonObj) => {
          const dataRequiredObj = {
            opsGroupDetails: jsonObj,
          };

          resolve(dataRequiredObj);
        })
        .catch(() => {
          reject(new Error(err));
        });
    });
  });

module.exports.importOpsGroup = async (req, res) => {
  try {
    const bodyData = await getBodyData1(req);

    if (bodyData) {
      await async.eachSeries(bodyData.opsGroupDetails, (item, next) => {
        const opsData = item;

        if (opsData['Ops Group Name'] === '' || opsData['Admin Name'] === '') {
          next();
        }

        if (
          opsData['Ops Group Name'] === undefined ||
          opsData['Admin Name'] === undefined
        ) {
          next();
        }

        const parentBuArr = opsData['Staff Parent Bu'].split('>');
        const parentBu = parentBuArr[3].trim();

        SubSection.findOne({ name: parentBu })
          .then((Bu) => {
            User.findOne({ name: opsData['Admin Name'] })
              .then((user) => {
                OpsGroupSystemAdmin.findOne({ userId: user._id })
                  .then((systemAdminData) => {
                    const ifHas = checkIfHasId(systemAdminData.buId, Bu._id);

                    if (ifHas === true) {
                      User.findOne({ staffId: opsData['Staff Id'] })
                        .populate({
                          path: 'parentBussinessUnitId',
                          select: 'name',
                        })
                        .then((staff) => {
                          if (staff.name !== opsData['Staff name']) {
                            const logObj = {
                              message: 'StaffId and Staff name does not match',
                              adminName: opsData['Admin Name'],
                              adminId: user._id,
                              userName: opsData['Staff name'],
                              opsGroupName: opsData['Ops Group Name'],
                              opsTeamName: opsData['Ops Team Name'],
                            };
                            const log = new OpsLog(logObj);

                            log.save();

                            next();
                          } else {
                            OpsGroup.find({ userId: staff._id })
                              .then((ops) => {
                                if (ops.length > 0) {
                                  const logObj = {
                                    message:
                                      'This Staff is already exists in some other ops group',
                                    adminName: opsData['Admin Name'],
                                    adminId: user._id,
                                    userName: opsData['Staff name'],
                                    opsGroupName: opsData['Ops Group Name'],
                                    opsTeamName: opsData['Ops Team Name'],
                                  };
                                  const log = new OpsLog(logObj);

                                  log.save();

                                  next();
                                } else {
                                  OpsGroup.findOne({
                                    opsGroupName: opsData['Ops Group Name'],
                                  })
                                    .then((opsgroup) => {
                                      if (
                                        opsData['Ops Team Name'] !== '' &&
                                        opsData['Ops Team Name'] !== undefined
                                      ) {
                                        if (opsgroup.opsTeamId.length > 0) {
                                          OpsTeam.findOne({
                                            name: opsData['Ops Team Name'],
                                          })
                                            .then((team) => {
                                              OpsGroup.update(
                                                { _id: opsgroup._id },
                                                {
                                                  $push: { userId: staff._id },
                                                },
                                                (err) => {
                                                  if (!err) {
                                                    OpsTeam.update(
                                                      { _id: team._id },
                                                      {
                                                        $push: {
                                                          userId: staff._id,
                                                        },
                                                      },
                                                      () => {
                                                        if (!err) {
                                                          next();
                                                        } else {
                                                          next();
                                                        }
                                                      },
                                                    );
                                                  } else {
                                                    next();
                                                  }
                                                },
                                              );
                                            })
                                            .catch(() => {
                                              const logObj = {
                                                message:
                                                  'Cannot find specified team.',
                                                adminName:
                                                  opsData['Admin Name'],
                                                adminId: user._id,
                                                userName: opsData['Staff name'],
                                                opsGroupName:
                                                  opsData['Ops Group Name'],
                                                opsTeamName:
                                                  opsData['Ops Team Name'],
                                              };
                                              const log = new OpsLog(logObj);

                                              log.save();

                                              next();
                                            });
                                        } else {
                                          // This ops group dont have teams
                                          const logObj = {
                                            message:
                                              'This Ops Group does not contain any Team. Cannot add Staff to ops group.',
                                            adminName: opsData['Admin Name'],
                                            adminId: user._id,
                                            userName: opsData['Staff name'],
                                            opsGroupName:
                                              opsData['Ops Group Name'],
                                            opsTeamName:
                                              opsData['Ops Team Name'],
                                          };
                                          const log = new OpsLog(logObj);

                                          log.save();

                                          next();
                                        }
                                      } else if (
                                        opsgroup.opsTeamId.length > 0
                                      ) {
                                        const logObj = {
                                          message:
                                            'Please specify Team To add this staff. This Ops group contains Teams',
                                          adminName: opsData['Admin Name'],
                                          adminId: user._id,
                                          userName: opsData['Staff name'],
                                          opsGroupName:
                                            opsData['Ops Group Name'],
                                          opsTeamName: opsData['Ops Team Name'],
                                        };
                                        const log = new OpsLog(logObj);

                                        log.save();

                                        next();
                                      } else {
                                        const logObj = {
                                          message:
                                            'Please specify Team To add this staff.',
                                          adminName: opsData['Admin Name'],
                                          adminId: user._id,
                                          userName: opsData['Staff name'],
                                          opsGroupName:
                                            opsData['Ops Group Name'],
                                          opsTeamName: opsData['Ops Team Name'],
                                        };
                                        const log = new OpsLog(logObj);

                                        log.save();

                                        next();
                                      }
                                    })
                                    .catch(() => {
                                      next();
                                    });
                                }
                              })
                              .catch(() => {
                                const logObj = {
                                  message: 'Unable to find matching ops group',
                                  adminName: opsData['Admin Name'],
                                  adminId: user._id,
                                  userName: opsData['Staff name'],
                                  opsGroupName: opsData['Ops Group Name'],
                                  opsTeamName: opsData['Ops Team Name'],
                                };
                                const log = new OpsLog(logObj);

                                log.save();

                                next();
                              });
                          }
                        })
                        .catch(() => {
                          const logObj = {
                            message:
                              'Couldent find mathing Staff, please check staffId',
                            adminName: opsData['Admin Name'],
                            adminId: user._id,
                            userName: opsData['Staff name'],
                            opsGroupName: opsData['Ops Group Name'],
                            opsTeamName: opsData['Ops Team Name'],
                          };
                          const log = new OpsLog(logObj);

                          log.save();

                          next();
                        });
                    } else {
                      const logObj = {
                        message:
                          'This Admin can not add any user from requested BU id.',
                        adminName: opsData['Admin Name'],
                        adminId: user._id,
                        userName: opsData['Staff name'],
                        opsGroupName: opsData['Ops Group Name'],
                        opsTeamName: opsData['Ops Team Name'],
                      };
                      const log = new OpsLog(logObj);

                      log.save();

                      next();
                    }
                  })
                  .catch(() => {
                    next();
                  });
              })
              .catch(() => {
                const logObj = {
                  message: 'Admin not found.',
                  opsGroupName: opsData['Ops Group Name'],
                  opsTeamName: opsData['Ops Team Name'],
                };
                const log = new OpsLog(logObj);

                log.save();

                next();
              });
          })
          .catch(() => {
            const logObj = {
              message: 'Business Unit not found.',
              opsGroupName: opsData['Ops Group Name'],
              opsTeamName: opsData['Ops Team Name'],
            };
            const log = new OpsLog(logObj);

            log.save();

            next();
          });
      });
      return res.json({
        status: true,
        code: 0,
        message: 'Successfully Uploaded File',
      });
    }

    return res.json({
      status: false,
      code: 1,
      message: 'Something went wrong, Try to Reupload file.',
    });
  } catch (err) {
    __.log(err);
    return __.out(res, 500, err);
  }
};

module.exports.importCsvLogs = async (req, res) => {
  try {
    const adminid = req.params.id;
    const Logs = await OpsLog.find({ adminId: adminid });

    if (!Logs || !Logs.length > 0) {
      return res.json({
        success: false,
        data: 'No Logs Found',
        message: 'Something went wrong!',
      });
    }

    return res.json({
      success: true,
      data: Logs,
      message: 'Succesfully Received data',
    });
  } catch (err) {
    __.log(err);
    return __.out(res, 500, err);
  }
};

module.exports.getplanbu = async (req, res) => {
  try {
    const data = await User.findOne(
      { _id: req.user._id },
      { _id: 0, planBussinessUnitId: 1 },
    ).populate([
      {
        path: 'planBussinessUnitId',
        select: 'orgName',
        match: {
          status: 1,
        },
      },
    ]);

    return res.json({ data });
  } catch (err) {
    __.log(err);
    return __.out(res, 500, err);
  }
};
module.exports.adminListForBu = async (req, res) => {
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
};
