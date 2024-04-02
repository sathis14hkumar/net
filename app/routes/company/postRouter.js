const express = require('express');

const postRouter = express.Router();
const path = require('path');
const multer = require('multer');
const postController = require('../../controllers/company/postController');
const { uploadPostFiles, uploadFile } = require('../../../helpers/utils');
const {
  readOnePost,
  exportWallData,
  updateCommentStatus,
  reportedComments,
  allNews,
  getManageNews,
  createPost,
  updatePost,
  reportedPosts,
} = require('../../middleware/validator/company/postValidation');
const {
  validateRequestExactMatch,
  validateRequest,
} = require('../../middleware/validators');

// Single File Upload
const storage = multer.diskStorage({
  destination(req, file, cb) {
    // Set Path
    let filePath;

    switch (req.route.path) {
      case '/create':
        filePath = '/posts';
        break;

      case '/update':
        filePath = '/posts';
        break;

      case '/read':
        filePath = '/posts';
        break;

      case '/uploadContentFiles':
        filePath = '/posts';
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
const multiUpload = upload.fields([
  {
    name: 'teaserImage',
    maxCount: 1,
  },
  {
    name: 'mainImage',
    maxCount: 1,
  },
  {
    name: 'eventWallLogoImage',
    maxCount: 1,
  },
]);

// RENDER
postRouter.use((req, res, next) => {
  if (req.user.isFlexiStaff !== 1) return next();

  return res.status(402).send('This account is not permitted to access');
});

postRouter.post(
  '/create',
  multiUpload,
  createPost,
  validateRequest,
  (req, res) => {
    postController.create(req, res);
  },
);

postRouter.post('/', (req, res) => {
  postController.create(req, res);
});
postRouter.post(
  '/uploadFile',
  uploadPostFiles.single('file'),
  uploadFile,
  (req, res) => {
    postController.uploadFile(req, res);
  },
);

postRouter.post(
  '/update',
  multiUpload,
  updatePost,
  validateRequest,
  (req, res) => {
    postController.update(req, res);
  },
);

postRouter.get(
  '/read',
  getManageNews,
  validateRequestExactMatch,
  (req, res) => {
    postController.read(req, res);
  },
);

postRouter.get(
  '/getManageNews',
  getManageNews,
  validateRequestExactMatch,
  (req, res) => {
    postController.getManageNews(req, res);
  },
);

postRouter.get(
  '/:companyId',
  allNews,
  validateRequestExactMatch,
  (req, res) => {
    postController.getAllNews(req, res);
  },
);

postRouter.get(
  '/readOne/:postId',
  readOnePost,
  validateRequestExactMatch,
  (req, res) => {
    postController.readOne(req, res);
  },
);

postRouter.get(
  '/remove/:postId',
  readOnePost,
  validateRequestExactMatch,
  (req, res) => {
    postController.remove(req, res);
  },
);

postRouter.get(
  '/reportedPosts/:postType',
  reportedPosts,
  validateRequestExactMatch,
  (req, res) => {
    postController.reportedPosts(req, res);
  },
);

postRouter.get('/getAuthorChannels', (req, res) => {
  postController.getAuthorChannels(req, res);
});

postRouter.post('/uploadContentFiles', upload.single('file'), (req, res) => {
  postController.uploadContentFiles(req, res);
});

// postRouter.get('/reportedPosts/:postType', (req, res) => {
//   postController.reportedPosts(req, res);
// });

postRouter.get(
  '/reportedComments/:postType',
  reportedComments,
  validateRequestExactMatch,
  (req, res) => {
    postController.reportedComments(req, res);
  },
);

postRouter.post(
  '/updatereviewPost/',
  updateCommentStatus,
  validateRequestExactMatch,
  (req, res) => {
    postController.updatereviewPost(req, res);
  },
);

postRouter.post(
  '/updateCommentStatus/',
  updateCommentStatus,
  validateRequestExactMatch,
  (req, res) => {
    postController.updateCommentStatus(req, res);
  },
);

postRouter.post(
  '/exportPost/',
  exportWallData,
  validateRequestExactMatch,
  (req, res) => {
    postController.exportPost(req, res);
  },
);

postRouter.post(
  '/exportWall',
  exportWallData,
  validateRequestExactMatch,
  (req, res) => {
    postController.exportWallData(req, res);
  },
);

postRouter.get(
  '/one/:postId',
  readOnePost,
  validateRequestExactMatch,
  (req, res) => {
    postController.readOnePost(req, res);
  },
);
module.exports = postRouter;
