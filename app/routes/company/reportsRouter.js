const express = require('express');

const reportsRouter = express.Router();
const reportsController = require('../../controllers/company/reportsController');
const reportValidation = require('../../middleware/validator/company/reportPayloadValidation');

// RENDER

reportsRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) {
    return next();
  }

  return res.status(402).send('This account is not permitted to access');
});
reportsRouter.post(
  '/bookings',
  reportValidation.bookingsPayloadValidation,
  (req, res) => {
    reportsController.bookings(req, res);
  },
);
reportsRouter.post(
  '/listofshifts',
  reportValidation.listofshiftsPayloadValidation,
  (req, res) => {
    reportsController.listOfShifts(req, res);
  },
);
reportsRouter.post(
  '/listofcancellations',
  reportValidation.listofcancellationsPayloadValidation,
  (req, res) => {
    reportsController.listOfCancellations(req, res);
  },
);
reportsRouter.post(
  '/users',
  reportValidation.usersPayloadValidation,
  reportsController.users,
);

module.exports = reportsRouter;
