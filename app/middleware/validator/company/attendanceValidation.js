const { check } = require('express-validator');

module.exports.addPayloadValidation = [
  check('userId', 'Enter valid user id').notEmpty().isAlphanumeric(),
  check('shiftId', 'Enter valid shift id').notEmpty().isAlphanumeric(),
  check('shiftDetailId', 'Enter valid shift details id')
    .notEmpty()
    .isAlphanumeric(),
  check('attendanceMode', 'Enter valid attendance Mode').notEmpty().isString(),
  check('attandanceTakenBy', 'Enter valid attandanceTakenBy')
    .notEmpty()
    .isString(),
  check('businessUnitId', 'Enter valid business Unit Id')
    .notEmpty()
    .isAlphanumeric(),
  check('status', 'Enter valid status')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2, 3, 4, 5]),
];

module.exports.logsValidation = [
  check('businessUnitId', 'Enter valid business Unit Id')
    .notEmpty()
    .isAlphanumeric(),
  check('timeZone', 'Enter valid time zone').notEmpty().isNumeric(),
];
