const mongoose = require('mongoose');
const { parse } = require('json2csv');
const fs = require('fs-extra');
const moment = require('moment');
const Channel = require('../../models/channel');
const PostCategory = require('../../models/postCategory');
const PostComment = require('../../models/channelPostComment');
const SocialWallModel = require('../../models/wall');
const BuilderModule = require('../../models/builderModule');
const ChannelModel = require('../../models/channel');
const Company = require('../../models/company');
const WallCategoryModel = require('../../models/wallCategory');
const postLogController = require('./postLogController');
const ReportChennelPost = require('../../models/reportChannelPost');
const QuestionResponse = require('../../models/questionResponse');
const socialWallPosts = require('../../models/wallPost');
const Post = require('../../models/post');
const __ = require('../../../helpers/globalFunctions');
const { logInfo } = require('../../../helpers/logger.helper');
const { AssignUserRead } = require('../../../helpers/assinguserread');

class PostController {
  async uploadFile(req, res) {
    try {
      return res.success({ path: `${req.file.path.split('public')[1]}` });
    } catch (error) {
      return res.error(error);
    }
  }

  async create(req, res) {
    try {
      const createWall = async (insertPostInfo) => {
        try {
          const channelData = await ChannelModel.findOne({
            _id: insertPostInfo.channelId,
          }).lean();

          if (!channelData) return false;

          // Change author to user key
          channelData.userDetails = channelData.userDetails.map((v) => {
            v.user = v.authors;
            return v;
          });
          // Remove HTML Tags
          const wallTitle = insertPostInfo.title.replace(/<(.|\n)*?>/g, ' ');
          const insertWall = {
            wallName: wallTitle,
            displayType: 1,
            postType: 1,
            isTaskActive: true,
            bannerImage: insertPostInfo.eventWallLogoImage,
            assignUsers: channelData.userDetails,
            companyId: channelData.companyId,
            createdBy: channelData._id,
            eventId: insertPostInfo.content._id,
            wallType: 2,
            status: insertPostInfo.status,
            eventWallStartDate: insertPostInfo.content.eventWallStartDate,
            eventWallEndDate: insertPostInfo.content.eventWallEndDate,
          };
          const newWall = await new SocialWallModel(insertWall).save();

          if (!newWall) {
            return false;
          }

          // Create Category for Wall from the selected event category
          const postCatData = await PostCategory.findOne({
            _id: insertPostInfo.categoryId,
          }).lean();
          const insertWallCat = {
            categoryName: postCatData.name,
            wallId: newWall._id,
          };
          const catId = await new WallCategoryModel(insertWallCat).save();

          newWall.category = [catId._id];
          await newWall.save();
          return newWall;
        } catch (error) {
          return false;
        }
      };
      const bodyContent = JSON.parse(JSON.stringify(req.body));

      delete bodyContent.teaser;
      delete bodyContent.content;
      delete bodyContent.wallTitle;
      if (!__.checkHtmlContent(bodyContent)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let requiredFields = ['channelId', 'categoryId', 'postType'];

      if (req.body.status !== 2) {
        requiredFields = [
          'channelId',
          'categoryId',
          'teaser',
          'content',
          'publishing',
          'userOptions',
          'postType',
        ];
      }

      const requiredResult = await __.checkRequiredFields(
        req,
        requiredFields,
        'post',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      if (
        !__.checkSpecialCharacters(
          req.body,
          req.body.postType === 'event' ? 'manageEvent' : 'manageNews',
        )
      ) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      /** Parsing Data  */
      if (typeof req.body.teaser === 'string') {
        req.body.teaser = JSON.parse(req.body.teaser);
        req.body.content = JSON.parse(req.body.content);
        req.body.eventDetails = JSON.parse(req.body.eventDetails);
        req.body.publishing = JSON.parse(req.body.publishing);
        req.body.userOptions = JSON.parse(req.body.userOptions);
        if (req.body.postType !== 'news') {
          req.body.wallTitle = JSON.parse(req.body.wallTitle);
        }
      }

      /* Date Conversion */
      if (req.body.publishing.startDate) {
        req.body.publishing.startDate = moment(req.body.publishing.startDate)
          .utc()
          .format();
        req.body.updated = req.body.publishing.startDate;
      }

      if (req.body.publishing.endDate) {
        req.body.publishing.endDate = moment(req.body.publishing.endDate)
          .utc()
          .format();
      }

      if (req.body.eventDetails.startDate) {
        req.body.eventDetails.startDate = moment(
          req.body.eventDetails.startDate,
        )
          .utc()
          .format();
      }

      if (req.body.eventDetails.endDate) {
        req.body.eventDetails.endDate = moment(req.body.eventDetails.endDate)
          .utc()
          .format();
      }

      // Check He has permission to this channel
      req.body.internalApi = true;
      const channelList = await this.getAuthorChannels(req, res);
      const assignedChannelIds = [];

      for (const elem of channelList) {
        assignedChannelIds.push(elem._id);
      }

      __.log(req.files, 'req.files');

      req.body.teaser.image = req.body.teaserImage || req.body.teaser.image;
      if (req.body.content.isTeaserImage === true) {
        __.log(
          req.body.content.isTeaserImage,
          'req.body.content.isTeaserImage',
        );
        req.body.content.image = req.body.teaser.image;
      } else {
        req.body.content.image = req.body.mainImage || req.body.content.image;
      }

      if (
        req.body.wallTitle &&
        req.body.wallTitle.isTeaserImageForWall === true
      ) {
        __.log(
          req.body.wallTitle.isTeaserImageForWall,
          'req.body.content.isTeaserImageForWall',
        );
        req.body.eventWallLogoImage = req.body.teaser.image;
      }

      // Create Channel
      const insertPost = {
        channelId: req.body.channelId,
        categoryId: req.body.categoryId,
        teaser: req.body.teaser,
        content: req.body.content,
        eventDetails: req.body.eventDetails,
        publishing: req.body.publishing,
        userOptions: req.body.userOptions,
        postType: req.body.postType,
        status: req.body.status,
        authorId: req.user._id,
        updated: req.body.updated,
      };

      if (req.body.postType === 'event') {
        insertPost.title = req.body.wallTitle.title;
        insertPost.eventWallLogoImage = req.body.eventWallLogoImage;
      }

      // Link Module
      if (req.body.moduleId) {
        const moduleCheck = await BuilderModule.findOne({
          _id: req.body.moduleId,
          createdBy: req.user._id,
          status: 1,
        }).lean();

        if (!moduleCheck) {
          return __.out(res, 300, `Module Not Found`);
        }

        // Check module is already linked
        if (insertPost.status === 1) {
          insertPost.notifiedSent = false;
        }

        if (insertPost.status === 1 && req.body.postId) {
          const moduleLinked = await Notification.findOne({
            _id: {
              $nin: [req.body.postId],
            },
            moduleId: req.body.moduleId,
            status: 1,
          }).lean();

          if (moduleLinked) {
            return __.out(res, 300, `Module is already Linked !`);
          }
        }

        insertPost.moduleIncluded = true;
        insertPost.moduleId = req.body.moduleId;
      } else {
        insertPost.moduleIncluded = false;
      }

      const newPost = await new Post(insertPost).save();
      let createEventWall;

      if (req.body.postType === 'event' && req.body.eventCreation === 1) {
        createEventWall = await createWall(insertPost);
        if (!createEventWall)
          return __.out(res, 300, 'Error while creating event wall');

        const newPosupdate = await Post.findOneAndUpdate(
          {
            _id: newPost._id,
          },
          {
            wallId: createEventWall._id,
            wallName: createEventWall.wallName,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );

        if (!newPosupdate)
          return __.out(res, 300, 'Error while creating event wall');
      }

      let logPost = {
        channelId: req.body.channelId,
        categoryId: req.body.categoryId,
        teaser: req.body.teaser,
        content: req.body.content,
        eventDetails: req.body.eventDetails,
        publishing: req.body.publishing,
        eventBoard: req.body.eventBoard,
        userOptions: req.body.userOptions,
        postType: req.body.postType,
        status: req.body.status,
        authorId: req.user._id,
        logstatus: 1, // created,
        id: newPost._id,
      };

      if (req.body.postType === 'event' && req.body.eventCreation === 1) {
        logPost = {
          ...logPost,
          ...{
            wallId: createEventWall._id,
            wallName: createEventWall.wallName,
          },
        };
      }

      await postLogController.create(logPost, res);

      if (req.files) {
        if (req.files.teaserImage) {
          __.scanFile(
            req.files.teaserImage[0].filename,
            `public/uploads/posts/${req.files.teaserImage[0].filename}`,
          );
        }

        if (req.files.mainImage) {
          __.scanFile(
            req.files.mainImage[0].filename,
            `public/uploads/posts/${req.files.mainImage[0].filename}`,
          );
        }

        if (req.files.eventWallLogoImage) {
          __.scanFile(
            req.files.eventWallLogoImage[0].filename,
            `public/uploads/posts/${req.files.eventWallLogoImage[0].filename}`,
          );
        }
      }

      return __.out(res, 201, newPost);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async update(req, res) {
    try {
      const updateWall = async (updatePostInfo, body, postdata) => {
        try {
          const channelData = await ChannelModel.findOne({
            _id: updatePostInfo.channelId,
          }).lean();

          if (!channelData) return false;

          if (updatePostInfo.wallId) {
            // req.wallTitle = req.wallTitle.replace(/<(.|\n)*?>/g, ' ');
            if (!postdata.bannerImage) {
              const newWall = await SocialWallModel.findOneAndUpdate(
                {
                  _id: updatePostInfo.wallId,
                },
                {
                  $set: {
                    wallName: body.wallTitle.title,
                    isEventWallRequired: body.eventDetails?.isEventWallRequired,
                    bannerImage: body?.content?.eventWallLogoImage
                      ? body.content.eventWallLogoImage
                      : '',
                    assignUsers: channelData.userDetails,
                    status: body.status,
                    eventWallStartDate: body.content.eventWallStartDate,
                    eventWallEndDate: body.content.eventWallEndDate,
                  },
                },
                {
                  new: true,
                },
              );

              return newWall;
            }

            const newWall = await SocialWallModel.findOneAndUpdate(
              {
                _id: updatePostInfo.wallId,
              },
              {
                $set: {
                  wallName: body.wallTitle.title,
                  bannerImage: body?.content?.eventWallLogoImage
                    ? body.content.eventWallLogoImage
                    : '',
                  assignUsers: channelData.userDetails,
                  status: body.status,
                  eventWallStartDate: body.content.eventWallStartDate,
                  eventWallEndDate: body.content.eventWallEndDate,
                  isEventWallRequired: body.eventDetails?.isEventWallRequired,
                },
              },
              {
                new: true,
              },
            );

            return newWall;
          }

          const newWall = {
            wallName: body.wallTitle.title,
            bannerImage: body?.content?.eventWallLogoImage
              ? body.content.eventWallLogoImage
              : '',
            assignUsers: channelData.userDetails,
            status: body.status,
            eventWallStartDate: body.content.eventWallStartDate,
            eventWallEndDate: body.content.eventWallEndDate,
            isEventWallRequired: body.eventDetails?.isEventWallRequired,
          };
          const Wall = await new SocialWallModel(newWall).save();

          return Wall;
        } catch (error) {
          __.log(error);
          return false;
        }
      };
      const bodyContent = JSON.parse(JSON.stringify(req.body));

      delete bodyContent.teaser;
      delete bodyContent.content;
      delete bodyContent.wallTitle;
      if (!__.checkHtmlContent(bodyContent)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let requiredFields = ['postId', 'channelId', 'categoryId', 'postType'];

      if (req.body.status !== 2) {
        requiredFields = [
          'postId',
          'channelId',
          'categoryId',
          'teaser',
          'content',
          'publishing',
          'userOptions',
          'postType',
        ];
      }

      const requiredResult = await __.checkRequiredFields(
        req,
        requiredFields,
        'post',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      if (
        !__.checkSpecialCharacters(
          req.body,
          req.body.postType === 'event' ? 'manageEvent' : 'manageNews',
        )
      ) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      /** Parsing Data  */
      if (typeof req.body.teaser === 'string') {
        req.body.teaser = JSON.parse(req.body.teaser);
        req.body.content = JSON.parse(req.body.content);
        req.body.eventDetails = JSON.parse(req.body.eventDetails);
        req.body.publishing = JSON.parse(req.body.publishing);
        req.body.userOptions = JSON.parse(req.body.userOptions);
        if (req.body.postType !== 'news') {
          req.body.wallTitle = JSON.parse(req.body.wallTitle);
        }
      }

      /* Date Conversion */
      __.log(req.body.eventDetails, 'date format');
      if (req.body.publishing.startDate) {
        req.body.publishing.startDate = moment(req.body.publishing.startDate)
          .utc()
          .format();
      }

      if (req.body.publishing.endDate) {
        req.body.publishing.endDate = moment(req.body.publishing.endDate)
          .utc()
          .format();
      }

      if (req.body.eventDetails.startDate) {
        req.body.eventDetails.startDate = moment(
          req.body.eventDetails.startDate,
        )
          .utc()
          .format();
      }

      if (req.body.eventDetails.endDate) {
        req.body.eventDetails.endDate = moment(req.body.eventDetails.endDate)
          .utc()
          .format();
      }

      // Get User's assigned channels
      // let userChannelIds = await __.getUserChannel(req.user);
      const channels = await Channel.find(
        {
          assignUsers: {
            $elemMatch: {
              admin: {
                $in: [req.user._id],
              },
            },
          },
          status: 1,
        },
        {
          _id: 1,
        },
      );

      const userChannelIds = channels.map((c) => c._id);
      const postType = __.toTitleCase(req.body.postType);
      const postData = await Post.findOne({
        _id: req.body.postId,
        channelId: {
          $in: userChannelIds,
        },
        status: {
          $nin: [3],
        },
      });

      if (!postData) {
        return __.out(res, 300, `${postType} Not Found`);
      }

      req.body.teaser.image = req.body.teaserImage || req.body.teaser.image;
      if (req.body.content.isTeaserImage === true) {
        __.log(
          req.body.content.isTeaserImage,
          'req.body.content.isTeaserImage',
        );
        req.body.content.image = req.body.teaser.image;
      } else {
        req.body.content.image =
          req.body.teaser.mainImage || req.body.content.image;
      }

      if (
        req.body.wallTitle &&
        req.body.wallTitle.isTeaserImageForWall === true
      ) {
        __.log(
          req.body.wallTitle.isTeaserImageForWall,
          'req.body.content.isTeaserImageForWall',
        );
        req.body.content.eventWallLogoImage = req.body.teaser.image;
      } else {
        req.body.content.eventWallLogoImage = req.body.eventWallLogoImage;
      }

      // Create Channel
      req.body.teaser.image = req.body.teaser.image || postData.teaser.image;
      req.body.content.image = req.body.content.image || postData.content.image;
      postData.channelId = req.body.channelId;
      postData.categoryId = req.body.categoryId;
      postData.teaser = req.body.teaser;
      postData.content = req.body.content;
      postData.eventDetails = req.body.eventDetails;
      postData.publishing = req.body.publishing;
      postData.userOptions = req.body.userOptions;
      postData.postType = req.body.postType;
      postData.status = req.body.status;
      postData.updated = new Date();
      if (
        !postData.bannerImage &&
        !!req.body.wallTitle &&
        req.body.wallTitle.isTeaserImageForWall === true
      ) {
        postData.bannerImage = req.body.teaser.image;
      }

      // postData.wallTitle=req.body.wallTitle;
      if (req.body.wallTitle) {
        postData.wallName = req.body.wallTitle.title;
      }

      //  // Link Module
      if (req.body.moduleId) {
        const moduleCheck = await BuilderModule.findOne({
          _id: req.body.moduleId,
          createdBy: req.user._id,
          status: 1,
        }).lean();

        if (!moduleCheck) {
          return __.out(res, 300, `Module Not Found`);
        }

        //     // Check module is already linked
        if (postData.status === 1 && req.body.postId) {
          const moduleLinked = await Post.findOne({
            _id: {
              $nin: [req.body.postId],
            },
            moduleId: req.body.moduleId,
            status: 1,
          }).lean();

          if (moduleLinked) {
            return __.out(res, 300, `Module is already Linked !`);
          }
        }

        postData.moduleIncluded = true;
        postData.moduleId = req.body.moduleId;
      } else {
        postData.moduleIncluded = false;
        postData.moduleId = null;
      }

      if (postData.notifiedSent || bodyContent.isNotifi === 'true') {
        postData.notifiedSent = bodyContent.isNotifi !== 'true';
      }

      const updatedPost = await postData.save();
      let isWallUpdated;

      if (req.body.postType === 'event') {
        isWallUpdated = await updateWall(updatedPost, req.body, postData);
        postData.wallId = isWallUpdated._id;
        postData.save();
      }

      let logPost = {
        channelId: req.body.channelId,
        categoryId: req.body.categoryId,
        teaser: req.body.teaser,
        content: req.body.content,
        eventDetails: req.body.eventDetails,
        publishing: req.body.publishing,
        userOptions: req.body.userOptions,
        postType: req.body.postType,
        status: req.body.status,
        authorId: req.user._id,
        logstatus: 2, // updated
        id: postData._id,
      };

      if (req.body.postType === 'event') {
        logPost = {
          ...logPost,
          ...{
            wallId: updatedPost._id,
            wallName: updatedPost.wallName,
          },
        };
      }

      await postLogController.create(logPost, res);
      if (req.files) {
        if (req.files.teaserImage) {
          __.scanFile(
            req.files.teaserImage[0].filename,
            `public/uploads/posts/${req.files.teaserImage[0].filename}`,
          );
        }

        if (req.files.mainImage) {
          __.scanFile(
            req.files.mainImage[0].filename,
            `public/uploads/posts/${req.files.mainImage[0].filename}`,
          );
        }

        if (req.files.eventWallLogoImage) {
          __.scanFile(
            req.files.eventWallLogoImage[0].filename,
            `public/uploads/posts/${req.files.eventWallLogoImage[0].filename}`,
          );
        }
      }

      return __.out(res, 201, updatedPost);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async remove(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        _id: req.params.postId,
        authorId: req.user._id,
        status: {
          $nin: [3],
        },
      };
      const removedPost = await Post.findOne(where);

      if (!removedPost) {
        return __.out(res, 300, 'News/ Event Not Found');
      }

      removedPost.status = 3;
      await removedPost.save();
      return __.out(res, 200, 'News/ Event Deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readOne(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        _id: req.params.postId,
        status: {
          $nin: [3],
        },
      };
      const postData = await Post.findOne(where)
        .populate({
          path: 'authorId',
          select: '_id name profilePicture',
        })
        .populate({
          path: 'categoryId',
          select: '_id name',
        })
        .populate({
          path: 'wallId',
        })
        .lean();

      if (!postData) {
        return __.out(res, 300, 'News/Event Not Found');
      }

      return __.out(res, 201, postData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getManageNews(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const channelIds = await Channel.find({
        'userDetails.admin': {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
      })
        .select('_id')
        .lean();
      const where = {
        status: {
          $nin: [3],
        },
      };

      if (!!channelIds && channelIds.length) {
        where.channelId = {
          $in: channelIds,
        };
      } else {
        return __.out(res, 201, {
          total: 0,
          postList: [],
        });
      }

      if (req.query.postType) {
        where.postType = req.query.postType;
      }

      if (req.query.channelId) {
        where.channelId = req.query.channelId;
      }

      if (req.query.categoryId) {
        where.categoryId = req.query.categoryId;
      }

      // Get Post Filtered List
      let postList = await Post.find(where)
        .populate({
          path: 'authorId',
          select: '_id name parentBussinessUnitId profilePicture',
          populate: {
            path: 'parentBussinessUnitId',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
              populate: {
                path: 'departmentId',
                select: 'name status companyId',
                populate: {
                  path: 'companyId',
                  select: 'name status',
                },
              },
            },
          },
        })
        .populate({
          path: 'channelId',
          select: '_id name logo',
        })
        .populate({
          path: 'categoryId',
          select: '_id name',
        })
        .populate({
          path: 'wallId',
        })
        .sort({
          createdAt: -1,
        })
        .lean();

      postList = postList.filter(
        (post) => post && post.authorId && post.authorId.name,
      );
      return __.out(res, 201, {
        total: postList.length,
        postList,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  async read(req, res) {
    try {
      logInfo('postController::read');
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // user can manage the
      const channelIds = await AssignUserRead.getUserInAssignedUser(
        req.user,
        Channel,
        'channel',
      );
      const where = {
        status: {
          $nin: [3],
        },
      };

      // if he is not assigning to any channel return empty
      if (channelIds.length > 0) {
        where.channelId = {
          $in: channelIds,
        };
      } else {
        return __.out(res, 201, {
          total: 0,
          postList: [],
        });
      }

      if (req.query.postType) {
        where.postType = req.query.postType;
      }

      if (req.query.channelId) {
        where.channelId = req.query.channelId;
      }

      if (req.query.categoryId) {
        where.categoryId = req.query.categoryId;
      }

      // Get Post Filtered List
      const postList = await Post.find(where)
        .populate({
          path: 'authorId',
          select: '_id name parentBussinessUnitId profilePicture',
          populate: {
            path: 'parentBussinessUnitId',
            select: 'name status sectionId',
            populate: {
              path: 'sectionId',
              select: 'name status departmentId',
              populate: {
                path: 'departmentId',
                select: 'name status companyId',
                populate: {
                  path: 'companyId',
                  select: 'name status',
                },
              },
            },
          },
        })
        .populate({
          path: 'channelId',
          select: '_id name logo',
        })
        .populate({
          path: 'categoryId',
          select: '_id name',
        })
        .populate({
          path: 'wallId',
        })
        .sort({
          createdAt: -1,
        })
        .lean();

      return __.out(res, 201, {
        total: postList.length,
        postList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getAuthorChannels(req, res) {
    try {
      const bodyContent = JSON.parse(JSON.stringify(req.body));

      delete bodyContent.teaser;
      delete bodyContent.content;
      delete bodyContent.wallTitle;
      if (!__.checkHtmlContent(bodyContent)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const channelIds = await AssignUserRead.getUserInAssignedUser(
        req.user,
        Channel,
        'channel',
      );
      let channelList = await Channel.find({
        _id: {
          $in: channelIds,
        },
      }).lean();

      if (req.body.internalApi === true) {
        return channelList;
      }

      // Make Category Inside Channel
      const getCat = async function () {
        const categoryPromises = channelList.map(async (elem) => {
          const cat = await PostCategory.find({
            channelId: elem._id,
            status: 1,
          })
            .select('_id name')
            .lean();

          elem.categoryList = cat;
          return elem;
        });

        channelList = await Promise.all(categoryPromises);
      };

      await getCat();
      return __.out(res, 201, {
        total: channelList.length,
        channelList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async uploadContentFiles(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      if (
        !req.file.filename.match(
          /\.(tiff|tif|svg|PNG|png|JPEG|jpeg|jpg|gif|txt|pdf|odt|doc|docx|wmv|mpg|mpeg|mp4|avi|3gp|3g2|xlsx|xls|xlr|pptx|ppt|odp|key)$/,
        )
      ) {
        return __.out(
          res,
          300,
          `Please upload this type extension tiff,tif,svg,png,jpeg,jpg,gif,txt,pdf,odt,doc,docx,wmv,mpg,mpeg,mp4,avi,3gp,3g2,xlsx,xls,xlr,pptx,ppt,odp,key `,
        );
      }

      const url = __.serverBaseUrl();
      const filePath = `${url}uploads/posts/${req.file.filename}`;

      /* await */ __.scanFile(
        req.file.filename,
        `public/uploads/posts/${req.file.filename}`,
      );

      return res.json({
        link: filePath,
        data: { link: filePath },
      });
      // return ({link:filePaths}),__.out(res, 201, {
      //     link: filePath
      // });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  // Get all Posts - Manage Event and Manage News
  async reportedPosts(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { page, search, sortWith, sortBy, draw } = req.query;
      let { limit, skip } = req.query;

      const pageNum = page ? parseInt(page, 10) : 0;

      limit = limit ? parseInt(limit, 10) : 10;
      skip = skip ? parseInt(skip, 10) : (pageNum - 1) * limit;
      // User as admin in chennel
      const searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let chennelId = await ChannelModel.find(searchQuery).lean();

      chennelId = chennelId.map((v) => mongoose.Types.ObjectId(v._id));
      // User as Manage Event and Manage News
      const query = {
        reportCount: {
          $gt: 0,
        },
        'channelId._id': {
          $in: chennelId,
        },
        status: {
          $in: [1, 2],
        },
        postType: req.params.postType === 'event' ? 'event' : { $ne: 'event' },
      };
      let isSearched = false;

      if (search) {
        isSearched = true;
        query.$or = [
          {
            'teaser.title': {
              $regex: `${search}`,
              $options: 'i',
            },
          },
          {
            'channelId.name': {
              $regex: `${search}`,
              $options: 'i',
            },
          },
        ];
      }

      const sort = {};

      if (sortWith) {
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        switch (sortWith) {
          case 'title':
            sort[`teaser.title`] = getSort(sortBy);
            break;

          case 'name':
            sort[`channelId.name`] = getSort(sortBy);
            break;

          case 'updatedAt':
            sort[`reportList.reportedAt`] = getSort(sortBy);
            break;

          case 'createdAt':
            sort[`reportList.reportedAt`] = getSort(sortBy);
            break;

          default:
            sort.status = getSort(sortBy);
            break;
        }
      }

      let postList = await Post.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'authorId',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: '$author',
        },
        {
          $lookup: {
            from: 'channels',
            localField: 'channelId',
            foreignField: '_id',
            as: 'channelId',
          },
        },
        {
          $unwind: '$channelId',
        },
        {
          $match: query,
        },
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);

      // Get all post id
      const postIds = postList.map((v) => v._id);
      const reportUsers = await ReportChennelPost.find({
        postId: {
          $in: postIds,
        },
      })
        .populate({
          path: 'userId',
          select: 'name userName profilePicture',
        })
        .lean();

      postList = postList.map((p) => {
        p.userList = reportUsers.filter(
          (v) => p._id.toString() === v.postId.toString(),
        );
        return p;
      });

      const CountQuery = {
        reportCount: {
          $gt: 0,
        },
        channelId: {
          $in: chennelId,
        },
        status: {
          $in: [1, 2],
        },
      };

      if (req.params.postType === 'event') {
        CountQuery.postType = req.params.postType;
      } else {
        CountQuery.postType = { $ne: 'event' };
      }

      let totalCount;
      const totalUserCount = await Post.count(CountQuery).lean();

      if (isSearched) {
        totalCount = await Post.aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'authorId',
              foreignField: '_id',
              as: 'author',
            },
          },
          {
            $unwind: '$author',
          },
          {
            $lookup: {
              from: 'channels',
              localField: 'channelId',
              foreignField: '_id',
              as: 'channelId',
            },
          },
          {
            $unwind: '$channelId',
          },
          {
            $match: query,
          },
        ]);
        totalCount = totalCount.length;
      } else {
        totalCount = totalUserCount;
      }

      const result = {
        draw: draw || 0,
        recordsTotal: totalUserCount || 0,
        recordsFiltered: totalCount || 0,
        data: postList,
      };

      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Posts -
  async reportedComments(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // User as admin in wall
      const searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let channelIds = await Channel.find(searchQuery, { _id: 1 }).lean();

      channelIds = channelIds.map((v) => mongoose.Types.ObjectId(v._id));
      let postIds = await Post.find(
        {
          channelId: {
            $in: channelIds,
          },
          status: 1,
        },
        { _id: 1 },
      ).lean();

      postIds = postIds.map((v) => mongoose.Types.ObjectId(v._id));

      const resultComment = await this.getComments(postIds, req.query);
      const commentList = resultComment.data.map((v) => {
        const data = {
          _id: v._id,
          comment: v.comment,
          postTitle: v.postId.teaser.title.replace(/<(.|\n)*?>/g, ' '),
          channelName: v.postId.channelId.name,
          reportList: v.reportList.map((j) => ({
            staffId: j.reportedBy[0].staffId,
            name: j.reportedBy[0].name,
            reportedAt: j.reportedAt,
          })),
          status: v.status,
        };

        return data;
      });

      const result = {
        draw: req.query.draw || 0,
        recordsTotal: resultComment.count || 0,
        recordsFiltered: resultComment.count || 0,
        data: commentList,
      };

      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getComments(postIds, { page, limit, search, sortBy, sortWith }) {
    const searchCondition = search
      ? [
          {
            $match: {
              $or: [
                {
                  comment: { $regex: search, $options: 'i' },
                },
                {
                  'postId.title': { $regex: search, $options: 'i' },
                },
                {
                  'wallId.wallName': { $regex: search, $options: 'i' },
                },
              ],
            },
          },
        ]
      : [];

    const [{ metadata, data }] = await PostComment.aggregate([
      {
        $match: {
          postId: {
            $in: postIds,
          },
          status: {
            $in: [1, 2],
          },
        },
      },
      {
        $lookup: {
          from: 'posts',
          localField: 'postId',
          foreignField: '_id',
          as: 'postId',
          pipeline: [
            {
              $project: {
                _id: 1,
                title: 1,
                wallName: 1,
                channelId: 1,
                teaser: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: '$postId',
      },
      {
        $lookup: {
          from: 'channels',
          localField: 'postId.channelId',
          foreignField: '_id',
          as: 'postId.channelId',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: '$postId.channelId',
      },
      {
        $unwind: '$reportList',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'reportList.reportedBy',
          foreignField: '_id',
          as: 'reportList.reportedBy',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                staffId: 1,
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: '$_id',
          comment: {
            $first: '$comment',
          },
          createdAt: {
            $first: '$createdAt',
          },
          postId: {
            $first: '$postId',
          },
          reportList: {
            $push: '$reportList',
          },
          status: {
            $first: '$status',
          },
        },
      },
      ...searchCondition,
      {
        $sort: {
          [sortWith]: sortBy === 'desc' ? -1 : 1,
        },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
            },
            {
              $limit: parseInt(limit, 10),
            },
          ],
        },
      },
    ]);

    if (data.length) {
      const [{ total: count }] = metadata;

      return { count, data };
    }

    return { count: 0, data: [] };
  }

  // Get all Update Posts - News and Events
  async updatereviewPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'status',
      ]);

      if (requiredResult.status === false)
        return __.out(res, 400, requiredResult.missingFields);

      const isUpdated = await Post.update(
        {
          _id: req.body.postId,
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      ).lean();

      if (!isUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      return __.out(res, 201, 'Updated successfully');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Update Posts - News and Events
  async updateCommentStatus(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'status',
      ]);

      if (requiredResult.status === false)
        return __.out(res, 400, requiredResult.missingFields);

      const isUpdated = await PostComment.update(
        {
          _id: req.body.postId,
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      ).lean();

      if (!isUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      return __.out(res, 201, 'Updated successfully');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async exportPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      if (!req.body._id) {
        return __.out(res, 300, 'Invalid Post');
      }

      const postId = req.body._id;
      const postDetails = await Post.findById(postId)
        .select({
          teaser: 1,
          moduleIncluded: 1,
          moduleId: 1,
          channelId: 1,
        })
        .populate([
          {
            path: 'channelId',
            select: 'userDetails createdBy',
          },
          {
            path: 'moduleId',
            select: 'questions',
            populate: {
              path: 'questions',
            },
          },
        ])
        .lean();

      if (!postDetails) {
        return __.out(res, 300, 'Post not found');
      }

      const questionResponses = await QuestionResponse.find({
        postId,
      })
        .populate({
          path: 'userId',
          select:
            'name staffId email appointmentId contactNumber parentBussinessUnitId',
          populate: [
            {
              path: 'appointmentId',
              select: 'name',
            },
            {
              path: 'parentBussinessUnitId',
              select: 'name',
              match: {
                status: 1,
              },
              populate: {
                path: 'sectionId',
                select: 'name',
                populate: {
                  path: 'departmentId',
                  select: 'name',
                  match: {
                    status: 1,
                  },
                  populate: {
                    path: 'companyId',
                    select: 'name',
                    match: {
                      status: 1,
                    },
                  },
                },
              },
            },
          ],
        })
        .lean();

      if (!!questionResponses && questionResponses.length) {
        // empty block
      } else {
        return __.out(res, 300, 'No data found');
      }

      let questions = postDetails.moduleId.questions.map(
        (qestion, i) => `Q-${i}`,
      );
      // postDetails.moduleId.questions
      const rows = [];
      const getOptionValue = (question, response) => {
        if (question.type === 11) {
          return response.answer;
        }

        if (response.answer) {
          if (Array.isArray(response.answer)) {
            if (response.answer.length === 1) {
              return response.answer[0].value;
            }

            return response.answer.map((answer) => answer.value).join(',');
          }

          return response.answer.value;
        }

        const index = question.options.findIndex(
          (opt) => opt._id.toString() === response.option.toString(),
        );

        if (index !== -1) {
          return question.options[index].value;
        }

        return '--';
      };
      const getAnswer = (question, response) => {
        let answer = null;

        if (response.answer === '') {
          switch (question.type) {
            case (1, 2, 3, 4, 5, 8, 9):
              break;

            case 6:
              answer = '';
              break;

            case 10:
              answer = `${response.answer.date || ''} ${
                response.answer.time || ''
              }`;
              break;

            case 11:
              answer = getOptionValue(question, response);
              break;

            case 12:
              answer = response.answer.name;
              break;

            case 13:
              answer = response.answer;
              break;

            case 14:
              answer = response.answer.reduce(
                (prev, curr) => `${prev}, ${curr.text}`,
                '',
              );
              break;

            case 15:
              answer = response.answer.map((a) => a.value).join(', ');
              break;

            default:
              break;
          }
          return answer || '--';
        }

        switch (question.type) {
          case (1, 2, 3, 4, 5, 8, 9):
            break;

          case 6:
            answer = '';
            break;

          case 10:
            answer = `${response.answer.date || ''} ${
              response.answer.time || ''
            }`;
            break;

          case 11:
            answer = getOptionValue(question, response);
            break;

          case 12:
            answer = response.answer.name;
            break;

          case 13:
            answer = response.answer;
            break;

          case 14:
            answer = response.answer.reduce(
              (prev, curr) => `${prev}, ${curr.text}`,
              '',
            );
            break;

          case 15:
            answer = response.answer.map((a) => a.value).join(', ');
            break;

          default:
            break;
        }
        return answer || '--';
      };
      // `Q-${i}`
      const userBasesResponses = questionResponses.reduce((prev, curr) => {
        prev[curr.userId._id] = prev[curr.userId._id] || [];
        prev[curr.userId._id].push(curr);
        return prev;
      }, {});

      const getQuestionAndAnswer = (userResponse) => {
        if (userResponse.length) {
          const output = postDetails.moduleId.questions.reduce(
            (prev, question, i) => {
              const index = userResponse.findIndex(
                (questionResponse) =>
                  questionResponse.questionId.toString() ===
                  question._id.toString(),
              );

              prev[`Q-${i + 1}`] =
                index === -1 ? '--' : getAnswer(question, userResponse[index]);
              return prev;
            },
            {},
          );
          const user = userResponse[0].userId;

          output.staffId = user.staffId;
          output.businessUnit = `${user.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;
          const data = postDetails.moduleId.questions.filter(
            (question) => question.type === 7,
          );

          if (data.length) {
            const { profile } = data[0];
            const internalQuestions = profile.map((iq) =>
              iq.questionName.toLowerCase(),
            );

            internalQuestions.forEach((element) => {
              switch (element) {
                case 'username':
                  output[element] = user.name;
                  questions = [element, ...questions];
                  break;

                case 'appointment':
                  output[element] = user.appointmentId.name;
                  questions = [element, ...questions];
                  break;

                case 'mobile':
                  output[element] = user.contactNumber;
                  questions = [element, ...questions];
                  break;

                case 'email':
                  output[element] = user.email;
                  questions = [element, ...questions];
                  break;

                default:
                  break;
              }
            });
          }

          const set = new Set(['staffId', 'businessUnit', ...questions]);

          questions = Array.from(set);
          return output;
        }

        return {};
      };

      for (const element of Object.values(userBasesResponses)) {
        rows.push(getQuestionAndAnswer(element));
      }
      if (rows.length) {
        const fields = questions;
        const opts = { fields };
        const csv = parse(rows, opts);

        await fs.writeFile(`./public/uploads/Postexport/${postId}.csv`, csv);
        return __.out(res, 201, {
          csvLink: `uploads/Postexport/${postId}.csv`,
        });
      }

      return __.out(res, 300, 'Something went wrong try later');
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Export the Wallpost..
  async exportWallData(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      //  let wallsdata =[];
      const jsonArray = [];
      const wallDetails = await SocialWallModel.findById(req.body._id).populate(
        {
          path: 'createdBy',
          select: '_id name staffId',
        },
      );
      const wallPosts = await socialWallPosts
        .find({ wallId: wallDetails._id })
        .select('title description likesCount createdAt author')
        .populate([
          {
            path: 'author',
            select: '_id name staffId',
          },
          {
            path: 'nomineeUsers',
            select: 'name staffId',
          },
        ])
        .lean();

      if (wallPosts.length > 0) {
        for (let i = 0; i <= wallPosts.length - 1; i += 1) {
          const date = moment(wallPosts[i].createdAt).format('D MMM, YYYY');
          const wall = {
            'Date Of creation': date,
            'Created By Staff Id': wallPosts[i].author.staffId,
            'Created By StaffName': wallPosts[i].author.name,
            'Posting Title': wallPosts[i].title,
            'Posting Content': wallPosts[i].description,
            'No of Likes': wallPosts[i].likesCount,
            'Nomination Names': '',
          };

          if (
            wallPosts[i].nomineeUsers &&
            wallPosts[i].nomineeUsers.length > 0
          ) {
            for (let j = 0; j <= wallPosts[i].nomineeUsers.length - 1; j += 1) {
              if (j === wallPosts[i].nomineeUsers.length - 1) {
                wall[
                  'Nomination Names'
                ] = `${wall['Nomination Names']}${wallPosts[i].nomineeUsers[j].name}
                   (
                  ${wallPosts[i].nomineeUsers[j].staffId} 
                  )`;
              } else {
                wall[
                  'Nomination Names'
                ] = `${wall['Nomination Names']}${wallPosts[i].nomineeUsers[j].name}
                   (
                  ${wallPosts[i].nomineeUsers[j].staffId} 
                  )`;
              }
            }
          }

          jsonArray.push(wall);
        }
      }

      if (wallDetails === null) {
        return __.out(res, 300, 'Wall not found');
      }

      let csvLink = '';
      const fieldsArray = [
        'Date Of creation',
        'Created By Staff Id',
        'Created By StaffName',
        'Posting Title',
        'Posting Content',
        'No of Likes',
        'Nomination Names',
      ];

      // fieldsArray = [...fieldsArray, ...wallsdata];
      if (jsonArray.length !== 0) {
        const fields = fieldsArray;
        const opts = { fields };
        const csv = parse(jsonArray, opts);
        let fileName = wallDetails.wallName;

        fileName = fileName.split(' ').join('_');
        await fs.writeFile(`./public/uploads/wall/${fileName}.csv`, csv);
        csvLink = `uploads/wall/${fileName}.csv`;

        return __.out(res, 201, {
          csvLink,
        });
      }

      return __.out(res, 404, {
        status: 0,
        message: 'No posts in Exported Board',
      });
    } catch (e) {
      __.log(e);
      return __.out(res, 500);
    }
  }

  async getAllNews(req, res) {
    try {
      const { companyId } = req.params;
      const company = await Company.findById(companyId).lean();

      if (!company) {
        return __.out(res, 404, 'Company not found!');
      }

      const channels = await Channel.find(
        {
          assignUsers: {
            $elemMatch: {
              admin: {
                $in: [req.user._id],
              },
            },
          },
          status: 1,
          companyId,
        },
        {
          _id: 1,
        },
      );

      const channelIds = channels.map((c) => c._id);

      const where = {
        // status: {
        //   $nin: [2],
        // },
      };

      if (!!channelIds && channelIds.length) {
        where.channelId = {
          $in: channelIds,
        };
      } else {
        return res.success({ postList: [] });
      }

      if (req.query.postType) {
        where.postType = req.query.postType;
      }

      if (req.query.channelId) {
        where.channelId = req.query.channelId;
      }

      if (req.query.categoryId) {
        where.categoryId = req.query.categoryId;
      }

      const postList = await this.getPostList(where, req.query);

      return res.success(postList);
    } catch (error) {
      return res.error(error);
    }
  }

  async getPostList(condition, { page, limit, sortBy, sortWith, search }) {
    if (search) {
      condition.$or = [
        {
          'teaser.title': {
            $regex: `${search}`,
            $options: 'i',
          },
        },
        {
          'channelId.name': {
            $regex: `${search}`,
            $options: 'i',
          },
        },
      ];
    }

    const count = await Post.countDocuments(condition);
    const data = await Post.find(condition)
      .populate({
        path: 'authorId',
        select: 'name orgName parentBussinessUnitId profilePicture',
        populate: {
          path: 'parentBussinessUnitId',
          select: 'orgName name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyName',
            },
          },
        },
      })
      .populate({
        path: 'channelId',
        select: 'name logo',
      })
      .populate({
        path: 'categoryId',
        select: 'name',
      })
      .populate({
        path: 'moduleId',
        select: 'moduleName',
      })
      .populate({
        path: 'wallId',
      })
      .sort({
        createdAt: -1,
      })
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10))
      .sort({
        [sortWith]: sortBy === 'desc' ? -1 : 1,
      })
      .lean();

    return { count, data };
  }

  async readOnePost(req, res) {
    try {
      const { postId } = req.params;
      const postData = await this.readPost({
        _id: postId,
      });

      if (!postData) return res.badRequest('News/Event Not Found');

      let adminIds;

      if (postData[0].postType === 'event') {
        adminIds = postData[0].sessions[0]
          ? postData[0].sessions[0].adminIds
          : [];
      }

      // let moduleData
      // if(postData[0].moduleId){
      //     moduleData = postData[0].moduleId
      // }

      const wallData = {};

      if (postData[0].wallId) {
        wallData.endDate = postData[0].wallId.eventWallEndDate;
        wallData.eventWallLogoImage = postData[0].wallId.bannerImage;
        wallData.startDate = postData[0].wallId.eventWallStartDate;
        wallData.wallName = postData[0].wallName;
        wallData.isEventWallRequired =
          postData[0].eventDetails.isEventWallRequired;
      }

      const data = {
        _id: postData[0]._id,
        postType: postData[0].postType,
        content: {
          address: postData[0].eventDetails.address,
          content: postData[0].content.content,
          endDate: postData[0].eventDetails.endDate,
          eventType: postData[0].eventDetails.eventType,
          image: postData[0].content.image,
          isTeaserImage: postData[0].content.isTeaserImage,
          organizerName: postData[0].eventDetails.organizerName,
          startDate: postData[0].eventDetails.startDate,
          title: postData[0].content.title,
        },
        teaser: postData[0].teaser,
        eventBoard: wallData,
        publish: {
          categoryId: postData[0].categoryId,
          channelId: postData[0].channelId,
          moduleId: postData[0].moduleId,
          endDate: postData[0].publishing.endDate,
          isRSVPRequired: postData[0].eventDetails.isRSVPRequired,
          startDate: postData[0].publishing.startDate,
        },
        session: {
          isLimitRequired: postData[0].eventDetails.isLimitRequired,
          isAttendanceRequired: postData[0].eventDetails.isAttendanceRequired,
          totalAttendanceTaking: postData[0].eventDetails.totalAttendanceTaking,
          Rows: postData[0].sessions,
          maxNoRSVP: postData[0].eventDetails.maxNoRSVP,
          isLimitRSVP: postData[0].eventDetails.isLimitRSVP,
        },
        admin: adminIds,
        status: postData[0].status,
        authorId: postData[0].authorId,
      };

      return res.success(data);
    } catch (error) {
      return res.error(error);
    }
  }

  async readPost(condition) {
    const result = await Post.find({
      ...condition,
    })
      .populate({
        path: 'authorId',
        select: 'name profilePicture parentBussinessUnitId',
        populate: {
          path: 'parentBussinessUnitId',
          select: 'orgName',
        },
      })
      .populate({
        path: 'channelId',
        select: 'name',
      })
      .populate({
        path: 'categoryId',
        select: '_id name',
      })
      .populate({
        path: 'moduleId',
        select: '_id moduleName',
      })
      .populate({
        path: 'wallId',
        populate: {
          path: 'category',
          select: 'categoryName',
        },
      })
      .populate({
        path: 'sessions',
        select:
          'startDate startTime endDate endTime attendaceRequiredCount totalParticipantPerSession location status adminIds',
        populate: {
          path: 'adminIds',
          select: 'name',
        },
      })
      .lean();

    return result;
  }
}
const post = new PostController();

module.exports = post;
