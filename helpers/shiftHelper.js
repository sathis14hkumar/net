const moment = require('moment');
const ShiftDetails = require('../app/models/shiftDetails');

class ShiftHelper {
  async checkShiftInterval(
    staffId,
    startTime,
    endTime,
    intervalTime,
    shiftDetailId = null,
    splitShiftId = null,
  ) {
    try {
      const MS_PER_MINUTE = 60000;

      startTime = new Date(
        new Date(startTime).getTime() - MS_PER_MINUTE * intervalTime,
      );

      endTime = new Date(
        new Date(endTime).getTime() + MS_PER_MINUTE * intervalTime,
      );
      const where = {
        $or: [
          {
            confirmedStaffs: staffId,
          },
          {
            backUpStaffs: staffId,
          },
        ],
        startTime: {
          $lt: moment(endTime).utc().format(),
        },
        endTime: {
          $gt: moment(startTime).utc().format(),
        },
        status: 1,
      };

      if (splitShiftId) {
        where._id = { $nin: [shiftDetailId, splitShiftId] };
      } else if (shiftDetailId) {
        where._id = { $ne: shiftDetailId };
      }

      const checkAnyShiftAlreadyExists = await ShiftDetails.findOne(
        where,
      ).lean();

      return !!checkAnyShiftAlreadyExists;
    } catch (e) {
      return false;
    }
  }
}
const shiftHelper = new ShiftHelper();

module.exports = shiftHelper;
