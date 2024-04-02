const { check, body } = require('express-validator');

module.exports.updateBuShiftSchemePayloadValidation = [
  check('businessUnitId', 'Enter valid business Unit Id')
    .notEmpty()
    .isAlphanumeric(),
  check('mainSkillSets', 'Enter valid mainSkillSets').isArray(),
  check('subSkillSets', 'Enter valid subSkillSets').isArray(),
  check('skillSetTierType', 'Enter valid skillSetTierType')
    .notEmpty()
    .isNumeric()
    .custom((value) => {
      if (value === 1 || value === 2) {
        return true;
      }

      throw new Error('Enter valid skillSetTierType');
    }),
  check('locations', 'Enter valid reporting location')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('scheme', 'Enter valid scheme').notEmpty().isArray(),
  check('noOfWeek', 'Enter valid noOfWeek')
    .notEmpty()
    .isNumeric()
    .custom((value) => {
      if (value >= 1 && value <= 10) {
        return true;
      }

      throw new Error('Enter valid no of week between 1 to 10');
    }),
  check('plannedHours', 'Enter valid planned hours')
    .notEmpty()
    .isNumeric()
    .custom((value) => {
      if (value === 15 || value === 30 || value === 45 || value === 60) {
        return true;
      }

      throw new Error(
        'Enter valid planned hours like 15 mintues or 30 mintues or 45 mintues or 60 mintues',
      );
    }),
  check('shiftTimeInMinutes', 'Enter valid shiftTimeInMinutes')
    .notEmpty()
    .isNumeric()
    .custom((value) => {
      if (value === 15 || value === 30 || value === 45 || value === 60) {
        return true;
      }

      throw new Error(
        'Enter valid shift Time In Minutes like 15 mintues or 30 mintues or 45 mintues or 60 mintues',
      );
    }),
  check('shiftBreak', 'Enter valid shift break').notEmpty().isArray(),
  check('shiftBreak.*.breakInMinutes', 'Enter valid break In Minutes')
    .notEmpty()
    .isNumeric()
    .custom((value) => {
      if (value >= 1 && value <= 60) {
        return true;
      }

      throw new Error('Enter valid break In Minutes between 1 to 60');
    }),
  check('shiftBreak.*.shiftHour', 'Enter valid shift hour')
    .notEmpty()
    .isNumeric()
    .custom((value) => {
      if (value >= 1 && value <= 14) {
        return true;
      }

      throw new Error('Enter valid shift hour between 1 to 14');
    }),
  check('shiftBreak.*.id', 'Enter valid shift break id')
    .notEmpty()
    .isAlphanumeric(),
  check('isBreakTime', 'Enter valid break time').notEmpty().isBoolean(),
  check('standByShiftPermission', 'Enter valid stand by shift permission')
    .notEmpty()
    .isBoolean(),
  check('shiftCancelHours', 'Enter valid shift Cancel Hours')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isNumeric(),
  check('cancelShiftPermission', 'Enter valid cancel Shift Permission')
    .notEmpty()
    .isBoolean(),
  check(
    'cutOffDaysForBookingAndCancelling',
    'Enter valid cut Off Days For Booking And Cancelling',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),

  check('geoReportingLocation', 'Enter valid reporting location').custom(
    (value) => {
      if (!Array.isArray(value) && typeof value !== 'boolean') {
        throw new Error('reportingLocation must be an array or a boolean');
      }

      return true;
    },
  ),

  check('reportingLocationType', 'Enter valid reporting location type')
    .notEmpty()
    .isString(),
  check('isCheckInEnabled', 'Enter valid is check in enabled')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isBoolean(),
  check('isProximityEnabled', 'Enter valid is proximity enabled')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isBoolean(),
  check('reportingLocationRadius', 'Enter valid reporting location radius')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isNumeric(),
];

module.exports.skillCreatePayloadValidation = [
  check('name', 'Enter valid name').notEmpty().isString(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
];

module.exports.skillUpdatePayloadValidation = [
  check('name', 'Enter valid name').notEmpty().isString(),
  check('skillSetId', 'Enter valid skill set Id').notEmpty().isAlphanumeric(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
];

module.exports.skillsetDeletePayloadValidation = [
  check('skillSetId', 'Enter valid skill set id').notEmpty().isAlphanumeric(),
];

module.exports.subskillsetCreatePayloadValidation = [
  check('name', 'Enter valid name').notEmpty().isString(),
  check('skillSetId', 'Enter valid skill set Id').notEmpty().isAlphanumeric(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
];

module.exports.subskillsetCreatePayloadValidation = [
  check('name', 'Enter valid name').notEmpty().isString(),
  check('skillSetId', 'Enter valid skill set Id').notEmpty().isAlphanumeric(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
];

module.exports.subskillsetUpdatePayloadValidation = [
  check('name', 'Enter valid name').notEmpty().isString(),
  check('skillSetId', 'Enter valid skill set Id').notEmpty().isAlphanumeric(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
  check('subSkillSetId', 'Enter valid skill set Id')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.subskillsetDeletePayloadValidation = [
  check('subSkillSetId', 'Enter valid skill set Id')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.updateskillsetandlocationValidation = [
  body('businessUnitId', 'Enter valid business Unit Id')
    .notEmpty()
    .isAlphanumeric(),
  body(
    'sectionId_departmentId_companyId_name',
    'Enter valid sectionId_departmentId_companyId_name',
  )
    .notEmpty()
    .isString(),
  body('sectionId_departmentId_name', 'Enter valid sectionId_departmentId_name')
    .notEmpty()
    .isString(),
  body('sectionId_name', 'Enter valid sectionId_name').notEmpty().isString(),
  body('name', 'Enter valid name').notEmpty().isString(),
  body('status', 'Enter valid status').notEmpty().isNumeric().isIn([1, 2]),
];
