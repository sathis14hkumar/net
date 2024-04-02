const express = require('express');

const oopsGroupRouter = express.Router();
const oopsGroupController = require('../../controllers/company/opsGroupController');
const opsGroupValidation = require('../../middleware/validator/company/opsGroupPayloadValidation');

oopsGroupRouter.use((req, res, next) => {
  if (
    req.user.isFlexiStaff !== 1 ||
    req.path.includes('breakTime') ||
    req.path.includes('staff')
  )
    return next();

  return res.status(402).send('This account is not permitted to access');
});
oopsGroupRouter.post('/', opsGroupValidation.createValidation, (req, res) => {
  oopsGroupController.create(req, res);
});
oopsGroupRouter.post(
  '/update',
  opsGroupValidation.updateValidation,
  (req, res) => {
    oopsGroupController.update(req, res);
  },
);
oopsGroupRouter.post('/get', (req, res) => {
  oopsGroupController.readAll(req, res);
});
oopsGroupRouter.get('/team/:buId', (req, res) => {
  oopsGroupController.readWithTeam(req, res);
});
oopsGroupRouter.post('/dropdown', (req, res) => {
  oopsGroupController.readDropDown(req, res);
});

oopsGroupRouter.get('/detail/:opsGroupId', (req, res) => {
  oopsGroupController.opsDetails(req, res);
});
oopsGroupRouter.post('/adminlist', (req, res) => {
  oopsGroupController.adminList(req, res);
});
oopsGroupRouter.get('/validate/:name', (req, res) => {
  oopsGroupController.validateOpsGroup(req, res);
});

oopsGroupRouter.post('/unassign/stafflist', (req, res) => {
  oopsGroupController.unAssignStaffList(req, res);
});
oopsGroupRouter.post('/assign/stafflist', (req, res) => {
  oopsGroupController.assignStaffList(req, res);
});
oopsGroupRouter.post('/team/stafflist', (req, res) => {
  oopsGroupController.teamStaff(req, res);
});
oopsGroupRouter.post('/ops/stafflist', (req, res) => {
  oopsGroupController.opsGroupStaff(req, res);
});
oopsGroupRouter.post('/ops/team', (req, res) => {
  oopsGroupController.opsGroupTeam(req, res);
});
oopsGroupRouter.post(
  '/remove/staff',
  opsGroupValidation.removeStaffValidation,
  (req, res) => {
    oopsGroupController.removeStaffByUserId(req, res);
  },
);
oopsGroupRouter.post('/transfertoopsgroup', (req, res) => {
  oopsGroupController.transferToOpsGroup(req, res);
});
// no use below

oopsGroupRouter.post('/buName', (req, res) => {
  oopsGroupController.buName(req, res);
});

oopsGroupRouter.post('/getUsersByBuId', (req, res) => {
  oopsGroupController.getUsersByBuId(req, res);
});
// ops group system Admin
// read Admin based on BU
oopsGroupRouter.get('/sysadmin/admin', (req, res) => {
  oopsGroupController.getSysAdmin(req, res);
});
// add admin
oopsGroupRouter.post('/sysadmin/admin', (req, res) => {
  oopsGroupController.addSysAdmin(req, res);
});
// update admin
oopsGroupRouter.post('/sysadmin/putadmin', (req, res) => {
  oopsGroupController.updateSysAdmin(req, res);
});
// get unassign admin
oopsGroupRouter.get('/sysadmin/admin/unused', (req, res) => {
  oopsGroupController.unusedAdmin(req, res);
});
// get unassigned staff
oopsGroupRouter.get('/sysadmin/staff/unused', (req, res) => {
  oopsGroupController.unusedStaffReadOnly(req, res);
});
// read unassign BU
oopsGroupRouter.get('/sysadmin/unassignbu', (req, res) => {
  oopsGroupController.getUnassignBu(req, res);
});
// read unassign BU
oopsGroupRouter.get('/sysadmin/unassignbuforview', (req, res) => {
  oopsGroupController.getUnassignBuForViewOnly(req, res);
});
// read admin with BU
oopsGroupRouter.get('/sysadmin/admin/:id', (req, res) => {
  oopsGroupController.getAdminDeatils(req, res);
});
// update admin with BU
oopsGroupRouter.post('/sysadmin/admin/:id', (req, res) => {
  oopsGroupController.updateAdmin(req, res);
});

oopsGroupRouter.post('/remove/bu', (req, res) => {
  oopsGroupController.removeBuFromOpsGroup(req, res);
});
oopsGroupRouter.post('/export', (req, res) => {
  oopsGroupController.exportOpsGroup(req, res);
});

oopsGroupRouter.post('/importstaff', (req, res) => {
  oopsGroupController.importOpsGroup(req, res);
});
oopsGroupRouter.get('/importlogs/:id', (req, res) => {
  oopsGroupController.importCsvLogs(req, res);
});
oopsGroupRouter.get('/planbu', (req, res) => {
  oopsGroupController.getplanbu(req, res);
});
oopsGroupRouter.get('/bu/adminlist', (req, res) => {
  oopsGroupController.adminListForBu(req, res);
});
oopsGroupRouter.post(
  '/:opsGroupId',
  opsGroupValidation.deleteValidation,
  (req, res) => {
    oopsGroupController.delete(req, res);
  },
);

module.exports = oopsGroupRouter;
