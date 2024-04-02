const mongoose = require('mongoose');
const moment = require('moment');
const User = require('../../models/user');
const WallModel = require('../../models/wall');
const WallPost = require('../../models/wallPost');
const WallLike = require('../../models/wallPostLike');
const PostView = require('../../models/wallPostView');
const Emojis = require('../../models/emoji');
const WallCategory = require('../../models/wallCategory');
const WallComment = require('../../models/wallPostComment');
const WallPostAdminResponse = require('../../models/wallPostAdminResponse');
const QuestionResponse = require('../../models/questionResponse');

const __ = require(`../../../helpers/globalFunctions`);
const QuestionModule = require('./questionModuleController');
const SubSection = require('../../models/subSection');
const PageSettingModel = require('../../models/pageSetting');
const { AssignUserRead } = require('../../../helpers/assinguserread');

class MyBoard {
  // List Filtered Walls
  async getWalls(req, res, forQuickNav) {
    try {
      // Check user is in this wall
      // let userWalls = await __.getUserWalls(req.user);
      const userWalls = await AssignUserRead.getUserInAssignedUser(
        req.user,
        WallModel,
      );
      const curretdate = new Date();
      const wallList = await WallModel.find({
        _id: {
          $in: userWalls,
        },
        status: 1,
      })
        .populate({
          path: 'category',
          select: 'categoryName',
        })
        .populate({
          path: 'user',
          strictPopulate: false,
          select: 'name userName profilePicture',
        })
        .lean();
      const wList = [];

      for (let w = 0; w <= wallList.length - 1; w += 1) {
        if (!wallList[w].eventWallEndDate) {
          let adminList = [];
          let userList = [];

          for (const elem of wallList[w].assignUsers) {
            adminList = [...adminList, ...elem.admin];
            userList = [...userList, ...elem.user];
          }
          wallList[w].adminList = adminList;
          wallList[w].userList = userList;
          delete wallList[w].assignUsers;
          // return wallList[w];
          wList.push(wallList[w]);
        } else if (wallList[w].eventWallEndDate > curretdate) {
          let adminList = [];
          let userList = [];

          for (const elem of wallList[w].assignUsers) {
            adminList = [...adminList, ...elem.admin];
            userList = [...userList, ...elem.user];
          }
          wallList[w].adminList = adminList;
          wallList[w].userList = userList;
          delete wallList[w].assignUsers;
          wList.push(wallList[w]);
        }
      }
      if (forQuickNav) return wList.filter((w) => w.quickNavEnabled);

      return __.out(res, 201, wList);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getComplimentsForMe(req, res) {
    try {
      const userWalls = await AssignUserRead.getUserInAssignedUser(
        req.user,
        WallModel,
      );
      const pageSetting = await PageSettingModel.findOne({
        companyId: req.user.companyId,
      })
        .select('compliments')
        .lean();

      req.body.wallIds = userWalls.filter(
        (wall) =>
          !!pageSetting.compliments.find(
            (b) => b.toString() === wall.toString(),
          ),
      );
      req.body.compliments_forMe = true;
      if (!userWalls.length || !req.body.wallIds.length) {
        return __.out(res, 201, {
          data: [],
          total: 0,
        });
      }

      return __.out(res, 201, await this.getPosts(req, res));
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getComplimentsSentByMe(req, res) {
    try {
      const userWalls = await AssignUserRead.getUserInAssignedUser(
        req.user,
        WallModel,
      );
      const pageSetting = await PageSettingModel.findOne({
        companyId: req.user.companyId,
      })
        .select('compliments')
        .lean();

      req.body.wallIds = userWalls.filter(
        (wall) =>
          !!pageSetting.compliments.find(
            (b) => b.toString() === wall.toString(),
          ),
      );
      req.body.compliments_sentByMe = true;
      if (!userWalls.length || !req.body.wallIds.length) {
        return __.out(res, 201, {
          data: [],
          total: 0,
        });
      }

      return __.out(res, 201, await this.getPosts(req, res));
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getSuggestions(req, res) {
    try {
      const userWalls = await AssignUserRead.getUserInAssignedUser(
        req.user,
        WallModel,
      );
      const pageSetting = await PageSettingModel.findOne({
        companyId: req.user.companyId,
      })
        .select('suggestions')
        .lean();

      req.body.wallIds = userWalls.filter(
        (wall) =>
          !!pageSetting.suggestions.find(
            (b) => b.toString() === wall.toString(),
          ),
      );
      req.body.suggestions = true;
      if (!userWalls.length || !req.body.wallIds.length) {
        return __.out(res, 201, {
          data: [],
          total: 0,
        });
      }

      return __.out(res, 201, await this.getPosts(req, res));
    } catch (err) {
      __.log(err);
      return __.out(req, 500);
    }
  }

  // Walls Summary
  async wallSummary(req, res) {
    try {
      // Check user is in this wall
      const userWalls = await AssignUserRead.getUserInAssignedUser(
        req.user,
        WallModel,
      );
      /** *  WALL SUMMARY */
      // Get all wall list
      let wallList = await WallModel.find({
        _id: {
          $in: userWalls,
        },
        status: 1,
      })
        .populate({
          path: 'category',
          select: 'categoryName',
        })
        .populate({
          path: 'user',
          strictPopulate: false,
          select: 'name userName profilePicture',
        })
        .select(
          'wallName bannerImage displayType postType category assignUsers nominationOnlyByAdmin adminResponse postAnonymously maxNomination nominationPerUser',
        )
        .lean();

      wallList = wallList.map((v) => {
        let adminList = [];
        let userList = [];

        for (const elem of v.assignUsers) {
          adminList = [...adminList, ...elem.admin];
          userList = [...userList, ...elem.user];
        }
        v.adminList = adminList;
        v.userList = userList;
        delete v.assignUsers;
        return v;
      });

      // Custom quick function
      const getPostList = async function (filterQuery, sort, limit) {
        return WallPost.find(filterQuery)
          .populate({
            path: 'category',
            select: 'categoryName',
          })
          .populate({
            path: 'user',
            strictPopulate: false,
            select: 'name userName profilePicture',
          })
          .populate({
            path: 'author',
            select: 'name userName profilePicture',
          })
          .populate({
            path: 'wallId',
            select: 'wallName bannerImage displayType postType admin',
            populate: {
              path: 'admin',
              strictPopulate: false,
              select: 'name profilePicture',
            },
          })
          .sort(sort)
          .limit(limit)
          .lean();
      };

      // GET each wall's limited/featured posts
      let int = 0;

      const promises = wallList.map(async (elem) => {
        const { displayType } = elem;

        if (displayType === 1) {
          const limit = 10;
          const condition = { wallId: elem._id, status: 1 };
          const priorityDateCondition = {
            ...condition,
            priorityDate: { $exists: true, $gte: new Date() },
          };

          const wallPostList = await Promise.all([
            getPostList(priorityDateCondition, { priorityDate: -1 }, limit),
            getPostList({ ...condition }, { lastUpdated: -1 }, limit),
          ]);

          const [priorityDatePosts, remainPosts] = wallPostList;
          const finalPosts = [
            ...priorityDatePosts,
            ...remainPosts.slice(0, limit),
          ];

          elem.postList = finalPosts;
        } else if (displayType === 2) {
          let j = 0;

          await Promise.all(
            elem.category.map(async (cat) => {
              wallList[int].category[j].postList = await getPostList(
                {
                  wallId: elem._id,
                  category: cat._id,
                  status: 1,
                },
                {
                  lastUpdated: -1,
                },
                10,
              );
              j += 1;
            }),
          );
        }

        int += 1;
      });
      const lastMonthDate = moment().subtract(30, 'd').utc().format();

      const [recentPolls, topPostList1] = await Promise.all([
        this.recentPolls(req, res),
        WallPost.aggregate([
          {
            $match: {
              wallId: {
                $in: userWalls,
              },
              status: 1,
            },
          },
          {
            $lookup: {
              from: 'postlikes',
              localField: '_id',
              foreignField: 'postId',
              as: 'likes',
            },
          },
          {
            $project: {
              title: 1,
              description: 1,
              updatedAt: 1,
              createdAt: 1,
              wallId: 1,
              category: 1,
              author: 1,
              priorityDate: 1,
              status: 1,
              assignedToList: 1,
              taskList: 1,
              reportCount: 1,
              sharedCount: 1,
              likesCount: 1,
              commentCount: 1,
              attachments: 1,
              likes: {
                $filter: {
                  input: '$likes',
                  as: 'item',
                  cond: {
                    $gte: ['$$item.createdAt', lastMonthDate],
                  },
                },
              },
            },
          },
          {
            $sort: {
              likesCount: -1,
              priorityDate: -1,
            },
          },
          {
            $limit: 20,
          },
          {
            $lookup: {
              from: 'wallcategories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
            },
          },
          {
            $unwind: '$category',
          },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
            },
          },
          {
            $unwind: '$author',
          },
          {
            $lookup: {
              from: 'walls',
              localField: 'wallId',
              foreignField: '_id',
              as: 'wallId',
            },
          },
          {
            $unwind: '$wallId',
          },
          {
            $project: {
              title: 1,
              description: 1,
              updatedAt: 1,
              createdAt: 1,
              wallId: {
                _id: '$wallId._id',
                wallName: '$wallId.wallName',
                bannerImage: '$wallId.bannerImage',
                postType: '$wallId.postType',
                displayType: '$wallId.displayType',
                assignUsers: '$wallId.assignUsers',
              },
              category: {
                _id: '$category._id',
                categoryName: '$category.categoryName',
              },
              author: {
                _id: '$author._id',
                name: '$author.name',
                profilePicture: '$author.profilePicture',
              },
              priorityDate: 1,
              status: 1,
              assignedToList: 1,
              taskList: 1,
              reportCount: 1,
              sharedCount: 1,
              commentCount: 1,
              attachments: 1,
              likesCount: {
                $size: '$likes',
              },
            },
          },
          {
            $limit: 20,
          },
        ]),
        Promise.all(promises),
      ]);
      // Get Admin & User List of each top posts
      const topPostList = topPostList1.map((v) => {
        let adminList = [];
        let userList = [];

        for (const elem of v.wallId.assignUsers) {
          adminList = [...adminList, ...elem.admin];
          userList = [...userList, ...elem.user];
        }
        v.adminList = adminList;
        v.userList = userList;
        delete v.wallId.assignUsers;
        return v;
      });
      // Top posts, wall wise posts
      const returnData = {
        recentPolls,
        topPosts: topPostList,
        wallSummary: wallList,
      };

      return __.out(res, 201, returnData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async getPosts(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let searchQuery = {};
      let mainSearch = {
        status: 1,
      };
      const categorySearch = {};
      let authorSearch = {};

      // Specified Wall or all assigned walls
      if (req.body.wallId) {
        mainSearch.wallId = mongoose.Types.ObjectId(req.body.wallId);
      } else {
        let userWalls = await AssignUserRead.getUserInAssignedUser(
          req.user,
          WallModel,
        );

        userWalls = userWalls.map((v) => mongoose.Types.ObjectId(v));
        mainSearch.wallId = {
          $in: userWalls,
        };
      }

      if (req.body.categoryId) {
        const categoryIds = req.body.categoryId.map((id) =>
          mongoose.Types.ObjectId(id),
        );

        mainSearch.category = {
          $in: categoryIds,
        };
      } else {
        categorySearch.status = 1;
      }

      if (req.body.searchTitle) {
        // title/description/author name
        searchQuery.$or = [
          {
            title: {
              $regex: `${req.body.searchTitle}`,
              $options: 'i',
            },
          },
          {
            description: {
              $regex: `${req.body.searchTitle}`,
              $options: 'i',
            },
          },
        ];
      }

      if (req.body.fromDate) {
        mainSearch.createdAt = {};
        mainSearch.createdAt.$gte = new Date(
          moment(req.body.fromDate).startOf('day').utc().format(),
        );
      }

      if (req.body.toDate) {
        mainSearch.createdAt.$lte = new Date(
          moment(req.body.toDate).endOf('day').utc().format(),
        );
      }

      // Question Only Posts
      if (req.body.moduleIncluded === true) {
        mainSearch.moduleIncluded = true;
      }

      // Tasks API
      if (req.body.taskOnly === true) {
        mainSearch.taskList = {
          $gt: [],
        };
      }

      if (req.body.myTasks === true) {
        mainSearch.assignedToList = {
          $in: [req.user._id],
        };
      }

      if (req.body.createdByUser === true) {
        authorSearch._id = mongoose.Types.ObjectId(req.user._id);
      }

      if (req.body.isTaskCompleted) {
        mainSearch.isTaskCompleted = req.body.isTaskCompleted;
      }

      if (!!req.body.wallIds && !!req.body.wallIds.length) {
        req.body.wallIds = req.body.wallIds.map((id) =>
          mongoose.Types.ObjectId(id),
        );
        if (req.body.compliments_forMe) {
          mainSearch = {
            wallId: { $in: req.body.wallIds },
            nomineeUsers: mongoose.Types.ObjectId(req.user._id),
            status: 1,
          };
        } else if (req.body.compliments_sentByMe) {
          mainSearch = {
            wallId: { $in: req.body.wallIds },
            'nomineeUsers.0': { $exists: true },
            status: 1,
          };
          authorSearch = { _id: mongoose.Types.ObjectId(req.user._id) };
        } else if (req.body.suggestions) {
          mainSearch = {
            wallId: { $in: req.body.wallIds },
            status: 1,
          };
          authorSearch = { _id: mongoose.Types.ObjectId(req.user._id) };
        } else {
          mainSearch = {};
          searchQuery = {};
        }
      }

      // Dynamic Search Queries
      const where = {
        companyId: req.user.companyId,
        status: 1,
      };

      const [emojiList, taskAssigningUsers, userBUs] = await Promise.all([
        Emojis.find(where).select('emoji _id status').lean(),
        this.taskAssigningUsers(req, res),
        this.getWallBunsinessUnit(req.body.wallId),
      ]);

      let postList = await WallPost.aggregate([
        { $match: mainSearch },
        {
          $sort: {
            lastUpdated: -1,
          },
        },
        {
          $lookup: {
            from: 'walls',
            localField: 'wallId',
            foreignField: '_id',
            as: 'wallId',
          },
        },
        {
          $unwind: '$wallId',
        },
        {
          $lookup: {
            from: 'wallcategories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
            pipeline: [
              {
                $match: categorySearch,
              },
            ],
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
            pipeline: [
              {
                $match: authorSearch,
              },
            ],
          },
        },
        {
          $unwind: '$author',
        },
        { $match: searchQuery },
        {
          $project: {
            title: 1,
            description: 1,
            attachments: 1,
            reportCount: 1,
            sharedCount: 1,
            likesCount: 1,
            commentCount: 1,
            createdAt: 1,
            updatedAt: 1,
            moduleIncluded: 1,
            moduleId: 1,
            lastUpdated: 1,
            priorityDate: 1,
            taskList: 1,
            assignedToList: 1,
            taskDueDate: 1,
            isTaskCompleted: 1,
            anonymousPost: 1,
            wallId: {
              _id: '$wallId._id',
              wallName: '$wallId.wallName',
              bannerImage: '$wallId.bannerImage',
            },
            category: {
              categoryName: '$category.categoryName',
            },
            author: {
              name: {
                $cond: {
                  if: { $eq: [true, '$anonymousPost'] },
                  then: 'Anonymous',
                  else: '$author.name',
                },
              },
              staffId: {
                $cond: {
                  if: { $eq: [true, '$anonymousPost'] },
                  then: '',
                  else: '$author.name',
                },
              },
              profilePicture: {
                $cond: {
                  if: { $eq: [true, '$anonymousPost'] },
                  then: '',
                  else: '$author.profilePicture',
                },
              },
            },
          },
        },
      ]);

      for (let i = 0; i < postList.length; i += 1) {
        postList[i].category = Array.isArray(postList[i].category)
          ? postList[i].category
          : [postList[i].category];
        if (postList[i].priorityDate > postList[i].lastUpdated) {
          postList[i].filterDates = postList[i].priorityDate;
        } else {
          postList[i].filterDates = postList[i].lastUpdated;
        }
      }
      postList.sort(
        (a, b) => new Date(b.filterDates) - new Date(a.filterDates),
      );
      // Find User is liked this post
      const postIds = postList.map((v) => v._id);
      // Get liked posts Id
      let likedIds = await WallLike.find({
        postId: {
          $in: postIds,
        },
        userId: req.user._id,
        isLiked: true,
        status: 1,
      }).lean();

      likedIds = likedIds.map((v) => v.postId);

      // Add User liked Key
      postList = postList.map((v) => {
        // User Liked Status
        const checkIndex = likedIds
          .findIndex((x) => x.toString() === v._id)
          .toString();

        if (checkIndex !== -1) {
          v.userLiked = true;
        } else {
          v.userLiked = false;
        }

        // Add key doesn't exists
        v.moduleIncluded = v.moduleIncluded || false;
        v.taskList = v.taskList || [];
        v.lastUpdated = v.lastUpdated || v.createdAt;
        return v;
      });

      let categorySummary;

      // category dashboard if required
      if (req.body.compliments_forMe) {
        const matchQuery = [
          {
            $lookup: {
              from: 'walls',
              localField: 'wallId',
              foreignField: '_id',
              as: 'wallId',
            },
          },
          {
            $unwind: '$wallId',
          },
          {
            $lookup: {
              from: 'wallcategories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
            },
          },
          {
            $unwind: '$category',
          },
          {
            $match: searchQuery,
          },
          {
            $group: {
              _id: '$category._id',
              title: {
                $first: '$category.categoryName',
              },
              count: {
                $sum: 1,
              },
            },
          },
        ];

        categorySummary = await WallPost.aggregate(matchQuery).allowDiskUse(
          true,
        );
      }

      const output = {
        categorySummary,
        data: postList || [],
        total: postList.length,
        emojiList,
        taskAssigningUsers: taskAssigningUsers.map((v) => ({
          _id: v._id,
          name: v.name,
        })),
        userBUs,
      };

      if (
        !!req.body.compliments_forMe ||
        !!req.body.compliments_sentByMe ||
        !!req.body.suggestions
      ) {
        return output;
      }

      return __.out(res, 201, output);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async getPostsOld(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const pageNum = req.body.pageNum ? parseInt(req.body.pageNum, 10) : 1;
      const limit = req.body.limit ? parseInt(req.body.limit, 10) : 10;
      const skip = req.body.skip
        ? parseInt(req.body.skip, 10)
        : (pageNum - 1) * limit;

      let searchQuery = {
        status: 1,
      };

      // Specified Wall or all assigned walls
      if (req.body.wallId) {
        searchQuery['wallId._id'] = mongoose.Types.ObjectId(req.body.wallId);
      } else {
        let userWalls = await AssignUserRead.getUserInAssignedUser(
          req.user,
          WallModel,
        );

        userWalls = userWalls.map((v) => mongoose.Types.ObjectId(v));
        searchQuery['wallId._id'] = {
          $in: userWalls,
        };
      }

      if (req.body.categoryId) {
        // convert array of id strings into object id
        req.body.categoryId = req.body.categoryId.map((v) =>
          mongoose.Types.ObjectId(v),
        );
        searchQuery['category._id'] = {
          $in: req.body.categoryId,
        };
      } else {
        searchQuery['category.status'] = {
          $nin: [2, 3],
        };
      }

      if (req.body.searchTitle) {
        // title/description/author name
        searchQuery.$or = [
          {
            title: {
              $regex: `${req.body.searchTitle}`,
              $options: 'i',
            },
          },
          {
            description: {
              $regex: `${req.body.searchTitle}`,
              $options: 'i',
            },
          },
          {
            'author.name': {
              $regex: `${req.body.searchTitle}`,
              $options: 'i',
            },
          },
        ];
      }

      if (req.body.fromDate) {
        searchQuery.createdAt = {};
        searchQuery.createdAt.$gte = new Date(
          moment(req.body.fromDate).startOf('day').utc().format(),
        );
      }

      if (req.body.toDate) {
        searchQuery.createdAt.$lte = new Date(
          moment(req.body.toDate).endOf('day').utc().format(),
        );
      }

      // Question Only Posts
      if (req.body.moduleIncluded === true) {
        searchQuery.moduleIncluded = true;
      }

      // Tasks API
      if (req.body.taskOnly === true) {
        searchQuery.taskList = {
          $gt: [],
        };
      }

      if (req.body.myTasks === true) {
        searchQuery.assignedToList = {
          $in: [req.user._id],
        };
      }

      if (req.body.createdByUser === true) {
        searchQuery['author._id'] = mongoose.Types.ObjectId(req.user._id);
      }

      if (req.body.isTaskCompleted) {
        searchQuery.isTaskCompleted = req.body.isTaskCompleted;
      }

      if (!!req.body.wallIds && !!req.body.wallIds.length) {
        req.body.wallIds = req.body.wallIds.map((id) =>
          mongoose.Types.ObjectId(id),
        );

        if (req.body.compliments_forMe) {
          searchQuery = {
            'wallId._id': { $in: req.body.wallIds },
            nomineeUsers: mongoose.Types.ObjectId(req.user._id),
            status: 1,
          };
        } else if (req.body.compliments_sentByMe) {
          searchQuery = {
            'wallId._id': { $in: req.body.wallIds },
            'author._id': mongoose.Types.ObjectId(req.user._id),
            'nomineeUsers.0': { $exists: true },
            status: 1,
          };
        } else if (req.body.suggestions) {
          searchQuery = {
            'wallId._id': { $in: req.body.wallIds },
            'author._id': mongoose.Types.ObjectId(req.user._id),
            status: 1,
          };
        }
      }

      // Dynamic Search Queries
      let postList = await WallPost.aggregate([
        {
          $lookup: {
            from: 'walls',
            localField: 'wallId',
            foreignField: '_id',
            as: 'wallId',
          },
        },
        {
          $unwind: '$wallId',
        },
        {
          $lookup: {
            from: 'wallcategories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: '$author',
        },
        {
          $match: searchQuery,
        },
        {
          $sort: {
            lastUpdated: -1,
          },
        },
        {
          $skip: skip,
        },
        {
          $project: {
            title: 1,
            description: 1,
            attachments: 1,
            reportCount: 1,
            sharedCount: 1,
            likesCount: 1,
            commentCount: 1,
            createdAt: 1,
            updatedAt: 1,
            moduleIncluded: 1,
            moduleId: 1,
            lastUpdated: 1,
            priorityDate: 1,
            taskList: 1,
            assignedToList: 1,
            taskDueDate: 1,
            isTaskCompleted: 1,
            anonymousPost: 1,
            wallId: {
              _id: '$wallId._id',
              wallName: '$wallId.wallName',
              bannerImage: '$wallId.bannerImage',
            },
            category: {
              categoryName: '$category.categoryName',
            },
            author: {
              name: {
                $cond: {
                  if: { $eq: [true, '$anonymousPost'] },
                  then: 'Anonymous',
                  else: '$author.name',
                },
              },
              staffId: {
                $cond: {
                  if: { $eq: [true, '$anonymousPost'] },
                  then: '',
                  else: '$author.name',
                },
              },
              profilePicture: {
                $cond: {
                  if: { $eq: [true, '$anonymousPost'] },
                  then: '',
                  else: '$author.profilePicture',
                },
              },
            },
          },
        },
      ]);

      for (let i = 0; i < postList.length; i += 1) {
        postList[i].category = Array.isArray(postList[i].category)
          ? postList[i].category
          : [postList[i].category];
        if (postList[i].priorityDate > postList[i].lastUpdated) {
          postList[i].filterDates = postList[i].priorityDate;
        } else {
          postList[i].filterDates = postList[i].lastUpdated;
        }
      }
      postList.sort(
        (a, b) => new Date(b.filterDates) - new Date(a.filterDates),
      );
      const totalPost = await WallPost.aggregate([
        {
          $lookup: {
            from: 'wallcategories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: '$author',
        },
        {
          $lookup: {
            from: 'walls',
            localField: 'wallId',
            foreignField: '_id',
            as: 'wallId',
          },
        },
        {
          $unwind: '$wallId',
        },
        {
          $match: searchQuery,
        },
        {
          $sort: {
            lastUpdated: -1,
          },
        },
      ]);

      // Find User is liked this post
      const postIds = postList.map((v) => v._id);
      // Get liked posts Id
      let likedIds = await WallLike.find({
        postId: {
          $in: postIds,
        },
        userId: req.user._id,
        isLiked: true,
        status: 1,
      }).lean();

      likedIds = likedIds.map((value) => value.postId);

      // Add User liked Key
      postList = postList.map((value) => {
        // User Liked Status
        const checkIndex = likedIds
          .findIndex((item) => item.toString() === value._id)
          .toString();

        if (checkIndex !== -1) {
          value.userLiked = true;
        } else {
          value.userLiked = false;
        }

        // Add key doesn't exists
        value.moduleIncluded = value.moduleIncluded || false;
        value.taskList = value.taskList || [];
        value.lastUpdated = value.lastUpdated || value.createdAt;
        return value;
      });

      // Get This Companies Emojis
      const where = {
        companyId: req.user.companyId,
        status: 1,
      };
      const emojiList = await Emojis.find(where)
        .select('emoji _id status')
        .lean();
      const taskAssigningUsers = await this.taskAssigningUsers(req, res);
      let categorySummary;

      // category dashboard if required
      if (req.body.compliments_forMe) {
        const matchQuery = [
          {
            $lookup: {
              from: 'walls',
              localField: 'wallId',
              foreignField: '_id',
              as: 'wallId',
            },
          },
          {
            $unwind: '$wallId',
          },
          {
            $lookup: {
              from: 'wallcategories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
            },
          },
          {
            $unwind: '$category',
          },
          {
            $match: searchQuery,
          },
          {
            $group: {
              _id: '$category._id',
              title: {
                $first: '$category.categoryName',
              },
              count: {
                $sum: 1,
              },
            },
          },
        ];

        categorySummary = await WallPost.aggregate(matchQuery).allowDiskUse(
          true,
        );
      }

      const output = {
        categorySummary,
        data: postList || [],
        total: totalPost.length,
        emojiList,
        taskAssigningUsers: taskAssigningUsers.map((v) => ({
          _id: v._id,
          name: v.name,
        })),
        userBUs: await this.getWallBunsinessUnit(req.body.wallId),
      };

      if (
        !!req.body.compliments_forMe ||
        !!req.body.compliments_sentByMe ||
        !!req.body.suggestions
      ) {
        return output;
      }

      return __.out(res, 201, output);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getWallBunsinessUnit(wallId) {
    try {
      const wall = await WallModel.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(wallId),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdBy',
            pipeline: [
              {
                $project: {
                  planBussinessUnitId: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: '$createdBy',
        },
        {
          $unwind: '$assignUsers',
        },
        {
          $addFields: {
            'assignUsers.businessUnits': {
              $cond: [
                {
                  $eq: ['$assignUsers.allBuToken', true],
                },
                '$createdBy.planBussinessUnitId',
                '$assignUsers.businessUnits',
              ],
            },
          },
        },
        {
          $project: {
            businessUnits: '$assignUsers.businessUnits',
          },
        },
        {
          $group: {
            _id: '$_id',
            businessUnits: {
              $push: '$businessUnits',
            },
          },
        },
        {
          $addFields: {
            businessUnits: {
              $reduce: {
                input: '$businessUnits',
                initialValue: [],
                in: {
                  $concatArrays: ['$$value', '$$this'],
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: 'subsections',
            localField: 'businessUnits',
            foreignField: '_id',
            as: 'businessUnits',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: '$orgName',
                },
              },
            ],
          },
        },
      ]);

      if (wall.length > 0) {
        return wall[0].businessUnits;
      }

      return [];
    } catch (error) {
      __.log(error);
      return [];
      // return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Get all Posts - wall base
  async viewPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const searchQuery = {
        _id: req.params.postId,
        status: 1,
      };
      const postData = await WallPost.findOne(searchQuery)
        .populate({
          path: 'category',
          select: 'categoryName',
        })
        .populate({
          path: 'user',
          strictPopulate: false,
          select: 'name userName profilePicture',
        })
        .populate({
          path: 'author',
          select: 'name userName profilePicture',
        })
        .populate({
          path: 'wallId',
          select:
            'wallName bannerImage displayType postType assignUsers isNomineeActive isTaskActive adminResponse',
        })
        .populate({
          path: 'assignedEmojis',
        })
        .populate({
          path: 'moduleId',
          select: 'moduleName',
        })
        .populate({
          path: 'assignedToList',
          select: 'name staffId profilePicture',
        })
        .populate({
          path: 'nomineeUsers',
          select: 'name staffId profilePicture appointmentId',
          populate: {
            path: 'appointmentId',
            select: 'name',
          },
        })
        .lean();

      if (!postData) {
        return __.out(res, 300, `Post not found`);
      }

      // Get Admin List of this post's wall
      let adminList = [];

      for (const elem of postData.wallId.assignUsers) {
        adminList = [...adminList, ...elem.admin];
      }
      postData.wallId.adminList = adminList;
      // Check user liked this post or not
      postData.userLiked = false;
      const likeData = await WallLike.findOne({
        userId: req.user._id,
        postId: postData._id,
        status: 1,
      }).lean();

      if (likeData) postData.userLiked = likeData.isLiked || false;

      // Get This Companies Emojis
      const where = {
        companyId: req.user.companyId,
        status: 1,
      };

      postData.emojiList = await Emojis.find(where)
        .select('emoji _id name status')
        .lean();
      req.body = req.body || {};
      req.body.wallId = postData.wallId;
      postData.category = Array.isArray(postData.category)
        ? postData.category
        : [postData.category];
      postData.taskAssigningUsers = await this.taskAssigningUsers(req, res);
      postData.taskAssigningUsers = postData.taskAssigningUsers.map((v) => ({
        name: v.name,
        _id: v._id,
      }));
      // remove profile picture and change name if anonymous post
      if (postData.anonymousPost) {
        delete postData.author.profilePicture;
        postData.author.name = 'Anonymous';
      }

      postData.userBUs = await this.getUserBUs(res, req.user);
      /** update viewHistory in postview and update count post object */
      if (postData) {
        const resultUp = await PostView.findOneAndUpdate(
          {
            wallId: postData.wallId._id,
            wallPostId: postData._id,
            userId: req.user._id,
            postType: 'wall',
          },
          {
            $push: { viewHistory: moment().utc().format() },
          },
          {
            new: true,
            lean: true,
            upsert: true,
          },
        );

        if (!resultUp) {
          return __.out(res, 300, 'Not updated');
        }

        const viewCount = await PostView.find({
          wallPostId: postData._id,
        }).count();
        const viewCountUpdate = await WallPost.findByIdAndUpdate(postData._id, {
          viewCount,
        });

        if (!viewCountUpdate) {
          return __.out(res, 300, 'Not updated');
        }
      }

      /** update code end */
      return __.out(res, 201, postData);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // check and uncheck tasks
  async completeTask(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'taskId',
        'postId',
      ]);

      if (requiredResult.status === false)
        return __.out(res, 400, requiredResult.missingFields);

      const postData = await WallPost.findOne({
        _id: req.body.postId,
        status: 1,
      }).lean();

      if (!postData) {
        return __.out(res, 300, 'No post found');
      }

      const taskIndex = postData.taskList.findIndex(
        (x) => x._id.toString() === req.body.taskId,
      );

      if (taskIndex === -1) return __.out(res, 300, 'No Task found');

      const updateData = {
        taskList: postData.taskList,
      };

      // Update Task as Completed
      updateData.taskList[taskIndex].status = req.body.status === 0 ? 0 : 1;
      updateData.taskList[taskIndex].completedBy =
        req.body.status === 0 ? undefined : req.user._id;
      updateData.taskList[taskIndex].completedAt =
        req.body.status === 0 ? undefined : moment().utc().format();
      updateData.isTaskCompleted = true;

      // If any task is pending
      for (const x of updateData.taskList) {
        if (x.status === 0) {
          updateData.isTaskCompleted = false;
        }
      }

      const where = {
        _id: req.body.postId,
      };
      const update = updateData;
      const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      };

      const isStatusChanged = await WallPost.findOneAndUpdate(
        where,
        update,
        options,
      ).lean();

      if (!isStatusChanged)
        return __.out(res, 300, 'Error while completing task');

      return __.out(res, 201, 'Task Updated');
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async viewComments(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const searchQuery = {
        postId: req.params.postId,
        status: 1,
      };
      const postComments = await WallComment.find(searchQuery)
        .populate({
          path: 'userId',
          select: 'name userName profilePicture',
        })
        .sort({
          createdAt: -1,
        })
        .lean();

      return __.out(res, 201, {
        data: postComments,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async viewAdminResponse(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { postId } = req.params;
      const searchQuery = {
        postId,
        status: 1,
      };

      // check current user to get only non private responses
      const postData = await WallPost.findOne({
        _id: postId,
        status: 1,
      })
        .populate({
          path: 'wallId',
          select: 'assignUsers',
        })
        .lean();
      const adminUsers = [
        ...new Set(
          postData.wallId.assignUsers.reduce(
            (final, au) => [...final, ...au.admin.map((ad) => ad.toString())],
            [postData.author.toString()],
          ),
        ),
      ];

      if (!adminUsers.includes(req.user._id.toString())) {
        searchQuery.privateResponse = false;
      }

      let adminResponses = await WallPostAdminResponse.find(searchQuery)
        .populate({
          path: 'userId',
          select: 'name userName profilePicture',
        })
        .populate({
          path: 'postId',
          select: 'anonymousPost author',
        })
        .sort({
          createdAt: -1,
        })
        .lean();

      if (postData.anonymousPost) {
        adminResponses = adminResponses.reduce((final, response) => {
          if (
            response.postId.author.toString() === response.userId._id.toString()
          ) {
            delete response.userId.profilePicture;
            response.userId.name = 'Anonymous';
          }

          final.push(response);
          return final;
        }, []);
      }

      return __.out(res, 201, {
        data: adminResponses || [],
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // User's Task Summary
  async taskSummary(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // Get users assigned users
      const userWallIds = await AssignUserRead.getUserInAssignedUser(
        req.user,
        WallModel,
      );
      // Get Active Categories - to avoid the deleted category posts
      let categoryIds = await WallCategory.find({
        wallId: {
          $in: userWallIds,
        },
        status: 1,
      });

      categoryIds = categoryIds.map((v) => mongoose.Types.ObjectId(v._id));
      let userWalls = await WallModel.find({
        _id: {
          $in: userWallIds,
        },
      })
        .populate({
          path: 'category',
          select: 'categoryName',
        })
        .populate({
          path: 'user',
          strictPopulate: false,
          select: 'name userName profilePicture',
        })
        .lean();

      userWalls = userWalls.map((v) => {
        let adminList = [];
        let userList = [];

        for (const elem of v.assignUsers) {
          adminList = [...adminList, ...elem.admin];
          userList = [...userList, ...elem.user];
        }
        v.adminList = adminList;
        v.userList = userList;
        delete v.assignUsers;
        return v;
      });

      // Total Created Tasks
      const createdTasks = await WallPost.count({
        category: {
          $in: categoryIds,
        },
        taskList: {
          $gt: [],
        },
        isTaskCompleted: false,
        author: req.user._id,
        status: 1,
      });

      // Wall vise pending tasks
      const tasksPromises = userWalls.map(async (elem) => {
        const pendingTasks = await WallPost.countDocuments({
          wallId: elem._id,
          category: {
            $in: categoryIds,
          },
          taskList: {
            $gt: [],
          },
          isTaskCompleted: false,
          assignedToList: {
            $in: [req.user._id],
          },
          status: 1,
        });

        elem.pendingTasks = pendingTasks;

        if (elem.pendingTasks > 0) {
          return elem;
        }

        return null;
      });

      const updatedWalls = await Promise.all(tasksPromises);
      const wallList = updatedWalls.filter((elem) => elem !== null);

      // Total Pending Tasks
      let myAssignedTasks = 0;

      for (const elem of wallList) {
        myAssignedTasks += elem.pendingTasks;
      }
      // Due in this current time - 3 Hours
      const dueTasks = await WallPost.count({
        category: {
          $in: categoryIds,
        },
        $and: [
          {
            taskDueDate: {
              $gte: moment(req.body.reqDate).startOf('day').utc().format(),
            },
          },
          {
            taskDueDate: {
              $lte: moment(req.body.reqDate).endOf('day').utc().format(),
            },
          },
        ],
        taskList: {
          $gt: [],
        },
        assignedToList: {
          $in: [req.user._id],
        },
        isTaskCompleted: false,
        status: 1,
      });

      const data = {
        profile: {
          name: req.user.name,
          profilePicture: req.user.profilePicture,
        },
        createdTasks,
        wallList,
        myAssignedTasks,
        dueTasks,
      };

      return __.out(res, 201, data);
    } catch (error) {
      __.log(error);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async taskAssigningUsers(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const wallData = await WallModel.findOne({
        _id: req.body.wallId,
      });

      // In case missing wall
      if (!wallData) {
        return [];
      }

      const users = await AssignUserRead.read(
        wallData.assignUsers,
        { _id: 1, name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
        wallData.createdBy,
      );

      if (users.status) {
        return users.users;
      }

      return [];
    } catch (err) {
      __.log(err);
      return [];
    }
  }

  // Recent Polls - Posts with question modules ( question type only 4 )
  async recentPolls(req, res) {
    try {
      // Active Walls
      const userWalls = await AssignUserRead.getUserInAssignedUser(
        req.user,
        WallModel,
      );
      // Get Active Categories - to avoid the deleted category posts
      let categoryIds = await WallCategory.find({
        wallId: {
          $in: userWalls,
        },
        status: 1,
      }).select('_id');

      categoryIds = categoryIds.map((v) => mongoose.Types.ObjectId(v._id));

      // Filter modules's question only as polling & get the first polling to show
      const postList = await WallPost.aggregate([
        {
          $match: {
            category: {
              $in: categoryIds,
            },
            moduleIncluded: true,
            moduleId: {
              $exists: true,
            },
            wallId: {
              $exists: true,
            },
            status: 1,
          },
        },
        {
          $lookup: {
            from: 'walls',
            localField: 'wallId',
            foreignField: '_id',
            as: 'wallId',
          },
        },
        {
          $unwind: '$wallId',
        },
        {
          $lookup: {
            from: 'wallcategories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $lookup: {
            from: 'buildermodules',
            localField: 'moduleId',
            foreignField: '_id',
            as: 'module',
          },
        },
        {
          $unwind: '$module',
        },
        {
          $unwind: '$module.questions',
        },
        {
          $lookup: {
            from: 'questions',
            localField: 'module.questions',
            foreignField: '_id',
            as: 'question',
          },
        },
        {
          $unwind: '$question',
        },
        {
          $match: {
            'question.type': 4, // polling type 4,
            $or: [
              {
                'module.randomOrder': true,
                'question.required': true,
              },
              {
                'module.randomOrder': false,
              },
            ],
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $limit: 10,
        },
      ]);

      // Add Polling Result in it
      const updatedPostList = await Promise.all(
        postList.map(async (post) => {
          const updatedPost = { ...post };

          updatedPost.wallId = {
            _id: post.wallId._id,
            wallName: post.wallId.wallName,
          };

          // Category
          if (Array.isArray(post.category)) {
            updatedPost.category = {
              _id: post.category.map((cat) => cat._id).join(', '),
              categoryName: post.category
                .map((cat) => cat.categoryName)
                .join(', '),
            };
          } else {
            updatedPost.category = {
              _id: post.category._id,
              categoryName: post.category.categoryName,
            };
          }

          // Polling
          req.body = req.body || {};
          req.body.questionId = post.question._id;
          req.body.moduleId = post.module._id;
          req.body.wallPostId = post._id;
          req.body.internalApi = true;
          updatedPost.isAnswered = false;

          // Check if the user already answered then show results
          const userAnswered = await QuestionResponse.findOne({
            questionId: post.question._id,
            wallPostId: post._id,
            userId: req.user._id,
            status: 1,
          }).lean();

          if (userAnswered) {
            updatedPost.resultData = await QuestionModule.getPollingResult(
              req,
              res,
            );
            updatedPost.isAnswered = true;
          }

          return updatedPost;
        }),
      );

      // Now updatedPostList contains the modified postList with asynchronous tasks handled

      return updatedPostList;
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Get users bu list for parent & plan
  async getUserBUs(res, userData) {
    try {
      let businessUnits = await SubSection.find({
        $or: [
          {
            _id: userData.parentBussinessUnitId,
          },
          {
            _id: {
              $in: userData.planBussinessUnitId,
            },
          },
        ],
        status: 1,
      })
        .populate({
          path: 'sectionId',
          select: 'name status',
          match: {
            status: 1,
          },
          populate: {
            path: 'departmentId',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'companyId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
          },
        })
        .select('name sectionId')
        .lean();

      businessUnits = await businessUnits
        .filter(
          (v) =>
            v.sectionId != null &&
            v.sectionId.departmentId != null &&
            v.sectionId.departmentId.companyId != null,
        )
        .map((v) => {
          const x = {
            _id: v._id,
            name: `${v.sectionId.departmentId.companyId.name} > ${v.sectionId.departmentId.name} > ${v.sectionId.name} > ${v.name}`,
          };

          return x;
        });
      return businessUnits;
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Getting userlist for a particular bu
  async getBuUsers(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const userList = await User.find({
        parentBussinessUnitId: req.body.businessUnitId,
        status: 1,
      })
        .select('name staffId profilePicture')
        .populate({
          path: 'appointmentId',
          select: 'name',
        })
        .lean();

      return __.out(res, 201, userList);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getBoardUsers(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { wallId } = req.params;
      const wall = await WallModel.findById(wallId)
        .select('assignUsers createdBy')
        .lean();

      const result = await AssignUserRead.read(
        wall.assignUsers,
        { _id: 1, name: 1, staffId: 1, deviceToken: 1, role: 1 },
        wall.createdBy,
      );

      return __.out(res, 201, result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
}

module.exports = new MyBoard();
