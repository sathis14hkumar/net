// Controller Code Starts here
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const SubSection = require('../../models/subSection');
const businessUnitController = require('./businessUnitController');
const Channel = require('../../models/channel');
const Wall = require('../../models/wall');
const User = require('../../models/user');
const sectionController = require('./sectionController');
const __ = require('../../../helpers/globalFunctions');
const Section = require('../../models/section');

class SubSectionController {
  async create(req, res) {
    try {
      const { name, sectionId } = req.body;
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'sectionId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const escapedName = name
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

      const duplicate = await SubSection.count({
        name: {
          $regex: `^${escapedName}$`,
          $options: 'i',
        },
        status: { $nin: 3 },
        sectionId,
      });

      if (duplicate !== 0) {
        return __.out(res, 300, 'Subsection name already exists');
      }

      const subSection = await Section.findOne({
        _id: sectionId,
      })
        .select('name')
        .populate({
          path: 'departmentId',
          select: 'name',
          populate: {
            path: 'companyId',
            select: 'name',
          },
        })
        .lean();
      const orgName = `${subSection.departmentId.companyId.name} > ${subSection.departmentId.name} > ${subSection.name} > ${name}`;

      const insert = {
        name,
        sectionId,
        status: 1,
        orgName,
      };
      // create new model
      const insertedSubSection = await new SubSection(insert).save();

      // save model to MongoDB
      if (insertedSubSection && insertedSubSection._id) {
        this.updatePlanBussinessUnitId(req, insertedSubSection._id);
      }

      req.body.subSectionId = insertedSubSection._id;
      const params = {
        subSectionId: insertedSubSection._id,
        sectionId,
      };

      sectionController.push(
        params,
        res,
      ); /* push generated city id in state table (field name : subSectionIds) */
      const buIds = await User.count({
        businessUnitId: insertedSubSection._id,
      });

      if (buIds === 0) {
        let findChannelIds = await Channel.find({});

        findChannelIds = findChannelIds.filter((channel) =>
          channel.userDetails.some((a) => a.allBuToken),
        );

        findChannelIds = findChannelIds.map((v) =>
          mongoose.Types.ObjectId(v._id),
        );

        const promiseData = [];
        const channelIdsListCall = async (channelIds) => {
          await Channel.update(
            {
              _id: channelIds,
              'userDetails.allBuToken': true,
            },
            {
              $addToSet: {
                'userDetails.$.businessUnits': insertedSubSection._id,
              },
            },
            {
              new: true,
            },
          );
        };

        for (const channelIds of findChannelIds) {
          promiseData.push(channelIdsListCall(channelIds));
        }

        await Promise.all(promiseData);
        // wall buIds inserted....
        let findWallIds = await Wall.find({});

        findWallIds = findWallIds.filter((wall) =>
          wall.assignUsers.some((a) => a.allBuToken),
        );

        findWallIds = findWallIds.map((v) => mongoose.Types.ObjectId(v._id));

        const promiseData1 = [];
        const wallsIdsListCall = async (wallsIds) => {
          await Wall.update(
            {
              _id: wallsIds,
              'assignUsers.allBuToken': true,
            },
            {
              $addToSet: {
                'assignUsers.$.businessUnits': insertedSubSection._id,
              },
            },
            {
              new: true,
            },
          );
        };

        for (const wallsIds of findWallIds) {
          promiseData1.push(wallsIdsListCall(wallsIds));
        }

        await Promise.all(promiseData1);
      }

      businessUnitController.masterBUTableUpdate(req.user.companyId);
      // this.read(req, res); /*calling read fn with subSectionId(last insert id). it calls findOne fn in read */
      return __.out(res, 201, 'Business Unit created successfully');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async updatePlanBussinessUnitId(req, planBussinessUnitId) {
    const userDetails = await User.findOne({
      companyId: req.user.companyId,
      _id: req.user._id,
    }).select('planBussinessUnitId');

    if (userDetails) {
      userDetails.planBussinessUnitId.push(planBussinessUnitId);
      await User.update(
        { companyId: req.user.companyId, _id: req.user._id },
        { planBussinessUnitId: userDetails.planBussinessUnitId },
      );
    }
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const subSectionIds = await __.getCompanyBU(
        req.user.companyId,
        'subsection',
      );
      const where = {
        _id: {
          $in: subSectionIds,
        },
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };

      if (req.body.sectionId) {
        where.sectionId = req.body.sectionId;
      }

      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.subSectionId) {
        where._id = req.body.subSectionId;
        findOrFindOne = SubSection.findOne(where);
      } else {
        findOrFindOne = SubSection.find(where);
      }

      const subSections = await findOrFindOne
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

      return __.out(res, 201, {
        subSections,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { subSectionId, sectionId, name } = req.body;

      const requiredResult = await __.checkRequiredFields(
        req,
        ['subSectionId'],
        'subSection',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await SubSection.findOne({
        _id: subSectionId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid subSectionId');
      }

      /* Check for duplicate name */
      let { orgName } = doc;

      if (sectionId && name) {
        orgName = orgName.split('>');
        orgName[3] = ` ${name.trim()}`;
        doc.orgName = orgName.join('>');

        const escapedName = name
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

        const query = {
          name: {
            $regex: `^${escapedName}$`,
            $options: 'i',
          },
          status: 1,
          sectionId,
        };
        const duplicate = await SubSection.count(query);

        if (duplicate !== 0) {
          return __.out(res, 300, 'Subsection name already exists');
        }
      }

      let isSectionEdited = false;

      if (sectionId && doc.sectionId !== sectionId) {
        isSectionEdited = true;
        const params = {
          subSectionId,
          sectionId: doc.sectionId /* existing sectionId */,
        };

        sectionController.pull(
          params,
          res,
        ); /* pull this city id in from existing state (field name : subSectionIds) */
      }

      doc.set(req.body);
      const result = await doc.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      if (isSectionEdited) {
        const params = {
          subSectionId,
          sectionId /* current sectionId */,
        };

        sectionController.push(
          params,
          res,
        ); /* push generated city id in state table (field name : subSectionIds) */
      }

      businessUnitController.masterBUTableUpdate(req.user.companyId);
      return this.read(req, res);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async delete(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'subSectionId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await SubSection.findOne({
        _id: req.body.subSectionId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid subSectionId');
      }

      doc.status = 3;
      const result = await doc.save();

      businessUnitController.masterBUTableUpdate(req.user.companyId);
      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      return __.out(res, 200);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async push(params, res) {
    try {
      const pushJson = {};

      if (params.subSkillSetId)
        pushJson.subSkillSets = mongoose.Types.ObjectId(params.subSkillSetId);
      else if (params.reportingLocationId)
        pushJson.reportingLocations = mongoose.Types.ObjectId(
          params.reportingLocationId,
        );

      const result = await SubSection.findOneAndUpdate(
        {
          _id: params.subSectionId,
        },
        {
          $addToSet: pushJson,
        },
      );

      __.log(result);
      return result;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async pull(params, res) {
    try {
      const pullJson = {};

      if (params.subSkillSetId)
        pullJson.subSkillSets = mongoose.Types.ObjectId(params.subSkillSetId);
      else if (params.reportingLocationId)
        pullJson.reportingLocations = mongoose.Types.ObjectId(
          params.reportingLocationId,
        );

      const result = await SubSection.findOneAndUpdate(
        {
          _id: params.subSectionId,
        },
        {
          $pull: pullJson,
        },
      );

      return __.log(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // async getCategories(id, res) {
  //   try {
  //     if (!mongoose.Types.ObjectId.isValid(id)) {
  //       return res.status(400).json({
  //         message: 'Invalid ID',
  //       });
  //     }

  //     const businessUnit = await SubSection.find({ _id: id })
  //       .select('subCategories')
  //       .populate({
  //         path: 'subCategories',
  //         populate: {
  //           path: 'categoryId',
  //           select: 'name subCategories',
  //         },
  //       })
  //       .lean();

  //     return __.out(res, 201, businessUnit);
  //   } catch (err) {
  //     __.log(err);
  //     return __.out(res, 500);
  //   }
  // }
}

module.exports = new SubSectionController();
