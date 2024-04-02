// Controller Code Starts here
const mongoose = require('mongoose');
const _ = require('lodash');
const { validationResult } = require('express-validator');
const SkillSet = require('../../models/skillSet');
const SubSkillSet = require('../../models/subSkillSet');
const SubSection = require('../../models/subSection');
const MasterBUTable = require('../../models/masterBUTable');
const Role = require('../../models/role');
const GeoReportingLocation = require('../../models/geoReportingLocation');
const User = require('../../models/user');
const PostCategory = require('../../models/postCategory');
const Channel = require('../../models/channel');
const pageSetting = require('../../models/pageSetting');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');
const { AssignUserRead } = require('../../../helpers/assinguserread');

class BusinessUnitController {
  async updateLocation(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(
        req,
        ['businessUnitId', 'locations'],
        'updateLocation',
      );

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

      const result = await SubSection.findOneAndUpdate(
        {
          _id: req.body.businessUnitId,
          status: {
            $ne: 3,
          },
        },
        {
          $set: {
            reportingLocation: req.body.locations,
          },
        },
        {
          new: true,
        },
      );

      return __.out(res, 201, result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async updateSkillSet(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(
        req,
        ['businessUnitId', 'subSkillSets'],
        'updateSkillSet',
      );

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

      const result = await SubSection.findOneAndUpdate(
        {
          _id: req.body.businessUnitId,
          status: {
            $ne: 3,
          },
        },
        {
          $set: {
            subSkillSets: req.body.subSkillSets,
          },
        },
        {
          new: true,
        },
      );

      return __.out(res, 201, result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async updateSkillSetAndLocation(req, res) {
    // debugger;
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
        'status',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      if (!__.checkSpecialCharacters(req.body)) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      if (!req.body.noOfWeek) {
        req.body.noOfWeek = 0;
      }

      const updateData = {
        status: req.body.status,

        sectionId_departmentId_companyId_name:
          req.body.sectionId_departmentId_companyId_name,
        sectionId_departmentId_name: req.body.sectionId_departmentId_name,
        sectionId_name: req.body.sectionId_name,
        name: req.body.name,
      };

      await SubSection.findOneAndUpdate(
        {
          _id: req.body.businessUnitId,
          status: {
            $ne: 3,
          },
        },
        {
          $set: updateData,
        },
        {
          new: true,
        },
      );

      const systemAdminRoles = await Role.find({
        companyId: req.user.companyId,
        name: 'System Admin',
      }).lean();

      const systemAdminRolesId = systemAdminRoles.map((x) => x._id);
      const businessUnitObjectID = mongoose.Types.ObjectId(
        req.body.businessUnitId,
      );

      await User.update(
        {
          $or: [
            {
              role: {
                $in: systemAdminRolesId,
              },
            },
            { allBUAccess: 1 },
          ],
          companyId: req.user.companyId,
        },
        {
          $addToSet: {
            planBussinessUnitId: businessUnitObjectID,
            viewBussinessUnitId: businessUnitObjectID,
          },
        },
        {
          multi: true,
        },
      );

      delete req.body.businessUnitId;
      __.updateAllBuToAccessUsers(req.user.companyId);
      this.masterBUTableUpdate(req.user.companyId);
      return this.read(req, res);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async skillSetsAndLocations(req, res) {
    try {
      logInfo('businessunit/skillsetsandlocations API api Start!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `businessunit/skillsetsandlocations API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
      ]);

      if (!__.checkSpecialCharacters(req.body)) {
        logError(
          `businessunit/skillsetsandlocations API, caught an error `,
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
          `businessunit/skillsetsandlocations API, Required fields missing `,
          requiredResult.missingFields,
        );
        logError(
          `businessunit/skillsetsandlocations API, request payload `,
          req.body,
        );
        return __.out(res, 400, requiredResult.missingFields);
      }

      const businessUnitDetails = await SubSection.findById(
        req.body.businessUnitId,
      ).populate({
        path: 'reportingLocation',
        select: 'name',
        match: {
          status: 1,
        },
      });

      if (businessUnitDetails === null) {
        logError(
          `businessunit/skillsetsandlocations API, Invalid businessUnitId `,
          req.body,
        );
        return __.out(res, 300, 'Invalid businessUnitId');
      }

      const result = await SkillSet.find().populate({
        path: 'subSkillSets',
        select: 'name',
        match: {
          _id: {
            $in: businessUnitDetails.subSkillSets,
          },
        },
      });

      /* To remove null parents (since parents may get disabled) */
      const skillSetsResult = await _.filter(
        result,
        (o) => o.subSkillSets.length > 0,
      );
      const mainSkillSets = [];

      businessUnitDetails.mainSkillSets.forEach((ite) => {
        const main = result.filter(
          (re) => re._id.toString() === ite.toString(),
        )[0];

        mainSkillSets.push(main);
      });
      logInfo('businessunit/skillsetsandlocations API api end!', {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, {
        skillSets: skillSetsResult,
        mainSkillSets,
        reportingLocation: businessUnitDetails.reportingLocation,
        businessUnitDetails,
      });
    } catch (err) {
      logError(
        `businessunit/skillsetsandlocations API, there is an error `,
        err.toString(),
      );
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getUserChannels(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const channelIds = await AssignUserRead.getUserInAssignedUser(
        req.user,
        Channel,
        'channel',
      );
      const channelList = await Channel.find({
        _id: {
          $in: channelIds,
        },
      })
        .select('_id name')
        .lean();

      // Getting only user channels
      if (req.body.internalApi === true) {
        return channelList;
      }

      // Make Category Inside Channel
      const getCat = async function () {
        let count = 0;

        const promiseData = [];
        const getCatDataCall = async (elem) => {
          const cat = await PostCategory.find({
            channelId: elem._id,
            status: 1,
          })
            .select('_id name')
            .lean();

          channelList[count].categoryList = cat;
          count += 1;
        };

        for (const elem of channelList) {
          promiseData.push(getCatDataCall(elem));
        }

        await Promise.all(promiseData);
      };

      await getCat();
      return channelList;
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readOld(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const allBus = new Set([
        ...req.user.planBussinessUnitId,
        ...req.user.viewBussinessUnitId,
        req.user.parentBussinessUnitId,
      ]);
      const where = {
        status: {
          $in: [1],
        },
        _id: {
          $in: [...allBus],
        },
        sectionId: {
          $exists: true,
        },
      };

      if (req.body.businessUnitId) {
        where._id = req.body.businessUnitId;
      } else if (req.body.isWebsite) {
        where.status = 1;
      }

      const companySetup = await pageSetting.findOne(
        { companyId: req.user.companyId },
        { opsGroup: 1 },
      );
      const tierSetup = companySetup.opsGroup.tierType;
      let businessUnitList = await SubSection.find(where)
        .select(
          '_id name status cancelShiftPermission standByShiftPermission shiftCancelHours techEmail adminEmail notificRemindHours notificRemindDays appointments sectionId noOfWeek breakInMinutes shiftTimeInMinutes isBreakTime shiftBreak mainSkillSets skillSetTierType plannedHours',
        )
        .populate([
          {
            path: 'reportingLocation',
            select: 'name',
            match: {
              status: 1,
            },
          },
          {
            path: 'subCategories',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'categoryId',
              select: 'name status',
              match: {
                status: 1,
              },
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
            path: 'mainSkillSets',
            select: 'name',
            match: {
              status: 1,
            },
          },
          {
            path: 'reportingLocation',
            select: 'name',
            match: {
              status: 1,
            },
          },
          {
            path: 'sectionId',
            select:
              'name departmentId adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
          {
            path: 'appointments',
            select: 'name status',
          },
          {
            path: 'scheme',
            select: 'schemeName status',
            match: {
              status: true,
            },
          },
        ])
        .lean();

      businessUnitList = businessUnitList.filter(
        (bu) =>
          !!bu.sectionId &&
          !!bu.sectionId.departmentId &&
          !!bu.sectionId.departmentId.companyId &&
          bu.sectionId.departmentId.companyId._id.toString() ===
            req.user.companyId.toString(),
      );

      const appointmentIds = await User.find({
        parentBussinessUnitId: { $in: businessUnitList.map((b) => b._id) },
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

      businessUnitList.forEach((bu, index) => {
        businessUnitList[index].skillSetTierType = tierSetup || 2;
        bu.appointments = bu.appointments ? bu.appointments : [];
        const buaps = JSON.parse(JSON.stringify(bu.appointments));
        const allaps = appointmentIds
          .filter(
            (aps) =>
              aps.parentBussinessUnitId._id.toString() === bu._id.toString(),
          )
          .map((aps) => aps.appointmentId);

        bu.appointments.push(
          ...allaps.filter(
            (aaps) =>
              !buaps.find((bap) => bap._id.toString() === aaps._id.toString()),
          ),
        );
      });

      let userPlanBussinessUnitIds = [];
      const userViewBussinessUnitIds = [];

      if (!req.body.businessUnitId) {
        /* To remove null parents (since parents may get disabled) */
        businessUnitList = await _.filter(businessUnitList, async (o) => {
          /* check the BU Id is valid */
          if (
            o.sectionId != null &&
            o.sectionId.departmentId != null &&
            o.sectionId.departmentId.companyId != null
          ) {
            /* filter valid BU id from user plan bu ids */
            if (
              req.user.planBussinessUnitId.findIndex((x) =>
                _.isEqual(x, o._id),
              ) !== -1
            ) {
              userPlanBussinessUnitIds.push(o._id);
            }

            /* filter valid BU id from user view bu ids */
            if (
              req.user.viewBussinessUnitId.findIndex((x) =>
                _.isEqual(x, o._id),
              ) !== -1
            ) {
              userViewBussinessUnitIds.push(o._id);
            }

            return o;
          }

          return null;
        });
      }

      const sortBu = (userPlanBussinessUnitIds1) => {
        userPlanBussinessUnitIds = userPlanBussinessUnitIds1 || [];
        return userPlanBussinessUnitIds
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
      };

      return __.out(res, 201, {
        businessUnitList: businessUnitList != null ? businessUnitList : [],
        parentBussinessUnitId: req.user.parentBussinessUnitId,
        planBussinessUnitId: sortBu(userPlanBussinessUnitIds),
        viewBussinessUnitId: sortBu(userViewBussinessUnitIds),
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async readPlanBu(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const allBus = new Set([...req.user.planBussinessUnitId]);
      const where = {
        status: {
          $in: [1],
        },
        _id: {
          $in: [...allBus],
        },
        sectionId: {
          $exists: true,
        },
      };

      if (req.body.businessUnitId) {
        where._id = req.body.businessUnitId;
      } else if (req.body.isWebsite) {
        where.status = 1;
      }

      let businessUnitList = await SubSection.find(where)
        .select('_id name status sectionId')
        .populate([
          {
            path: 'sectionId',
            select: 'name departmentId status',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
        ])
        .lean();

      businessUnitList = businessUnitList.filter(
        (bu) =>
          !!bu.sectionId &&
          !!bu.sectionId.departmentId &&
          !!bu.sectionId.departmentId.companyId &&
          bu.sectionId.departmentId.companyId._id.toString() ===
            req.user.companyId.toString(),
      );

      return __.out(res, 201, {
        businessUnitList: businessUnitList != null ? businessUnitList : [],
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async readSingleBu(req, res) {
    try {
      logInfo(`businessunit/read/singlebu API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `businessunit/read/singlebu API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
      ]);

      if (!req.body.businessUnitId) {
        logError(
          `businessunit/read/singlebu API, Required fields missing `,
          requiredResult1.missingFields,
        );
        logError(`businessunit/read/singlebu API, request payload `, req.body);
        return __.out(res, 300, `businessUnitId is missing`);
      }

      const where = {};

      if (req.body.businessUnitId) {
        where._id = req.body.businessUnitId;
      } else if (req.body.isWebsite) {
        where.status = 1;
      }

      const promiseResult = await Promise.all([
        this.getCompanySetup(req.user.companyId),
        this.getSingleBu(where),
        this.getAppointmentBu(req.body.businessUnitId),
      ]);
      const companySetup = promiseResult[0];
      const businessUnitList = promiseResult[1];
      const appointmentIds = promiseResult[2];
      const tierSetup = companySetup.opsGroup.tierType;

      businessUnitList.skillSetTierType = tierSetup || 2;
      businessUnitList.appointments = businessUnitList.appointments
        ? businessUnitList.appointments
        : [];
      const buaps = JSON.parse(JSON.stringify(businessUnitList.appointments));
      const allaps = appointmentIds
        .filter(
          (aps) =>
            aps.parentBussinessUnitId._id.toString() ===
            businessUnitList._id.toString(),
        )
        .map((aps) => aps.appointmentId);

      businessUnitList.appointments.push(
        ...allaps.filter(
          (aaps) =>
            !buaps.find((bap) => bap._id.toString() === aaps._id.toString()),
        ),
      );

      logInfo(`businessunit/read/singlebu API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, {
        businessUnitList: businessUnitList != null ? businessUnitList : [],
        parentBussinessUnitId: req.user.parentBussinessUnitId,
      });
    } catch (err) {
      logError(
        `businessunit/read/singlebu API, there is an error`,
        err.toString(),
      );
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getSingleBu(where) {
    return new Promise((resolve) => {
      const businessUnitList = SubSection.findOne(where)
        .select(
          '_id name status cancelShiftPermission standByShiftPermission shiftCancelHours techEmail adminEmail notificRemindHours notificRemindDays appointments sectionId noOfWeek breakInMinutes shiftTimeInMinutes isBreakTime shiftBreak mainSkillSets skillSetTierType plannedHours cutOffDaysForBookingAndCancelling geoReportingLocation reportingLocationType',
        )
        .populate([
          {
            path: 'geoReportingLocation',
            select: 'name status',
          },
          {
            path: 'reportingLocation',
            select: 'name',
            match: {
              status: 1,
            },
          },
          {
            path: 'subCategories',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'categoryId',
              select: 'name status',
              match: {
                status: 1,
              },
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
            path: 'mainSkillSets',
            select: 'name',
            match: {
              status: 1,
            },
          },
          {
            path: 'reportingLocation',
            select: 'name',
            match: {
              status: 1,
            },
          },
          {
            path: 'sectionId',
            select:
              'name departmentId adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
          {
            path: 'appointments',
            select: 'name status',
          },
          {
            path: 'scheme',
            select: 'schemeName status',
            match: {
              status: true,
            },
          },
        ])
        .lean();

      resolve(businessUnitList);
    });
  }

  async getAppointmentBu(businessUnitId) {
    return new Promise((resolve) => {
      const appointmentIds = User.find({
        parentBussinessUnitId: businessUnitId,
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

      resolve(appointmentIds);
    });
  }

  async getCompanySetup(companyId) {
    return new Promise((resolve) => {
      const companySetup = pageSetting.findOne({ companyId }, { opsGroup: 1 });

      resolve(companySetup);
    });
  }

  async readNew(req, res) {
    try {
      logInfo(`businessunit/read/new API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `businessunit/read/new API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const allBus = [
        ...req.user.planBussinessUnitId,
        ...req.user.viewBussinessUnitId,
        req.user.parentBussinessUnitId,
      ];

      const removeDuplicates = (inputArray) => {
        const ids = [];

        return inputArray.reduce((sum, element) => {
          if (!ids.includes(element.toString())) {
            sum.push(element);
            ids.push(element.toString());
          }

          return sum;
        }, []);
      };

      const where = {
        $or: [
          { 'subSkillSets.0': { $exists: true } },
          { 'mainSkillSets.0': { $exists: true } },
        ],
        status: {
          $in: [1],
        },
        _id: {
          $in: removeDuplicates(allBus),
        },
        sectionId: {
          $exists: true,
        },
      };

      if (req.query.search) {
        where.orgName = { $regex: req.query.search, $options: 'i' };
      }
      
      if (req.body.businessUnitId) {
        where._id = req.body.businessUnitId;
      } else if (req.body.isWebsite) {
        where.status = 1;
      }

      let businessUnitList = await SubSection.find(where)
        .select('_id name status sectionId orgName')
        .populate([
          {
            path: 'sectionId',
            select:
              'name departmentId adminEmail techEmail shiftCancelHours cancelShiftPermission standByShiftPermission status',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
        ])
        .lean();

      businessUnitList = businessUnitList.filter(
        (bu) =>
          !!bu.sectionId &&
          !!bu.sectionId.departmentId &&
          !!bu.sectionId.departmentId.companyId &&
          bu.sectionId.departmentId.companyId._id.toString() ===
            req.user.companyId.toString(),
      );

      logInfo(`businessunit/read/new API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, {
        businessUnitList: businessUnitList != null ? businessUnitList : [],
        parentBussinessUnitId: req.user.parentBussinessUnitId,
        planBussinessUnitId: [],
        viewBussinessUnitId: [],
      });
    } catch (err) {
      logError(`businessunit/read/new API, there is an error`, err.toString());
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // reading bu with pagination
  async readWithPn(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const draw = req.query.draw || 0;
      const allBus = new Set([
        ...req.user.planBussinessUnitId,
        ...req.user.viewBussinessUnitId,
        req.user.parentBussinessUnitId,
      ]);
      const where = {
        status: {
          $in: [1],
        },
        _id: {
          $in: [...allBus],
        },
        sectionId: {
          $exists: true,
        },
      };
      const recordsTotal = await SubSection.count(where).lean();
      const recordsFiltered = recordsTotal;
      let businessUnitList = await SubSection.find(where)
        .skip(skip)
        .limit(limit)
        .select(
          '_id name status cancelShiftPermission standByShiftPermission shiftCancelHours techEmail adminEmail notificRemindHours notificRemindDays appointments sectionId noOfWeek breakInMinutes shiftTimeInMinutes isBreakTime shiftBreak mainSkillSets skillSetTierType plannedHours',
        )
        .populate([
          {
            path: 'sectionId',
            select: 'name departmentId status',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
        ])
        .lean();

      businessUnitList = businessUnitList.filter(
        (bu) =>
          !!bu.sectionId &&
          !!bu.sectionId.departmentId &&
          !!bu.sectionId.departmentId.companyId &&
          bu.sectionId.departmentId.companyId._id.toString() ===
            req.user.companyId.toString(),
      );

      const userPlanBussinessUnitIds = [];
      const userViewBussinessUnitIds = [];

      if (!req.body.businessUnitId) {
        /* To remove null parents (since parents may get disabled) */
        businessUnitList = await _.filter(businessUnitList, async (o) => {
          /* check the BU Id is valid */
          if (
            o.sectionId != null &&
            o.sectionId.departmentId != null &&
            o.sectionId.departmentId.companyId != null
          ) {
            /* filter valid BU id from user plan bu ids */
            if (
              req.user.planBussinessUnitId.findIndex((x) =>
                _.isEqual(x, o._id),
              ) !== -1
            ) {
              userPlanBussinessUnitIds.push(o._id);
            }

            /* filter valid BU id from user view bu ids */
            if (
              req.user.viewBussinessUnitId.findIndex((x) =>
                _.isEqual(x, o._id),
              ) !== -1
            ) {
              userViewBussinessUnitIds.push(o._id);
            }

            return o;
          }

          return null;
        });
      }

      return res.status(201).json({
        draw,
        recordsTotal,
        recordsFiltered,
        parentBussinessUnitId: req.user.parentBussinessUnitId,
        businessUnitList: businessUnitList != null ? businessUnitList : [],
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async readWithPnV2(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      logInfo('readWithPnV2 has been called', req.user._id);
      const { page, search } = req.query;
      let { limit } = req.query;
      const pageNum = page ? parseInt(page, 10) : 0;

      limit = limit ? parseInt(limit, 10) : 10;
      const skip = (pageNum - 1) / limit;
      const allBus = new Set([...req.user.planBussinessUnitId]);
      const where = {
        status: 1,
        _id: {
          $in: [...allBus],
        },
      };

      if (search) {
        where.orgName = {
          $regex: search,
          $options: 'i',
        };
      }

      // name status cancelShiftPermission standByShiftPermission shiftCancelHours techEmail
      // adminEmail notificRemindHours notificRemindDays appointments sectionId noOfWeek breakInMinutes shiftTimeInMinutes
      // isBreakTime shiftBreak mainSkillSets skillSetTierType plannedHours
      const businessUnitList = await SubSection.find(where)
        .skip(skip)
        .limit(limit)
        .select('orgName _id')
        .lean();

      return res.status(200).json({
        businessUnitList: businessUnitList != null ? businessUnitList : [],
      });
    } catch (err) {
      logError('readWithPnV2 has error', err);
      logError('readWithPnV2 has error.stack', err.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getName(data, res) {
    try {
      const businessUnit = await SubSection.findOne({
        _id: data.businessUnitId,
        status: 1,
      })
        .populate({
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
        })
        .lean();
      let businessUnitName = '';

      if (
        businessUnit &&
        businessUnit.sectionId &&
        businessUnit.sectionId.departmentId &&
        businessUnit.sectionId.departmentId.companyId
      ) {
        businessUnitName = `${businessUnit.sectionId.departmentId.companyId.name} >> ${businessUnit.sectionId.departmentId.name} >> ${businessUnit.sectionId.name} >> ${businessUnit.name}`;
      }

      return businessUnitName;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getCategories(id, res) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return __.out(res, 400, 'Invalid ID');
      }

      const businessUnit = await SubSection.findOne({
        _id: id,
        status: 1,
      })
        .select('subCategories')
        .populate({
          path: 'subCategories',
          select: 'name categoryId',
          populate: {
            path: 'categoryId',
            select: 'name subCategories',
          },
        })
        .lean();

      if (!(businessUnit.subCategories && businessUnit.subCategories.length)) {
        return __.out(res, 201, []);
      }

      const categoryData = businessUnit.subCategories.map((x) => {
        const obj = {
          _id: x._id,
          categoryId: x.categoryId._id,
          categoryName: x.categoryId.name,
          name: x.name,
        };

        return obj;
      });

      const categories = new Set(categoryData.map((v) => v.categoryName));
      const result = [];

      for (const c of categories) {
        // Common Category Id
        let categoryId = '';

        for (const elem of categoryData) {
          if (elem.categoryName === c) {
            categoryId = elem.categoryId;
          }
        }
        const subCategories = categoryData
          .filter((v) => v.categoryName === c)
          .map((v) => {
            v.categoryName = undefined;
            return v;
          });

        result.push({
          categoryId,
          category: c,
          subCategories,
        });
      }
      return __.out(res, 201, result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getUsers(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        companyId: req.user.companyId,
        parentBussinessUnitId: req.params.businessUnitId,
        status: 1,
      };

      if (req.query.exclusionAppointmentId) {
        where.appointmentId = {
          $ne: req.query.exclusionAppointmentId,
        };
      }

      const userList = await User.find(where).lean();

      __.log(userList);
      return __.out(res, 201, userList);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async buScheme(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      return SubSection.findOneAndUpdate(
        { _id: req.body.businessUnitId },
        {
          $push: {
            scheme: req.body.schemeId,
          },
        },
        { new: true },
      )
        .then((result) => {
          if (result) {
            return res.json({
              status: 1,
              message: 'Added Successfully',
              data: result,
            });
          }

          return res.json({ status: 2, message: 'BU not found', data: null });
        })
        .catch(() =>
          res.json({
            status: 3,
            message: 'Something went wrong',
            data: null,
          }),
        );
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async buSchemeGet(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      return SubSection.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(req.params.subSectionId),
          },
        },
        { $unwind: '$scheme' },
        {
          $lookup: {
            from: 'schemes',
            localField: 'scheme',
            foreignField: '_id',
            as: 'schemeInfo',
          },
        },
        {
          $project: {
            _id: 1,
            scheme: 1,
            schemeInfo: 1,
          },
        },
      ])
        .then((result) => {
          if (result.length > 0) {
            return res.json({ status: 1, message: 'Data Find', data: result });
          }

          return res.json({ status: 2, message: 'Data not found', data: [] });
        })
        .catch(() =>
          res.json({
            status: 3,
            message: 'Something went wrong',
            data: [],
          }),
        );
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async userScheme(req, res) {
    if (!__.checkHtmlContent(req.body)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    return User.findOneAndUpdate(
      { _id: req.body.userId },
      {
        schemeId: req.body.schemeId,
      },
      { new: true },
    )
      .then((result) => {
        if (result) {
          return res.json({ status: 1, message: 'Added Successfully' });
        }

        return res.json({ status: 2, message: 'User not found', data: null });
      })
      .catch(() =>
        res.json({
          status: 3,
          message: 'Something went wrong',
          data: null,
        }),
      );
  }

  async userSchemeGet(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    return User.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(req.params.userId),
        },
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
        $project: {
          _id: 1,
          schemeId: 1,
          schemeInfo: 1,
        },
      },
    ])
      .then((result) => {
        if (result.length > 0) {
          return res.json({ status: 1, message: 'Data Find', data: result });
        }

        return res.json({ status: 2, message: 'Data not found', data: null });
      })
      .catch(() =>
        res.json({
          status: 3,
          message: 'Something went wrong',
          data: null,
        }),
      );
  }

  async weekNo(req, res) {
    if (!__.checkHtmlContent(req.params)) {
      return __.out(res, 300, `You've entered malicious input`);
    }

    return SubSection.findOne(
      { _id: req.params.businessUnitId },
      { noOfWeek: 1 },
    )
      .then((result) => {
        if (result) {
          return res.json({
            status: 1,
            message: 'BU Data Found',
            data: result,
          });
        }

        return res.json({ status: 2, message: 'BU not found', data: null });
      })
      .catch(() =>
        res.json({
          status: 3,
          message: 'Something went wrong',
          data: null,
        }),
      );
  }

  async getBusinessUnits(req, res) {
    try {
      const query = [
        { $unwind: '$allActiveBusinessUnits' },
        {
          $project: {
            _id: '$allActiveBusinessUnits._id',
            businessUnit: '$allActiveBusinessUnits.businessUnit',
          },
        },
      ];

      if (req.query.onlyPlanBU) {
        query.push({
          $match: {
            _id: {
              $in: req.user.planBussinessUnitId.map((v) =>
                mongoose.Types.ObjectId(v),
              ),
            },
          },
        });
      }

      if (req.query.q) {
        // have to look at filter by name in bu
        query.push({
          $match: {
            businessUnit: {
              $regex: `${req.query.q}`,
              $options: 'is',
            },
          },
        });
      }

      const limit = 10;
      const skip = req.query.page ? parseInt(req.query.page, 10) * limit : 0;
      const subSections = await MasterBUTable.aggregate([
        ...query,
        { $skip: skip },
        { $limit: limit },
      ]);

      const count = await MasterBUTable.aggregate([
        ...query,
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]);
      const countFiltered = count.length ? count[0].count : 0;

      if (req.query.onlyPlanBU) {
        return __.out(res, 201, { items: subSections, countFiltered });
      }

      return __.out(res, 201, subSections);
    } catch (error) {
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getAppointments(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let bu = [];

      if (
        'planBussinessUnitId' in req.body &&
        Array.isArray(req.body.planBussinessUnitId) &&
        req.body.planBussinessUnitId.length
      ) {
        bu = req.body.planBussinessUnitId.map((val) =>
          mongoose.Types.ObjectId(val),
        );
      } else {
        bu = req.user.planBussinessUnitId.map((val) =>
          mongoose.Types.ObjectId(val),
        );
      }

      const appointments = await SubSection.aggregate([
        {
          $match: {
            _id: { $in: bu },
            status: 1,
          },
        },
        {
          $project: { appointments: 1 },
        },
        {
          $unwind: '$appointments',
        },
        {
          $group: {
            _id: null,
            appointments: {
              $addToSet: '$appointments',
            },
          },
        },
        {
          $unwind: '$appointments',
        },
        {
          $lookup: {
            from: 'appointments',
            localField: 'appointments',
            foreignField: '_id',
            as: 'appointment',
          },
        },
        {
          $unwind: '$appointment',
        },
        {
          $group: {
            _id: '$appointment._id',
            name: { $first: '$appointment.name' },
          },
        },
      ]);

      return __.out(res, 201, appointments);
    } catch (error) {
      __.log(error);
      return __.out(res, 201, 'Something went wrong try later');
    }
  }

  async getSkillSets(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const sub = await SubSection.aggregate([
        {
          $match: {
            _id: {
              $in: req.user.planBussinessUnitId.map((val) =>
                mongoose.Types.ObjectId(val),
              ),
            },
          },
        },
        {
          $project: { subSkillSets: 1 },
        },
        {
          $unwind: '$subSkillSets',
        },
        {
          $group: {
            _id: null,
            subskillSets: {
              $addToSet: '$subSkillSets',
            },
          },
        },
      ]);

      if (sub.length && sub[0].subskillSets.length) {
        const allSub = await SubSkillSet.aggregate([
          {
            $match: {
              _id: {
                $in: sub[0].subskillSets,
              },
            },
          },
          {
            $lookup: {
              from: 'skillsets',
              localField: 'skillSetId',
              foreignField: '_id',
              as: 'skillset',
            },
          },
          {
            $unwind: '$skillset',
          },
          {
            $project: {
              'skillset._id': 1,
              'skillset.name': 1,
              name: 1,
            },
          },
        ]);
        const allData = [];

        for (const subData of allSub) {
          const index = allData.findIndex(
            (data) => data._id === subData.skillset._id,
          );

          if (index === -1) {
            const { _id, name } = subData.skillset;
            const obj = { _id, name };

            obj.subSkillSets = [{ _id: subData._id, name: subData.name }];
            allData[allData.length] = obj;
          } else {
            allData[index].subSkillSets.push({
              _id: subData._id,
              name: subData.name,
            });
          }
        }
        return __.out(res, 201, allData);
      }

      return __.out(res, 201, []);
    } catch (error) {
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  // Added by TJ
  async updateBuShiftScheme(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`businessunit/updateBuShiftScheme  API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `businessunit/updateBuShiftScheme  API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'businessUnitId',
      ]);

      if (requiredResult.status === false) {
        logError(
          `businessunit/updateBuShiftScheme  API, Required fields missing `,
          requiredResult.missingFields,
        );
        logError(
          `businessunit/updateBuShiftScheme  API, request payload `,
          req.body,
        );
        return __.out(res, 400, requiredResult.missingFields);
      }

      if (!req.body.noOfWeek) {
        req.body.noOfWeek = 0;
      }

      const updateData = {
        subSkillSets: req.body.subSkillSets,
        mainSkillSets: req.body.mainSkillSets,
        skillSetTierType: req.body.skillSetTierType,
        reportingLocation: req.body.locations,
        subCategories: req.body.subCategories,
        originalSchemeEdit: req.body.originalSchemeEdit,
        noOfWeek: req.body.noOfWeek,
        plannedHours: req.body.plannedHours,
        standByShiftPermission: req.body.standByShiftPermission,
        shiftCancelHours: req.body.shiftCancelHours || 0,
        cancelShiftPermission: req.body.cancelShiftPermission,
        status: req.body.status,
        cutOffDaysForBookingAndCancelling:
          req.body.cutOffDaysForBookingAndCancelling || '',
      };

      // START -Dipali adding new keys in subSection for locking timesheet in that time
      if (req.body.breakInMinutes) {
        updateData.breakInMinutes = req.body.breakInMinutes;
      }

      if (req.body.shiftTimeInMinutes) {
        updateData.shiftTimeInMinutes = req.body.shiftTimeInMinutes;
      }

      if (req.body.isBreakTime) {
        updateData.isBreakTime = req.body.isBreakTime;
      }

      if (req.body.shiftBreak) {
        updateData.shiftBreak = req.body.shiftBreak;
      }

      // END -Dipali adding new keys in subSection for locking timesheet in that time
      if (req.body.shiftCancelHours) {
        updateData.shiftCancelHours = req.body.shiftCancelHours;
      }

      if (req.body.notificRemindHours) {
        updateData.notificRemindHours = req.body.notificRemindHours;
      }

      if (req.body.appointments) {
        updateData.appointments = req.body.appointments;
      }

      if (req.body.reportingLocationType) {
        updateData.reportingLocationType = req.body.reportingLocationType;
      }

      if (req.body.isCheckInEnabled) {
        updateData.isCheckInEnabled = req.body.isCheckInEnabled;
      }

      if (req.body.isProximityEnabled) {
        updateData.isProximityEnabled = req.body.isProximityEnabled;
      }

      if (req.body.reportingLocationRadius) {
        updateData.proximity = req.body.reportingLocationRadius;
      }

      if (req.body.geoReportingLocation) {
        const locationName = [];
        const reportLocationId = [];

        if (req.body.geoReportingLocation.length) {
          req.body.geoReportingLocation.forEach((location) => {
            locationName.push({ name: location });
          });
        }

        const response = await GeoReportingLocation.insertMany(locationName);

        response.forEach((locationId) => {
          reportLocationId.push(mongoose.Types.ObjectId(locationId._id));
        });
        updateData.geoReportingLocation = reportLocationId;
      }

      await SubSection.findOneAndUpdate(
        {
          _id: req.body.businessUnitId,
          status: {
            $ne: 3,
          },
        },
        {
          $set: updateData,
        },
        {
          new: true,
        },
      );

      const systemAdminRoles = await Role.find({
        companyId: req.user.companyId,
        name: 'System Admin',
      }).lean();

      const systemAdminRolesId = systemAdminRoles.map((x) => x._id);
      const businessUnitObjectID = mongoose.Types.ObjectId(
        req.body.businessUnitId,
      );

      await User.update(
        {
          role: {
            $in: systemAdminRolesId,
          },
          companyId: req.user.companyId,
        },
        {
          $addToSet: {
            planBussinessUnitId: businessUnitObjectID,
            viewBussinessUnitId: businessUnitObjectID,
          },
        },
        {
          multi: true,
        },
      );

      delete req.body.businessUnitId;
      logInfo(`businessunit/updateBuShiftScheme  API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return this.read(req, res);
    } catch (err) {
      logError(
        `businessunit/updateBuShiftScheme  API, there is an error`,
        err.toString(),
      );
      return __.out(res, 500);
    }
  }

  async getBusinessUnitDetails(req, res) {
    try {
      const { businessUnitId } = req.body;

      if (businessUnitId) {
        const response = await SubSection.findById(
          {
            _id: businessUnitId,
            status: {
              $ne: 3,
            },
          },
          ['shiftTimeInMinutes'],
        );

        return __.out(res, 201, { response });
      }

      return __.out(res, 303, 'missing Business Unit Id');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async masterBUTableUpdate(companyId) {
    try {
      companyId = companyId || '5a9d162b36ab4f444b4271c8'; // Default SATS as Company
      // Company Id Based

      const query = [
        {
          $match: {
            status: 1,
          },
        },
        {
          $lookup: {
            from: 'sections',
            localField: 'sectionId',
            foreignField: '_id',
            as: 'section',
          },
        },
        {
          $unwind: '$section',
        },
        {
          $match: {
            'section.status': 1,
          },
        },
        {
          $project: {
            name: 1,
            'section.name': 1,
            'section.departmentId': 1,
            sectionId: 1,
          },
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
          $match: {
            'department.companyId': mongoose.Types.ObjectId(companyId),
          },
        },
        {
          $project: {
            name: 1,
            'section.name': 1,
            'department.name': 1,
            'department.companyId': 1,
            sectionId: 1,
            'department.sections': 1,
          },
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
            businessUnit: {
              $concat: [
                '$company.name',
                '>',
                '$department.name',
                '>',
                '$section.name',
                '>',
                '$name',
              ],
            },
          },
        },
      ];
      const allActiveBusinessUnits = await SubSection.aggregate([
        ...query,
        {
          $sort: {
            businessUnit: 1,
          },
        },
      ]);
      const vFind = await MasterBUTable.findOne({ companyId })
        .select('version')
        .lean();
      const setter = {
        companyId,
        allActiveBusinessUnits,
        version: vFind ? vFind.version + 1 : 1,
      };

      return await MasterBUTable.update(
        { companyId },
        { $set: setter },
        { upsert: true },
      );
    } catch (err) {
      __.log(err);
      return __.out('Something went wrong');
    }
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const allBus = new Set([
        ...req.user.planBussinessUnitId,
        ...req.user.viewBussinessUnitId,
        req.user.parentBussinessUnitId,
      ]);
      const where = {
        status: {
          $in: [1],
        },
        _id: {
          $in: [...allBus],
        },
        sectionId: {
          $exists: true,
        },
      };

      if (req.body.businessUnitId) {
        where._id = req.body.businessUnitId;
      } else if (req.body.isWebsite) {
        where.status = 1;
      }

      let businessUnitList = await SubSection.find(where, { orgName: 1 }); // .select('orgName')

      businessUnitList = businessUnitList.filter((bu) => bu.orgName !== null);

      return __.out(res, 201, {
        businessUnitList: businessUnitList != null ? businessUnitList : [],
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async addOrgname(orgNameList) {
    const promiseData = [];
    const orgNameListCall = async (sub) => {
      await SubSection.update(
        {
          _id: sub._id,
        },
        {
          orgName: sub.orgName,
        },
      );
    };

    for (const sub of orgNameList) {
      promiseData.push(orgNameListCall(sub));
    }

    await Promise.all(promiseData);
  }

  async orgnameScript(req, res) {
    try {
      const businessUnitList = await SubSection.find()
        .select('name sectionId')
        .populate([
          {
            path: 'sectionId',
            select: 'name departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
        ])
        .lean();
      const orgNameList = [];

      businessUnitList.forEach((subSection) => {
        if (
          subSection.sectionId &&
          subSection.sectionId.departmentId &&
          subSection.sectionId.departmentId.companyId.name
        ) {
          subSection.orgName = `${subSection.sectionId.departmentId.companyId.name} > ${subSection.sectionId.departmentId.name} > ${subSection.sectionId.name} > ${subSection.name}`;
          orgNameList.push({
            orgName: `${subSection.sectionId.departmentId.companyId.name} > ${subSection.sectionId.departmentId.name} > ${subSection.sectionId.name} > ${subSection.name}`,
            _id: subSection._id,
          });
        }
      });
      this.addOrgname(orgNameList);
      return __.out(res, 201, {
        businessUnitList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async planBUAddedShiftSetup(req, res) {
    try {
      const allBus = new Set([
        ...req.user.planBussinessUnitId,
        ...req.user.viewBussinessUnitId,
        req.user.parentBussinessUnitId,
      ]);
      const where = {
        $or: [
          { 'subSkillSets.0': { $exists: true } },
          { 'mainSkillSets.0': { $exists: true } },
        ],
        status: {
          $in: [1],
        },
        _id: {
          $in: [...allBus],
        },
        sectionId: {
          $exists: true,
        },
      };

      const businessUnitList = await SubSection.find(where).select('orgName');

      return __.out(res, 201, {
        businessUnitList: businessUnitList != null ? businessUnitList : [],
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getBusinessUnitSetting(req, res) {
    try {
      const result = await SubSection.findOne({
        _id: req.params.businessUnitId,
      }).select('proximity isCheckInEnabled isProximityEnabled');

      return res.json({ success: true, result });
    } catch (error) {
      return res.error(error);
    }
  }

  async getSingleGeoLocation(req, res) {
    try {
      const result = await SubSection.findOne({
        _id: req.params.businessUnitId,
      })
        .select('proximity isCheckInEnabled isProximityEnabled')
        .populate([
          {
            path: 'geoReportingLocation',
            select: 'name status',
          },
        ]);

      return res.json({ success: true, result });
    } catch (error) {
      return res.error(error);
    }
  }
}
const businessUnit = new BusinessUnitController();

module.exports = businessUnit;
