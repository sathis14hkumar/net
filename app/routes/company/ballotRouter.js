const express = require('express');

const ballotRouter = express.Router();
const uuid = require('node-uuid');
const multer = require('multer');
const path = require('path');
const opsLeaveController = require('../../controllers/company/opsLeaveManagementController');
const leavePlannerValidation = require('../../middleware/validator/company/leavePlannerPayloadValidation');
const leaveBallotValidation = require('../../middleware/validator/company/leaveBallotingPayloadValidation');

const {
  ballot: ballotController,
} = require('../../controllers/company/ballotController');

const storage = multer.diskStorage({
  destination: 'public/uploads/leaves',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
});

ballotRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1 || req.path.includes('staff')) return next();

  return res.status(402).send('This account is not permitted to access');
});
/// create ballot as draft
ballotRouter.post('/', leaveBallotValidation.createBallot, (req, res) => {
  ballotController.create(req, res);
});
ballotRouter.post('/casual', (req, res) => {
  ballotController.createCasual(req, res);
});
/// get ballot list for admin
ballotRouter.get('/', (req, res) => {
  ballotController.readBallots(req, res);
});
// get ballot for staff
ballotRouter.post('/staff', (req, res) => {
  ballotController.readBallotForStaff(req, res);
});
ballotRouter.get('/staff/applied', (req, res) => {
  ballotController.readBallotForStaffApplied(req, res);
});

ballotRouter.post('/createleaves', (req, res) => {
  ballotController.createLeaves(req, res);
});

// This is for local testing only

// ballotRouter.post('/conduct', (req, res) => {
//   conductBallot(req,res)
// });

ballotRouter.get('/staff/getmyleaveplans', (req, res) => {
  ballotController.getUserLeavePlans(req, res);
});
// ballotRouter.post('/staff/applyforslot', (req, res) => {
//     ballotController.staffApplyForSlotMulti(req, res)
// });
ballotRouter.post(
  '/staff/applyforslot',
  leaveBallotValidation.staffApplyforslot,
  (req, res) => {
    ballotController.staffApplyForMultipleSlots(req, res);
  },
);
ballotRouter.post('/staff/cancel/slot', (req, res) => {
  ballotController.staffCancelSlot(req, res);
});

ballotRouter.get('/staff/win/:id', (req, res) => {
  ballotController.winBallotForStaff(req, res);
});
ballotRouter.get('/staff/restriction/:id', (req, res) => {
  ballotController.readRestrictionForStaffForBallot(req, res);
});
// update ballot
ballotRouter.post('/update', leaveBallotValidation.updateBallot, (req, res) => {
  ballotController.update(req, res);
});
ballotRouter.post('/update/casual', (req, res) => {
  ballotController.updateCasual(req, res);
});
// // publish ballot
// ballotRouter.patch('/publish', (req, res) => {
//     ballotController.update(req, res)
// });
// delete
ballotRouter.post('/delete', (req, res) => {
  ballotController.delete(req, res);
});
/// import sap data
ballotRouter.post('/sapdata', (req, res) => {
  ballotController.sapDataImport(req, res);
});

/// staff leave
ballotRouter.post('/staff/annualleave', (req, res) => {
  ballotController.annualLeave(req, res);
});
/// userlist based on ops group or BU during restriction
ballotRouter.post('/user', (req, res) => {
  ballotController.userList(req, res);
});

// swap // suddner
// algo API
ballotRouter.post('/run', (req, res) => {
  ballotController.run(req, res);
});

ballotRouter.get('/getballotAdmins', (req, res) => {
  ballotController.getballotAdmins(req, res);
});

ballotRouter.get('/setting', (req, res) => {
  ballotController.leaveBallotSetting(req, res);
});

ballotRouter.get('/appliedusers/:id', (req, res) => {
  ballotController.getBallotAppliedUsersList(req, res);
});

ballotRouter.post('/extendballot/:id', (req, res) => {
  ballotController.extendBallot(req, res);
});

ballotRouter.post(
  '/cancelballot/:id',
  leaveBallotValidation.cancelballot,
  (req, res) => {
    ballotController.cancelBallotAll(req, res);
  },
);

ballotRouter.get('/reballot/:id', (req, res) => {
  ballotController.reBallot(req, res);
});

ballotRouter.get('/getOpsandteamdata/:id', (req, res) => {
  ballotController.getOpsTeamdropedown(req, res);
});

ballotRouter.get('/manageballot/:id', (req, res) => {
  ballotController.getBallotInRounds(req, res);
});

ballotRouter.post('/detail', (req, res) => {
  ballotController.ballotDetail(req, res);
});

ballotRouter.post('/resultrelease', (req, res) => {
  ballotController.resultRelase(req, res);
});
ballotRouter.post('/detail/all', (req, res) => {
  ballotController.ballotDetailAll(req, res);
});
ballotRouter.post('/consolidatedresult', (req, res) => {
  ballotController.ballotConsolidatedResult(req, res);
});
ballotRouter.get('/ballotdetailsbyusers/:id', (req, res) => {
  ballotController.ballotDetailsByUsers(req, res);
});

