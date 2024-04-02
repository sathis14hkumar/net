// Controller Code Starts here
const BuTemplate = require('../../models/buTemplate');
const __ = require('../../../helpers/globalFunctions');

class BuTemplateController {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'role',
        'appointments',
        'status',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const insert = req.body;

      insert.companyId = req.user.companyId;
      await new BuTemplate(insert).save();

      return __.out(res, 201, 'Butemplate Created Successfully');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      const where = {
        companyId: req.user.companyId,
        status: 1,
      };
      const buTemplatedata = await BuTemplate.find(where)
        .populate({
          path: 'subCategories',
          populate: {
            path: 'categoryId',
          },
        })
        .populate({
          path: 'subSkillSets',
          populate: {
            path: 'skillSetId',
          },
        })
        .populate({
          path: 'reportingLocation',
        })
        .populate({
          path: 'appointments',
        })
        .populate({
          path: 'role',
        })
        .lean();

      return __.out(res, 201, {
        data: buTemplatedata,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }
}
const buTemplate = new BuTemplateController();

module.exports = buTemplate;
