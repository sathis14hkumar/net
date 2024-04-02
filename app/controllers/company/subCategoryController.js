// Controller Code Starts here
const SubCategory = require('../../models/subCategory');
const Category = require('../../models/category');
const categoryController = require('./categoryController');
const __ = require('../../../helpers/globalFunctions');

class SubCategoryController {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
        'categoryId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const insert = req.body;

      __.log(req.body, 'req.body'); // create new model
      const insertedSubCategory = await new SubCategory(insert).save();

      // save model to MongoDB
      req.body.subCategoryId = insertedSubCategory._id;
      const params = {
        subCategoryId: insertedSubCategory._id,
        categoryId: req.body.categoryId,
      };

      categoryController.push(
        params,
        res,
      ); /* push generated city id in state table (field name : subCategoryIds) */
      return this.read(
        req,
        res,
      ); /* calling read fn with subCategoryId(last insert id). it calls findOne fn in read */
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

      const categoryIds = await this.getCompanyCategory(req);
      const where = {
        categoryId: {
          $in: [...categoryIds],
        },
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.subCategoryId) {
        where._id = req.body.subCategoryId;
        findOrFindOne = SubCategory.findOne(where);
      } else {
        findOrFindOne = SubCategory.find(where);
      }

      const subCategories = await findOrFindOne
        .populate({
          path: 'categoryId',
          select: '_id name',
        })
        .lean();

      return __.out(res, 201, {
        subCategories,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'subCategoryId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await SubCategory.findOne({
        _id: req.body.subCategoryId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid subCategoryId');
      }

      let isCategoryEdited = false;

      if (req.body.categoryId && doc.categoryId !== req.body.categoryId) {
        isCategoryEdited = true;
        const params = {
          subCategoryId: req.body.subCategoryId,
          categoryId: doc.categoryId /* existing categoryId */,
        };

        categoryController.pull(
          params,
          res,
        ); /* pull this city id in from existing state (field name : subCategoryIds) */
      }

      doc.set(req.body);
      const result = await doc.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      if (isCategoryEdited) {
        const params = {
          subCategoryId: req.body.subCategoryId,
          categoryId: req.body.categoryId /* current categoryId */,
        };

        categoryController.push(
          params,
          res,
        ); /* push generated city id in state table (field name : subCategoryIds) */
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
        'subCategoryId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      __.log(req.body, 'SubCategory');
      const doc = await SubCategory.findOne({
        _id: req.body.subCategoryId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid subCategoryId');
      }

      doc.status = 3;
      const result = await doc.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      return __.out(res, 200);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getCompanyCategory(req) {
    const categories = await Category.find({
      companyId: req.user.companyId,
      status: 1,
    });
    const categoryIds = [];

    for (const elem of categories) {
      categoryIds.push(elem._id);
    }
    return categoryIds;
  }

  async getSubCategories(req, res) {
    try {
      const result = await this.getAll(
        {
          categoryId: req.params.categoryId,
        },
        req.query,
      );

      return res.success(result);
    } catch (error) {
      return res.error(error);
    }
  }

  async getAll(condition, { page, limit, search, sortBy, sortWith }) {
    const searchCondition = {};

    if (search) {
      searchCondition.name = new RegExp(search, 'i');
    }

    const count = await SubCategory.countDocuments({
      status: 1,
      ...condition,
      ...searchCondition,
    });
    const data = await SubCategory.find(
      {
        status: 1,
        ...condition,
        ...searchCondition,
      },
      'name status',
      { skip: (page - 1) * limit, limit: parseInt(limit, 10) },
    ).sort({ [sortWith]: sortBy === 'desc' ? -1 : 1 });

    return { count, data };
  }
}
module.exports = new SubCategoryController();
