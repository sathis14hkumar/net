const express = require('express');

const moduleRouter = express.Router();
const moduleController = require('../../controllers/common/questionModuleController');
const customFormValidation = require('../../middleware/validator/company/customFormPayloadValidation');

// moduleRouter.post('/isUserExistInQuestion', (req, res) => {
//   moduleController.isUserExistInQuestion(req, res);
// });

// moduleRouter.use(passport.authenticate('jwt', {
//         session: false
//     }), /*Allow only admin*/
//     function (req, res, next) {

//         // No Restrictions, Allow flexistaff & Non flexistaff
//         next();

//     });

moduleRouter.post('/getModuleQuestions', (req, res) => {
  moduleController.getModuleQuestions(req, res);
});

// moduleRouter.post('/getPollingResult', (req, res) => {
//   moduleController.getPollingResult(req, res);
// });

moduleRouter.post('/resQuestions', (req, res) => {
  moduleController.resQuestions(req, res);
});

moduleRouter.post(
  '/resCustomFormQuestions',
  customFormValidation.questionModuleResCustomFormQuestionsValidation,
  (req, res) => {
    moduleController.resCustomFormQuestions(req, res);
  },
);

moduleRouter.post('/customFormQuestionsUpdate', (req, res) => {
  moduleController.customFormQuestionsUpdate(req, res);
});

// moduleRouter.get('/allTrackedAnswered', (req, res) => {
//   moduleController.allTrackedAnswered(req, res);
// });

module.exports = moduleRouter;
