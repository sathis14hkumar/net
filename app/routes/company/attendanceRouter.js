const express = require('express');

const attendanceRouter = express.Router();
const {
  attendanceController,
} = require('../../controllers/company/attendanceController');
const attendancePayloadValidation = require('../../middleware/validator/company/attendanceValidation');

attendanceRouter.post(
  '/add',
  attendancePayloadValidation.addPayloadValidation,
  (req, res) => {
    attendanceController.addAttendance(req, res);
  },
);

attendanceRouter.use((req, res, next) => {
  if (
    req.user.isFlexiStaff !== 1 ||
    req.path.includes('breakTime') ||
    req.path.includes('staff')
  )
    return next();

  return res.status(402).send('This account is not permitted to access');
});

attendanceRouter.post('/', (req, res) => {
  attendanceController.update(req, res);
});
attendanceRouter.post(
  '/logs',
  attendancePayloadValidation.logsValidation,
  (req, res) => {
    attendanceController.getLogs(req, res);
  },
);
attendanceRouter.post('/breakTime', (req, res) => {
  attendanceController.updateBreakTime(req, res);
});
attendanceRouter.post('/split/breakTime', (req, res) => {
  attendanceController.updateBreakTimeSplit(req, res);
});
attendanceRouter.post('/delete/breakTime', (req, res) => {
  attendanceController.deleteBreakTime(req, res);
});
attendanceRouter.get(
  '/breakTime/:userId/:shiftDetailId/:splitShiftId',
  (req, res) => {
    attendanceController.getBreakTime(req, res);
  },
);
attendanceRouter.get('/check/:userId/:shiftDetailId', (req, res) => {
  attendanceController.check(req, res);
});
attendanceRouter.get(
  '/staff/:userId/:shiftId/:shiftDetailId/:splitShiftId',
  (req, res) => {
    attendanceController.getStaffAddendance(req, res);
  },
);
attendanceRouter.post('/autoapprove', (req, res) => {
  attendanceController.autoApprove(req, res);
});

module.exports = attendanceRouter;
