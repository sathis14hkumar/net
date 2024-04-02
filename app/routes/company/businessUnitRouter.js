const express = require('express');

const businessUnitRouter = express.Router();
const businessUnitController = require('../../controllers/company/businessUnitController');
const __ = require('../../../helpers/globalFunctions');
const buShiftValidation = require('../../middleware/validator/company/buShiftPayloadValidation');

// RENDER
businessUnitRouter.get(
  '/getBusinessUnits',
  businessUnitController.getBusinessUnits,
);
businessUnitRouter.post(
  '/getPlannedHrs',
  businessUnitController.getBusinessUnitDetails,
);

businessUnitRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1 || req.path.includes('weekNo')) return next();

  return res.status(402).send('This account is not permitted to access');
});

businessUnitRouter.post('/updatelocation', () => {
  businessUnitController.updateLocation();
});

businessUnitRouter.post('/getPlannedHrs', (req, res) => {
  businessUnitController.getBusinessUnitDetails(req, res);
});

businessUnitRouter.post('/updateskillset', (req, res) => {
  businessUnitController.updateSkillSet(req, res);
});

businessUnitRouter.post('/skillsetsandlocations', (req, res) => {
  businessUnitController.skillSetsAndLocations(req, res);
});

businessUnitRouter.post('/read', (req, res) => {
  businessUnitController.read(req, res);
});
businessUnitRouter.post('/read/singlebu', (req, res) => {
  businessUnitController.readSingleBu(req, res);
});
businessUnitRouter.post('/read/new', (req, res) => {
  businessUnitController.readNew(req, res);
});
businessUnitRouter.get('/readWithPn', (req, res) => {
  businessUnitController.readWithPn(req, res);
});
businessUnitRouter.get('/v2/readWithPn', (req, res) => {
  businessUnitController.readWithPnV2(req, res);
});
businessUnitRouter.post('/buScheme', (req, res) => {
  businessUnitController.buScheme(req, res);
});
businessUnitRouter.get('/buScheme/:subSectionId', (req, res) => {
  businessUnitController.buSchemeGet(req, res);
});
businessUnitRouter.post('/userScheme', (req, res) => {
  businessUnitController.userScheme(req, res);
});
businessUnitRouter.get('/userScheme/:userId', (req, res) => {
  businessUnitController.userSchemeGet(req, res);
});
businessUnitRouter.get('/categories/:id', (req, res) => {
  businessUnitController.getCategories(req.params.id, res);
});

businessUnitRouter.get('/getUsers/:businessUnitId', (req, res) => {
  businessUnitController.getUsers(req, res);
});
businessUnitRouter.get('/weekNo/:businessUnitId', (req, res) => {
  businessUnitController.weekNo(req, res);
});

businessUnitRouter.post(
  '/updateskillsetandlocation',
  buShiftValidation.updateskillsetandlocationValidation,
  __.checkRole('businessUserSetup').validate,
  (req, res) => {
    businessUnitController.updateSkillSetAndLocation(req, res);
  },
);

businessUnitRouter.post(
  '/updateBuShiftScheme',
  buShiftValidation.updateBuShiftSchemePayloadValidation,
  __.checkRole('businessUserSetup').validate,
  (req, res) => {
    businessUnitController.updateBuShiftScheme(req, res);
  },
);

businessUnitRouter.post('/updateAppointmentList', (req, res) => {
  businessUnitController.updateAppointmentList(req, res);
});

businessUnitRouter.post('/getAppointments', (req, res) => {
  businessUnitController.getAppointments(req, res);
});

businessUnitRouter.get('/orgnameScript', (req, res) => {
  businessUnitController.orgnameScript(req, res);
});

businessUnitRouter.get('/planBU/addedShiftSetup', (req, res) => {
  businessUnitController.planBUAddedShiftSetup(req, res);
});

businessUnitRouter.get('/setting/:businessUnitId', (req, res) => {
  businessUnitController.getBusinessUnitSetting(req, res);
});

businessUnitRouter.get('/:businessUnitId/geolocation', async (req, res) => {
  businessUnitController.getSingleGeoLocation(req, res);
});

module.exports = businessUnitRouter;
