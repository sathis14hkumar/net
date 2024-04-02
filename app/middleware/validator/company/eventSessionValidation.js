/* eslint-disable no-unused-vars */
const { body } = require('express-validator');
const { isObjectId } = require('../../validators');

const createSession = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('sessions', 'Enter valid sessions').isArray(),
  body('sessions.*.adminIds', 'Enter valid session adminIds')
    .isArray()
    .optional(),
  body('sessions.*.checked', 'Enter valid session checked')
    .isBoolean()
    .optional(),
  body('sessions.*.endDate', 'Enter valid session endDate')
    .isString()
    .optional(),
  body('sessions.*.endTime', 'Enter valid session endTime')
    .isString()
    .optional(),
  body('sessions.*.startDate', 'Enter valid session startDate')
    .isString()
    .optional(),
  body('sessions.*.startTime', 'Enter valid session startTime')
    .isString()
    .optional(),
  body('sessions.*.indexno', 'Enter valid session indexno')
    .isNumeric()
    .optional(),
  body(
    'sessions.*.totalParticipantPerSession',
    'Enter valid session totalParticipantPerSession',
  )
    .isNumeric()
    .optional(),
  body('sessions.*.location', 'Enter valid location').isString().optional(),
  body('sessions.*.checked', 'Enter valid checked').isBoolean().optional(),
  body(
    'sessions.*.attendaceRequiredCount',
    'Enter valid attendaceRequiredCount',
  )
    .isNumeric()
    .optional(),
];

const editMultipleSessions = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('sessions', 'Enter valid sessions').isArray(),
  body('sessions.*.adminIds', 'Enter valid session adminIds')
    .isArray()
    .optional(),
  body('sessions.*.checked', 'Enter valid session checked')
    .isBoolean()
    .optional(),
  body('sessions.*.endDate', 'Enter valid session endDate')
    .isString()
    .optional(),
  body('sessions.*.endTime', 'Enter valid session endTime')
    .isString()
    .optional(),
  body('sessions.*.startDate', 'Enter valid session startDate')
    .isString()
    .optional(),
  body('sessions.*.startTime', 'Enter valid session startTime')
    .isString()
    .optional(),
  body('sessions.*.indexno', 'Enter valid session indexno')
    .isNumeric()
    .optional(),
  body(
    'sessions.*.totalParticipantPerSession',
    'Enter valid session totalParticipantPerSession',
  )
    .isNumeric()
    .optional(),
  body('sessions.*._id', 'Enter valid session _id')
    .optional({ nullable: true, checkFalsy: true })
    .isAlphanumeric()
    .isString()
    .matches(isObjectId),
  body('sessions.*.post', 'Enter valid post').isString().optional(),
  body('sessions.*.location', 'Enter valid location').isString().optional(),
  body('sessions.*.checked', 'Enter valid checked').isBoolean().optional(),
  body(
    'sessions.*.attendaceRequiredCount',
    'Enter valid attendaceRequiredCount',
  )
    .isNumeric()
    .optional(),
  body('deletedSessions', 'Enter valid deletedSessions').isArray().optional(),
];

const getEventDetails = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

const getEventSessionDetails = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('session_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

const getAdminSessions = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('admin_id', 'Enter valid admin_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

const createStaffAttendance = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('staff_id', 'Enter valid admin_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('session_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('appointmentSlotNumber', 'Enter valid appointmentSlotNumber')
    .isNumeric()
    .optional(),
];

const markStaffAbsent = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('staff_ids', 'Enter valid staff_ids').custom((value) => {
    if (!Array.isArray(value)) {
      throw new Error('staff_ids must be provided as an array.');
    }

    if (value.some((id) => !isObjectId.test(id))) {
      throw new Error('One or more staff_ids are invalid.');
    }

    return true;
  }),

  body('session_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];
const createManualStaffAttendance = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('staff_ids', 'Enter valid staff_ids').custom((value) => {
    if (!Array.isArray(value)) {
      throw new Error('staff_ids must be provided as an array.');
    }

    if (value.some((id) => !isObjectId.test(id))) {
      throw new Error('One or more staff_ids are invalid.');
    }

    return true;
  }),

  body('session_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('appointmentSlotNumber', 'Enter valid appointmentSlotNumber')
    .isNumeric()
    .optional(),
];

const getAttendeesListingPerSlot = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),

  body('session_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('appointmentSlotNumber', 'Enter valid appointmentSlotNumber')
    .isNumeric()
    .optional(),
  body('pageNo', 'Enter valid pageNo').isNumeric().optional(),
];

const exportAttendeesNew = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),

  body('session_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('timeZone', 'Enter valid timeZone').isNumeric().optional(),
  body('appointmentSlotNumber', 'Enter valid appointmentSlotNumber')
    .isNumeric()
    .optional(),
];

const createRSVPRequest = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),

  body('session_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('staff_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('timeZone', 'Enter valid timeZone')
    .isNumeric()
    .optional({ nullable: true, checkFalsy: true }),
];

const createRSVPRequestMultiple = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('sessionid', 'Enter valid session_id').custom((value) => {
    if (!Array.isArray(value)) {
      throw new Error('session_id must be provided as an array.');
    }

    if (value.some((id) => !isObjectId.test(id))) {
      throw new Error('One or more staff_ids are invalid.');
    }

    return true;
  }),

  body('staff_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

const cancelRSVPRequest = [
  body('rsvp_id', 'Enter valid rsvp_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

const cancelRSVPRequestMultiple = [
  body('rsvpId', 'Enter valid rsvpId').custom((value) => {
    if (!Array.isArray(value)) {
      throw new Error('rsvpId must be provided as an array.');
    }

    if (value.some((id) => !isObjectId.test(id))) {
      throw new Error('One or more rsvpId are invalid.');
    }

    return true;
  }),
];

const getRSVPEventsForUser = [
  body('staff_id', 'Enter valid staff_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('event_id', 'Enter valid event_id')
    .if((value, { req }) => value)
    .matches(isObjectId),
];

const getRSVPAttendanceStatus = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),

  body('session_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
  body('appointmentSlotNumber', 'Enter valid appointmentSlotNumber')
    .isNumeric()
    .optional(),
  body('pageNo', 'Enter valid pageNo').isNumeric().optional(),
  body('apptStatus', 'Enter valid apptStatus').isString().optional(),
];

const getRSVPRequests = [
  body('event_id', 'Enter valid event_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),

  body('session_id', 'Enter valid session_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];
const approveRSVPRequest = [
  body('rsvp_id', 'Enter valid rsvp_id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];
const cancelSession = [
  body('_id', 'Enter valid _id')
    .isAlphanumeric()
    .notEmpty()
    .isString()
    .matches(isObjectId),
];

module.exports = {
  cancelSession,
  approveRSVPRequest,
  getRSVPRequests,
  getRSVPAttendanceStatus,
  getRSVPEventsForUser,
  cancelRSVPRequestMultiple,
  cancelRSVPRequest,
  createRSVPRequestMultiple,
  createRSVPRequest,
  createSession,
  editMultipleSessions,
  getEventDetails,
  getEventSessionDetails,
  getAdminSessions,
  createStaffAttendance,
  markStaffAbsent,
  createManualStaffAttendance,
  getAttendeesListingPerSlot,
  exportAttendeesNew,
};
