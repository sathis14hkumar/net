const express = require('express');

const externalRouter = new express.Router();
const multer = require('multer');
const uuid = require('node-uuid');
const path = require('path');
const challengeController = require('../controllers/common/challengeController');
const moduleController = require('../controllers/common/questionModuleController');
const customFormController = require('../controllers/company/customFormController');

const storage = multer.diskStorage({
  destination: 'public/uploads/customForm',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
});

externalRouter.post('/readExternalDatas/', (req, res) => {
  customFormController.readExternalCustomFormData(req, res);
});
externalRouter.post('/readExternalData', (req, res) => {
  moduleController.getInternalModuleQuestions(req, res);
});
externalRouter.post('/uploadFiles/', upload.single('file'), (req, res) => {
  customFormController.uploadContentFiles(req, res);
});
externalRouter.post('/resQuestions/', (req, res) => {
  moduleController.resCustomFormQuestions(req, res);
});

externalRouter.post('/getChannelOrBoardsUsers', (req, res) => {
  challengeController.getChannelOrBoardsUsers(req, res);
});

module.exports = externalRouter;
