const { check, param } = require('express-validator');

module.exports.createValidation = [
  check('moduleName', 'Enter valid mudule name').notEmpty().isString(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
  check('questions', 'Enter valid questions')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('viewCount', 'Enter valid viewCount')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
];

module.exports.updateModule = [
  check('moduleName', 'Enter valid mudule name').notEmpty().isString(),
  check('questions.*._id', 'Enter valid question id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('questions.*.required', 'Enter valid question required')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check('closingMessage', 'Enter valid closing Message')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('randomOrder', 'Enter valid random Order').notEmpty().isBoolean(),
  check('scorePerQuestion', 'Enter valid score Per Question')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('scoringEnabled', 'Enter valid scoring enabled')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('status', 'Enter valid status').notEmpty().isNumeric(),
  check('viewCount', 'Enter valid viewCount')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('welComeAttachement', 'Enter valid welCome Attachement')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('welComeMessage', 'Enter valid welCome message')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('_id', 'Enter valid question builder _id')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];

module.exports.questionsUpdate = [
  check('moduleId', 'Enter valid module Id').notEmpty().isString(),
  check('type', 'Enter valid type').notEmpty().isNumeric(),
  check('indexNum', 'Enter valid indexNum').notEmpty().isNumeric(),
  check('options.*.value', 'Enter valid option value')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('options.*.correctAns', 'Enter valid correctAns')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('options.*.imageSrc', 'Enter valid imageSrc')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('dateTime', 'Enter valid dateTime')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('date', 'Enter valid date')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('time', 'Enter valid time')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('maxlength', 'Enter valid maxlength')
    .optional({ nullable: true, checkFalsy: true })
    .isInt(),
  check('profile', 'Enter valid profile')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('conditionalQuestions', 'Enter valid conditionalQuestions')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('optionsView', 'Enter valid optionsView')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isIn([0, 1]),
  check('explanation', 'Enter valid explanation')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('imageSrc', 'Enter valid imageSrc')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('isConditional', 'Enter valid isConditional')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('question', 'Enter valid question')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];

module.exports.remove = [
  param('moduleId', 'Enter valid module id').notEmpty().isAlphanumeric(),
];
