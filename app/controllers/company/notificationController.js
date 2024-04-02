const mongoose = require('mongoose');
const moment = require('moment');
const path = require('path');
const { parse } = require('json2csv');
const mime = require('mime-types');
const fs = require('fs-extra');
const _ = require('lodash');
const Notification = require('../../models/notification');
const BuilderModule = require('../../models/builderModule');
const Question = require('../../models/question');
const QuestionResponse = require('../../models/questionResponse');
const TrackedQuestion = require('../../models/trackUserQns');
const FCM = require('../../../helpers/fcm');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

const { AssignUserRead } = require('../../../helpers/assinguserread');

class NotificationClass {
  async create(req, res) {
    try {
      const { body, file } = req;

      __.log(body);
      const reqFields = ['title'];
      const requiredResult = await __.checkRequiredFields(
        req,
        reqFields,
        'notification',
      );

      if (!__.checkSpecialCharacters(body, 'notification')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const insert = body;

      insert.createdBy = req.user._id;
      // Remove the keys while updating
      const unSetKeys = [];

      insert.subTitle = insert.subTitle || '';
      insert.description = insert.description || '';
      if (insert.activeFrom) {
        insert.activeFrom = moment(insert.activeFrom, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      } else {
        unSetKeys.push('activeFrom');
      }

      if (insert.activeTo) {
        insert.activeTo = moment(insert.activeTo, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      } else {
        unSetKeys.push('activeTo');
      }

      if (insert.effectiveFrom) {
        insert.effectiveFrom = moment(
          insert.effectiveFrom,
          'MM-DD-YYYY HH:mm:ss Z',
        )
          .utc()
          .format();
      }

      if (insert.effectiveTo) {
        insert.effectiveTo = moment(insert.effectiveTo, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      } else {
        unSetKeys.push('effectiveTo');
      }

      if (file) {
        insert.notificationAttachment = file.path.substring(6);
      }

      insert.assignUsers = insert.assignUsers || [];
      let userIds = await AssignUserRead.read(
        insert.assignUsers,
        null,
        insert.createdBy,
      );

      userIds = userIds.users;
      if (userIds.length === 0 && insert.status === 1) {
        return __.out(res, 300, `No users found to send this notification`);
      }

      insert.notifyOverAllUsers = userIds;
      insert.notifyUnreadUsers = userIds;
      // Link Module
      if (body.moduleId) {
        const moduleCheck = await BuilderModule.findOne({
          _id: body.moduleId,
          createdBy: req.user._id,
          status: 1,
        }).lean();

        if (!moduleCheck) {
          return __.out(res, 300, `Module Not Found`);
        }

        // Check module is already linked
        if (insert.status === 1 && body.notificationId) {
          const moduleLinked = await Notification.findOne({
            _id: {
              $nin: [body.notificationId],
            },
            moduleId: body.moduleId,
            status: 1,
          }).lean();

          if (moduleLinked) {
            return __.out(res, 300, `Module is already Linked !`);
          }
        }

        insert.moduleIncluded = true;
        insert.moduleId = body.moduleId;
      } else {
        insert.moduleIncluded = false;
        delete insert.moduleId;
        unSetKeys.push('moduleId');
      }

      // Update draft
      if (body.notificationId) {
        // Remove the existing values
        const updateNoti = {
          $set: insert,
        };

        if (unSetKeys.length > 0) {
          const unsetQuery = {};

          for (const key of unSetKeys) {
            unsetQuery[key] = 1;
          }
          updateNoti.$unset = unsetQuery;
        }

        await Notification.findOneAndUpdate(
          {
            _id: insert.notificationId,
          },
          updateNoti,
        );
      } else {
        await new Notification(insert).save();
      }

      return __.out(
        res,
        201,
        `Notification has been created successfully for ${
          userIds.length || ''
        } users`,
      );
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      logInfo('read notification called');
      const requiredResult1 = await __.checkRequiredFields(req, [
        'businessUnitId',
      ]);

      if (requiredResult1.status === false) {
        return __.out(res, 400, requiredResult1.missingFields);
      }

      const whereData = {
        businessUnitId: req.body.businessUnitId,
      };

      logInfo('read notification called', whereData);
      const notificationDetails = await this.getNotificationDetails(
        whereData,
        req.query,
      );

      return __.out(res, 201, notificationDetails);
    } catch (err) {
      logError('read notification has error.stack', err.stack);
      return __.out(res, 500);
    }
  }

  async getUserwhoUnreadOrAchknowledgedNotification(req, res) {
    try {
      logInfo('getUserwhoUnreadOrAchknowledgedNotification called');
      const { from } = req.query;
      let project = { notifyUnreadUsers: 1 };
      let notificationPath = 'notifyUnreadUsers';

      if (from === 'acknowledged') {
        project = { notifyAcknowledgedUsers: 1 };
        notificationPath = 'notifyAcknowledgedUsers';
      }

      const notificationId = req.params._id;
      const data = await Notification.aggregate([
        { $match: { _id: mongoose.Types.ObjectId(notificationId) } },
        { $project: project },
        {
          $lookup: {
            from: 'users',
            localField: notificationPath,
            foreignField: '_id',
            as: 'users',
            pipeline: [
              {
                $match: {
                  status: 1,
                },
              },
              { $project: { name: 1, staffId: 1 } },
            ],
          },
        },
        {
          $project: {
            users: 1,
            _id: 0,
          },
        },
      ]);

      res.status(201).json({ data: data[0]?.users });
    } catch (error) {
      logError(
        'getUserwhoUnreadOrAchknowledgedNotification has error',
        error.stack,
      );
      __.out(res, 500);
    }
  }

  async update(req, res) {
    try {
      const { body, file } = req;
      const reqFields = ['notificationId'];
      const requiredResult = await __.checkRequiredFields(
        req,
        reqFields,
        'notification',
      );

      if (!__.checkSpecialCharacters(body, 'notification')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const insert = body;
      // Remove the keys while updating
      const unSetKeys = [];

      insert.createdBy = req.user._id;
      insert.isSent = 0;

      if (insert.activeFrom) {
        insert.activeFrom = moment(insert.activeFrom, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      } else {
        unSetKeys.push('activeFrom');
      }

      if (insert.activeTo) {
        insert.activeTo = moment(insert.activeTo, 'MM-DD-YYYY HH:mm:ss Z')
          .utc()
          .format();
      } else {
        unSetKeys.push('activeTo');
      }

      if (file) {
        insert.notificationAttachment = file.path.substring(6);
      }

      insert.assignUsers = insert.assignUsers || [];
      let userIds = await AssignUserRead.read(
        insert.assignUsers,
        null,
        insert.createdBy,
      );

      userIds = userIds.users;
      insert.notifyOverAllUsers = userIds;
      insert.notifyUnreadUsers = userIds;
      // Link Module
      if (body.moduleId) {
        const moduleCheck = await BuilderModule.findOne({
          _id: req.body.moduleId,
          createdBy: req.user._id,
          status: 1,
        }).lean();

        if (!moduleCheck) {
          return __.out(res, 300, `Module Not Found`);
        }

        if (insert.status === 1) {
          const moduleLinked = await Notification.findOne({
            _id: {
              $nin: [body.notificationId],
            },
            moduleId: body.moduleId,
            status: 1,
          }).lean();

          if (moduleLinked) {
            return __.out(res, 300, `Module is already Linked !`);
          }
        }

        insert.moduleIncluded = true;
        insert.moduleId = body.moduleId;
      } else {
        insert.moduleIncluded = false;
        unSetKeys.push('moduleId');
      }

      // Remove the existing values
      const updateNoti = {
        $set: insert,
      };

      if (unSetKeys.length > 0) {
        const unsetQuery = {};

        for (const key of unSetKeys) {
          unsetQuery[key] = 1;
        }
        updateNoti.$unset = unsetQuery;
      }

      await Notification.findOneAndUpdate(
        {
          _id: insert.notificationId,
        },
        updateNoti,
      );

      __.out(
        res,
        201,
        `Notification has been Updated successfully for ${
          userIds.length || ''
        } users`,
      );
      if (file) {
        __.scanFile(
          file.filename,
          `public/uploads/notificationAttachment/${file.filename}`,
        );
      }

      return true;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async myNotifications(req, res) {
    try {
      logInfo('myNotifications has called', req.user._id);
      const data = {
        userId: req.user._id,
      };
      const myNotifications = await this.userNotifications(data, req, res);

      return __.out(res, 201, myNotifications);
    } catch (err) {
      logError('myNotifications has error', err);
      return __.out(res, 500);
    }
  }

  async unReadNotifications(req, res) {
    try {
      const data = {
        userId: req.user._id,
      };
      const results = await this.myNotificationsRead(
        data,
        new Date(),
        req.query,
      );

      // Add Mimetype for attached files
      for (const item of results.data) {
        if (item.notificationAttachment) {
          const attachMimeType = mime.contentType(
            path.extname(item.notificationAttachment),
          );

          item.mimeType = attachMimeType;
        }
      }

      return res.success(results);
    } catch (error) {
      return res.error(error);
    }
  }

  async myNotificationsRead(
    condition,
    date,
    { page, limit, search, sortBy, sortWith },
  ) {
    const searchCondition = search
      ? { title: { $regex: search, $options: 'i' } }
      : {};
    const [{ metadata, data }] = await Notification.aggregate([
      {
        $match: {
          status: 1,
          notifyOverAllUsers: mongoose.Types.ObjectId(condition.userId),
          activeFrom: {
            $lte: new Date(),
          },
          activeTo: {
            $gte: new Date(),
          },
          ...searchCondition,
        },
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategory',
        },
      },
      {
        $unwind: '$subCategory',
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'subCategory.categoryId',
          foreignField: '_id',
          as: 'subCategory.categoryId',
        },
      },
      {
        $unwind: '$subCategory.categoryId',
      },
      {
        $project: {
          effectiveFrom: 1,
          effectiveTo: 1,
          activeFrom: 1,
          activeTo: 1,
          title: 1,
          subTitle: 1,
          description: 1,
          notificationAttachment: 1,
          subCategory: 1,
          isAcknowledged: {
            $setIsSubset: [
              [mongoose.Types.ObjectId(condition.userId)],
              '$notifyAcknowledgedUsers',
            ],
          },
          moduleIncluded: 1,
          moduleId: 1,
          viewOnly: 1,
        },
      },
      {
        $sort: { [sortWith]: sortBy === 'desc' ? -1 : 1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: (Number(page) - 1) * Number(limit),
            },
            {
              $limit: Number(limit),
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

  async acknowledgedNotifications(req, res) {
    try {
      const data = {
        userId: req.user._id,
      };
      const results = await this.acknowledgedNotificationsRead(
        data,
        new Date(),
        req.query,
      );

      // Add Mimetype for attached files
      for (const item of results.data) {
        if (item.notificationAttachment) {
          const attachMimeType = mime.contentType(
            path.extname(item.notificationAttachment),
          );

          item.mimeType = attachMimeType;
        }
      }

      return res.success(results);
    } catch (error) {
      return res.error(error);
    }
  }

  async acknowledgedNotificationsRead(
    condition,
    date,
    { page, limit, search, sortBy, sortWith },
  ) {
    const searchCondition = search
      ? { title: { $regex: search, $options: 'i' } }
      : {};

    const [{ metadata, data }] = await Notification.aggregate([
      {
        $match: {
          status: 1,
          notifyOverAllUsers: mongoose.Types.ObjectId(condition.userId),
          activeFrom: {
            $lte: date,
          },
          activeTo: {
            $gte: date,
          },
          notifyAcknowledgedUsers: {
            $in: [condition.userId],
          },
          ...searchCondition,
        },
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategory',
        },
      },
      {
        $unwind: '$subCategory',
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'subCategory.categoryId',
          foreignField: '_id',
          as: 'subCategory.categoryId',
        },
      },
      {
        $unwind: '$subCategory.categoryId',
      },
      {
        $project: {
          effectiveFrom: 1,
          effectiveTo: 1,
          activeFrom: 1,
          activeTo: 1,
          title: 1,
          subTitle: 1,
          description: 1,
          notificationAttachment: 1,
          subCategory: 1,
          isAcknowledged: {
            $setIsSubset: [
              [mongoose.Types.ObjectId(condition.userId)],
              '$notifyAcknowledgedUsers',
            ],
          },
          moduleIncluded: 1,
          moduleId: 1,
          viewOnly: 1,
        },
      },
      {
        $sort: { [sortWith]: sortBy === 'desc' ? -1 : 1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: (Number(page) - 1) * 10,
            },
            {
              $limit: Number(limit),
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

  async userNotifications(data, req, res) {
    try {
      const { sortBy, sortWith = 'title', search } = req.query || {};
      const searchCondition = {};

      if (search) {
        searchCondition.title = new RegExp(search, 'i');
      }

      const condition = {
        status: 1,
        notifyOverAllUsers: mongoose.Types.ObjectId(data.userId),
        activeFrom: {
          $lte: new Date(),
        },
        activeTo: {
          $gte: new Date(),
        },
      };

      logInfo('userNotifications has called', data);
      const results = await Notification.aggregate([
        {
          $match: { ...condition, ...searchCondition },
        },
        { $sort: { [sortWith]: sortBy === 'desc' ? -1 : 1 } },
        {
          $lookup: {
            from: 'subcategories',
            localField: 'subCategoryId',
            foreignField: '_id',
            as: 'subCategory',
          },
        },
        {
          $unwind: '$subCategory',
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'subCategory.categoryId',
            foreignField: '_id',
            as: 'subCategory.categoryId',
          },
        },
        {
          $unwind: '$subCategory.categoryId',
        },
        {
          $project: {
            _id: 1,
            effectiveFrom: 1,
            effectiveTo: 1,
            activeFrom: 1,
            activeTo: 1,
            title: 1,
            subTitle: 1,
            description: 1,
            notificationAttachment: 1,
            subCategory: 1,
            isAcknowledged: {
              $setIsSubset: [
                [mongoose.Types.ObjectId(data.userId)],
                '$notifyAcknowledgedUsers',
              ],
            },
            moduleIncluded: 1,
            moduleId: 1,
            viewOnly: 1,
          },
        },
      ]);

      // Add Mimetype for attached files
      for (const item of results) {
        if (item.notificationAttachment) {
          const attachMimeType = mime.contentType(
            path.extname(item.notificationAttachment),
          );

          item.mimeType = attachMimeType;
        }

        if (!item.moduleIncluded) {
          item.questionsCompleted = true;
        } else if (item.moduleIncluded && !!item.moduleId) {
          item.questionsCompleted = this.allTrackedAnswered(res, {
            userId: data.userId,
            notificationId: item._id,
          });
        }
      }
      return results;
    } catch (e) {
      logError('userNotifications has error', e);
      logError('userNotifications has error', e.stack);
      return [];
    }
  }

  async viewAllNotification(req, res) {
    try {
      const { params, query } = req;
      const condition = { businessUnitId: params.businessUnitId };
      const notificationDetails = await this.getAllNotifications(
        condition,
        query,
      );

      return res.success(notificationDetails);
    } catch (error) {
      return res.error(error);
    }
  }

  async getAllNotifications(
    condition,
    { page, limit, sortBy, sortWith, search },
  ) {
    const searchCondition = {};

    if (search) {
      searchCondition.title = new RegExp(search, 'i');
    }

    const count = await Notification.countDocuments({
      ...condition,
      ...searchCondition,
    });

    const data = await Notification.find({
      ...condition,
      ...searchCondition,
    })
      .populate([
        {
          path: 'subCategoryId',
          select: 'name categoryId',
          populate: {
            path: 'categoryId',
            select: 'name',
          },
        },
        {
          path: 'businessUnitId',
          select: 'name status orgName',
          match: {
            status: 1,
          },
          populate: {
            path: 'sectionId',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'departmentId',
              select: 'name status companyName',
              match: {
                status: 1,
              },
            },
          },
        },
        {
          path: 'notifyOverAllUsers',
          select: 'name staffId',
        },
        {
          path: 'notifyAcknowledgedUsers',
          select: 'name staffId',
        },
        {
          path: 'notifyUnreadUsers',
          select: 'name staffId',
        },
        {
          path: 'assignUsers.businessUnits',
          select: 'name status sectionId orgName',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyName',
            },
          },
        },
        {
          path: 'assignUsers.appointments',
          select: 'name',
        },
        {
          path: 'assignUsers.user',
          select: 'name staffId',
        },
      ])
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortWith]: sortBy === 'desc' ? -1 : 1 })
      .lean();

    return { count, data };
  }

  async getNotificationDetails(whereData, query) {
    try {
      logInfo('read getNotificationDetails called', whereData);
      const { sortBy, sortWith, page, search } = query;
      let { limit } = query;
      const pageNum = page ? parseInt(page, 10) : 0;

      limit = limit ? parseInt(limit, 10) : 10;
      const skip = (pageNum - 1) * limit;

      if (search) {
        whereData.title = {
          $regex: search,
          $options: 'ixs',
        };
      }

      const [data, count] = await Promise.all([
        Notification.find(whereData)
          .sort({ [sortWith]: sortBy === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limit)
          .populate([
            {
              path: 'subCategoryId',
              select: 'name categoryId',
              populate: {
                path: 'categoryId',
                select: 'name',
              },
            },
            {
              path: 'businessUnitId',
              select: 'name status orgName',
              match: {
                status: 1,
              },
            },
            {
              path: 'assignUsers.businessUnits',
              select: 'name status sectionId orgName',
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
            {
              path: 'assignUsers.appointments',
              select: 'name',
            },
            {
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
            },
            {
              path: 'assignUsers.user',
              select: 'name staffId',
            },
          ])
          .lean(),
        Notification.countDocuments(whereData),
      ]);

      return { data, count };
    } catch (e) {
      logError('getNotificationDetails has error', e);
      logError('getNotificationDetails has error.stack', e.stack);
      return [];
    }
  }

  async addUserToDynamicNotifications(data) {
    const notificationIds = await AssignUserRead.getUserInAssignedUser(
      data.userData,
      Notification,
    );

    // If no notifications found
    if (notificationIds.length === 0) {
      return true;
    }

    const matchedNotifications = await Notification.find({
      _id: {
        $in: notificationIds,
      },
      status: 1,
      isDynamic: 1,
      activeTo: {
        $gte: moment().utc().format(),
      },
    }).lean();

    const matchedNotificationsIds = matchedNotifications.map((x) => x._id);

    await Notification.updateMany(
      {
        _id: {
          $in: matchedNotificationsIds,
        },
      },
      {
        $addToSet: {
          notifyOverAllUsers: data.userId,
          notifyUnreadUsers: data.userId,
        },
      },
      {
        multi: true,
      },
    );

    if (data.deviceToken) {
      for (const eachNotification of matchedNotifications) {
        const pushData = {
          title: eachNotification.title,
          body: eachNotification.description,
          redirect: 'notifications',
        };
        const collapseKey = eachNotification._id;

        FCM.push(data.deviceToken, pushData, collapseKey);
      }
    }

    return true;
  }

  async acknowledge(req, res) {
    try {
      logInfo('acknowledge API has called');
      const requiredResult = await __.checkRequiredFields(req, [
        'notificationId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const data = {
        userId: req.user._id,
        notificationId: req.body.notificationId,
      };

      logInfo('acknowledge API has called by', data);
      if (req.body.qnsresponses) {
        data.user = req.user;
        data.qnsresponses = req.qnsresponses;
      }

      return this.userAcknowledge(data, res);
    } catch (err) {
      logError('acknowledge API has error', err);
      logError('acknowledge API has error.stack', err.stack);
      return __.out(res, 500);
    }
  }

  async userAcknowledge(data, res) {
    try {
      logInfo('userAcknowledge has called', data);
      const { notificationId, userId } = data;
      const notificationDetails = await Notification.findOne({
        _id: notificationId,
        status: 1,
      });

      if (!notificationDetails) {
        return __.out(res, 300, 'Invalid notification');
      }

      const isValidUser = await notificationDetails.notifyOverAllUsers.some(
        (x) => {
          const y = _.isEqual(x, userId);

          return y;
        },
      );

      if (!isValidUser) {
        return __.out(res, 300, 'Invalid user');
      }

      const isAcknowledged =
        await notificationDetails.notifyAcknowledgedUsers.some((x) => {
          const y = _.isEqual(x, userId);

          return y;
        });

      if (isAcknowledged) {
        return __.out(res, 300, 'Already acknowledged to this notification');
      }

      await Notification.updateOne(
        {
          _id: notificationId,
        },
        {
          $addToSet: {
            notifyAcknowledgedUsers: userId,
          },
          $push: {
            userAcknowledgedAt: moment().utc().format(),
          },
          $pull: {
            notifyUnreadUsers: userId,
          },
        },
      );
      return __.out(
        res,
        201,
        'Notification has been successfully acknowledged',
      );
    } catch (err) {
      logError('userAcknowledge has error', err);
      logError('userAcknowledge has error.stack', err.stack);
      return __.out(res, 500);
    }
  }

  async download(req, res) {
    try {
      logInfo('notificationController: download', req.body);
      const { notificationId, date } = req.body;
      const requiredResult = await __.checkRequiredFields(req, [
        'notificationId',
        'date',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const notificationDetails = await Notification.findById(notificationId)
        .populate([
          {
            path: 'notifyAcknowledgedUsers',
            select: 'name staffId  appointmentId status parentBussinessUnitId',
            match: { status: 1 },
            populate: [
              {
                path: 'appointmentId',
                select: 'name',
              },
              {
                path: 'parentBussinessUnitId',
                select: 'name orgName',
              },
            ],
          },
          {
            path: 'notifyUnreadUsers',
            select: 'name staffId appointmentId status parentBussinessUnitId',
            match: { status: 1 },
            populate: [
              {
                path: 'appointmentId',
                select: 'name',
              },
              {
                path: 'parentBussinessUnitId',
                select: 'name orgName',
              },
            ],
          },
        ])
        .select(
          'title subTitle description notifyUnreadUsers notifyAcknowledgedUsers userAcknowledgedAt moduleId moduleIncluded',
        )
        .lean();

      if (!notificationDetails) {
        return __.out(res, 300, 'Invalid notification');
      }

      const jsonArray = [];
      const { title, subTitle, description } = notificationDetails;
      const unread = notificationDetails.notifyUnreadUsers;
      const unreadCount = notificationDetails.notifyUnreadUsers.length;
      const acknowledged = notificationDetails.notifyAcknowledgedUsers;
      const timeZone = moment
        .parseZone(date, 'MM-DD-YYYY HH:mm:ss Z')
        .format('Z');
      let questionTitles = [];
      // getting all notification answers
      const [notificationAnswers, questions] = await Promise.all([
        QuestionResponse.find({
          notificationId: notificationDetails._id,
        }).lean(),
        notificationDetails.moduleId
          ? await Question.find({
              moduleId: notificationDetails.moduleId,
              status: 1,
            })
              .select('options type')
              .sort({
                indexNum: 1,
              })
              .lean()
          : [],
      ]);

      // Question Options

      questionTitles = questions.map((v, i) => `Q${i + 1}`);

      const processAcknowledgedArray = async function () {
        acknowledged.forEach((ackUser, i) => {
          const json = {};

          json.title = title;
          json.subTitle = subTitle;
          json.description = description;
          json.StaffName = ackUser.name ? ackUser.name : '';
          json.StaffID = (ackUser.staffId ? ackUser.staffId : '').toString();
          json.StaffAppointment = ackUser.appointmentId
            ? ackUser.appointmentId.name
            : '';
          json.NotificationStatus = 'Acknowledged';
          json.DateOfAcknowledgement = notificationDetails.userAcknowledgedAt[i]
            ? moment
                .utc(notificationDetails.userAcknowledgedAt[i])
                .utcOffset(`${timeZone}`)
                .format('DD-MM-YYYY HH:mm:ss')
            : '';
          json[
            'Staff Parent Business Unit'
          ] = `${ackUser.parentBussinessUnitId?.orgName}`;

          if (!!questions && !!notificationAnswers.length) {
            // keep code for reference as it may require
            // const isObject = (obj) =>
            //   (typeof obj === 'object' && obj !== null) ||
            //   typeof obj === 'function';
            const formatTime = (time) => {
              if (`${time}`.includes('-')) {
                return time;
              }

              if (time) {
                return moment(time, 'HH:mm:ss').format('hh-mm-A');
              }

              return null;
            };
            const manageQuestions = notificationAnswers.filter(
              (answer) => answer.userId.toString() === ackUser._id.toString(),
            );

            questions.forEach((question, index) => {
              const manageQuestion = manageQuestions.find(
                (v) => v.questionId.toString() === question._id.toString(),
              );
              let answer = null;

              if (manageQuestion) {
                switch (question.type) {
                  case 1:
                    answer = manageQuestion.answer || '--';
                    break;

                  case 8:
                    answer = manageQuestion.answer || '--';
                    break;

                  case 9:
                    answer = manageQuestion.answer || '--';
                    break;

                  case 11:
                    answer = manageQuestion.answer || '--';
                    break;

                  case 13:
                    answer = manageQuestion.answer || '--';
                    break;

                  case 4:
                    answer = Array.isArray(manageQuestion.answer)
                      ? manageQuestion.answer[0].value || '--'
                      : manageQuestion.answer.value || '--';
                    break;

                  case 3:
                    answer = Array.isArray(manageQuestion.answer)
                      ? manageQuestion.answer[0].value || '--'
                      : manageQuestion.answer.value || '--';
                    break;

                  case 2:
                    answer = Array.isArray(manageQuestion.answer)
                      ? manageQuestion.answer[0].value || '--'
                      : manageQuestion.answer.value || '--';
                    break;

                  case 5:
                    answer =
                      manageQuestion.answer.map((a) => a.value).join(', ') ||
                      '--';
                    break;

                  case 15:
                    answer =
                      manageQuestion.answer.map((a) => a.value).join(', ') ||
                      '--';
                    break;

                  case 10:
                    answer = `${manageQuestion.answer.date || ''} ${
                      formatTime(manageQuestion.answer.time) || ''
                    }`;
                    break;

                  case 12:
                    answer = manageQuestion.answer.name || '--';
                    break;

                  case 14:
                    answer =
                      manageQuestion && manageQuestion.answer.length
                        ? manageQuestion.answer
                            .map((v) => (v.text ? v.text : v.name))
                            .join(', ')
                        : '--';
                    break;

                  case 16:
                    answer =
                      manageQuestion && manageQuestion.answer.length
                        ? manageQuestion.answer.map((v) => v.value).join(', ')
                        : '--';
                    break;

                  default:
                    answer = '--';
                    break;
                }
              }

              json[`Q${index + 1}`] = !manageQuestion ? '--' : answer;
            });
          }

          jsonArray.push(json);
        });
      };

      const processUnreadArray = async function () {
        for (let j = 0; j < unreadCount; j += 1) {
          const json1 = {};

          json1.title = title;
          json1.subTitle = subTitle;
          json1.description = description;
          json1.StaffName = unread[j].name ? unread[j].name : '';
          json1.StaffID = (
            unread[j].staffId ? unread[j].staffId : ''
          ).toString();
          json1.StaffAppointment = unread[j].appointmentId
            ? unread[j].appointmentId.name
            : '';
          json1.NotificationStatus = 'Unread';
          json1.DateOfAcknowledgement = ' ';
          json1[
            'Staff Parent Business Unit'
          ] = `${unread[j].parentBussinessUnitId.orgName}`;
          jsonArray.push(json1);
        }
      };

      await processAcknowledgedArray();
      await processUnreadArray();
      let csvLink = '';
      let fieldsArray = [
        'title',
        'subTitle',
        'description',
        'StaffName',
        'StaffID',
        'StaffAppointment',
        'NotificationStatus',
        'DateOfAcknowledgement',
        'Staff Parent Business Unit',
      ];

      fieldsArray = [...fieldsArray, ...questionTitles];
      if (jsonArray.length !== 0) {
        const fields = fieldsArray;
        const opts = { fields };
        const csv = parse(jsonArray, opts);
        const fileName = Math.random().toString(36).substr(2, 10);

        fs.writeFile(
          `./public/uploads/notificationExports/${fileName}.csv`,
          csv,
          (err) => {
            if (err) {
              logError('notificationController: download', err);
              return __.out(res, 500);
            }

            csvLink = `uploads/notificationExports/${fileName}.csv`;

            return __.out(res, 201, {
              csvLink,
            });
          },
        );
      } else {
        return __.out(res, 201, {
          csvLink,
        });
      }

      return true;
    } catch (err) {
      logError('notificationController: download', err);
      logError('notificationController: download stack', err.stack);
      return __.out(res, 500);
    }
  }

  // eslint-disable-next-line consistent-return
  async uploadContentFiles(req, res) {
    try {
      const { file } = req;

      if (!file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      __.log(file, 'fileName');
      const time = new Date().getTime();
      const fileExtension = path.extname(file.originalname);
      const storePath = `uploads/notificationAttachment/ContentFile_${time}${fileExtension}`;

      const url = `${req.protocol}://${req.get('host')}`;
      const filePath = `${url}/${storePath}`;

      fs.writeFileSync(`public/${storePath}`, file.buffer);

      const result = await __.scanFile(
        file.originalname,
        `public/uploads/notificationAttachment/ContentFile_${time}${fileExtension}`,
      );

      if (result) {
        return __.out(res, 300, result);
      }

      return res.status(201).send({
        link: filePath,
        filePath: storePath,
      });
    } catch (err) {
      __.log(err);
      return res.badRequest(err.message);
    }
  }

  async allTrackedAnswered(res, input) {
    try {
      const condition = {
        userId: input.userId,
        notificationId: input.notificationId,
      };

      logInfo('allTrackedAnswered has called', condition);
      const [trackedQuestions, questionResponses] = await Promise.all([
        TrackedQuestion.findOne(condition)
          .select({ questions: 1, questionAnswered: 1, _id: 0 })
          .lean(),
        QuestionResponse.find(condition)
          .select({ questionId: 1, option: 1, answer: 1, _id: 0 })
          .lean(),
      ]);

      if (!trackedQuestions || !questionResponses[0]) {
        return false;
      }

      // If all tracked questions answered
      if (
        !!trackedQuestions.questionAnswered ||
        trackedQuestions.questions.length === questionResponses.length
      ) {
        return true;
      }

      // get tracked question details
      const questions = await Question.find({
        _id: { $in: trackedQuestions.questions },
      }).lean();
      const nonConditionalQuestions = questions.filter(
        (q) => !q.conditionalQuestions.length,
      );

      // const conditionalQuestions = questions.filter(q => !!q.conditionalQuestions.length);
      // not even all non conditional questions answered
      if (
        nonConditionalQuestions.filter(
          (q) =>
            !questionResponses.find(
              (qr) => qr.questionId.toString() === q._id.toString(),
            ),
        ).length
      ) {
        return false;
      }

      return false;
    } catch (err) {
      logError('allTrackedAnswered has error', err);
      logError('allTrackedAnswered has error', err.stack);
      return __.out(res, 500, err.message);
    }
  }

  async allQuestionAnswered(req, res) {
    try {
      const { notificationId } = req.body;

      if (!notificationId) {
        return __.out(
          res,
          300,
          `Please provide required fields: notificationId`,
        );
      }

      const condition = {
        userId: req.user._id,
        notificationId,
      };
      const updated = await TrackedQuestion.findOneAndUpdate(condition, {
        $set: { questionAnswered: true },
      });

      if (updated) {
        return __.out(res, 201, `Updated successfully...`);
      }

      return __.out(res, 201, `Update has some issue...`);
    } catch (err) {
      return __.out(res, 500, err.message);
    }
  }
}
const notificationClass = new NotificationClass();

module.exports = notificationClass;
