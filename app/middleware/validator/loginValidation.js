const { body, check } = require('express-validator');

module.exports.loginValidation = [
  check('staffId', 'Enter valid staffId').notEmpty().isString(),
  body('password', 'Enter valid password').notEmpty().isString(),
  check('companyId', 'Enter valid companyId').optional({}).isString(),
  check('companyName', 'Enter valid companyName').optional({}).isString(),
];

module.exports.requestOtpValidation = [
  check('userId', 'Enter valid userId')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isString(),
  check('staffId', 'Enter valid staffId')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isString(),
  check('countryCode', 'Enter valid Country Code').notEmpty().isString(),
  check('primaryMobileNumber', 'Enter valid primary mobile number')
    .notEmpty()
    .isLength({ min: 6, max: 10 })
    .isNumeric(),
  check('pathName', 'Enter valid path name')
    .optional({ nullable: true, checkFalsy: true })
    .notEmpty()
    .isString(),
  check('updateViaProfile', 'Enter valid updateViaProfile')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
];

module.exports.verifyOtp = [
  check('token', 'Enter valid token').notEmpty().isString(),
  check('otp', 'Enter valid otp').notEmpty().isNumeric().isLength({ min: 6 }),
  check('forgotPassword', 'Enter valid password')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
];

module.exports.resetPassword = [
  check('token', 'Enter valid token').notEmpty().isString(),
  check('password', 'Enter valid password').notEmpty().isString(),
];
