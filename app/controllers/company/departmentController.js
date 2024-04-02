// Controller Code Starts here
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Department = require('../../models/department');
const SubSection = require('../../models/subSection');
const companyController = require('./companyController');
const businessUnitController = require('./businessUnitController');
const __ = require('../../../helpers/globalFunctions');

class DepartmentController {
  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
        'companyId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const escapedName = req.body.name
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

      const duplicate = await Department.count({
        name: {
          $regex: `^${escapedName}$`,
          $options: 'i',
        },
        status: { $nin: 3 },
        companyId: req.user.companyId,
      });

      if (duplicate !== 0) {
        return __.out(res, 300, 'Department name already exists');
      }

      const insert = req.body;
      // create new model
      const insertedDepartment = await new Department(insert).save();

      // save model to MongoDB
      req.body.departmentId = insertedDepartment._id;
      const params = {
        departmentId: insertedDepartment._id,
        companyId: req.body.companyId,
      };

      companyController.push(
        params,
        res,
      ); /* push generated city id in state table (field name : departmentIds) */
      businessUnitController.masterBUTableUpdate(req.user.companyId);
      return this.read(
        req,
        res,
      ); /* calling read fn with departmentId(last insert id). it calls findOne fn in read */
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const departmentIds = await __.getCompanyBU(
        req.user.companyId,
        'department',
      );
      const where = {
        _id: {
          $in: departmentIds,
        },
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.departmentId) {
        where._id = req.body.departmentId;
        findOrFindOne = Department.findOne(where);
      } else findOrFindOne = Department.find(where);

      const departments = await findOrFindOne
        .populate({
          path: 'companyId',
          select: '_id name',
        })
        .lean();

      return __.out(res, 201, {
        departments,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readWithPn(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // let page = !!req.body.page ? parseInt(req.body.page) * 10 : 0; // skip from department dropdown
      // page = page ? page : parseInt(req.body.start); // skip from department table
      const query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        status: {
          $in: [1, 2],
        },
      };
      const recordsTotal = await Department.count(query);

      if (req.body.q !== undefined) {
        query.name = {
          $regex: req.body.q.toString(),
          $options: 'i',
        };
      }

      // const recordsFiltered = await Department.count(query);
      const departments = await Department.find(query, {
        companyId: 0,
        status: 0,
      }).lean();
      const countFiltered = await Department.count(query);

      if (Object.keys(req.body).includes('start')) {
        departments.forEach((d, i) => {
          d.sno = req.body.start + i + 1;
        });
      }

      return res.status(201).json({ departments, countFiltered, recordsTotal });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
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

      const { departmentId, name, companyId } = req.body;

      const requiredResult = await __.checkRequiredFields(req, [
        'departmentId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Department.findOne({
        _id: departmentId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid departmentId');
      }

      const escapedName = name
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

      const duplicate = await Department.count({
        name: {
          $regex: `^${escapedName}$`,
          $options: 'i',
        },
        status: { $nin: 3 },
        companyId: req.user.companyId,
      });

      if (duplicate !== 0) {
        return __.out(res, 300, 'Department name already exists');
      }

      let isCompanyEdited = false;

      if (companyId && doc.companyId !== companyId) {
        isCompanyEdited = true;
        const params = {
          departmentId,
          companyId: doc.companyId /* existing companyId */,
        };

        companyController.pull(
          params,
          res,
        ); /* pull this city id in from existing state (field name : departmentIds) */
      }

      const sectionDetails = await Department.findOne({
        _id: departmentId,
        status: {
          $ne: 3,
        },
      })
        .select('name orgName')
        .populate({
          path: 'sections',
          select: 'name',
          populate: {
            path: 'subSections',
            select: 'orgName',
          },
        })
        .lean();

      if (sectionDetails && sectionDetails.sections) {
        const promiseData1 = [];
        const sectionDetailsCall = async (section) => {
          const promiseData = [];
          const subSectionListCall = async (subSection) => {
            let orgName = subSection.orgName.split('>');

            orgName[1] = ` ${name.trim()} `;
            orgName = orgName.join('>');
            await Department.update({ _id: departmentId }, { name: orgName });
            await SubSection.update({ _id: subSection._id }, { orgName });
          };

          for (const subSection of section.subSections) {
            promiseData.push(subSectionListCall(subSection));
          }

          await Promise.all(promiseData);
        };

        for (const section of sectionDetails.sections) {
          promiseData1.push(sectionDetailsCall(section));
        }

        await Promise.all(promiseData1);
      }

      doc.set(req.body);
      const result = await doc.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      if (isCompanyEdited) {
        const params = {
          departmentId,
          companyId /* current companyId */,
        };

        companyController.push(
          params,
          res,
        ); /* push generated city id in state table (field name : departmentIds) */
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
        'departmentId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Department.findOne({
        _id: req.body.departmentId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid departmentId');
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

      pushJson.sections = mongoose.Types.ObjectId(params.sectionId);
      const result = await Department.findOneAndUpdate(
        {
          _id: params.departmentId,
        },
        {
          $addToSet: pushJson,
        },
      );

      __.log(result);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async pull(params, res) {
    try {
      const pullJson = {};

      pullJson.sections = mongoose.Types.ObjectId(params.sectionId);
      const result = await Department.findOneAndUpdate(
        {
          _id: params.departmentId,
        },
        {
          $pull: pullJson,
        },
      );

      __.log(result);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}
const department = new DepartmentController();

module.exports = department;
