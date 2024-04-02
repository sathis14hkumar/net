/* eslint-disable no-await-in-loop */
const mongoose = require('mongoose');
const moment = require('moment');
const { Parser } = require('json2csv');
const fs = require('fs');
const striptags = require('striptags');
const __ = require('../../../helpers/globalFunctions');
const PostCategory = require('../../models/postCategory');
const Channel = require('../../models/channel');
const Wall = require('../../models/wall');
const WallPost = require('../../models/wallPost');
const User = require('../../models/user');
const ChannelPost = require('../../models/post');
const Challenge = require('../../models/challenge');
const ChallengeLog = require('../../models/challengeLog');
const ChallengeStatus = require('../../models/challengeStatus');
const ChallengeCriteria = require('../../models/challengeCriteria');
const ChallengeStatusNonReward = require('../../models/challengeStatusNonReward');
const ChallengeCriteriaNonReward = require('../../models/challengeCriteriaNonReward');
const ManageForm = require('../../models/manageForm');
const CustomForm = require('../../models/customForms');
const Question = require('../../models/question');
const PageSettings = require('../../models/pageSetting');
const DisqualifyUser = require('../../models/disqualifyUser');
const RewardImportLog = require('../../models/rewardImportLog');
const { AssignUserRead } = require('../../../helpers/assinguserread');
const { logInfo, logError } = require('../../../helpers/logger.helper');
const { validateSearchRegex } = require('../../middleware/validators');
const ChallengeTeam = require('../../models/challengeTeam');
const { displaySelection } = require('../../models/enums');
const AgendaCron = require('../../../helpers/agendaEventHandler');

class ChallengeController {
  getChallengeStatusModel(res, flag) {
    // ChallengeStatusNonReward not using due to issue
    return flag ? ChallengeStatusNonReward : ChallengeStatus;
  }

  getChallengeCriteriaModelString(flag) {
    return flag ? 'challengecriterianonrewards' : 'challengecriterias';
  }

  getChallengeCriteriaModel(flag) {
    return flag ? ChallengeCriteriaNonReward : ChallengeCriteria;
  }

