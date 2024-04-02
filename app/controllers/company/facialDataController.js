const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const FacialData = require('../../models/facialData');
const User = require('../../models/user');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class FacialDataController {
  async create(data, res) {
    try {
      const errors = validationResult(data);

      if (!errors.isEmpty()) {
        res.status(400).json({ errorMessage: errors.array() });
      }

      logInfo(`facial/create API Start!`, {
        name: data.user.name,
        staffId: data.user.staffId,
      });
      const doc = await FacialData.findOne({
        userId: data.body.userId,
      });

      if (doc === null) {
        const insert = {
          userId: data.body.userId,
          facialInfo: data.body.facialInfo,
          descriptor: data.body.descriptor,
        };
        const result = await new FacialData(insert).save();

        await User.findOneAndUpdate(
          { _id: insert.userId },
          { $set: { facialId: result._id } },
        );
      } else {
        doc.facialInfo = data.body.facialInfo;
        doc.descriptor = data.body.descriptor;
        await doc.save();
        await User.findOneAndUpdate(
          { _id: doc.userId },
          { $set: { facialId: doc._id } },
        );
      }

      logInfo(`facial/create API ends here!`, {
        name: data.user.name,
        staffId: data.user.staffId,
      });
      __.out(res, 200);
    } catch (err) {
      logError(`facial/create API, there is an error`, err.toString());
      __.log(err);
      __.out(res, 500);
    }
  }

  async list(req, res) {
    return FacialData.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: '$userInfo',
      },
      {
        $match: {
          'userInfo.parentBussinessUnitId': mongoose.Types.ObjectId(
            req.params.businessUnitId,
          ),
        },
      },
      {
        $lookup: {
          from: 'appointments',
          localField: 'userInfo.appointmentId',
          foreignField: '_id',
          as: 'appointmentInfo',
        },
      },
      {
        $unwind: '$appointmentInfo',
      },
      {
        $project: {
          _id: 1,
          facialInfo: 1,
          userId: 1,
          'userInfo.name': 1,
          'userInfo.staffId': 1,
          'userInfo.contactNumber': 1,
          'appointmentInfo.name': 1,
          'userInfo.appointmentId': 1,
        },
      },
    ])
      .then((data) =>
        __.out(res, 200, {
          facialOverviewData: data,
        }),
      )
      .catch((err) => {
        __.log(err);
        return __.out(res, 500);
      });
  }
}

const facialDataController = new FacialDataController();

module.exports = facialDataController;
