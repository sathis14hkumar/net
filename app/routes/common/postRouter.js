const express = require('express');

const postRouter = express.Router();
const path = require('path');
const multer = require('multer');
const postController = require('../../controllers/common/postController');
const companyPostController = require('../../controllers/company/postController');
const __ = require('../../../helpers/globalFunctions');
const { validateRequestExactMatch } = require('../../middleware/validators');
const {
  readOnePost,
  readPost,
  createComment,
  deleteComment,
  postLike,
  reportComment,
  sharePost,
  viewComments,
} = require('../../middleware/validator/common/postValidation');

// Single File Upload
const storage = multer.diskStorage({
  destination(req, file, cb) {
    // Set Path
    const filePath = '/posts';

    cb(null, `public/uploads${filePath}`);
  },
  filename(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
});

postRouter.get(
  '/readOne/:postId',
  readOnePost,
  validateRequestExactMatch,
  async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);

    if (routeprivilege.newsAndEvents) {
      return postController.readOne(req, res);
    }

    return __.out(res, 300, 'This account is not permitted to access');
  },
);

postRouter.post('/read', readPost, validateRequestExactMatch, (req, res) => {
  postController.read(req, res);
});

postRouter.post('/readnew', (req, res) => {
  postController.readNew(req, res);
});

const newsAndEvents = async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.newsAndEvents) {
    switch (req.route.path) {
      case '/comment':
        return postController.commentPost(req, res);

      case '/deleteComment':
        return postController.deleteComment(req, res);

      case '/sharePost':
        return postController.sharePost(req, res);

      case '/reportComment':
        return postController.reportComment(req, res);

      case '/like':
        return postController.likePost(req, res);

      default:
        break;
    }
  }

  return __.out(res, 300, 'This account is not permitted to access');
};

postRouter.post(
  '/comment',
  createComment,
  validateRequestExactMatch,
  newsAndEvents,
);
postRouter.post(
  '/deleteComment',
  deleteComment,
  validateRequestExactMatch,
  newsAndEvents,
);
postRouter.post(
  '/sharePost',
  sharePost,
  validateRequestExactMatch,
  newsAndEvents,
);
postRouter.post(
  '/reportComment',
  reportComment,
  validateRequestExactMatch,
  newsAndEvents,
);
postRouter.post('/like', postLike, validateRequestExactMatch, newsAndEvents);
postRouter.get('/getUserChannels', (req, res) => {
  postController.getUserChannels(req, res);
});

postRouter.post(
  '/viewComments/:postId',
  viewComments,
  validateRequestExactMatch,
  async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);

    if (routeprivilege.newsAndEvents) {
      return postController.viewComments(req, res);
    }

    return __.out(res, 300, 'This account is not permitted to access');
  },
);

postRouter.post('/uploadContentFiles', upload.single('file'), (req, res) => {
  companyPostController.uploadContentFiles(req, res);
});

module.exports = postRouter;