ballotRouter.post('/addAsBallotAdmin', (req, res) => {
  ballotController.addAsBallotAdmin(req, res);
});

ballotRouter.get('/getballotadmins', (req, res) => {
  ballotController.getballotAdmins(req, res);
});
ballotRouter.post('/getMobileViewAtWeb', (req, res) => {
  ballotController.getBallotPerStaffData(req, res);
});

ballotRouter.get('/exportballotdata/:id', (req, res) => {
  ballotController.exportBallotByUser(req, res);
});
ballotRouter.post('/saveBallotAsDraft', (req, res) => {
  ballotController.saveBallotAsDraft(req, res);
});
ballotRouter.get('/datatoautoassign/:id', (req, res) => {
  ballotController.getBallotDataToAutoAssing(req, res);
});

ballotRouter.get('/datatoautoassignbystaff/:id', (req, res) => {
  ballotController.getBallotDataToAssignByStaff(req, res);
});

ballotRouter.post('/auto', leaveBallotValidation.autoballot, (req, res) => {
  req.setTimeout(0);
  ballotController.autoResultRelease(req, res);
});

ballotRouter.get('/autoassignedusers/:id', (req, res) => {
  ballotController.getAutoAssignedUsers(req, res);
});

ballotRouter.get('/ballotdetailsforautoassigned/:id', (req, res) => {
  ballotController.ballotDetailsForAutoAssigned(req, res);
});
ballotRouter.get('/sapdata', (req, res) => {
  ballotController.exportleavebalance(req, res);
});
ballotRouter.get('/revertballot', (req, res) => {
  ballotController.revertBallot(req, res);
});
ballotRouter.get('/gettestexport', (req, res) => {
  ballotController.BallotDataByUserTestExport(req, res);
});
ballotRouter.get('/autoAssignballot/:id', (req, res) => {
  req.setTimeout(0);
  ballotController.AutoAssignBallot(req, res);
});
// These Methods are in opsLeaveController.js file
ballotRouter.get('/getballotcalender/:id', (req, res) => {
  opsLeaveController.getOpsLeaveCanlender(req, res);
});
ballotRouter.get('/getballotcalender1/:id', (req, res) => {
  opsLeaveController.opsLeaveDataPage(req, res);
});
ballotRouter.get('/getswapopsgroup/:id', (req, res) => {
  opsLeaveController.opsLeaveDataPageSwap(req, res);
});
ballotRouter.get('/getDateRanges/:id', (req, res) => {
  opsLeaveController.getDateRange(req, res);
});
ballotRouter.post(
  '/addperdayopsquota',
  leavePlannerValidation.addperdayopsquota,
  (req, res) => {
    opsLeaveController.savePerDayOpsQuota(req, res);
  },
);
ballotRouter.get('/getquotabyopsgroups/:id', (req, res) => {
  opsLeaveController.getQuotaByOpsGroup(req, res);
});
ballotRouter.post('/getquotabyopsgroups', (req, res) => {
  opsLeaveController.quotaByOpsGroup(req, res);
});
ballotRouter.post('/getcalenderforyear', (req, res) => {
  opsLeaveController.getCalenderForYear(req, res);
});
ballotRouter.post('/allocateleave', (req, res) => {
  opsLeaveController.allocateLeave(req, res);
});
ballotRouter.post('/mobilescreenforleaves', (req, res) => {
  opsLeaveController.getMobileScreenForLeave(req, res);
});
ballotRouter.post('/cancelleaveofstaff', (req, res) => {
  opsLeaveController.cancelLeaveForStaff(req, res);
});
ballotRouter.post('/changeLeaveDates', (req, res) => {
  opsLeaveController.changeLeaveDates(req, res);
});
ballotRouter.post('/findIfdatassigned', (req, res) => {
  opsLeaveController.findIfDateIsAssigned(req, res);
});
ballotRouter.post('/getleavesbyuser', (req, res) => {
  opsLeaveController.getLeaveByUser(req, res);
});
ballotRouter.post(
  '/userleavelogs',
  leavePlannerValidation.userLeaveLogs,
  (req, res) => {
    opsLeaveController.getUserLeaveLogs(req, res);
  },
);
ballotRouter.post(
  '/getuserslistwithswap',
  leavePlannerValidation.getuserslistwithswapBallot,
  (req, res) => {
    opsLeaveController.getUsersListWithSwapNew(req, res);
  },
);
ballotRouter.post(
  '/swaprestricttouser/:userid',
  leavePlannerValidation.swaprestricttouserBallot,
  (req, res) => {
    opsLeaveController.swapRestrictToUser(req, res);
  },
);

// Staff API's for leavemanagement.
ballotRouter.post('/staff/applyforleave', (req, res) => {
  opsLeaveController.applyForLeave(req, res);
});

