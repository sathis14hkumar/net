const express = require('express');

const eventSessionRouter = express.Router();
const multer = require('multer');
const path = require('path');
const eventSessionController = require('../../controllers/company/eventSessionController');
const {
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
  createRSVPRequest,
  createRSVPRequestMultiple,
  cancelRSVPRequest,
  cancelRSVPRequestMultiple,
  getRSVPEventsForUser,
  getRSVPAttendanceStatus,
  getRSVPRequests,
  approveRSVPRequest,
  cancelSession,
} = require('../../middleware/validator/company/eventSessionValidation');
const {
  validateRequest,
  validateRequestExactMatch,
} = require('../../middleware/validators');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'public/uploads/event/');
  },
  filename(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
  },
});
//
const upload = multer({ storage });

// may not not in use
eventSessionRouter.post('/create', upload.any(), (req, res) => {
  eventSessionController.createEvent(req, res);
});
// may not not in use
eventSessionRouter.post('/list', upload.any(), (req, res) => {
  eventSessionController.fetchEvents(req, res);
});

eventSessionRouter.post(
  '/get',
  getEventDetails,
  validateRequestExactMatch,
  upload.any(),
  (req, res) => {
    eventSessionController.getEventDetails(req, res);
  },
);
// may not not in use
eventSessionRouter.post('/update', upload.any(), (req, res) => {
  eventSessionController.editEvent(req, res);
});

eventSessionRouter.post(
  '/delete',
  getEventDetails,
  validateRequestExactMatch,
  upload.any(),
  (req, res) => {
    eventSessionController.deleteEvent(req, res);
  },
);

eventSessionRouter.post(
  '/session/create',
  upload.any(),
  createSession,
  validateRequest,
  (req, res) => {
    eventSessionController.createSession(req, res);
  },
);
// may not not in use
eventSessionRouter.post('/session/update', upload.any(), (req, res) => {
  eventSessionController.editEventSession(req, res);
});

eventSessionRouter.post(
  '/session/editMultipleSessions',
  upload.any(),
  editMultipleSessions,
  validateRequest,
  (req, res) => {
    eventSessionController.editMultipleSessions(req, res);
  },
);

eventSessionRouter.post(
  '/session/get',
  upload.any(),
  getEventSessionDetails,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.getEventSessionDetails(req, res);
  },
);

eventSessionRouter.post(
  '/session/getSessionsByPost',
  upload.any(),
  getEventDetails,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.getSessionsByPost(req, res);
  },
);
eventSessionRouter.post(
  '/session/getSessionsByPostByUser',
  upload.any(),
  getEventDetails,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.getSessionsByPostByUser(req, res);
  },
);
eventSessionRouter.get(
  '/session/getSessionsForUser',
  upload.any(),
  (req, res) => {
    eventSessionController.getSessionsForUser(req, res);
  },
);
eventSessionRouter.get(
  '/session/getAllSessionsForUser',
  upload.any(),
  (req, res) => {
    eventSessionController.getAllSessionsForUser(req, res);
  },
);
eventSessionRouter.post(
  '/get-admin-sessions',
  upload.any(),
  getAdminSessions,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.getAdminSessions(req, res);
  },
);

eventSessionRouter.post(
  '/attendance',
  upload.any(),
  createStaffAttendance,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.createStaffAttendance(req, res);
  },
);

eventSessionRouter.post(
  '/attendance/mark-absent',
  upload.any(),
  markStaffAbsent,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.markStaffAbsent(req, res);
  },
);

eventSessionRouter.post(
  '/attendance/manual',
  upload.any(),
  createManualStaffAttendance,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.createManualStaffAttendance(req, res);
  },
);

eventSessionRouter.post(
  '/attendance/list-attendees',
  upload.any(),
  getAttendeesListingPerSlot,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.getAttendeesListingPerSlot(req, res);
  },
);

eventSessionRouter.post(
  '/attendance/export-attendees',
  upload.any(),
  exportAttendeesNew,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.exportAttendeesNew(req, res);
  },
);

eventSessionRouter.post(
  '/rsvp/create',
  upload.any(),
  createRSVPRequest,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.createRSVPRequest(req, res);
  },
);
eventSessionRouter.post(
  '/rsvp/multiple/create',
  upload.any(),
  createRSVPRequestMultiple,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.createRSVPRequestMultiple(req, res);
  },
);
eventSessionRouter.post(
  '/rsvp/cancel',
  upload.any(),
  cancelRSVPRequest,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.cancelRSVPRequest(req, res);
  },
);
eventSessionRouter.post(
  '/rsvp/multiple/cancel',
  upload.any(),
  cancelRSVPRequestMultiple,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.cancelRSVPRequestMultiple(req, res);
  },
);

eventSessionRouter.post(
  '/rsvp/list',
  upload.any(),
  getRSVPEventsForUser,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.getRSVPEventsForUser(req, res);
  },
);

eventSessionRouter.post(
  '/rsvp/list-attendees',
  upload.any(),
  getRSVPAttendanceStatus,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.getRSVPAttendanceStatus(req, res);
  },
);

eventSessionRouter.post(
  '/session/rsvp/list',
  upload.any(),
  getRSVPRequests,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.getRSVPRequests(req, res);
  },
);

eventSessionRouter.post(
  '/rsvp/approve',
  upload.any(),
  approveRSVPRequest,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.approveRSVPRequest(req, res);
  },
);

eventSessionRouter.post(
  '/rsvp/reject',
  upload.any(),
  approveRSVPRequest,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.rejectRSVPRequest(req, res);
  },
);

eventSessionRouter.post(
  '/session/cancelSession',
  cancelSession,
  validateRequestExactMatch,
  (req, res) => {
    eventSessionController.cancelSession(req, res);
  },
);
module.exports = eventSessionRouter;
