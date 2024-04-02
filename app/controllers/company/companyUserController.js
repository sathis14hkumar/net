// Controller Code Starts here
const bcrypt = require('bcrypt-nodejs');
const fs = require('fs').promises;
const json2csv = require('json2csv').parse;
const moment = require('moment');
const _ = require('lodash');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const { validationResult } = require('express-validator');
const User = require('../../models/user');
const Roles = require('../../models/role');
const UserLog = require('../../models/userLog');
const SubSection = require('../../models/subSection');
const Appointment = require('../../models/appointment');
const SkillSet = require('../../models/skillSet');
const PrivilegeCategory = require('../../models/privilegeCategory');
const notification = require('./notificationController');
const Company = require('../../models/company');
const Pagesettings = require('../../models/pageSetting');
const Role = require('../../models/role');
const UserField = require('../../models/userField');
const OpsGroup = require('../../models/ops');
const OtherNotification = require('../../models/otherNotifications');
const __ = require('../../../helpers/globalFunctions');
const mailer = require('../../../helpers/mailFunctions');
const FCM = require('../../../helpers/fcm');
const LeaveGroup = require('../../models/leaveGroup');
const StaffLeave = require('../../models/staffLeave');
const Scheme = require('../../models/scheme');
const { logInfo, logError } = require('../../../helpers/logger.helper');

/* Email Credentials */

class CompanyUserController {
  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let requiredResult;

      if (req.body.skillSetTierType !== 1) {
        requiredResult = await __.checkRequiredFields(
          req,
          [
            'isFlexiStaff',
            'name',
            'staffId',
            'appointmentId',
            'role',
            'staffPassExpiryDate',
            'status',
            'email',
          ],
          'user',
        );
      } else {
        requiredResult = await __.checkRequiredFields(
          req,
          [
            'isFlexiStaff',
            'name',
            'staffId',
            'appointmentId',
            'role',
            'staffPassExpiryDate',
            'status',
            'email',
          ],
          'user',
        );
      }

      if (!__.checkSpecialCharacters(req.body)) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      // 'parentBussinessUnitId','planBussinessUnitId', 'viewBussinessUnitId'
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      /* check staff ID already exists or not */
      const doc = await User.findOne({
        staffId: req.body.staffId.toLowerCase(),
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        /* staffId not exists */
        let generatedPassword = await __.makePwd(8);
        const pagesettings = await Pagesettings.findOne({
          companyId: req.user.companyId,
        }).lean();
        const { generateHash } = new User();

        if (pagesettings.pwdSettings && pagesettings.pwdSettings.status === 1) {
          if (pagesettings.pwdSettings.passwordType === 2) {
            generatedPassword = pagesettings.pwdSettings.defaultPassword;
            req.body.password = generateHash(generatedPassword);
          } else {
            req.body.password = generateHash(generatedPassword);
          }
        }

        const insert = req.body;

        insert.staffId = req.body.staffId.toLowerCase();
        insert.companyId = req.user.companyId;
        if (req.body.countryCode) {
          insert.countryCode = req.body.countryCode;
        }

        if (req.file) {
          insert.profilePicture = req.file.path.substring(6);
        }

        // Restrict All Bu access edit
        const userAdmin = await this.isAdmin(req.user, res);

        if (!userAdmin) {
          delete req.body.allBUAccess;
        }

        // create new model
        const post = new User(insert);

        post.password = post.generateHash(generatedPassword);
        // save model to MongoDB
        const insertedUser = await post.save();

        req.body.userId = insertedUser._id;
        // add to staffLeave
        req.body.doj = new Date();
        if (req.body.leaveGroupId) {
          await this.createStaffLeave(req.body, req);
        }

        const data = {
          userId: req.body.userId,
          userData: post,
        };

        await notification.addUserToDynamicNotifications(data, res);
        /* sending mail */
        // Get Company Data
        const companyData = await Company.findOne({
          _id: req.user.companyId,
        }).lean();
        const mailDoc = {
          email: req.body.email,
          userName: req.body.name,
          staffId: req.body.staffId,
          password: generatedPassword,
          companyData,
        };

        await mailer.newCompanyUser(mailDoc);

        if (req.file) {
          __.scanFile(
            req.file.filename,
            `public/uploads/profilePictures/${req.file.filename}`,
          );
        }

        return this.read(
          req,
          res,
        ); /* calling read fn with userId(last insert id). it calls findOne fn in read */
      }

      /* StaffId already exists */
      return __.out(res, 300, 'StaffId already exists');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async createStaffLeave(data, req) {
    const leaveGroupData = await LeaveGroup.findOne({
      _id: data.leaveGroupId,
    }).populate([
      {
        path: 'leaveType.leaveTypeId',
        match: { isActive: true },
      },
    ]);

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
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const prevYear = currentYear - 1;
    const yearArr = [prevYear, currentYear, nextYear];

    const leaveDetails = [];

    for (let i = 0; i < 3; i += 1) {
      const yearValue = yearArr[i];
      let month = 0;
      let year = 0;

      if (data.doj) {
        month = monthDiff(
          new Date(data.doj),
          new Date(new Date().setFullYear(yearValue)),
        );
        year = diffYears(
          new Date(data.doj),
          new Date(new Date().setFullYear(yearValue)),
        );
      }

      leaveGroupData.leaveType.forEach((leave) => {
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
            leaveTypeId: leave.leaveTypeId._id,
            quota,
            planQuota: quota,
            planDymanicQuota: quota,
            total: quota,
            year: yearValue,
          };

          leaveDetails.push(leaveObj);
        }
      });
    }

    const obj = {
      userId: data._id,
      plannedBy: req.user._id,
      leaveGroupId: data.leaveGroupId,
      businessUnitId: data.parentBussinessUnitId,
      companyId: req.user.companyId,
      leaveDetails,
    };

    const insertedStaffLeave = new StaffLeave(obj);

