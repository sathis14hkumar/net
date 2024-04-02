// Controller Code Starts here
const mongoose = require('mongoose');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const ObjectsToCsv = require('objects-to-csv');
const Channel = require('../../models/channel');
const User = require('../../models/user');
const PostCategory = require('../../models/postCategory');
const Post = require('../../models/post');
const PostView = require('../../models/wallPostView');
const PostLike = require('../../models/channelPostLike');
const PostComment = require('../../models/channelPostComment');
const __ = require('../../../helpers/globalFunctions');
const { logInfo, logError } = require('../../../helpers/logger.helper');

class ChannelClass {
  async exportReport(req, res) {
    try {
      const daysInMonth = function (month, year) {
        return new Date(year, month, 0).getDate();
      };

      const removeTags = function (str) {
        if (str === null || str === '') return '';

        str = str.toString();
        return str.replace(/(<([^>]+)>)/gi, '');
      };

      logInfo('req.body.channelId', req.body.channelId);
      const startDate = new Date(
        moment(req.body.startDate, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
      );
      const endDate = new Date(
        moment(req.body.endDate, 'MM-DD-YYYY HH:mm:ss Z').utc().format(),
      );

      const firstDay = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1,
      );
      const lastDay = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        daysInMonth(endDate.getMonth() + 1, endDate.getFullYear()),
      );

      const channelData = await Channel.findById(req.body.channelId, {
        name: 1,
        companyId: 1,
      }).populate([
        {
          path: 'companyId',
          select: 'name',
        },
        {
          path: 'userDetails.businessUnits',
          select: 'name',
          model: 'SubSection',
          populate: {
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
            },
          },
        },
      ]);
      const postData = await Post.find(
        { channelId: req.body.channelId },
        { _id: 1, teaser: 1, publishing: 1, status: 1, createdAt: 1 },
      ).lean();

      const postId = [];
      const keys = [
        'Name of channel',
        'Teaser Title',
        'Status of Article',
        'Article Creation Date',
        'Company',
        'Department',
        'Month of (count of postviews) ',
        'Year of (count of postviews)',
        'Count of __V (Postviews)',
      ];