ballotRouter.get('/staff/getmyholidayslist', (req, res) => {
  opsLeaveController.getMyLeaves(req, res);
});
// 1.uploading file
ballotRouter.post(
  '/staff/uploadattachment',
  upload.single('file'),
  (req, res) => {
    opsLeaveController.uploadAtachment(req, res);
  },
);
ballotRouter.get('/staff/getleavebyid/:id', (req, res) => {
  opsLeaveController.getLeaveById(req, res);
});
ballotRouter.post('/staff/updateleave', (req, res) => {
  opsLeaveController.updateLeave(req, res);
});

// Swoping of Ballots and leaves  controllers are in opsLeaveController
ballotRouter.post('/staff/getswapdetails', (req, res) => {
  opsLeaveController.getSwapDetailChanges(req, res);
  // When getting details to swop for both ballots and leaves fot mobile requests
  // request object for ballots swop is ballotId and slotNo
  // equest object for userHoliday i.e to get casual and Block leaves request object is leaveId.
});
ballotRouter.post('/staff/getslotswonByUser', (req, res) => {
  opsLeaveController.getslotswonByUser(req, res);
  /**
     * To get slot Wons Request Objects are 
     * for ballots -> request object has 
     *  {
  "start":"2020-03-02",
  "end" : "2020-03-08",
  "ballotId": "5e42955585469902a7a1a81b",
  "opsGroupId":"5da8838cbfe5452e7ccee516",
  "userId":"5da8180365740224f0bb1aad"
     }
     * for ballots -> request object has  {
  "ballotId":"5e2fceef13b34f6457ab2b0a",
  "userId":"5d7f7fa2a0945c777f17994a",
  "slotNo":1
      }  
     * for userHolidays -> request object has 
       {
      "start":"2020-01-15",
      "end" : "2020-01-17",
      "opsGroupId":"5d96dcc62cb1302091561925",
      "leaveType":2
      }
     */
});
ballotRouter.post('/staff/swoprequest', (req, res) => {
  opsLeaveController.saveSwopRequest(req, res);
  /**
     * To save ballot slots swop request ->
     * Request object is 
     * {
  "ballotId":"5dd8ff786253dc44cbcc1d7a",
  "userFrom":"5da8180365740224f0bb1aad",
  "userTo":"5da8185065740224f0bb1aae",
  "slotNumberFrom":1,
  "slotNumberTo":0,
    "opsGroupId":"5da8838cbfe5452e7ccee516"
    "ballotIdTo":""
      }
      AND
      To save swop of allocated block and casual leaves ->
      Request object is
      {
         "userFrom":"5da8180365740224f0bb1aad",
        "userTo":"5da8185065740224f0bb1aae",
        "opsGroupId":"5da8838cbfe5452e7ccee516",
        "leaveFrom":"5e182292c7b51270a9b0a174",
        "leaveTo":"5e18294eee4296724c3e2cbd"
      }
     */
});
ballotRouter.post('/staff/getmyreceivedrequest', (req, res) => {
  opsLeaveController.getMyReceivedSwapRequests(req, res);

  /** To get received requests for ballots api is:
     * request {
  "ballotId":"5dd8ff786253dc44cbcc1d7a",
  "userId":"5da8185065740224f0bb1aae",
  "slotNo":2
     }
     For received requests for getting leaves is 
     {
         "userId":"loged in user id".
         "leaveId":"userHolidayId"
     }

    */
});
ballotRouter.post('/staff/acceptswaprequest', (req, res) => {
  opsLeaveController.acceptSwopRequest(req, res);
});
ballotRouter.post('/staff/getmyTeam', (req, res) => {
  opsLeaveController.getMyTeamMembers(req, res);

  // Request object need is date in "DD-mm-yyyy" format
});

ballotRouter.post('/staff/getleavedetails', (req, res) => {
  opsLeaveController.getLeaveDetails(req, res);
  // req objects are
  // ballotId and weekNO for ballot leave and userId
  // leaveId and userId for userleave
});
ballotRouter.post('/getswaplogs', (req, res) => {
  opsLeaveController.getSwapLogs(req, res);
});
ballotRouter.post('/staff/getmysentrequest', (req, res) => {
  opsLeaveController.getMySentSwapRequests(req, res);

  /** To get sent requests for ballots api is:
     * request {
  "ballotId":"5dd8ff786253dc44cbcc1d7a",
  "userId":"5da8185065740224f0bb1aae",
  "slotNo":2
     }
     For received requests for getting leaves is 
     {
         "userId":"loged in user id".
         "leaveId":"userHolidayId"
     }

    */
});
ballotRouter.post('/staff/cancelmyswoprequest/:id', (req, res) => {
  opsLeaveController.cancelMySwopRequest(req, res);
});
ballotRouter.post('/autoterminate', (req, res) => {
  opsLeaveController.autoTerminateSwapRequest(req, res);
});
module.exports = ballotRouter;
