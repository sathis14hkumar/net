const mongoose = require('mongoose');
const fs = require('fs-extra');
const moment = require('moment');
const { parse } = require('json2csv');
const SocialWallModel = require('../../models/wall');
const WallCategoryModel = require('../../models/wallCategory');
const WallPost = require('../../models/wallPost');
const User = require('../../models/user');
const __ = require('../../../helpers/globalFunctions');
const WallComment = require('../../models/wallPostComment');
const ReportCommentModel = require('../../models/reportComment');
const ReportPostModel = require('../../models/reportPost');
const QuestionResponse = require('../../models/questionResponse');
const CustomForm = require('../../models/customForms');
const ManageForm = require('../../models/manageForm');
const { AssignUserRead } = require('../../../helpers/assinguserread');

class SocialWall {
  async buToolQueryChecking(req, res) {
    try {
      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const query = {
        customFormId: mongoose.Types.ObjectId(req.query.customFormId),
      };
      const recordsTotal = await ManageForm.count(query).lean();
      const customForm = await CustomForm.findById(req.query.customFormId)
        .select({
          formStatus: 1,
        })
        .lean();
      let recordsFiltered = recordsTotal;

      if (!!req.query.search && req.query.search.value) {
        query.$or = [
          {
            'customFormId.title': {
              $regex: `${req.query.search.value}`,
              $options: 'ixs',
            },
          },
        ];
        recordsFiltered = await ManageForm.count(query).lean();
      }

      const sort = {};

      if (req.query.order) {
        const orderData = req.query.order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '1':
              sort.title = getSort(orderData[i].dir);
              break;

            default:
              sort.createdAt = getSort(orderData[i].dir);
              break;
          }
        }
      }

