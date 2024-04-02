const express = require('express');

const leaveManagementRouter = express.Router();
const multer = require('multer');
const uuid = require('node-uuid');
const path = require('path');
const leaveManagementController = require('../../controllers/company/leaveManagementController');
const leaveManagmentValidation = require('../../middleware/validator/company/leavePlannerPayloadValidation');

const storage = multer.diskStorage({
  destination: 'public/uploads/leaveManagementAttachment',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
});

// RENDER

leaveManagementRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) next();
  else next();
  // return res.status(402).send('This account is not permitted to access');
});

leaveManagementRouter.post('/type/leaverequest', (req, res) => {
  leaveManagementController.leaveRequestType(req, res);
});
leaveManagementRouter.post('/type/allleavetype', (req, res) => {
  leaveManagementController.allLeaveType(req, res);
});
leaveManagementRouter.post('/type/applyleave', (req, res) => {
  leaveManagementController.applyLeaveType(req, res);
});
leaveManagementRouter.post('/type/applyleaveplan', (req, res) => {
  leaveManagementController.applyLeavePlanType(req, res);
});
leaveManagementRouter.post('/type/leaveAllocation', (req, res) => {
  leaveManagementController.leaveAllocationLeaveType(req, res);
});
leaveManagementRouter.post('/leave/apply/leaverequest', (req, res) => {
  leaveManagementController.applyLeaveRequest(req, res);
});
leaveManagementRouter.post('/leave/apply', (req, res) => {
  leaveManagementController.applyLeave(req, res);
});
leaveManagementRouter.post('/leave/reject', (req, res) => {
  leaveManagementController.applyReject(req, res);
});
leaveManagementRouter.post(
  '/uploadContentFiles',
  upload.single('file'),
  (req, res) => {
    leaveManagementController.uploadContentFiles(req, res);
  },
);
leaveManagementRouter.post('/appliedLeave', (req, res) => {
  leaveManagementController.getAppliedLeaves(req, res);
});
leaveManagementRouter.get('/appliedLeave/bu', (req, res) => {
  leaveManagementController.getAppliedLeavesFromBu(req, res);
});
leaveManagementRouter.post('/leavetype/count', (req, res) => {
  leaveManagementController.leaveTypeCount(req, res);
});
leaveManagementRouter.post('/leavetype/appliedleave', (req, res) => {
  leaveManagementController.getLeaveTypeAppliedLeaves(req, res);
});

leaveManagementRouter.post('/staff/appliedLeave', (req, res) => {
  leaveManagementController.getAppliedLeavesForStaff(req, res);
});
leaveManagementRouter.post('/staff/leaverequest', (req, res) => {
  leaveManagementController.getLeavesRequestForStaff(req, res);
});
leaveManagementRouter.post('/staff/allocatedleave', (req, res) => {
  leaveManagementController.getAllocatedBallotedForStaff(req, res);
});
leaveManagementRouter.post(
  '/leave/status',
  leaveManagmentValidation.leaveStatus,
  (req, res) => {
    // approve by admin
    leaveManagementController.updateLeaveStatus(req, res);
  },
);
leaveManagementRouter.post(
  '/allocatteleave',
  leaveManagmentValidation.allocatteleave,
  (req, res) => {
    // allocated by admin
    leaveManagementController.allocateLeave(req, res);
  },
);
leaveManagementRouter.post(
  '/allocateleavechangedate',
  leaveManagmentValidation.allocateLeaveChangeDate,
  (req, res) => {
    // change by admin
    leaveManagementController.allocateLeaveChangeDate(req, res);
  },
);
leaveManagementRouter.post(
  '/checkoverlap',
  leaveManagmentValidation.checkOverLap,
  (req, res) => {
    leaveManagementController.checkIsLeaveOverlap(req, res);
  },
);
leaveManagementRouter.post('/leave/applyallocatedballoted', (req, res) => {
  leaveManagementController.applyAllocatedBallotedLeave(req, res);
});
leaveManagementRouter.post('/teammember', (req, res) => {
  leaveManagementController.getMyTeamMembers(req, res);
});
leaveManagementRouter.post('/leavesbybu', (req, res) => {
  // get leaves by BU selected
  leaveManagementController.getLeavesByBu(req, res);
});
leaveManagementRouter.post('/staff/cancel', (req, res) => {
  // cancel leave by staff approved
  leaveManagementController.cancelAllocation(req, res);
});
module.exports = leaveManagementRouter;
