// Controller Code Starts here
const mongoose = require('mongoose');
const bcrypt = require('bcrypt-nodejs');
const moment = require('moment');
const User = require('../../models/user');
const ResetPasswordLog = require('../../models/resetPasswordLog');
const __ = require('../../../helpers/globalFunctions');

class ResetPassword {
  async getResetPassword(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        staffId: req.params.staffId,
        companyId: req.user.companyId,
      };
      const userData = await User.findOne(where)
        .populate({
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
        })
        .select('staffId name parentBussinessUnitId status')
        .lean();

      if (!userData) {
        return __.out(
          res,
          300,
          'Staff does not exists. Please check the staff ID you are entering is correct or not.',
        );
      }

      if (userData.status === 2) {
        return __.out(
          res,
          300,
          'This Staff is inactive. Please do not try to reset password for this staff.',
        );
      }

      if (!(userData.status === 1)) {
        return __.out(
          res,
          300,
          'This Staff ID is locked, please unlock it first & then reset the password',
        );
      }

      // current user list....
      const data = await User.findOne({
        _id: req.user._id,
        planBussinessUnitId: userData.parentBussinessUnitId,
      }).lean();

      if (!data) {
        return __.out(res, 300, 'StaffId Not Match Plan BusinessUnit');
      }

      return __.out(res, 201, userData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async UpdatePassword(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const userData = await User.findOne({
        staffId: req.body.staffId,
        status: 1,
        companyId: req.user.companyId,
      });

      if (userData === null) {
        __.out(res, 300, 'Invalid staffId');
      } else {
        // Validate Password
        const passwordValidation = await __.pwdValidation(
          userData,
          req.body.password,
        );

        if (passwordValidation.status === false) {
          return __.out(res, 300, passwordValidation.message);
        }

        const { generateHash } = new User();
        const hashVal = generateHash(req.body.password);

        // Password Reuse Condition
        if (
          passwordValidation.pwdSettings != null &&
          userData.pwdManage &&
          userData.pwdManage.pwdList.length > 0
        ) {
          const reUseCount = passwordValidation.pwdSettings.pwdReUse;
          let { pwdList } = userData.pwdManage;

          // Last Mentions Passwords
          pwdList = pwdList.reverse().slice(0, reUseCount);
          const pwdExists = pwdList.some((v) =>
            bcrypt.compareSync(req.body.password, v.password),
          );

          if (pwdExists) {
            return __.out(
              res,
              300,
              `Couldn't use the last ${reUseCount} passwords`,
            );
          }
        }

        // Set Password
        userData.password = hashVal;
        // Track password
        if (!userData.pwdManage) {
          userData.pwdManage = {
            pwdUpdatedAt: moment().utc().format(),
            pwdList: [
              {
                password: hashVal,
                createdAt: moment().utc().format(),
              },
            ],
          };
        } else {
          userData.pwdManage.pwdUpdatedAt = moment().utc().format();
          userData.pwdManage.pwdList = [
            ...userData.pwdManage.pwdList,
            ...[
              {
                password: hashVal,
                createdAt: moment().utc().format(),
              },
            ],
          ];
        }

        const resetPass = {
          staffId: userData._id,
          resetDate: Date.now(),
          resetUserId: req.user._id,
        };

        await ResetPasswordLog(resetPass).save();

        // Logout all devices
        userData.tokenList = [];
        await userData.save();
        return __.out(res, 201, `Password updated successfully`);
      }

      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getResetPasswordLog(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;

      if (!!req.query.search && req.query.search.value) {
        const serachQuery = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };
        const where = {};

        where.$or = [
          {
            'staffId.name': serachQuery,
          },
          {
            'staffId.staffId': serachQuery,
          },
        ];
        const sort = { updatedAt: -1 };

        const pipeline = [
          {
            $match: { resetUserId: mongoose.Types.ObjectId(req.user._id) },
          },

          {
            $sort: sort,
          },
          {
            $lookup: {
              from: 'users',
              localField: 'staffId',
              foreignField: '_id',
              as: 'staffId',
            },
          },
          {
            $unwind: '$staffId',
          },
          { $match: where },
          {
            $facet: {
              totalCount: [
                {
                  $count: 'total',
                },
              ],
              data: [
                {
                  $skip: skip,
                },
                {
                  $limit: limit,
                },
                {
                  $lookup: {
                    from: 'users',
                    localField: 'resetUserId',
                    foreignField: '_id',
                    as: 'resetUserId',
                  },
                },
                {
                  $unwind: '$resetUserId',
                },
                {
                  $project: {
                    'staffId.name': 1,
                    'staffId.staffId': 1,
                    createdAt: 1,
                    'resetUserId.staffId': 1,
                    'resetUserId.name': 1,
                  },
                },
              ],
            },
          },
        ];

        const [result1, recordsTotal] = await Promise.all([
          ResetPasswordLog.aggregate(pipeline),
          ResetPasswordLog.countDocuments({
            resetUserId: req.user._id,
          }),
        ]);
        const totalCount = result1[0].totalCount[0]
          ? result1[0].totalCount[0].total
          : 0;
        const { data } = result1[0];

        const result = {
          draw: req.query.draw || 0,
          recordsTotal,
          recordsFiltered: totalCount,
          data,
        };

        return res.status(201).json(result);
      }

      const sort = { updatedAt: -1 };

      const pipeline = [
        {
          $match: { resetUserId: mongoose.Types.ObjectId(req.user._id) },
        },
        {
          $sort: sort,
        },
        {
          $facet: {
            totalCount: [
              {
                $count: 'total',
              },
            ],
            data: [
              {
                $skip: skip,
              },
              {
                $limit: limit,
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'staffId',
                  foreignField: '_id',
                  as: 'staffId',
                },
              },
              {
                $unwind: '$staffId',
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'resetUserId',
                  foreignField: '_id',
                  as: 'resetUserId',
                },
              },
              {
                $unwind: '$resetUserId',
              },
              {
                $project: {
                  'staffId.name': 1,
                  'staffId.staffId': 1,
                  createdAt: 1,
                  'resetUserId.staffId': 1,
                  'resetUserId.name': 1,
                },
              },
            ],
          },
        },
      ];

      const result1 = await ResetPasswordLog.aggregate(pipeline).allowDiskUse(
        true,
      );
      const totalCount = result1[0].totalCount[0]
        ? result1[0].totalCount[0].total
        : 0;
      const { data } = result1[0];

      const result = {
        draw: req.query.draw || 0,
        recordsTotal: totalCount,
        recordsFiltered: totalCount,
        data,
      };

      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }
}
const resetPassword = new ResetPassword();

module.exports = resetPassword;
