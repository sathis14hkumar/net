const { check } = require('express-validator');

module.exports.listofshiftsPayloadValidation = [
  check('date', 'Enter valid date').notEmpty().isString(),
  check('businessUnitId', 'Enter valid businessUnitId').isArray(),
  check('startDate', 'Enter valid start date').notEmpty().isString(),
  check('endDate', 'Enter valid end date').notEmpty().isString(),
  check('AllBuSelected', 'Enter valid AllBuSelected').notEmpty().isBoolean(),
];

module.exports.bookingsPayloadValidation = [
  check('date', 'Enter valid date').notEmpty().isString(),
  check('businessUnitId', 'Enter businessUnitId').isArray(),
  check('startDate', 'Enter valid start date').notEmpty().isString(),
  check('endDate', 'Enter valid end date').notEmpty().isString(),
  check('AllBuSelected', 'Enter valid AllBuSelected').notEmpty().isBoolean(),
];

module.exports.listofcancellationsPayloadValidation = [
  check('date', 'Enter valid date').notEmpty().isString(),
  check('businessUnitId', 'Enter valid businessUnitId').isArray(),
  check('startDate', 'Enter valid start date').notEmpty().isString(),
  check('endDate', 'Enter valid end date').notEmpty().isString(),
  check('cancelHours', 'Enter valid AllBuSelected'),
];

module.exports.usersPayloadValidation = [
  check('date', 'Enter valid date').notEmpty().isString(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
  check('appointmentId', 'Enter valid appointmentId').isArray(),
  check('skillsets', 'Enter valid skillsets').isArray(),
  check('businessUnitId', 'Enter valid businessUnitId').isArray(),
  check('doj', 'Enter valid start date').isObject(),
  check('airportPassExpiryDate', 'Enter valid end date').isObject(),
];
