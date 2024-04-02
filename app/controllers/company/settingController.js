// Controller Code Starts here
const Setting = require('../../models/setting');
const __ = require('../../../helpers/globalFunctions');

class SettingController {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'adminEmail',
        'techEmail',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const insert = req.body;
      // create new model
      const doc = await new Setting(insert).save();

      // save model to MongoDB
      req.body.settingId = doc._id;
      return this.read(
        req,
        res,
      ); /* calling read fn with settingId(last insert id). it calls findOne fn in read */
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
      if (req.body.settingId) {
        where._id = req.body.settingId;
        findOrFindOne = Setting.findOne(where);
      } else findOrFindOne = Setting.find(where);

      const settings = await findOrFindOne.lean();

      return __.out(res, 201, {
        settings,
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

      const requiredResult = await __.checkRequiredFields(req, ['settingId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Setting.findOne({
        _id: req.body.settingId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid settingId');
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

      const requiredResult = await __.checkRequiredFields(req, ['settingId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Setting.findOne({
        _id: req.body.settingId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid settingId');
      }

      doc.status = 3;
      doc.updatedBy = req.user._id;
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
}
module.exports = new SettingController();
