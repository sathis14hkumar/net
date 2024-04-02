const { check } = require('express-validator');

module.exports.updateValidation = [
  check('opsGroup.adminCutOffTime', 'Enter valid admin cutoff time')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= -10 && value <= 10) {
        return true;
      }

      throw new Error('Enter valid admin cutoff time between -10 to 10');
    }),
  check(
    'opsGroup.blockLeaveConfiguration',
    'Enter valid block leave configuration',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 1 && value <= 3) {
        return true;
      }

      throw new Error('Enter valid block leave configuration between 1 to 3');
    }),
  check('opsGroup.staffCutOffTime', 'Enter valid staff cutoff time')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0 && value <= 20) {
        return true;
      }

      throw new Error('Enter valid staff cutoff time between 0 to 20');
    }),
  check('opsGroup.swapMinimumWeek', 'Enter valid swap minimum week')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value >= 0 && value <= 20) {
        return true;
      }

      throw new Error('Enter valid swap minimum week between 0 to 20');
    }),
  check('opsGroup.tierType', 'Enter valid tier type')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .custom((value) => {
      if (value === 1 || value === 2) {
        return true;
      }

      throw new Error('Enter only tier type 1 or 2');
    }),
  check('opsGroup.isAdminCanCancel', 'Select valid admin cancel')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('opsGroup.isAdminCanCancelPlan', 'Select valid admin cancel plan')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('opsGroup.isAdminCanChangePlan', 'Select valid admin change plan')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('opsGroup.isStaffCanCancel', 'Select valid staff cancel')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('opsGroup.isStaffCanCancelPlan', 'Select valid staff cancel plan')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('opsGroup.isadminCanChange', 'Select valid admin change plan')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('opsGroup.leaveAdjust', 'Select leave adjust')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check('bannerImages', 'Select Fields need to be update on login')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('loginFields', 'Select Fields need to be update on login')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('isTaskViewIncluded', 'Select Show tasks view in mobile home page')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('isChallengeIncluded', 'Show challenges in mobile home page')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('isFormsIncluded', 'Show forms in mobile home page')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('isBoardsIncluded', 'Show boards challenges in mobile home page')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check('quickLinks', 'Enter Links')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('quickLinks.*.status', 'Enter Status')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('quickLinks.*.screenName', 'Enter Screenname')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('quickLinks.*.title', 'Enter title')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),

  check('externalLinks', 'Enter external links')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('externalLinks.*.indexNum', 'Enter index num')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('externalLinks.*.icon', 'Enter icon')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('externalLinks.*.link', 'Enter link')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('externalLinks.*.title', 'Enter title')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),

  check('techEmail', 'Enter tech emial')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail(),
  check('adminEmail', 'Enter admin email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail(),
  check('notificRemindDays', 'Enter notification remind days')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('notificRemindHours', 'Enter notification remind hours')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),

  check('pointSystems', 'Enter point system')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('pointSystems.*.index', 'Enter index')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('pointSystems.*.icon', 'Enter icon')
    .custom((value) => {
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw new Error('Icon must be string or number.');
      }

      return true;
    })
    .optional(),
  check('pointSystems.*.description', 'Enter description')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('pointSystems.*.title', 'Enter title')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('pointSystems.*.isEnabled', 'Enabled/disabled')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('pointSystems.*._id', 'Enter _id')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isString(),
  check('pointSystems.*.isCheckedBox', 'Select check')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check('suggestions', 'Enter valid Suggetion')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('compliments', 'Enter valid complaints')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),

  check('pageId', 'Enter page if').notEmpty(),
];

module.exports.updatePwdManageValidation = [
  check('pwdSettings.defaultPassword', 'Enter Default password').notEmpty(),
  check('pwdSettings.status', 'Select Status')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2, 3]),

  check(
    'pwdSettings.charTypes.specialChar',
    'Select Special characters (e.g. !,@,#,$,%)',
  )
    .notEmpty()
    .isBoolean(),

  check(
    'pwdSettings.charTypes.lowerCase',
    'Select Lowercase characters (a through)',
  )
    .notEmpty()
    .isBoolean(),

  check(
    'pwdSettings.charTypes.upperCase',
    'Select Uppercase characters (A through Z)',
  )
    .notEmpty()
    .isBoolean(),

  check('pwdSettings.charTypes.numbers', 'Select Forms Numbers (0 through 9)')
    .notEmpty()
    .isBoolean(),

  check('pwdSettings.pwdReUse', 'Enter Password reuse').notEmpty().isNumeric(),
  check('pwdSettings.maxLoginAttempt', 'Enter Password retries')
    .notEmpty()
    .isNumeric(),
  check('pwdSettings.charLength', 'Enter Number of password character')
    .notEmpty()
    .isNumeric(),
  check('pwdSettings.pwdDuration', 'Enter Password change')
    .notEmpty()
    .isNumeric(),
  check('pwdSettings.otpSentFor', 'Select OTP sent for').notEmpty().isNumeric(),
  check('pwdSettings.passwordType', 'Select Password type')
    .notEmpty()
    .isNumeric(),
  check('pageId', 'Enter page if').notEmpty(),
];
