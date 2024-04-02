const { logInfo, logError } = require('./logger.helper');
const ChallengeTeam = require('../app/models/challengeTeam');
const Challenge = require('../app/models/challenge');
const ChallengeStatus = require('../app/models/challengeStatus');
const ChallengeCriteria = require('../app/models/challengeCriteria');
const ChallengeCriteriaNonReward = require('../app/models/challengeCriteriaNonReward');
const { AssignUserRead } = require('./assinguserread');
const User = require('../app/models/user');

const getChallengeCriteriaModel = (flag) =>
  flag ? ChallengeCriteriaNonReward : ChallengeCriteria;
const getAllUsersForTeams = async (teams) => {
  try {
    logInfo('getAllUsersForTeams');
    const allCall = [];

    teams.forEach((team) => {
      allCall.push(AssignUserRead.read(team.assignUsers, null, team.createdBy));
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
};

const processTeam = async (teamInfo, challengeInfo, data, teamsData) => {
  try {
    const {
      criteriaCount,
      stopAfterAchievement,
      rewardPoints,
      maxReward,
      criteriaModel,
    } = data;
    const { userIds: teamUsers, teamId } = teamInfo;

    let totalRewardsCount = Math.floor(teamUsers.length / criteriaCount);

    if (stopAfterAchievement) {
      totalRewardsCount = 1;
    }

    let totalReward = totalRewardsCount * rewardPoints;

    if (maxReward && maxReward < totalReward) {
      totalReward = maxReward;
    }

    let allUsers = teamsData.filter(
      (tea) => tea.teamId.toString() === teamId.toString(),
    );

    allUsers = allUsers[0]?.userIds;
    const insertObject = allUsers.map((insert) => ({
      companyId: challengeInfo.companyId,
      challengeId: challengeInfo._id,
      userId: insert,
      criteriaSourceType: challengeInfo.criteriaSourceType,
      rewardPoints: totalReward,
      criteriaCount: challengeInfo.criteriaCount,
      status: true,
      teamId,
    }));

    const insertedRecords = await criteriaModel.insertMany(insertObject);

    await ChallengeStatus.updateMany(
      { userId: { $in: allUsers }, challengeId: challengeInfo._id },
      { $inc: { totalRewardPoints: totalReward } },
    );

    if (!challengeInfo.nonRewardPointSystemEnabled) {
      await User.updateMany(
        { _id: { $in: teamUsers } },
        { $inc: { rewardPoints: totalReward } },
      );
    }

    logInfo('team reward successfully given', {
      challengeId: challengeInfo._id,
      teamId,
      insertedRecords: insertedRecords.length,
    });
    return true;
  } catch (e) {
    logError('proess team has error', e.stack);
    throw e;
  }
};
const challengeReward = async (challengeId) => {
  try {
    logInfo('challengeReward', challengeId);
    const challengeInfo = await Challenge.findOne({ _id: challengeId }).lean();

    if (!(challengeInfo.isTeam && challengeInfo.criteriaType === 5)) {
      logError('invalid Challenge', {
        challengeId,
        publishEnd: challengeInfo.publishEnd,
        isTeam: challengeInfo.isTeam,
        criteriaType: challengeInfo.criteriaType,
      });
      return false;
    }

    // check if reward is on
    if (challengeInfo.rewardPoints <= 0) {
      logInfo('challengeReward has no reward', {
        challengeId,
        publishEnd: challengeInfo.publishEnd,
        isTeam: challengeInfo.isTeam,
        rewardPoints: challengeInfo.rewardPoints,
      });

      return false;
    }

    const criteriaModel = getChallengeCriteriaModel(
      !!challengeInfo.nonRewardPointSystemEnabled,
    );
    // get all user who did the action
    const users = await criteriaModel
      .find({ challengeId, status: false })
      .lean();

    if (users.length === 0) {
      return false;
    }

    const userIds = users.map((user) => user.userId);

    logInfo('total users', { total: userIds.length });

    const teams = await ChallengeTeam.find({ challengeId, status: 1 }).lean();

    // get all team users
    const teamsData = await getAllUsersForTeams(teams);

    // from all user check which user is belong to which team and remaining from action user treat as individual
    const userIdArrayWithTeamId = userIds.map((userId) => {
      const teamId = teamsData.find((team) =>
        team.userIds.some((id) => id.toString() === userId.toString()),
      )?.teamId;

      return {
        userId: userId.toString(),
        teamId: teamId ? teamId.toString() : null,
      };
    });

    const usersWithTeam = userIdArrayWithTeamId.filter((user) => user.teamId);
    const usersWithOutTeam = userIdArrayWithTeamId.filter(
      (user) => !user.teamId,
    );

    logInfo('total records', {
      usersWithTeam: usersWithTeam.length,
      usersWithOutTeam: usersWithOutTeam.length,
    });

    const groupedByTeamId = userIdArrayWithTeamId.reduce((result, user) => {
      if (user.teamId) {
        if (!result[user.teamId]) {
          result[user.teamId] = {
            teamId: user.teamId,
            userIds: [],
          };
        }

        result[user.teamId].userIds.push(user.userId);
      }

      return result;
    }, {});

    const groupedArray = Object.values(groupedByTeamId);
    // then as per criteriaCount and recurring rule and max reward generate reward for each user
    const { criteriaCount } = challengeInfo;
    const { stopAfterAchievement } = challengeInfo;
    const { setLimitToMaxRewards } = challengeInfo;
    const { rewardPoints } = challengeInfo;
    const maxReward = setLimitToMaxRewards
      ? challengeInfo.maximumRewards
      : false;

    logInfo('challenge Info', {
      criteriaCount,
      stopAfterAchievement,
      setLimitToMaxRewards,
      maxReward,
    });
    // save the reward for user
    if (groupedArray.length > 0) {
      const teamRewardDistribution = [];

      // team reward distribution
      for (const teamInfo of groupedArray) {
        teamRewardDistribution.push(
          processTeam(
            teamInfo,
            challengeInfo,
            {
              criteriaCount,
              stopAfterAchievement,
              setLimitToMaxRewards,
              rewardPoints,
              maxReward,
              criteriaModel,
            },
            teamsData,
          ),
        );
      }
      await Promise.all(teamRewardDistribution);
    }

    if (usersWithOutTeam.length > 0) {
      // individual reward distribution
      const groupedCounts = {};

      usersWithOutTeam.forEach((user) => {
        const idString = user.userId.toString();

        if (groupedCounts[idString]) {
          groupedCounts[idString] += 1;
        } else {
          groupedCounts[idString] = 1;
        }
      });

      const resultArray = Object.entries(groupedCounts).map(
        ([userId, count]) => ({ userId, count }),
      );
      const individualUserRewards = [];

      for (let j = 0; j < resultArray.length; j += 1) {
        const userInfo = resultArray[j];
        let totalRewardsCount = Math.floor(userInfo.count / criteriaCount);

        if (stopAfterAchievement) {
          totalRewardsCount = 1;
        }

        let totalReward = totalRewardsCount * rewardPoints;

        if (maxReward && maxReward < totalReward) {
          totalReward = maxReward;
        }

        individualUserRewards.push({
          userId: userInfo.userId,
          rewards: totalReward,
        });
      }
      const bulkCriteriaUpdates = [];
      const bulkUserUpdates = [];
      const bulkChallengeUpArr = [];

      for (const individual of individualUserRewards) {
        const criteriaUpdate = {
          updateOne: {
            filter: {
              challengeId: challengeInfo._id,
              userId: individual.userId,
            },
            update: {
              $set: {
                companyId: challengeInfo.companyId,
                criteriaSourceType: challengeInfo.criteriaSourceType,
                rewardPoints: individual.rewards,
                criteriaCount: challengeInfo.criteriaCount,
                status: true,
              },
            },
            upsert: true,
          },
        };
        const challengeStatusUp = {
          updateOne: {
            filter: {
              userId: individual.userId,
              challengeId: challengeInfo._id,
            },
            update: { $inc: { totalRewardPoints: individual.rewards } },
          },
        };

        bulkChallengeUpArr.push(challengeStatusUp);
        bulkCriteriaUpdates.push(criteriaUpdate);

        if (!challengeInfo.nonRewardPointSystemEnabled) {
          const userUpdate = {
            updateOne: {
              filter: { _id: individual.userId },
              update: { $inc: { rewardPoints: individual.rewards } },
            },
          };

          bulkUserUpdates.push(userUpdate);
        }
      }

      await criteriaModel.bulkWrite(bulkCriteriaUpdates);
      await ChallengeStatus.bulkWrite(bulkChallengeUpArr);

      if (bulkUserUpdates.length > 0) {
        await User.bulkWrite(bulkUserUpdates);
      }
    }

    logInfo('rewards given successfully', { challengeId });
    return true;
  } catch (e) {
    logError('challengeReward has error', e.stack);
    return false;
  }
};

module.exports = {
  challengeReward,
};

// challengeReward('64e60e4519d581364c3221c6');
