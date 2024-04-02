// Controller Code Starts here
const moment = require('moment');
const csv = require('csv2json-convertor');
const WeeklyStaffData = require('../../models/weeklyStaffData');
const __ = require('../../../helpers/globalFunctions');

class WeeklyStaff {
  async uploadWeeklyStaffingData(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult1 = await __.checkRequiredFields(
        req,
        [
          'businessUnitId',
          'weekRangeStartsAt',
          'weekRangeEndsAt',
          'isFlexiStaff',
        ],
        'weeklyStaff',
      );

      if (requiredResult1.status === false) {
        return __.out(res, 400, requiredResult1.missingFields);
      }

      let jsonArray = [];

      jsonArray = csv.csvtojson(req.file.path);
      const data = {};
      const timeZone = ` GMT ${moment
        .parseZone(req.body.weekRangeStartsAt, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z')}`;

      for (const json of jsonArray) {
        const date = json.Timings.trim();
        /* this is for each day */
        const array = [];

        delete json.Timings;
        for (const time of Object.keys(json)) {
          /* add custom hours and mins to date  */
          const dateTime = `${date} ${time}${timeZone}`;
          const timeUnix =
            moment(dateTime, 'DD-MM-YYYY HH:mm Z').utc().unix() *
            1000; /* this is for each time on the corresponding date  */

          array.push([Number(timeUnix), Number(json[time])]);
        }
        data[date] = array;
      }

      const weekRangeStartsAt = moment(
        req.body.weekRangeStartsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .utc()
        .format();
      const weekRangeEndsAt = moment(
        req.body.weekRangeStartsAt,
        'MM-DD-YYYY HH:mm:ss Z',
      )
        .add(6, 'days')
        .add(23, 'hours')
        .add(59, 'minutes')
        .add(59, 'seconds')
        .utc()
        .format();
      const weekNumber = await __.weekNoStartWithMonday(weekRangeStartsAt);
      const set = {
        businessUnitId: req.body.businessUnitId,
        weekNumber,
        weekRangeStartsAt,
        weekRangeEndsAt,
      };

      if (req.body.isFlexiStaff === 1) set.flexiStaffData = data;
      else set.staffData = data;

      const checkAlreadyExistsOrNot = await WeeklyStaffData.findOne({
        weekNumber,
        businessUnitId: req.body.businessUnitId,
      })
        .select('_id')
        .lean();
      let updatedData = null;

      if (checkAlreadyExistsOrNot) {
        /* update */
        updatedData = await WeeklyStaffData.findOneAndUpdate(
          {
            _id: checkAlreadyExistsOrNot._id,
          },
          {
            $set: set,
          },
        ).lean();
      } else {
        /* insert */
        updatedData = await new WeeklyStaffData(set).save();
      }

      return __.out(res, 201, updatedData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async weeklyStaffingData(data, res) {
    try {
      const result = await WeeklyStaffData.findOne({
        weekNumber: data.weekNumber,
        businessUnitId: data.businessUnitId,
      }).lean();

      return result;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
module.exports = new WeeklyStaff();
