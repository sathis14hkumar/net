const express = require('express');

const companyRouter = new express.Router();
const path = require('path');

const multer = require('multer');
const companyController = require('../../controllers/superadmin/companyController');
const { validateRequestExactMatch } = require('../../middleware/validators');
const {
  createCompany,
  updateCompany,
} = require('../../middleware/validator/company/superAdminCompanyPayloadValidation');
// Single File Upload
const storage = multer.diskStorage({
  destination(req, file, cb) {
    // Set Path
    let filePath;

    switch (req.route.path) {
      case '/createCompany':
        filePath = '/companyLogos';
        break;

      case '/updateCompany':
        filePath = '/companyLogos';
        break;

      default:
        filePath = '';
    }
    cb(null, `public/uploads${filePath}`);
  },
  filename(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
});

// RENDER
companyRouter.use((req, res, next) => {
  if (req?.user?.role === 'superadmin') {
    return next();
  }

  return res.status(402).send('This account is not permitted to access');
});
companyRouter.post(
  '/createCompany',
  upload.single('file'),
  createCompany,
  validateRequestExactMatch,
  (req, res) => {
    companyController.createCompany(req, res);
  },
);

companyRouter.get('/getCompany/:companyId', (req, res) => {
  companyController.getCompany(req, res);
});

companyRouter.get('/companyList', (req, res) => {
  companyController.companyList(req, res);
});

companyRouter.post(
  '/updateCompany',
  upload.single('file'),
  updateCompany,
  validateRequestExactMatch,
  (req, res) => {
    companyController.updateCompany(req, res);
  },
);

companyRouter.get('/deleteCompany/:companyId', (req, res) => {
  companyController.deleteCompany(req, res);
});

module.exports = companyRouter;
