const { validationResult } = require('express-validator');
const LeaveType = require('../../models/leaveType');
const staffLeave = require('../../models/staffLeave');
const LeaveGroup = require('../../models/leaveGroup');
const LeaveGroupLog = require('../../models/leaveGroupLog');
const __ = require('../../../helpers/globalFunctions');
const User = require('../../models/user');

function monthDiff(d1, d2) {
  let months;

  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
}
function diffYears(dt2, dt1) {
  let diff = (dt2.getTime() - dt1.getTime()) / 1000;

  diff /= 60 * 60 * 24;
  return Math.abs(Math.round(diff / 365.25));
}

class LeaveGroupController {
  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'leaveType',
      ]);

      if (requiredResult.status === false) {
        return res.status(400).json({
          message: `Fields missing ${requiredResult.missingFields.toString()}`,
          success: false,
        });
      }

      // check Leave type is present or not
      const obj = req.body;

      if (obj.leaveType.constructor !== Array) {
        return res.status(200).json({
          message: 'Leave type is not in proper format',
          success: false,
        });
      }

      let isLeaveTypePresent = false;

      // check is array or other

      const promiseData = [];
      const leaveTypePresentCall = async (leaveType) => {
        isLeaveTypePresent = true;
        const isLeaveType = await LeaveType.findOne({
          _id: leaveType.leaveTypeId,
          companyId: req.user.companyId,
          isActive: true,
        });

        if (!isLeaveType) {
          isLeaveTypePresent = false;
        }
        // now asked for seniority is quota is grater then enter one quota
      };

      for (let i = 0; i < obj.leaveType.length; i += 1) {
        promiseData.push(leaveTypePresentCall(obj.leaveType[i]));
      }

      await Promise.all(promiseData);

      if (!isLeaveTypePresent) {
        return res
          .status(200)
          .json({ message: 'Some leave type is not present', success: false });
      }

      obj.createdBy = req.user._id;
      obj.updatedBy = req.user._id;
      obj.companyId = req.user.companyId;
      const found = await LeaveGroup.find({
        name: { $regex: obj.name, $options: 'i' },
        companyId: req.user.companyId,
      });

      if (found && found.length > 0) {
        return res
          .status(200)
          .json({ message: 'Duplicate leave group name', success: false });
      }

      const insertLeaveGroup = await new LeaveGroup(obj).save();

      if (insertLeaveGroup) {
        this.insertLog(res, insertLeaveGroup, 'Leave Group Created', null);
        return res
          .status(200)
          .json({ message: 'leave Group successfully created', success: true });
      }

      return res
        .status(200)
        .json({ message: 'leave group not created', success: false });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'leaveGroupId',
        'leaveType',
      ]);

      if (requiredResult.status === false) {
        return res.status(400).json({
          message: `Fields missing ${requiredResult.missingFields.toString()}`,
          success: false,
        });
      }

      const obj = req.body;

      if (obj.leaveType.constructor !== Array) {
        return res.status(200).json({
          message: 'Leave type is not in proper format',
          success: false,
        });
      }

      let isLeaveTypePresent = false;

      const promiseData = [];
      const leaveTypeListCall = async (leaveType) => {
        isLeaveTypePresent = true;
        const isLeaveType = await LeaveType.findOne({
          _id: leaveType.leaveTypeId,
          companyId: req.user.companyId,
          isActive: true,
        });

        if (!isLeaveType) {
          isLeaveTypePresent = false;
        }
      };

      for (let i = 0; i < obj.leaveType.length; i += 1) {
        promiseData.push(leaveTypeListCall(obj.leaveType[i]));
      }

      await Promise.all(promiseData);

      if (!isLeaveTypePresent) {
        return res
          .status(200)
          .json({ message: 'Some leave type is not present', success: false });
      }

      const isPresent = await LeaveGroup.findOne({
        _id: obj.leaveGroupId,
        isActive: true,
        companyId: req.user.companyId,
      });
      const oldLeaveGroup = JSON.parse(JSON.stringify(isPresent));

      if (isPresent) {
        obj.updatedBy = req.user._id;
        obj.companyId = req.user.companyId;
        const found = await LeaveGroup.find({
          _id: { $ne: obj.leaveGroupId },
          name: obj.name,
          companyId: req.user.companyId,
          isActive: true,
        });

        if (found && found.length > 0) {
          return res
            .status(200)
            .json({ message: 'Duplicate leave group name', success: false });
        }

        const insertLeaveType = await LeaveGroup.findOneAndUpdate(
          { _id: obj.leaveGroupId },
          {
            $set: {
              name: obj.name,
              adminId: obj.adminId,
              updatedBy: obj.updatedBy,
              leaveType: obj.leaveType,
            },
          },
          { new: true },
        );

        if (insertLeaveType) {
          this.updateUser(res, obj.leaveGroupId, oldLeaveGroup);

          this.insertLog(
            res,
            insertLeaveType,
            'Leave Group Updated',
            isPresent,
          );
          return res.status(200).json({
            message: 'leave group successfully updated',
            success: true,
          });
        }

        return res
          .status(200)
          .json({ message: 'leave group not updated', success: false });
      }

      return res
        .status(200)
        .json({ message: 'leave group not found', success: false });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  async updateUser(res, leaveGroupId, oldLeaveGroup) {
    try {
      const user = await User.find({ leaveGroupId }, { _id: 1, doj: 1 });
      const userArr = [];

      if (user && user.length > 0) {
        user.forEach((item) => {
          userArr.push({ userId: item._id, doj: item.doj });
        });
        const newLeaveGroup = await LeaveGroup.findOne({ _id: leaveGroupId });
        const deleteLeaveTypeArr = [];
        const newLeaveTypeArr = [];
        const presentLeaveTypeArr = [];
        const newLeaveType = [];
        const newLeaveTypeObj = [];
        const presentLeaveTypeObj = [];
        const oldLeaveType = [];

        oldLeaveGroup.leaveType.forEach((item) => {
          oldLeaveType.push(item.leaveTypeId.toString());
        });
        newLeaveGroup.leaveType.forEach((item) => {
          newLeaveType.push(item.leaveTypeId.toString());
          if (!oldLeaveType.includes(item.leaveTypeId.toString())) {
            newLeaveTypeArr.push(item.leaveTypeId.toString());
            newLeaveTypeObj.push(item);
          } else {
            presentLeaveTypeArr.push(item.leaveTypeId.toString());
            presentLeaveTypeObj.push(item);
          }
        });

        //   for (let i = 0; i < newLeaveType.length; i++) {
        //     if (!oldLeaveType.includes(newLeaveType[i])) {
        //       newLeaveTypeArr.push(newLeaveType[i]);
        //       newLeaveTypeObj.push(item);
        //     } else {
        //       presentLeaveTypeArr.push(newLeaveType[i]);
        //       //presentLeaveTypeObj
        //     }
        //   }
        for (let i = 0; i < oldLeaveType.length; i += 1) {
          if (!newLeaveType.includes(oldLeaveType[i])) {
            deleteLeaveTypeArr.push(oldLeaveType[i]);
          }
        }
        const userLength = userArr.length;

        const promiseData = [];
        const deleteLeaveTypeListCall = async (sub, i) => {
          const { userId } = sub;

          if (deleteLeaveTypeArr.length > 0) {
            await staffLeave.findOneAndUpdate(
              { userId },
              {
                $pull: {
                  leaveDetails: { leaveTypeId: { $in: deleteLeaveTypeArr } },
                },
              },
            );
          }

          if (newLeaveTypeArr.length > 0) {
            let month = 0;
            let year = 0;

            if (userArr[i].doj) {
              month = monthDiff(new Date(userArr[i].doj), new Date());
              year = diffYears(new Date(userArr[i].doj), new Date());
            }

            newLeaveTypeObj.forEach(async (leave) => {
              if (leave.leaveTypeId) {
                let { quota } = leave;

                if (month > 0) {
                  leave.proRate.forEach((mo) => {
                    if (
                      mo.fromMonth <= month &&
                      mo.toMonth >= month &&
                      quota < mo.quota
                    ) {
                      quota = mo.quota;
                    }
                  });
                }

                if (year > 0) {
                  leave.seniority.forEach((mo) => {
                    if (mo.year <= year && quota < mo.quota) {
                      quota = mo.quota;
                    }
                  });
                }

                const leaveObj = {
                  leaveTypeId: leave.leaveTypeId,
                  quota,
                  planQuota: quota,
                  planDymanicQuota: quota,
                  total: quota,
                };

                await staffLeave.findOneAndUpdate(
                  { userId },
                  { $push: { leaveDetails: leaveObj } },
                );
                // leaveDetails.push(leaveObj);
              }
            });
          }

          if (presentLeaveTypeArr.length > 0) {
            const staffLeaveData = await staffLeave.findOne({ userId });

            if (staffLeaveData) {
              // let leaveDetails = staffLeaveData.leaveDetails;
              const leaveDetails = [];
              let month = 0;
              let year = 0;

              if (userArr[i].doj) {
                month = monthDiff(new Date(userArr[i].doj), new Date());
                year = diffYears(new Date(userArr[i].doj), new Date());
              }

              presentLeaveTypeObj.forEach((leave) => {
                if (leave.leaveTypeId) {
                  let { quota } = leave;

                  if (month > 0) {
                    leave.proRate.forEach((mo) => {
                      if (
                        mo.fromMonth <= month &&
                        mo.toMonth >= month &&
                        quota < mo.quota
                      ) {
                        quota = mo.quota;
                      }
                    });
                  }

                  if (year > 0) {
                    leave.seniority.forEach((mo) => {
                      if (mo.year <= year && quota < mo.quota) {
                        quota = mo.quota;
                      }
                    });
                  }

                  const leaveObj = {
                    leaveTypeId: leave.leaveTypeId.toString(),
                    quota,
                    planQuota: quota,
                    planDymanicQuota: quota,
                    total: quota,
                  };

                  leaveDetails.push(leaveObj);
                }
              });
              // console.log(staffLeaveData.leaveDetails);
              // console.log("*********************************");
              // console.log(leaveDetails);
              for (let j = 0; j < staffLeaveData.leaveDetails.length; j += 1) {
                const staffLeaveType = staffLeaveData.leaveDetails[j];
                const matchLeaveType = leaveDetails.filter(
                  (lll) =>
                    lll.leaveTypeId === staffLeaveType.leaveTypeId.toString(),
                )[0];

                if (matchLeaveType) {
                  const diff =
                    matchLeaveType.total - staffLeaveData.leaveDetails[j].total;

                  staffLeaveData.leaveDetails[j].total += diff;
                  staffLeaveData.leaveDetails[j].quota += diff;
                  staffLeaveData.leaveDetails[j].planQuota += diff;
                  staffLeaveData.leaveDetails[j].planDymanicQuota += diff;
                }
              }
              await staffLeaveData.save();
            }
          }
        };

        for (let i = 0; i < userLength; i += 1) {
          promiseData.push(deleteLeaveTypeListCall(userArr[i], i));
        }

        await Promise.all(promiseData);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async delete(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'leaveGroupId',
      ]);

      if (requiredResult.status === false) {
        return res.status(400).json({
          message: `Fields missing ${requiredResult.missingFields.toString()}`,
          success: false,
        });
      }

      const obj = req.body;

      obj.updatedBy = req.user._id;
      const insertLeaveType = await LeaveGroup.findOneAndUpdate(
        {
          _id: obj.leaveGroupId,
          isActive: true,
          companyId: req.user.companyId,
        },
        {
          $set: {
            isActive: false,
            updatedBy: obj.updatedBy,
          },
        },
      );

      if (insertLeaveType) {
        this.insertLog(res, insertLeaveType, 'Leave Group Deleted', null);
        return res
          .status(200)
          .json({ message: 'leave group successfully deleted', success: true });
      }

      return res
        .status(200)
        .json({ message: 'leave group not found', success: false });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  async get(req, res) {
    try {
      const compnayId = req.user.companyId;
      const insertGroupType = await LeaveGroup.find({
        companyId: compnayId,
        isActive: true,
        adminId: req.user._id,
      }).populate([
        {
          path: 'leaveType.leaveTypeId',
        },
        {
          path: 'createdBy',
          select: 'name staffId',
        },
        {
          path: 'updatedBy',
          select: 'name staffId',
        },
        {
          path: 'adminId',
          select: 'name staffId',
        },
      ]);

      if (insertGroupType.length !== 0) {
        return res.status(200).json({
          message: 'leave group is present',
          success: true,
          data: insertGroupType,
        });
      }

      return res
        .status(200)
        .json({ message: 'leave group not present', success: false });
    } catch (err) {
      __.log(err);
      return res
        .status(500)
        .json({ message: 'something went wrong', success: false });
    }
  }

  async insertLog(res, newData, reason, oldData = null) {
    try {
      const obj = {
        companyId: newData.companyId,
        leaveGroupId: newData._id,
        change: {
          newData,
          oldData,
        },
        updatedBy: newData.updatedBy,
        reason,
      };

      new LeaveGroupLog(obj).save();
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async adminListForBu(req, res) {
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
      // return res.json({status: true, data: plabBuArr});
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
}
const leaveGroupController = new LeaveGroupController();

// leaveGroupController.updateUser();
module.exports = leaveGroupController;
