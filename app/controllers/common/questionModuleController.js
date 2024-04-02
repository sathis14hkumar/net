// Controller Code Starts here
const mongoose = require('mongoose');
const _ = require('lodash');
const { validationResult } = require('express-validator');
const User = require('../../models/user');
const BuilderModule = require('../../models/builderModule');
const Question = require('../../models/question');
const ManageForm = require('../../models/manageForm');
const ManageAdminForm = require('../../models/manageAdminForm');
const QuestionResponse = require('../../models/questionResponse');
const TrackedQuestion = require('../../models/trackUserQns');
const CustomForm = require('../../models/customForms');
const ManageFormLog = require('../../models/manageFormLog');
const RunningNumber = require('../../models/runningNumbers');
const ChallengeModule = require('./challengeController');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class QuestionModuleController {
  async getModuleQuestions(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['moduleId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Module Data
      const moduleData = await BuilderModule.findOne({
        _id: req.body.moduleId,
        status: 1,
      })
        .populate({
          path: 'questions',
        })
        .lean();

      if (!moduleData) {
        return __.out(res, 300, `Module Not Found`);
      }

      // Questions Order By Index Number First
      if (moduleData.questions) {
        moduleData.questions = _.orderBy(
          moduleData.questions,
          ['indexNum'],
          ['asc'],
        );
      }

      // moduleData.questions.map(value=>{
      //   //value.question
      // })
      // var content = content.replace(/<img[^>]*>/g,"");
      /**
       * Tracking Request
       */

      if (req.body.trackQns) {
        const searchQuery = {
          userId: req.user._id,
          moduleId: req.body.moduleId,
        };

        if (req.body.notificationId) {
          searchQuery.notificationId = req.body.notificationId;
        }

        if (req.body.wallPostId) {
          searchQuery.wallPostId = req.body.wallPostId;
        }

        if (req.body.postId) {
          searchQuery.postId = req.body.postId;
        }

        if (req.body.customFormId) {
          searchQuery.customFormId = req.body.customFormId;
        }

        const existData = await TrackedQuestion.findOne(searchQuery)
          .populate({
            path: 'questions',
          })
          .sort({
            indexNum: 1,
          })
          .lean();

        if (existData) {
          req.body.trackedData = existData.questions;
          req.body.moduleData = moduleData;
          return this.getTrackedQuestions(req, res);
        }
      }

      const filterQuestions = (v) => v.conditionalQuestions.length === 0;

      // const viewQuestions = moduleData.questions.filter(filterQuestions);
      // Check Randomisation Enable Or Not
      if (moduleData.randomOrder === true) {
        // Randomisation
        const questions = moduleData.questions.filter(filterQuestions); // moduleData.questions;
        const { viewCount } = moduleData;
        const requiredQns = [];
        const nonRequiredQns = [];
        let selectedRandomQns = [];
        let randomCount = 0;
        let int = 0;

        for (const elem of questions) {
          if (elem.required) {
            requiredQns.push(elem);
          } else {
            nonRequiredQns.push(elem);
          }

          // Default Tracked Data
          questions[int].selectedOptions = [];
          questions[int].answer = null;
          questions[int].qnsAnswered = false;
          int += 1;
        }
        randomCount = viewCount - requiredQns.length;
        // Select N Randomised Qns from Non Required Qns
        selectedRandomQns = __.getRandomElement(randomCount, nonRequiredQns);
        // Overall Qns
        const viewQuestions = [...requiredQns, ...selectedRandomQns];

        moduleData.questions.forEach((curr) => {
          if (
            !filterQuestions(curr) &&
            viewQuestions.findIndex((v) => v._id === curr._id) === -1 &&
            curr.conditionalQuestions.some(
              (cq) =>
                viewQuestions.findIndex(
                  (v) => v._id.toString() === cq.questionId.toString(),
                ) !== -1,
            )
          ) {
            viewQuestions.push(curr);
          }
        });
        moduleData.questions = viewQuestions;
      }

      // Track Selected Questions Once viewed by user
      if (req.body.trackQns) {
        const trackData = {
          userId: req.user._id,
          moduleId: req.body.moduleId,
          questions: [],
        };

        if (req.body.notificationId) {
          trackData.notificationId = req.body.notificationId;
        }

        if (req.body.wallPostId) {
          trackData.wallPostId = req.body.wallPostId;
        }

        if (req.body.postId) {
          trackData.postId = req.body.postId;
        }

        if (req.body.customFormId) {
          trackData.customFormId = req.body.customFormId;
        }

        for (const quesData of moduleData.questions) {
          trackData.questions.push(quesData._id);
        }
        await new TrackedQuestion(trackData).save();
      }

      // If polling result needed

      const promiseData = [];
      const moduleDataListCall = async (i) => {
        if (moduleData.questions[i].type === 4) {
          req.body.questionId = moduleData.questions[i]._id;
          req.body.pollingResult = true;
          req.body.internalApi = true;
          moduleData.questions[i].resultData = await this.getPollingResult(req);
        }
      };

      for (const i of Object.keys(moduleData.questions)) {
        promiseData.push(moduleDataListCall(i));
      }

      await Promise.all(promiseData);

      const getImageSrc = (strings) => {
        const imagearray = [];
        const stringsplit = strings.split('<');
        const imgfiltered = stringsplit.filter((v) => v.startsWith('img '));

        imgfiltered.forEach((item) => {
          const newimgpos = item.split('src="')[1];

          imagearray.push(newimgpos.substring(0, newimgpos.indexOf('"')));
        });
        return imagearray;
      };

      const getVideoSrc = (strings) => {
        const videoarray = [];
        const stringsplit = strings.split('<');
        const videofiltered = stringsplit.filter(
          (v) => v.startsWith('video ') || v.startsWith('iframe '),
        );

        videofiltered.forEach((item) => {
          const newvideopos = item.split('src="')[1];

          videoarray.push(newvideopos.substring(0, newvideopos.indexOf('"')));
        });
        return videoarray;
      };

      moduleData.questions = moduleData.questions.map((question) => {
        question.images = getImageSrc(question.question);
        question.question = question.question.replace(/<img .*?>/g, '');
        question.videos = getVideoSrc(question.question);
        question.question = question.question.replace(
          /<video.*>.*?<\/video>/gi,
          '',
        );
        return question;
      });
      // sequence type question shuffle
      const shuffle = (array) => {
        let currentIndex = array.length;
        let temporaryValue;
        let randomIndex;

        while (currentIndex !== 0) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
        }
      };

      moduleData.questions.forEach((question) => {
        question.correctSequence = JSON.parse(JSON.stringify(question.options));
        if (question.type === 15) {
          shuffle(question.options);
        }
      });

      return __.out(res, 201, {
        data: moduleData,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  /**
   * Get Tracked Same Questions
   */
  async getTrackedQuestions(req, res) {
    try {
      const scoringResponse = {
        userScore: 0,
        totalScore: 0,
      };
      const searchQuery = {
        userId: req.user._id,
      };

      if (req.body.notificationId) {
        searchQuery.notificationId = req.body.notificationId;
      }

      if (req.body.wallPostId) {
        searchQuery.wallPostId = req.body.wallPostId;
      }

      if (req.body.postId) {
        searchQuery.postId = req.body.postId;
      }

      if (req.body.customFormId) {
        searchQuery.customFormId = req.body.customFormId;
      }

      // Get Answered Questions
      const getAllSubmitted = await QuestionResponse.find(searchQuery).lean();
      let { trackedData } = req.body;
      const { moduleData } = req.body;

      if (!moduleData.randomOrder) {
        const temp = moduleData.questions.filter(
          (v) =>
            trackedData.findIndex(
              (t) => t._id.toString() === v._id.toString(),
            ) === -1,
        );

        trackedData = trackedData.concat(temp);
      }

      let int = 0;

      for (let i = 0; i < trackedData.length; i += 1) {
        trackedData[int].selectedOptions = [];
        trackedData[int].answer = '';
        trackedData[int].qnsAnswered = false;
        for (const responseData of getAllSubmitted) {
          if (
            !!responseData.questionId &&
            responseData.questionId.toString() ===
              trackedData[int]._id.toString()
          ) {
            trackedData[int].selectedOptions.push(responseData.option);
            trackedData[int].answer = responseData.answer || '';
            trackedData[int].qnsAnswered = true;
          }
        }
        int += 1;
      }
      moduleData.questions = trackedData;
      // sequence type question shuffle
      const shuffle = (array) => {
        let currentIndex = array.length;
        let temporaryValue;
        let randomIndex;

        while (currentIndex !== 0) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
        }
      };

      moduleData.questions.forEach((question) => {
        question.correctSequence = JSON.parse(JSON.stringify(question.options));
        if (question.type === 15) {
          shuffle(question.options);
        }

        // calculating score to return if scoringEnabled for this module.
        const scorableQuestionTypes = [2, 3, 5, 11, 15, 16];

        if (
          !!moduleData.scoringEnabled &&
          !!moduleData.scorePerQuestion &&
          question.qnsAnswered
        ) {
          const data = {
            _id: question._id,
            type: question.type,
            answer: question.answer,
          };

          if (scorableQuestionTypes.indexOf(data.type) + 1) {
            scoringResponse.totalScore += moduleData.scorePerQuestion;
            if (!Array.isArray(data.answer)) data.answer = [data.answer];

            if (this.isAnswerCorrect(data, question, res))
              scoringResponse.userScore += moduleData.scorePerQuestion;
          }
        }
      });

      // If polling result needed

      const promiseData = [];
      const questionEntryListCall = async ([i]) => {
        if (moduleData.questions[i].type === 4) {
          req.body.questionId = moduleData.questions[i]._id;
          req.body.pollingResult = true;
          req.body.internalApi = true;
          moduleData.questions[i].resultData = await this.getPollingResult(req);
        }
      };

      for (const [i] of moduleData.questions.entries()) {
        promiseData.push(questionEntryListCall([i]));
      }

      await Promise.all(promiseData);

      const getImageSrc = (strings) => {
        const stringsplit = strings.split('<');
        const imgfiltered = stringsplit.filter((v) => v.startsWith('img '));

        return imgfiltered.map((item) => {
          const newimgpos = item.split('src="')[1];

          return newimgpos.substring(0, newimgpos.indexOf('"'));
        });
      };

      const getVideoSrc = (strings) => {
        const stringsplit = strings.split('<');
        const videofiltered = stringsplit.filter(
          (v) => v.startsWith('video ') || v.startsWith('iframe '),
        );

        return videofiltered.map((item) => {
          const newvideopos = item.split('src="')[1];

          return newvideopos.substring(0, newvideopos.indexOf('"'));
        });
      };

      moduleData.questions = moduleData.questions.map((question) => {
        question.images = getImageSrc(question.question);
        question.question = question.question.replace(/<img .*?>/g, '');
        question.videos = getVideoSrc(question.question);
        question.question = question.question.replace(
          /<video.*>.*?<\/video>/gi,
          '',
        );
        return question;
      });
      if (scoringResponse.totalScore) moduleData.score = scoringResponse;

      return __.out(res, 201, {
        data: moduleData,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getPollingResult(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, ['questionId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const {
        questionId,
        notificationId,
        wallPostId,
        postId,
        customFormId,
        internalApi,
      } = req.body;
      // Question Options
      const pollingData = await Question.findOne({
        _id: questionId,
        status: 1,
      })
        .select('options')
        .lean();

      if (!pollingData) {
        return __.out(res, 300, 'Question Not Found');
      }

      // Options Object
      const optionsData = {};

      for (const elem of pollingData.options) {
        optionsData[elem._id] = 0;
      }
      const matchQuery = {
        questionId: mongoose.Types.ObjectId(questionId),
        status: 1,
      };

      if (notificationId) {
        matchQuery.notificationId = mongoose.Types.ObjectId(notificationId);
      }

      if (wallPostId) {
        matchQuery.wallPostId = mongoose.Types.ObjectId(wallPostId);
      }

      if (postId) {
        matchQuery.postId = mongoose.Types.ObjectId(postId);
      }

      if (customFormId) {
        matchQuery.customFormId = mongoose.Types.ObjectId(customFormId);
      }

      // __.log(matchQuery, "matchQuery");
      // Question Answers/Pollings/Responses
      const resData = await QuestionResponse.aggregate([
        {
          $match: matchQuery,
        },
        {
          $group: {
            _id: '$option',
            count: {
              $sum: 1,
            },
          },
        },
      ]);
      // Make Result Object
      const resultData = optionsData;
      let totalVoted = 0;

      for (const elem of resData) {
        resultData[elem._id] = elem.count;
        totalVoted += elem.count;
      }

      // Percentage Calculation
      const percentData = {};

      for (const key of Object.keys(resultData)) {
        if (totalVoted > 0) {
          const percentage = Math.round((resultData[key] / totalVoted) * 100);

          percentData[key] = percentage;
        } else {
          percentData[key] = 0;
        }
      }

      // Set Return Data
      const returnData = {
        total: totalVoted,
        data: resultData,
        percentData,
      };

      // Internal Api only for result
      if (internalApi === true) {
        return returnData;
      }

      return __.out(res, 201, returnData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err.message);
    }
  }

  // Response Question Replies as same array
  async resQuestions(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'qnsresponses',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const resData = {
        userId: req.user._id,
        questionId: req.body.qnsresponses.questionId,
        options: req.body.qnsresponses.options || [],
        answer: req.body.qnsresponses.answer || '',
      };

      if (req.body.notificationId) {
        resData.notificationId = req.body.notificationId;
      }

      if (req.body.wallPostId) {
        resData.wallPostId = req.body.wallPostId;
      }

      if (req.body.postId) {
        resData.postId = req.body.postId;
      }

      if (req.body.qnsresponses.customFormId) {
        resData.customFormId = req.body.qnsresponses.customFormId;
      }

      if (req.body.postType) {
        if (req.body.wallPostId) {
          await ChallengeModule.triggerChallenge(
            res,
            req.user._id,
            req.body.wallPostId,
            'wall',
            9,
          );
        }

        if (req.body.postId) {
          await ChallengeModule.triggerChallenge(
            res,
            req.user._id,
            req.body.postId,
            'channel',
            2,
          );
        }
      }

      if (resData.options.length > 0) {
        const promises = resData.options.map(async (elem) => {
          resData.option = elem._id;
          await new QuestionResponse(resData).save();
        });

        await Promise.all(promises);
      } else {
        await new QuestionResponse(resData).save();
      }

      if (req.body.pollingResult) {
        req.body.questionId = req.body.qnsresponses.questionId;
        return this.getPollingResult(req, res);
      }

      return __.out(res, 201, 'Submitted Successfully!!');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getInternalModuleQuestions(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['formName']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // let customFormId = Buffer.from(req.body.customFormId, 'base64').toString('ascii');
      const condition = { formName: req.body.formName };
      const findModuleId = await CustomForm.findOne(condition).lean();
      const customFormId = findModuleId._id;
      // Module Data
      const moduleData = await BuilderModule.findOne({
        _id: findModuleId.moduleId,
        status: 1,
      })
        .populate({
          path: 'questions',
        })
        .lean();

      if (!moduleData) {
        return __.out(res, 300, `Module Not Found`);
      }

      // Questions Order By Index Number First
      if (moduleData.questions) {
        moduleData.questions = _.orderBy(
          moduleData.questions,
          ['indexNum'],
          ['asc'],
        );
      }

      /**
       * Tracking Request
       */

      if (req.body.trackQns) {
        const searchQuery = {
          userId: req.user._id,
          moduleId: findModuleId.moduleId,
        };

        if (customFormId) {
          searchQuery.customFormId = customFormId;
        }

        const existData = await TrackedQuestion.findOne(searchQuery)
          .populate({
            path: 'questions',
          })
          .sort({
            indexNum: 1,
          })
          .lean();

        if (existData) {
          req.body.trackedData = existData.questions;
          req.body.moduleData = moduleData;
          return this.getTrackedQuestions(req, res);
        }
      }

      // Check Randomisation Enable Or Not
      if (moduleData.randomOrder === true) {
        // Randomisation
        const { questions } = moduleData;
        const { viewCount } = moduleData;
        const requiredQns = [];
        const nonRequiredQns = [];
        let selectedRandomQns = [];
        let randomCount = 0;
        let int = 0;

        for (const elem of questions) {
          if (elem.required === true) {
            requiredQns.push(elem);
          } else {
            nonRequiredQns.push(elem);
          }

          // Default Tracked Data
          questions[int].selectedOptions = [];
          questions[int].answer = '';
          questions[int].qnsAnswered = false;
          int += 1;
        }
        randomCount = viewCount - requiredQns.length;
        // Select N Randomised Qns from Non Required Qns
        selectedRandomQns = __.getRandomElement(randomCount, nonRequiredQns);
        // Overall Qns
        moduleData.questions = [...requiredQns, ...selectedRandomQns];
      }

      // Track Selected Questions Once viewed by user
      if (req.body.trackQns) {
        const trackData = {
          userId: req.user._id,
          moduleId: req.body.moduleId,
          questions: [],
        };

        if (req.body.notificationId) {
          trackData.notificationId = req.body.notificationId;
        }

        if (req.body.wallPostId) {
          trackData.wallPostId = req.body.wallPostId;
        }

        if (req.body.postId) {
          trackData.postId = req.body.postId;
        }

        if (req.body.customFormId) {
          trackData.customFormId = req.body.customFormId;
        }

        for (const quesData of moduleData.questions) {
          trackData.questions.push(quesData._id);
        }
        await new TrackedQuestion(trackData).save();
      }

      // If polling result needed
      for (const i of Object.keys(moduleData.questions)) {
        if (moduleData.questions[i].type === 4) {
          req.body.questionId = moduleData.questions[i]._id;
          req.body.pollingResult = true;
          req.body.internalApi = true;
          // moduleData.questions[i].resultData = await this.getPollingResult(req);
        }
      }
      // sequence type question shuffle
      const shuffle = (array) => {
        let currentIndex = array.length;
        let temporaryValue;
        let randomIndex;

        while (currentIndex !== 0) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
        }
      };

      moduleData.questions.forEach((question) => {
        question.correctSequence = JSON.parse(JSON.stringify(question.options));
        if (question.type === 15) {
          shuffle(question.options);
        }
      });
      moduleData.customFormId = customFormId;
      moduleData.title = findModuleId.title;
      return __.out(res, 201, {
        data: moduleData,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getPollingResultArray(data, res) {
    try {
      const { customFormId, questionId } = data;
      const polls = await QuestionResponse.aggregate([
        {
          $match: {
            customFormId: mongoose.Types.ObjectId(customFormId),
            questionId: mongoose.Types.ObjectId(questionId),
            status: 1,
          },
        },
        { $unwind: '$answer' },
        {
          $group: {
            _id: '$answer._id',
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      const total = polls.reduce((prev, curr) => prev + curr.count, 0);
      const options = polls.reduce((prev, curr) => {
        const percentage = (curr.count / total) * 100;
        const { _id } = curr;

        return prev.concat({ _id, percentage });
      }, []);

      return { _id: questionId, options, total };
    } catch (error) {
      return __.out(res, 300, error);
    }
  }

  isAnswerCorrect(data, question, res) {
    try {
      let bool = false;

      if (data.type === 15) {
        // calculate sequence type question score.
        bool = question.correctSequence.reduce(
          (answerFlag, answer, i) =>
            answerFlag && !!(data.answer[i]._id === answer._id.toString()),
          true,
        );
      } else if (data.type === 16) {
        const isTouching = ({ x, y, radious }, i) => {
          const spot = question.options.map((answer) => answer.coordinates)[i];
          const { x1, y1, r1 } = { x1: +x, y1: +y, r1: +radious };
          const { x2, y2 } = {
            x2: +spot.x,
            y2: +spot.y,
          };
          const c1 = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));

          // $scope.color = c1 > r1*2 ? 'red' : 'green';
          return c1 <= r1 * 2;
        };
        const isAllCirclesAvailable =
          data.answer.length === question.options.length;

        bool = data.answer.reduce(
          (answerFlag, answer, i) =>
            answerFlag && isTouching(answer.coordinates, i),
          isAllCirclesAvailable,
        );
      } else {
        const correctAns = question.options.filter(
          (option) => option.correctAns,
        );

        bool = correctAns.reduce(
          (answerFlag, answer) =>
            answerFlag &&
            !!data.answer.find((ans) => ans._id === answer._id) &&
            correctAns.length === data.answer.length,
          true,
        );
      }

      return bool;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async resCustomFormQuestions(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const requiredResult = await __.checkRequiredFields(
        req,
        req.body.isAdminForm
          ? ['moduleId', 'customFormId', 'manageFormId', 'workflowId']
          : ['customFormId'],
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      logInfo('question Module Controller: resCustomFormQuestions');
      const questionsIds = [];
      let userIds;
      let staffName;
      const poll = [];
      const scoringResponse = {
        userScore: 0,
        totalScore: 0,
      };
      const scorableQuestionTypes = [2, 3, 5, 11, 15, 16];

      const moduleData = await CustomForm.findOne({
        _id: req.body.customFormId,
        status: 1,
      })
        .populate({
          path: 'moduleId',
          select: 'scoringEnabled scorePerQuestion',
        })
        .select('moduleId workflow title createdBy companyId')
        .lean();

      const { scorePerQuestion, scoringEnabled } = moduleData.moduleId;

      /* eslint-disable no-await-in-loop */
      for (const data of req.body.answers) {
        if (req.user) {
          userIds = req.user._id;
          const userData = await User.findOne({ _id: req.user._id })
            .select('name')
            .lean();

          staffName = userData.name;
        } else {
          staffName = data.answer.userName;
        }

        const resData = {
          userId: userIds,
          questionId: data._id,
          options: data.options || [],
          answer: data.answer,
        };

        // __.log(req.body.customFormId, "req.body.customFormId");
        if (req.body.customFormId) {
          resData.customFormId = req.body.customFormId;
        }

        if (resData.options.length > 0) {
          const promiseData1 = [];
          const optionsListCall = async (elem) => {
            resData.options = elem._id;
            const qns = await new QuestionResponse(resData).save();

            questionsIds.push(qns._id);
          };

          for (const elem of resData.options) {
            promiseData1.push(optionsListCall(elem));
          }

          await Promise.all(promiseData1);
        } else {
          const qnsData = await new QuestionResponse(resData).save();

          questionsIds.push(qnsData._id);
        }

        if (data.type === 4) {
          const polls = await this.getPollingResultArray(
            { customFormId: req.body.customFormId, questionId: data._id },
            res,
          );

          poll.push(polls);
        }

        // calculating score to return if scoringEnabled for this module.
        if (!!scoringEnabled && !!scorePerQuestion && !req.body.isAdminForm) {
          if (scorableQuestionTypes.indexOf(data.type) + 1) {
            const question = await Question.findOne({ _id: data._id }).lean();

            if (question.type === 15) {
              question.correctSequence = question.options;
            }

            scoringResponse.totalScore += scorePerQuestion;
            // const correctAns = question.options.filter(option => option.correctAns);

            if (!Array.isArray(data.answer)) data.answer = [data.answer];

            // let bool = false;
            // if(data.type === 15) {
            //   // calculate sequence type question score.
            //   bool = question.options.reduce((answerFlag, answer, i) => answerFlag && !!(data.answer[i]._id === answer._id.toString()), true);
            // } else if (data.type === 16) {
            //   const isTouching = ({ x, y, radious }, i) => {
            //       const spot = question.options.map(answer => answer.coordinates)[i];
            //       const {x1, y1, r1} = { x1:+x, y1:+y, r1:+radious };
            //       const {x2, y2, r2} = { x2:+spot.x, y2:+spot.y, r2:+spot.radious };
            //       const c1 = Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));
            //       // $scope.color = c1 > r1*2 ? 'red' : 'green';
            //       return c1 <= r1*2;
            //   }
            //   const isAllCirclesAvailable = data.answer.length === question.options.length;
            //   bool = data.answer.reduce((answerFlag, answer, i) => answerFlag && isTouching(answer.coordinates, i), isAllCirclesAvailable);
            // } else {
            //   bool = correctAns.reduce((answerFlag, answer) => answerFlag && !!(data.answer.find(ans => ans._id == answer._id)) && correctAns.length === data.answer.length, true);
            // }
            // if(bool) scoringResponse.userScore += scorePerQuestion;
            if (this.isAnswerCorrect(data, question, res))
              scoringResponse.userScore += scorePerQuestion;
          }
        }
      }
      /* eslint-enable no-await-in-loop */
      const workflowStatus = [];
      const reqBodyAns = req.body.answers.filter((answer) =>
        [2, 3, 5, 11].includes(answer.type),
      );

      if (!!moduleData.workflow && !req.body.isAdminForm) {
        const updateStatus = (wTypes) => {
          wTypes.forEach((type) => {
            // workflow types
            const workflowWithType = moduleData.workflow.filter(
              (flow) => flow.type === type,
            );

            workflowWithType.forEach((flow) => {
              let wStatus;
              const defineWorkflowStatus = () => {
                const statusAvail = flow.workflowStatus.find(
                  (status) => status.isDefault,
                );

                wStatus = { fieldId: flow._id };
                if (statusAvail) wStatus.fieldStatusId = statusAvail._id;
              };

              if (flow.type === 1)
                /* 1.Common workflow */ defineWorkflowStatus();

              if (flow.type === 2) {
                // 2.Conditional based on question response
                const qvalidation = (question) => {
                  const qanswer = reqBodyAns.find(
                    (answer) =>
                      answer._id.toString() === question.questionId.toString(),
                  );

                  qanswer.answer = Array.isArray(qanswer.answer)
                    ? qanswer.answer
                    : [qanswer.answer];
                  return !!qanswer.answer.find(
                    (answer) =>
                      answer._id.toString() === question.answerId.toString(),
                  );
                };

                if (flow.questionResponse.some(qvalidation))
                  defineWorkflowStatus();
              }

              if (flow.type === 3) {
                // 3.Conditional based on workflow response
                const wValidation = (workflow) =>
                  !!workflowStatus.find(
                    (wflow) =>
                      wflow.fieldId.toString() ===
                        workflow.workflowId.toString() &&
                      (wflow.fieldStatusId
                        ? wflow.fieldStatusId.toString() ===
                          workflow.statusId.toString()
                        : false),
                  );

                if (flow.workflowResponse.some(wValidation))
                  defineWorkflowStatus();
              }

              if (
                !!wStatus &&
                !workflowStatus.find(
                  (wf) => wf.fieldId.toString() === wStatus.fieldId.toString(),
                )
              )
                workflowStatus.push(wStatus);
            });
          });
        };
        let currentWorkflowLength = 0;
        const callback = () => {
          currentWorkflowLength = workflowStatus.length;
          updateStatus(currentWorkflowLength === 0 ? [1, 2, 3] : [3]);
          if (currentWorkflowLength < workflowStatus.length) {
            callback();
          }
        };

        callback();
      }
      // form status updated
      // var customFormData = await CustomForm.findOneAndUpdate({ _id: req.body.customFormId }, {
      //     $set: {
      //         formSubmitted: true
      //     }
      // }, {
      //         setDefaultsOnInsert: true
      //     }).lean();

      const manageFormDetails = {
        userId: userIds,
        customFormId: req.body.customFormId,
        staffName,
        formStatus: req.body.formStatus || [],
        questionId: questionsIds || [],
        questions: req.body.questions || [],
        workflowStatus,
      };

      if (!!userIds && !!scoringResponse.totalScore) {
        manageFormDetails.userScore = scoringResponse.userScore;
        manageFormDetails.totalScore = scoringResponse.totalScore;
      }

      if (!req.body.isAdminForm) {
        // form id generator
        const customFormTitle = moduleData.title
          .split(' ')
          .map((word) => word[0])
          .join('')
          .toUpperCase();
        const rnFindQuery = { identity: 'formId' };

        if (req.user) {
          rnFindQuery.companyId = req.user.companyId;
        } else {
          rnFindQuery.$or = [
            { companyId: { $exists: false } },
            { companyId: null },
          ];
        }

        const fRunNumber = await RunningNumber.findOne(rnFindQuery).select(
          'currentRunningNumber _id',
        ); // .select('currentRunningNumber _id')
        let fRunNumber2;

        if (!fRunNumber) {
          const createObj = {
            title: 'Form Submission number holder',
            identity: 'formId',
            description:
              'This collection holds number for generating form number(unique) to each submitted form. this form number will shown in manage forms',
            currentRunningNumber: 1,
            companyId: req.user
              ? mongoose.Types.ObjectId(req.user.companyId.toString())
              : null,
          };

          await new RunningNumber(createObj).save();
          fRunNumber2 = '1';
        } else {
          fRunNumber.currentRunningNumber =
            +fRunNumber.currentRunningNumber + 1;
          fRunNumber2 = `${fRunNumber.currentRunningNumber}`;

          fRunNumber.save();
        }

        const indent = '0000000000';

        fRunNumber2 =
          indent.substr(0, indent.length - fRunNumber2.length) + fRunNumber2;
        const formId = `${customFormTitle}_${fRunNumber2}`;

        manageFormDetails.formId = formId;
      }

      if (!req.body.isAdminForm) {
        let savedManageform = await new ManageForm(manageFormDetails).save();

        savedManageform = JSON.parse(JSON.stringify(savedManageform));
        await ChallengeModule.triggerChallenge(
          res,
          savedManageform.userId,
          savedManageform._id,
          'customform',
          null,
        );
        workflowStatus.forEach((ws) => {
          if (ws.fieldStatusId) {
            const fieldId = moduleData.workflow.find(
              (wf) => wf._id.toString() === ws.fieldId.toString(),
            );
            const valueId = fieldId.workflowStatus.find(
              (v) => v._id.toString() === ws.fieldStatusId.toString(),
            );
            const newData = [{ fieldId, valueId }];
            const changeMessage = ` ${fieldId.title} : ${valueId.field}`;
            const userId = req.user ? req.user._id : moduleData.createdBy;
            const userName = 'DONOTCHANGE';
            const manageFormId = savedManageform._id;
            const changeType = 1;
            const companyId = req.user
              ? req.user.companyId
              : moduleData.companyId;

            ManageFormLog({
              manageFormId,
              userId,
              userName,
              changeType,
              oldData: [],
              newData,
              changeMessage,
              companyId,
            }).save();
          }
        });
        const responsee = {
          message: 'Submitted  Successfully!!',
          data: poll,
        };

        if (scoringResponse.totalScore) responsee.score = scoringResponse;

        return __.out(res, 201, responsee);
      }

      const manageAdminFormDetails = {
        userId: userIds,
        customFormId: req.body.customFormId,
        manageFormId: req.body.manageFormId,
        workflowId: req.body.workflowId,
        moduleId: req.body.moduleId,
        staffName,
        questionId: questionsIds || [],
        questions: req.body.questions || [],
      };

      await new ManageAdminForm(manageAdminFormDetails).save();
      return __.out(res, 201, {
        message: 'Submitted  Successfully!!',
        data: poll,
      });
    } catch (err) {
      __.log(err);
      logError('question Module Controller: resCustomFormQuestions', err);
      return __.out(res, 500, err);
    }
  }

  async customFormQuestionsUpdate(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const questionsIds = [];
      const manageForm = await ManageForm.findOne({
        _id: req.body.manageFormId,
      })
        .populate({
          path: 'customFormId',
          select: 'title',
        })
        .lean();

      const oldData = await QuestionResponse.find({
        _id: { $in: manageForm.questionId },
      }).lean();
      const newData = [];

      /** Removing question already existed question responses  */
      await QuestionResponse.find({
        _id: { $in: manageForm.questionId },
      }).remove();
      /* eslint-disable no-await-in-loop */
      for (const data of req.body.answers) {
        const resData = {
          userId: manageForm.userId,
          questionId: data._id,
          options: data.options || [],
          answer: data.answer,
          customFormId: manageForm.customFormId,
        };

        newData[newData.length] = resData;
        const qnsData = await QuestionResponse(resData).save();

        questionsIds.push(qnsData._id);
      }
      /* eslint-enable no-await-in-loop */
      const userId = req.user._id;
      const { manageFormId } = req.body;
      const changeType = 2;
      const changeMessage = `${manageForm.customFormId.title} was updated by ${req.user.name}`;
      const manageFormUpdate = await ManageForm.findOneAndUpdate(
        { _id: req.body.manageFormId },
        {
          $set: {
            questionId: questionsIds,
          },
        },
        {
          setDefaultsOnInsert: true,
        },
      );

      if (!manageFormUpdate) {
        await ManageFormLog({
          userId,
          manageFormId,
          changeType,
          oldData,
          newData,
          changeMessage,
        }).save();
        return __.out(res, 300, 'Updated Not Successfully!!');
      }

      return __.out(res, 201, { message: 'Updated  Successfully!!' });
    } catch (err) {
      return __.out(res, 500, err);
    }
  }

  // async isUserExistInQuestion(req, res) {
  //   try {
  //     const { userId, questionId } = req.body;

  //     if (!!userId && !!questionId) {
  //       const question = await Question.findOne({ _id: questionId, type: 14 })
  //         .select('assignUsers moduleId')
  //         .populate({
  //           path: 'moduleId',
  //           select: 'createdBy',
  //         });

  //       if (question) {
  //         const users = await AssignUserRead.read(
  //           question.assignUsers || [],
  //           null,
  //           question.moduleId.createdBy,
  //         );

  //         if (users.status) {
  //           const index = users.users.findIndex(
  //             (user) => user.toString() === userId.toString(),
  //           );

  //           return __.out(res, 201, { userExist: index !== -1 });
  //         }

  //         return __.out(res, 300, 'Something went wrong try later');
  //       }

  //       return __.out(res, 300, 'Question not found');
  //     }

  //     return __.out(res, 300, 'userId and questionId is required');
  //   } catch (error) {
  //     __.log(error);
  //     return __.out(res, 300, 'Something went wrong try later');
  //   }
  // }

  // async allTrackedAnswered(data, res) {
  //   try {
  //     const { notificationId, wallPostId, postId } = req.query;
  //     const condition = { userId: req.user._id };

  //     if (notificationId) condition.notificationId = notificationId;

  //     if (wallPostId) condition.wallPostId = wallPostId;

  //     if (postId) condition.postId = postId;

  //     const trackedQuestions = await TrackedQuestion.findOne(condition)
  //       .select({ questions: 1, _id: 0 })
  //       .lean();
  //     const questionResponses = await QuestionResponse.find(condition)
  //       .select({ questionId: 1, option: 1, answer: 1, _id: 0 })
  //       .lean();

  //     // If all tracked questions answered
  //     if (trackedQuestions.questions.length === questionResponses.length) {
  //       __.log('>>> all tracked questions answered...');
  //       return __.out(res, 201, {
  //         allAnswered: true,
  //       });
  //     }

  //     // get tracked question details
  //     const questions = await Question.find({
  //       _id: { $in: trackedQuestions.questions },
  //     }).lean();

  //     const nonConditionalQuestions = questions.filter(
  //       (q) => !q.conditionalQuestions.length,
  //     );
  //     const conditionalQuestions = questions.filter(
  //       (q) => !!q.conditionalQuestions.length,
  //     );

  //     // not even all non conditional questions answered
  //     if (
  //       nonConditionalQuestions.filter(
  //         (q) =>
  //           !questionResponses.find(
  //             (qr) => qr.questionId.toString() === q._id.toString(),
  //           ),
  //       ).length
  //     ) {
  //       return __.out(res, 201, {
  //         allAnswered: false,
  //       });
  //     }

  //     // check fo conditional questions
  //     const parents = nonConditionalQuestions.slice();
  //     const childArr = conditionalQuestions.slice();
  //     const cb = () => {
  //       const childs = childArr.filter((q) =>
  //         q.conditionalQuestions.every((cq) =>
  //           parents.find(
  //             (pQues) => pQues._id.toString() === cq.questionId.toString(),
  //           ),
  //         ),
  //       );

  //       childs.every((child) => {});
  //     };
  //   } catch (error) {
  //     return __.out(res, 300, 'Something went wrong try later');
  //   }
  // }
}

module.exports = new QuestionModuleController();