      if (channelData && postData && postData.length > 0) {
        postData.forEach((item) => {
          postId.push(item._id);
        });
        let reportData = [];

        if (req.body.type === 'readership') {
          reportData = await PostView.aggregate([
            {
              $match: {
                postId: { $in: postId },
                createdAt: {
                  $gte: new Date(new Date(firstDay).toISOString()),
                  $lte: new Date(new Date(lastDay).toISOString()),
                },
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
              },
            },
            {
              $unwind: '$user',
            },
            {
              $group: {
                _id: {
                  postId: '$postId',
                  buId: '$user.parentBussinessUnitId',
                  year: {
                    $year: '$createdAt',
                  },
                  month: {
                    $month: '$createdAt',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ]); // {postId:{$in:postId}}, {postId:1}
        } else if (req.body.type === 'like') {
          reportData = await PostLike.aggregate([
            {
              $match: {
                postId: { $in: postId },
                isLiked: true,
                createdAt: {
                  $gte: new Date(new Date(firstDay).toISOString()),
                  $lte: new Date(new Date(lastDay).toISOString()),
                },
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
              },
            },
            {
              $unwind: '$user',
            },
            {
              $group: {
                _id: {
                  postId: '$postId',
                  buId: '$user.parentBussinessUnitId',
                  year: {
                    $year: '$createdAt',
                  },
                  month: {
                    $month: '$createdAt',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ]);
          keys[6] = 'Month of (count of postlikes) ';
          keys[7] = 'Year of (count of postlikes)';
          keys[8] = 'Count of __V (postlikes)';
        } else if (req.body.type === 'comments') {
          reportData = await PostComment.aggregate([
            {
              $match: {
                postId: { $in: postId },
                createdAt: {
                  $gte: new Date(new Date(firstDay).toISOString()),
                  $lte: new Date(new Date(lastDay).toISOString()),
                },
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
              },
            },
            {
              $unwind: '$user',
            },
            {
              $group: {
                _id: {
                  postId: '$postId',
                  buId: '$user.parentBussinessUnitId',
                  year: {
                    $year: '$createdAt',
                  },
                  month: {
                    $month: '$createdAt',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ]);
          keys[6] = 'Month of (count of postcomments) ';
          keys[7] = 'Year of (count of postcomments)';
          keys[8] = 'Count of __V (postcomments)';
        }

        if (reportData && reportData.length > 0) {
          const csvData = [];
          let buData = [];

          channelData.userDetails.forEach((item) => {
            buData = buData.concat(item.businessUnits);
          });

          const months = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
          ];

          for (let i = 0; i < reportData.length; i += 1) {
            const item = reportData[i];
            const obj = {};
            const postObj = postData.filter((pd) => {
              if (pd._id && item._id && item._id.postId) {
                return pd._id.toString() === item._id.postId.toString();
              }

              // If the condition isn't met, return false
              return false;
            });

            const buObj = buData.filter((bu) => {
              if (bu._id && item._id && item._id.buId) {
                return bu._id.toString() === item._id.buId.toString();
              }

              // If the condition isn't met, return false
              return false;
            });

            if (postObj.length > 0 && buObj.length > 0) {
              const [firstPostObj] = postObj;
              const [firstBuObj] = buObj;

              obj['Name of channel'] = channelData.name;
              obj['Teaser Title'] = removeTags(firstPostObj.teaser.title);

              let status = '';

              switch (firstPostObj.status) {
                case 2:
                  status = 'Draft';
                  break;

                case 0:
                  status = 'In Active';
                  break;

                case 1:
                  if (firstPostObj.publishing) {
                    if (moment() < moment(firstPostObj.publishing.startDate)) {
                      status = 'Pending Publication';
                    } else if (
                      moment() > moment(firstPostObj.publishing.endDate)
                    ) {
                      status = 'Expired';
                    } else if (
                      moment() < moment(firstPostObj.publishing.endDate)
                    ) {
                      status = 'Published';
                    }
                  } else {
                    status = 'In Active';
                  }

                  break;

                default:
                  break;
              }
              obj['Status of Article'] = status;
              obj['Article Creation Date'] = moment(
                firstPostObj.createdAt,
              ).format('DD-MMM-YYYY');
              obj.Company = channelData.companyId.name;
              if (firstBuObj) {
                obj.Department = firstBuObj.sectionId.departmentId.name;
              } else {
                obj.Department = '';
              }

              obj[keys[6]] = months[item._id.month - 1];
              obj[keys[7]] = item._id.year;
              obj[keys[8]] = item.count;
              csvData.push(obj);
            }
          }
          let dir = path.join(
            `${__dirname}/../../../public/uploads/challenge/report`,
          );

          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          const fileName = `/${new Date().getTime()}.csv`;

          dir += fileName;
          const csv = new ObjectsToCsv(csvData);

          await csv.toDisk(dir);
          return res.json({
            status: true,
            filePath: `uploads/challenge/report${fileName}`,
          });
        }

        return res.status(400).json({
          success: false,
          error: {
            message: 'No data found',
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          message: 'No data found',
        },
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async create(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'category',
        'assignUsers',
      ]);

      if (!requiredResult.status) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const channelExists = await Channel.findOne({
        name: req.body.name,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (channelExists) {
        return __.out(res, 300, 'Channel Name Already Exists');
      }

      const userData = await User.findOne(
        { companyId: req.user.companyId, staffId: 'admin001' },
        { _id: 1 },
      );

      req.body.assignUsers.map((user) => {
        user.authors = [];
        user.authors = user.user;
        if (!user.admin.includes(userData._id.toString())) {
          user.admin.push(userData._id);
          user.firstAdminAddedAsDefault = true;
        }

        return user;
      });
      const insertChannel = {
        name: req.body.name,
        userDetails: req.body.assignUsers,
        companyId: req.user.companyId,
        status: req.body.status,
        createdBy: req.user._id,
      };
      const newChannel = await new Channel(insertChannel).save();

      if (!newChannel) {
        return __.out(res, 301, 'Error while creating channel');
      }

      const createCategory = async function () {
        const insertPromises = req.body.category.map(async (elem) => {
          const insert = {
            name: elem.name,
            channelId: newChannel._id,
          };

          await new PostCategory(insert).save();
        });

        await Promise.all(insertPromises);
      };

      await createCategory();
      return __.out(res, 200, 'Channel Created');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async update(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'category',
        'assignUsers',
        'status',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const channelExists = await Channel.findOne({
        _id: {
          $ne: req.params.channelId,
        },
        name: req.body.name,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      });

      if (channelExists) {
        return __.out(res, 300, 'Channel Name Already Exists');
      }

      const channelData = await Channel.findOne({
        _id: req.params.channelId,
        companyId: req.user.companyId,
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      });

      if (!channelData) {
        return __.out(res, 300, 'Channel Not Found');
      }

      /** ****** GET businessUnitIds,exclusionAppointmentIds,authors ********* */
      // await getUserDetails();
      /** ****** End GET businessUnitIds,exclusionAppointmentIds,authors ********* */
      // Create Channel
      const userData = await User.findOne(
        { companyId: req.user.companyId, staffId: 'admin001' },
        { _id: 1 },
      );

      req.body.assignUsers.map((user) => {
        user.authors = [];
        user.authors = user.user;
        if (!user.admin.includes(userData._id.toString())) {
          user.admin.push(userData._id);
          user.firstAdminAddedAsDefault = true;
        }

        return user;
      });
      channelData.name = req.body.name;
      channelData.userDetails = req.body.assignUsers;
      channelData.status = req.body.status;
      const updatedChannel = await channelData.save();
      const existingCatIds = [];
      const updateCategory = async function () {
        const insertOrUpdatePromises = req.body.category.map(async (elem) => {
          if (!elem._id) {
            const insert = {
              name: elem.name,
              channelId: updatedChannel._id,
              status: req.body.status,
            };

            __.log(insert);
            const newCat = await new PostCategory(insert).save();

            existingCatIds.push(newCat._id);
          } else {
            const existCat = await PostCategory.findOne({
              _id: elem._id,
              channelId: updatedChannel._id,
            });

            if (existCat) {
              existCat.name = elem.name;
              await existCat.save();
              existingCatIds.push(elem._id);
            }
          }
        });

        await Promise.all(insertOrUpdatePromises);
      };

      await updateCategory();
      // Remove Not Listed Categories
      await PostCategory.update(
        {
          _id: {
            $nin: existingCatIds,
          },
          channelId: updatedChannel._id,
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
      return __.out(res, 200, 'Channel Updated');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async remove(req, res) {
    try {
      const where = {
        _id: req.params.channelId,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      const removedChannel = await Channel.findOneAndUpdate(
        where,
        {
          $set: {
            status: 3,
          },
        },
        {
          new: true,
        },
      ).lean();

      if (!removedChannel) {
        return __.out(res, 300, 'Channel Not Found');
      }

      return __.out(res, 201, 'Channel deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readOne(req, res) {
    try {
      logInfo('ChannelController:read', {
        userId: req.user._id,
        channelId: req.params.channelId,
      });
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        _id: req.params.channelId,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      const channelData = await Channel.findOne(
        where,
        'orgName, name status userDetails.authors, userDetails.customField userDetails.buFilterType userDetails.subSkillSets userDetails.allBuToken userDetails.allBuTokenStaffId userDetails.firstAdminAddedAsDefault',
      )
        .populate({
          path: 'userDetails.businessUnits',
          strictPopulate: false,
          select: 'orgName name status sectionId',
        })
        .populate({
          path: 'userDetails.appointments',
          strictPopulate: false,
          select: 'name status',
        })
        .populate({
          path: 'userDetails.subSkillSets',
          strictPopulate: false,
          select: 'name status',
          populate: {
            // this populate has been requested from frontEnd team , so did so
            path: 'skillSetId',
            select: '_id name',
          },
        })
        .populate({
          path: 'userDetails.authors',
          strictPopulate: false,
          select: 'name staffId',
        })
        .populate({
          path: 'userDetails.admin',
          strictPopulate: false,
          select: 'name staffId',
        });

      if (!channelData) {
        return __.out(res, 300, 'Channel Not Found');
      }

      const AssignUsers = [];

      if (channelData.userDetails) {
        channelData.userDetails.forEach((e) => {
          const BU = [];

          e.businessUnits.forEach((k) => {
            const { _id } = k;
            const obj = {
              _id,
              name: k.orgName,
            };

            BU.push(obj);
          });
          const { appointments } = e;
          const user = e.authors;
          const { admin } = e;
          const { customField } = e;
          const { buFilterType } = e;
          const { subSkillSets } = e;
          const { allBuToken } = e;
          const { allBuTokenStaffId } = e;
          const { firstAdminAddedAsDefault } = e;

          const obj1 = {
            businessUnits: BU,
            buFilterType,
            appointments,
            subSkillSets,
            user,
            admin,
            allBuToken,
            allBuTokenStaffId,
            customField,
            firstAdminAddedAsDefault,
          };

          AssignUsers.push(obj1);
        });
      }

      // Add Category List
      const categoryList = await PostCategory.find({
        channelId: channelData._id,
        status: 1,
      });
      const data = {
        _id: channelData._id,
        name: channelData.name,
        status: channelData.status,
        assignUsers: AssignUsers,
        category: categoryList,
      };

      return res.json({ data });
    } catch (err) {
      logError('ChannelController:read', {
        userId: req.user._id,
        channelId: req.params.channelId,
        err,
        stack: err.stack,
      });
      return __.out(res, 500, err);
    }
  }

  async read(req, res) {
    try {
      logInfo('ChannelController:read', { userId: req.user._id });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      const { sortWith, sortBy, page, limit, search } = req.query;
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      if (search) {
        where.$or = [
          {
            name: {
              $regex: req.query.search,
              $options: 'i',
            },
          },
        ];
      }

      let sort = {};

      if (sortWith) {
        sort = { [sortWith]: sortBy === 'asc' ? 1 : -1 };
      }

      const allCalls = [
        Channel.find(where, { name: 1, status: 1 })
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit, 10))
          .lean(),
        Channel.count(where),
      ];
      const [channels, recordsTotal] = await Promise.all(allCalls);
      const d = { recordsTotal, data: channels };

      return res.status(200).json(d);
    } catch (err) {
      logError('ChannelController:read', {
        userId: req.user._id,
        err,
        stack: err.stack,
      });
      return __.out(res, 500, err);
    }
  }

  async getChannelsForAdmin(req, res) {
    try {
      const where = {
        companyId: req.user.companyId,
        status: {
          $in: [1],
        },
        userDetails: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let channelList = await Channel.find(where).select('_id name').lean();

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
      return __.out(res, 201, channelList);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async readOneChannel(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        _id: req.body.channelId,
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };
      const channelData = await Channel.findOne(where);

      if (channelData && channelData.userDetails) {
        const userList = await this.channelUsersListFastThird(
          channelData,
          req.body.page,
          req.body.name,
        );

        return __.out(res, 201, userList);
      }

      return __.out(res, 201, []);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async channelUsersListFastThird(channelData, page = 0, name = null) {
    try {
      let totalCount = 0;

      page *= 10;
      channelData.userDetails = channelData.userDetails || [];
      let userIds = [];

      const userPromises = channelData.userDetails.map(async (elem) => {
        if (!elem.businessUnits) {
          return null; // Skip old format data
        }

        const searchQuery = {
          status: 1,
        };

        searchQuery.status = {
          $nin: [2],
        };

        if (elem.businessUnits.length > 0) {
          searchQuery.parentBussinessUnitId = {
            $in: elem.businessUnits.map((val) => mongoose.Types.ObjectId(val)),
          };
        }

        if (name) {
          searchQuery.name = {
            $regex: name.toString(),
            $options: 'ixs',
          };
        }

        const users = await User.find(searchQuery)
          .select('_id name staffId')
          .skip(page)
          .limit(10)
          .lean();

        users.forEach((user) => {
          user.name = `${user.name} (${user.staffId})`;
        });

        const countFiltered = await User.countDocuments(searchQuery);

        totalCount += countFiltered;
        return users;
      });

      const userLists = await Promise.all(userPromises);

      userLists.forEach((users) => {
        if (users) {
          userIds = [...userIds, ...users];
        }
      });

      return { users: userIds, totalCount };
    } catch (err) {
      __.log(err);
      return { users: [], totalCount: 0 };
    }
  }

  byBusinessUnitId(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          reject(err);
          // resolve([]);
        });
    });
  }

  byAppointments(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          reject(err);
          // resolve([]);
        });
    });
  }

  bySubSkillSets(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          reject(err);
          // resolve([]);
        });
    });
  }

  byUser(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          reject(err);
          // resolve([]);
        });
    });
  }

  byAdmin(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          reject(err);
          // resolve([]);
        });
    });
  }

  byCustomField(condition) {
    return new Promise((resolve, reject) => {
      User.find(condition, { name: 1, _id: 1 })
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          reject(err);
          // resolve([]);
        });
    });
  }
}
const channel = new ChannelClass();

module.exports = channel;