    await insertedStaffLeave.save();
  }

  async updateStaffLeave(data, req) {
    const leaveGroupData = await LeaveGroup.findOne({
      _id: data.leaveGroupId,
    }).populate([
      {
        path: 'leaveType.leaveTypeId',
        match: { isActive: true },
      },
    ]);

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
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const prevYear = currentYear - 1;
    const yearArr = [prevYear, currentYear, nextYear];

    const leaveDetails = [];

    for (let i = 0; i < yearArr.length; i += 1) {
      const yearValue = yearArr[i];
      let month = 0;
      let year = 0;

      if (data.doj) {
        month = monthDiff(
          new Date(data.doj),
          new Date(new Date().setFullYear(yearValue)),
        );
        year = diffYears(
          new Date(data.doj),
          new Date(new Date().setFullYear(yearValue)),
        );
      }

      leaveGroupData.leaveType.forEach((leave) => {
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
            leaveTypeId: leave.leaveTypeId._id,
            quota,
            planQuota: quota,
            planDymanicQuota: quota,
            total: quota,
            year: yearValue,
          };

          leaveDetails.push(leaveObj);
        }
      });
    }
    const staffLeaveData = await StaffLeave.findOne({ userId: data._id });

    if (staffLeaveData) {
      for (let i = 0; i < leaveDetails.length; i += 1) {
        const leaveType = leaveDetails[i];
        const staffLeaveType = staffLeaveData.leaveDetails.filter(
          (lt) =>
            lt.leaveTypeId.toString() === leaveType.leaveTypeId.toString() &&
            lt.year === leaveType.year,
        );

        if (staffLeaveType && staffLeaveType.length > 0) {
          const [firstStaffLeaveType] = staffLeaveType;

          const totalLeaveIncrease =
            leaveType.total - firstStaffLeaveType.total;
          const quotaIncrease = firstStaffLeaveType.quota + totalLeaveIncrease;
          const planIncrease =
            firstStaffLeaveType.planQuota + totalLeaveIncrease;

          leaveDetails[i].quota = quotaIncrease > 0 ? quotaIncrease : 0;
          leaveDetails[i].planQuota = planIncrease > 0 ? planIncrease : 0;
        }
      }
      const obj = {
        userId: data._id,
        updatedBy: req.user._id,
        leaveGroupId: data.leaveGroupId,
        businessUnitId: data.parentBussinessUnitId,
        companyId: req.user.companyId,
        leaveDetails,
      };

      await StaffLeave.findOneAndUpdate(
        { userId: obj.userId },
        {
          $set: {
            leaveDetails: obj.leaveDetails,
            updatedBy: obj.updatedBy,
            leaveGroupId: obj.leaveGroupId,
            isActive: true,
          },
        },
      );
    } else {
      this.createStaffLeave(data, req);
    }
  }

  /* User list for system admin to edit users */
  async editList(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      let sort = {};
      const getSort = (val) => (val === 'asc' ? 1 : -1);

      if (req.query.order) {
        const sortData = [`name`, `staffId`, `appointmentId.name`];
        const orderData = req.query.order;

        sort = orderData.reduce((prev, curr) => {
          const key = sortData[curr.column];

          prev[key] = getSort(curr.dir);
          return prev;
        }, sort);
      }

      let buarray = req.user.planBussinessUnitId || [];

      if (req.query.onlyViewBU) {
        buarray = req.user.viewBussinessUnitId || [];
      }

      const where = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        status: {
          $ne: 3 /* $ne => not equal */,
        },
        parentBussinessUnitId: {
          $in: buarray.map((v) => mongoose.Types.ObjectId(v)),
          $exists: true,
        },
        appointmentId: {
          $exists: true,
        },
      };
      const query = [
        {
          path: 'appointmentId',
          select: 'name',
        },
        {
          path: 'parentBussinessUnitId',
          select: 'name _id orgName',
          match: {
            status: 1,
            sectionId: {
              $exists: true,
            },
          },
        },
      ];
      const recordsTotal = await User.find(where).populate(query).count();
      let recordsFiltered = recordsTotal;

      if (!!req.query.search && req.query.search.value) {
        const searchQuery = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };

        where.$or = [{ name: searchQuery }, { staffId: searchQuery }];
        recordsFiltered = await User.find(where).populate(query).count();
      }

      let data = await User.find(where)
        .populate(query)
        .select('appointmentId parentBussinessUnitId staffId name')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      data = data.map((v) => {
        const bu = v.parentBussinessUnitId?.orgName;
        const obj = {
          _id: v._id,
          name: v.name,
          staffId: v.staffId,
          appointment: { name: v.appointmentId?.name },
          businessUnit: bu,
          contactNumber: v.contactNumber,
          doj: v.doj,
        };

        return obj;
      });

      const result = {
        draw: req.query.draw || 0,
        recordsTotal,
        recordsFiltered,
        data,
      };

      return res.status(201).json(result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Somethign went werong');
    }
  }

  async readUserByBU(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const page = req.body.page ? parseInt(req.body.page, 10) * 10 : 0;
      let query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };

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

      if (req.body.q !== undefined) {
        query.name = {
          $regex: req.body.q.toString(),
          $options: 'ixs',
        };
      }

      if (req.body.search !== undefined) {
        query.$or = [
          {
            name: {
              $regex: req.body.search.toString(),
              $options: 'ixs',
            },
          },
          {
            staffId: {
              $regex: req.body.search.toString(),
              $options: 'ixs',
            },
          },
        ];
      }

      query.status = {
        $nin: [2],
      };
      const users = await User.aggregate([
        {
          $match: query,
        },
        { $skip: page },
        { $limit: 10 },
        { $project: { name: 1, _id: 1, parentBussinessUnitId: 1, staffId: 1 } },
      ]).allowDiskUse(true);

      users.forEach((userData) => {
        userData.name = `${userData.name} (${userData.staffId})`;
      });
      const countFiltered = await User.find(query).count();

      if (!users) {
        return __.out(res, 300, 'No users Found');
      }

      return __.out(res, 201, { items: users, countFiltered });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }

  async readUserByPlanBU(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const page = req.body.page ? parseInt(req.body.page, 10) * 10 : 0;
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
        { $skip: page },
        { $limit: 10 },
        { $project: { name: 1, _id: 1, parentBussinessUnitId: 1, staffId: 1 } },
      ]).allowDiskUse(true);

      const countFiltered = await User.find(query).count();

      if (!users) {
        return __.out(res, 300, 'No users Found');
      }

      return __.out(res, 201, { items: users, countFiltered });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }

  async readUserByPlanBUForAssignShift(req, res) {
    try {
      logInfo(`companyUser/readUserByPlanBU/assignShift API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `companyUser/readUserByPlanBU/assignShift entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const page = req.body.page ? (parseInt(req.body.page, 10) - 1) * 10 : 0;
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
        logInfo(`companyUser/readUserByPlanBU/assignShift API ends here!`, {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return __.out(res, 201, { items: [], count_filtered: 0 });
      }

      if (req.body.q !== undefined && req.body.q.trim()) {
        query = {
          $or: [
            {
              name: {
                $regex: req.body.q.toString(),
                $options: 'i',
              },
            },
            {
              staffId: {
                $regex: req.body.q.toString(),
                $options: 'i',
              },
            },
          ],
          status: 1,
        };
      }

      query.status = 1;
      const limit = 1;
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
        { $skip: page },
        { $limit: 10 },
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

      let countFiltered = await User.aggregate([
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
            _id: 1,
            name: 1,
            parentBussinessUnitId: 1,
            staffId: 1,
          },
        },
        {
          $facet: {
            users: [{ $limit: +limit }],
            totalCount: [
              {
                $count: 'count',
              },
            ],
          },
        },
      ]);

      if (!users) {
        logInfo(
          `companyUser/readUserByPlanBU/assignShift API, 'No users Found' ends here!`,
          { name: req.user.name, staffId: req.user.staffId },
        );
        return __.out(res, 300, 'No users Found');
      }

      if (countFiltered[0].users.length > 0) {
        countFiltered = countFiltered[0].totalCount[0].count;
      } else {
        countFiltered = 0;
      }

      logInfo(`companyUser/readUserByPlanBU/assignShift API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, { items: users, countFiltered });
    } catch (error) {
      logError(
        `companyUser/readUserByPlanBU/assignShift API, there is an error`,
        error.toString(),
      );
      return __.out(res, 300, error);
    }
  }

  async read(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        companyId: req.user.companyId,
        status: {
          $nin: [2, 3], // $nin => not in array
        },
      };

      if (req.body.status) where.status = req.body.status;

      const populateArray = [
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
          path: 'schemeId',
          select: 'schemeName status',
          match: {
            status: 1,
          },
        },
        {
          path: 'parentBussinessUnitId',
          select: 'name orgName',
        },
        {
          path: 'planBussinessUnitId',
          select: 'name orgName',
          match: {
            status: 1,
          },
        },
        {
          path: 'viewBussinessUnitId',
          select: 'name orgName',
          match: {
            status: 1,
          },
        },
      ];
      let users = null;

      if (req.body.userId) {
        where._id = req.body.userId;
        where.status = { $ne: 3 };
        users = await User.findOne(where)
          .select('-password -pwdManage -tokenList')
          .populate([
            ...populateArray,
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
              path: 'schemeId',
              select: 'schemeName',
              match: {
                status: 1,
              },
            },
            {
              path: 'leaveGroupId',
              select: 'name',
              match: {
                isActive: true,
              },
            },
          ])
          .lean();
      } else {
        populateArray.push(
          {
            path: 'role',
            select: 'name description isFlexiStaff privileges',
            populate: {
              path: 'privileges',
              select: 'name description privilegeCategoryId',
              populate: {
                path: 'privilegeCategoryId',
                select: 'name',
              },
            },
          },
          {
            path: 'schemeId',
            select: 'schemeName',
            match: {
              status: 1,
            },
          },
          {
            path: 'leaveGroupId',
            select: 'name',
            match: {
              isActive: true,
            },
          },
        );
        if (req.body.businessUnitId) {
          where.parentBussinessUnitId = mongoose.Types.ObjectId(
            req.body.businessUnitId,
          );
        }

        users = await User.find(where)
          .select('-password -pwdManage -tokenList')
          .populate(populateArray)
          .lean();
      }

      const sortBu = (user1) => {
        const plan = user1.planBussinessUnitId || [];

        user1.planBussinessUnitId = plan
          .map((elem) => {
            if (elem.sectionId) {
              if (elem.sectionId.departmentId) {
                if (elem.sectionId.departmentId.companyId) {
                  elem.fullName = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;
                }
              }
            }

            return elem;
          })
          .sort((a, b) =>
            a.fullName ? a.fullName.localeCompare(b.fullName) : '',
          );
        return user1;
      };

      if (Array.isArray(users)) {
        users = users.map(sortBu);
      } else {
        users = sortBu(users);
      }

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

      if (req.body.userId) {
        await User.find({
          parentBussinessUnitId: {
            $in: users.planBussinessUnitId
              ? users.planBussinessUnitId.map((b) => b._id)
              : [],
          },
        })
          .select('appointmentId')
          .populate([
            {
              path: 'appointmentId',
              select: 'name status',
            },
            {
              path: 'parentBussinessUnitId',
              select: 'status',
            },
          ])
          .lean();

        /* findone */
        const privilegeFlags = await __.getUserPrivilegeObject(
          users.role.privileges,
        );

        users.userId = users._id;
        users.privilegeFlags = privilegeFlags;
        delete users.role.privileges;
        users.otherFields = userFieldsUpdate(users.otherFields);
        if (req.body.planBussinessUnitId) {
          await __.updateAllBuToUser(users, true);
        }

        const opsGroup = await OpsGroup.findOne(
          { userId: { $in: [req.body.userId] }, isDelete: false },
          { opsGroupName: 1 },
        );

        if (opsGroup && Object.keys(opsGroup).length) {
          users.opsGroupName = opsGroup.opsGroupName;
        } else users.opsGroupName = '-';

        return __.out(res, 201, { data: users });
      }

      /* find */
      users = users.map((u) => {
        u.otherFields = userFieldsUpdate(u.otherFields);
        return u;
      });
      return __.out(res, 201, {
        data: users,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getOneUser(req, res) {
    try {
      let userId;

      if (req.query.userId) {
        userId = req.query.userId;
      } else {
        userId = req.user._id;
      }

      const user = await User.findOne(
        {
          _id: userId,
          status: {
            $in: [1, 2],
          },
        },
        {
          _id: 1,
          leaveGroupId: 1,
          name: 1,
          staffId: 1,
          rewardPoints: 1,
          email: 1,
          profilePicture: 1,
          appointmentId: 1,
          doj: 1,
          contactNumber: 1,
          countryCode: 1,
          primaryMobileNumber: 1,
          allBUAccess: 1,
          role: 1,
          parentBussinessUnitId: 1,
          planBussinessUnitId: 1,
          viewBussinessUnitId: 1,
          status: 1,
          otherFields: 1,
          subSkillSets: 1,
          mainSkillSets: 1,
          schemeId: 1,
        },
      );

      const userFields = await UserField.find({
        status: 1,
      }).lean();

      const getOtherFields = (otherFields) =>
        userFields.reduce((final, curr) => {
          curr.value = curr.value || '';
          const bool = otherFields.find(
            (field) => field.fieldId.toString() === curr._id.toString(),
          );

          if (bool) {
            curr.value = bool.value || '';
          }

          return final.concat(curr);
        }, []);
      const customFields = getOtherFields(
        user.otherFields.filter((oF) => !!oF.fieldId),
      );

      const opsData = await OpsGroup.findOne(
        { userId: { $in: [userId] }, isDelete: false },
        { opsGroupName: 1 },
      );

      const data = {
        name: user.name,
        staffId: user.staffId,
        rewardPoints: user.rewardPoints,
        email: user.email,
        profilePicture: user.profilePicture,
        contactNumber: user.contactNumber,
        countryCode: user.countryCode,
        primaryMobileNumber: user.primaryMobileNumber,
        allBUAccess: user.allBUAccess,
        status: user.status,
        _id: user._id,
        appointmentId: user.appointmentId,
        role: user.role,
        parentBussinessUnitId: user.parentBussinessUnitId,
        planBussinessUnitId: user.planBussinessUnitId,
        viewBussinessUnitId: user.viewBussinessUnitId,
        subSkillSets: user.subSkillSets,
        mainSkillSets: user.mainSkillSets,
        schemeId: user.schemeId,
        leaveGroupId: user.leaveGroupId,
        otherFields: customFields,
        opsGroupName:
          opsData && Object.keys(opsData).length ? opsData.opsGroupName : '-',
      };

      return res.success(data);
    } catch (error) {
      return res.error(error);
    }
  }

  async readSingle(req, res) {
    try {
      logInfo(`companyUser/read/single API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `companyUser/read/single API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      if (!req.body.userId) {
        return __.out(res, 400, 'Missing userId in the request body');
      }

      const where = {};
      const populateArray = [
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
          path: 'parentBussinessUnitId',
          select: 'name orgName',
        },
        {
          path: 'planBussinessUnitId',
          select: 'name orgName',
          match: {
            status: 1,
          },
        },
        {
          path: 'viewBussinessUnitId',
          select: 'name orgName',
          match: {
            status: 1,
          },
        },
      ];
      let users = null;

      if (req.body.userId) {
        where._id = req.body.userId;
        users = await User.findOne(where)
          .select(
            '-password -pwdManage -tokenList -otpSetup -deviceToken -loggedIn -companyId -staffPassExpiryDate',
          )
          .populate([
            ...populateArray,
            {
              path: 'role',
              select: 'name description',
            },
            {
              path: 'schemeId',
              select: 'schemeName',
              match: {
                status: 1,
              },
            },
          ])
          .lean();
      }

      const sortBu = (user) => {
        const plan = user.planBussinessUnitId || [];

        user.planBussinessUnitId = plan
          .map((elem) => {
            if (elem.sectionId) {
              if (elem.sectionId.departmentId) {
                if (elem.sectionId.departmentId.companyId) {
                  elem.fullName = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;
                }
              }
            }

            return elem;
          })
          .sort((a, b) =>
            a.fullName ? a.fullName.localeCompare(b.fullName) : '',
          );
        return user;
      };

      users = sortBu(users);
      logInfo(`companyUser/read/single API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, { data: users });
    } catch (err) {
      logError(
        `companyUser/read/single API, there is an error`,
        err.toString(),
      );
      return __.out(res, 500, err);
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`companyUser/update API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `companyUser/update API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(
        req,
        ['userId'],
        'userUpdate',
      );

      if (!__.checkSpecialCharacters(req.body, 'profile update')) {
        logError(
          `companyUser/update API, there is an error`,
          `You've entered some excluded special characters`,
        );
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      if (requiredResult.status === false) {
        logError(
          `companyUser/update API, Required fields missing `,
          requiredResult.missingFields,
        );
        logError(`companyUser/update API, request payload `, req.body);
        return __.out(res, 400, requiredResult.missingFields);
      }

      delete req.body.staffId;
      const doc = await User.findOne({
        _id: req.body.userId,
        status: { $ne: 3 },
      });

      if (doc === null) {
        logError(`companyUser/update API, there is an error`, 'Invalid userId');
        return __.out(res, 300, 'Invalid userId');
      }

      /* old data for comparison */
      const oldData = doc.toObject();

      // Reset Login Attempt if user back to active from inactive
      if (doc.status === 2 && req.body.status === 1) {
        doc.loginAttempt = 0;
      }

      if (oldData.role?.toString() !== req.body.role?.toString()) {
        req.body.roleUpdate = true;
      }

      // Restrict All Bu access edit
      const userAdmin = await this.isAdmin(req.user, res);

      if (!userAdmin) {
        delete req.body.allBUAccess;
      }

      // If it is web, update editable access
      let otherFields;

      if (req.body.otherFields) {
        if (typeof req.body.otherFields === 'string') {
          req.body.otherFields = JSON.parse(req.body.otherFields);
        }

        if (req.headers.platform === 'web') {
          otherFields = req.body.otherFields;
        } else {
          // Update Only Accessible Custom Fields
          const companyFields = await UserField.find({
            companyId: req.user.companyId,
            status: {
              $ne: 3,
            },
          })
            .select('editable')
            .lean();

          __.log(companyFields);
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
        }
      }

      if (req.body.countryCode) {
        doc.countryCode = req.body.countryCode;
      }

      doc.set(req.body);
      if (req.body.password) {
        req.body.password = req.body.password.trim();
        doc.password = doc.generateHash(req.body.password);
        // Logout all devices
        doc.tokenList = [];
        const userData = doc;
        const passwordValidation = await __.pwdValidation(
          userData,
          req.body.password,
        );

        if (passwordValidation.status === false) {
          return __.out(res, 300, passwordValidation.message);
        }

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
      }

      if (req.body.subSkillSets) doc.subSkillSets = req.body.subSkillSets;

      if (req.body.planBussinessUnitId)
        doc.planBussinessUnitId = req.body.planBussinessUnitId;

      if (req.body.viewBussinessUnitId)
        doc.viewBussinessUnitId = req.body.viewBussinessUnitId;

      if (req.body.otherFields) doc.otherFields = otherFields;

      if (req.file) doc.profilePicture = req.file.path.substring(6);

      // Make Expiry the Token, If user is deactivated
      if (doc.status === 2) {
        doc.loggedIn = Date.now();
      }

      if (req.body.schemeId) {
        doc.schemeId = req.body.schemeId;
      }

      if (
        req.body.leaveGroupId &&
        oldData?.leaveGroupId?.toString() !== req.body.leaveGroupId.toString()
      ) {
        if (oldData.leaveGroupId) {
          doc.leaveGroupId = req.body.leaveGroupId;
          await this.updateStaffLeave(doc, req);
          // update old one
        } else {
          // first time
          doc.leaveGroupId = req.body.leaveGroupId;
          await this.createStaffLeave(doc, req);
        }
      }

      if (req.body.from === 'updateUser' && !req.body.leaveGroupId) {
        doc.leaveGroupId = null;
        await StaffLeave.findOneAndRemove({
          userId: req.body.userId,
        });
      }

      const result = await doc.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      /* updated successfully */
      /* add user to dynamic notification if BU or sub skill set matched starts */
      if (req.body.schemeId) {
        if (
          oldData.schemeId &&
          oldData.schemeId.toString() !== req.body.schemeId.toString()
        ) {
          // scheme change
          const schemeLog = {
            updatedBy: req.user._id,
            oldSchemeId: oldData.schemeId,
            newSchemeId: req.body.schemeId,
            userId: req.body.userId,
            businessUnitId: oldData.parentBussinessUnitId,
            type: 1,
          };

          // new UserLog.save
          new UserLog(schemeLog).save();
        }
      }

      const data = {
        userId: req.body.userId,
        deviceToken: doc.deviceToken,
        userData: result,
        or: [
          {
            notifyByBusinessUnits: req.body.parentBussinessUnitId,
          },
          {
            notifyBySubSkillSets: {
              $in: doc.subSkillSets,
            },
          },
          {
            notifyByAppointments: req.body.appointmentId,
          },
        ],
      };

      await notification.addUserToDynamicNotifications(data, res);
      /* for dynamic notification ends */
      if (doc._id !== req.body.userId) {
        /* push notifications */
        if (doc.deviceToken) {
          const pushNotificationData = {
            title: 'Profile updated',
            body: 'Your profile has been updated by the administrator',
          };
          const collapseKey = req.body.userId;

          await FCM.push([doc.deviceToken], pushNotificationData, collapseKey);
        }

        /* saving to other notification collection */
        const ignore = ['userId', 'isFlexiStaff'];
        const bodyKeys = Object.keys(req.body).filter((x) => {
          if (!ignore.includes(x)) {
            return x;
          }

          return false;
        });

        /* checking for input changes and pushing them into changed fields */
        const keysToCheck = _.pick(oldData, bodyKeys);
        let changedFields = [];

        for (const key of Object.keys(keysToCheck)) {
          // check eqality for dates
          if (
            key === 'staffPassExpiryDate' ||
            key === 'airportPassExpiryDate' ||
            key === 'doj'
          ) {
            if (req.body[key]) {
              // ignore null or "" values
              const updateDate = new Date(
                moment(req.body[key], 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
              ).toISOString();

              if (!moment(keysToCheck[key]).isSame(updateDate)) {
                changedFields.push(key);
              }
            }
          }
          // check equality for primitive and arrays
          else if (
            key === 'planBussinessUnitId' ||
            key === 'viewBussinessUnitId' ||
            key === 'subSkillSets'
          ) {
            // deep comparing arrays with ObjectId

            if (
              !__.compareArray(
                req.body[key].map((x) => mongoose.Types.ObjectId(x)),
                keysToCheck[key],
              )
            ) {
              changedFields.push(key);
            }
          }
          // handling primitives
          else if (keysToCheck[key] !== req.body[key]) {
            changedFields.push(key);
          }
        }
        if (changedFields.length) {
          __.log(changedFields, 'changedFields');
          changedFields = changedFields
            .map(__.camelToSpace)
            .map((x) => x.replace(/\sid/g, ''))
            .join(', ');
          __.log(changedFields, 'after modification');
          const otherNotificationData = {
            user: doc._id,
            fromUser: req.user._id,
            title: 'Profile Updated',
            description: `${changedFields} has been updated by administrator`,
            type: 1,
          };
          const newNotification = new OtherNotification(otherNotificationData);

          await newNotification.save();
        }
      }

      this.read(req, res);

      if (req.file) {
        __.scanFile(
          req.file.filename,
          `public/uploads/profilePictures/${req.file.filename}`,
        );
      }

      return '';
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async updateOtherFields(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const userId = req.user._id;
      const user = await User.findById(userId).select('otherFields').lean();
      const otherFieldsInput = req.body.otherFields || [];
      const userFields = await UserField.find({
        companyId: req.user.companyId,
        status: 1,
      })
        .sort({
          indexNum: 1,
        })
        .lean();
      const otherFields = userFields.map((v) => {
        const index = user.otherFields.findIndex((o) =>
          __.isEqualObjectIds(o.fieldId, v._id),
        );

        if (index !== -1) {
          v.value = user.otherFields[index].value;
        }

        const field = otherFieldsInput.find((o) =>
          __.isEqualObjectIds(o._id, v._id),
        );

        if (field) {
          v.value = field.value;
        }

        return { fieldId: v._id, value: v.value || null };
      });

      await User.findByIdAndUpdate(userId, {
        $set: {
          otherFields,
        },
      });

      return __.out(res, 201, { message: 'Successufully updated' });
    } catch (error) {
      __.log(error);
      return __.out(res, 201, 'Something went wrong try later');
    }
  }

  async statusUpdate(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['userId']);

      if (!__.checkSpecialCharacters(req.body)) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await User.findOne({
        _id: req.body.userId,
        status: {
          $ne: 3,
        },
      });

      if (doc) {
        let status;

        if (req.url === '/active') {
          status = 1;
        } else if (req.url === '/inactive') {
          status = 2;
        } else {
          status = 3; // (3 => delete)
        }

        doc.status = status;

        if (doc.status === 1) {
          doc.loginAttempt = 0;
        }

        const result = await doc.save();

        if (result) {
          return __.out(res, 201, 'Successfully updated');
        }

        return __.out(res, 300, 'Something went wrong');
      }

      return __.out(res, 300, 'Invalid userId');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Read Customisable Fields
  async readUserFields(req, res) {
    try {
      const where = {
        companyId: req.user.companyId,
        status: 1,
      };
      const userFields = await UserField.find(where)
        .sort({
          indexNum: 1,
        })
        .lean();

      return __.out(res, 201, userFields);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async test(req, res) {
    if (!__.checkHtmlContent(req.body)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    let deviceTokens;

    if (req.body.deviceToken) {
      deviceTokens = [req.body.deviceToken];
    } else
      deviceTokens = [
        'cyK4R_7g86Y:APA91bFFbVIBT4XYVQR34QZYJnDWpNV1PpWIWrmYWixDCRk1QttSoanUitjOn3f00bP35N_AUZEQ6IvVH3ipH51PtzCVjjsSE3AePb90Vl0QZZWfL8CraNFKVckI3AuMA9i1ezvdKP29',
      ];

    const pushNotificationData = {
      title: 'notification title',
      body: 'notification sample description',
      bodyText: `Standby shift on XXX to XXX is available for confirmation`,
      bodyTime: [moment().unix(), moment().unix()],
      bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
      // redirect: 'makeBookings'
    };
    const collapseKey = `seconds-${Math.random()}`;
    const response = await FCM.push(
      deviceTokens,
      pushNotificationData,
      collapseKey,
    );

    return __.out(res, 201, response);
  }

  async readUser(req, res) {
    try {
      req.query.filter = req.query.filter || {};
      if (
        req.query.filter.parentBussinessUnitId &&
        req.query.filter.parentBussinessUnitId.length
      ) {
        // No action needed currently, reserved for future use
      } else {
        const businessUnitIds = await User.findOne(
          {
            _id: req.user._id,
          },
          {
            planBussinessUnitId: 1,
          },
        );

        req.query.filter.parentBussinessUnitId =
          businessUnitIds.planBussinessUnitId;
      }

      const users = await this.findAllUser(req.query, res);

      return res.json({ data: users });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async findAllUser({ page, limit, search, sortBy, sortWith, filter }, res) {
    const skip = page ? (parseInt(page, 10) - 1) * limit : 0;

    filter = {
      // status: ['active', 'inactive', 'locked'],
      staffIds: [],
      parentBussinessUnitId: [],
      fields: ['staffId', 'name', 'parentBussinessUnitId'],
      searchable: ['staffId', 'name', 'email'],
      ...filter,
    };

    const select = filter.fields.reduce((prev, v) => {
      prev[v] = 1;
      return prev;
    }, {});

    filter.status = Array.isArray(filter.status)
      ? filter.status.map((s) => parseInt(s, 10))
      : null;
    const statusCondtion = Array.isArray(filter.status)
      ? filter.status
      : [parseInt(filter.status, 10)];

    const businessUnitCondtion =
      filter.parentBussinessUnitId && filter.parentBussinessUnitId.length
        ? { parentBussinessUnitId: { $in: filter.parentBussinessUnitId } }
        : {};
    const appointmentIdCondition =
      filter.appointmentId && filter.appointmentId.length
        ? { appointmentId: { $in: filter.appointmentId } }
        : {};
    const staffIdCondtion = filter.staffIds.length
      ? { staffId: { $in: filter.staffIds } }
      : {};

    const searchCondition = {};

    const validSearchPattern = /^[a-zA-Z0-9\s]+$/;

    if (search) {
      if (!validSearchPattern.test(search)) {
        return __.out(res, 300, `Invalid search input`);
      }

      const reg = `^${search}$`;

      searchCondition.$or = filter.searchable.map((v) => ({
        [v]: {
          $regex: reg,
          $options: 'i',
        },
      }));
    }

    const count = await User.countDocuments({
      ...businessUnitCondtion,
      ...appointmentIdCondition,
      ...searchCondition,
      ...staffIdCondtion,
      status: {
        $in: statusCondtion,
      },
    });
    const model = User.find(
      {
        ...businessUnitCondtion,
        ...appointmentIdCondition,
        ...searchCondition,
        ...staffIdCondtion,
        status: {
          $in: statusCondtion,
        },
      },
      {
        ...select,
      },
      { skip, limit },
    ).sort({
      [sortWith || 'createdAt']: sortBy === 'desc' ? -1 : 1,
    });

    const users = await model.lean();

    return { count, data: users };
  }

  async uploadBulkUsers(req, res) {
    try {
      const startIntegration = async (userData, nonUpdatedUser) => {
        const companyData = await Company.findOne({
          _id: req.user.companyId,
        }).lean();
        // Get all roles/appoint/businessunit list
        const roles = await Roles.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .select('name')
          .lean();
        const appointments = await Appointment.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .select('name')
          .lean();
        const LeaveGroups = await LeaveGroup.find({
          companyId: req.user.companyId,
          isActive: true,
          adminId: req.user._id,
        })
          .select('name')
          .lean();
        const SchemeDetail = await Scheme.find({
          companyID: req.user.companyId,
          status: true,
        })
          .select('schemeName')
          .lean();
        const skillSetsData = await SkillSet.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .populate({ path: 'subSkillSets', match: { status: 1 } })
          .select('name')
          .lean();
        const businessUnitsIds = await __.getCompanyBU(
          req.user.companyId,
          'subsection',
          1,
        );
        const businessUnits = await SubSection.find({
          _id: { $in: businessUnitsIds },
        })
          .populate({
            path: 'sectionId',
            select: 'name',
            match: {
              status: 1,
            },
            populate: {
              path: 'departmentId',
              select: 'name',
              match: {
                status: 1,
              },
              populate: {
                path: 'companyId',
                select: 'name',
                match: {
                  status: 1,
                },
              },
            },
          })
          .lean();
        const staticFields = [
          'staffName',
          'staffId',
          'appointment',
          'contact',
          'email',
          'role',
          'shiftSchemeId',
          'businessUnitParent',
          'skillSets',
          'businessUnitPlan',
          'businessUnitView',
          'leaveGroup',
        ];
        let generatedPassword = await __.makePwd(8);
        const pagesettings = await Pagesettings.findOne({
          companyId: req.user.companyId,
        }).lean();

        /* eslint-disable no-await-in-loop */
        for (const elem of userData) {
          // user Data with static fields
          const role = roles.find((role1) => role1.name === elem.role);
          const appointment = appointments.find(
            (appointment1) => appointment1.name === elem.appointment,
          );
          const LeaveGroups1 = LeaveGroups.find(
            (LeaveGroupp1) => LeaveGroupp1.name === elem.leaveGroup,
          );
          let schemeId;

          if (elem['Shift Scheme Name']) {
            schemeId = SchemeDetail.find(
              (scheme) =>
                scheme.schemeName === elem['Shift Scheme Name'].trim(),
            );
          }

          const getFullBU = (businessUnit) =>
            `${businessUnit.sectionId.departmentId.companyId.name}>${businessUnit.sectionId.departmentId.name}>${businessUnit.sectionId.name}>${businessUnit.name}`;
          const parentBussinessUnit = businessUnits.find((businessUnit) => {
            const fullBU = getFullBU(businessUnit);

            return fullBU === elem.businessUnitParent;
          });
          const convertNametoBuId = function (namesList) {
            const businessUnitNames = namesList ? namesList.split(',') : [];

            return businessUnits.reduce((prev, curr) => {
              const fullBU = getFullBU(curr);

              if (businessUnitNames.indexOf(fullBU) !== -1) {
                prev.push(curr._id);
              }

              return prev;
            }, []);
          };
          const staffId = `${elem.staffId}`.toLowerCase();
          const emailRegexp = (email) =>
            /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
              email,
            );
          // Validate Staff Id/Parent BU/Role/Appointment
          // Sub Skill Set
          const user = {
            name: elem.staffName,
            staffId,
            appointmentId: appointment ? appointment._id : null,
            leaveGroupId: LeaveGroups1 ? LeaveGroups1._id : null,
            contactNumber: elem.contact || '',
            email: emailRegexp(elem.email) ? elem.email : null,
            role: role ? role._id : null,
            parentBussinessUnitId: parentBussinessUnit
              ? parentBussinessUnit._id
              : null,
            skillSets: elem.skillSets ? elem.skillSets.split(',') : [],
            subSkillSets: [],
            planBussinessUnitId: convertNametoBuId(elem.businessUnitPlan),
            viewBussinessUnitId: convertNametoBuId(elem.businessUnitView),
            schemeId: schemeId && schemeId._id ? schemeId._id : null,
          };

          for (const elems of skillSetsData) {
            for (const elem1 of elems.subSkillSets) {
              if (elem1) {
                // skkill set 1 > test sub skill set 3
                const fullString = `${elems.name}>${elem1.name}`;

                if (user.skillSets.indexOf(fullString) > -1) {
                  user.subSkillSets.push(elem1._id);
                }
              }
            }
          }
          const isUser = await User.findOne({
            staffId: user.staffId,
            companyId: req.user.companyId,
          }).lean();
          let updatedUserData = null;

          if (isUser) {
            for (const key of Object.keys(user)) {
              if (Object.prototype.hasOwnProperty.call(user, key)) {
                const element = user[key];

                if (element) {
                  if (
                    [
                      'planBussinessUnitId',
                      'viewBussinessUnitId',
                      'subSkillSets',
                    ].includes(key) &&
                    !element.length
                  ) {
                    delete user[key];
                  }
                } else {
                  delete user[key];
                }
              }
            }
            // update leave group
            if (
              user.leaveGroupId &&
              (!isUser.leaveGroupId ||
                isUser.leaveGroupId.toString() !== user.leaveGroupId.toString())
            ) {
              user.userId = isUser._id;
              this.updateStaffLeave(user, req);
            }

            updatedUserData = await User.findOneAndUpdate(
              {
                companyId: req.user.companyId,
                staffId: user.staffId.toLowerCase(),
              },
              {
                $set: user,
              },
            );
          } else {
            if (
              !user.parentBussinessUnitId ||
              !user.role ||
              !user.appointmentId ||
              !user.staffId ||
              !user.email
            ) {
              let reason = '';

              if (user.staffId !== 'undefined') {
                if (!user.staffId) reason += 'staffId Incorrect,';

                if (!user.parentBussinessUnitId)
                  reason += 'Parent BU incorrect,';

                if (!user.role) reason += 'Role incorrect,';

                if (!user.appointmentId) reason += 'Appointment incorrect,';

                if (!user.email) reason += 'Email incorrect';

                const nonupUserData = {
                  staffId: elem.staffId,
                  parentBussinessUnit: elem.businessUnitParent,
                  role: elem.role,
                  appointment: elem.appointment,
                  email: elem.email,
                  reason,
                };

                nonUpdatedUser.push(nonupUserData);
              }
            }

            const { generateHash } = new User();

            if (pagesettings.pwdSettings.status === 1) {
              if (pagesettings.pwdSettings.passwordType === 2) {
                generatedPassword = pagesettings.pwdSettings.defaultPassword;
                user.password = generateHash(generatedPassword);
              } else {
                user.password = generateHash(generatedPassword);
              }
            }

            user.status = 1;
            user.companyId = req.user.companyId;
            user.staffId = user.staffId.toLowerCase();
            updatedUserData = new User(user);
            if (
              !!user.parentBussinessUnitId &&
              !!user.role &&
              !!user.appointmentId &&
              !!user.staffId &&
              !!user.email
            ) {
              await updatedUserData.save();
            }

            // called leaveGroup Create
            if (user.leaveGroupId) {
              updatedUserData.userId = updatedUserData._id;
              this.createStaffLeave(updatedUserData, req);
            }

            /* sending mail */
            const mailDoc = {
              email: updatedUserData.email,
              userName: updatedUserData.name,
              staffId: updatedUserData.staffId,
              password: generatedPassword,
              companyData,
            };

            mailer.newCompanyUser(mailDoc);
          }

          for (const singleField of Object.keys(elem)) {
            // Check Custom Field or not
            if (staticFields.indexOf(singleField) === -1) {
              const userFieldId = await UserField.findOne({
                fieldName: singleField,
                companyId: req.user.companyId,
                status: 1,
              }).lean();

              if (userFieldId) {
                // Update if exists
                const existField = await User.updateOne(
                  {
                    _id: updatedUserData._id,
                    'otherFields.fieldId': userFieldId._id,
                  },
                  { $set: { 'otherFields.$.value': elem[singleField] } },
                );

                // Add if not exists
                if (existField.modifiedCount === 0) {
                  const newFieldData = {
                    fieldId: userFieldId._id,
                    fieldName: userFieldId.fieldName,
                    indexNum: userFieldId.indexNum,
                    options: userFieldId.options,
                    required: userFieldId.required,
                    type: userFieldId.type,
                    value: elem[singleField],
                  };
                  const returnedData = await User.findOneAndUpdate(
                    { _id: updatedUserData._id },
                    { $addToSet: { otherFields: newFieldData } },
                    { new: true },
                  );

                  __.log(userFieldId, returnedData);
                }
              }
            }
          }
        }
        /* eslint-enable no-await-in-loop */
        fs.unlink(req.file.path, () => {});
        // If missing users exists

        if (nonUpdatedUser.length) {
          const fileName = `nonUpdated_bulkupload_${new Date().getTime()}`;

          const titles = [
            'staffId',
            'parentBussinessUnit',
            'role',
            'schemeName',
            'appointment',
            'email',
            'reason',
          ];
          const csv = json2csv(nonUpdatedUser, titles);

          await fs.writeFile(
            `./public/uploads/bulkUpload/${fileName}.csv`,
            csv,
            (err) => __.log(err),

            __.out(res, 201, {
              nonUpdated: true,
              fileLink: `uploads/bulkUpload/${fileName}.csv`,
            }),
          );
        }

        return __.out(res, 201, { nonUpdated: false });
      };
      const getFileData = async () => {
        const fileData = await fs.readFile(req.file.path);
        const workbook = xlsx.read(fileData, { type: 'buffer' });

        const sheetName = workbook.SheetNames[0];
        const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
          defval: '',
        }); // parses a file

        const nonUpdatedUser = [];

        startIntegration(excelData, nonUpdatedUser);
      };

      if (req.file) {
        getFileData(req.file);
      }

      if (req.file) {
        __.scanFile(
          req.file.filename,
          `public/uploads/bulkUpload/${req.file.filename}`,
        );
      }

      return null;
    } catch (error) {
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Check this user is admin or not
  async isAdmin(userData, res) {
    try {
      const categoryData = await PrivilegeCategory.findOne({
        name: 'System Admin',
      })
        .select('privileges')
        .lean();

      const { privileges } = categoryData;
      const systemAdminRoles = await Role.find({
        companyId: userData.companyId,
        privileges: {
          $all: privileges,
        },
      }).lean();
      const systemAdminRolesId = systemAdminRoles.map((x) => x._id.toString());
      let result = false;

      if (systemAdminRolesId.indexOf(userData.role._id.toString()) > -1) {
        result = true;
      }

      return result;
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  // Locked Users
  async lockedUsers(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const where = {
        companyId: req.user.companyId,
        parentBussinessUnitId: {
          $in: req.user.planBussinessUnitId,
        },
        status: 0,
      };
      const recordsTotal = await User.count(where);

      if (!!req.query.search && req.query.search.value) {
        where.$or = [
          {
            name: {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
          {
            staffId: {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
          {
            contactNumber: {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
        ];
      }

      const appointmentCondition = { 'appointment.status': 1 };

      if (!!req.query.search && req.query.search.value) {
        appointmentCondition['appointment.name'] = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };
      }

      const filteredRecords = await User.aggregate([
        { $match: where },
        {
          $lookup: {
            from: 'appointments',
            localField: 'appointmentId',
            foreignField: '_id',
            as: 'appointment',
          },
        },
        {
          $unwind: '$appointment',
        },
        {
          $match: appointmentCondition,
        },
      ]).allowDiskUse(true);
      const recordsFiltered = filteredRecords.length;
      let sort = { updatedAt: -1 };
      const getSort = (val) => (val === 'asc' ? 1 : -1);

      if (req.query.order) {
        const sortData = [`name`, `staffId`, `doj`, `contactNumber`, `name`];
        const orderData = req.query.order;

        sort = orderData.reduce((prev, curr) => {
          const key = sortData[curr.column];

          prev[key] = getSort(curr.dir);
          return prev;
        }, sort);
      }

      const users = await User.aggregate([
        { $match: where },
        {
          $lookup: {
            from: 'appointments',
            localField: 'appointmentId',
            foreignField: '_id',
            as: 'appointment',
          },
        },
        {
          $unwind: '$appointment',
        },
        {
          $match: appointmentCondition,
        },
        {
          $lookup: {
            from: 'subsections',
            localField: 'parentBussinessUnitId',
            foreignField: '_id',
            as: 'businessUnit',
          },
        },
        {
          $unwind: '$businessUnit',
        },
        {
          $lookup: {
            from: 'sections',
            localField: 'businessUnit.sectionId',
            foreignField: '_id',
            as: 'section',
          },
        },
        {
          $unwind: '$section',
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'section.departmentId',
            foreignField: '_id',
            as: 'department',
          },
        },
        {
          $unwind: '$department',
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'department.companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        {
          $unwind: '$company',
        },
        {
          $project: {
            staffId: 1,
            name: 1,
            doj: 1,
            contactNumber: 1,
            'appointment.name': 1,
            'company.name': 1,
            'department.name': 1,
            'section.name': 1,
            'businessUnit.name': 1,
          },
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]).allowDiskUse(true);
      const data = users.map((v) => {
        v.businessUnit = `${v.company.name} > ${v.department.name} > ${v.section.name} > ${v.businessUnit.name}`;
        delete v.company;
        delete v.section;
        delete v.department;
        return v;
      });
      const result = {
        draw: req.query.draw || 0,
        recordsTotal,
        recordsFiltered,
        data,
      };

      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getUserPrivilege(req, res) {
    try {
      // let pre = req.user.role.privileges[0];
      const user = await User.findById(req.user._id).populate({
        path: 'role',
        match: {
          status: 1,
        },
        select: 'name description isFlexiStaff privileges',
        populate: {
          path: 'privileges',
          match: {
            status: 1,
          },
          select: 'name description flags privilegeCategoryId',
          populate: {
            path: 'privilegeCategoryId',
            match: {
              status: 1,
            },
            select: 'name',
          },
        },
      });
      const flags = await __.getUserPrivilegeObject(user.role.privileges);
      const profilePic = req.user.profilePicture;

      return __.out(res, 201, { privilegeFlags: flags, profilePic });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async employeeDirecotory(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const skip = req.query.page ? req.query.page * 10 : 0;
      const query = {
        companyId: req.user.companyId,
        status: 1,
      };

      if (req.query.q) {
        query.name = {
          $regex: `${req.query.q}`,
          $options: 'is',
        };
      }

      if (req.query.appointmentId) {
        query.appointmentId = req.query.appointmentId;
      }

      if (req.query.parentBussinessUnitId) {
        query.parentBussinessUnitId = req.query.parentBussinessUnitId;
      }

      let result = await User.find(query)
        .populate([
          {
            path: 'appointmentId',
            select: 'name status',
            match: {
              status: 1,
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
        ])
        .select({
          staffId: 1,
          name: 1,
          appointmentId: 1,
          otherFields: 1,
          parentBussinessUnitId: 1,
          contactNumber: 1,
          profilePicture: 1,
          email: 1,
          primaryMobileNumber: 1,
          countryCode: 1,
        })
        .sort({
          name: 1,
        })
        .skip(skip)
        .limit(10)
        .lean();

      result = result.map((opt) => ({
        name: opt.name,
        appointment: {
          name: opt.appointmentId ? opt.appointmentId.name : '',
        },
        parent_BU: `${opt.parentBussinessUnitId.sectionId.departmentId.companyId.name}>${opt.parentBussinessUnitId.sectionId.departmentId.name}>${opt.parentBussinessUnitId.sectionId.name}>${opt.parentBussinessUnitId.name}`,
        otherFields: opt.otherFields || [],
        contactNumber: '',
        profilePicture: opt.profilePicture || '--',
        email: opt.email || '--',
        staffId: opt.staffId || '--',
      }));
      return __.out(res, 201, result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Get role to update and perform frontend UI change
  async checkWithRole(req, res) {
    try {
      const searchQuery = {
        staffId: req.user.staffId,
        companyId: req.user.companyId,
      };
      const userRole = await User.findOne(searchQuery)
        .select('role -_id')
        .lean();
      const response = { role: userRole.role };

      if (req.query.getPriv) {
        const doc = await User.findOne(searchQuery).populate([
          {
            path: 'role',
            match: {
              status: 1,
            },
            select: 'privileges',
            populate: {
              path: 'privileges',
              match: {
                status: 1,
              },
              select: 'name description flags privilegeCategoryId',
              populate: {
                path: 'privilegeCategoryId',
                match: {
                  status: 1,
                },
                select: 'name',
              },
            },
          },
        ]);
        const doc2 = doc.toObject();
        const privilegeFlags = await __.getUserPrivilegeObject(
          doc2.role.privileges,
        );

        response.privileges = privilegeFlags;
      }

      return res.status(201).json(response);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
const user = new CompanyUserController();

module.exports = user;
// OKK
