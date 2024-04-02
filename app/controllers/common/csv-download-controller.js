const path = require('path');
const mime = require('mime-types');
const __ = require('../../../helpers/globalFunctions');

const downloadCsvControllerNew = function (req, res) {
  try {
    let csvFile = req.originalUrl.replace(/^\/uploads\/\d+\//, '');
    let type = csvFile.substring(csvFile.lastIndexOf('.') + 1);

    if (type.includes('/')) {
      type = type.slice(0, -1);
    }

    if (req.headers['sec-fetch-site'] === 'same') {
      req.headers.setHeader('sec-fetch-site', 'cross');
    }

    res.setHeader('Content-Type', mime.contentType(type));
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    if (csvFile.includes('uploads/1/challenge/')) {
      csvFile = csvFile.replace('uploads/1/', '');
    }

    if (csvFile[csvFile.length - 1] === '/') {
      csvFile = csvFile.slice(0, -1);
    }

    const safeDirectory = '/public';
    const absPathToCSV = path.join(
      __dirname,
      '..',
      '..',
      '..',
      safeDirectory,
      csvFile,
    );

    return res.sendFile(absPathToCSV);
  } catch (err) {
    return __.out(res, 300, err.message);
  }
};

module.exports = { downloadCsvControllerNew };
