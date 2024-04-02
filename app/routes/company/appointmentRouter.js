const express = require('express');

const appointmentRouter = express.Router();
const appointmentController = require('../../controllers/company/appointmentController');
const appointmentVelidaton = require('../../middleware/validator/company/appointmentPayloadValidation');

// RENDER
appointmentRouter.get(
  '/getAppointments',
  appointmentController.getAppointments,
);

appointmentRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

appointmentRouter.post(
  '/create',
  appointmentVelidaton.createValidation,
  (req, res) => {
    appointmentController.create(req, res);
  },
);

appointmentRouter.post('/read', (req, res) => {
  appointmentController.read(req, res);
});

appointmentRouter.get('/', (req, res) => {
  appointmentController.getAll(req, res);
});

appointmentRouter.post('/fromuser', (req, res) => {
  appointmentController.getAllAppointmentFromUser(req, res);
});

appointmentRouter.post('/readWithPn', (req, res) => {
  appointmentController.readWithPn(req, res);
});

appointmentRouter.post(
  '/update',
  appointmentVelidaton.updateValidation,
  (req, res) => {
    appointmentController.update(req, res);
  },
);

appointmentRouter.post(
  '/delete',
  appointmentVelidaton.deleteValidation,
  (req, res) => {
    appointmentController.delete(req, res);
  },
);

module.exports = appointmentRouter;
