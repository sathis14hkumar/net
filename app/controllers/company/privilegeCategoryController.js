// Controller Code Starts here
const mongoose = require('mongoose');
const PrivilegeCategory = require('../../models/privilegeCategory');
const __ = require('../../../helpers/globalFunctions');

class PrivilegeCategoryController {
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
      // create new model
      const insertedDoc = await new PrivilegeCategory(insert).save();

      req.body.privilegeCategoryId = insertedDoc._id;
      return this.read(
        req,
        res,
      ); /* calling read fn with privilegeCategoryId(last insert id). it calls findOne fn in read */
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
      if (req.body.privilegeCategoryId) {
        where._id = req.body.privilegeCategoryId;
        findOrFindOne = PrivilegeCategory.findOne(where);
      } else findOrFindOne = PrivilegeCategory.find(where);

      const privilegeCategory = await findOrFindOne
        .populate({
          path: 'privileges',
          select: 'name description status additionalAccessRights',
          match: {
            status: {
              $ne: 3,
            },
          },
        })
        .sort({ _id: 1 })
        .lean();

      return __.out(res, 201, {
        privilegeCategory,
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

      const requiredResult = await __.checkRequiredFields(req, [
        'privilegeCategoryId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await PrivilegeCategory.findOne({
        _id: req.body.privilegeCategoryId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid privilegeCategoryId');
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

      const requiredResult = await __.checkRequiredFields(req, [
        'privilegeCategoryId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const privilegeCategoryResult = await PrivilegeCategory.findOne({
        _id: req.body.privilegeCategoryId,
        status: {
          $ne: 3,
        },
      });

      if (privilegeCategoryResult === null) {
        return __.out(res, 300, 'Invalid privilegeCategoryId');
      }

      privilegeCategoryResult.status = 3;
      const result = await privilegeCategoryResult.save();

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
      if (params.privilegeId) {
        pushJson.privileges = mongoose.Types.ObjectId(params.privilegeId);
        addToSetOrSet = {
          $addToSet: pushJson,
        };
        const result = await PrivilegeCategory.findOneAndUpdate(
          {
            _id: params.privilegeCategoryId,
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
      if (params.privilegeId) {
        pullJson.privileges = mongoose.Types.ObjectId(params.privilegeId);
        setOrPull = {
          $pull: pullJson,
        };
        const result = await PrivilegeCategory.findOneAndUpdate(
          {
            _id: params.privilegeCategoryId,
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
const privilegeCategory = new PrivilegeCategoryController();

module.exports = privilegeCategory;
