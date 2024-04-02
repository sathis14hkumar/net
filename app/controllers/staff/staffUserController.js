// Controller Code Starts here
const mongoose = require('mongoose');
const User = require('../../models/user');
const UserField = require('../../models/userField');
const PageSettingModel = require('../../models/pageSetting');
const __ = require('../../../helpers/globalFunctions');

/* Email Credentials */

class StaffUserController {
  async read(req, res) {
    try {
      const where = {
        _id: req.user._id,
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      const users = await User.findOne(where)
        .select('-password -pwdManage')
        .populate([
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
            path: 'appointmentId',
            select: 'name status',
          },
          {
            path: 'role',
            select: 'name description isFlexiStaff privileges',
            populate: {
              path: 'privileges',
              select: 'name description flags privilegeCategoryId',
              populate: {
                path: 'privilegeCategoryId',
                select: 'name',
              },
            },
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
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          },
          {
            path: 'planBussinessUnitId',
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
          {
            path: 'viewBussinessUnitId',
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
        ])
        .lean();

      const privilegeFlags = await __.getUserPrivilegeObject(
        users.role.privileges,
      );

      users.userId = users._id;
      users.privilegeFlags = privilegeFlags;
      delete users.role.privileges;

      // Custom Fields Setup
      const userFields = await UserField.find({
        companyId: req.user.companyId,
        status: 1,
      })
        .sort({
          indexNum: 1,
        })
        .lean();

      const userFieldsUpdate = (otherFields) => {
        otherFields = otherFields || [];
        return userFields.reduce((prev, curr) => {
          curr.value = curr.value || '';
          const field = otherFields.find((o) =>
            __.isEqualObjectIds(o.fieldId, curr._id),
          );

          if (field) {
            curr.value = field.value || '';
          }

          return prev.concat(curr);
        }, []);
      };

      users.otherFields = userFieldsUpdate(users.otherFields);

      // password management
      const pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select('pwdSettings')
        .lean();

      users.pwdSettings = pageSettingData;

      __.out(res, 201, {
        data: users,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async getStaffs(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };
      let planBu = await User.findOne(
        { _id: req.user._id },
        { _id: 0, planBussinessUnitId: 1 },
      );

      planBu = planBu.planBussinessUnitId;
      req.body.parentBussinessUnitId = planBu;
      if (
        Array.isArray(req.body.parentBussinessUnitId) &&
        'parentBussinessUnitId' in req.body
      ) {
        if (req.body.parentBussinessUnitId.indexOf('all') === -1) {
          query = {
            parentBussinessUnitId: {
              $in: req.body.parentBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          };
        } else {
          query = {
            parentBussinessUnitId: {
              $in: req.user.planBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          };
        }
      } else {
        return __.out(res, 201, { items: [], count_filtered: 0 });
      }

      if (req.body.q !== undefined && req.body.q.trim()) {
        query = {
          $text: { $search: `"${req.body.q.toString()}"` },
        };
      }

      query.status = {
        $nin: [2],
      };

      const users = await User.aggregate([
        {
          $match: query,
        },
        {
          $lookup: {
            from: 'schemes',
            localField: 'schemeId',
            foreignField: '_id',
            as: 'schemeInfo',
          },
        },
        {
          $unwind: '$schemeInfo',
        },
        {
          $match: {
            'schemeInfo.shiftSchemeType': { $in: [2, 3] },
          },
        },
        {
          $project: {
            schemeId: 1,
            'schemeInfo.shiftSchemeType': 1,
            name: 1,
            _id: 1,
            parentBussinessUnitId: 1,
            staffId: 1,
          },
        },
      ]).allowDiskUse(true);

      if (!users) {
        return res.status(200).json({ code: 1, data: [] });
      }

      return res.status(200).json({ code: 1, data: users });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'email',
        'contactNumber',
      ]);

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const doc = await User.findOne({
          _id: req.user._id,
        });
        const existingUser = JSON.parse(JSON.stringify(doc));

        if (doc === null) {
          __.out(res, 300, 'Invalid userId');
        } else {
          // Object.assign(doc, {
          //   email: req.body.email,
          //   contactNumber: req.body.contactNumber,
          // });
          doc.set(req.body);
          if (req.body.password) {
            doc.password = doc.generateHash(req.body.password);
            // Logout all devices
            doc.tokenList = [];
          }

          if (req.file) doc.profilePicture = req.file.path.substring(6);

          // Custom fields
          let otherFields;

          if (req.body.otherFields) {
            if (typeof req.body.otherFields === 'string') {
              req.body.otherFields = JSON.parse(req.body.otherFields);
            }

            // Update Only Accessible Custom Fields
            const companyFields = await UserField.find({
              companyId: req.user.companyId,
              status: {
                $ne: 3,
              },
            })
              .select('editable')
              .lean();

            otherFields = req.body.otherFields
              .map((v) => {
                const i = companyFields.findIndex(
                  (x) => x._id.toString() === v.fieldId,
                );

                // unknown fields
                if (i === -1) {
                  return false;
                }

                return v;
              })
              .filter(Boolean);

            doc.otherFields = otherFields;
          }

          doc.leaveGroupId = null;

          if (existingUser.leaveGroupId) {
            doc.leaveGroupId = existingUser.leaveGroupId;
          }

          const result = await doc.save();

          if (result === null) {
            __.out(res, 300, 'Something went wrong');
          } else {
            this.read(req, res);
          }
        }
      }

      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
const user = new StaffUserController();

module.exports = user;
