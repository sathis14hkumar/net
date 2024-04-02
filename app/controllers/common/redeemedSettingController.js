const mongoose = require('mongoose');
const Setting = require('../../models/redeemedSetting');
const __ = require('../../../helpers/globalFunctions');

class RedeemedSettingsController {
  async redeemedLanding(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const landing = {
        landingPage: {
          redeemablePoints: req.body.redeemablePoints,
          pointsOngoing: req.body.pointsOngoing,
          name: req.body.name,
          appointment: req.body.appointment,
          newItem: {
            items: req.body.newItem.items,
            numberOfItems: req.body.newItem.items
              ? req.body.newItem.numberOfItems
              : 0,
            numberOfDays: req.body.newItem.items
              ? req.body.newItem.numberOfDays
              : 0,
          },
          popularItem: {
            items: req.body.popularItem.items,
            numberOfItems: req.body.popularItem.items
              ? req.body.popularItem.numberOfItems
              : 0,
          },
        },
      };

      landing.companyId = req.user.companyId;
      landing.createdBy = req.user._id;
      landing.updatedAt = new Date();
      landing.status = 1;
      const setting = await Setting.updateOne(
        { companyId: mongoose.Types.ObjectId(req.user.companyId), status: 1 },
        landing,
        {
          upsert: 1,
        },
      );

      if (setting) {
        return __.out(res, 200, 'Successfully updated');
      }

      return __.out(res, 300, 'Error while adding landing page');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getSetting(req, res) {
    try {
      const setting = await Setting.aggregate([
        {
          $match: {
            companyId: mongoose.Types.ObjectId(req.user.companyId),
            status: 1,
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $limit: 1,
        },
      ]);

      if (setting.length) {
        return __.out(res, 201, setting[0]);
      }

      return __.out(res, 300, 'No settings found please create new');
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async redeemedCategory(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const category = {};

      category.categoryPage = req.body;
      category.companyId = req.user.companyId;
      category.status = 1;
      const setting = await Setting.updateOne(
        { companyId: mongoose.Types.ObjectId(req.user.companyId), status: 1 },
        category,
        {
          upsert: 1,
        },
      );

      if (setting) {
        return __.out(res, 200, 'Successfully updated');
      }

      return __.out(res, 300, 'Error while adding category page');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async redeemedAddCategory(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const data = req.body;
      const categoryName = await new Setting(data).save();

      if (!categoryName) return __.out(res, 300, 'Error while adding category');

      return __.out(res, 201, categoryName);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async redeemedUpdateCategory(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const data = req.body;
      const updateCategory = await Setting.findByIdAndUpdate(
        req.params.id,
        data,
      );

      if (!updateCategory)
        return __.out(res, 300, 'Error while update category');

      return __.out(res, 201, updateCategory);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async get(req, res) {
    try {
      const settingData = await Setting.find({
        companyId: req.user.companyId,
      }).lean();

      if (!settingData) return __.out(res, 300, 'Oops something went wrong');

      return __.out(res, 201, settingData);
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
}

const redeemedSettings = new RedeemedSettingsController();

module.exports = redeemedSettings;
