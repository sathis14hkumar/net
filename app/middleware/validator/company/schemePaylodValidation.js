const { check } = require('express-validator');

module.exports.createValidation = [
  check('businessUnitId', 'Enter valid business unit id')
    .notEmpty()
    .isAlphanumeric(),
  check('companyID', 'Enter valid company id').notEmpty().isAlphanumeric(),
  check('schemeName', 'Enter valid scheme name').notEmpty().isString(),
  check('schemeDesc', 'Enter valid scheme description').notEmpty().isString(),
  check('shiftSchemeType', 'Enter valid shift scheme type')
    .notEmpty()
    .isNumeric()
    .custom((value) => {
      if (value >= 0) {
        return true;
      }

      throw new Error('Enter valid shift scheme type');
    }),
  check('isShiftInterval', 'Enter valid isShiftInterval')
    .notEmpty()
    .isBoolean(),
  check('shiftIntervalHour', 'Enter valid shift interval hour')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0 && value <= 12) {
        return true;
      }

      throw new Error('Enter valid shift interval hour');
    }),
  check('shiftIntervalMins', 'Enter valid shift interval minutes')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value === 0 || value === 15 || value === 30 || value === 45) {
        return true;
      }

      throw new Error('Enter valid shift interval minutes');
    }),
  check('noOfWeek', 'Enter valid no of weeks')
    .notEmpty()
    .isNumeric()
    .custom((value) => {
      if (value >= 1 && value <= 10) {
        return true;
      }

      throw new Error('Enter valid no of weeks');
    }),
  check(
    'shiftSetup.assignShift.enabled',
    'Enter valid assign shift setup enabled',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.disabled',
    'Enter valid assign shift setup disabled',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.normal',
    'Enter valid assign shift normal setup',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('shiftSetup.assignShift.ot', 'Enter valid assign shift ot setup')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowShiftExtension.yes',
    'Enter valid allow shiftSetup.assignShift.allowShiftExtension.yes',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowShiftExtension.no',
    'Enter valid shiftSetup.assignShift.allowShiftExtension.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowShiftExtension.normal',
    'Enter valid shiftSetup.assignShift.allowShiftExtension.normal',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowShiftExtension.ot',
    'Enter valid shiftSetup.assignShift.allowShiftExtension.ot',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowRecall.no',
    'Enter valid shiftSetup.assignShift.allowRecall.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowRecall.normal',
    'Enter valid shiftSetup.assignShift.allowRecall.normal',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowRecall.ot',
    'Enter valid shiftSetup.assignShift.allowRecall.ot',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowRecall.yes',
    'Enter valid shiftSetup.assignShift.allowRecall.yes',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.enabled',
    'Enter valid shiftSetup.openShift.enabled',
  )
    .notEmpty()
    .isBoolean(),
  check(
    'shiftSetup.openShift.disabled',
    'Enter valid shiftSetup.openShift.disabled',
  )
    .notEmpty()
    .isBoolean(),
  check(
    'shiftSetup.openShift.normal',
    'Enter valid shiftSetup.openShift.normal',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('shiftSetup.openShift.ot', 'Enter valid shiftSetup.openShift.ot')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.allowShiftExtension.yes',
    'Enter valid shiftSetup.openShift.allowShiftExtension.yes',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.allowShiftExtension.no',
    'Enter valid shiftSetup.openShift.allowShiftExtension.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.allowShiftExtension.normal',
    'Enter valid shiftSetup.openShift.allowShiftExtension.normal',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.allowShiftExtension.ot',
    'Enter valid shiftSetup.openShift.allowShiftExtension.ot',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.dayOverall',
    'Enter valid shiftSetup.limits.dayOverall',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0) {
        return true;
      }

      throw new Error('Enter valid shiftSetup.limits.dayOverall');
    }),
  check(
    'shiftSetup.limits.weekOverall',
    'Enter valid shiftSetup.limits.weekOverall',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0) {
        return true;
      }

      throw new Error('Enter valid shiftSetup.limits.weekOverall');
    }),
  check(
    'shiftSetup.limits.monthOverall',
    'Enter valid shiftSetup.limits.monthOverall',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0) {
        return true;
      }

      throw new Error('Enter valid shiftSetup.limits.monthOverall');
    }),
  check(
    'shiftSetup.limits.normalHr.day.value',
    'Enter valid shiftSetup.limits.normalHr.day.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.normalHr.day.no',
    'Enter valid shiftSetup.limits.normalHr.day.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.day.enable',
    'Enter valid shiftSetup.limits.normalHr.day.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.day.action',
    'Enter valid shiftSetup.limits.normalHr.day.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.day.alert',
    'Enter valid shiftSetup.limits.normalHr.day.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.normalHr.day.disallow',
    'Enter valid shiftSetup.limits.normalHr.day.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.normalHr.week.value',
    'Enter valid shiftSetup.limits.normalHr.week.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.normalHr.week.no',
    'Enter valid shiftSetup.limits.normalHr.week.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.week.enable',
    'Enter valid shiftSetup.limits.normalHr.week.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.week.action',
    'Enter valid shiftSetup.limits.normalHr.week.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.week.alert',
    'Enter valid shiftSetup.limits.normalHr.week.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.normalHr.week.disallow',
    'Enter valid shiftSetup.limits.normalHr.week.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check(
    'shiftSetup.limits.normalHr.month.value',
    'Enter valid shiftSetup.limits.normalHr.month.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.normalHr.month.no',
    'Enter valid shiftSetup.limits.normalHr.month.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.month.enable',
    'Enter valid shiftSetup.limits.normalHr.month.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.month.action',
    'Enter valid shiftSetup.limits.normalHr.month.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.month.alert',
    'Enter valid shiftSetup.limits.normalHr.month.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.normalHr.month.disallow',
    'Enter valid shiftSetup.limits.normalHr.month.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check(
    'shiftSetup.limits.otHr.day.value',
    'Enter valid shiftSetup.limits.otHr.day.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.otHr.day.no',
    'Enter valid shiftSetup.limits.otHr.day.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.day.enable',
    'Enter valid shiftSetup.limits.otHr.day.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.day.action',
    'Enter valid shiftSetup.limits.otHr.day.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.day.alert',
    'Enter valid shiftSetup.limits.otHr.day.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.otHr.day.disallow',
    'Enter valid shiftSetup.limits.otHr.day.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.otHr.week.value',
    'Enter valid shiftSetup.limits.otHr.week.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.otHr.week.no',
    'Enter valid shiftSetup.limits.otHr.week.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.week.enable',
    'Enter valid shiftSetup.limits.otHr.week.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.week.action',
    'Enter valid shiftSetup.limits.otHr.week.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.week.alert',
    'Enter valid shiftSetup.limits.otHr.week.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.otHr.week.disallow',
    'Enter valid shiftSetup.limits.otHr.week.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check(
    'shiftSetup.limits.otHr.month.value',
    'Enter valid shiftSetup.limits.otHr.month.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.otHr.month.no',
    'Enter valid shiftSetup.limits.otHr.month.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.month.enable',
    'Enter valid shiftSetup.limits.otHr.month.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.month.action',
    'Enter valid shiftSetup.limits.otHr.month.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.month.alert',
    'Enter valid shiftSetup.limits.otHr.month.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.otHr.month.disallow',
    'Enter valid shiftSetup.limits.otHr.month.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
];

