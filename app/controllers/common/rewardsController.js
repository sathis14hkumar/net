const mongoose = require('mongoose');
const request = require('request');
const moment = require('moment');
const uuid = require('node-uuid');
const fs = require('fs');
const json2csv = require('json2csv').parse;
const User = require('../../models/user');
const Rewards = require('../../models/redeemedRewards');
const Wishlist = require('../../models/redeemedWishlist');
const __ = require('../../../helpers/globalFunctions');
const rewardsVouchersList = require('../../models/rewardsVouchersList');

const rewardURL = 'https://cerrapoints.com';
const Company = require('../../models/company');

const isJSON = (str) => {
  try {
    return JSON.parse(str) && !!str;
  } catch (e) {
    return false;
  }
};

class RedeemedRewardsController {
  async getRequestResponse(req, headers) {
    return new Promise((resolve, reject) => {
      request(headers, async (error, response) => {
        const jsonData = response.body;

        if (jsonData && isJSON(jsonData)) {
          const body = JSON.parse(jsonData);

          if (response.statusCode === 200) {
            resolve(body);
          } else if (body.detail === 'Invalid token.') {
            await __.regenerateCeraToken(req.user.companyId);
            reject(new Error('Something went wrong try later'));
          } else {
            reject(body);
          }
        } else {
          reject(new Error('Something went wrong try later'));
        }
      });
    });
  }

