// Controller Code Starts here
const { validationResult } = require('express-validator');
const User = require('../../models/user');
const UserField = require('../../models/userField');
const __ = require('../../../helpers/globalFunctions');

class UserFieldController {
  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      __.log(req.body, 'userFields/create');
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'fieldName',
        'type',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const fieldExists = await UserField.findOne({
        fieldName: req.body.fieldName,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (fieldExists) {
        __.log(fieldExists);
        return __.out(res, 300, 'Field Name Already Exists');
      }

      const insertField = {
        fieldName: req.body.fieldName,
        type: req.body.type,
        companyId: req.user.companyId,
        indexNum: req.body.indexNum,
        editable: req.body.editable || false,
      };

      if (req.body.type === 'dropdown') {
        const optionArray = [...new Set(req.body.options)];

        insertField.options = optionArray;
      }

      await new UserField(insertField).save();

      return __.out(res, 200, 'Field Created');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
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

      const requiredResult = await __.checkRequiredFields(req, [
        'fieldId',
        'fieldName',
        'type',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Existing Field Name
      const fieldExists = await UserField.findOne({
        _id: {
          $ne: req.body.fieldId,
        },
        fieldName: req.body.fieldName,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (fieldExists) {
        return __.out(res, 300, 'Field Name Already Exists');
      }

      // Get Field Datas
      const fieldData = await UserField.findOne({
        _id: req.body.fieldId,
        companyId: req.user.companyId,
      });

      if (!fieldData) {
        return __.out(res, 300, 'Field Not Found');
      }

      // Check Field is already assigned or not
      const getUser = await User.find({
        'otherFields.fieldId': fieldData._id,
      });
      let editable = true;

      if (getUser > 0) {
        editable = false;
      }

      // Update Logics
      if (editable === true) {
        fieldData.fieldName = req.body.fieldName;
        fieldData.type = req.body.type;
        fieldData.options = [];
      }

      if (fieldData.type === 'dropdown') {
        // Combine new & old options -> update
        const newOptions = [...new Set(req.body.options)];
        const existOptions = [...new Set(req.body.nonEditableFields)];
        const optionArray = [...existOptions, ...newOptions];

        fieldData.options = optionArray;
      }

      /** Field Name Swaping */
      await UserField.update(
        {
          indexNum: req.body.indexNum,
          companyId: req.user.companyId,
          status: 1,
        },
        {
          $set: {
            indexNum: fieldData.indexNum,
          },
        },
      );

      // Update Current Field
      fieldData.indexNum = req.body.indexNum;
      // Update Editable
      fieldData.editable = req.body.editable || false;
      await fieldData.save();
      return __.out(res, 200, 'Field Updated');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async remove(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Check Field is already assigned or not
      const getUser = await User.find({
        'otherFields.fieldId': req.params.fieldId,
        status: {
          $ne: 3,
        },
      });

      if (getUser > 0) {
        return __.out(res, 300, 'Field is already assigned with users');
      }

      const where = {
        _id: req.params.fieldId,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      const removedField = await UserField.findOneAndUpdate(
        where,
        {
          $set: {
            status: 3,
          },
        },
        {
          new: true,
        },
      ).lean();

      if (!removedField) {
        return __.out(res, 300, 'Field Not Found');
      }

      // decrement 1 index number for fields after that
      await UserField.update(
        {
          companyId: req.user.companyId,
          indexNum: {
            $gt: removedField.indexNum,
          },
        },
        {
          $inc: {
            indexNum: -1,
          },
        },
        {
          multi: true,
        },
      );
      return __.out(res, 201, 'Field deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async read(req, res) {
    try {
      const where = {
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      const fieldList = await UserField.find(where)
        .sort({
          indexNum: 1,
        })
        .lean();

      return __.out(res, 201, {
        total: fieldList.length,
        fieldList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getAll(req, res) {
    try {
      const where = {
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      const data = await this.getAllCustomFields(where, req.query);

      return res.json({ data });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getAllCustomFields(where, { page, limit, search, sortBy, sortWith }) {
    const searchCondition = {};

    if (search) {
      searchCondition.fieldName = { $regex: search, $options: 'i' };
    }

    const [{ metadata, data }] = await UserField.aggregate([
      {
        $match: {
          ...where,
          ...searchCondition,
        },
      },
      {
        $project: {
          _id: 1,
          fieldName: 1,
          type: 1,
          options: 1,
          required: 1,
          editable: 1,
          indexNum: 1,
          status: 1,
        },
      },
      {
        $sort: { [sortWith]: sortBy === 'desc' ? -1 : 1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: (Number(page) - 1) * 10,
            },
            {
              $limit: Number(limit),
            },
          ],
        },
      },
    ]);

    if (data.length) {
      const [{ total: count }] = metadata;

      return { count, data };
    }

    return { count: 0, data: [] };
  }
}
module.exports = new UserFieldController();
