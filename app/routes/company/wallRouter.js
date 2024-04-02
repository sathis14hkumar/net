const express = require('express');

const wallRouter = express.Router();
const uuid = require('node-uuid');
const multer = require('multer');
const path = require('path');
const wallController = require('../../controllers/company/wallController');
const __ = require('../../../helpers/globalFunctions');

const { validateRequestExactMatch } = require('../../middleware/validators');

const {
  createWall,
  updateWall,
  reviewPostWall,
  updateStatusWall,
} = require('../../middleware/validator/company/wallPayloadValidation');

const storage = multer.diskStorage({
  destination: 'public/uploads/wall',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
});

wallRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

// 1.uploading banner Image
wallRouter.post('/uploadFiles', upload.single('file'), (req, res) => {
  wallController.uploadFiles(req, res);
});

// 2.Creating new category
wallRouter.post('/addCategory', (req, res) => {
  wallController.addCategory(req, res);
});

// 3.Adding newWall
wallRouter.post(
  '/add',
  createWall,
  validateRequestExactMatch,
  __.checkRole('manageWall').validate,
  (req, res) => {
    wallController.addWall(req, res);
  },
);

// 4.Updating existingWall
wallRouter.post(
  '/update',
  updateWall,
  validateRequestExactMatch,
  __.checkRole('manageWall').validate,
  (req, res) => {
    wallController.updateWall(req, res);
  },
);

// 5.Remove Wall
wallRouter.post('/delete', __.checkRole('manageWall').validate, (req, res) => {
  wallController.delete(req, res);
});

// 6.Get all wall
wallRouter.get('/read', (req, res) => {
  wallController.read(req, res);
});

// 6.Get single wall summary
wallRouter.get('/readOne', (req, res) => {
  wallController.readOne(req, res);
});

// Read Reported posts
wallRouter.get('/reportedPosts', (req, res) => {
  wallController.reportedPosts(req, res);
});

// Read Reported posts
wallRouter.post(
  '/reviewPost',
  reviewPostWall,
  validateRequestExactMatch,
  (req, res) => {
    wallController.reviewPost(req, res);
  },
);

wallRouter.get('/reportedComments', (req, res) => {
  wallController.reportedComments(req, res);
});

wallRouter.post(
  '/updateStatus',
  updateStatusWall,
  validateRequestExactMatch,
  (req, res) => {
    wallController.updateStatus(req, res);
  },
);

wallRouter.post('/exportWallPost', (req, res) => {
  wallController.exportWallPost(req, res);
});

wallRouter.get('/getWallPostDetails', (req, res) => {
  wallController.getWallPostsList(req, res);
});

wallRouter.get('/buToolQueryChecking', (req, res) => {
  wallController.buToolQueryChecking(req, res);
});

wallRouter.get('/getCompanyWalls', (req, res) => {
  wallController.getCompanyWalls(req, res);
});

module.exports = wallRouter;
