const { check, param } = require('express-validator');

module.exports.createCustomFormValidation = [
  check('title', 'Enter valid title').notEmpty().isString(),
  check('isDeployed', 'Enter valid isDeployed')
    .notEmpty()
    .isNumeric()
    .isIn([1, 2]),
  check('formLogo', 'Enter valid form logo').notEmpty().isString(),
  check('description', 'Enter valid form description')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('viewOnly', 'Enter valid view only').notEmpty().isBoolean(),
  check('userStatusVisibility', 'Enter valid user status visibility')
    .notEmpty()
    .isBoolean(),
  check('quickNavEnabled', 'Enter valid quick nav enabled')
    .notEmpty()
    .isBoolean(),
  check('moduleId', 'Enter valid moduleId').notEmpty().isAlphanumeric(),
  check('status', 'Enter valid status').notEmpty().isNumeric().isIn([1]),
  check('formStatus', 'Enter valid form status')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('formDisplayType', 'Enter valid formDisplayType')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('_id', 'Enter valid _id')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('assignUsers', 'Enter valid assignUsers').isArray(),
  check('assignUsers.*.businessUnits', 'Enter valid businessUnits')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('assignUsers.*.buFilterType', 'Enter valid buFilterType')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isIn([1, 2, 3]),
  check('assignUsers.*.appointments', 'Enter valid appointments')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('assignUsers.*.subSkillSets', 'Enter valid subSkillSets')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('assignUsers.*.user', 'Enter valid user')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('assignUsers.*.admin', 'Enter valid admin')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('assignUsers.*.allBuToken', 'Enter valid allBuToken')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('assignUsers.*.allBuTokenStaffId', 'Enter valid allBuTokenStaffId')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('assignUsers.*.customField', 'Enter valid customField')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),

  check('workflow', 'Enter valid customField')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('workflow.*.title', 'Enter valid workflow title')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('workflow.*.type', 'Enter valid workflow type')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isIn([1, 2, 3]),
  check('workflow.*.status', 'Enter valid workflow status')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .isIn([1]),
  check(
    'workflow.*.additionalModuleId',
    'Enter valid workflow additionalModuleId',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('workflow.*.questionResponse', 'Enter valid workflow questionResponse')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('workflow.*.workflowResponse', 'Enter valid workflow workflowResponse')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check(
    'workflow.*.userStatusVisibility',
    'Enter valid workflow userStatusVisibility',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check(
    'workflow.*.workflowStatus.*.field',
    'Enter valid workflow workflowStatus field',
  )
    .optional({ optional: true })
    .isString(),
  check(
    'workflow.*.workflowStatus.*.isDefault',
    'Enter valid workflow workflowStatus isDefault',
  )
    .optional({ optional: true })
    .isBoolean(),
  check(
    'workflow.*.workflowStatus.*.color',
    'Enter valid workflow workflowStatus color',
  )
    .optional({ optional: true })
    .isString(),
  check('workflow.*.admin', 'Enter valid workflow admin')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('workflow.*.tempId', 'Enter valid workflow tempId')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
];

module.exports.setFormSettingsValidation = [
  check('fieldStatus', 'Enter valid field status')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('fieldStatus.*._id', 'Enter valid field id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('fieldStatus.*.status', 'Enter valid field status')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check('statusFilter', 'Enter valid statusFilter')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('statusFilter.*._id', 'Enter valid field id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('statusFilter.*.status', 'Enter valid field status')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),

  check('customFormId', 'Enter valid custom form Id')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.updateWorkflowStatusValidation = [
  check('_id', 'Enter valid id').notEmpty().isAlphanumeric(),
  check('workflowStatus.fieldId', 'Enter valid field id')
    .notEmpty()
    .isAlphanumeric(),
  check('workflowStatus.fieldStatusId', 'Enter valid field status id')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.getManageFormAnswersValidation = [
  check('isAdminModule', 'Enter valid is admin module')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('customFormId', 'Enter valid field customFormId')
    .notEmpty()
    .isAlphanumeric(),
  check('manageFormId', 'Enter valid manageFormId').notEmpty().isAlphanumeric(),
  check('workflowId', 'Enter valid workflowId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('moduleId', 'Enter valid moduleId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];

module.exports.resCustomFormQuestionsValidation = [
  check('isAdminModule', 'Enter valid is admin module').notEmpty().isBoolean(),
  check('customFormId', 'Enter valid field customFormId')
    .notEmpty()
    .isAlphanumeric(),
  check('manageFormId', 'Enter valid manageFormId').notEmpty().isAlphanumeric(),
  check('workflowId', 'Enter valid workflowId').notEmpty().isAlphanumeric(),
  check('moduleId', 'Enter valid moduleId').notEmpty().isAlphanumeric(),
];

module.exports.getManageFormUsersValidation = [
  check('customFormId', 'Enter valid field customFormId')
    .notEmpty()
    .isAlphanumeric(),
];

module.exports.questionModuleResCustomFormQuestionsValidation = [
  check('answers', 'Enter valid answers').notEmpty().isArray(),
  check('answers.*._id', 'Enter valid answers')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('answers.*.answer.value', 'Enter valid answers value')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('answers.*.answer.correctAns', 'Enter valid correct answers')
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
  check('answers.*.answer.imageSrc', 'Enter valid image Src')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('answers.*.answer._id', 'Enter valid answer id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('answers.*.type', 'Enter valid answer type')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('customFormId', 'Enter valid field customFormId')
    .notEmpty()
    .isAlphanumeric(),
  check('questions', 'Enter valid questions').notEmpty().isArray(),
];

module.exports.getReadFormsListValidation = [
  param('companyId', 'Enter a valid companyId').notEmpty().isMongoId(),
];