module.exports.updateValidation = [
  check('businessUnitId', 'Enter valid business unit id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('companyID', 'Enter valid company id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('schemeName', 'Enter valid scheme name')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('schemeDesc', 'Enter valid scheme description')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('shiftSchemeType', 'Enter valid shift scheme type')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0) {
        return true;
      }

      throw new Error('Enter valid shift scheme type');
    }),
  check('isShiftInterval', 'Enter valid isShiftInterval')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('shiftIntervalHour', 'Enter valid shift interval hour')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0 && value <= 12) {
        return true;
      }

      throw new Error('Enter valid shift interval hour');
    }),
  check('shiftIntervalMins', 'Enter valid shift interval minutes')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value === 0 || value === 15 || value === 30 || value === 45) {
        return true;
      }

      throw new Error('Enter valid shift interval minutes');
    }),
  check('noOfWeek', 'Enter valid no of weeks')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 1 && value <= 10) {
        return true;
      }

      throw new Error('Enter valid no of weeks');
    }),
  check(
    'shiftSetup.assignShift.enabled',
    'Enter valid assign shift setup enabled',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.disabled',
    'Enter valid assign shift setup disabled',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.normal',
    'Enter valid assign shift normal setup',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('shiftSetup.assignShift.ot', 'Enter valid assign shift ot setup')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowShiftExtension.yes',
    'Enter valid allow shiftSetup.assignShift.allowShiftExtension.yes',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowShiftExtension.no',
    'Enter valid shiftSetup.assignShift.allowShiftExtension.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowShiftExtension.normal',
    'Enter valid shiftSetup.assignShift.allowShiftExtension.normal',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowShiftExtension.ot',
    'Enter valid shiftSetup.assignShift.allowShiftExtension.ot',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowRecall.no',
    'Enter valid shiftSetup.assignShift.allowRecall.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowRecall.normal',
    'Enter valid shiftSetup.assignShift.allowRecall.normal',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowRecall.ot',
    'Enter valid shiftSetup.assignShift.allowRecall.ot',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.assignShift.allowRecall.yes',
    'Enter valid shiftSetup.assignShift.allowRecall.yes',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.enabled',
    'Enter valid shiftSetup.openShift.enabled',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.disabled',
    'Enter valid shiftSetup.openShift.disabled',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.normal',
    'Enter valid shiftSetup.openShift.normal',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('shiftSetup.openShift.ot', 'Enter valid shiftSetup.openShift.ot')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.allowShiftExtension.yes',
    'Enter valid shiftSetup.openShift.allowShiftExtension.yes',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.allowShiftExtension.no',
    'Enter valid shiftSetup.openShift.allowShiftExtension.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.allowShiftExtension.normal',
    'Enter valid shiftSetup.openShift.allowShiftExtension.normal',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.openShift.allowShiftExtension.ot',
    'Enter valid shiftSetup.openShift.allowShiftExtension.ot',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.dayOverall',
    'Enter valid shiftSetup.limits.dayOverall',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0) {
        return true;
      }

      throw new Error('Enter valid shiftSetup.limits.dayOverall');
    }),
  check(
    'shiftSetup.limits.weekOverall',
    'Enter valid shiftSetup.limits.weekOverall',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0) {
        return true;
      }

      throw new Error('Enter valid shiftSetup.limits.weekOverall');
    }),
  check(
    'shiftSetup.limits.monthOverall',
    'Enter valid shiftSetup.limits.monthOverall',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0) {
        return true;
      }

      throw new Error('Enter valid shiftSetup.limits.monthOverall');
    }),
  check(
    'shiftSetup.limits.normalHr.day.value',
    'Enter valid shiftSetup.limits.normalHr.day.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.normalHr.day.no',
    'Enter valid shiftSetup.limits.normalHr.day.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.day.enable',
    'Enter valid shiftSetup.limits.normalHr.day.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.day.action',
    'Enter valid shiftSetup.limits.normalHr.day.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.day.alert',
    'Enter valid shiftSetup.limits.normalHr.day.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.normalHr.day.disallow',
    'Enter valid shiftSetup.limits.normalHr.day.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.normalHr.week.value',
    'Enter valid shiftSetup.limits.normalHr.week.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.normalHr.week.no',
    'Enter valid shiftSetup.limits.normalHr.week.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.week.enable',
    'Enter valid shiftSetup.limits.normalHr.week.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.week.action',
    'Enter valid shiftSetup.limits.normalHr.week.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.week.alert',
    'Enter valid shiftSetup.limits.normalHr.week.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.normalHr.week.disallow',
    'Enter valid shiftSetup.limits.normalHr.week.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check(
    'shiftSetup.limits.normalHr.month.value',
    'Enter valid shiftSetup.limits.normalHr.month.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.normalHr.month.no',
    'Enter valid shiftSetup.limits.normalHr.month.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.month.enable',
    'Enter valid shiftSetup.limits.normalHr.month.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.month.action',
    'Enter valid shiftSetup.limits.normalHr.month.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.normalHr.month.alert',
    'Enter valid shiftSetup.limits.normalHr.month.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.normalHr.month.disallow',
    'Enter valid shiftSetup.limits.normalHr.month.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check(
    'shiftSetup.limits.otHr.day.value',
    'Enter valid shiftSetup.limits.otHr.day.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.otHr.day.no',
    'Enter valid shiftSetup.limits.otHr.day.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.day.enable',
    'Enter valid shiftSetup.limits.otHr.day.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.day.action',
    'Enter valid shiftSetup.limits.otHr.day.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.day.alert',
    'Enter valid shiftSetup.limits.otHr.day.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.otHr.day.disallow',
    'Enter valid shiftSetup.limits.otHr.day.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.otHr.week.value',
    'Enter valid shiftSetup.limits.otHr.week.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.otHr.week.no',
    'Enter valid shiftSetup.limits.otHr.week.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.week.enable',
    'Enter valid shiftSetup.limits.otHr.week.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.week.action',
    'Enter valid shiftSetup.limits.otHr.week.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.week.alert',
    'Enter valid shiftSetup.limits.otHr.week.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.otHr.week.disallow',
    'Enter valid shiftSetup.limits.otHr.week.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check(
    'shiftSetup.limits.otHr.month.value',
    'Enter valid shiftSetup.limits.otHr.month.value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => value >= 0),
  check(
    'shiftSetup.limits.otHr.month.no',
    'Enter valid shiftSetup.limits.otHr.month.no',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.month.enable',
    'Enter valid shiftSetup.limits.otHr.month.enable',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.month.action',
    'Enter valid shiftSetup.limits.otHr.month.action',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'shiftSetup.limits.otHr.month.alert',
    'Enter valid shiftSetup.limits.otHr.month.alert',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'shiftSetup.limits.otHr.month.disallow',
    'Enter valid shiftSetup.limits.otHr.month.disallow',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('_id', 'Enter valid scheme id').notEmpty().isAlphanumeric(),
  check('status', 'Enter valid scheme status').notEmpty().isBoolean(),
];
