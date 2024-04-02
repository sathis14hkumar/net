const express = require('express');

const EmojiRouter = express.Router();
const uuid = require('node-uuid');
const multer = require('multer');
const path = require('path');
const EmojiControllers = require('../../controllers/common/emojiController');

const { fileValidator } = require('../../middleware/validators');

const storage = multer.diskStorage({
  destination: 'public/uploads/emojis',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
});

EmojiRouter.post(
  '/uploadEmoji',
  upload.single('file'),
  fileValidator('file').validate,
  (req, res) => {
    EmojiControllers.upload(req, res);
  },
);

EmojiRouter.get('/getEmojis', (req, res) => {
  EmojiControllers.get(req, res);
});

EmojiRouter.post('/remove', (req, res) => {
  EmojiControllers.remove(req, res);
});

module.exports = EmojiRouter;
