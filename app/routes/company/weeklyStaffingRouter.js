const express = require('express');

const weeklyStaffingRouter = express.Router();
const multer = require('multer');
const uuid = require('node-uuid');
const path = require('path');
const weeklyStaffingController = require('../../controllers/company/weeklyStaffingController');

const storage = multer.diskStorage({
  destination: 'public/uploads/weeklyStaffCsvData',
  filename(req, file, cb) {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
});

// RENDER

weeklyStaffingRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

weeklyStaffingRouter.post(
  '/uploadweeklystaffingdata',
  upload.single('weeklyStaffCsvData'),
  (req, res) => {
    weeklyStaffingController.uploadWeeklyStaffingData(req, res);
  },
);

module.exports = weeklyStaffingRouter;
