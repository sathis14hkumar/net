// Controller Code Starts here
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Section = require('../../models/section');
const departmentController = require('./departmentController');
const businessUnitController = require('./businessUnitController');
const SubSection = require('../../models/subSection');
const __ = require('../../../helpers/globalFunctions');

class SectionController {
  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
        'departmentId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const escapedName = req.body.name
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

      const duplicate = await Section.count({
        name: {
          $regex: `^${escapedName}$`,
          $options: 'i',
        },
        status: { $nin: 3 },
        departmentId: req.body.departmentId,
      });

      if (duplicate !== 0) {
        return __.out(res, 300, 'Section name already exists');
      }

      const insert = req.body;
      // create new model
      const insertedSection = await new Section(insert).save();

      // save model to MongoDB
      req.body.sectionId = insertedSection._id;
      const params = {
        sectionId: insertedSection._id,
        departmentId: req.body.departmentId,
      };

      departmentController.push(
        params,
        res,
      ); /* push generated city id in state table (field name : sectionIds) */
      businessUnitController.masterBUTableUpdate(req.user.companyId);
      return this.read(
        req,
        res,
      ); /* calling read fn with sectionId(last insert id). it calls findOne fn in read */
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      const sectionIds = await __.getCompanyBU(req.user.companyId, 'section');
      const where = {
        _id: {
          $in: sectionIds,
        },
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      let findOrFindOne;

      if (req.body.departmentId) {
        where.departmentId = req.body.departmentId;
      }

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.sectionId) {
        where._id = req.body.sectionId;
        findOrFindOne = Section.findOne(where);
      } else findOrFindOne = Section.find(where);

      const sections = await findOrFindOne
        .populate({
          path: 'departmentId',
          select: 'name',
          populate: {
            path: 'companyId',
            select: 'name',
          },
        })
        .lean();

      return __.out(res, 201, {
        sections,
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

      const requiredResult = await __.checkRequiredFields(req, ['sectionId']);

      const { sectionId, name, departmentId } = req.body;

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Section.findOne({
        _id: sectionId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid sectionId');
      }

      const escapedName = name
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

      const duplicate = await Section.count({
        name: {
          $regex: `^${escapedName}$`,
          $options: 'i',
        },
        status: { $nin: 3 },
        departmentId: doc.departmentId,
      });

      if (duplicate !== 0) {
        return __.out(res, 300, 'Section name already exists');
      }

      let isDepartmentEdited = false;

      if (departmentId && doc.departmentId !== departmentId) {
        isDepartmentEdited = true;
        const params = {
          sectionId,
          departmentId: doc.departmentId /* existing departmentId */,
        };

        departmentController.pull(
          params,
          res,
        ); /* pull this city id in from existing state (field name : sectionIds) */
      }

      const sectionDetails = await Section.findOne({
        _id: sectionId,
      })
        .select('orgName')
        .populate({
          path: 'subSections',
          select: 'orgName',
        })
        .lean();

      if (sectionDetails && sectionDetails.subSections) {
        const promiseData = [];
        const subSecDetailListCall = async (subSecDetail) => {
          let orgName = subSecDetail.orgName.split('>');

          orgName[2] = ` ${name.trim()} `;
          orgName = orgName.join('>');
          await SubSection.update({ _id: subSecDetail._id }, { orgName });
        };

        for (const subSecDetail of sectionDetails.subSections) {
          promiseData.push(subSecDetailListCall(subSecDetail));
        }

        await Promise.all(promiseData);
      }

      doc.set(req.body);
      const result = await doc.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      if (isDepartmentEdited) {
        const params = {
          sectionId,
          departmentId /* current departmentId */,
        };

        departmentController.push(
          params,
          res,
        ); /* push generated city id in state table (field name : sectionIds) */
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

      const requiredResult = await __.checkRequiredFields(req, ['sectionId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Section.findOne({
        _id: req.body.sectionId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid sectionId');
      }

      doc.status = 3;
      const result = await doc.save();

      businessUnitController.masterBUTableUpdate(req.user.companyId);
      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      return __.out(res, 200, result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async push(params, res) {
    try {
      const pushJson = {};

      pushJson.subSections = mongoose.Types.ObjectId(params.subSectionId);
      await Section.findOneAndUpdate(
        {
          _id: params.sectionId,
        },
        {
          $addToSet: pushJson,
        },
      );
      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async pull(params, res) {
    try {
      const pullJson = {};

      pullJson.subSections = mongoose.Types.ObjectId(params.subSectionId);
      await Section.findOneAndUpdate(
        {
          _id: params.sectionId,
        },
        {
          $pull: pullJson,
        },
      );
      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
module.exports = new SectionController();
