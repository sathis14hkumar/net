const express = require('express');

const myBoardRouter = express.Router();
const MyBoardController = require('../../controllers/common/myBoardController');

// myBoardRouter.use(passport.authenticate('jwt', {
//         session: false
//     }), /*Allow only admin*/
//     function (req, res, next) {
//         // No Restrictions, Allow flexistaff & Non flexistaff
//         next();

//     });

myBoardRouter.get('/getWalls', (req, res) => {
  MyBoardController.getWalls(req, res);
});

// Get Compliments For me
myBoardRouter.get('/getComplimentsForMe', (req, res) => {
  MyBoardController.getComplimentsForMe(req, res);
});

// Get Compliments Sent by me
myBoardRouter.get('/getComplimentsSentByMe', (req, res) => {
  MyBoardController.getComplimentsSentByMe(req, res);
});

// Get Suggestions
myBoardRouter.get('/getSuggestions', (req, res) => {
  MyBoardController.getSuggestions(req, res);
});

myBoardRouter.get('/wallSummary', (req, res) => {
  MyBoardController.wallSummary(req, res);
});

myBoardRouter.post('/getPosts', (req, res) => {
  MyBoardController.getPosts(req, res);
});

myBoardRouter.post('/getPosts/old', (req, res) => {
  MyBoardController.getPostsOld(req, res);
});

myBoardRouter.post('/taskSummary', (req, res) => {
  MyBoardController.taskSummary(req, res);
});

myBoardRouter.get('/viewPost/:postId', (req, res) => {
  MyBoardController.viewPost(req, res);
});

myBoardRouter.post('/completeTask', (req, res) => {
  MyBoardController.completeTask(req, res);
});

myBoardRouter.post('/viewComments/:postId', (req, res) => {
  MyBoardController.viewComments(req, res);
});

myBoardRouter.post('/getBuUsers/', (req, res) => {
  MyBoardController.getBuUsers(req, res);
});
myBoardRouter.get('/getBoardUsers/:wallId', (req, res) => {
  MyBoardController.getBoardUsers(req, res);
});
myBoardRouter.get('/viewAdminResponse/:postId', (req, res) => {
  MyBoardController.viewAdminResponse(req, res);
});

module.exports = myBoardRouter;