  async redemptionType(req, res) {
    try {
      const url = `${rewardURL}/rewards/api/categories/?type=${req.params.rewardType}`;
      const rewardHeaders = await __.getCeraToken(req.user.companyId);

      await this.getRequestResponse(req, {
        url,
        method: 'GET',
        headers: rewardHeaders,
      })
        .then((data) => {
          const body = data.map((x) => {
            if (x.thumbnail_img_url) {
              x.thumbnail_img_url = `${rewardURL}${x.thumbnail_img_url}`;
            }

            if (x.display_img_url) {
              x.display_img_url = `${rewardURL}${x.display_img_url}`;
            }

            x.sub_categories = x.sub_categories || [];
            x.sub_categories = x.sub_categories.map((sub) => {
              if (sub.thumbnail_img_url) {
                sub.thumbnail_img_url = `${rewardURL}${sub.thumbnail_img_url}`;
              }

              if (sub.display_img_url) {
                sub.display_img_url = `${rewardURL}${sub.display_img_url}`;
              }

              return sub;
            });
            return x;
          });

          return __.out(res, 201, body);
        })
        .catch((error) => {
          __.log(error);
          return __.out(res, 300, 'Something went wrong try later');
        });
      return __.out(res, 300, 'something went wrong');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async redemptionCategory(req, res) {
    try {
      let url = `${rewardURL}/rewards/api/rewards/?category=${req.params.rewardCategory}`;

      if (req.params.subCategory !== 'false') {
        url = `${url}&sub_category=${req.params.subCategory}`;
      }

      const rewardHeaders = await __.getCeraToken(req.user.companyId);

      await this.getRequestResponse(req, {
        url,
        method: 'GET',
        headers: rewardHeaders,
      })
        .then((data) => {
          const body = data.results.map((x) => {
            if (x.thumbnail_img_url) {
              x.thumbnail_img_url = `${rewardURL}${x.thumbnail_img_url}`;
            }

            if (x.display_img_url) {
              x.display_img_url = `${rewardURL}${x.display_img_url}`;
            }

            if (x.description) {
              x.description = __.stripeHtml(x.description);
            }

            return x;
          });

          return __.out(res, 201, body);
        })
        .catch((error) => {
          __.log(error);
          return __.out(res, 300, 'something went wrong try later');
        });
      return __.out(res, 300, 'something went wrong');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, JSON.stringify(err));
    }
  }

  async redemptionDetails(req, res) {
    try {
      const url = `${rewardURL}/rewards/api/rewards/${req.params.rewardDetails}/`;
      const rewardHeaders = await __.getCeraToken(req.user.companyId);

      await this.getRequestResponse(req, {
        url,
        method: 'GET',
        headers: rewardHeaders,
      })
        .then(async (body) => {
          if (body.thumbnail_img_url) {
            body.thumbnail_img_url = `${rewardURL}${body.thumbnail_img_url}`;
          }

          if (body.display_img_url) {
            body.display_img_url = `${rewardURL}${body.display_img_url}`;
          }

          if (body.description) {
            body.description = __.stripeHtml(body.description);
          }

          if (!!body.merchant && body.merchant.description) {
            body.merchant.description = __.stripeHtml(
              body.merchant.description,
            );
          }

          const rewardPoints = await User.find({
            _id: req.user._id,
          })
            .select('rewardPoints')
            .lean();
          const redeemPoints = rewardPoints.map((x) => x.rewardPoints);

          body.redeemPoints = redeemPoints.toString();
          if (body.quantity === null) {
            body.quantity = 1; // client request to change quantity as 1 if it is null
          }

          return __.out(res, 201, body);
        })
        .catch((error) => {
          __.log(error);
          return __.out(res, 300, error);
        });
      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async redemptionHistory(req, res) {
    try {
      const url = `${rewardURL}/finance/api/transactions/${req.params.rewardHistory}/?date=${req.params.rewardDate}`;
      const rewardHeaders = await __.getCeraToken(req.user.companyId);

      await this.getRequestResponse(req, {
        url,
        method: 'GET',
        headers: rewardHeaders,
      })
        .then((body) => {
          body = body.map((x) => {
            if (x.reward_image_url) {
              x.reward_image_url = `${rewardURL}${x.reward_image_url}`;
            }

            return x;
          });
          return __.out(res, 201, body);
        })
        .catch((error) => {
          __.log(error);
          return __.out(res, 300, 'something went wrong try later');
        });
      return __.out(res, 300, 'something went wrong');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, err);
    }
  }

  async rewardsDbHistory(req, res) {
    try {
      // const page = (!!req.query.page) ? req.query.page * 10 : 0;
      const rewardsData = await Rewards.find({
        userId: req.user._id,
        isSuccess: true,
      })
        .sort({ createdAt: -1 }) /* .skip(page).limit(10) */
        .lean();

      return __.out(res, 201, rewardsData);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Somethign went wrong try later');
    }
  }

  async rewardCategorywiseList(req, res) {
    try {
      const globalSearchList = ['Global'];
      const companyName = await Company.findOne({
        _id: req.user.companyId,
      }).select('name');

      if (companyName) {
        globalSearchList.push(companyName.name);
      }

      const voucherlist = await rewardsVouchersList.find({
        companyName: globalSearchList,
        status: {
          $ne: 'Inactive',
        },
      });

      return __.out(res, 201, voucherlist);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Somethign went wrong try later');
    }
  }

  async redemptionReward(req, res) {
    try {
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      const rewardData = req.body;
      const url = `${rewardURL}/rewards/api/rewards/${rewardData.reward}/`;
      const processRedeemption = async (data, user) => {
        const objReward = {
          reward: rewardData.reward,
          user_data: {
            email: req.user.email,
            phone: req.user.contactNumber,
          },
        };

        await this.getRequestResponse(req, {
          url,
          method: 'POST',
          headers: rewardHeaders,
          body: JSON.stringify(objReward),
        }).then(
          async (body) => {
            body.rewardId = rewardData.reward;
            if (req.user) {
              body.userId = req.user._id;
              body.userBusinessUnitId = req.user.parentBussinessUnitId;
            }

            if (body.description) {
              body.description = __.stripeHtml(body.description);
            }

            if (body.rewardId) {
              body.redemption_type = data.redemption_type;
              body.points = data.points;
              body.name = data.name;
              if (data.thumbnail_img_url) {
                body.thumbnail_img_url = `${rewardURL}${data.thumbnail_img_url}`;
              }

              if (data.display_img_url) {
                body.display_img_url = `${rewardURL}${data.display_img_url}`;
              }

              if (data.terms_and_conditions) {
                body.terms_and_conditions = data.terms_and_conditions;
              }

              if (data.merchant) {
                body['merchant.name'] = data.merchant.name;
                body['merchant.description'] = __.stripeHtml(
                  data.merchant.description,
                );
                body['merchant.website'] = data.merchant.website;
              }

              body.totalRewardPoints = user.rewardPoints || 0;
              await User.update(
                { _id: req.user._id },
                { $inc: { rewardPoints: -body.points } },
              );
              const newReward = await new Rewards(body).save();

              newReward.redeemSuccess = true;
              return __.out(res, 201, newReward);
            }

            return res.status(300).json({
              redeemSuccess: false,
              message: 'Invalid Reward id',
            });
          },
          (error) => {
            __.log(error);
            return res.status(300).json({
              redeemSuccess: false,
              message: 'Something went wrong try later',
            });
          },
        );
      };

      await this.getRequestResponse(req, {
        url,
        method: 'GET',
        headers: rewardHeaders,
      }).then(
        async (data) => {
          const rewardPoints = parseInt(data.points, 10) || 0;
          const user = await User.findById(req.user._id)
            .select('rewardPoints')
            .lean();

          if (user.rewardPoints >= rewardPoints) {
            await processRedeemption(data, user);
          } else {
            return res.status(300).json({
              redeemSuccess: false,
              message: 'Something went wrong try later',
            });
          }

          return null;
        },
        (error) => {
          __.log(error);
          return res.status(300).json({
            redeemSuccess: false,
            message: 'Something went wrong try later',
          });
        },
      );
      return __.out(res, 300, 'Something went wrong');
    } catch (error) {
      __.log(error);
      return res.status(300).json({
        redeemSuccess: false,
        message: 'Something went wrong try later',
      });
    }
  }

  async redemptionReward1(req, res) {
    try {
      const rewardHeaders = await __.getCeraToken(req.user.companyId);
      const url = `${rewardURL}/redemptions/api/redemptions/`;
      const rewardData = req.body;
      const objReward = {
        reward: rewardData.reward,
        user_data: {
          email: req.user.email,
          phone: req.user.contactNumber,
        },
      };

      await this.getRequestResponse(req, {
        url,
        method: 'POST',
        headers: rewardHeaders,
        body: JSON.stringify(objReward),
      })
        .then(async (body) => {
          body.rewardId = rewardData.reward;
          if (req.user) {
            body.userId = req.user._id;
            body.userBusinessUnitId = req.user.parentBussinessUnitId;
          }

          if (body.description) {
            body.description = __.stripeHtml(body.description);
          }

          if (body.rewardId) {
            const url1 = `${rewardURL}/rewards/api/rewards/${body.rewardId}/`;

            await this.getRequestResponse(req, {
              url1,
              method: 'GET',
              headers: rewardHeaders,
            })
              .then(async (data) => {
                body.redemption_type = data.redemption_type;
                body.points = data.points;
                body.name = data.name;
                if (data.thumbnail_img_url) {
                  body.thumbnail_img_url = `${rewardURL}${data.thumbnail_img_url}`;
                }

                if (data.display_img_url) {
                  body.display_img_url = `${rewardURL}${data.display_img_url}`;
                }

                if (data.terms_and_conditions) {
                  body.terms_and_conditions = data.terms_and_conditions;
                }

                if (data.merchant) {
                  body['merchant.name'] = data.merchant.name;
                  body['merchant.description'] = __.stripeHtml(
                    data.merchant.description,
                  );
                  body['merchant.website'] = data.merchant.website;
                }

                // Deduct points in users
                const user = await User.findById(req.user._id)
                  .select('rewardPoints')
                  .lean();

                body.totalRewardPoints = user.rewardPoints || 0;
                await User.update(
                  { _id: req.user._id },
                  { $inc: { rewardPoints: -body.points } },
                );
                const newReward = await new Rewards(body).save();

                return __.out(res, 201, newReward);
              })
              .catch(() => __.out(res, 300, 'something went wrong try later'));
          }
        })
        .catch(() => __.out(res, 300, 'something went wrong try later'));
      return __.out(res, 300, 'something went wrong');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, err);
    }
  }

  async rewardsHistory(req, res) {
    try {
      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : pageNum * limit;
      const { sortBy, sortWith } = req.query;

      const businessUnitId = req.query.businessUnit
        ? [mongoose.Types.ObjectId(req.query.businessUnit)]
        : req.user.planBussinessUnitId;
      const { search } = req.query;
      const where = {
        userBusinessUnitId: {
          $in: businessUnitId,
        },
      };

      let sortObj = {};

      if (!sortWith && !sortBy) {
        sortObj = { createdAt: -1 };
      } else {
        sortObj = { [sortWith]: sortBy === 'desc' ? -1 : 1 };
      }

      if (!search) {
        const query = [
          {
            $match: where,
          },
          {
            $sort: sortObj,
          },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
              pipeline: [
                {
                  $project: {
                    name: 1,
                    staffId: 1,
                    parentBussinessUnitId: 1,
                    _id: 0,
                  },
                },
              ],
            },
          },
          {
            $unwind: '$user',
          },
          {
            $project: {
              name: 1,
              user: 1,
              code: 1,
              points: 1,
              redemption_type: 1,
              createdAt: 1,
              totalRewardPoints: 1,
              isSuccess: 1,
            },
          },
        ];
        const [recordsTotal, rewards] = await Promise.all([
          Rewards.countDocuments(where),
          Rewards.aggregate(query),
        ]);

        return __.out(res, 201, {
          recordsTotal,
          rewards,
        });
      }

      const searchQuery = {
        $regex: search,
        $options: 'ixs',
      };
      const query = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $match: {
                  $or: [{ name: searchQuery }, { staffId: searchQuery }],
                },
              },
              {
                $project: {
                  name: 1,
                  staffId: 1,
                  parentBussinessUnitId: 1,
                  _id: 0,
                },
              },
            ],
          },
        },
        {
          $unwind: '$user',
        },
        {
          $sort: sortObj,
        },
        {
          $project: {
            name: 1,
            user: 1,
            code: 1,
            points: 1,
            redemption_type: 1,
            createdAt: 1,
            totalRewardPoints: 1,
            isSuccess: 1,
          },
        },
        {
          $facet: {
            metadata: [
              {
                $match: {
                  'user.parentBussinessUnitId': {
                    $in: businessUnitId,
                  },
                },
              },
              {
                $count: 'totalCount',
              },
            ],
            rewards: [
              {
                $match: {
                  'user.parentBussinessUnitId': {
                    $in: businessUnitId,
                  },
                },
              },
              { $skip: skip },
              { $limit: limit },
            ],
          },
        },
      ];
      const [results] = await Rewards.aggregate(query);
      const { metadata, rewards } = results;

      const recordsTotal = metadata[0].totalCount;

      return __.out(res, 201, {
        recordsTotal,
        rewards,
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async rewardsHistoryExport(req, res) {
    try {
      const headers = [
        'User Name',
        'StaffId',
        'Product',
        'Product Category',
        'Code',
        'Points',
        'Redemption Date',
        'Redemption Time',
        'TotalRewardPoints',
        'BussinessUnit',
        'Company',
        'Department',
        'Section',
        'Subsection',
      ];

      const rewards = await Rewards.aggregate([
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
          $match: {
            'user.parentBussinessUnitId': {
              $in: req.query.businessUnit
                ? [mongoose.Types.ObjectId(req.query.businessUnit)]
                : req.user.planBussinessUnitId,
            },
          },
        },
        {
          $lookup: {
            from: 'subsections',
            localField: 'user.parentBussinessUnitId',
            foreignField: '_id',
            as: 'businessUnit',
          },
        },
        {
          $unwind: '$businessUnit',
        },
        {
          $lookup: {
            from: 'sections',
            localField: 'businessUnit.sectionId',
            foreignField: '_id',
            as: 'section',
          },
        },
        {
          $unwind: '$section',
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'section.departmentId',
            foreignField: '_id',
            as: 'department',
          },
        },
        {
          $unwind: '$department',
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'department.companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        {
          $unwind: '$company',
        },
        {
          $project: {
            'user.name': 1,
            'user.staffId': 1,
            name: 1,
            code: 1,
            points: 1,
            redemption_type: 1,
            createdAt: 1,
            totalRewardPoints: 1,
            'businessUnit.name': 1,
            'section.name': 1,
            'department.name': 1,
            'company.name': 1,
          },
        },
      ]);
      const formatDate = (dateUTC) => [
        moment(dateUTC)
          .add(-req.query.timeZone, 'minutes')
          .format('YYYY-MM-DD'),
        moment(dateUTC).add(-req.query.timeZone, 'minutes').format('hh:mm:A'),
      ];
      const rowResult = rewards.map((reward) => ({
        'User Name': reward.user.name || '--',
        StaffId: reward.user.staffId || '--',
        Code: reward.code || '--',
        Product: reward.name || '--',
        'Product Category': reward.redemption_type || '--',
        Points: reward.points || '--',
        'Redemption Date': formatDate(reward.createdAt)[0],
        'Redemption Time': formatDate(reward.createdAt)[1],
        TotalRewardPoints: reward.totalRewardPoints || '--',
        BussinessUnit:
          `${reward.company.name}>${reward.department.name}>${reward.section.name}>${reward.businessUnit.name}` ||
          '--',
        Company: `${reward.company.name}`,
        Department: `${reward.department.name}`,
        Section: `${reward.section.name}`,
        Subsection: `${reward.businessUnit.name}`,
      }));
      const csv = json2csv(rowResult, headers);

      await new Promise((resolve, reject) => {
        fs.writeFile(
          `./public/uploads/reward/rewardsExport.csv`,
          csv,
          (err) => {
            if (err) {
              reject(new Error(`json2csv err${err}`));
            } else {
              resolve(true);
            }
          },
        );
      })
        .then(() =>
          __.out(res, 201, { csvLink: `uploads/reward/rewardsExport.csv` }),
        )
        .catch((error) => __.out(res, 300, error));
      return __.out(res, 300, 'Something went wrong');
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async redemptionSearch(req, res) {
    try {
      const url = `${rewardURL}/rewards/api/rewards/?q=${req.params.rewardSearch}`;
      const rewardHeaders = await __.getCeraToken(req.user.companyId);

      await this.getRequestResponse(req, {
        url,
        method: 'GET',
        headers: rewardHeaders,
      })
        .then((body) => {
          body = body.results.map((x) => {
            if (x.thumbnail_img_url) {
              x.thumbnail_img_url = `${rewardURL}${x.thumbnail_img_url}`;
            }

            return x;
          });
          return __.out(res, 201, body);
        })
        .catch((error) => {
          __.log(error);
          return __.out(res, 300, 'Something went wrong try later');
        });
      return __.out(res, 300, 'something went wrong');
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async redemptionWishlist(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'description',
        'quantity',
        'points',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const wishlist = req.body;

      if (req.user) {
        wishlist.userId = req.user._id;
      }

      const insertedwishlist = await new Wishlist(wishlist).save();

      if (!insertedwishlist)
        return __.out(res, 300, 'Error while adding wishlist');

      return __.out(res, 201, insertedwishlist);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async deleteWishlist(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, ['wishlistId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const wishlistIdResult = await Wishlist.findOne({
        _id: req.body.wishlistId,
        status: {
          $ne: 3,
        },
      });

      if (wishlistIdResult === null) {
        return __.out(res, 300, 'Invalid wishlistId');
      }

      wishlistIdResult.status = 3;
      const result = await wishlistIdResult.save();

      if (result === null) {
        return __.out(res, 300, 'Invalid wishlistId');
      }

      return __.out(res, 200, 'Wishlist deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async redemptionGamification(req, res) {
    try {
      const gamification = await User.findOne({
        _id: req.user._id,
        status: {
          $ne: 3,
        },
      })
        .select(
          'rewardPoints contactNumber profilePicture email rewardPoints staffId name companyId appointmentId',
        )
        .populate({
          path: 'appointmentId',
          select: 'name',
        });

      return __.out(res, 201, gamification);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async redemptionNew(req, res) {
    try {
      const rewardsData = await Rewards.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
          },
        },
        {
          $group: {
            _id: {
              // _id: "$_id",
              rewardId: '$rewardId',
              thumbnail_img_url: '$thumbnail_img_url',
              display_img_url: '$display_img_url',
              redemption_type: '$redemption_type',
              name: '$name',
              description: '$description',
            },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 10 },
      ]);

      __.out(res, 201, rewardsData);
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async redemptionPopular(req, res) {
    try {
      const rewardsData = await Rewards.aggregate([
        {
          $group: {
            _id: {
              rewardId: '$rewardId',
              thumbnail_img_url: '$thumbnail_img_url',
              display_img_url: '$display_img_url',
              redemption_type: '$redemption_type',
              name: '$name',
              description: '$description',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      __.out(res, 201, rewardsData);
    } catch (err) {
      __.log(err);
      __.out(
        res,
        500,
        'We are sorry, this item failed to be redeemed. kindly try again or choose another item',
      );
    }
  }

  async voucherActionRequest(credential, urlParams, uId) {
    return new Promise((resolve, reject) => {
      const body = { manual_quantity: 1, distribution_mode: 'manual' };

      request(
        {
          url: `${process.env.UNIQ_REWARD_URL}/v2/catalogs/${urlParams.product_class}/product_assets/${urlParams.order_number}/products/${urlParams.product_code}/vouchers/actions/request`,
          body: JSON.stringify(body),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Id': process.env.UNIQ_X_CLIENT_ID,
            'X-Client-Secret': process.env.UNIQ_X_CLIENT_SECRET,
            'X-Correlation-Id': uId,
            Authorization: `Bearer ${credential.access_token}`,
            token: credential.access_token,
          },
        },
        (error, response, body1) => {
          if (error) {
            reject(new Error('Invalid login!'));
          }

          try {
            resolve(body1);
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  }

  async redemptionVouchersRequest(req, res) {
    if (!req.params.productCode) {
      return __.out(res, 400, 'Product code is missing from url!');
    }

    const isProductCodeExist = await rewardsVouchersList.findOne({
      productCode: req.params.productCode,
    });

    if (!isProductCodeExist) {
      return __.out(res, 404, 'Product code does not exist!');
    }

    let uUid = uuid.v4();
    let responseBody = {
      productCode: isProductCodeExist.productCode,
      orderNumber: isProductCodeExist.orderNumber,
      productName: isProductCodeExist.productName,
      description: isProductCodeExist.description,
      points: isProductCodeExist.redeemPoints,
      display_img_url: isProductCodeExist.display_img_url,
      thumbnail_img_url: isProductCodeExist.thumbnail_img_url,
      userId: req.user._id,
      userBusinessUnitId: req.user.parentBussinessUnitId,
      name: isProductCodeExist.productName,
      uUid,
    };
    let isAPICalled = false;
    let isPreviouslyFailed = null;

    try {
      const rewardHeaders = await __.getUserToken();

      if (!rewardHeaders) {
        return __.out(res, 400, 'Something went wrong');
      }

      let date = new Date(); // today!
      const bufferDay = 1; // go back 1 day!

      date = new Date(date.setDate(date.getDate() - bufferDay));
      isPreviouslyFailed = await Rewards.findOne({
        userId: req.user._id,
        productCode: req.params.productCode,
        isSuccess: false,
        createdAt: { $gt: date },
      });
      if (isPreviouslyFailed) {
        responseBody.uUid = isPreviouslyFailed.uUid;
        uUid = isPreviouslyFailed.uUid;
      }

      isAPICalled = true;
      const requestBody = {
        product_class: 'ETX_001',
        order_number: isProductCodeExist.orderNumber,
        product_code: isProductCodeExist.productCode,
      };
      let voucherResponse = await this.voucherActionRequest(
        rewardHeaders,
        requestBody,
        uUid,
      );

      voucherResponse = JSON.parse(voucherResponse);
      if (
        voucherResponse &&
        voucherResponse.meta &&
        voucherResponse.meta.status === 'succeeded'
      ) {
        responseBody = {
          ...voucherResponse.data[0],
          ...responseBody,
          code: voucherResponse.data[0].edenred_url,
          isSuccess: true,
        };

        this.saveRewardDetail(responseBody, isPreviouslyFailed);
        return __.out(res, 201, responseBody);
      }

      responseBody = {
        ...responseBody,
        isSuccess: false,
      };
      if (!isPreviouslyFailed) {
        this.saveRewardDetailFail(responseBody);
      }

      return __.out(
        res,
        500,
        'We are sorry, this item failed to be redeemed. kindly try again or choose another item',
      );
    } catch (err) {
      __.log(err);
      if (isAPICalled) {
        responseBody = {
          ...responseBody,
          isSuccess: false,
        };
        if (!isPreviouslyFailed) {
          this.saveRewardDetailFail(responseBody);
        }
      }

      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async saveRewardDetail(requestBody, isPreviouslyFailed) {
    try {
      const reedemedPoint = await User.findOneAndUpdate(
        { _id: requestBody.userId },
        { $inc: { rewardPoints: -requestBody.points } },
      );

      if (!isPreviouslyFailed) {
        requestBody.totalRewardPoints =
          reedemedPoint.rewardPoints - requestBody.points;
        await new Rewards(requestBody).save();
      } else {
        await Rewards.updateOne({ _id: isPreviouslyFailed._id }, requestBody, {
          upsert: true,
        });
      }
    } catch (error) {
      __.log(error);
    }
  }

  async saveRewardDetailFail(requestBody) {
    try {
      await new Rewards(requestBody).save();
    } catch (error) {
      __.log(error);
    }
  }

  async saveVoucherDetail(req, res) {
    try {
      const voucherList = req.body;

      if (!voucherList || voucherList.length === 0) {
        return __.out(res, 201, 'There is no product!');
      }

      const productPayload = [];

      for (const product of voucherList) {
        if (product.productCode && product.productName && product.description) {
          productPayload.push({
            orderNumber: product.orderNumber,
            productCode: product.productCode,
            productName: product.productName,
            description: product.description,
            name: product.productName,
            // code: product.edenred_url,
            barcode: product.barcode,
            qrCode: product.qrCode,
            code: product.code,
            category: product.category,
            category_id: product.category_id,
            redeemPoints: product.redeemPoints,
            thumbnail_img_url: product.thumbnail_img_url,
            companyName: product.companyName,
            status: product.status,
            display_img_url: product.display_img_url,
            voucherCodesBalance: product.voucherCodesBalance,
            voucherCodes: product.voucherCodes,
            expiration_date: product.expiration_date,
          });
        }
      }
      await rewardsVouchersList.insertMany(productPayload);
      return __.out(res, 201, 'Product saved!');
    } catch (error) {
      __.log(error);
      return res.status(300).json({
        redeemSuccess: false,
        message: 'Something went wrong try later',
      });
    }
  }

  async getVoucherList(req, res) {
    try {
      const voucherlist = await rewardsVouchersList
        .find()
        .select('productCode productName description orderNumber');

      return __.out(res, 201, voucherlist);
    } catch (error) {
      __.log(error);
      return res.status(300).json({
        redeemSuccess: false,
        message: 'Something went wrong try later',
      });
    }
  }

  async redeemedVouchersDetails(req, res) {
    try {
      const voucherlist = await Rewards.find({
        userId: req.user._id,
        $or: [
          { rewardId: req.params.productCode },
          { productCode: req.params.productCode },
        ],
      }).select({ createdAt: 0, updatedAt: 0, __v: 0 });

      return __.out(res, 201, voucherlist);
    } catch (error) {
      __.log(error);
      return res.status(300).json({
        redeemSuccess: false,
        message: 'Something went wrong try later',
      });
    }
  }

  async redeemedRewardSaveProductDetails(req, res) {
    let requestBody = {};

    try {
      if (!req.params.productCode) {
        return __.out(res, 400, 'Product code is missing from url!');
      }

      const isProductCodeExist = await rewardsVouchersList.findOne({
        productCode: req.params.productCode,
      });

      if (!isProductCodeExist) {
        return __.out(res, 404, 'Product code does not exist!');
      }

      // const isUserExist = await Rewards.findOne({ productCode: req.params.productCode, userId: req.user._id });
      // if(isUserExist) {
      //   return __.out(res, 300, 'You have already redeemed points against this voucher. Please try another voucher.');
      // }

      if (
        isProductCodeExist.status === 'Out of Stock' ||
        !isProductCodeExist.voucherCodesBalance
      ) {
        return __.out(
          res,
          200,
          'This Voucher is Out of Stock now, please try other vouchers',
        );
      }

      const voucherCodeIndex =
        isProductCodeExist.voucherCodes.length -
        isProductCodeExist.voucherCodesBalance;

      requestBody = {
        productCode: isProductCodeExist.productCode,
        orderNumber: isProductCodeExist.orderNumber,
        productName: isProductCodeExist.productName,
        voucher_name: isProductCodeExist.productName,
        description: isProductCodeExist.description,
        points: isProductCodeExist.redeemPoints,
        display_img_url: isProductCodeExist.display_img_url,
        thumbnail_img_url: isProductCodeExist.thumbnail_img_url,
        code: isProductCodeExist.voucherCodes[voucherCodeIndex],
        name: isProductCodeExist.productName,
        category: isProductCodeExist.category,
        qrCode: isProductCodeExist.qrCode || '',
        barcode: isProductCodeExist.barcde || '',
        status: isProductCodeExist.status,
        companyName: isProductCodeExist.companyName,
        expiration_date: isProductCodeExist.expiration_date,
        companyId: req.user.companyId,
        userId: req.user._id,
        userBusinessUnitId: req.user.parentBussinessUnitId,
        isSuccess: true,
      };

      const updateBody = { $inc: { voucherCodesBalance: -1 } };

      if (isProductCodeExist.voucherCodesBalance === 1) {
        updateBody.status = 'Out of Stock';
      }

      await rewardsVouchersList.update(
        { productCode: req.params.productCode },
        updateBody,
      );
      const reedemedPoint = await User.findOneAndUpdate(
        { _id: requestBody.userId },
        { $inc: { rewardPoints: -requestBody.points } },
      );

      requestBody.totalRewardPoints =
        reedemedPoint.rewardPoints - requestBody.points;
      await new Rewards(requestBody).save();

      return __.out(res, 201, requestBody);
    } catch (err) {
      requestBody.isSuccess = false;
      await new Rewards(requestBody).save();
      __.log(err);
      return __.out(res, 300, 'something went wrong try later');
    }
  }
}

const redeemedRewards = new RedeemedRewardsController();

module.exports = redeemedRewards;
