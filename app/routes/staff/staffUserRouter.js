const express = require('express');

const staffUserRouter = express.Router();
const multer = require('multer');
const uuid = require('node-uuid');
const path = require('path');
const staffUserController = require('../../controllers/staff/staffUserController');

const { validateRequestExactMatch } = require('../../middleware/validators');

const {
  getStaffs,
} = require('../../middleware/validator/staff/staffUserPayloadValidation');

const storage = multer.diskStorage({
  destination: 'public/uploads/profilePictures',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
});

// RENDER

staffUserRouter.use((req, res, next) => {
  if (
    req.user.isFlexiStaff === 1 ||
    req.url === '/read' ||
    req.url === '/getStaff'
  )
    return next();

  return res.status(402).send('This account is not permitted to access');
});

staffUserRouter.get('/read', (req, res) => {
  staffUserController.read(req, res);
});

staffUserRouter.post(
  '/getStaff',
  getStaffs,
  validateRequestExactMatch,
  (req, res) => {
    staffUserController.getStaffs(req, res);
  },
);

staffUserRouter.post('/update', upload.single('profilePicture'), (req, res) => {
  staffUserController.update(req, res);
});

// staffUserRouter.post('/test', (req, res) => {
//     staffUserController.test(req, res)
// });

module.exports = staffUserRouter;
