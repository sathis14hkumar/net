const mongoose = require('mongoose');
const User = require('../app/models/user');
const { logError, logInfo } = require('./logger.helper');

class AssignUserReadClass {
  // return array of _id of users inside users if project is missing
  async read(userDetails, project = null, createdBy = null) {
    try {
      logInfo('AssignUserRead:: read');
      if (userDetails.length === 0) {
        return { status: false, message: 'user details are empty', users: [] };
      }

      const userProject = project || { _id: 1 };
      const callGetUserDetails = [];

      userDetails.forEach((detail) => {
        callGetUserDetails.push(
          this.getUserDetails(detail, userProject, createdBy),
        );
      });
      const userInfo = await Promise.all(callGetUserDetails);

      if (project) {
        return { users: userInfo.flat(), status: true };
      }

      const users = userInfo.flat().map((user) => user._id);

      return { users, status: true };
    } catch (err) {
      logError('AssignUserRead:: read', err.stack);
      return { status: false, message: err.message, users: [] };
    }
  }

  async getUserDetails(detail, project = { _id: 1 }, createdBy = null) {
    try {
      logInfo('AssignUserRead:: getUserDetails');
      if (!detail.businessUnits) {
        return [];
      }

      let buList = detail.businessUnits;

      if (detail.allBuToken) {
        if (detail.allBuTokenStaffId) {
          const userPlanBu = await User.findOne(
            { staffId: detail.allBuTokenStaffId },
            { planBussinessUnitId: 1, _id: 0 },
          ).lean();

          buList = userPlanBu?.planBussinessUnitId;
        } else if (createdBy) {
          const userPlanBu = await User.findOne(
            { _id: createdBy },
            { planBussinessUnitId: 1, _id: 0 },
          ).lean();

          buList = userPlanBu?.planBussinessUnitId;
        }
      }

      let searchQuery = {
        parentBussinessUnitId: { $in: buList },
        $or: [],
      };

      if (detail.buFilterType === 1) {
        searchQuery = {
          parentBussinessUnitId: { $in: buList },
          status: 1,
        };
      } else {
        const condition = detail.buFilterType === 2 ? '$in' : '$nin';

        if (detail.appointments.length > 0) {
          const appointmentId = {
            [condition]: detail.appointments,
          };

          searchQuery.$or.push({
            appointmentId,
            status: 1,
          });
        }

        if (detail.subSkillSets.length > 0) {
          const subSkillSets = { [condition]: detail.subSkillSets };

          searchQuery.$or.push({
            subSkillSets,
            status: 1,
          });
        }

        detail.authors = detail.authors || [];
        if (detail.authors.length > 0) {
          const authors = { [condition]: detail.authors };

          searchQuery.$or.push({
            _id: authors,
            status: 1,
          });
        }

        detail.user = detail.user || [];
        if (detail.user.length > 0) {
          const users = { [condition]: detail.user };

          searchQuery.$or.push({
            _id: users,
            status: 1,
          });
        }

        detail.admin = detail.admin || [];
        if (detail.admin.length > 0) {
          const admin = { $in: detail.admin };

          searchQuery.$or.push({
            _id: admin,
            status: 1,
          });
        }

        if (detail.customField.length > 0) {
          for (const singleCustom of detail.customField) {
            searchQuery.$or.push({
              otherFields: {
                $elemMatch: {
                  fieldId: singleCustom.fieldId,
                  value: {
                    [condition]: [singleCustom.value],
                  },
                },
              },
              status: 1,
            });
          }
        }
      }

      const users = await User.find(searchQuery, project).lean();

      return users;
    } catch (e) {
      logError('AssignUserRead: getUserDetails', e.stack);
      return [];
    }
  }

  async getUserInAssignedUser(userData, Model, from = 'other') {
    try {
      logInfo('AssignUserRead:: getUserInAssignedUser');
      const match = {
        status: 1,
        companyId: userData.companyId,
      };

      if (from !== 'other' && from !== 'channel') {
        match.challengeId = mongoose.Types.ObjectId(from);
      }

      const customFields = userData.otherFields || [];
      const subSkillSets = userData.subSkillSets || [];
      const customFieldsArr = [];

      for (const singleCustom of customFields) {
        const value = singleCustom.value || null;
        const { fieldId } = singleCustom;

        customFieldsArr.push({
          fieldId: mongoose.Types.ObjectId(fieldId),
          value,
        });
      }
      // AllbuToken
      const searchQuery = {
        $or: [
          {
            'userDetails.admin': { $in: [userData._id] },
          },
          {
            'userDetails.businessUnits': {
              $in: [userData.parentBussinessUnitId],
            },
            'userDetails.buFilterType': 1,
          },
          {
            'userDetails.businessUnits': {
              $in: [userData.parentBussinessUnitId],
            },
            'userDetails.buFilterType': 2,
            $or: [
              from === 'channel'
                ? { 'userDetails.authors': userData._id }
                : { 'userDetails.user': userData._id },
              {
                'userDetails.appointments': {
                  $in: [userData.appointmentId],
                },
              },
              {
                'userDetails.subSkillSets': {
                  $in: subSkillSets,
                },
              },
              {
                'userDetails.customField': {
                  $elemMatch: {
                    $or: customFieldsArr.map((v) => ({
                      fieldId: v.fieldId,
                      value: v.value,
                    })),
                  },
                },
              },
            ],
          },
          {
            'userDetails.businessUnits': userData.parentBussinessUnitId,
            'userDetails.buFilterType': 3,
            $and: [
              from === 'channel'
                ? { 'userDetails.authors': { $nin: [userData._id] } }
                : { 'userDetails.user': { $nin: [userData._id] } },
              {
                'userDetails.appointments': {
                  $nin: [userData.appointmentId],
                },
              },
              {
                'userDetails.subSkillSets': {
                  $nin: subSkillSets,
                },
              },
              {
                'userDetails.customField': {
                  $elemMatch: {
                    $and: customFieldsArr.map((v) => ({
                      fieldId: { $ne: v.fieldId },
                      value: { $ne: v.value },
                    })),
                  },
                },
              },
            ],
          },
        ],
      };
      const result = await Model.aggregate([
        {
          $match: match,
        },
        {
          $addFields: {
            userDetails: {
              $cond: {
                if: { $ifNull: ['$userDetails', false] },
                then: '$userDetails',
                else: '$assignUsers',
              },
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdBy',
            pipeline: [
              {
                $project: {
                  planBussinessUnitId: 1,
                },
              },
            ],
          },
        },
        { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
        { $unwind: '$userDetails' },
        {
          $addFields: {
            'userDetails.businessUnits': {
              $cond: [
                { $eq: ['$userDetails.allBuToken', true] },
                '$createdBy.planBussinessUnitId',
                '$userDetails.businessUnits',
              ],
            },
          },
        },
        {
          $group: {
            _id: '$_id',
            userDetails: { $push: '$userDetails' },
          },
        },
        { $match: searchQuery },
        { $project: { userDetails: 0 } },
      ]);

      return result.map((re) => re._id);
    } catch (error) {
      logError('AssignUserRead:: getUserInAssignedUser', error.stack);
      return [];
    }
  }
}
const AssignUserRead = new AssignUserReadClass();

module.exports = { AssignUserRead };
