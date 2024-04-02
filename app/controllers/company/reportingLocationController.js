// Controller Code Starts here
const ReportingLocation = require('../../models/reportingLocation');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class ReportingLocationController {
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

      insert.companyId = req.user.companyId;
      // create new model
      const insertedDoc = await new ReportingLocation(insert).save();

      req.body.reportingLocationId = insertedDoc._id;
      return this.read(
        req,
        res,
      ); /* calling read fn with reportingLocationId(last insert id). it calls findOne fn in read */
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      logInfo(`repotinglocation/read API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `repotinglocation/read API, You've entered malicious input `,
          req.body,
        );
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
      if (req.body.reportingLocationId) {
        where._id = req.body.reportingLocationId;
        findOrFindOne = ReportingLocation.findOne(where);
      } else findOrFindOne = ReportingLocation.find(where);

      const reportingLocations = await findOrFindOne.lean();

      logInfo(`repotinglocation/read API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 201, {
        reportingLocations,
      });
    } catch (err) {
      logError(`repotinglocation/read API, there is an error`, err.toString());
      return __.out(res, 500);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'reportingLocationId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await ReportingLocation.findOne({
        _id: req.body.reportingLocationId,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid reportingLocationId');
      }

      doc.set(req.body);
      doc.companyId = req.user.companyId;
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
        'reportingLocationId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const reportingLocationResult = await ReportingLocation.findOne({
        _id: req.body.reportingLocationId,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (reportingLocationResult === null) {
        return __.out(res, 300, 'Invalid reportingLocationId');
      }

      reportingLocationResult.status = 3;
      const result = await reportingLocationResult.save();

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
const reportingLocation = new ReportingLocationController();

module.exports = reportingLocation;
