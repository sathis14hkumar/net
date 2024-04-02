const moment = require('moment');
const fs = require('fs');
const json2csv = require('json2csv');
const Wall = require('../../models/wall');
const User = require('../../models/user');
const WallPost = require('../../models/wallPost');
const Emoji = require('../../models/emoji');
const WallPostLike = require('../../models/wallPostLike');
const WallPostComment = require('../../models/wallPostComment');
const WallPostAdminResponse = require('../../models/wallPostAdminResponse');
const Question = require('../../models/question');
const QuestionResponse = require('../../models/questionResponse');
const ChallengeModule = require('./challengeController');
const FCM = require('../../../helpers/fcm');
const __ = require('../../../helpers/globalFunctions');
const { AssignUserRead } = require('../../../helpers/assinguserread');

class WallPostClass {
  async createPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(
        req,
        ['wallId', 'category', 'title', 'description'],
        'wallPost',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const isUserAuthorized = __.isUserAuthorized(req, req.body.wallId);

      if (!isUserAuthorized) return __.out(res, 403, 'Forbidden Access');

      const wall = await Wall.findOne({
        _id: req.body.wallId,
        status: 1,
      }).lean();

      if (!wall) return __.out(res, 403, 'Wall not available');

      // check for admin can only nominate
      if (
        !!wall.nominationOnlyByAdmin &&
        !!req.body.nomineeUsers &&
        !!req.body.nomineeUsers.length
      ) {
        const isAdmin = await Wall.findOne({
          wallId: req.body.wallId,
          companyId: req.user.companyId,
          assignUsers: {
            $elemMatch: {
              admin: {
                $in: [req.user._id],
              },
            },
          },
        });

        if (!isAdmin) {
          return __.out(res, 403, 'Wall admin can only create nominations');
        }
      }

      // check for anonymousPost
      if (req.body.anonymousPost) {
        if (!wall.postAnonymously) {
          return __.out(res, 300, 'Anonymous post not allowed for this board');
        }
      }

      // check for nomination limit
      if (
        !!req.body.nomineeUsers &&
        !!req.body.nomineeUsers.length &&
        ((!!wall.maxNomination && !!wall.maxNomination.enabled) ||
          (!!wall.nominationPerUser && !!wall.nominationPerUser.enabled))
      ) {
        const periodMapping = { 1: 1, 2: 3, 3: 6, 4: 12 }; // monthly, quarterly, harlfly, annually.
        const searchQuery = {
          wallId: req.body.wallId,
          status: 1,
          'nomineeUsers.0': {
            $exists: true,
          },
          author: req.user._id,
        };
        const select = {
          nomineeUsers: 1,
        };

        // check and updated createdAt expiry
        const checkAndUpdate = async (input, term) => {
          const createdAt = moment(new Date(input.createdAt)).utc();
          const endDate = createdAt
            .add(input.submissionPeriod, 'M')
            .utc()
            .toDate();
          const today = moment(new Date()).utc().toDate();

          if (today > endDate) {
            let updateData = null;

            // limit period expired, updating
            if (term === 'max') {
              const { maxNomination } = wall;

              maxNomination.createdAt = endDate;
              updateData = {
                maxNomination,
              };

              wall.maxNomination.createdAt = endDate;
            } else {
              const { nominationPerUser } = wall;

              nominationPerUser.createdAt = endDate;
              updateData = {
                nominationPerUser,
              };

              wall.nominationPerUser.createdAt = endDate;
            }

            await Wall.findOneAndUpdate({ _id: wall._id }, updateData);
          }
        };

        // getting wall posts
        const cb = async (createdAt, period) => {
          searchQuery.createdAt = {
            $lte: moment(createdAt)
              .add(periodMapping[period], 'M')
              .utc()
              .toDate(),
            $gte: moment(createdAt).utc().toDate(),
          };
          const cbResult = await WallPost.find(searchQuery, select).lean();

          return cbResult;
        };

        // get wallposts and check for max nomination
        if (wall.maxNomination.enabled) {
          await checkAndUpdate(wall.maxNomination, 'max');
          const wallPosts = await cb(
            wall.maxNomination.createdAt,
            wall.maxNomination.submissionPeriod,
          );
          const nomineeUsersLength = wallPosts.reduce(
            (x, y) => x + y.nomineeUsers.length,
            0,
          );

          if (
            wall.maxNomination.submissionLimit <
            nomineeUsersLength + req.body.nomineeUsers.length
          ) {
            return __.out(res, 300, 'Maximum nomination limit exceeds');
          }
        }

        // get wallposts and check for nomination per user
        if (wall.nominationPerUser.enabled) {
          await checkAndUpdate(wall.nominationPerUser, 'nomiPerUser');
          const wallPosts = await cb(
            wall.nominationPerUser.createdAt,
            wall.nominationPerUser.submissionPeriod,
          );
          const nomineeUsersArr = wallPosts.reduce(
            (x, y) => [...x, ...y.nomineeUsers.map((user) => user.toString())],
            [],
          );
          const limitExceeds = req.body.nomineeUsers.find(
            (nUser) =>
              wall.nominationPerUser.submissionLimit ===
              nomineeUsersArr.filter((user) => user === nUser).length,
          );

          if (limitExceeds) {
            return __.out(
              res,
              300,
              'Maximum nomination per user limit exceeds',
            );
          }
        }
      }

      let { category } = req.body;

      if (!Array.isArray(req.body.category)) {
        category = [req.body.category];
      }

      const insertPost = {
        wallId: req.body.wallId,
        category,
        title: req.body.title,
        description: req.body.description || '',
        attachments: req.body.attachments || [],
        author: req.user._id,
        taskList: req.body.taskList || [],
        assignedToList: req.body.assignedToList || [],
        nomineeUsers: req.body.nomineeUsers || [],
        assignedEmojis: req.body.assignedEmojis || [],
        moduleIncluded: !!req.body.moduleIncluded,
        anonymousPost: !!req.body.anonymousPost,
        status: 1,
      };

      if (req.body.moduleIncluded === true) {
        insertPost.moduleId = req.body.moduleId;
      }

      if (req.body.taskDueDate) {
        insertPost.taskDueDate = moment(req.body.taskDueDate)
          .endOf('day')
          .utc()
          .format();
      }

      // If admin means add priority date
      if (req.body.priorityDate)
        insertPost.priorityDate = moment(req.body.priorityDate).utc().format();

      // Add created at and user
      insertPost.taskList = insertPost.taskList.map((v) => {
        v.createdBy = req.user._id;
        v.createdAt = moment().utc().format();
        return v;
      });

      const newPost = await new WallPost(insertPost).save();

      if (newPost._id) {
        await ChallengeModule.triggerChallenge(
          res,
          req.user._id,
          newPost._id,
          'wall',
          4,
        );
      }

      // trigger challenge for nominated user
      if (!!newPost.nomineeUsers && !!newPost.nomineeUsers.length) {
        await ChallengeModule.triggerChallenge(
          res,
          newPost.nomineeUsers,
          newPost._id,
          'wall',
          8,
        );
      }

      if (!newPost) return __.out(res, 300, 'Error while creating post');

      // Send Assignes Push
      newPost.body = newPost.title;
      this.sendAssignNotification(newPost, req.body.assignedToList);
      // send push notification for nominated users
      if (!!req.body.nomineeUsers && !!req.body.nomineeUsers.length) {
        newPost.body = `You have been nominated! Check out the post on ${wall.wallName}`;
        newPost._id = `${newPost._id}_nomi`;
        this.sendAssignNotification(newPost, req.body.nomineeUsers);
      }

      return __.out(res, 201, 'Post created successfully!');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  // Upload Atachments
  async uploadFiles(req, res) {
    try {
      // Delete File
      if (req.body.deleteFile === 'true' && req.body.filePath) {
        const filePath = `public/${req.body.filePath}`;

        if (fs.existsSync(filePath)) {
          __.log(`file exists`);
          await fs.unlink(filePath);
        }

        return __.out(res, 201, `Attachment deleted`);
      }

      if (!req.file) __.out(res, 300, `No File is Uploaded`);

      await __.scanFile(
        req.file.filename,
        `public/uploads/wall/${req.file.filename}`,
      );

      return __.out(res, 201, {
        filePath: `uploads/wall/${req.file.filename}`,
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // update the user's post
  async updatePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Check required fields
      const requiredResult = await __.checkRequiredFields(
        req,
        ['wallId', 'postId', 'category', 'title', 'description'],
        'wallPost',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Get Wall Verification
      const wallData = await Wall.findOne({
        _id: req.body.wallId,
        status: 1,
      }).lean();

      if (!wallData) {
        return __.out(res, 300, `Wall not found`);
      }

      // Check user is in this wall
      const userWalls = await AssignUserRead.getUserInAssignedUser(
        req.user,
        Wall,
      );

      if (userWalls.indexOf(wallData._id) === -1) {
        // return __.out(res, 300, `Permission denied`);
      }

      const isUserAuthorized = __.isUserAuthorized(req, req.body.wallId);

      if (!isUserAuthorized) return __.out(res, 403, 'Forbidden Access');

      const where = {
        _id: req.body.postId,
        wallId: req.body.wallId,
        status: 1,
      };
      const isAvail = await WallPost.findOne(where).lean();

      isAvail.nomineeUsers = req.body.nomineeUsers || [];
      let isTaskCompleted = true;
      let newTaskAdded = false;

      req.body.taskList = req.body.taskList || [];
      req.body.taskList = req.body.taskList.map((v) => {
        if (!v._id) {
          newTaskAdded = true;
          v.createdBy = req.user._id;
          v.createdAt = moment().utc().format();
        }

        if (!v.status || v.status === 0) {
          isTaskCompleted = false;
        }

        return v;
      });
      let { category } = req.body;

      if (!Array.isArray(req.body.category)) {
        category = [req.body.category];
      }

      const updatedData = {
        wallId: req.body.wallId,
        category,
        title: req.body.title,
        taskList: req.body.taskList || [],
        description: req.body.description,
        assignedToList: req.body.assignedToList || [],
        nomineeUsers: isAvail.nomineeUsers || [],
        priorityDate: moment(req.body.priorityDate).utc().format(),
        attachments: req.body.attachments || [],
        assignedEmojis: req.body.assignedEmojis || [],
        author: req.user._id,
        isTaskCompleted,
        lastUpdated: moment().utc().format(),
      };

      // End of day
      if (req.body.taskDueDate) {
        updatedData.taskDueDate = moment(req.body.taskDueDate)
          .endOf('day')
          .utc()
          .format();
      }

      const isUpdates = await WallPost.findOneAndUpdate(
        where,
        {
          $set: updatedData,
        },
        {
          new: true,
        },
      ).lean();

      if (!isUpdates) return __.out(res, 300, 'Error while updating');

      // Send Assignes Push
      if (newTaskAdded === true) {
        isUpdates.body = isUpdates.title;
        this.sendAssignNotification(isUpdates, req.body.assignedToList);
      }

      return __.out(res, 201, 'Updated Successfully!');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async deletePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['postId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const wallPost = await WallPost.findOne({
        _id: req.body.postId,
        status: 0 || 1 || 2,
      });

      if (!wallPost) return __.out(res, 300, 'Invalid PostId');

      wallPost.status = 3;
      await wallPost.save();
      return __.out(res, 201, `Post deleted`);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async likePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Check required fields
      const requiredResult = await __.checkRequiredFields(
        req,
        ['postId', 'isLiked'],
        'wallPostLike',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Post Data availability verification
      const postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1,
      }).lean();

      if (!postData) return __.out(res, 300, 'No Post Found');

      // Getting the wall record
      const wallData = postData.wallId;

      if (!wallData) return __.out(res, 300, 'No Wall Found');

      // Getting user Record
      const userData = req.user;

      if (!userData) return __.out(res, 300, 'No User Found');

      const isUserAuthorized = __.isUserAuthorized(req, wallData._id);

      if (!isUserAuthorized) return __.out(res, 403, 'Forbidden Access');

      const query = {
        postId: postData._id,
        userId: req.user,
        wallId: wallData,
        status: 1,
      };
      const update = {
        isLiked: req.body.isLiked,
      };
      const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      };

      const isAlreadyLiked = await WallPostLike.findOne({
        postId: postData._id,
        userId: req.user,
        wallId: wallData,
        status: 1,
        isLiked: true,
      });

      if (isAlreadyLiked && req.body.isLiked) {
        return __.out(res, 201, 'This post is already Liked');
      }

      const isLikedPost = await WallPostLike.findOneAndUpdate(
        query,
        update,
        options,
      );

      if (isLikedPost) {
        const isCountUpdated = await WallPost.findOneAndUpdate(
          {
            _id: postData._id,
          },
          {
            $inc: {
              likesCount: 1,
            },
            likedBy: req.user._id,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );

        if (!isCountUpdated)
          return __.out(res, 300, 'Error while updating like count');

        return __.out(res, 201, 'Liked Successfully');
      }

      return __.out(res, 300, 'Error while performing like');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async commentPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Check required fields
      const requiredResult = await __.checkRequiredFields(
        req,
        ['postId'],
        'wallPostComment',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Post Data availability verification
      const postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1,
      }).lean();

      if (!postData) return __.out(res, 300, 'No Post Found');

      // Getting the wall record
      const wallData = postData.wallId;

      if (!wallData) return __.out(res, 300, 'No Wall Found');

      const isUserAuthorized = __.isUserAuthorized(req, wallData._id);

      if (!isUserAuthorized) return __.out(res, 403, 'Forbidden Access');

      // Getting user Record
      const userData = req.user;

      if (!userData) return __.out(res, 300, 'No User Found');

      if (req.body.commentId) {
        const query = {
          _id: req.body.commentId,
        };
        const update = {
          comment: req.body.comment || '',
          attachment: req.body.attachment || {},
          userId: req.user._id,
          wallId: wallData._id,
          postId: postData._id,
        };
        const options = {
          upsert: false,
          new: false,
          setDefaultsOnInsert: false,
        };

        const commentUpdatedData = await WallPostComment.findOneAndUpdate(
          query,
          update,
          options,
        );

        if (!commentUpdatedData)
          return __.out(res, 300, 'Oops something went wrong');

        return __.out(res, 201, 'Comment updated successfully');
      }

      const addComment = await WallPostComment.create({
        postId: postData._id,
        userId: userData._id,
        wallId: wallData,
        comment: req.body.comment || '',
        attachment: req.body.attachment || {},
        status: 1,
      });

      if (!addComment) return __.out(res, 300, 'Oops something went wrong');

      const isCountUpdated = await WallPost.findOneAndUpdate(
        {
          _id: postData._id,
        },
        {
          $inc: {
            commentCount: 1,
          },
        },
        {
          upsert: true,
          new: true,
        },
      );

      if (!isCountUpdated)
        return __.out(res, 300, 'Error while updating comment count');

      return __.out(res, 201, 'Comment created successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async sharePost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'shareTo',
      ]);

      if (requiredResult.status === false)
        return __.out(res, 400, requiredResult.missingFields);

      const postData = await WallPost.findOne({
        _id: req.body.postId,
      }).lean();

      __.log(postData);

      if (!postData) return __.out(res, 300, 'Invalid post data');

      const wallData = await Wall.findOne({
        _id: postData.wallId,
      }).lean();

      if (!wallData) return __.out(res, 300, 'Invalid wall data');

      const isUserAuthorized = __.isUserAuthorized(req, wallData._id);

      if (!isUserAuthorized) return __.out(res, 403, 'Forbidden Access');

      let incShare = 0;
      const savePromises = [];

      for (const elem of req.body.shareTo) {
        let { category } = postData;

        if (!Array.isArray(postData.category)) {
          category = [category];
        }

        const insert = {
          wallId: elem,
          category: postData.category || [],
          title: postData.title,
          description: postData.description,
          attachments: postData.attachments,
          author: postData.author,
          sharedBy: req.user._id,
          status: postData.status,
          isShared: true,
          sharedType: 1,
          fromWall: postData.wallId,
          fromWallPost: postData._id,
        };

        savePromises.push(new WallPost(insert).save());

        incShare += 1;
      }
      await Promise.all(savePromises);
      const isCountUpdated = await WallPost.findOneAndUpdate(
        {
          _id: postData._id,
        },
        {
          $inc: {
            sharedCount: incShare,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      if (!isCountUpdated)
        return __.out(res, 300, 'Error while updating comment count');

      return __.out(res, 201, 'Shared successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async deleteComment(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['commentId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const query = {
        _id: req.body.commentId,
      };
      const update = {
        status: 3,
      };
      const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      };

      const isSoftDeleted = await WallPostComment.findOneAndUpdate(
        query,
        update,
        options,
      );

      if (!isSoftDeleted)
        return __.out(res, 300, 'Error while updating comment');

      const isCountUpdated = await WallPost.findOneAndUpdate(
        {
          _id: isSoftDeleted.postId,
        },
        {
          $inc: {
            commentCount: -1,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      if (!isCountUpdated)
        return __.out(res, 300, 'Error while updating comment count');

      return __.out(res, 201, 'Comment deleted successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async addEmoji(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Check required fields
      const requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'emojiId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Post Data availability verification
      const postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1,
      }).lean();

      if (!postData) return __.out(res, 300, 'No Post Found');

      const emojiData = await Emoji.findOne({
        _id: req.body.emojiId,
        status: 1,
      }).lean();

      if (!emojiData) return __.out(res, 300, 'Emoji not found');

      const query = {
        _id: req.body.postId,
        status: 1,
      };
      const update = {
        emoji: req.body.emojiId,
      };
      const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      };

      const isLikedPost = await WallPost.findOneAndUpdate(
        query,
        update,
        options,
      );

      if (!isLikedPost) return __.out(res, 300, 'Error while adding Emoji');

      return __.out(res, 201, 'Emoji added successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async addTask(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Check required fields
      const requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'taskList',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Post Data availability verification
      const postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1,
      });

      if (!postData) return __.out(res, 300, 'No Post Found');

      // Add created at and user
      postData.isTaskCompleted = true;
      req.body.taskList = req.body.taskList.map((v) => {
        if (!v._id) {
          v.createdBy = req.user._id;
          v.createdAt = moment().utc().format();
        }

        if (!v.status || v.status === 0) {
          postData.isTaskCompleted = false;
        }

        return v;
      });

      postData.taskList = req.body.taskList;
      if (req.body.taskDueDate) {
        postData.taskDueDate = moment(req.body.taskDueDate).utc().format();
      }

      if (req.body.assignedToList) {
        postData.assignedToList = req.body.assignedToList;
      }

      await postData.save();

      return __.out(res, 201, 'Task updated successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  // Send Push to Assigned Users
  async sendAssignNotification(post, usersList) {
    try {
      usersList = usersList || [];
      if (usersList.length === 0) {
        return;
      }

      const users = await User.find({ _id: { $in: usersList }, status: 1 })
        .select('deviceToken')
        .lean();
      const deviceTokens = users.map((v) => v.deviceToken).filter(Boolean);

      if (deviceTokens.length > 0) {
        const pushData = {
          title: post.title,
          body: post.body,
          redirect: 'wallpost',
        };
        const collapseKey = post._id;

        FCM.push(deviceTokens, pushData, collapseKey);
      }
    } catch (error) {
      __.log(error);
      __.out(error, 500);
    }
  }

  // Export the Wallpost..

  async exportWallPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const wallPostDetails = await WallPost.findById(req.body._id)
        .select('title description moduleIncluded moduleId wallId')
        .lean();
      const wallData = await Wall.findOne({
        _id: wallPostDetails.wallId,
      });
      let userId = await AssignUserRead.read(
        wallData.assignUsers,
        null,
        wallData.createdBy,
      );

      userId = userId.users;
      if (wallPostDetails) {
        const questionField = [];
        const questionList = {};

        if (wallPostDetails.moduleIncluded) {
          // Question Options
          const questionData = await Question.find({
            moduleId: wallPostDetails.moduleId,
            status: 1,
          })
            .select('options type')
            .sort({
              indexNum: 1,
            })
            .lean();

          let int = 1;

          for (const elem of questionData) {
            questionField.push(`Q-${int}`);
            questionList[elem._id] = {
              title: `Q-${int}`,
              type: elem.type,
            };
            // MCQ,trueFalse,Polling
            if ([2, 3, 4, 5].indexOf(elem.type) > -1) {
              questionList[elem._id].options = {};
              for (const optionData of elem.options) {
                questionList[elem._id].options[optionData._id] = optionData;
              }
            }

            int += 1;
          }
        }

        const jsonArray = [];
        const { title } = wallPostDetails;
        const { description } = wallPostDetails;
        const wallIdCount = userId.length;
        const wallId = userId;

        const processUserDetails = async (i) => {
          const userDetails = await User.findOne(wallId[i]).lean();
          const json = {};

          json.title = title;
          json.description = description;
          json.StaffName = userDetails.name ? userDetails.name : '';
          json.StaffID = (
            userDetails.staffId ? userDetails.staffId : ''
          ).toString();
          json.StaffAppointment = userDetails.appointmentId
            ? userDetails.appointmentId.name
            : '';

          const resData = await QuestionResponse.find({
            wallPostId: wallPostDetails._id,
            userId: wallId[i],
            status: 1,
          }).lean();

          for (const elem of resData) {
            const qnsData = questionList[elem.questionId];

            if (qnsData !== undefined) {
              if ([2, 3, 4, 5].indexOf(qnsData.type) > -1) {
                const optData = qnsData.options[elem.option];

                if (optData) {
                  if (json[qnsData.title]) {
                    json[qnsData.title] =
                      `${json[qnsData.title]},${optData.value}` || '';
                  } else {
                    json[qnsData.title] = optData.value;
                  }
                }
              } else {
                json[qnsData.title] = qnsData.value || '';
              }
            }
          }

          jsonArray.push(json);
        };

        const processAcknowledgedArray = async () => {
          const promises = [];

          for (let i = 0; i < wallIdCount; i += 1) {
            promises.push(processUserDetails(i));
          }

          await Promise.all(promises);
        };

        await processAcknowledgedArray();

        // await processUnreadArray();

        let csvLink = '';
        let fieldsArray = [
          'title',
          'description',
          'StaffName',
          'StaffID',
          'StaffAppointment',
        ];

        fieldsArray = [...fieldsArray, ...questionField];

        if (jsonArray.length !== 0) {
          const csv = json2csv({
            data: jsonArray,
            fields: fieldsArray,
          });
          const fileName = Math.random().toString(36).substr(2, 10);

          await fs.writeFile(
            `./public/uploads/wallPostExports/${fileName}.csv`,
            csv,
          );
          csvLink = `uploads/wallPostExports/${fileName}.csv`;
          return __.out(res, 201, {
            csvLink,
          });
        }

        return __.out(res, 201, { csvLink });
      }

      return __.out(res, 300, 'Invalid wallpost');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Add Nominee ..

  async addNominees(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Check required fields
      const requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'nomineeUsers',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        _id: req.body.postId,
        status: 1,
      };

      const isUpdates = await WallPost.findOne(where);

      if (isUpdates.nomineeUsers) {
        isUpdates.nomineeUsers = [
          ...isUpdates.nomineeUsers,
          ...req.body.nomineeUsers,
        ];
        isUpdates.nomineeUsers = [...new Set(isUpdates.nomineeUsers)];
      }

      await isUpdates.save();
      if (!isUpdates) {
        return __.out(res, 300, 'Error while updating');
      }

      return __.out(res, 201, 'Nominees updated successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  async adminResponse(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Check required fields
      const requiredResult = await __.checkRequiredFields(
        req,
        req.body._id ? ['adminResponse'] : ['postId', 'adminResponse'],
        'wallPostAdminResponse',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      if (req.body._id) {
        const adminResponse = await WallPostAdminResponse.findOne({
          _id: req.body._id,
          userId: req.user._id,
          status: 1,
        });

        if (!adminResponse) return __.out(res, 300, 'No Admin Response Found');

        req.body.postId = adminResponse.postId;
      }

      // Post Data availability verification
      const postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1,
      })
        .populate({
          path: 'wallId',
          select: { adminResponse: 1, assignUsers: 1 },
        })
        .lean();

      if (!postData) return __.out(res, 300, 'No Post Found');

      // Getting the wall record
      const wallData = postData.wallId;

      if (!wallData || !wallData._id) return __.out(res, 300, 'No Wall Found');

      // check admin response enabled for board
      if (!wallData.adminResponse)
        return __.out(res, 300, 'Admin Respones not enabled for this board');

      // check current user, admin or author of post
      const eligibleUsers = wallData.assignUsers.reduce(
        (final, au) => [...final, ...au.admin.map((ad) => ad.toString())],
        [postData.author.toString()],
      );

      if (!eligibleUsers.includes(req.user._id.toString())) {
        return __.out(res, 300, 'Board admins can only create admin response');
      }

      if (req.body._id) {
        // update admin response
        const query = {
          _id: req.body._id,
          postId: req.body.postId,
          userId: req.user._id,
        };
        const update = {
          adminResponse: req.body.adminResponse || '',
          attachment: req.body.attachment || {},
          privateResponse: req.body.privateResponse,
        };

        const commentUpdatedData = await WallPostAdminResponse.findOneAndUpdate(
          query,
          update,
        );

        if (!commentUpdatedData)
          return __.out(res, 300, 'Oops something went wrong');
      }

      // create admin response
      const addComment = await WallPostAdminResponse.create({
        postId: postData._id,
        userId: req.user._id,
        wallId: wallData._id,
        adminResponse: req.body.adminResponse || '',
        privateResponse: !!req.body.privateResponse,
        attachment: req.body.attachment || {},
        status: 1,
      });

      // sending push notification to admins of board
      const pushData = {
        _id: postData._id,
        title: postData.title,
        body: `An admin response was posted`,
      };
      const userIds = [...new Set(eligibleUsers)]; // ids of post created user and admins of board

      userIds.splice(
        userIds.findIndex((id) => id.toString() === req.user._id),
        1,
      );
      this.sendAssignNotification(pushData, userIds);

      if (!addComment) return __.out(res, 300, 'Oops something went wrong');

      return __.out(res, 201, 'Admin Response created succussfully');
    } catch (error) {
      return __.out(res, 500);
    }
  }

  async deleteAdminResponse(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, ['responseId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const adminResponse = await WallPostAdminResponse.findOne({
        _id: req.body.responseId,
        userId: req.user._id,
      });

      if (!adminResponse) {
        return __.out(
          res,
          300,
          'This admin response not belong to you / not found',
        );
      }

      adminResponse.status = 3;
      await adminResponse.save();

      return __.out(res, 201, 'Admin response deleted successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }
}

const wallPostInstance = new WallPostClass();

module.exports = wallPostInstance;
