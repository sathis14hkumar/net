const { check, param } = require('express-validator');

module.exports.createBallot = [
  check('ballotName', 'Enter valid ballot name').notEmpty().isString(),
  check('applicationOpenDateTime', 'Enter valid applicationOpenDateTime')
    .notEmpty()
    .isString(),
  check('applicationCloseDateTime', 'Enter valid applicationCloseDateTime')
    .notEmpty()
    .isString(),
  check('openDate', 'Enter valid openDate').notEmpty().isString(),
  check('closeDate', 'Enter valid closeDate').notEmpty().isString(),
  check('openTime', 'Enter valid openTime').notEmpty().isString(),
  check('closeTime', 'Enter valid closeTime').notEmpty().isString(),
  check('timeZone', 'Enter valid timeZone').notEmpty().isString(),
  check('ballotStartDate', 'Enter valid ballotStartDate').notEmpty().isString(),
  check('ballotEndDate', 'Enter valid ballotEndDate').notEmpty().isString(),
  check('leaveType', 'Enter valid leaveType')
    .notEmpty()
    .isString()
    .isIn([1, 2]),
  check('leaveConfiguration', 'Enter valid leaveConfiguration')
    .notEmpty()
    .isString()
    .isIn([1, 2, 3, 4, 5]),
  check('resultRelease', 'Enter valid resultRelease')
    .notEmpty()
    .isString()
    .isIn([1, 2]),
  check('opsGroupId', 'Enter valid opsGroupId').notEmpty().isArray(),
  check('slotCreation', 'Enter valid slotCreation').notEmpty().isArray(),
  check('slotCreation.*.arr', 'Enter valid slotCreation array')
    .notEmpty()
    .isArray(),
  check('slotCreation.*.arr.*.value', 'Enter valid slotCreation array value')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('totalQuota', 'Enter valid totalQuota')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .custom((value) => value > 0),
  check(
    'slotCreation.*.arr.*.startDate',
    'Enter valid slotCreation array value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('slotCreation.*.weekRangeSlot', 'Enter valid week range slot')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isObject(),
  check('slotCreation.*.opsGroup.opsId', 'Enter valid opsId')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isAlphanumeric(),
  check('slotCreation.*.opsGroup.value', 'Enter valid opsGroup value')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('slotCreation.*.opsGroup.colspan', 'Enter valid opsGroup colspan')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isNumeric(),
  check('slotCreation.*.opsTeam', 'Enter valid opsTeam')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('slotCreation.*.opsTeam.*._id', 'Enter valid opsTeam id')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isAlphanumeric(),
  check('slotCreation.*.opsTeam.*.name', 'Enter valid opsTeam name')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('weekRange', 'Enter valid weekRange')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('weekRange.*.start', 'Enter valid weekRange start')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('weekRange.*.end', 'Enter valid weekRange end')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('staffRestriction', 'Enter valid staff Restriction')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('staffRestriction.*.slot', 'Enter valid staff Restriction slot')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('staffRestriction.*.showDate', 'Enter valid staff Restriction showDate')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check(
    'staffRestriction.*.startDate',
    'Enter valid staff Restriction startDate',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('staffRestriction.*.endDate', 'Enter valid staff Restriction endDate')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('staffRestriction.*.userList', 'Enter valid staff Restriction userList')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check(
    'staffRestriction.*.userList.*._id',
    'Enter valid staff Restriction userList _id',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isAlphanumeric(),
  check(
    'staffRestriction.*.userList.*.label',
    'Enter valid staff Restriction userList label',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check(
    'staffRestriction.*.userList.*.parentBussinessUnitId',
    'Enter valid staff Restriction userList parentBussinessUnitId',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isAlphanumeric(),
  check(
    'staffRestriction.*.userList.*.name',
    'Enter valid staff Restriction userList name',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),

  check('adminId', 'Enter valid adminId')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('isDraft', 'Enter valid isDraft')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isBoolean(),
  check('userFrom', 'Enter valid userFrom')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString()
    .isIn([1, 2]),
  check('isRestrict', 'Enter valid isRestrict')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('maxConsecutiveBallot', 'Enter valid maxConsecutiveBallot')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isNumeric()
    .custom((value) => value > 0),
  check('maxSegment', 'Enter valid maxSegment')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('maxSegment.*.segmentNo', 'Enter valid segmentNo')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isNumeric(),
  check('maxSegment.*.startDate', 'Enter valid startDate')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('maxSegment.*.endDate', 'Enter valid endDate')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('maxSegment.*.maxBallot', 'Enter valid maxBallot')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isNumeric()
    .custom((value) => value > 0),
];

module.exports.updateBallot = [
  check('ballotName', 'Enter valid ballot name').notEmpty().isString(),
  check('applicationOpenDateTime', 'Enter valid applicationOpenDateTime')
    .notEmpty()
    .isString(),
  check('applicationCloseDateTime', 'Enter valid applicationCloseDateTime')
    .notEmpty()
    .isString(),
  check('openDate', 'Enter valid openDate').notEmpty().isString(),
  check('closeDate', 'Enter valid closeDate').notEmpty().isString(),
  check('openTime', 'Enter valid openTime').notEmpty().isString(),
  check('closeTime', 'Enter valid closeTime').notEmpty().isString(),
  check('timeZone', 'Enter valid timeZone').notEmpty().isString(),
  check('ballotStartDate', 'Enter valid ballotStartDate').notEmpty().isString(),
  check('ballotEndDate', 'Enter valid ballotEndDate').notEmpty().isString(),
  check('leaveType', 'Enter valid leaveType')
    .notEmpty()
    .isString()
    .isIn([1, 2]),
  check('leaveConfiguration', 'Enter valid leaveConfiguration')
    .notEmpty()
    .isString()
    .isIn([1, 2, 3, 4, 5]),
  check('resultRelease', 'Enter valid resultRelease')
    .notEmpty()
    .isString()
    .isIn([1, 2]),
  check('totalQuota', 'Enter valid totalQuota')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .custom((value) => value > 0),
  check('opsGroupId', 'Enter valid opsGroupId').notEmpty().isArray(),
  check('slotCreation', 'Enter valid slotCreation').notEmpty().isArray(),
  check('slotCreation.*.arr', 'Enter valid slotCreation array')
    .notEmpty()
    .isArray(),
  check('slotCreation.*.arr.*.value', 'Enter valid slotCreation array value')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check(
    'slotCreation.*.arr.*.startDate',
    'Enter valid slotCreation array value',
  )
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('slotCreation.*.weekRangeSlot', 'Enter valid week range slot')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isObject(),
  check('slotCreation.*.opsGroup.opsId', 'Enter valid opsId')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isAlphanumeric(),
  check('slotCreation.*.opsGroup.value', 'Enter valid opsGroup value')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('slotCreation.*.opsGroup.colspan', 'Enter valid opsGroup colspan')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isNumeric(),
  check('slotCreation.*.opsTeam', 'Enter valid opsTeam')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('slotCreation.*.opsTeam.*._id', 'Enter valid opsTeam id')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isAlphanumeric(),
  check('slotCreation.*.opsTeam.*.name', 'Enter valid opsTeam name')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('weekRange', 'Enter valid weekRange')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('weekRange.*.start', 'Enter valid weekRange start')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('weekRange.*.end', 'Enter valid weekRange end')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('staffRestriction', 'Enter valid staff Restriction')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('staffRestriction.*.slot', 'Enter valid staff Restriction slot')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('staffRestriction.*.showDate', 'Enter valid staff Restriction showDate')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check(
    'staffRestriction.*.startDate',
    'Enter valid staff Restriction startDate',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('staffRestriction.*.endDate', 'Enter valid staff Restriction endDate')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('staffRestriction.*.userList', 'Enter valid staff Restriction userList')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check(
    'staffRestriction.*.userList.*._id',
    'Enter valid staff Restriction userList _id',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isAlphanumeric(),
  check(
    'staffRestriction.*.userList.*.label',
    'Enter valid staff Restriction userList label',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check(
    'staffRestriction.*.userList.*.name',
    'Enter valid staff Restriction userList name',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),

  check(
    'staffRestriction.*.userList.*.id._id',
    'Enter valid staff Restriction user id',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isAlphanumeric(),
  check(
    'staffRestriction.*.userList.*.id.name',
    'Enter valid staff Restriction user name',
  )
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),

  check('adminId', 'Enter valid adminId')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('isDraft', 'Enter valid isDraft')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isBoolean(),
  check('userFrom', 'Enter valid userFrom')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString()
    .isIn([1, 2]),
  check('isRestrict', 'Enter valid isRestrict')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('maxConsecutiveBallot', 'Enter valid maxConsecutiveBallot')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isNumeric()
    .custom((value) => value > 0),
  check('maxSegment', 'Enter valid maxSegment')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isArray(),
  check('maxSegment.*.segmentNo', 'Enter valid segmentNo')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isNumeric(),
  check('maxSegment.*.startDate', 'Enter valid startDate')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('maxSegment.*.endDate', 'Enter valid endDate')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
  check('maxSegment.*.maxBallot', 'Enter valid maxBallot')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isNumeric()
    .custom((value) => value > 0),
  check('id', 'Enter valid ballot id')
    .optional({
      nullable: true,
      checkFalsy: true,
    })
    .isString(),
];

module.exports.cancelballot = [
  param('id', 'Enter valid ballot id').notEmpty().isAlphanumeric(),
];

module.exports.extendBallot = [
  check('applicationCloseDate', 'Enter valid applicationCloseDate')
    .notEmpty()
    .isString(),
  check('applicationCloseTime', 'Enter valid applicationCloseTime')
    .notEmpty()
    .isString(),
  check('timeZone', 'Enter valid timeZone').notEmpty().isString(),
  check('resultReleaseDate', 'Enter valid resultReleaseDate')
    .notEmpty()
    .isString(),
  param('id', 'Enter valid ballot id').notEmpty().isAlphanumeric(),
];

module.exports.autoballot = [
  check('ballotId', 'Enter valid ballot id').notEmpty().isAlphanumeric(),
  check('userFrom', 'Enter valid userFrom').notEmpty().isNumeric(),
  check('data', 'Enter valid data')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('data', 'Enter valid data')
    .optional({ nullable: true, checkFalsy: true })
    .isArray(),
  check('data.*.opsG', 'Enter valid ops group')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('data.*.opsT', 'Enter valid ops team')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('data.*.teamIndex', 'Enter valid teamIndex')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('data.*.userId', 'Enter valid userId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('data.*.leaveTypeId', 'Enter valid leaveTypeId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('data.*.leaveGroupId', 'Enter valid leaveGroupId')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
  check('data.*.ballotLeaveBalance', 'Enter valid ballotLeaveBalance')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric(),
  check('data.*.name', 'Enter valid name')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('data.*.staffId', 'Enter valid staffId')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  check('data.*.parentBu', 'Enter valid parentBu')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric(),
];

module.exports.staffApplyforslot = [
  check('ballotId', 'Enter valid ballot id').notEmpty().isAlphanumeric(),
  check('slotNumber', 'Enter valid slotNumber').notEmpty().isArray(),
  check('userFrom', 'Enter valid userFrom').notEmpty().isNumeric(),
  check('leaveConfiguration', 'Enter valid leaveConfiguration')
    .notEmpty()
    .isNumeric(),
];
