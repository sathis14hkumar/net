const express = require('express');

const wallPostRouter = express.Router();
const uuid = require('node-uuid');
const multer = require('multer');
const path = require('path');
const wallPostController = require('../../controllers/common/wallPostController');

const storage = multer.diskStorage({
  destination: 'public/uploads/wall',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
});

wallPostRouter.post('/createPost', (req, res) => {
  wallPostController.createPost(req, res);
});

wallPostRouter.post('/uploadFiles', upload.single('file'), (req, res) => {
  wallPostController.uploadFiles(req, res);
});

wallPostRouter.post('/update', (req, res) => {
  wallPostController.updatePost(req, res);
});

wallPostRouter.post('/delete', (req, res) => {
  wallPostController.deletePost(req, res);
});

wallPostRouter.post('/like', (req, res) => {
  wallPostController.likePost(req, res);
});

wallPostRouter.post('/addEmoji', (req, res) => {
  wallPostController.addEmoji(req, res);
});

wallPostRouter.post('/comment', (req, res) => {
  wallPostController.commentPost(req, res);
});

wallPostRouter.post('/share', (req, res) => {
  wallPostController.sharePost(req, res);
});

wallPostRouter.post('/deleteComment', (req, res) => {
  wallPostController.deleteComment(req, res);
});

wallPostRouter.post('/addTask', (req, res) => {
  wallPostController.addTask(req, res);
});

wallPostRouter.post('/addNominees', (req, res) => {
  wallPostController.addNominees(req, res);
});

module.exports = wallPostRouter;