  async disqualifyUser(req, res) {
    try {
      logInfo('Challenge Controller: disqualifyUser', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { challengeId, userId } = req.body;
      let { fromDate, toDate } = req.body;
      const requiredResult = await __.checkRequiredFields(req, [
        'challengeId',
        'userId',
        'fromDate',
        'toDate',
      ]);

      if (!requiredResult.status) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const cb = (date) => new Date(moment(date).toLocaleString());

      fromDate = cb(fromDate);
      toDate = cb(toDate);
      const userExists = await DisqualifyUser.findOne({
        challengeId,
        userId,
        $or: [
          { fromDate: { $lte: fromDate }, toDate: { $gte: fromDate } },
          { fromDate: { $lte: toDate }, toDate: { $gte: toDate } },
          { fromDate: { $gte: fromDate }, toDate: { $lte: toDate } },
        ],
        status: 1,
      }).lean();

      if (userExists)
        return __.out(res, 300, 'User already exists for given date range');

      req.body.status = 1;
      req.body.fromDate = fromDate;
      req.body.toDate = toDate;
      const createData = await new DisqualifyUser(req.body).save();

      if (!createData) {
        return __.out(res, 301, 'Error while make disqualifier');
      }

      return __.out(res, 201, 'User disqualified successfully');
    } catch (err) {
      logError('Challenge Controller: disqualifyUser', err.stack);
      return __.out(res, 500, err.message);
    }
  }

  async readDisqualifier(req, res) {
    try {
      logInfo('Challenge Controller: readDisqualifier', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { start, length, skip, draw, challengeId } = req.query;

      if (!challengeId) {
        return __.out(res, 300, 'challengeId is required');
      }

      const pageNum = start ? parseInt(start, 10) : 0;
      const limit = length ? parseInt(length, 10) : 10;
      const skipNum = skip ? parseInt(skip, 10) : (pageNum * limit) / limit;
      const recordsTotal = await DisqualifyUser.find({ challengeId }).count();
      const result = await DisqualifyUser.find({
        challengeId,
        status: { $in: [0, 1] },
      })
        .populate({
          path: 'userId',
          select: 'name',
        })
        .skip(skipNum)
        .limit(limit)
        .lean();

      return res.status(201).json({
        draw: draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsTotal || 0,
        data: result,
      });
    } catch (err) {
      logError('Challenge Controller: readDisqualifier', err.stack);
      return __.out(res, 500, err.message);
    }
  }

  async deleteDisqualifier(req, res) {
    try {
      logInfo('Challenge Controller: deleteDisqualifier', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { _id } = req.query;

      if (!_id) {
        return __.out(res, 300, 'Disqualifier id is required');
      }

      await DisqualifyUser.findOneAndUpdate(
        {
          _id,
        },
        { status: 2 },
      );
      return __.out(res, 201, 'Deleted successfully');
    } catch (err) {
      logError('Challenge Controller: deleteDisqualifier', err.stack);
      return __.out(res, 500, err.message);
    }
  }

  async checkUser(res, user) {
    try {
      logInfo('CheckUser function:', { soruceUser: user._id });
      const userId = user._id;
      const [walls, channels, customForms] = await Promise.all([
        AssignUserRead.getUserInAssignedUser(user, Wall),
        AssignUserRead.getUserInAssignedUser(user, Channel, 'channel'),
        AssignUserRead.getUserInAssignedUser(user, CustomForm),
      ]);
      const allAssignedChallenges = await this.getChallengeStatusModel()
        .find(
          { userId: mongoose.Types.ObjectId(userId) },
          { challengeId: 1, _id: 0 },
        )
        .lean();
      const selectedFields = {
        _id: 1,
        selectedWall: 1,
        selectedChannel: 1,
        selectedCustomForm: 1,
        nonRewardPointSystemEnabled: 1,
      };
      const query = {
        $or: [
          { selectedChannel: { $in: channels } },
          { selectedWall: { $in: walls } },
          { selectedCustomForm: { $in: customForms } },
        ],
        status: 1,
        challengeStart: { $lte: new Date() },
        _id: {
          $nin: allAssignedChallenges.map((v) =>
            mongoose.Types.ObjectId(v.challengeId),
          ),
        },
      };

      const challenges = await Challenge.find(query, selectedFields).lean();

      const updatePromises = challenges.map((challengeInside) =>
        ChallengeStatus.findOneAndUpdate(
          { challengeId: challengeInside._id, userId },
          {
            challengeId: challengeInside._id,
            userId,
            status: true,
            totalRewardPoints: 0,
          },
          { upsert: true },
        ),
      );

      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      logError('CheckUser function:', error.stack);
      return __.out(res, 500);
    }
  }

  async addTeamToUser(userId, challenge) {
    try {
      const teamId = await this.userTeamCheck(challenge, userId);

      if (teamId) {
        await ChallengeStatus.updateOne(
          { challengeId: challenge._id, userId },
          {
            $set: {
              teamId,
            },
          },
        );
      }

      return true;
    } catch (err) {
      return false;
      // Handle the error here if needed
    }
  }

  async getPointsSummary(req, res) {
    try {
      logInfo('Challenge Controller: getPointsSummary', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      await this.checkUser(res, req.user);
      const aggregateQuery = [
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
          },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
            pipeline: [
              {
                $match: {
                  nonRewardPointSystemEnabled: false,
                },
              },
            ],
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $group: {
            _id: '$challenge.nonRewardPointSystem',
            count: { $sum: '$totalRewardPoints' },
          },
        },
      ];

      const aggregateNonQuery = [
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
          },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
            pipeline: [
              {
                $match: {
                  nonRewardPointSystemEnabled: true,
                },
              },
            ],
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $group: {
            _id: '$challenge.nonRewardPointSystem',
            count: { $sum: '$rewardPoints' },
          },
        },
      ];

      const [challengeStatusFirst, challengeNonStatus] = await Promise.all([
        this.getChallengeStatusModel()
          .aggregate(aggregateQuery)
          .allowDiskUse(true),
        ChallengeCriteriaNonReward.aggregate(aggregateNonQuery).allowDiskUse(
          true,
        ),
      ]);

      let challengeStatus = [
        {
          _id: null,
          count: challengeStatusFirst.reduce((a, b) => a + b.count, 0),
        },
      ];

      challengeStatus = [...challengeStatus, ...challengeNonStatus];

      // get active point systems
      const pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');
      let list = challengeStatus.map((status) => {
        const finder = pageSettings.pointSystems.find((pointSystem) =>
          status._id
            ? pointSystem._id.toString() === status._id.toString()
            : 'Reward points'.toUpperCase() === pointSystem.title.toUpperCase(),
        );

        status.icon = finder ? finder.icon : '';
        return status;
      });

      list = list.sort((first, second) => second.count - first.count);
      return __.out(res, 201, list);
    } catch (error) {
      logError('Challenge Controller: getPointsSummary', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async update(req, res) {
    try {
      logInfo('Challenge Controller: update', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      if (!__.checkSpecialCharacters(req.body, 'challenges')) {
        return __.out(
          res,
          301,
          "You've entered some excluded special characters",
        );
      }

      const { _id, companyId } = req.user;
      const { challenge } = req.body;
      const {
        title,
        description,
        icon,
        publishStart,
        publishEnd,
        challengeStart,
        challengeEnd,
        criteriaType,
        status,
        administrators,
        selectedChannel,
        selectedWall,
        assignUsers,
        selectedCustomForm,
        isTeam,
        teams,
        isCriteriaCategories,
        criteriaCategories,
      } = challenge;

      challenge.leaderBoard = !!challenge.leaderBoard;
      let message = null;

      if (status === 1) {
        if (!title) {
          message = 'Title is required';
        } else if (!description) {
          message = 'Description is required';
        } else if (!icon) {
          message = 'Icon is required';
        } else if (!publishStart) {
          message = 'Publish Start date and time are required';
        } else if (!publishEnd) {
          message = 'Publish end date and time are required';
        } else if (!challengeStart) {
          message = 'Challenge Start date and time are required';
        } else if (!challengeEnd) {
          message = 'Challenge end date and time are required';
        } else if (!criteriaType) {
          message = 'Select Criteria Type';
        } else if (!administrators.length) {
          message = 'Administrators is required';
        }
      } else if (!title) {
        message = 'Title is required';
      } else if (!administrators.length) {
        message = 'Administrators is required';
      }

      if (message) {
        return __.out(res, 300, message);
      }

      if (criteriaType !== 4 && !criteriaType) {
        return __.out(res, 300, 'Select Criteria Source Type');
      }

      if (criteriaType === 5) {
        if (isTeam && teams.length === 0) {
          return __.out(res, 300, 'Team is missing');
        }

        if (isCriteriaCategories && !criteriaCategories) {
          return __.out(res, 300, 'Criteria categories missing');
        }
      }

      challenge.createdBy = _id;
      challenge.companyId = companyId;
      challenge.rewardPoints = parseInt(challenge.rewardPoints || 0, 10);
      if (challenge._id) {
        const existingData = await Challenge.findOne({
          _id: challenge._id,
        }).lean();
        const updatedFields = this.checkUpdatedFields(existingData, challenge);

        if (
          challenge.criteriaType === 5 &&
          challenge.isTeam &&
          existingData.isNewType
        ) {
          if (new Date() > new Date(challenge.publishEnd)) {
            return res.error(
              'Challenge is already closed, you can not update it',
            );
          }

          AgendaCron.removeEvent(
            { _id: existingData.jobId },
            { nextRunAt: publishEnd },
          ).then((cronResult) => {
            logInfo('removeEvent result', cronResult);
          });
          const newTeam = teams.filter((team) => !team._id);
          const oldTeam = teams.filter((team) => team._id);

          const oldTeamIds = oldTeam.map((team) => team._id);
          const oldTeamUpdates = oldTeam.map((team) => ({
            updateOne: {
              filter: { _id: team._id },
              update: {
                $set: {
                  name: team.name,
                  logo: team.logo,
                  assignUsers: team.assignUsers,
                },
              },
            },
          }));

          await ChallengeTeam.bulkWrite(oldTeamUpdates);
          let allTeamIds = oldTeamIds;

          if (newTeam.length !== 0) {
            const newTeamWithAllData = newTeam.map((team) => ({
              ...team,
              challengeId: challenge._id,
              companyId: req.user.companyId,
              createdBy: req.user._id,
            }));

            const newTeamInserted = await ChallengeTeam.insertMany(
              newTeamWithAllData,
            );
            const newTeamIds = newTeamInserted.map((team) => team._id);

            allTeamIds = [...oldTeamIds, ...newTeamIds];

            await ChallengeTeam.updateMany(
              { _id: { $nin: allTeamIds } },
              { $set: { status: 0 } },
            );
          }

          challenge.teams = allTeamIds; // Set challenge.teams to an array of all active team IDs
        }

        await Challenge.findOneAndUpdate(
          { _id: challenge._id },
          {
            $set: challenge,
          },
          { new: true, runValidators: true },
        );
        challenge.challengeId = challenge._id;
        challenge.logDescription = 'Updated';
        delete challenge._id;
        /** get the users for wall/channal */
        if (status === 1) {
          let users = [];
          const promises = [];

          if (selectedChannel) {
            const channel = await Channel.findOne({ _id: selectedChannel })
              .select('userDetails createdBy')
              .lean();

            promises.push(
              AssignUserRead.read(channel.userDetails, null, channel.createdBy),
            );
          } else if (selectedWall) {
            const wall = await Wall.findOne({ _id: selectedWall })
              .select('assignUsers createdBy')
              .lean();

            promises.push(
              AssignUserRead.read(wall.assignUsers, null, wall.createdBy),
            );
          } else if (selectedCustomForm) {
            const customform = await CustomForm.findOne({
              _id: selectedCustomForm,
            })
              .select('assignUsers createdBy')
              .lean();

            promises.push(
              AssignUserRead.read(
                customform.assignUsers,
                null,
                customform.createdBy,
              ),
            );
          } else if (criteriaType === 4 && assignUsers.length) {
            promises.push(AssignUserRead.read(assignUsers, null, _id));
          }

          let challengeUsers = [];
          let userData = {};

          promises.push(
            this.getChallengeStatusModel(
              !!challenge.nonRewardPointSystemEnabled,
            )
              .find({ challengeId: challenge.challengeId })
              .select('userId')
              .lean(),
          );
          [userData, challengeUsers] = await Promise.all(promises);
          users = userData.users;
          const userIds = new Set(
            challengeUsers?.map((u) => u.userId.toString()),
          );
          const finalUsers = users?.filter((u) => !userIds.has(u.toString()));

          if (finalUsers && finalUsers.length) {
            await Promise.all(
              finalUsers.map((user) =>
                ChallengeStatus.updateOne(
                  {
                    challengeId: challenge.challengeId,
                    userId: user,
                  },
                  {
                    $setOnInsert: { status: true, totalRewardPoints: 0 },
                  },
                  { upsert: true },
                ),
              ),
            );
          } else {
            __.log('no new users found');
          }
        }

        challenge.updatedFields = updatedFields;
        new ChallengeLog(challenge)
          .save()
          .then(() => {
            logInfo('challenge log added');
          })
          .catch((err) => {
            logError('Error in challenge log addition', err.stack);
          });
        return __.out(res, 201, 'Challenge updated successfully');
      }

      return __.out(res, 300, 'challengeId is missing');
    } catch (error) {
      logError('Challenge Controller: update', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  checkUpdatedFields(existingData, requestData) {
    try {
      // Iterate over the properties of the first object

      const differentProperties = {};

      Object.keys(existingData).forEach((prop) => {
        if (
          Object.prototype.hasOwnProperty.call(existingData, prop) &&
          Object.prototype.hasOwnProperty.call(requestData, prop) &&
          existingData[prop]?.toString() !== requestData[prop]?.toString()
        ) {
          differentProperties[prop] = [existingData[prop], requestData[prop]];
        }
      });

      Object.keys(requestData).forEach((prop) => {
        if (
          Object.prototype.hasOwnProperty.call(requestData, prop) &&
          !Object.prototype.hasOwnProperty.call(existingData, prop)
        ) {
          differentProperties[prop] = [undefined, requestData[prop]];
        }
      });
      // old value -> new Value
      return differentProperties;
    } catch (e) {
      logError('checkUpdatedFields has error', e.stack);
      return {};
    }
  }

  async getAllUsersForTeams(teams) {
    try {
      logInfo('getAllUsersForTeams');
      const allCall = [];

      teams.forEach((team) => {
        allCall.push(
          AssignUserRead.read(team.assignUsers, null, team.createdBy),
        );
      });
      const result = await Promise.all(allCall);

      return result.map((user, index) => ({
        teamId: teams[index]._id,
        userIds: user.users,
      }));
    } catch (e) {
      logError('getAllUsersForTeams', e.stack);
      return null;
    }
  }

  async create(req, res) {
    try {
      logInfo('Challenge Controller: create', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      if (!__.checkSpecialCharacters(req.body, 'challenges')) {
        return __.out(
          res,
          301,
          "You've entered some excluded special characters",
        );
      }

      if ('challenge' in req.body) {
        const { challenge } = req.body;
        const {
          title,
          description,
          icon,
          publishStart,
          publishEnd,
          challengeStart,
          challengeEnd,
          criteriaType,
          administrators,
          selectedChannel,
          selectedWall,
          assignUsers,
          selectedCustomForm,
          isTeam,
          teams,
          isCriteriaCategories,
          criteriaCategories,
        } = challenge;
        let { status } = challenge;
        const { _id, companyId } = req.user;

        challenge.leaderBoard = !!challenge.leaderBoard;
        status = status || 0;
        let message = null;

        if (status === 1) {
          if (!title) {
            message = 'Title is required';
          } else if (!description) {
            message = 'Description is required';
          } else if (!icon) {
            message = 'Icon is required';
          } else if (!publishStart) {
            message = 'Publish Start date and time are required';
          } else if (!publishEnd) {
            message = 'Publish end date and time are required';
          } else if (!challengeStart) {
            message = 'Challenge Start date and time are required';
          } else if (!challengeEnd) {
            message = 'Challenge end date and time are required';
          } else if (!criteriaType) {
            message = 'Select Criteria Type';
          } else if (!administrators.length) {
            message = 'Administrators is required';
          }
        } else if (!title) {
          message = 'Title is required';
        } else if (!administrators.length) {
          message = 'Administrators is required';
        }

        if (message) {
          return __.out(res, 300, message);
        }

        if (criteriaType === 5) {
          if (isTeam && teams.length === 0) {
            return __.out(res, 300, 'Team is missing');
          }

          if (isCriteriaCategories && !criteriaCategories) {
            return __.out(res, 300, 'Criteria categories missing');
          }
        }

        challenge.createdBy = _id;
        challenge.companyId = companyId;
        challenge.isNewType = true;
        if (challenge.rewardPoints) {
          challenge.rewardPoints = parseInt(challenge.rewardPoints, 10);
        }

        if (challenge.criteriaType === 5 && challenge.isTeam) {
          const teamsArr = await ChallengeTeam.insertMany(teams);

          challenge.teams = teamsArr.map((teamId) => teamId._id);
        }

        const challengeUpdated = await new Challenge(challenge).save();

        challenge.challengeId = challengeUpdated._id;
        if (challenge.criteriaType === 5 && challenge.isTeam) {
          await ChallengeTeam.updateMany(
            { _id: { $in: challenge.teams } },
            {
              $set: {
                companyId: req.user.companyId,
                challengeId: challengeUpdated._id,
                createdBy: req.user._id,
              },
            },
          );
          // create job
          AgendaCron.addEvent(
            challengeUpdated.publishEnd,
            {
              challengeId: challengeUpdated._id,
              type: 'ChallengeReward',
            },
            true,
          )
            .then((jobResult) => {
              logInfo('Job added', jobResult.attrs);
              Challenge.updateOne(
                { _id: challengeUpdated._id },
                { $set: { jobId: jobResult.attrs._id } },
              ).then(() => {});
            })
            .catch((jobError) => {
              logError('Job add error', jobError);
            });
        }

        challenge.logDescription = 'Created';
        /** get the users for wall/channal */
        if (status === 1) {
          let users = [];

          if (selectedChannel) {
            const channel = await Channel.findOne({ _id: selectedChannel })
              .select('userDetails createdBy')
              .lean();

            users = await AssignUserRead.read(
              channel.userDetails,
              null,
              channel.createdBy,
            );
            users = users.users;
          } else if (selectedWall) {
            const wall = await Wall.findOne({ _id: selectedWall })
              .select('assignUsers createdBy')
              .lean();

            users = await AssignUserRead.read(
              wall.assignUsers,
              null,
              wall.createdBy,
            );
            users = users.users;
          } else if (selectedCustomForm) {
            const customform = await CustomForm.findOne({
              _id: selectedCustomForm,
            })
              .select('assignUsers createdBy')
              .lean();

            users = await AssignUserRead.read(
              customform.assignUsers,
              null,
              customform.createdBy,
            );
            users = users.users;
          } else if (criteriaType === 4 && assignUsers.length) {
            users = await AssignUserRead.read(assignUsers, null, _id);
            users = users.users;
          }

          if (users.length) {
            users = users.map((user) => ({
              challengeId: challenge.challengeId,
              userId: user,
              status: true,
              totalRewardPoints: 0,
            }));
            await ChallengeStatus.insertMany(users);
          }
        }

        await new ChallengeLog(challenge).save();
        return __.out(res, 201, 'Challenge created successfully');
      }

      return __.out(res, 300, 'Challenge data missing');
    } catch (err) {
      logError('Challenge Controller: create', err.stack);
      return __.out(res, 300, 'Invalid Data submitted');
    }
  }

  async getChannelOrBoardsUsers(req, res) {
    try {
      logInfo('Challenge Controller: getChannelOrBoardsUsers', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const {
        page,
        channelId,
        wallId,
        criteriaType,
        customFormId,
        questionId,
        q,
      } = req.body;
      let users = [];

      const pageNum = page ? parseInt(page, 10) * 10 : 0;

      if (channelId) {
        const channel = await Channel.findById(channelId)
          .select('userDetails createdBy')
          .lean();

        users = await AssignUserRead.read(
          channel.userDetails,
          null,
          channel.createdBy,
        );
        users = users.users;
      }

      if (wallId) {
        const wall = await Wall.findById(wallId)
          .select('assignUsers createdBy')
          .lean();

        users = await AssignUserRead.read(
          wall.assignUsers,
          null,
          wall.createdBy,
        );
        users = users.users;
      }

      if (customFormId) {
        const customform = await CustomForm.findById(customFormId)
          .select('assignUsers createdBy')
          .lean();

        users = await AssignUserRead.read(
          customform.assignUsers,
          null,
          customform.createdBy,
        );
        users = users.users;
      }

      if (questionId) {
        const questionDetails = await Question.findById(questionId)
          .select('assignUsers moduleId')
          .populate({
            path: 'moduleId',
            select: 'createdBy',
          })
          .lean();

        users = await AssignUserRead.read(
          questionDetails.assignUsers,
          null,
          questionDetails.moduleId.createdBy,
        );
        users = users.users;
      }

      const query = {};

      if (users.length) {
        query._id = {
          $in: users,
        };
      } else if (criteriaType === 3 || criteriaType === 4) {
        query.parentBussinessUnitId = {
          $in: req.user.planBussinessUnitId.map((v) =>
            mongoose.Types.ObjectId(v),
          ),
        };
      } else {
        return __.out(res, 201, { items: [], count_filtered: 0 });
      }

      if (q !== undefined && validateSearchRegex(q)) {
        query.$or = [
          {
            name: {
              $regex: q.toString(),
              $options: 'ixs',
            },
          },
          {
            staffId: {
              $regex: q.toString(),
              $options: 'ixs',
            },
          },
        ];
      }

      query.status = {
        $nin: [2],
      };
      users = await User.aggregate([
        {
          $match: query,
        },
        { $skip: pageNum },
        { $limit: 10 },
        { $project: { name: 1, _id: 1 } },
      ]).allowDiskUse(true);
      const countFiltered = await User.find(query).count();

      if (!users) {
        return __.out(res, 300, 'No users Found');
      }

      return __.out(res, 201, { items: users, count_filtered: countFiltered });
    } catch (error) {
      logError('Challenge Controller: getChannelOrBoardsUsers', error.stack);
      return __.out(res, 300, error.message);
    }
  }

  async getChannelsAndBoards(req, res) {
    try {
      logInfo('Challenge Controller: getChannelsAndBoards', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { _id, companyId } = req.user;
      /** Channels */
      let channels = await Channel.find({
        'userDetails.admin': {
          $elemMatch: {
            $eq: mongoose.Types.ObjectId(_id),
          },
        },
        status: 1,
      })
        .populate([
          {
            path: 'userDetails.admin',
            select: 'name',
          },
        ])
        .select('name');

      channels = await Promise.all(
        channels.map(async (curr) => {
          const categories = await PostCategory.find({
            channelId: curr._id.toString(),
          }).select('name');

          curr.categories = categories;
          return curr;
        }),
      );

      /** Boards */
      const boards = await Wall.find({
        'assignUsers.admin': {
          $elemMatch: {
            $eq: mongoose.Types.ObjectId(_id),
          },
        },
        status: 1,
      })
        .populate([
          {
            path: 'assignUsers.admin',
            select: 'name',
          },
          {
            path: 'category',
            select: 'categoryName',
          },
        ])
        .select('wallName')
        .lean();
      const customForms = await CustomForm.find({
        $or: [
          {
            $and: [
              {
                $or: [
                  { workflow: { $exists: false } },
                  { workflow: { $size: 0 } },
                ],
              },
            ],
            assignUsers: {
              $elemMatch: {
                admin: {
                  $in: [_id],
                },
              },
            },
          },
          {
            workflow: {
              $exists: true,
              $elemMatch: {
                admin: {
                  $in: [_id],
                },
              },
            },
          },
        ],
        status: 1,
      })
        .select('title')
        .lean();
      // get active point systems
      const pageSettings = await PageSettings.findOne({
        companyId,
        status: 1,
      }).select('pointSystems');

      if (!pageSettings.pointSystems || !pageSettings.pointSystems.length) {
        pageSettings.pointSystems = await __.initPointSystem(companyId);
      }

      pageSettings.pointSystems.splice(
        pageSettings.pointSystems.findIndex(
          (ps) => 'reward points'.toUpperCase() === ps.title.toUpperCase(),
        ),
        1,
      );

      return __.out(res, 201, {
        channels,
        boards,
        customForms,
        pointSystems: pageSettings.pointSystems
          ? pageSettings.pointSystems.filter((ps) => ps.isEnabled)
          : [],
      });
    } catch (error) {
      logError('Challenge Controller: getChannelsAndBoards', error.stack);
      return __.out(res, 300, 'Invalid Data submitted');
    }
  }

  async uploadContentFiles(req, res) {
    try {
      logInfo('Challenge Controller: uploadContentFiles', {
        soruceUser: req.user._id,
      });
      const { file, protocol } = req;

      if (!file) {
        return __.out(res, 300, 'No File is Uploaded');
      }

      const storePath = `uploads/challenge/${file.filename}`;
      const url = `${protocol}://${req.get('host')}`;
      const filePath = `${url}/${storePath}`;

      res.status(201).send({
        link: filePath,
        filePath: storePath,
      });
      const result = /* await */ __.scanFile(
        file.filename,
        `public/uploads/challenge/${file.filename}`,
      );

      if (result) {
        // return __.out(res, 300, result);
      }

      return true;
    } catch (err) {
      logError('Challenge Controller: uploadContentFiles', err.stack);
      return __.out(res, 500, err.message);
    }
  }

  async readChallenges(req, res) {
    try {
      logInfo('Challenge Controller: readChallenges', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { start, length, skip, search, order, draw } = req.query;
      const pageNum = start ? parseInt(start, 10) : 0;
      const limit = length ? parseInt(length, 10) : 10;
      const skipNum = skip ? parseInt(skip, 10) : (pageNum * limit) / limit;
      const query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        administrators: {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
        status: {
          $nin: [2],
        },
      };
      const recordsTotal = await Challenge.count(query).lean();

      if (search && search.value && validateSearchRegex(search.value)) {
        query.$or = [
          {
            title: {
              $regex: `${search.value}`,
              $options: 'ixs',
            },
          },
        ];
      }

      const recordsFiltered = await Challenge.count(query).lean();
      let sort = {};

      if (order) {
        const orderData = 'desc';
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '1':
              sort.title = getSort(orderData[i].dir);
              break;

            case '2':
              sort.status = getSort(orderData[i].dir);
              break;

            default:
              sort.createdAt = getSort(orderData[i].dir);
          }
        }
        if (!Object.keys(sort).length) {
          sort = { createdAt: -1 };
        }
      }

      const challengeData = await Challenge.find(query)
        .populate([
          {
            path: 'administrators',
            select: 'name staffId',
          },
          {
            path: 'selectedChannel',
            select: 'name',
          },
          {
            path: 'selectedWall',
            select: 'wallName',
          },
          {
            path: 'selectedCustomForm',
            select: 'title',
          },
          {
            path: 'nomineeQuestion',
            select: 'question',
          },
          {
            path: 'businessUnit',
            select: 'name status',
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
            },
          },
          {
            path: 'assignUsers.businessUnits',
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
          {
            path: 'assignUsers.admin',
            select: 'name staffId',
          },
          {
            path: 'selectedScheme',
            select: '_id schemeName',
            match: {
              status: 1,
            },
          },
        ])
        .skip(skipNum)
        .sort(sort)
        .limit(limit)
        .lean();

      // get point system data to add
      const pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');

      const arr = [];

      challengeData.forEach(async (challenge) => {
        const index = challenge.administrators.findIndex(
          (v) => v._id.toString() === req.user._id.toString(),
        );

        // append point system data
        if (
          !!challenge.nonRewardPointSystemEnabled &&
          !!challenge.nonRewardPointSystem
        ) {
          challenge.nonRewardPointSystem = pageSettings.pointSystems.find(
            (ps) =>
              ps._id.toString() === challenge.nonRewardPointSystem.toString(),
          );
        }

        challenge.isAdmin = index !== -1;
        if (challenge.criteriaType === 1 && !!challenge.selectedChannel) {
          const channel = await Channel.findById(challenge.selectedChannel)
            .select('userDetails createdBy')
            .lean();
          let users = await AssignUserRead.read(
            channel.userDetails,
            null,
            channel.createdBy,
          );

          users = users.users;
          const ind = users.findIndex(
            (v) => v.toString() === req.user._id.toString(),
          );

          if (ind !== -1) {
            arr.push(challenge);
          }
        }

        if (challenge.criteriaType === 2 && !!challenge.selectedWall) {
          const wall = await Wall.findById(challenge.selectedWall)
            .select('assignUsers createdBy')
            .lean();
          let users = await AssignUserRead.read(
            wall.assignUsers,
            null,
            wall.createdBy,
          );

          users = users.users;
          const ind = users.findIndex(
            (v) => v.toString() === req.user._id.toString(),
          );

          if (ind !== -1) {
            arr.push(challenge);
          }
        }

        if (
          challenge.isAdmin &&
          arr.findIndex(
            (v) => v._id.toString() === challenge._id.toString(),
          ) === -1
        ) {
          arr.push(challenge);
        }
      });

      const result = {
        draw: draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsFiltered || 0,
        data: arr,
      };

      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: readChallenges', error.stack);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async readChallengesSingle(req, res) {
    try {
      logInfo('Challenge Controller: readChallengesSingle', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { challengeId } = req.params;
      const query = {
        _id: challengeId,
        status: {
          $nin: [2],
        },
      };
      const challenge = await Challenge.findOne(query)
        .populate([
          {
            path: 'administrators',
            select: 'name staffId',
          },
          {
            path: 'selectedChannel',
            select: 'name',
          },
          {
            path: 'selectedWall',
            select: 'wallName',
          },
          {
            path: 'selectedCustomForm',
            select: 'title workflow',
          },
          {
            path: 'nomineeQuestion',
            select: 'question',
          },
          {
            path: 'businessUnit',
            select: 'name status',
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
            },
          },
          {
            path: 'assignUsers.businessUnits',
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
          {
            path: 'assignUsers.admin',
            select: 'name staffId',
          },
          {
            path: 'selectedScheme',
            select: '_id schemeName',
            match: {
              status: 1,
            },
          },
          {
            path: 'criteriaCategories',
            select: '_id question',
          },
          {
            path: 'displayDescription',
            select: '_id question',
          },
          {
            path: 'displayField',
            select: '_id question',
          },
          {
            path: 'teams',
            match: { status: true },
            populate: [
              {
                path: 'assignUsers.businessUnits',
                select: '_id orgName',
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
              {
                path: 'assignUsers.admin',
                select: 'name staffId',
              },
            ],
          },
        ])
        .lean();

      if (challenge.criteriaType === 5) {
        const { workflow } = challenge.selectedCustomForm;
        const { fieldOptions } = challenge;
        const matchedWorkFlow = workflow?.filter((obj1) =>
          fieldOptions.some(
            (obj2) => obj1._id.toString() === obj2.fieldOptionValue.toString(),
          ),
        );
        let result = [];

        matchedWorkFlow?.forEach((workFlow) => {
          const workflowStatus = workFlow.workflowStatus.filter((obj1) =>
            fieldOptions.some(
              (obj2) => obj1._id.toString() === obj2.formStatusValue.toString(),
            ),
          );
          const workflowStatusResult = workflowStatus?.map(
            (ws) => `${workFlow.title}-> ${ws.field}`,
          );

          result = [...result, ...workflowStatusResult];
        });
        challenge.workFlowStatusInfo = result;
        delete challenge.selectedCustomForm.workflow;
        if (
          challenge.criteriaCategories &&
          challenge.criteriaCategories.question
        ) {
          challenge.criteriaCategories.question = striptags(
            challenge.criteriaCategories.question,
          );
        }

        if (
          challenge.displayDescription &&
          challenge.displayDescription.question
        ) {
          challenge.displayDescription.question = striptags(
            challenge.displayDescription.question,
          );
        }

        if (challenge.displayField && challenge.displayField.question) {
          challenge.displayField.question = striptags(
            challenge.displayField.question,
          );
        }

        if (challenge.nomineeQuestion && challenge.nomineeQuestion.question) {
          challenge.nomineeQuestion.question = striptags(
            challenge.nomineeQuestion.question,
          );
        }
      }

      const pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');

      // append point system data
      if (
        !!challenge.nonRewardPointSystemEnabled &&
        !!challenge.nonRewardPointSystem
      ) {
        challenge.nonRewardPointSystem = pageSettings.pointSystems.find(
          (ps) =>
            ps._id.toString() === challenge.nonRewardPointSystem.toString(),
        );
      }

      const result = {
        data: challenge,
      };

      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: readChallengesSingle', error.stack);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async readChallengesNew(req, res) {
    try {
      logInfo('Challenge Controller: readChallengesNew', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { length, search, order, draw, start } = req.query;
      let { skip } = req.query;
      const pageNum = start ? parseInt(start, 10) : 0;
      const limit = length ? parseInt(length, 10) : 10;

      skip = skip ? parseInt(skip, 10) : (pageNum * limit) / limit;
      const query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        administrators: {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
        status: {
          $nin: [2],
        },
      };

      if (search && search.value && validateSearchRegex(search.value)) {
        query.$or = [
          {
            title: {
              $regex: `${search.value}`,
              $options: 'ixs',
            },
          },
        ];
      }

      let sort = {};

      if (order) {
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < order.length; i += 1) {
          const or = order[i];

          switch (or.column) {
            case '0':
              sort.publishStart = getSort(or.dir);
              break;

            case '1':
              sort.title = getSort(or.dir);
              break;

            case '2':
              sort.publishEnd = getSort(or.dir);
              break;

            default:
              sort.publishStart = getSort(or.dir);
          }
        }
        if (!Object.keys(sort).length) {
          sort = { publishStart: -1 };
        }
      }

      const [challengeData, recordsFiltered] = await Promise.all([
        Challenge.find(query).skip(skip).sort(sort).limit(limit).lean(),
        Challenge.countDocuments(query),
      ]);
      const result = {
        draw: draw || 0,
        recordsTotal: recordsFiltered || 0,
        recordsFiltered: recordsFiltered || 0,
        data: challengeData,
      };

      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: readChallengesNew', error.stack);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async read(req, res) {
    try {
      logInfo('Challenge Controller: read', { soruceUser: req.user._id });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { start, length, search, order, draw } = req.query;
      let { skip } = req.query;
      const pageNum = start ? parseInt(start, 10) : 0;
      const limit = length ? parseInt(length, 10) : 10;

      skip = skip ? parseInt(skip, 10) : (pageNum * limit) / limit;
      const searchQuery = {
        companyId: req.user.companyId,
        status: {
          $nin: [3],
        },
      };

      const recordsTotal = await Challenge.count(searchQuery).lean();
      let recordsFiltered;

      if (search && search.value !== '' && validateSearchRegex(search.value)) {
        searchQuery.$or = [
          {
            challengeTitle: {
              $regex: `${search.value}`,
              $options: 'i',
            },
          },
        ];
        recordsFiltered = await Challenge.count(searchQuery);
      } else {
        recordsFiltered = recordsTotal;
      }

      const sort = {};

      if (order) {
        const orderData = order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '1':
              sort.title = getSort(orderData[i].dir);
              break;

            case '2':
              sort.status = getSort(orderData[i].dir);
              break;

            default:
              sort.createdAt = getSort(orderData[i].dir);
          }
        }
      }

      const challengeData = await Challenge.find(searchQuery)
        .populate({
          path: 'administrators',
          select: 'name staffId',
        })
        .populate({
          path: 'businessUnit',
          select: 'name status',
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
          },
        })
        .skip(skip)
        .sort(sort)
        .limit(limit)
        .lean();

      const result = {
        draw: draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsFiltered || 0,
        data: challengeData,
      };

      return res.status(201).json(result);
    } catch (err) {
      logError('Challenge Controller: read', err.stack);
      return __.out(res, 500, err.message);
    }
  }

  async readOne(req, res) {
    try {
      logInfo('Challenge Controller: readOne', { soruceUser: req.user._id });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const searchQuery = {
        companyId: req.user.companyId,
        administrators: {
          $in: [req.user._id],
        },
        status: {
          $nin: [3],
        },
      };
      const challengeData = await Challenge.findOne(searchQuery).lean();

      if (!challengeData) {
        return __.out(res, 300, 'Challenge Not Found');
      }

      return __.out(res, 201, challengeData);
    } catch (err) {
      logError('Challenge Controller: readOne', err.stack);
      return __.out(res, 500, err.message);
    }
  }

  async exportManageChallenge(req, res) {
    try {
      logInfo('Challenge Controller: exportManageChallenge', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const {
        challengeId,
        startDate,
        endDate,
        businessUnit,
        nonRewardPointSystemEnabled,
      } = req.query;

      if (!challengeId) {
        return __.out(res, 300, 'challengeId is required');
      }

      const query = {
        challengeId: mongoose.Types.ObjectId(challengeId),
        $and: [
          { rewardPoints: { $exists: true } },
          { rewardPoints: { $gt: 0 } },
        ],
      };
      const userQuery = {
        'user.status': {
          $in: [1, 2],
        },
      };

      if (businessUnit) {
        userQuery['user.parentBussinessUnitId'] = {
          $in: [mongoose.Types.ObjectId(businessUnit)],
        };
      }

      if (startDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = query.createdAt.$gte || {};
        query.createdAt.$gte = moment(startDate, 'YYYY-MM-DD').toDate();
      }

      if (endDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = query.createdAt.$lte || {};
        query.createdAt.$lte = moment(endDate, 'YYYY-MM-DD').toDate();
      }

      const populateQuery = [
        {
          $match: query,
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
          $match: userQuery,
        },
        {
          $lookup: {
            from: 'challengeteams',
            localField: 'teamId',
            foreignField: '_id',
            as: 'teamInfo',
            pipeline: [
              {
                $project: {
                  name: 1,
                  logo: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: { path: '$teamInfo', preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: 'subsections',
            localField: 'user.parentBussinessUnitId',
            foreignField: '_id',
            as: 'subsection',
          },
        },
        {
          $unwind: '$subsection',
        },
        {
          $lookup: {
            from: 'sections',
            localField: 'subsection.sectionId',
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
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $lookup: {
            from: 'users',
            localField: 'directReward.rewardedBy',
            foreignField: '_id',
            as: 'rewardedBy',
          },
        },
        {
          $unwind: {
            path: '$rewardedBy',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            'challenge._id': 1,
            'challenge.title': 1,
            'user.staffId': 1,
            'user.name': 1,
            'company.name': 1,
            'department.name': 1,
            'section.name': 1,
            'subsection.name': 1,
            rewardPoints: 1,
            directReward: 1,
            'rewardedBy.name': 1,
            createdAt: 1,
            teamInfo: 1,
          },
        },
      ];

      let totalRecords = await this.getChallengeCriteriaModel(
        nonRewardPointSystemEnabled,
      )
        .aggregate(populateQuery)
        .allowDiskUse(true);
      const formatDate = (dateUTC) => [
        moment(dateUTC)
          .add(-req.query.timeZone, 'minutes')
          .format('YYYY-MM-DD'),
        moment(dateUTC).add(-req.query.timeZone, 'minutes').format('hh:mm:A'),
      ];

      totalRecords = totalRecords.map((d, i) => {
        const r = {
          SNo: i + 1,
          challengeTitle: d.challenge.title,
          staffId: d.user.staffId,
          name: d.user.name,
          teamName: d.teamInfo?.name,
          businessUnit: `${d.company.name} > ${d.department.name} > ${d.section.name} > ${d.subsection.name}`,
          company: d.company.name,
          department: d.department.name,
          section: d.section.name,
          subsection: d.subsection.name,
          count: d.rewardPoints,
          'RewardedAt(Date)': formatDate(d.createdAt)[0],
          'RewardedAt(Time)': formatDate(d.createdAt)[1],
          DirectRewardedBy: d.directReward ? d.rewardedBy.name || '' : '--',
        };

        return r;
      });
      const headers = [
        'SNo',
        'challengeTitle',
        'staffId',
        'name',
        'teamName',
        'businessUnit',
        'company',
        'department',
        'section',
        'subsection',
        'count',
        'RewardedAt(Date)',
        'RewardedAt(Time)',
        'DirectRewardedBy',
      ];

      const opts = { fields: headers };
      const parser = new Parser(opts);
      const csv = parser.parse(totalRecords);

      const directory = 'public/challenge';

      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      fs.writeFileSync(
        `public/challenge/${moment().format('YYYYMMDD')}.csv`,
        csv,
      );
      return __.out(res, 201, {
        csvLink: `challenge/${moment().format('YYYYMMDD')}.csv`,
      });
    } catch (error) {
      logError('Challenge Controller: exportManageChallenge', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getCountOfChallenges(req, res) {
    try {
      logInfo('Challenge Controller: getCountOfChallenges', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { challengeId, startDate, endDate, businessUnit } = req.query;
      let { nonRewardPointSystemEnabled } = req.query;
      const query = {
        challengeId: mongoose.Types.ObjectId(challengeId),
        rewardPoints: { $gt: 0 },
      };
      let userQuery = null;

      if (businessUnit) {
        userQuery = {};
        userQuery.parentBussinessUnitId = {
          $in: [mongoose.Types.ObjectId(businessUnit)],
        };
      }

      if (startDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = query.createdAt.$gte || {};
        query.createdAt.$gte = moment(startDate, 'YYYY-MM-DD').toDate();
      }

      if (endDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = query.createdAt.$lte || {};
        query.createdAt.$lte = moment(endDate, 'YYYY-MM-DD')
          .add(1, 'days')
          .toDate();
      }

      const pipeLine = [
        {
          $match: query,
        },
        {
          $group: {
            _id: '$userId',
            totalAmount: {
              $sum: '$rewardPoints',
            },
          },
        },
      ];

      if (userQuery) {
        pipeLine.push({
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $match: userQuery,
              },
              {
                $project: {
                  _id: 1.0,
                },
              },
            ],
          },
        });
        pipeLine.push({
          $unwind: '$user',
        });
      }

      pipeLine.push({
        $group: {
          _id: null,
          totalUsers: {
            $sum: 1,
          },
          totalAmount: {
            $sum: '$totalAmount',
          },
        },
      });

      nonRewardPointSystemEnabled = nonRewardPointSystemEnabled === 'true';
      const groupData = await this.getChallengeCriteriaModel(
        nonRewardPointSystemEnabled,
      ).aggregate(pipeLine);
      const result = { totalUsers: 0, totalAmount: 0 };

      if (groupData.length) {
        result.totalUsers = groupData[0].totalUsers;
        result.totalAmount = groupData[0].totalAmount;
      }

      return __.out(res, 201, result);
    } catch (error) {
      logError('Challenge Controller: getCountOfChallenges', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getUsers(businessUnit, value) {
    const userQuery = {};

    if (businessUnit) {
      userQuery.parentBussinessUnitId = mongoose.Types.ObjectId(businessUnit);
    }

    if (value && validateSearchRegex(value)) {
      userQuery.$or = ['staffId', 'name'].map((v) => {
        const obj = {};

        obj[v] = {
          $regex: `${value}`,
          $options: 'i',
        };
        return obj;
      });
    }

    const userIds = await User.find(userQuery).distinct('_id');

    return userIds;
  }

  async getTeamChallengeInfo(req, res, query, metaData) {
    try {
      const { challengeId } = query;
      const challengeInfo = await Challenge.findOne({
        _id: challengeId,
      }).lean();
      let { nonRewardPointSystemEnabled } = req.query;
      const recordsTotal = challengeInfo.teams.length;

      nonRewardPointSystemEnabled = nonRewardPointSystemEnabled === 'true';
      if (recordsTotal === 0) {
        const result = {
          draw: req.query.draw || 0,
          recordsTotal: 0 || 0,
          recordsFiltered: 0 || 0,
          data: [],
        };

        return res.status(201).json(result);
      }

      const populateQuery = [
        { $match: query },
        {
          $group: {
            _id: '$teamId',
            rewardPoints: {
              $sum: '$rewardPoints',
            },
            count: {
              $sum: 1,
            },
            createdAt: {
              $last: '$createdAt',
            },
          },
        },
        {
          $lookup: {
            from: 'challengeteams',
            localField: '_id',
            foreignField: '_id',
            as: 'teamInfo',
            pipeline: [
              {
                $project: {
                  name: 1,
                  logo: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: { path: '$teamInfo', preserveNullAndEmptyArrays: true },
        },
        {
          $project: {
            count: 1,
            teamInfo: 1,
            rewardPoints: 1,
            createdAt: 1,
          },
        },
        {
          $facet: {
            totalCount: [{ $count: 'count' }],
            paginatedResults: [
              { $skip: metaData.skip },
              { $limit: metaData.limit },
            ],
          },
        },
      ];
      const criteriaModel = this.getChallengeCriteriaModel(
        nonRewardPointSystemEnabled,
      );
      const dataResult = await criteriaModel.aggregate(populateQuery);
      const data = dataResult[0]?.paginatedResults;
      const recordsFiltered = dataResult[0]?.totalCount[0]?.count;
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsFiltered || 0,
        data: data || [],
      };

      return res.status(201).json(result);
    } catch (e) {
      logError('getTeamChallengeInfo has error', e.stack);
      return res.badRequest(e);
    }
  }

  async manageChallenge(req, res) {
    try {
      logInfo('Challenge Controller: manageChallenge', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const {
        challengeId,
        startDate,
        endDate,
        businessUnit,
        individual,
        draw,
        length,
        order,
        search,
        isTeam,
        start,
      } = req.query;
      let { skip, nonRewardPointSystemEnabled } = req.query;
      const pageNum = start ? parseInt(start, 10) : 0;
      const limit = length ? parseInt(length, 10) : 10;

      skip = skip ? parseInt(skip, 10) : (pageNum * limit) / limit;

      if (!challengeId) {
        return __.out(res, 300, 'challengeId is required');
      }

      const query = {
        challengeId: mongoose.Types.ObjectId(challengeId),
        rewardPoints: {
          $gt: 0,
        },
      };

      if (startDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = query.createdAt.$gte || {};
        query.createdAt.$gte = moment(startDate, 'YYYY-MM-DD').toDate();
      }

      if (endDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = query.createdAt.$lte || {};
        query.createdAt.$lte = moment(endDate, 'YYYY-MM-DD')
          .add(1, 'days')
          .toDate();
      }

      const sort = {};

      if (order) {
        const orderData = order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = 1;
              break;

            case '1':
              sort.name = getSort(orderData[i].dir);
              break;

            case '2':
              sort.staffId = getSort(orderData[i].dir);
              break;

            case '3':
              sort.businessUnit = getSort(orderData[i].dir);
              break;

            case '4':
              sort.count = getSort(orderData[i].dir);
              break;

            case '5':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '6':
              sort['rewardedBy.name'] = getSort(orderData[i].dir);
              break;

            default:
              sort.createdAt = getSort(orderData[i].dir);
              break;
          }
        }
      }

      if (businessUnit || (search && search.value)) {
        // get userId to pass in main query
        const userIdArr = await this.getUsers(
          businessUnit,
          req.query.search.value,
        );

        query.userId = { $in: userIdArr };
      }

      const ind = individual === 'true';
      const team = isTeam === 'true';

      nonRewardPointSystemEnabled = nonRewardPointSystemEnabled === 'true';

      if (team) {
        return await this.getTeamChallengeInfo(req, res, query, {
          limit,
          skip,
        });
      }

      const allCall = [
        ind
          ? this.getChallengeCriteriaModel(
              nonRewardPointSystemEnabled,
            ).countDocuments(query)
          : this.getChallengeCriteriaModel(
              nonRewardPointSystemEnabled,
            ).aggregate([
              { $match: query },
              {
                $group: {
                  _id: '$userId',
                },
              },
              { $count: 'total' },
            ]),
      ];

      const populateQuery = [
        { $match: query },
        {
          $group: {
            _id: ind ? '$_id' : '$userId',
            count: ind
              ? {
                  $first: '$rewardPoints',
                }
              : {
                  $sum: '$rewardPoints',
                },
            directReward: {
              $first: '$directReward',
            },
            userId: {
              $first: '$userId',
            },
            createdAt: {
              $first: '$createdAt',
            },
            directRewardBy: {
              $first: '$directReward.rewardedBy',
            },
            teamId: {
              $first: '$teamId',
            },
          },
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
        {
          $lookup: {
            from: 'challengeteams',
            localField: 'teamId',
            foreignField: '_id',
            as: 'teamInfo',
            pipeline: [
              {
                $project: {
                  name: 1,
                  logo: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: { path: '$teamInfo', preserveNullAndEmptyArrays: true },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $project: {
                  staffId: 1.0,
                  name: 1.0,
                  parentBussinessUnitId: 1.0,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$user',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'directReward.rewardedBy',
            foreignField: '_id',
            as: 'rewardedBy',
            pipeline: [
              {
                $project: {
                  name: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$rewardedBy',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            staffId: '$user.staffId',
            name: '$user.name',
            _id: '$user._id',
            parentBussinessUnitId: '$user.parentBussinessUnitId',
            rewardPoints: 1,
            directReward: 1,
            'rewardedBy.name': 1,
            createdAt: 1,
            count: 1,
            teamInfo: 1,
          },
        },
      ];

      allCall.push(
        this.getChallengeCriteriaModel(nonRewardPointSystemEnabled)
          .aggregate([
            ...populateQuery,
            {
              $lookup: {
                from: 'subsections',
                localField: 'parentBussinessUnitId',
                foreignField: '_id',
                as: 'bu',
              },
            },
            {
              $unwind: '$bu',
            },
            {
              $project: {
                _id: 1,
                count: 1,
                businessUnit: '$bu.orgName',
                staffId: 1,
                name: 1,
                directReward: 1,
                createdAt: 1,
                directRewardBy: 1,
                teamInfo: 1,
              },
            },
          ])
          .allowDiskUse(true),
      );

      const [recordsFilteredCount, totalRecords] = await Promise.all(allCall);
      let recordsFiltered = 0;

      if (ind) {
        recordsFiltered = recordsFilteredCount;
      } else if (recordsFilteredCount.length) {
        recordsFiltered = recordsFilteredCount[0].total;
      }

      const result = {
        draw: draw || 0,
        recordsTotal: recordsFiltered || 0,
        recordsFiltered: recordsFiltered || 0,
        data: totalRecords,
      };

      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: manageChallenge', error.stack);
      return __.out(res, 300, 'something went wrong try later');
    }
  }

  async userTeamCheck(challenge, userId) {
    try {
      const userInfo = await User.findOne({ _id: userId });
      const teams = await AssignUserRead.getUserInAssignedUser(
        userInfo,
        ChallengeTeam,
        challenge._id,
      );

      return teams[0];
    } catch (e) {
      logError('userTeamCheck has error', e.stack);
      return null;
    }
  }

  async triggerChallenge(res, userIdSent, postId, postType, sourceType) {
    try {
      logInfo('Challenge Controller: triggerChallenge', {
        soruceUser: userIdSent,
      });
      const setRewardsForUser = async (
        challenge,
        challengeCriteria,
        challengeStatus,
        userId,
      ) => {
        /** Criteria count w'll be triggered */
        logInfo('setRewardsForUser', { userId, challengeId: challenge._id });
        challengeCriteria.criteriaCount = 1;
        const crId = await new (this.getChallengeCriteriaModel(
          !!challenge.nonRewardPointSystemEnabled,
        ))(challengeCriteria).save();
        /** Total criteria count */
        const totalRewardPoints = challengeStatus.totalRewardPoints || 0;
        let status = true;
        let rewardPoints = 0;
        const totalCount = await this.getChallengeCriteriaModel(
          !!challenge.nonRewardPointSystemEnabled,
        ).count({
          challengeId: challengeCriteria.challengeId,
          userId: challengeCriteria.userId,
          directReward: {
            $exists: false,
          },
        });

        /** Get user */
        const user = await User.findById(userId)
          .select({ _id: 1, rewardPoints: 1 })
          .lean();

        user.rewardPoints = user.rewardPoints || 0;
        const criteriaCountType = (type) => {
          let rewardPointsP = 0;

          if (type === 1) {
            rewardPointsP = challenge.rewardPoints;
          } else if (
            type === 2 &&
            !!totalCount &&
            totalCount % challenge.criteriaCount === 0
          ) {
            rewardPointsP = challenge.rewardPoints;
          } else {
            rewardPointsP = 0;
          }

          status = !(
            challenge.stopAfterAchievement &&
            ((type === 2 && totalCount === challenge.criteriaCount) ||
              (type === 1 && !!rewardPointsP))
          );

          return { rewardPointsP, status };
        };

        const updateChallengeStatus = async (
          rewardPointsU,
          statusU,
          _id,
          totalRewardPointsU,
        ) => {
          rewardPointsU = challenge.isTeam ? 0 : rewardPointsU;
          // user.rewardPoints += rewardPointsU || 0;
          if (_id) {
            await this.getChallengeCriteriaModel(
              !!challenge.nonRewardPointSystemEnabled,
            ).updateOne({ _id }, { rewardPoints: rewardPointsU });
          }

          totalRewardPointsU += rewardPointsU;
          if (
            challenge.setLimitToMaxRewards &&
            challenge.maximumRewards < totalRewardPointsU
          ) {
            await this.getChallengeCriteriaModel(
              !!challenge.nonRewardPointSystemEnabled,
            ).findByIdAndRemove(crId._id);
            statusU = false;
            totalRewardPointsU -= rewardPointsU;
            rewardPointsU = 0;
          }

          const data = {
            totalRewardPoints: totalRewardPointsU,
            status: statusU,
          };

          __.log(data, challengeStatus._id, challengeCriteria.userId);
          await this.getChallengeStatusModel(
            !!challenge.nonRewardPointSystemEnabled,
          ).updateOne(
            { _id: challengeStatus._id, userId: challengeCriteria.userId },
            data,
          );
          if (!challenge.nonRewardPointSystemEnabled && rewardPointsU) {
            await User.updateOne(
              { _id: userId },
              { $inc: { rewardPoints: rewardPointsU } },
            );
          }
        };

        switch (challenge.criteriaSourceType) {
          case 5:
            rewardPoints = challenge.rewardPoints;
            status = false;
            break;

          default: {
            const obj = criteriaCountType(challenge.criteriaCountType);

            rewardPoints = obj.rewardPointsP;
            status = obj.status;
            break;
          }
        }
        await updateChallengeStatus(
          rewardPoints,
          status,
          crId._id,
          totalRewardPoints,
        );
      };

      /** Criteria Checking */
      const incCriteriaCount = async (challenge, challengeStatus, userId) => {
        const bool = await DisqualifyUser.findOne({
          challengeId: challenge._id,
          userId,
          fromDate: { $lte: new Date().toISOString() },
          toDate: { $gte: new Date().toISOString() },
          status: 1,
        }).lean();

        if (bool) return;

        logInfo('incCriteriaCount', { userId, challengeId: challenge._id });
        const challengeCriteria = {
          userId,
          criteriaSourceType: challenge.criteriaSourceType,
        };

        if (postType === 'wall') {
          challengeCriteria.wallPost = postId;
          challengeCriteria.challengeId = challenge._id;
        } else if (postType === 'channel') {
          challengeCriteria.challengeId = challenge._id;
          challengeCriteria.channelPost = postId;
        } else if (challenge.criteriaType === 5) {
          challengeCriteria.challengeId = challenge._id;
          challengeCriteria.manageForm = postId;
        }

        const challengeCriteriaData = await this.getChallengeCriteriaModel(
          !!challenge.nonRewardPointSystemEnabled,
        )
          .find(challengeCriteria)
          .count();

        if (challengeCriteriaData === 0) {
          if (challengeStatus) {
            await setRewardsForUser(
              challenge,
              challengeCriteria,
              challengeStatus,
              userId,
            );
          } else {
            challengeCriteria.challengeId = challenge._id;
            const challengeStatusSave = await new ChallengeStatus({
              challengeId: challenge._id,
              userId,
              status: true,
              totalRewardPoints: 0,
            }).save();

            await setRewardsForUser(
              challenge,
              challengeCriteria,
              challengeStatusSave,
              userId,
            );
          }
        }
      };

      const checkChallenge = async (challenge, userId) => {
        logInfo('checkChallenge', { userId, challengeId: challenge._id });
        const challengeId = challenge._id;
        const bool = await DisqualifyUser.findOne({
          challengeId,
          userId,
          fromDate: { $lte: new Date().toISOString() },
          toDate: { $gte: new Date().toISOString() },
          status: 1,
        }).lean();

        if (bool) return;

        const challengeStatus = await this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        )
          .findOne({
            challengeId,
            userId,
          })
          .select('status totalRewardPoints')
          .lean();

        if (challengeStatus) {
          if (challengeStatus.status) {
            await incCriteriaCount(challenge, challengeStatus, userId);
          }
        } else if (challenge.criteriaType === 5) {
          const challengeStatusSave = await new ChallengeStatus({
            challengeId: challenge._id,
            userId,
            status: true,
            totalRewardPoints: 0,
          }).save();

          await incCriteriaCount(challenge, challengeStatusSave, userId);
        }
      };

      const checkWall = async (userId) => {
        logInfo('checkWall', { userId });
        const wallPost = await WallPost.findById(postId)
          .select('wallId')
          .lean();

        if (wallPost) {
          /** Search challenges under wall id */
          const challenges = await Challenge.find({
            selectedWall: wallPost.wallId,
            challengeStart: {
              $lte: new Date(),
            },
            challengeEnd: {
              $gte: new Date(),
            },
            criteriaSourceType: sourceType,
          }).lean();

          if (!!challenges && challenges.length) {
            for (const challenge of challenges) {
              if (sourceType === 8) {
                // 8.nominated user criteria
                for (const user of userId) {
                  // userId means nominated users
                  await checkChallenge(challenge, user);
                }
              } else {
                await checkChallenge(challenge, userId);
              }
            }
          }
        }
      };

      const checkChannel = async (userId) => {
        logInfo('checkChannel', { userId });
        const channelPost = await ChannelPost.findById(postId)
          .select('channelId')
          .lean();

        if (channelPost) {
          const challenges = await Challenge.find({
            selectedChannel: channelPost.channelId,
            challengeStart: {
              $lte: new Date(),
            },
            challengeEnd: {
              $gte: new Date(),
            },
            criteriaSourceType: sourceType,
          }).lean();

          if (!!challenges && challenges.length) {
            for (const challenge of challenges) {
              await checkChallenge(challenge, userId);
            }
          }
        }
      };

      /** First login Challenge */
      const checkSystem = async (userId) => {
        logInfo('checkSystem', { userId });
        const user = await User.findById(userId).lean();

        if (user) {
          if ([5, 6].includes(sourceType)) {
            const challenges = await Challenge.find({
              challengeStart: {
                $lte: new Date(),
              },
              challengeEnd: {
                $gte: new Date(),
              },
              criteriaSourceType: sourceType,
              companyId: user.companyId,
            }).lean();

            if (!!challenges && challenges.length) {
              await Promise.all(
                challenges.map((challenge) =>
                  incCriteriaCount(challenge, null, userId),
                ),
              );
            }
          }
        }
      };
      const checkCustomForm = async () => {
        logInfo('checkCustomForm', { postId });
        const customform = await ManageForm.findById(postId)
          .select('customFormId formStatus workflowStatus questionId userId')
          .populate({
            path: 'questionId',
            select: 'questionId answer',
            populate: {
              path: 'questionId',
              select: 'type',
            },
          })
          .lean();
        const allNomineeTypeQuestions = customform.questionId.filter(
          (question) => question.questionId.type === 14,
        );

        if (
          !!customform &&
          ((!!customform.formStatus && customform.formStatus.length) ||
            (!!customform.workflowStatus && !!customform.workflowStatus.length))
        ) {
          const challenges = await Challenge.find({
            selectedCustomForm: customform.customFormId,
            challengeStart: {
              $lte: new Date(),
            },
            challengeEnd: {
              $gte: new Date(),
            },
            criteriaType: 5,
          }).lean();

          if (!!challenges && challenges.length) {
            for (const challenge of challenges) {
              logInfo('challengeFound', { challengeId: challenge._id });
              const statusFlag = challenge.fieldOptions.some((fieldOption) =>
                !!customform.formStatus && !!customform.formStatus.length
                  ? customform.formStatus.some(
                      (fs1) =>
                        fieldOption.formStatusValue?.toString() ===
                        fs1.fieldStatusValueId?.toString(),
                    )
                  : customform.workflowStatus.some(
                      (wf) =>
                        fieldOption.formStatusValue?.toString() ===
                        wf.fieldStatusId?.toString(),
                    ),
              );

              if (challenge.criteriaSourceType === 7) {
                const index = allNomineeTypeQuestions.findIndex(
                  (question) =>
                    question.questionId._id.toString() ===
                    challenge.nomineeQuestion.toString(),
                );
                const nomineeQuestionFlag = index !== -1;

                if (statusFlag && nomineeQuestionFlag) {
                  for (const user of allNomineeTypeQuestions[index].answer) {
                    await checkChallenge(challenge, user._id);
                  }
                } else {
                  logInfo(
                    `statusFlag ${statusFlag} nomineeflag ${nomineeQuestionFlag}`,
                  );
                }
              } else if (challenge.criteriaSourceType === 6 && statusFlag) {
                await checkChallenge(challenge, customform.userId);
              }
            }
          }
        } else {
          logInfo('checkCustomForm data not match', JSON.stringify(customform));
        }
      };

      switch (postType) {
        case 'wall':
          await checkWall(userIdSent);
          break;

        case 'channel':
          await checkChannel(userIdSent);
          break;

        case 'system':
          await checkSystem(userIdSent);
          break;

        case 'customform':
          await checkCustomForm();
          break;

        default:
          break;
      }
      return true;
    } catch (error) {
      logError('Challenge Controller: triggerChallenge', error.stack);
      return false;
    }
  }

  async getChallengeUsers(req, res) {
    try {
      logInfo('Challenge Controller: getChallengeUsers', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      let { page } = req.body;
      const { challengeId, q } = req.body;

      page = page ? parseInt(page, 10) - 1 : 0;

      let userIds = [];
      const {
        criteriaType,
        selectedChannel,
        selectedWall,
        selectedCustomForm,
        assignUsers,
        createdBy,
      } = await Challenge.findById(challengeId)
        .select(
          'criteriaType selectedChannel selectedCustomForm selectedWall assignUsers createdBy',
        )
        .lean();

      switch (criteriaType) {
        case 1: {
          const channel = await Channel.findById(selectedChannel)
            .select('userDetails createdBy')
            .lean();

          userIds = await AssignUserRead.read(
            channel.userDetails,
            null,
            channel.createdBy,
          );
          userIds = userIds.users;
          break;
        }

        case 2: {
          const wall = await Wall.findById(selectedWall)
            .select('assignUsers createdBy')
            .lean();

          userIds = await AssignUserRead.read(
            wall.assignUsers,
            null,
            wall.createdBy,
          );
          userIds = userIds.users;
          break;
        }

        case 4:
          userIds = await AssignUserRead.read(assignUsers, null, createdBy);
          userIds = userIds.users;
          break;

        case 5: {
          const customform = await CustomForm.findById(selectedCustomForm)
            .select('assignUsers createdBy')
            .lean();

          userIds = await AssignUserRead.read(
            customform.assignUsers,
            null,
            customform.createdBy,
          );
          userIds = userIds.users;
          break;
        }

        default:
          break;
      }
      const query = {
        status: {
          $in: [1], // active users only
        },
        _id: {
          $in: userIds || [],
        },
      };

      if (q && validateSearchRegex(q)) {
        query.$or = [
          {
            name: {
              $regex: q.toString(),
              $options: 'i',
            },
          },
          {
            staffId: {
              $regex: q.toString(),
              $options: 'i',
            },
          },
        ];
      }

      let finalUsers = await User.find(query)
        .skip(page * 10)
        .limit(10)
        .select('name staffId')
        .lean();

      finalUsers = finalUsers.map((user) => ({
        _id: user._id,
        name: `${user.name} - (${user.staffId})`,
      }));
      const countFiltered = await User.count(query).lean();

      return __.out(res, 201, {
        items: finalUsers,
        count_filtered: countFiltered,
      });
    } catch (error) {
      logError('Challenge Controller: getChallengeUsers', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getChallengesAndUsers(req, res) {
    try {
      logInfo('Challenge Controller: getChallengesAndUsers', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      let { page } = req.body;
      const { q } = req.body;

      page = page ? parseInt(page, 10) * 10 : 0;
      const query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };

      if (q !== undefined && validateSearchRegex(q)) {
        query.title = {
          $regex: q.toString(),
          $options: 'ixs',
        };
      }

      query.status = {
        $nin: [0, 2],
      };
      const challenges = await Challenge.aggregate([
        {
          $match: query,
        },
        { $skip: page },
        { $limit: 10 },
        { $project: { title: 1, _id: 1, selectedWall: 1, selectedChannel: 1 } },
      ]).allowDiskUse(true);
      const countFiltered = await User.find(query).count();

      for (const challenge of challenges) {
        let users = [];

        if (challenge.selectedWall) {
          const wall = await Wall.findById(challenge.selectedWall)
            .select('assignUsers createdBy')
            .lean();

          users = await AssignUserRead.read(
            wall.assignUsers,
            { name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
            wall.createdBy,
          );
          users = users.users;
        } else if (challenge.selectedChannel) {
          const channel = await Channel.findById(challenge.selectedChannel)
            .select('userDetails createdBy')
            .lean();

          users = await AssignUserRead.read(
            channel.userDetails,
            { name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
            channel.createdBy,
          );
          users = users.users;
        }

        challenge.users = users;
      }
      return __.out(res, 201, {
        items: challenges || [],
        count_filtered: countFiltered,
      });
    } catch (error) {
      logError('Challenge Controller: getChallengesAndUsers', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getChallengesLog(req, res) {
    try {
      logInfo('Challenge Controller: getChallengesLog', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { draw, length, order, search } = req.query;
      let { skip } = req.query;
      const pageNum = draw ? parseInt(draw, 10) : 0;
      const limit = length ? parseInt(length, 10) : 10;

      skip = skip ? parseInt(skip, 10) : (pageNum - 1) * limit;
      const query = {
        administrators: {
          $in: [mongoose.Types.ObjectId(req.user._id)],
        },
      };
      const sort = { createdAt: -1 };

      if (order) {
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < order.length; i += 1) {
          switch (order[i].column) {
            case '0':
              sort['user.name'] = getSort(order[i].dir);
              break;

            case '1':
              sort.createdAt = getSort(order[i].dir);
              break;

            case '2':
              sort.title = getSort(order[i].dir);
              break;

            default:
              sort.description = getSort(order[i].dir);
              break;
          }
        }
      }

      if (search) {
        if (search.value && validateSearchRegex(search.value)) {
          const searchCondition = {
            $regex: `${search.value}`,
            $options: 'i',
          };

          query.$or = [
            {
              title: searchCondition,
            },
            {
              logDescription: searchCondition,
            },
          ];
        }
      }

      if (!Object.keys(sort).length) {
        sort.createdAt = -1;
      }

      const populateQuery = [
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
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $project: {
                  name: 1,
                  staffId: 1,
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
            user: 1,
            title: 1,
            createdAt: 1,
            description: 1,
            logDescription: 1,
            _id: '$challengeId',
          },
        },
      ];
      const filteredRecordsPromise = ChallengeLog.countDocuments(query);
      const dataPromise = ChallengeLog.aggregate(populateQuery);

      const [filteredRecords, data] = await Promise.all([
        filteredRecordsPromise,
        dataPromise,
      ]);
      // console.log(data)
      const result = {
        draw: draw || 0,
        recordsTotal: filteredRecords || 0,
        recordsFiltered: filteredRecords || 0,
        data,
      };

      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: getChallengesLog', error.stack);
      return __.out(res, 201, 'Something went wrong try later');
    }
  }

  async readChallengeCriteriaLog(req, res) {
    try {
      logInfo('Challenge Controller: readChallengeCriteriaLog', {
        soruceUser: req.user._id,
      });
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { draw, length, search, order } = req.query;
      let { skip } = req.query;
      const pageNum = draw ? parseInt(draw, 10) : 0;
      const limit = length ? parseInt(length, 10) : 10;

      skip = skip ? parseInt(skip, 10) : (pageNum - 1) * limit;

      const query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        status: {
          $nin: [3],
        },
      };
      const aggregateQuery = [
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
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $lookup: {
            from: 'wallposts',
            localField: 'wallPost',
            foreignField: '_id',
            as: 'wallPost',
          },
        },
        {
          $unwind: '$wallPost',
        },
        {
          $lookup: {
            from: 'posts',
            localField: 'channelPost',
            foreignField: '_id',
            as: 'post',
          },
        },
        {
          $unwind: '$post',
        },
      ];

      const totalRecords = await this.getChallengeCriteriaModel()
        .aggregate([
          { $match: query },
          ...aggregateQuery,
          { $group: { _id: null, count: { $sum: 1 } } },
        ])
        .allowDiskUse(true);

      if (search && search.value && validateSearchRegex(search.value)) {
        const searchCondition = {
          $regex: `${search.value}`,
          $options: 'i',
        };

        query.$or = [
          {
            'user.name': searchCondition,
          },
          {
            'challenge.title': searchCondition,
          },
          {
            'wallPost.title': searchCondition,
          },
          {
            'post.wallName': searchCondition,
          },
        ];
      }

      const sort = {};
      const orderData = order;

      if (order) {
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '1':
              sort['user.name'] = getSort(orderData[i].dir);
              break;

            case '2':
              sort['challenge.title'] = getSort(orderData[i].dir);
              break;

            case '3':
              sort['wallPost.title'] = getSort(orderData[i].dir);
              break;

            case '4':
              sort['post.wallName'] = getSort(orderData[i].dir);
              break;

            default:
              sort.status = getSort(orderData[i].dir);
              break;
          }
        }
      }

      if (!Object.keys(sort).length) {
        sort.createdAt = -1;
      }

      const filteredRecords = await this.getChallengeCriteriaModel()
        .aggregate([
          ...aggregateQuery,
          { $match: query },
          { $group: { _id: null, count: { $sum: 1 } } },
        ])
        .allowDiskUse(true);

      const challengeCriteriaLog = await this.getChallengeCriteriaModel()
        .aggregate([
          ...aggregateQuery,
          { $match: query },
          {
            $project: {
              'user.name': 1,
              'challenge.title': 1,
              'wallPost.title': 1,
              'post.wallName': 1,
              criteriaSourceType: 1,
              criteriaCount: 1,
              status: 1,
              createdAt: 1,
            },
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
        ])
        .allowDiskUse(true);
      const result = {
        draw: draw || 0,
        recordsTotal: totalRecords.length ? totalRecords[0].count : 0,
        recordsFiltered: filteredRecords.length ? filteredRecords[0].count : 0,
        data: challengeCriteriaLog,
      };

      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: readChallengeCriteriaLog', error.stack);
      return __.out(res, 300, { error: error.message });
    }
  }

  async appListOfChallenge(req, res) {
    try {
      logInfo('Challenge Controller: appListOfChallenge', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      const { isProgressType } = req.query;

      if (isProgressType === 'true') {
        const aggregateQuery = [
          {
            $match: {
              userId: mongoose.Types.ObjectId(req.user._id),
              status: true,
            },
          },
          {
            $sort: { _id: -1 },
          },
          {
            $project: { challengeId: 1, _id: 0, totalRewardPoints: 1 },
          },
          {
            $lookup: {
              from: 'challenges',
              localField: 'challengeId',
              foreignField: '_id',
              as: 'challenge',
              pipeline: [
                {
                  $match: {
                    $or: [
                      { isProgressStatusSetup: true },
                      { leaderBoard: true },
                    ],
                  },
                },
              ],
            },
          },
          {
            $unwind: '$challenge',
          },
          {
            $project: {
              _id: '$challenge._id',
              'challenge._id': 1,
              'challenge.title': 1,
              'challenge.criteriaCount': 1,
              'challenge.leaderBoard': 1,
              'challenge.description': 1,
              'challenge.criteriaType': 1,
              'challenge.challengeEnd': 1,
              'challenge.challengeStart': 1,
              'challenge.rewardPoints': 1,
              'challenge.criteriaSourceType': 1,
              'challenge.stopAfterAchievement': 1,
              'challenge.setLimitToMaxRewards': 1,
              'challenge.maximumRewards': 1,
              'challenge.icon': 1,
              'challenge.criteriaCountType': 1,
              'challenge.nonRewardPointSystem': 1,
              'challenge.nonRewardPointSystemEnabled': 1,
              updatedAt: 1,
              totalRewardPoints: 1,
              title: '$challenge.title',
              description: '$challenge.description',
              leaderBoard: '$challenge.leaderBoard',
              isTeam: '$challenge.isTeam',
              isProgressStatusSetup: '$challenge.isProgressStatusSetup',
              progressType: '$challenge.progressType',
              icon: '$challenge.icon',
            },
          },
        ];
        const challengeStatus = await ChallengeStatus.aggregate(aggregateQuery);

        return res.success(challengeStatus);
      }

      await this.checkUser(res, req.user);

      const aggregateQuery = [
        {
          $match: { userId: mongoose.Types.ObjectId(req.user._id) },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $match: {
            'challenge.publishStart': {
              $lte: new Date(),
            },
            'challenge.publishEnd': {
              $gte: new Date(),
            },
          },
        },
        {
          $sort: { _id: -1 },
        },
        {
          $project: {
            totalRewardPoints: 1,
            'challenge._id': 1,
            'challenge.title': 1,
            'challenge.criteriaCount': 1,
            'challenge.leaderBoard': 1,
            'challenge.description': 1,
            'challenge.criteriaType': 1,
            'challenge.challengeEnd': 1,
            'challenge.challengeStart': 1,
            'challenge.rewardPoints': 1,
            'challenge.criteriaSourceType': 1,
            'challenge.stopAfterAchievement': 1,
            'challenge.setLimitToMaxRewards': 1,
            'challenge.maximumRewards': 1,
            'challenge.icon': 1,
            'challenge.criteriaCountType': 1,
            'challenge.nonRewardPointSystem': 1,
            'challenge.nonRewardPointSystemEnabled': 1,
            updatedAt: 1,
          },
        },
      ];

      let challengeStatus = await ChallengeStatus.aggregate(aggregateQuery);

      const pageSettings = await PageSettings.findOne({
        companyId: req.user.companyId,
        status: 1,
      }).select('pointSystems');
      const finderIcon = pageSettings.pointSystems.find(
        (ps) => ps.title.toUpperCase() === 'Reward points'.toUpperCase(),
      );

      challengeStatus = challengeStatus.map((v) => {
        if (
          !!v.challenge.nonRewardPointSystemEnabled &&
          !!v.challenge.nonRewardPointSystem
        ) {
          const finder = pageSettings.pointSystems.find(
            (ps) =>
              ps._id.toString() === v.challenge.nonRewardPointSystem.toString(),
          );

          if (finder) {
            v.challenge.rewardPoints = `${v.challenge.rewardPoints} ${finder.title}`;
            v.challenge.rewardPointsIcon = finder.icon;
          }
        } else if (finderIcon) {
          v.challenge.rewardPoints = `${v.challenge.rewardPoints} Reward points`;
          v.challenge.rewardPointsIcon = finderIcon.icon;
        }

        v.totalRewardPoints = v.totalRewardPoints || 0;
        return v;
      });
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      logError('Challenge Controller: appListOfChallenge', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async appListOfAchievements(req, res) {
    try {
      logInfo('Challenge Controller: appListOfAchievements', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      await this.triggerChallenge(res, req.user._id, null, 'system', 5);
      const { earnings } = req.query;
      const aggregateQuery = [
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
            totalRewardPoints: {
              $gt: 0,
            },
          },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $match: {
            $or: [
              {
                'challenge.nonRewardPointSystemEnabled': {
                  $in: earnings ? [false] : [true, false],
                },
              },
              { 'challenge.nonRewardPointSystemEnabled': { $exists: false } },
            ],
            'challenge.challengeStart': {
              $lte: new Date(),
            },
          },
        },
        {
          $sort: { _id: -1 },
        },
        {
          $project: {
            totalRewardPoints: 1,
            'challenge.nonRewardPointSystemEnabled': 1,
            'challenge._id': 1,
            'challenge.title': 1,
            'challenge.criteriaCount': 1,
            'challenge.leaderBoard': 1,
            'challenge.description': 1,
            'challenge.challengeEnd': 1,
            'challenge.challengeStart': 1,
            'challenge.rewardPoints': 1,
            'challenge.criteriaType': 1,
            'challenge.criteriaSourceType': 1,
            'challenge.stopAfterAchievement': 1,
            'challenge.setLimitToMaxRewards': 1,
            'challenge.maximumRewards': 1,
            'challenge.icon': 1,
            'challenge.criteriaCountType': 1,
            updatedAt: 1,
            'challenge.ranks': 1,
          },
        },
      ];
      let challengeStatus = await this.getChallengeStatusModel()
        .aggregate(aggregateQuery)
        .allowDiskUse(true);

      challengeStatus = challengeStatus.sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      challengeStatus = challengeStatus.map((v) => {
        v.challenge.ranks = v.challenge.ranks || [];
        if (![1, 2, 5].includes(v.challenge.criteriaType)) {
          v.challenge.ranks = [];
        }

        return v;
      });
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      logError('Challenge Controller: appListOfAchievements', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async appListOfRanks(req, res) {
    try {
      logInfo('Challenge Controller: appListOfRanks', {
        soruceUser: req.user._id,
        body: req.body,
      });
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, "You've entered malicious input");
      }

      let { challengeId } = req.query;
      const { page } = req.query;

      if (challengeId) {
        const skip = page ? (parseInt(page, 10) - 1) * 10 : 0;
        const isLeaderBoardChallenge = await Challenge.findOne(
          {
            _id: challengeId,
            leaderBoard: true,
          },
          { _id: 1 },
        ).lean();

        if (!isLeaderBoardChallenge) {
          return __.out(res, 201, []);
        }

        // commented code is for reference
        challengeId = mongoose.Types.ObjectId(challengeId);
        const aggregateQuery = [
          {
            $match: {
              challengeId,
            },
          },
          // {
          //   $group: {
          //     _id: '$totalRewardPoints',
          //     rewardPoints: { $first: '$totalRewardPoints' },
          //     users: { $addToSet: '$user' },
          //     // challenge: { $addToSet: '$challenge' },
          //     count: { $sum: 1 },
          //   },
          // },
          // {
          //   $project: {
          //     _id: 0,
          //     rewardPoints: 1,
          //     'users.name': 1,
          //     'users.profilePicture': 1,
          //     // challenge: 1,
          //   },
          // },
          {
            $sort: { totalRewardPoints: -1 },
          },
          { $skip: skip },
          {
            $limit: 10,
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
              pipeline: [
                {
                  $match: {
                    status: {
                      $in: [0, 1],
                    },
                  },
                },
                {
                  $project: {
                    name: 1,
                    _id: 0,
                    profilePicture: 1,
                  },
                },
              ],
            },
          },
          // {
          //   $unwind: '$user',
          // },
          {
            $project: {
              _id: 0,
              rewardPoints: '$totalRewardPoints',
              users: '$user',
              // challenge: 1,
            },
          },
        ];

        let ranks = await ChallengeStatus.aggregate(
          aggregateQuery,
        ).allowDiskUse(true);

        // return res.send(ranks);
        ranks = ranks.reduce((prev, curr, i) => {
          const users = curr.users.map((u) => {
            u.rewardPoints = curr.rewardPoints;
            u.rank = i + 1;
            return u;
          });

          return prev.concat(users);
        }, []);

        return __.out(res, 201, ranks);
      }

      return __.out(res, 300, 'Challenge id required');
    } catch (error) {
      logError('Challenge Controller: appListOfRanks', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async directRewards(req, res) {
    try {
      logInfo('Challenge Controller: directRewards', {
        soruceUser: req.user._id,
        body: req.body,
      });
      const { challengeId, userId, points } = req.body;
      const challenge = await Challenge.findOne({
        _id: challengeId,
        challengeEnd: {
          $gte: new Date(),
        },
        status: 1,
      })
        .select({ _id: 1, nonRewardPointSystemEnabled: 1 })
        .lean();
      const user = await User.findById(userId)
        .select({ _id: 1, rewardPoints: 1 })
        .lean();

      if (!!challenge && !!user) {
        const userRewards = parseInt(user.rewardPoints, 10) || 0;
        const directReward = {
          rewardedBy: req.user._id,
          rewardDate: new Date(),
          comment: req.body.comment,
        };
        const criteria = {
          directReward,
          companyId: req.user.companyId,
          challengeId: challenge._id,
          userId,
          status: true,
          rewardPoints: parseInt(points, 10) || 0,
        };
        const challengeStatus = await this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        )
          .findOne({ challengeId: challenge._id, userId })
          .select('_id totalRewardPoints status')
          .lean();
        const totalRewardPoints =
          (challengeStatus ? challengeStatus.totalRewardPoints || 0 : 0) +
          criteria.rewardPoints;
        const rewardPoints = userRewards + criteria.rewardPoints;
        const challengeCriteria = await new (this.getChallengeCriteriaModel(
          !!challenge.nonRewardPointSystemEnabled,
        ))(criteria).save();
        let status = null;

        if (challengeStatus) {
          status = challengeStatus.status;
        } else {
          status = true;
        }

        const result = await this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        ).updateOne(
          { challengeId: challenge._id, userId: challengeCriteria.userId },
          {
            challengeId: challenge._id,
            userId: challengeCriteria.userId,
            totalRewardPoints,
            status,
          },
          { upsert: true },
        );

        await User.updateOne({ _id: user._id }, { rewardPoints });
        if (result) {
          return __.out(res, 201, 'Reward added successfully');
        }

        return __.out(res, 300, 'Reward not added successfully');
      }

      return __.out(res, 300, 'Challenge or User not found');
    } catch (error) {
      logError('Challenge Controller: directRewards', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getBadges(req, res) {
    try {
      logInfo('Challenge Controller: getBadges', { soruceUser: req.user._id });
      const currentFolder = './public/uploads/challenge/badges';

      fs.readdir(currentFolder, (err, files) => {
        if (err) {
          return __.out(res, 300, 'Something went wrong try later');
        }

        const url = `${req.protocol}://${req.get('host')}`;

        files = files.map((file) => `${url}/uploads/challenge/badges/${file}`);
        return __.out(res, 201, files);
      });
      return true;
    } catch (error) {
      logError('Challenge Controller: getBadges', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async saveBadge(req, res) {
    try {
      logInfo('Challenge Controller: saveBadge', { soruceUser: req.user._id });
      const { file } = req;

      if (!file) {
        return __.out(res, 300, 'No File is Uploaded');
      }

      const filename = `${file.filename}`.toLowerCase();

      if (
        !filename.match(
          /\.(tiff|tif|svg|PNG|png|JPEG|jpeg|jpg|gif|txt|pdf|odt|doc|docx|wmv|mpg|mpeg|mp4|avi|3gp|3g2|xlsx|xls|xlr|pptx|ppt|odp|key)$/,
        )
      ) {
        return __.out(
          res,
          300,
          'Please upload this type extension tiff,tif,svg,png,jpeg,jpg,gif,txt,pdf,odt,doc,docx,wmv,mpg,mpeg,mp4,avi,3gp,3g2,xlsx,xls,xlr,pptx,ppt,odp,key ',
        );
      }

      const url = `${req.protocol}://${req.get('host')}`;
      const filePath = `${url}/uploads/challenge/badges/${file.filename}`;

      return res.json({
        link: filePath,
        data: { link: filePath },
      });
    } catch (error) {
      logError('Challenge Controller: saveBadge', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getRecentChallenges(req, res) {
    try {
      logInfo('Challenge Controller: getRecentChallenges', {
        soruceUser: req.user._id,
      });
      const aggregateQuery = [
        {
          $match: {
            userId: mongoose.Types.ObjectId(req.user._id),
          },
        },
        {
          $lookup: {
            from: 'challenges',
            localField: 'challengeId',
            foreignField: '_id',
            as: 'challenge',
          },
        },
        {
          $unwind: '$challenge',
        },
        {
          $match: {
            'challenge.publishStart': {
              $lte: new Date(),
            },
            'challenge.publishEnd': {
              $gte: new Date(),
            },
          },
        },
        {
          $sort: { _id: -1 },
        },
        {
          $project: {
            totalRewardPoints: 1,
            'challenge._id': 1,
            'challenge.title': 1,
            'challenge.criteriaCount': 1,
            'challenge.leaderBoard': 1,
            'challenge.description': 1,
            'challenge.challengeEnd': 1,
            'challenge.challengeStart': 1,
            'challenge.rewardPoints': 1,
            'challenge.criteriaSourceType': 1,
            'challenge.stopAfterAchievement': 1,
            'challenge.setLimitToMaxRewards': 1,
            'challenge.maximumRewards': 1,
            'challenge.icon': 1,
            'challenge.criteriaCountType': 1,
            updatedAt: 1,
          },
        },
      ];
      let challengeStatus = await this.getChallengeStatusModel()
        .aggregate(aggregateQuery)
        .allowDiskUse(true);

      challengeStatus = challengeStatus.sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      return __.out(res, 201, challengeStatus);
    } catch (error) {
      logError('Challenge Controller: getRecentChallenges', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getNomineeQuestions(req, res) {
    try {
      logInfo('Challenge Controller: getNomineeQuestions', {
        soruceUser: req.user._id,
      });
      const { customFormId } = req.query;
      const questions = await CustomForm.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(customFormId),
            status: 1,
            moduleId: {
              $exists: true,
            },
          },
        },
        {
          $lookup: {
            from: 'buildermodules',
            localField: 'moduleId',
            foreignField: '_id',
            as: 'buildermodule',
          },
        },
        {
          $unwind: '$buildermodule',
        },
        {
          $unwind: '$buildermodule.questions',
        },
        {
          $lookup: {
            from: 'questions',
            localField: 'buildermodule.questions',
            foreignField: '_id',
            as: 'questions',
          },
        },
        {
          $unwind: '$questions',
        },
        {
          $project: { questions: 1, formStatus: 1, workflow: 1 },
        },
        {
          $project: {
            'questions.question': 1,
            'questions._id': 1,
            'questions.type': 1,
            formStatus: 1,
            workflow: 1,
          },
        },
      ]);
      const moduleQuestions = questions
        .filter((question) => question.questions.type === 14)
        .map((question) => question.questions);

      return __.out(res, 201, {
        questions: moduleQuestions,
        formStatus: questions[0] ? questions[0].formStatus : [],
        workflow: questions[0] ? questions[0].workflow : [],
      });
    } catch (error) {
      logError('Challenge Controller: getNomineeQuestions', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async bulkUpdateDirectReward(req, res) {
    try {
      logInfo('Challenge Controller: bulkUpdateDirectReward', {
        soruceUser: req.user._id,
        body: req.body,
      });
      const { challengeId, updateChallenge } = req.body;
      const challenge = await Challenge.findOne({
        _id: challengeId,
        challengeEnd: {
          $gte: new Date(),
        },
        status: 1,
      })
        .select({ _id: 1, nonRewardPointSystemEnabled: 1 })
        .lean();

      if (!challenge) {
        return __.out(res, 300, 'Challenge not found');
      }

      const updateChallenges = [];
      const payloadErrorLog = [];
      let failCount = 0;

      for (const userChallenge of updateChallenge) {
        const user = await User.findOne({
          staffId: userChallenge['Staff Id'] || userChallenge.staffId,
        })
          .select({ _id: 1, rewardPoints: 1 })
          .lean();

        if (!user) {
          failCount += 1;
          payloadErrorLog.push({
            staffId: userChallenge.staffId,
            points: userChallenge.Points || userChallenge.points,
            comment: userChallenge.comment,
            reason: 'Staff ID is incorrect',
          });
        } else {
          userChallenge.rewardPoints = user.rewardPoints;
          userChallenge.userId = user._id;
          updateChallenges.push(userChallenge);
        }
      }

      for (const userChallenge of updateChallenges) {
        const userRewards = parseInt(userChallenge.rewardPoints, 10) || 0;
        const directReward = {
          rewardedBy: req.user._id,
          rewardDate: new Date(),
          comment: userChallenge.comment,
        };

        const criteria = {
          directReward,
          companyId: req.user.companyId,
          challengeId: challenge._id,
          userId: userChallenge.userId,
          status: true,
          rewardPoints: parseInt(userChallenge.Points, 10) || 0,
        };
        const challengeStatus = await this.getChallengeStatusModel(
          !!challenge.nonRewardPointSystemEnabled,
        )
          .findOne({ challengeId: challenge._id, userId: userChallenge.userId })
          .select('_id totalRewardPoints status')
          .lean();
        const totalRewardPoints =
          (challengeStatus ? challengeStatus.totalRewardPoints || 0 : 0) +
          criteria.rewardPoints;
        const rewardPoints = userRewards + criteria.rewardPoints;

        if (rewardPoints < 0) {
          payloadErrorLog.push({
            staffId: userChallenge.staffId,
            points: userChallenge.Points,
            comment: userChallenge.comment,
            reason: 'No sufficient reward points!',
          });
          failCount += 1;
        } else {
          const challengeCriteria = await new (this.getChallengeCriteriaModel(
            !!challenge.nonRewardPointSystemEnabled,
          ))(criteria).save();
          let status = null;

          if (challengeStatus) {
            status = challengeStatus.status;
          } else {
            status = true;
          }

          await this.getChallengeStatusModel(
            !!challenge.nonRewardPointSystemEnabled,
          ).updateOne(
            { challengeId: challenge._id, userId: challengeCriteria.userId },
            {
              challengeId: challenge._id,
              userId: challengeCriteria.userId,
              totalRewardPoints,
              status,
            },
            { upsert: true },
          );
          await User.updateOne(
            { _id: userChallenge.userId },
            { $inc: { rewardPoints: criteria.rewardPoints } },
          );
        }
      }

      const savePayload = {
        challengeId,
        success: updateChallenge.length - failCount,
        fail: failCount,
        failDetails:
          payloadErrorLog.length !== 0 ? JSON.stringify(payloadErrorLog) : '',
        createdBy: req.user._id,
      };

      await new RewardImportLog(savePayload).save();
      return __.out(res, 201, 'Reward added successfully');
    } catch (error) {
      logError('Challenge Controller: bulkUpdateDirectReward', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async isRewardErrorLogExist(req, res) {
    try {
      logInfo('Challenge Controller: isRewardErrorLogExist', {
        soruceUser: req.user._id,
      });
      const challenge = await RewardImportLog.findOne({
        challengeId: req.params.challengeId,
      }).lean();

      if (!challenge) {
        return __.out(res, 201, false);
      }

      return __.out(res, 201, true);
    } catch (error) {
      logError('Challenge Controller: isRewardErrorLogExist', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async getRewardErrorLog(req, res) {
    try {
      logInfo('Challenge Controller: getRewardErrorLog', {
        soruceUser: req.user._id,
      });
      const { start, length, search } = req.query;
      let { draw, skip } = req.query;
      const pageNum = start ? parseInt(start, 10) : 0;
      const limit = length ? parseInt(length, 10) : 10;
      const { challengeId } = req.params;

      draw = draw || 0;
      skip = skip ? parseInt(skip, 10) : (pageNum * limit) / limit;
      const query = {};
      const recordsTotal = await RewardImportLog.count({
        createdBy: req.user._id,
        challengeId,
      });

      if (search && search.value && validateSearchRegex(search.value)) {
        const searchQuery = {
          $regex: `${search.value}`,
          $options: 'ixs',
        };

        query.$or = [
          { 'company.name': searchQuery },
          { sourcePath: searchQuery },
          { errorMessage: searchQuery },
          { status: searchQuery },
          { noOfNewUsers: parseInt(search.value, 10) },
          { noOfUpdatedUsers: parseInt(search.value, 10) },
          { faildUpdateUsers: parseInt(search.value, 10) },
        ];
      }

      const recordsFilteredData = await RewardImportLog.find({
        createdBy: req.user._id,
        challengeId,
      });

      const data = await RewardImportLog.find({
        createdBy: req.user._id,
        challengeId,
      })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
      const result = {
        draw,
        recordsTotal,
        recordsFiltered: recordsFilteredData.length,
        data,
      };

      return res.status(201).json(result);
    } catch (error) {
      logError('Challenge Controller: getRewardErrorLog', error.stack);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async customFormFields(req, res) {
    try {
      const { customFormId } = req.params;
      const { type } = req.query;

      const customForm = await CustomForm.findOne({
        _id: customFormId,
        status: 1,
      }).lean();

      if (!customForm) {
        return res.badRequest('Custom Form Not found');
      }

      const where = {
        moduleId: customForm.moduleId,
        status: 1,
      };

      if (type === 'date') {
        where.type = 10;
      } else if (type === 'string') {
        where.type = {
          $in: [1, 8],
        };
      } else if (type === 'dropdown' || type === 'multiple') {
        where.type = {
          $in: [11, 2],
        };
      }

      let fields = await Question.find(where, {
        _id: 1,
        question: 1,
        type: 1,
        moduleId: 1,
      }).lean();

      fields = fields.map((field) => {
        const obj = { ...field };

        obj.question = striptags(obj.question);
        return obj;
      });
      return res.success(fields);
    } catch (e) {
      logError('customFormFields has error', e.stack);
      return res.error(e);
    }
  }

  async getDigitalStamp(req, res) {
    try {
      logInfo('getDigitalStamp');
      const { challengeId } = req.params;
      const { _id: userId } = req.user;
      // userId = mongoose.Types.ObjectId('5b0df0b2172ddd6e366d04b9');
      const challengeInfo = await Challenge.findOne({
        _id: challengeId,
      }).lean();

      if (!challengeInfo) {
        return res.notFound('challenge not found');
      }

      if (challengeInfo.criteriaType !== 5) {
        return res.badRequest('currently not implemented');
      }

      const { displayDescription, displayField, criteriaCategories } =
        challengeInfo;
      // dateField summaryField actionField
      let users = [];
      let teamUsers = [];
      let isTeamStage = false;
      let myTeamId = null;
      let operator = '$in';
      let lookupFrom = 'challengeteams';

      if (challengeInfo.isTeam) {
        // check user team
        const teamId = await this.userTeamCheck(challengeInfo, userId);

        if (teamId) {
          myTeamId = teamId;
          if (challengeInfo.displaySelection === displaySelection.seeOwnOnly) {
            // get teams userId
            const team = await ChallengeTeam.findOne({
              _id: teamId,
            }).lean();

            teamUsers = await this.getAllUsersForTeams([team]);
            users = teamUsers[0]?.userIds;
            isTeamStage = true;
          } else {
            isTeamStage = true;
            const team = await ChallengeTeam.find({
              challengeId: challengeInfo._id,
              status: 1,
            }).lean();

            teamUsers = await this.getAllUsersForTeams(team);
            users = teamUsers.map((us) => us.userIds);
            users = users.flat();
          }
          //           let displayDescriptionInfo = customform.questionId.filter((dateField)=> dateField.questionId._id.toString() === challenge.displayDescription.toString());
          // let displayFieldInfo = customform.questionId.filter((summaryField)=> summaryField.questionId._id.toString() === challenge.displayField.toString());
          // let criteriaCategoriesInfo = customform.questionId.filter((actionField)=> actionField.questionId._id.toString() === challenge.criteriaCategories.toString());
        } else {
          lookupFrom = 'users';
          if (challengeInfo.displaySelection === displaySelection.seeOwnOnly) {
            users = [mongoose.Types.ObjectId(userId)];
          } else {
            operator = '$nin';

            const team = await ChallengeTeam.find({
              challengeId: challengeInfo._id,
              status: 1,
            }).lean();

            teamUsers = await this.getAllUsersForTeams(team);
            users = teamUsers.map((us) => us.userIds);
            users = users.flat();
          }
        }
      } else {
        lookupFrom = 'users';
        if (challengeInfo.displaySelection === displaySelection.seeOwnOnly) {
          users = [mongoose.Types.ObjectId(userId)];
        } else {
          operator = '$nin';
        }
      }

      const lookupStage = this.getChallengeCriteriaModelString(
        !!challengeInfo.nonRewardPointSystemEnabled,
      );

      // userId: {
      //   $in: users
      // }
      const lastTwoStage = isTeamStage
        ? [
            {
              $lookup: {
                from: lookupFrom,
                localField: '_id',
                foreignField: '_id',
                as: 'name',
                pipeline: [
                  {
                    $project: {
                      name: 1,
                      logo: 1,
                    },
                  },
                ],
              },
            },
            {
              $unwind: '$name',
            },
          ]
        : [
            // {
            //   $project: {
            //     'name.name': ,
            //   },
            // },
          ];
      const isMyTeamArray = isTeamStage
        ? ['$teamId', myTeamId]
        : ['$userId', userId];
      const challengeCriteria = await Challenge.aggregate([
        {
          $match: {
            _id: challengeInfo._id,
          },
        },
        {
          $lookup: {
            from: 'challengeteams',
            localField: 'teams',
            foreignField: '_id',
            as: 'teams',
            pipeline: [
              {
                $match: {
                  status: 1,
                },
              },
              {
                $project: {
                  name: 1,
                  logo: 1,
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: lookupStage,
            localField: '_id',
            foreignField: 'challengeId',
            as: 'record',
            pipeline: [
              {
                $match: {
                  userId: { [operator]: users },
                },
              },
              {
                $addFields: {
                  teamId: {
                    $let: {
                      vars: {
                        matchingTeam: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: teamUsers,
                                cond: {
                                  $in: ['$userId', '$$this.userIds'],
                                },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: '$$matchingTeam.teamId',
                    },
                  },
                },
              },
              {
                $addFields: {
                  isMyTeam: { $eq: isMyTeamArray },
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'userId',
                  pipeline: [
                    {
                      $project: {
                        name: '$staffId',
                        logo: '$profilePicture',
                        _id: 1,
                      },
                    },
                  ],
                },
              },
              {
                $unwind: '$userId',
              },
              {
                $lookup: {
                  from: 'manageforms',
                  localField: 'manageForm',
                  foreignField: '_id',
                  as: 'form',
                  pipeline: [
                    {
                      $project: {
                        questionId: 1,
                      },
                    },
                    {
                      $lookup: {
                        from: 'questionresponses',
                        localField: 'questionId',
                        foreignField: '_id',
                        as: 'questionResponse',
                        pipeline: [
                          {
                            $match: {
                              questionId: {
                                $in: [
                                  displayDescription,
                                  displayField,
                                  criteriaCategories,
                                ],
                              },
                            },
                          },
                          {
                            $project: {
                              questionId: 1,
                              answer: 1,
                            },
                          },
                        ],
                      },
                    },
                    {
                      $addFields: {
                        mappedResponses: {
                          $map: {
                            input: '$questionResponse',
                            as: 'response',
                            in: {
                              questionId: '$$response.questionId',
                              dateField: {
                                $cond: [
                                  {
                                    $eq: [
                                      '$$response.questionId',
                                      displayDescription,
                                    ],
                                  },
                                  '$$response.answer',
                                  null,
                                ],
                              },
                              summary: {
                                $cond: [
                                  {
                                    $eq: [
                                      '$$response.questionId',
                                      displayField,
                                    ],
                                  },
                                  '$$response.answer',
                                  null,
                                ],
                              },
                              criteriaCategoriesInfo: {
                                $cond: [
                                  {
                                    $eq: [
                                      '$$response.questionId',
                                      criteriaCategories,
                                    ],
                                  },
                                  '$$response.answer',
                                  null,
                                ],
                              },
                            },
                          },
                        },
                      },
                    },

                    {
                      $project: {
                        mappedResponses: 1,
                      },
                    },
                  ],
                },
              },
              {
                $unwind: '$form',
              },
              {
                $group: {
                  _id: isTeamStage ? '$teamId' : '$userId._id',
                  alerts: { $push: '$$ROOT' },
                  name: { $first: '$userId' },
                },
              },
              ...lastTwoStage,
            ],
          },
        },
      ]);

      const result = { ...challengeCriteria[0] };
      let { record } = result;
      // return res.json(result);
      let teams = isTeamStage ? result.teams : [];

      // step generate manage form data
      if (!isTeamStage) {
        record.forEach((alertGroup) => {
          teams.push(alertGroup.name);
        });
      }

      if (
        challengeInfo.displaySelection === displaySelection.seeOwnOnly &&
        isTeamStage
      ) {
        teams = teams.filter((tt) => tt._id.toString() === myTeamId.toString());
      }

      result.teams = teams;
      result.isTeamStage = isTeamStage;
      record = record.map((alertGroup) => ({
        alerts: alertGroup.alerts.map((alert) => ({
          _id: alertGroup._id,
          isMyTeam: alert.isMyTeam,
          criteriaCategoriesInfoValue:
            alert.form.mappedResponses[0]?.criteriaCategoriesInfo?.value ||
            alert.form.mappedResponses[1]?.criteriaCategoriesInfo?.value ||
            alert.form.mappedResponses[2]?.criteriaCategoriesInfo?.value,
          teamInfo: alertGroup.name,
          userId: alert.userId,
          createdAt: alert.createdAt,
          dateField:
            alert.form.mappedResponses[0]?.dateField ||
            alert.form.mappedResponses[1]?.dateField ||
            alert.form.mappedResponses[2]?.dateField,
          summary:
            alert.form.mappedResponses[0]?.summary ||
            alert.form.mappedResponses[1]?.summary ||
            alert.form.mappedResponses[2]?.summary,
          criteriaCategoriesInfo:
            alert.form.mappedResponses[0]?.criteriaCategoriesInfo ||
            alert.form.mappedResponses[1]?.criteriaCategoriesInfo ||
            alert.form.mappedResponses[2]?.criteriaCategoriesInfo,
        })),
      }));
      record = record.flatMap((item) => item.alerts);

      const groupedData = record.reduce((resultIn, item) => {
        const key = `${item._id}-${item.criteriaCategoriesInfoValue}`;

        if (!resultIn[key]) {
          resultIn[key] = {
            teamId: item._id,
            teamInfo: item.teamInfo,
            isMyTeam: item.isMyTeam,
            criteriaCategoriesInfoValue: item.criteriaCategoriesInfoValue,
            alerts: [],
          };
        }

        resultIn[key].alerts.push(item);

        return resultIn;
      }, {});

      const groupedArray = Object.values(groupedData);

      record = groupedArray;
      // return res.json(groupedArray)
      const finalResult = [];

      // Step 1: Process each team each criteriaCategoriesInfoValue
      for (let j = 0; j < groupedArray.length; j += 1) {
        // console.log
        const teamI = groupedArray[j];
        const obj = {
          teamId: teamI.teamId,
          teamInfo: teamI.teamInfo,
          criteriaCategoriesInfoValue: teamI.criteriaCategoriesInfoValue,
          isMyTeam: teamI.isMyTeam,
        };
        const { alerts } = teamI;

        // Step 2: Sort alerts by createdAt in descending order
        alerts.sort((alert1, alert2) => alert2.createdAt - alert1.createdAt);

        // Step 3: Group alerts into chunks based on criteriaCount
        const groupedAlerts = [];
        let i = 0;

        while (i < alerts.length) {
          if (i + result.criteriaCount <= alerts.length) {
            groupedAlerts.push({
              date: alerts[0].createdAt,
              alerts: alerts.slice(i, i + result.criteriaCount),
            });
          }

          // else {
          //   // If remaining alerts are fewer than criteriaCount, push them as is
          //   groupedAlerts.push(alerts.slice(i));
          // }
          i += result.criteriaCount;
        }

        // Step 4: Update team's alerts with grouped alerts
        obj.info = groupedAlerts;
        finalResult.push(obj);
      }

      const groupedDataFinal = finalResult.reduce((resultIn, item) => {
        const key = `${item.criteriaCategoriesInfoValue}`;

        if (!resultIn[key]) {
          resultIn[key] = {
            criteriaCategoriesInfoValue: item.criteriaCategoriesInfoValue,
            list: [],
          };
        }

        resultIn[key].list.push(item);

        return resultIn;
      }, {});
      const groupedArrayFinal = Object.values(groupedDataFinal);

      // return res.json(groupedArrayFinal);
      result.record = groupedArrayFinal;
      return res.success(result);

      // get all challengeCriteria
    } catch (error) {
      logError('error', error.stack);
      return res.error(error);
    }
  }
}

module.exports = new ChallengeController();

// new challenge().generateRewardForTeam()

// new challenge().triggerChallenge(
//   {},
//   '5a98fb9536ab4f444b427176',
//   '64b6a0b1d25d6445c37afb07',
//   'customform',
//   null,
// )
