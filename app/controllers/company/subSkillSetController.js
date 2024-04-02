// Controller Code Starts here
const { validationResult } = require('express-validator');
const SubSkillSet = require('../../models/subSkillSet');
const skillSetController = require('./skillSetController');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class SubSkillSetController {
  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`subskillset/create API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `subskillset/create API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
        'skillSetId',
      ]);

      if (requiredResult.status === false) {
        logError(
          `subskillset/create API, Required fields missing `,
          requiredResult.missingFields,
        );
        logError(`subskillset/create API, request payload `, req.body);
        return __.out(res, 400, requiredResult.missingFields);
      }

      const insert = req.body;
      const insertedSubSkillSet = await new SubSkillSet(insert).save();

      req.body.subSkillSetId = insertedSubSkillSet._id;
      const params = {
        subSkillSetId: insertedSubSkillSet._id,
        skillSetId: req.body.skillSetId,
      };

      skillSetController.push(
        params,
        res,
      ); /* push generated city id in state table (field name : subSkillSetIds) */
      logInfo(`subskillset/create API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return this.read(
        req,
        res,
      ); /* calling read fn with subSkillSetId(last insert id). it calls findOne fn in read */
    } catch (err) {
      logError(`subskillset/create API, there is an error`, err.toString());
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

      if (req.body.skillSetId) {
        where.skillSetId = req.body.skillSetId;
      }

      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.subSkillSetId) {
        where._id = req.body.subSkillSetId;
        findOrFindOne = SubSkillSet.findOne(where);
      } else findOrFindOne = SubSkillSet.find(where);

      const subSkillSets = await findOrFindOne
        .populate({
          path: 'skillSetId',
          select: '_id name',
        })
        .lean();

      return __.out(res, 201, {
        subSkillSets,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`subskillset/update API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        logError(
          `subskillset/update API, You've entered malicious input `,
          req.body,
        );
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'subSkillSetId',
      ]);

      if (requiredResult.status === false) {
        logError(
          `subskillset/update API, Required fields missing `,
          requiredResult.missingFields,
        );
        logError(`subskillset/update API, request payload `, req.body);
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await SubSkillSet.findOne({
        _id: req.body.subSkillSetId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        logError(
          `subskillset/update API, there is an error`,
          'Invalid subSkillSetId',
        );
        return __.out(res, 300, 'Invalid subSkillSetId');
      }

      let isSkillSetEdited = false;

      if (req.body.skillSetId && doc.skillSetId !== req.body.skillSetId) {
        isSkillSetEdited = true;
        const params = {
          subSkillSetId: req.body.subSkillSetId,
          skillSetId: doc.skillSetId /* existing skillSetId */,
        };

        skillSetController.pull(
          params,
          res,
        ); /* pull this city id in from existing state (field name : subSkillSetIds) */
      }

      doc.set(req.body);
      const result = await doc.save();

      if (result === null) {
        logError(
          `subskillset/update API, there is an error`,
          'Something went wrong',
        );
        return __.out(res, 300, 'Something went wrong');
      }

      if (isSkillSetEdited) {
        const params = {
          subSkillSetId: req.body.subSkillSetId,
          skillSetId: req.body.skillSetId /* current skillSetId */,
        };

        skillSetController.push(
          params,
          res,
        ); /* push generated city id in state table (field name : subSkillSetIds) */
      }

      logInfo(`subskillset/update API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return this.read(req, res);
    } catch (err) {
      logError(`subskillset/update API, there is an error`, err.toString());
      return __.out(res, 500);
    }
  }

  async delete(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`subskillset/delete API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'subSkillSetId',
      ]);

      if (requiredResult.status === false) {
        logError(
          `subskillset/delete API, Required fields missing `,
          requiredResult.missingFields,
        );
        logError(`subskillset/delete API, request payload `, req.body);
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await SubSkillSet.findOne({
        _id: req.body.subSkillSetId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        logError(
          `subskillset/delete API, there is an error`,
          'Invalid subSkillSetId',
        );
        return __.out(res, 300, 'Invalid subSkillSetId');
      }

      doc.status = 3;
      const result = await doc.save();

      if (result === null) {
        logError(
          `subskillset/delete API, there is an error`,
          'Something went wrong',
        );
        return __.out(res, 300, 'Something went wrong');
      }

      logInfo(`subskillset/delete API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return __.out(res, 200);
    } catch (err) {
      logError(`subskillset/delete API, there is an error`, err.toString());
      return __.out(res, 500);
    }
  }
}

module.exports = new SubSkillSetController();
