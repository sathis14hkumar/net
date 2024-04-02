const Mongoose = require('mongoose');
const NotificationCronModel = require('../app/models/notificationCron');

class NotificationCron {
  constructor(dbName) {
    this.dbName = dbName;
  }

  async update(where, updateObj) {
    await NotificationCronModel.updateOne(where, {
      $set: updateObj,
    });

    return true;
  }

  async getAll(skip, limit, sortObj, where, requiredData) {
    const notificationData = await NotificationCronModel.find(
      where,
      requiredData,
    )
      .populate([
        {
          path: 'data.createdBy',
          select: 'name',
        },
      ])
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    return notificationData;
  }

  async count(where) {
    const notificationData = await NotificationCronModel.countDocuments(where);

    return notificationData;
  }

  async deleteMany(where) {
    const result = await NotificationCronModel.deleteMany(where);

    return result;
  }

  async updateMany(where, update) {
    const result = await NotificationCronModel.updateMany(where, {
      $set: update,
    });

    return result;
  }

  async getCronNotification() {
    const allNotification = await NotificationCronModel.find({
      nextRunAt: { $lte: new Date() },
    }).lean();
    const cronId = allNotification.map((id) => id._id);
    const notificationData = allNotification.map((id) =>
      id.data.otherModules
        ? id.data
        : {
            _id: Mongoose.Types.ObjectId(id.data._id),
            moduleType: id.data.moduleType,
          },
    );

    await NotificationCronModel.updateMany(
      { _id: { $in: cronId } },
      { $set: { lastRunAt: new Date(), nextRunAt: null } },
    );

    return notificationData;
  }
}
module.exports = new NotificationCron();
