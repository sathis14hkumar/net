const express = require('express');

const newLeavePlannerRouter = express.Router();
const newLeavePlannerController = require('../../controllers/company/newLeavePlannerController');

const leavePlannerValidation = require('../../middleware/validator/company/leavePlannerPayloadValidation');
// RENDER

newLeavePlannerRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) next();
  else next();
});

newLeavePlannerRouter.post(
  '/leavetype',
  leavePlannerValidation.leavetypeNewleaveplanner,
  (req, res) => {
    // check if user role has access to this module
    newLeavePlannerController.getLeaveType(req, res);
  },
);
newLeavePlannerRouter.post(
  '/leavetype/bu',
  leavePlannerValidation.leaveTypeBu,
  (req, res) => {
    // check if user role has access to this module
    newLeavePlannerController.getLeaveTypeBu(req, res);
  },
);
newLeavePlannerRouter.post(
  '/usersbydate',
  leavePlannerValidation.usersByDate,
  (req, res) => {
    // check if user role has access to this module
    newLeavePlannerController.getUsersByDate(req, res);
  },
);
newLeavePlannerRouter.post(
  '/export',
  leavePlannerValidation.exportLeavePlanner,
  (req, res) => {
    // check if user role has access to this module
    newLeavePlannerController.export(req, res);
  },
);
newLeavePlannerRouter.post(
  '/usersbydate/bu',
  leavePlannerValidation.usersbydateBu,
  (req, res) => {
    // check if user role has access to this module
    newLeavePlannerController.getUsersByDateBu(req, res);
  },
);
newLeavePlannerRouter.post(
  '/staffleavetype',
  leavePlannerValidation.staffLeaveType,
  (req, res) => {
    // check if user role has access to this module
    newLeavePlannerController.getStaffLeaveType(req, res);
  },
);
newLeavePlannerRouter.post('/allocateleave', (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.allocateLeave(req, res);
});
newLeavePlannerRouter.post('/mobilescreenforleaves', (req, res) => {
  // check if user role has access to this module
  newLeavePlannerController.mobileScreenForLeaves(req, res);
});
newLeavePlannerRouter.post(
  '/cancel',
  leavePlannerValidation.cancelNewleaveplanner,
  (req, res) => {
    // check if user role has access to this module
    newLeavePlannerController.cancelAllocation(req, res);
  },
);

module.exports = newLeavePlannerRouter;
