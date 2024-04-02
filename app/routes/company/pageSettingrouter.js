const express = require('express');

const pageSettingRouter = express.Router();

const multer = require('multer');
const pageSettingController = require('../../controllers/company/pageSettingController');
const pageSettingValidation = require('../../middleware/validator/pageSettingValidation');
const { fileValidator } = require('../../middleware/validators');
const {
  checkFile,
  multerFileUploadErrorHandler,
} = require('../../../helpers/fileChecker.helper');

const storage = multer.memoryStorage({
  destination(req, file, cb) {
    cb(null, '');
  },
});
const upload = multer({
  storage,
});
const fileUpload = (fieldName) =>
  multerFileUploadErrorHandler(upload.single(fieldName));

pageSettingRouter.get('/read', (req, res) => {
  pageSettingController.read(req, res);
});
/* Allow only admin */
/* Allow only admin */
// pageSettingRouter.use(passport.authenticate('jwt', {
//     session: false
// }),
// function (req, res, next) {
//     next();
// });

pageSettingRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1 || req.url === '/skillset') {
    return next();
  }

  return res.status(402).send('This account is not permitted to access');
});

pageSettingRouter.post(
  '/update',
  pageSettingValidation.updateValidation,
  (req, res) => {
    pageSettingController.update(req, res);
  },
);

pageSettingRouter.post(
  '/updatePwdManage',
  pageSettingValidation.updatePwdManageValidation,
  (req, res) => {
    pageSettingController.updatePwdManage(req, res);
  },
);

pageSettingRouter.post(
  '/uploadFiles',
  fileUpload('file'),
  fileValidator('file').validate,
  checkFile('file'),
  (req, res) => {
    pageSettingController.uploadFiles(req, res);
  },
);
pageSettingRouter.get('/skillset', (req, res) => {
  pageSettingController.readSkillSet(req, res);
});

module.exports = pageSettingRouter;
