// Controller Code Starts here
const mongoose = require('mongoose');
const mime = require('mime-types');
const { validationResult } = require('express-validator');
const Scheme = require('../../models/scheme');
const UserLog = require('../../models/userLog');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class SchemeController {
  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`scheme API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      const requiredResult1 = await __.checkRequiredFields(req, [
        'schemeName',
        'schemeDesc',
      ]);

      if (requiredResult1.status === false) {
        logError(
          `scheme API, Required fields missing `,
          requiredResult1.missingFields,
        );
        logError(`scheme API, request payload `, req.body);
        return res.json({
          status: 3,
          result: null,
          msg: 'Please fill the empty fields',
        });
      }

      const schemeIs = req.body;

      if (!schemeIs.schemeName.trim() || !schemeIs.schemeDesc.trim()) {
        logError(
          `scheme API, there is an error`,
          'Please fill the empty fields',
        );
        return res.json({
          status: 3,
          result: null,
          msg: 'Please fill the empty fields',
        });
      }

      if (!schemeIs.companyID) {
        schemeIs.companyID = req.user.companyId;
      }

      schemeIs.createdBy = req.user._id;
      if (schemeIs.isShiftInterval) {
        if (!(schemeIs.shiftIntervalHour || schemeIs.shiftIntervalMins)) {
          logError(`scheme API, there is an error`, 'Interval is missing');
          return res.json({
            status: 3,
            result: null,
            msg: 'Interval is missing',
          });
        }

        if (
          (schemeIs.shiftIntervalHour !== 0 &&
            ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(
              schemeIs.shiftIntervalHour,
            )) ||
          (schemeIs.shiftIntervalMins !== 0 &&
            ![15, 30, 45].includes(schemeIs.shiftIntervalMins))
        ) {
          logError(
            `scheme API, there is an error`,
            'Interval contain wrong value',
          );
          return res.json({
            status: 3,
            result: null,
            msg: 'Interval contain wrong value',
          });
        }

        schemeIs.shiftIntervalTotal =
          schemeIs.shiftIntervalHour * 60 + schemeIs.shiftIntervalMins;
      }

      schemeIs.noOfWeek = req.body.noOfWeek;
      const scheme = new Scheme(schemeIs);
      let resData = null;

      scheme.save((err, result) => {
        if (err) {
          resData = res.json({
            status: 3,
            result: null,
            msg: 'something went wrong',
          });
        }

        logInfo(`scheme API ends here!`, {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        resData = res.json({
          status: 1,
          data: result,
          msg: 'Record inserted successfully',
        });
      });
      return resData;
    } catch (err) {
      logError(`scheme API, there is an error`, err.toString());
      return __.out(res, 500);
    }
  }

  async mimeType(req, res) {
    try {
      const url = req.body.fileName;
      let type = url.substring(url.lastIndexOf('.') + 1);

      if (type.includes('/')) {
        type = type.slice(0, -1);
      }

      res.json({ type: mime.contentType(type) });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async readByBu(req, res) {
    try {
      let { companyId } = req.params;

      if (!companyId) {
        companyId = req.user.companyId;
      }

      Scheme.find({
        companyID: companyId,
        businessUnitId: req.params.buId,
        status: true,
      }).then((result, err) => {
        if (err) {
          return res.json({
            status: 3,
            result: err,
            msg: 'something went wrong',
          });
        }

        if (result)
          return res.json({
            status: 1,
            data: result,
            msg: 'Record Fetch successfully 1',
          });

        return res.json({ status: 2, data: null, msg: 'Record Not Found' });
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      let { companyId } = req.params;

      if (!companyId) {
        companyId = req.user.companyId;
      }

      Scheme.find({ companyID: companyId, status: true })
        .populate({ path: 'createdBy', select: 'name' })
        .sort({ updatedAt: -1 })
        .then((result, err) => {
          if (err) {
            return res.json({
              status: 3,
              result: err,
              msg: 'something went wrong',
            });
          }

          if (result)
            return res.json({
              status: 1,
              data: result,
              msg: 'Record Fetch successfully',
            });

          return res.json({ status: 2, data: null, msg: 'Record Not Found' });
        });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async readScheme(req, res) {
    try {
      Scheme.findById({
        _id: mongoose.Types.ObjectId(req.params.schemeId),
      }).then((result, err) => {
        if (err) {
          return res.json({
            status: 3,
            result: err,
            msg: 'something went wrong',
          });
        }

        if (result)
          return res.json({
            status: 1,
            data: result,
            msg: 'Record Fetch successfully 111',
          });

        return res.json({ status: 2, data: null, msg: 'Record Not Found' });
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`scheme/update API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      if (!req.body.status) {
        const idd = req.body._id;
        const isdelete = await Scheme.findByIdAndUpdate(
          idd,
          { $set: { status: false } },
          { new: true },
        );

        if (isdelete) {
          logInfo(`scheme/update API ends here!`, {
            name: req.user.name,
            staffId: req.user.staffId,
          });
          return res.json({
            status: 1,
            message: 'Scheme Deleted Successfully',
            result: isdelete,
          });
        }

        logInfo(`scheme/update API ends here!`, {
          name: req.user.name,
          staffId: req.user.staffId,
        });
        return res.json({
          status: 2,
          data: isdelete,
          message: 'Scheme Not Found',
        });
      }

      const requiredResult1 = await __.checkRequiredFields(req, [
        'schemeName',
        'schemeDesc',
      ]);

      if (requiredResult1.status === false) {
        logError(
          `scheme/update API, Required fields missing `,
          requiredResult1.missingFields,
        );
        logError(`scheme/update API, request payload `, req.body);
        return res.json({
          status: 3,
          result: null,
          msg: 'Please fill the empty fields',
        });
      }

      const id = req.body._id;
      const schemeIs = req.body;

      if (!schemeIs.companyID) {
        schemeIs.companyID = req.user.companyId;
      }

      if (!req.body.schemeName.trim() || !req.body.schemeDesc.trim()) {
        logError(
          `scheme/update API, there is an error`,
          'Please fill the empty fields',
        );
        return res.json({
          status: 3,
          result: null,
          msg: 'Please fill the empty fields',
        });
      }

      if (schemeIs.isShiftInterval) {
        logError(`scheme/update API, there is an error`, 'Interval is missing');
        if (!(schemeIs.shiftIntervalHour || schemeIs.shiftIntervalMins)) {
          return res.json({
            status: 3,
            result: null,
            msg: 'Interval is missing',
          });
        }

        if (
          (schemeIs.shiftIntervalHour !== 0 &&
            ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(
              schemeIs.shiftIntervalHour,
            )) ||
          (schemeIs.shiftIntervalMins !== 0 &&
            ![15, 30, 45].includes(schemeIs.shiftIntervalMins))
        ) {
          logError(
            `scheme/update API, there is an error`,
            'Interval contain wrong value',
          );
          return res.json({
            status: 3,
            result: null,
            msg: 'Interval contain wrong value',
          });
        }

        schemeIs.shiftIntervalTotal =
          schemeIs.shiftIntervalHour * 60 + schemeIs.shiftIntervalMins;
      } else {
        schemeIs.shiftIntervalHour = 0;
        schemeIs.shiftIntervalMins = 0;
        schemeIs.shiftIntervalTotal = 0;
      }

      schemeIs.noOfWeek = req.body.noOfWeek;
      if (req.body.status === true) {
        return Scheme.findOneAndUpdate(
          { _id: mongoose.Types.ObjectId(id) },
          schemeIs,
          { new: true },
        )
          .then((result) => {
            if (result) {
              logInfo(`scheme/update API ends here!`, {
                name: req.user.name,
                staffId: req.user.staffId,
              });
              return res.json({
                status: 1,
                data: result,
                message: 'Scheme Updated Successfully',
              });
            }

            return res.json({
              status: 2,
              data: result,
              message: 'Scheme Not Found',
            });
          })
          .catch((err) => {
            logError(`scheme/update API, there is an error`, err.toString());
            return res.json({ status: 3, message: 'Something Went Wrong' });
          });
      }

      return Scheme.findByIdAndUpdate(
        id,
        { $set: { status: false } },
        { new: true },
      )
        .then((result) => {
          logInfo(`scheme/update API ends here!`, {
            name: req.user.name,
            staffId: req.user.staffId,
          });
          if (result) {
            return res.json({
              status: 1,
              message: 'Scheme Deleted Successfully',
              result,
            });
          }

          logError(`scheme/update API, there is an error`, 'Scheme Not Found');
          return res.json({
            status: 2,
            data: result,
            message: 'Scheme Not Found',
          });
        })
        .catch((err) => {
          logError(`scheme/update API, there is an error`, err.toString());
          return res.json({ status: 3, message: 'Something Went Wrong' });
        });
    } catch (err) {
      logError(`scheme/update API, there is an error`, err.toString());
      return __.out(res, 500);
    }
  }

  async readUserLog(req, res) {
    try {
      logInfo(`scheme/userlog API Start!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      const data = await UserLog.find({
        type: req.body.type,
        businessUnitId: req.body.businessUnitId,
      }).populate([
        {
          path: 'oldSchemeId',
          select: 'schemeName',
        },
        {
          path: 'newSchemeId',
          select: 'schemeName',
        },
        {
          path: 'updatedBy',
          select: 'staffId name',
        },
        {
          path: 'userId',
          select: 'staffId name',
        },
      ]);

      logInfo(`scheme/userlog API ends here!`, {
        name: req.user.name,
        staffId: req.user.staffId,
      });
      return res.json({ data });
    } catch (err) {
      logError(`scheme/userlog API, there is an error`, err.toString());
      return __.out(res, 500);
    }
  }

  async getNumberOfWeekForSchemeId(req, res) {
    try {
      const weekNumber = await Scheme.findOne({
        _id: req.user.schemeId,
        status: true,
      })
        .select('noOfWeek')
        .lean();

      if (weekNumber) {
        return res.json({
          data: weekNumber,
          msg: 'Record fetched successfully',
        });
      }

      return res.json({ data: null, msg: 'Record Not Found' });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

module.exports = new SchemeController();