      const manageForm = await ManageForm.find(query)
        .populate([
          {
            path: 'customFormId',
            select: { title: 1, _id: 0 },
          },
          {
            path: 'userId',
            select: 'name',
          },
        ])
        .select({
          customFormId: 1,
          userId: 1,
          formStatus: 1,
          createdAt: 1,
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      const addStatusToManageForm = (single) => {
        const obj = {
          _id: single._id,
          createdAt: single.createdAt,
          formName: single.customFormId.title,
          user: single.userId.name,
        };

        return customForm.formStatus.reduce((prev, curr) => {
          const index = single.formStatus.findIndex(
            (st) => st.fieldId.toString() === curr._id.toString(),
          );

          prev[curr._id] =
            index === -1 ? null : single.formStatus[index].fieldStatusValueId;
          return prev;
        }, obj);
      };
      const result = manageForm.reduce(
        (prev, single) => prev.concat(addStatusToManageForm(single)),
        [],
      );
      const groupByStatus = await ManageForm.aggregate([
        {
          $match: {
            customFormId: mongoose.Types.ObjectId(req.query.customFormId),
          },
        },
        {
          $project: {
            formStatus: 1,
          },
        },
        {
          $unwind: '$formStatus',
        },
        {
          $group: {
            _id: '$formStatus.fieldStatusValueId',
            count: { $sum: 1 },
          },
        },
      ]);
      const data = {
        draw: req.query.draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsFiltered || 0,
        data: { result, groupByStatus },
      };

      return res.status(201).json(data);
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // Upload social banner image
  async uploadFiles(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

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

  // Creating new category
  async addCategory(req, res) {
    try {
      const alreadyAvailCategory = await WallCategoryModel.findOne({
        wallId: req.body.wallId,
        categoryName: req.body.categoryName,
      }).lean();

      if (!alreadyAvailCategory) {
        const isCategoryAdded = await WallCategoryModel.create({
          wallId: req.body.wallId,
          categoryName: req.body.categoryName,
        });

        if (!isCategoryAdded)
          return __.out(res, 300, 'Error while adding category');

        return __.out(res, 201, 'Category added successfully!');
      }

      return __.out(res, 300, 'Category already exist');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async addWall(req, res) {
    try {
      __.log(req.body, 'add wall');
      const requiredResult = await __.checkRequiredFields(
        req,
        [
          'wallName',
          'displayType',
          'postType',
          'bannerImage',
          'assignUsers',
          'category',
        ],
        'wall',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // if (!__.checkSpecialCharacters(req.body, "wall")) {
      //   return __.out(res, 300, `You've entered some excluded special characters`);
      // }
      // Check exist wall name
      const isWallAvail = await SocialWallModel.findOne({
        companyId: req.user.companyId,
        wallName: req.body.name,
        status: {
          $nin: [3],
        },
      }).lean();

      if (isWallAvail) {
        return __.out(res, 300, 'Wall name already exist');
      }

      // insert createdDate at nomination limits
      req.body.maxNomination.createdAt = moment(new Date()).utc().toDate();
      req.body.nominationPerUser.createdAt = moment(new Date()).utc().toDate();

      const userData = await User.findOne(
        { companyId: req.user.companyId, staffId: 'admin001' },
        { _id: 1 },
      );

      req.body.assignUsers.map((user) => {
        if (!user.admin.includes(userData._id.toString())) {
          user.admin.push(userData._id);
          user.firstAdminAddedAsDefault = true;
        }

        return user;
      });

      const insertWall = {
        wallName: req.body.wallName,
        displayType: req.body.displayType,
        postType: req.body.postType,
        isTaskActive: req.body.isTaskActive,
        quickNavEnabled: req.body.quickNavEnabled,
        isNomineeActive: req.body.isNomineeActive,
        bannerImage: req.body.bannerImage,
        assignUsers: req.body.assignUsers,
        companyId: req.user.companyId,
        createdBy: req.user._id,
        status: req.body.status || 1,
        maxNomination: req.body.maxNomination,
        nominationPerUser: req.body.nominationPerUser,
        adminResponse: req.body.adminResponse,
        postAnonymously: req.body.postAnonymously,
      };
      const newWall = await new SocialWallModel(insertWall).save();
      // Create Category & add in wall
      const catList = [];
      const createCategory = async function () {
        const insertPromises = req.body.category.map(async (elem) => {
          const insert = {
            wallId: newWall._id,
            categoryName: elem.categoryName,
          };
          const catData = new WallCategoryModel(insert);

          return catData.save();
        });

        const catDocs = await Promise.all(insertPromises);

        catList.push(...catDocs.map((catData) => catData._id));
      };

      await createCategory();
      newWall.category = catList;
      await newWall.save();
      return __.out(res, 201, 'Wall Created successfully!');
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  async updateWall(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(
        req,
        [
          'wallName',
          'displayType',
          'postType',
          'bannerImage',
          'assignUsers',
          'category',
        ],
        'wall',
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        _id: req.body.wallId,
        companyId: req.user.companyId,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };

      const catList = [];
      const createCategory = async function (elem) {
        if (!elem._id) {
          const update = {
            wallId: req.body.wallId,
            categoryName: elem.categoryName,
          };
          const catData = await new WallCategoryModel(update).save();

          catList.push(catData._id);
        } else {
          const existCat = await WallCategoryModel.findOne({
            _id: elem._id,
            wallId: req.body.wallId,
            status: 1,
          });

          if (existCat) {
            existCat.categoryName = elem.categoryName;
            await existCat.save();
            catList.push(existCat._id);
          }
        }
      };
      const promises = [];

      for (const elem of req.body.category) {
        __.log(elem);
        promises.push(createCategory(elem));
      }
      await Promise.all(promises);
      // Remove Not Listed Categories
      const removeNonCategories = await WallCategoryModel.update(
        {
          _id: {
            $nin: catList,
          },
          wallId: req.body.wallId,
          status: 1,
        },
        {
          $set: {
            status: 3,
          },
        },
        {
          multi: true,
        },
      );

      if (!removeNonCategories)
        return __.out(res, 300, 'Oops something went wrong');

      // check with nomination limit properties
      const wall = await SocialWallModel.findOne({
        companyId: req.user.companyId,
        _id: req.body.wallId._id,
        status: 1,
      }).lean();

      if (!!req.body.maxNomination && !!req.body.maxNomination.enabled) {
        if (
          !wall.maxNomination.enabled ||
          (!!wall.maxNomination.enabled &&
            (wall.maxNomination.submissionLimit !==
              req.body.maxNomination.submissionLimit ||
              wall.maxNomination.submissionPeriod !==
                req.body.maxNomination.submissionPeriod))
        ) {
          req.body.maxNomination.createdAt = moment(new Date()).utc().toDate();
        } else {
          req.body.maxNomination.createdAt =
            wall.maxNomination.createdAt || moment(new Date()).utc().toDate();
        }
      }

      if (
        !!req.body.nominationPerUser &&
        !!req.body.nominationPerUser.enabled
      ) {
        if (
          !wall.nominationPerUser.enabled ||
          (!!wall.nominationPerUser.enabled &&
            (wall.nominationPerUser.submissionLimit !==
              req.body.nominationPerUser.submissionLimit ||
              wall.nominationPerUser.submissionPeriod !==
                req.body.nominationPerUser.submissionPeriod))
        ) {
          req.body.nominationPerUser.createdAt = moment(new Date())
            .utc()
            .toDate();
        } else {
          req.body.nominationPerUser.createdAt =
            wall.nominationPerUser.createdAt ||
            moment(new Date()).utc().toDate();
        }
      }

      const userData = await User.findOne(
        { companyId: req.user.companyId, staffId: 'admin001' },
        { _id: 1 },
      );

      req.body.assignUsers.map((user) => {
        if (!user.admin.includes(userData._id.toString())) {
          user.admin.push(userData._id);
          user.firstAdminAddedAsDefault = true;
        }

        return user;
      });

      const wallData = await SocialWallModel.findOneAndUpdate(
        where,
        {
          $set: {
            wallName: req.body.wallName,
            displayType: req.body.displayType,
            postType: req.body.postType,
            isTaskActive: req.body.isTaskActive,
            quickNavEnabled: req.body.quickNavEnabled,
            isNomineeActive: req.body.isNomineeActive,
            bannerImage: req.body.bannerImage,
            category: catList,
            assignUsers: req.body.assignUsers,
            status: req.body.status || 2,
            maxNomination: req.body.maxNomination,
            nominationPerUser: req.body.nominationPerUser,
            adminResponse: !!req.body.adminResponse,
            postAnonymously: !!req.body.postAnonymously,
            nominationOnlyByAdmin: !!req.body.nominationOnlyByAdmin,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ).lean();

      if (!wallData) return __.out(res, 300, 'Wall not found');

      return __.out(res, 201, 'Updated Successfully!');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async delete(req, res) {
    try {
      const isWallAvail = await SocialWallModel.findOne({
        _id: req.body.wallId,
        companyId: req.user.companyId,
      });

      if (!isWallAvail) {
        return __.out(res, 404, 'Wall not found');
      }

      const isDeleted = await SocialWallModel.update(
        {
          _id: req.body.wallId,
          companyId: req.user.companyId,
        },
        {
          $set: {
            status: 3,
          },
        },
      ).lean();

      if (!isDeleted) return __.out(res, 300, 'Error while removing wall');

      return __.out(res, 201, 'Removed successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async read(req, res, quickNav = false) {
    try {
      const { page, search, sortWith, sortBy } = req.query;
      let { limit, skip } = req.query;

      const pageNum = page ? parseInt(page, 10) : 0;

      limit = limit ? parseInt(limit, 10) : 10;
      skip = skip ? parseInt(skip, 10) : (pageNum - 1) * limit;
      const searchQuery = {
        companyId: req.user.companyId,
        $or: [
          {
            wallType: {
              $exists: false,
            },
          },
          {
            wallType: 1,
          },
        ],
        status: {
          $ne: 3, // except deleted
        },
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };

      if (quickNav) {
        searchQuery.quickNavEnabled = true;
        const wallList = await SocialWallModel.find(searchQuery)
          .populate({
            path: 'assignUsers.businessUnits',
            select: 'orgName',
            // populate: {
            //   path: 'sectionId',
            //   select: 'name status departmentId',
            //   populate: {
            //     path: 'departmentId',
            //     select: 'name status companyId',
            //     populate: {
            //       path: 'companyId',
            //       select: 'name status',
            //     },
            //   },
            // },
          })
          .populate({
            path: 'assignUsers.appointments',
            select: 'name',
          })
          .populate({
            path: 'assignUsers.subSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
          })
          .populate({
            path: 'assignUsers.user',
            select: 'name staffId parentBussinessUnitId',
          })
          .populate({
            path: 'assignUsers.admin',
            select: 'name staffId parentBussinessUnitId',
          })
          .populate({
            path: 'category',
            select: 'categoryName',
          })
          .sort({
            createdAt: -1,
          })
          .lean();

        return __.out(res, 201, wallList);
      }

      if (search) {
        searchQuery.wallName = {
          $regex: `${search}`,
          $options: 'i',
        };
      }

      const sort = {};

      if (sortWith) {
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        switch (sortWith) {
          case 'wallName':
            sort.wallName = getSort(sortBy);
            break;

          case 'status':
            sort.status = getSort(sortBy);
            break;

          default:
            sort.createdAt = getSort(sortBy);
            break;
        }
      }

      const [wallList, count] = await Promise.all([
        SocialWallModel.find(searchQuery)
          .populate({
            path: 'assignUsers.businessUnits',
            select: 'orgName',
            // populate: {
            //   path: 'sectionId',
            //   select: 'name status departmentId',
            //   populate: {
            //     path: 'departmentId',
            //     select: 'name status companyId',
            //     populate: {
            //       path: 'companyId',
            //       select: 'name status',
            //     },
            //   },
            // },
          })
          .populate({
            path: 'assignUsers.appointments',
            select: 'name',
          })
          .populate({
            path: 'assignUsers.subSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'skillSetId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
          })
          .populate({
            path: 'assignUsers.user',
            select: 'name staffId',
          })
          .populate({
            path: 'assignUsers.admin',
            select: 'name staffId',
          })
          .populate({
            path: 'category',
            select: 'categoryName',
          })
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        SocialWallModel.countDocuments(searchQuery),
      ]);

      return res.status(201).json({ data: wallList, total: count });
      // return __.out(res, 201, wallList);
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async readOne(req, res) {
    try {
      const result = await SocialWallModel.findOne({
        _id: req.body.wallId,
      })
        .populate({
          path: 'category',
          select: 'categoryName',
        })
        .populate({
          path: 'user',
          select: 'name userName profilePicture',
        })
        .lean();

      if (result) return __.out(res, 201, result);

      return __.out(res, 300, 'Record not found');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // Get all Posts - wall base
  async reportedPosts(req, res) {
    try {
      const { page, search, sortWith, sortBy, draw } = req.query;
      let { limit } = req.query;
      const pageNum = page ? parseInt(page, 10) : 0;

      limit = limit ? parseInt(limit, 10) : 10;
      const skip = (pageNum - 1) * limit;
      // User as admin in wall
      const searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let wallIds = await SocialWallModel.find(searchQuery).lean();

      wallIds = wallIds.map((v) => mongoose.Types.ObjectId(v._id));
      const query = {
        reportCount: {
          $nin: [0],
        },
        'wallId._id': {
          $in: wallIds,
        },
        status: {
          $in: [1, 2],
        },
      };

      let isSearched = false;

      if (search) {
        isSearched = true;
        query.$or = [
          {
            title: {
              $regex: `${search}`,
              $options: 'i',
            },
          },
          {
            'wallId.wallName': {
              $regex: `${search}`,
              $options: 'i',
            },
          },
        ];
      }

      const sort = {};

      if (sortWith) {
        sort[sortWith] = sortBy === 'desc' ? -1 : 1;
      }

      let postList = await WallPost.aggregate([
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

      // Get all post ids
      const postIds = postList.map((v) => v._id);
      const reportUsers = await ReportPostModel.find({
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

      let totalCount;
      const totalUserCount = await WallPost.count({
        reportCount: {
          $nin: [0],
        },
        wallId: {
          $in: wallIds,
        },
        status: {
          $in: [1, 2],
        },
      }).lean();

      if (isSearched) {
        totalCount = await WallPost.aggregate([
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

  // sortBy=desc&sortWith=createdBy&page=1&limit=10
  // Get all Posts - wall base
  async reportedComments(req, res) {
    try {
      const { page, search, sortWith, sortBy, draw } = req.query;
      let { limit } = req.query;
      const pageNum = page ? parseInt(page, 10) : 0;

      limit = limit ? parseInt(limit, 10) : 10;
      const skip = (pageNum - 1) * limit;
      // User as admin in wall
      const searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let wallIds = await SocialWallModel.find(searchQuery).lean();

      wallIds = wallIds.map((v) => mongoose.Types.ObjectId(v._id));

      const query = {
        reportCount: {
          $nin: [0],
        },
        'wallId._id': {
          $in: wallIds,
        },
        status: {
          $in: [1, 2],
        },
      };

      let isSearched = false;

      if (search) {
        isSearched = true;
        query.$or = [
          {
            comment: {
              $regex: `${search}`,
              $options: 'i',
            },
          },
          {
            'postId.title': {
              $regex: `${search}`,
              $options: 'i',
            },
          },
          {
            'wallId.wallName': {
              $regex: `${search}`,
              $options: 'i',
            },
          },
        ];
      }

      const sort = {};

      if (sortWith) {
        sort[sortWith] = sortBy === 'desc' ? -1 : 1;
      }

      let commentList = await WallComment.aggregate([
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
            from: 'wallposts',
            localField: 'postId',
            foreignField: '_id',
            as: 'postId',
          },
        },
        {
          $unwind: '$postId',
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

      // Get all post ids
      const commentIds = commentList.map((v) => v._id);
      const reportUsers = await ReportCommentModel.find({
        commentId: {
          $in: commentIds,
        },
      })
        .populate({
          path: 'userId',
          select: 'name userName profilePicture',
        })
        .lean();

      commentList = commentList.map((p) => {
        p.userList = reportUsers.filter(
          (v) => p._id.toString() === v.commentId.toString(),
        );
        return p;
      });

      let totalCount;
      const totalUserCount = await WallComment.count({
        reportCount: {
          $nin: [0],
        },
        wallId: {
          $in: wallIds,
        },
        status: {
          $in: [1, 2],
        },
      }).lean();

      if (isSearched) {
        totalCount = await WallComment.aggregate([
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
              from: 'wallposts',
              localField: 'postId',
              foreignField: '_id',
              as: 'postId',
            },
          },
          {
            $unwind: '$postId',
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
        data: commentList,
      };

      return res.status(201).json(result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Get all Posts - wall base
  async reviewPost(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'postId',
        'status',
      ]);

      if (requiredResult.status === false)
        return __.out(res, 400, requiredResult.missingFields);

      const isUpdated = await WallPost.update(
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

  async viewComments(req, res) {
    try {
      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      // TODO: check this

      // User as admin in wall
      // const wallQuery = {
      //   companyId: req.user.companyId,
      //   status: 1,
      //   assignUsers: {
      //     $elemMatch: {
      //       admin: {
      //         $in: [req.user._id],
      //       },
      //     },
      //   },
      // };
      // const wallIds = await SocialWallModel.find(wallQuery).lean();
      // wallIds = wallIds.map((v) => mongoose.Types.ObjectId(v._id));

      // Admin's posts
      let postIds = await WallPost.find({
        status: 1,
      }).lean();

      postIds = postIds.map((v) => v._id);

      const searchQuery = {
        reportCount: {
          $gt: 0,
        },
        postId: {
          $in: postIds,
        },
        status: {
          $in: [1, 2],
        },
      };

      let isSearched = false;

      if (req.query.search.value) {
        isSearched = true;
        searchQuery.$or = [
          {
            comment: {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
        ];
      }

      const populateArray = [
        {
          path: 'userId',
          select: 'name _id',
        },
        {
          path: 'postId',
          select: 'title _id',
        },
        {
          path: 'wallId',
          select: 'wallName _id',
        },
      ];

      const postComments = await WallComment.find(searchQuery)
        .populate(populateArray)
        .skip(skip)
        .limit(limit)
        .lean();

      const totalComments = await WallComment.count(searchQuery).lean();

      let totalCount = 0;

      if (isSearched)
        totalCount = await WallComment.count({
          reportCount: {
            $gt: 0,
          },
          postId: {
            $in: postIds,
          },
          status: {
            $in: [1, 2],
          },
        }).lean();
      else totalCount = totalComments;

      return res.status(201).json({
        draw: req.query.draw || 0,
        recordsTotal: totalComments || 0,
        recordsFiltered: totalCount || 0,
        data: postComments,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async updateStatus(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'commentId',
        'status',
      ]);

      if (requiredResult.status === false)
        return __.out(res, 400, requiredResult.missingFields);

      const isUpdated = await WallComment.update(
        {
          _id: req.body.commentId,
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      ).lean();

      if (!isUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      let incCount = -1;

      if (req.body.status === 1) {
        incCount = 1;
      }

      const isCountUpdated = await WallPost.update(
        {
          _id: isUpdated.postId,
        },
        {
          $set: {
            $inc: {
              commentCount: incCount,
            },
          },
        },
      ).lean();

      if (!isCountUpdated)
        return __.out(res, 300, 'Oops error while updating status');

      return __.out(res, 201, 'Updated successfully');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // Export the Wallpost..
  async exportWallPost(req, res) {
    try {
      const wallPostDetails = await WallPost.findById(req.body._id)
        .populate([
          {
            path: 'moduleId',
            select: 'moduleName questions',
            populate: {
              path: 'questions',
            },
          },
          {
            path: 'wallId',
            select: 'assignUsers createdBy',
          },
        ])
        .select('title description moduleId wallId')
        .lean();
      const { questions } = wallPostDetails.moduleId;
      let users = await AssignUserRead.read(
        wallPostDetails.wallId.assignUsers,
        null,
        req.user._id,
      );

      users = users.users;
      const userDetails = await User.find({
        _id: {
          $in: users,
        },
      })
        .populate([
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
        ])
        .select(
          'name staffId email appointmentId contactNumber parentBussinessUnitId',
        )
        .lean();
      const questionResponses = await QuestionResponse.find({
        userId: {
          $in: users || [],
        },
        wallPostId: wallPostDetails._id,
      }).lean();

      if (!questionResponses || questionResponses.length === 0) {
        return __.out(res, 300, 'No data found');
      }

      let headers = questions.map((qestion, i) => `Q-${i}`);
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
            answer = Array.isArray(response.answer)
              ? response.answer.map((a) => a.value).join(', ')
              : getOptionValue(question, response);
            break;

          default:
            break;
        }
        return answer || '--';
      };
      const userBasesResponses = questionResponses.reduce((prev, curr) => {
        prev[curr.userId] = prev[curr.userId] || [];
        prev[curr.userId].push(curr);
        return prev;
      }, {});
      const getQuestionAndAnswer = (userResponse) => {
        if (userResponse.length) {
          const output = questions.reduce((prev, question, i) => {
            const index = userResponse.findIndex(
              (questionResponse) =>
                questionResponse.questionId.toString() ===
                question._id.toString(),
            );

            prev[`Q-${i}`] =
              index === -1 ? '--' : getAnswer(question, userResponse[index]);
            return prev;
          }, {});
          const user = userDetails.find(
            (u) => u._id.toString() === userResponse[0].userId.toString(),
          );

          if (!user) {
            return {};
          }

          output.staffId = user.staffId;
          output.businessUnit = `${user.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;
          const data = questions.filter((question) => question.type === 7);

          if (data.length) {
            const { profile } = data[0];
            const internalQuestions = profile.map((iq) =>
              iq.questionName.toLowerCase(),
            );

            internalQuestions.forEach((element) => {
              switch (element) {
                case 'username':
                  output[element] = user.name;
                  headers = [element, ...headers];
                  break;

                case 'appointment':
                  output[element] = user.appointmentId.name;
                  headers = [element, ...headers];
                  break;

                case 'mobile':
                  output[element] = user.contactNumber;
                  headers = [element, ...headers];
                  break;

                case 'email':
                  output[element] = user.email;
                  headers = [element, ...headers];
                  break;

                default:
                  break;
              }
            });
          }

          const set = new Set(['staffId', 'businessUnit', ...headers]);

          headers = Array.from(set);
          return output;
        }

        return {};
      };

      const userKeys = Object.keys(userBasesResponses);

      for (const user of userKeys) {
        const element = userBasesResponses[user];

        rows.push(getQuestionAndAnswer(element));
      }
      if (rows.length) {
        const fields = headers;
        const opts = { fields };
        const csv = parse(rows, opts);

        await fs.writeFile(
          `./public/uploads/Postexport/${wallPostDetails._id}.csv`,
          csv,
        );
        return __.out(res, 201, {
          csvLink: `uploads/Postexport/${wallPostDetails._id}.csv`,
        });
      }

      return __.out(res, 300, 'Something went wrong try later');
    } catch (error) {
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Get all Posts - wall base
  async getWallPostsList(req, res) {
    try {
      const { page, search, sortWith, sortBy, draw } = req.query;
      let { limit } = req.query;
      const pageNum = page ? parseInt(page, 10) : 0;

      limit = limit ? parseInt(limit, 10) : 10;
      const skip = (pageNum - 1) * limit;
      // User as admin in wall
      const searchQuery = {
        companyId: req.user.companyId,
        status: 1,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let wallIds = await SocialWallModel.find(searchQuery).lean();

      wallIds = wallIds.map((v) => mongoose.Types.ObjectId(v._id));

      const query = {
        'wallId._id': {
          $in: wallIds,
        },
        status: {
          $in: [1],
        },
        moduleIncluded: true,
      };

      let isSearched = false;

      if (search) {
        isSearched = true;
        query.$or = [
          {
            title: {
              $regex: `${search}`,
              $options: 'i',
            },
          },
          {
            'wallId.wallName': {
              $regex: `${search}`,
              $options: 'i',
            },
          },
        ];
      }

      const allowedSortProperties = {
        createdAt: 1,
        updatedAt: 1,
      };

      const sort = {};

      if (sortWith && allowedSortProperties.sortWith) {
        sort.sortWith = sortBy === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = 1;
      }

      const postList = await WallPost.aggregate([
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

      let totalCount;
      const totalUserCount = await WallPost.count({
        wallId: {
          $in: wallIds,
        },
        status: {
          $in: [1],
        },
        moduleIncluded: true,
      }).lean();

      if (isSearched) {
        totalCount = await WallPost.aggregate([
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

  async getCompanyWalls(req, res) {
    try {
      const walls = await SocialWallModel.find({
        status: 1,
        companyId: req.user.companyId,
      })
        .select('wallName')
        .lean();

      return __.out(res, 201, walls);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

module.exports = new SocialWall();
