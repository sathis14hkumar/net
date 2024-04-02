const FileType = require('file-type');
const path = require('path');
const mime = require('mime');

const __ = require('./globalFunctions');
const { logInfo, logError } = require('./logger.helper');

const checkFile = (fileVariable) =>
  async function (req, res, next) {
    try {
      logInfo('checkFile', {
        soruceUser: req.user._id,
      });
      if (!req[fileVariable]) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      const fileType = await FileType.fromBuffer(req[fileVariable].buffer);

      if (fileType === undefined) {
        // this means it's a text file (discard)
        const allowedExtensions = ['.txt', '.csv'];
        const allowedMimeTypes = [
          'text/plain',
          'text/csv',
          'application/csv',
          'application/vnd.ms-excel',
        ];
        const fileExtension = path
          .extname(req[fileVariable].originalname)
          .toLowerCase();
        const fileMimeType = mime.getType(req[fileVariable].originalname);

        if (
          !(
            allowedExtensions.includes(fileExtension) &&
            allowedMimeTypes.includes(fileMimeType)
          )
        ) {
          return res.badRequest(
            'File type validation failed - Unrecognized format or not a binary file.',
          );
        }
      }

      if (fileType && fileType.mime !== req[fileVariable].mimetype) {
        if (
          (fileType.mime === 'application/x-cfb' &&
            req[fileVariable].mimetype === 'application/msword') ||
          (fileType.mime === 'application/x-cfb' &&
            req[fileVariable].mimetype === 'application/vnd.ms-excel') ||
          (fileType.mime === 'application/x-cfb' &&
            req[fileVariable].mimetype === 'application/vnd.ms-powerpoint')
        ) {
          return next();
        }

        return res.badRequest(
          'File type validation failed - mime type mismatch.',
        );
      }

      return next();
    } catch (e) {
      return res.badRequest(e.message);
    }
  };

const multerFileUploadErrorHandler = (cb) => (req, res, next) => {
  cb(req, res, (err) => {
    if (err) {
      logError('multer error', err);
      return res.error(err);
    }

    return next();
  });
};

module.exports = {
  checkFile,
  multerFileUploadErrorHandler,
};
