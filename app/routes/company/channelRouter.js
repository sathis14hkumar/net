const express = require('express');

const channelRouter = express.Router();
const channelController = require('../../controllers/company/channelController');
const __ = require('../../../helpers/globalFunctions');

const { validateRequestExactMatch } = require('../../middleware/validators');

const {
  createChannel,
  updateChannel,
} = require('../../middleware/validator/company/channelPayloadValidation');

// RENDER

channelRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) {
    return next();
  }

  return res.status(402).send('This account is not permitted to access');
});

channelRouter.post(
  '/',
  createChannel,
  validateRequestExactMatch,
  __.checkRole('channelSetup').validate,
  (req, res) => {
    channelController.create(req, res);
  },
);

channelRouter.post(
  '/:channelId',
  updateChannel,
  validateRequestExactMatch,
  __.checkRole('channelSetup').validate,
  (req, res) => {
    channelController.update(req, res);
  },
);

// API transform
channelRouter.get('/', (req, res) => {
  channelController.read(req, res);
});

channelRouter.get('/getChannelsForAdmin', (req, res) => {
  channelController.getChannelsForAdmin(req, res);
});

// API transform
channelRouter.get('/:channelId', (req, res) => {
  channelController.readOne(req, res);
});

channelRouter.post('/readOneChannel', (req, res) => {
  channelController.readOneChannel(req, res);
});

channelRouter.get('/remove/:channelId', (req, res) => {
  channelController.remove(req, res);
});
channelRouter.post('/getChannelUsers', (req, res) => {
  channelController.getChannelUsers(req, res);
});

channelRouter.post('/export', (req, res) => {
  channelController.exportReport(req, res);
});

module.exports = channelRouter;
