// Controller Code Starts here
const Role = require('../../models/role');
const User = require('../../models/user');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class RoleController {
  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'isFlexiStaff',
        'description',
        'privileges',
        'status',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const insert = req.body;

      insert.companyId = req.user.companyId;
      // create new model
      const doc = await new Role(insert).save();

      // save model to MongoDB
      req.body.roleId = doc._id;
      return this.read(
        req,
        res,
      ); /* calling read fn with roleId(last insert id). it calls findOne fn in read */
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      logInfo(`role/read API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(`role/read API, You've entered malicious input `, req.body);
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        companyId: req.user.companyId,
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.roleId) {
        where._id = req.body.roleId;
        findOrFindOne = Role.findOne(where);
      } else findOrFindOne = Role.find(where);

      const roles = await findOrFindOne.lean();

      logInfo(`role/read API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, { roles });
    } catch (err) {
      logError(`role/read API, there is an error`, err.toString());
      return __.out(res, 500, err);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['roleId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Role.findOne({
        _id: req.body.roleId,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid roleId');
      }

      const userUpdate = await User.updateMany(
        { role: req.body.roleId },
        { $set: { roleUpdate: true } },
      );

      logInfo('During role update user updated', userUpdate);

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

      const requiredResult = await __.checkRequiredFields(req, ['roleId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Role.findOne({
        _id: req.body.roleId,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid roleId');
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
module.exports = new RoleController();
