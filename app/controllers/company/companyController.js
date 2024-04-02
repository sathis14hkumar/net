// Controller Code Starts here
const mongoose = require('mongoose');
const Company = require('../../models/company');
const __ = require('../../../helpers/globalFunctions');

class CompanyController {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const insert = req.body;

      /* Check for duplicate company names */
      const duplicate = await Company.findOne({
        name: insert.name,
      }).lean();

      if (duplicate) {
        return res.status(400).json({
          message: 'Company name already exists',
        });
      }

      const insertedDoc = await new Company(insert).save();

      req.body.companyId = insertedDoc._id;
      return this.read(req, res);
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

      const where = {
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.companyId) {
        where._id = req.body.companyId;
        findOrFindOne = Company.findOne(where);
      } else findOrFindOne = Company.find(where);

      const companies = await findOrFindOne
        .populate({
          path: 'departments',
          select: '_id name sections',
          match: {
            status: {
              $ne: 3,
            },
          },
          populate: {
            path: 'sections',
            select: '_id name subSections',
            match: {
              status: {
                $ne: 3,
              },
            },
            populate: {
              path: 'subSections',
              select: '_id name',
              match: {
                status: {
                  $ne: 3,
                },
              },
            },
          },
        })
        .lean();

      return __.out(res, 201, {
        companies,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['companyId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Company.findOne({
        _id: req.body.companyId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid companyId');
      }

      doc.set(req.body);
      const result = await doc.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      return this.read(req, res);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async delete(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['companyId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const companyResult = await Company.findOne({
        _id: req.body.companyId,
        status: {
          $ne: 3,
        },
      });

      if (companyResult === null) {
        return __.out(res, 300, 'Invalid companyId');
      }

      companyResult.status = 3;
      const result = await companyResult.save();

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
      let addToSetOrSet;

      __.log(params);
      if (params.departmentId) {
        pushJson.departments = mongoose.Types.ObjectId(params.departmentId);
        addToSetOrSet = {
          $addToSet: pushJson,
        };

        const result = await Company.findOneAndUpdate(
          {
            _id: params.companyId,
          },
          addToSetOrSet,
        );

        __.log(result);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async pull(params, res) {
    try {
      const pullJson = {};
      let setOrPull;

      __.log(params);
      if (params.departmentId) {
        pullJson.departments = mongoose.Types.ObjectId(params.departmentId);
        setOrPull = {
          $pull: pullJson,
        };

        const result = await Company.findOneAndUpdate(
          {
            _id: params.companyId,
          },
          setOrPull,
        );

        __.log(result);
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}
const company = new CompanyController();

module.exports = company;
