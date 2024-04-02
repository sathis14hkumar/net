const express = require('express');

const csvDownloadRouter = express.Router();
const csvDownloadControllers = require('../../controllers/common/csv-download-controller');

csvDownloadRouter.get('', (req, res) => {
  csvDownloadControllers.downloadCsvControllerNew(req, res);
});

module.exports = csvDownloadRouter;
