const express = require('express');

const LogRouter = express.Router();
const logController = require('../controllers/common/logController');

LogRouter.post('/setLog', (req, res) => {
  logController.setLog(req, res);
});
module.exports = LogRouter;
