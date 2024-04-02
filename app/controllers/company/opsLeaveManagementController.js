const { CronJob } = require('cron');
const moment = require('moment');
const { validationResult } = require('express-validator');
const StaffSapData = require('../../models/staffSAPData');
const Ballot = require('../../models/ballot');
const OpsLeaves = require('../../models/opsLeaves');
const OpsGroup = require('../../models/ops');
const UserHoliday = require('../../models/userHoliday');
const SwopRequests = require('../../models/swapRequests');
const OpsTeam = require('../../models/opsTeam');
const User = require('../../models/user');
const PageSettingModel = require('../../models/pageSetting');
const UserLeaves = require('../../models/userLeaves');
const LeaveLog = require('../../models/leaveLogs');
// const _ = require('lodash');
let __ = require('../../../helpers/globalFunctions');
const FCM = require('../../../helpers/fcm');
const leaveApplied = require('../../models/leaveApplied');

__ = require('../../../helpers/globalFunctions');

function nextDayUTC(d) {
  const aDay = 1440 * 60 * 1000;
  const d2 = new Date(Math.trunc((d.getTime() + aDay) / aDay) * aDay);

  return d2;
}

function removeDuplicates(originalArray, objKey, objKey1) {
  const trimmedArray = [];
  const values = [];
  let value;
  let val1;

  for (let i = 0; i < originalArray.length; i += 1) {
    value = {
      start: originalArray[i][objKey],
      end: originalArray[i][objKey1],
    };
    val1 = JSON.stringify(value);

    if (values.indexOf(val1) === -1) {
      trimmedArray.push(originalArray[i]);
      values.push(val1);
    }
  }
  return trimmedArray;
}

function getDaysArray(start, end, value, week) {
  const daysArray = [];

  for (
    let currentDate = new Date(start);
    currentDate <= end;
    currentDate.setDate(currentDate.getDate() + 1)
  ) {
    daysArray.push({ date: new Date(currentDate), value, weekNo: week });
  }

  return daysArray;
}

function groupBy(xs, key) {
  return xs.reduce((rv, x) => {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
}

function checkOfUser(array, currentuserid) {
  for (let i = 0; i <= array.length - 1; i += 1) {
    if (array[i]._id.toString() === currentuserid.toString()) {
      return -1;
    }
  }
  return 0;
}

async function getDateArray(start, end) {
  const arr = [];
  const dt = new Date(start);

  while (dt <= end) {
    arr.push(new Date(dt));
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
}

function findCommonElement(array1, array2) {
  for (let i = 0; i < array1.length; i += 1) {
    for (let j = 0; j < array2.length; j += 1) {
      if (array1[i].toString() === array2[j].toString()) {
        // Return if common element found
        return true;
      }
    }
  }
  // Return if no common element exist
  return false;
}

async function noOfDays(res, totaldays) {
  try {
    const pageSettingData = await PageSettingModel.findOne({
      companyId: '5a9d162b36ab4f444b4271c8',
      status: 1,
    })
      .select('opsGroup')
      .lean();

    let configurationNumber = 2;

    if (pageSettingData.opsGroup.blockLeaveConfiguration === 1) {
      configurationNumber = 2;
    }

    if (pageSettingData.opsGroup.blockLeaveConfiguration === 2) {
      configurationNumber = 1;
    }

    if (pageSettingData.opsGroup.blockLeaveConfiguration === 3) {
      configurationNumber = 0;
    }

    let daysToDeduct = totaldays;

    if (daysToDeduct % 7 === 0) {
      let n = daysToDeduct / 7;

      n *= configurationNumber;
      daysToDeduct -= n;
    }

    if (daysToDeduct > 0 && daysToDeduct < 7) {
      if (daysToDeduct === 6) {
        daysToDeduct = 5;
      } else {
        daysToDeduct -= configurationNumber * 0;
      }
    }

    if (daysToDeduct > 7 && daysToDeduct < 14) {
      daysToDeduct -= configurationNumber * 1;
    }

    if (daysToDeduct > 14 && daysToDeduct < 21) {
      daysToDeduct -= configurationNumber * 2;
    }

    if (daysToDeduct > 21 && daysToDeduct < 28) {
      daysToDeduct -= configurationNumber * 3;
    }

    return daysToDeduct;
  } catch (err) {
    __.log(err);
    return __.out(res, 500);
  }
}

function getArrayOfDates(start, end) {
  const arr = [];
  const dt = new Date(start);

  while (dt <= end) {
    arr.push(new Date(dt));
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
}

class OpsLeaveController {
  async opsLeaveDataPage(req, res) {
    try {
      const opsGroups = await OpsGroup.find(
        { adminId: req.params.id, isDelete: false },
        { _id: 1, opsTeamId: 1, opsGroupName: 1, userId: 1 },
      )
        // const ballots = await Ballot.find({ops})
        .populate([
          {
            path: 'opsTeamId',
            select: ['name', '_id', 'userId'],
          },
          {
            path: 'userId',
            select: ['_id', 'name', 'staffId'],
          },
        ]);
      // let opsIds = [];
      // for(let ops=0;ops<=opsGroups.length-1;ops++){
      //     opsIds.push(opsGroups[ops]._id);
      // }
      //    const ballots =await Ballot.find({"opsGroupId" :{$in :opsIds}},{_id:1});
      const opsLeavess = [];
      const opsData = [];
      const opss = [];

      const promiseData = [];
      const opsGroupsListCall = async (op) => {
        // check if ops leave for this ops group is present
        const opsleave = await OpsLeaves.findOne({
          opsGroupId: opsGroups[op]._id,
        });

        if (opsleave) {
          opss.push(opsleave);
          const ops = {
            id: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            team: [],
          };

          if (opsGroups[op].opsTeamId.length > 0) {
            for (
              let t1 = 0;
              t1 <= opsGroups[op].opsTeamId.length - 1;
              t1 += 1
            ) {
              const tt = {
                id: opsGroups[op].opsTeamId[t1]._id,
                name: opsGroups[op].opsTeamId[t1].name,
              };

              ops.team.push(tt);
            }
            opsData.push(ops);
          } else {
            opsData.push(ops);
          }
        } else {
          const opsLeave = {
            opsGroupId: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            createdBy: req.user._id,
            users: [],
            opsTeamId: [],
          };
          const ops = {
            id: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            team: [],
          };

          opsLeave.companyId = req.user.companyId;
          if (opsGroups[op].opsTeamId.length > 0) {
            for (
              let t1 = 0;
              t1 <= opsGroups[op].opsTeamId.length - 1;
              t1 += 1
            ) {
              const tt = {
                id: opsGroups[op].opsTeamId[t1]._id,
                name: opsGroups[op].opsTeamId[t1].name,
              };

              ops.team.push(tt);
            }
            for (let u = 0; u <= opsGroups[op].userId.length - 1; u += 1) {
              for (let t = 0; t <= opsGroups[op].opsTeamId.length - 1; t += 1) {
                const ids = opsGroups[op].opsTeamId[t].userId.filter(
                  (id) => id === opsGroups[op].userId[u]._id.toString(),
                );

                if (ids.length > 0) {
                  const user = {};

                  user.staffId = opsGroups[op].userId[u].staffId;
                  user.id = opsGroups[op].userId[u]._id;
                  user.name = opsGroups[op].userId[u].name;
                  user.teamId = opsGroups[op].opsTeamId[t]._id;
                  user.teamName = opsGroups[op].opsTeamId[t].name;
                  opsLeave.users.push(user);
                }

                if (
                  !opsLeave.opsTeamId.includes(opsGroups[op].opsTeamId[t]._id)
                ) {
                  opsLeave.opsTeamId.push(opsGroups[op].opsTeamId[t]._id);
                }
              }
            }
          } else {
            opsLeave.users = opsGroups[op].userId;
          }

          opsLeavess.push(opsLeave);
          opsData.push(ops);
        }
      };

      for (let op = 0; op <= opsGroups.length - 1; op += 1) {
        promiseData.push(opsGroupsListCall(op));
      }

      await Promise.all(promiseData);

      if (opsLeavess.length > 0) {
        let data = await OpsLeaves.insertMany(opsLeavess);

        if (opss.length > 0) {
          data = data.concat(opss);
        }

        res.status(201).json({
          status: true,
          data: { leavedata: data, opsids: opsData },
          message: 'Successfull!!',
        });
      } else {
        const data = opss;

        res.status(201).json({
          status: true,
          data: { leavedata: data, opsids: opsData },
          message: 'Got Successfully..!!',
        });
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: e, message: 'Something went wrong!!' });
    }
  }

  async opsLeaveDataPageSwap(req, res) {
    try {
      const opsGroups = await OpsGroup.find(
        { adminId: req.params.id, isDelete: false },
        { _id: 1, opsTeamId: 1, opsGroupName: 1, userId: 1 },
      )
        // const ballots = await Ballot.find({ops})
        .populate([
          {
            path: 'opsTeamId',
            select: ['name', '_id', 'userId'],
          },
          {
            path: 'userId',
            select: ['_id', 'name', 'staffId'],
          },
        ]);
      // let opsIds = [];
      // for(let ops=0;ops<=opsGroups.length-1;ops++){
      //     opsIds.push(opsGroups[ops]._id);
      // }
      //    const ballots =await Ballot.find({"opsGroupId" :{$in :opsIds}},{_id:1});
      const opsLeavess = [];
      const opsData = [];
      const opss = [];

      const promiseData = [];
      const opsleaveListCall = async (op) => {
        // check if ops leave for this ops group is present
        const opsleave = await OpsLeaves.findOne({
          opsGroupId: opsGroups[op]._id,
        });

        if (opsleave) {
          opss.push(opsleave);
          const ops = {
            id: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            team: [],
          };

          if (opsGroups[op].opsTeamId.length > 0) {
            for (
              let t1 = 0;
              t1 <= opsGroups[op].opsTeamId.length - 1;
              t1 += 1
            ) {
              const tt = {
                id: opsGroups[op].opsTeamId[t1]._id,
                name: opsGroups[op].opsTeamId[t1].name,
              };

              ops.team.push(tt);
            }
            opsData.push(ops);
          } else {
            opsData.push(ops);
          }
        } else {
          const opsLeave = {
            opsGroupId: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            createdBy: req.user._id,
            users: [],
            opsTeamId: [],
          };
          const ops = {
            id: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            team: [],
          };

          opsLeave.companyId = req.user.companyId;
          if (opsGroups[op].opsTeamId.length > 0) {
            for (
              let t1 = 0;
              t1 <= opsGroups[op].opsTeamId.length - 1;
              t1 += 1
            ) {
              const tt = {
                id: opsGroups[op].opsTeamId[t1]._id,
                name: opsGroups[op].opsTeamId[t1].name,
              };

              ops.team.push(tt);
            }
            for (let u = 0; u <= opsGroups[op].userId.length - 1; u += 1) {
              for (let t = 0; t <= opsGroups[op].opsTeamId.length - 1; t += 1) {
                const ids = opsGroups[op].opsTeamId[t].userId.filter(
                  (id) => id === opsGroups[op].userId[u]._id.toString(),
                );

                if (ids.length > 0) {
                  const user = {};

                  user.staffId = opsGroups[op].userId[u].staffId;
                  user.id = opsGroups[op].userId[u]._id;
                  user.name = opsGroups[op].userId[u].name;
                  user.teamId = opsGroups[op].opsTeamId[t]._id;
                  user.teamName = opsGroups[op].opsTeamId[t].name;
                  opsLeave.users.push(user);
                }

                if (
                  !opsLeave.opsTeamId.includes(opsGroups[op].opsTeamId[t]._id)
                ) {
                  opsLeave.opsTeamId.push(opsGroups[op].opsTeamId[t]._id);
                }
              }
            }
          } else {
            opsLeave.users = opsGroups[op].userId;
          }

          opsLeavess.push(opsLeave);
          opsData.push(ops);
        }
      };

      for (let op = 0; op <= opsGroups.length - 1; op += 1) {
        promiseData.push(opsleaveListCall(op));
      }

      await Promise.all(promiseData);

      if (opsLeavess.length > 0) {
        let data = await OpsLeaves.insertMany(opsLeavess);

        if (opss.length > 0) {
          data = data.concat(opss);
        }

        res.status(201).json({
          status: true,
          data: { leavedata: data, opsids: opsData },
          message: 'Successfull!!',
        });
      } else {
        const data = opss;

        res.status(201).json({
          status: true,
          data: { leavedata: data, opsids: opsData },
          message: 'Got Successfully..!!',
        });
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: e, message: 'Something went wrong!!' });
    }
  }

  async getOpsLeaveCanlender(req, res) {
    try {
      const ballot = await Ballot.findOne({ _id: req.params.id });

      if (!ballot) {
        res.status(404).json({
          status: false,
          data: null,
          message: "couldn't find requested ballot.",
        });
      } else {
        const opsLeaveData = await OpsLeaves.findOne({
          ballots: { $in: [ballot._id] },
        });

        if (!opsLeaveData || opsLeaveData == null) {
          const allBallots = [];

          if (ballot.parentBallot) {
            const rounds = await this.findParent(res, ballot, allBallots);

            this.findQuotas(rounds, res, req);
          } else if (ballot.childBallots.length > 0) {
            // If selected ballot is parnt ballot
            // let allBallots=[];
            allBallots.push(ballot._id);
            for (let c = 0; c <= ballot.childBallots.length - 1; c += 1) {
              allBallots.push(ballot.childBallots[c]);
            }
            this.findQuotas(allBallots, res, req);
          } else {
            // This is alone ballot its has not parent and np children
            allBallots.push(ballot._id);
            this.findQuotas(allBallots, res, req);
          }
        } else {
          res.status(201).json({
            status: true,
            data: opsLeaveData,
            message: 'got it in ops Leaves.',
          });
        }
      }
    } catch (e) {
      res.status(501).json({
        status: false,
        data: null,
        message: 'Oops! something went wrong.',
      });
    }
  }

  async findParent(res, ballotdata, allBallots) {
    try {
      if (ballotdata.parentBallot) {
        const BBallot = await Ballot.findOne(
          { _id: ballotdata.parentBallot },
          { _id: 1, parentBallot: 1, childBallots: 1 },
        );

        return this.findParent(res, BBallot, allBallots);
      }

      if (ballotdata.childBallots.length > 0) {
        allBallots.push(ballotdata._id);
        for (let c = 0; c <= ballotdata.childBallots.length - 1; c += 1) {
          allBallots.push(ballotdata.childBallots[c]);
        }
        //  return allBallots;
      }

      return allBallots;
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async findQuotas(allballots, res, req) {
    try {
      allballots.reverse();

      // let ballotToWork = allballots[0];
      const ballotIs = await Ballot.findOne(
        { _id: allballots[0] },
        {
          _id: 1,
          ballotName: 1,
          weekRange: 1,
          slotCreation: 1,
          OpsGroupId: 1,
          wonStaff: 1,
          adminId: 1,
        },
      );

      if (!ballotIs) {
        res
          .status(204)
          .json({ status: true, data: null, message: "Couldn't find ballot." });
      }

      const slots = ballotIs.slotCreation;

      ballotIs.monthRange = [];
      ballotIs.monthRange = JSON.stringify(ballotIs.weekRange);
      ballotIs.monthRange = JSON.parse(ballotIs.monthRange);
      ballotIs.monthRange.forEach((dd, index) => {
        dd.month = moment(dd.start).format('MMMM-YY');
        dd.weekNO = index;
      });
      ballotIs.monthRange = groupBy(ballotIs.monthRange, 'month');
      const MONTH = [];

      await Object.entries(ballotIs.monthRange).forEach((entry) => {
        const key = entry[0];
        const value = entry[1];
        const objTo = {};

        objTo[key] = value;
        MONTH.push(objTo);
        // use key and value here
      });
      ballotIs.monthRange = MONTH;

      const weekData = [];

      for (let i = 0; i <= slots.length - 1; i += 1) {
        const opsGrpid = slots[i].opsGroup.opsId;
        const opsGroup = {
          id: opsGrpid,
          value: slots[i].opsGroup.value,
          weekdata: [],
          opsTeams: [],
        };

        for (let j = 0; j <= slots[i].arr.length - 1; j += 1) {
          const currentweek = `${j}A`;
          const found = ballotIs.wonStaff.filter(
            (element) =>
              element.opsGroupId.toString() === opsGrpid.toString() &&
              element.weekNo === j,
          );

          // slots[i].weekRangeSlot[currentweek].weeksValues={};
          slots[i].weekRangeSlot[currentweek].value -= found.length;
          const currentWeekIs1 = ballotIs.weekRange[j];
          const daylist1 = getDaysArray(
            new Date(currentWeekIs1.start),
            new Date(currentWeekIs1.end),
            slots[i].weekRangeSlot[currentweek].value,
            j,
          );

          opsGroup.weekdata = opsGroup.weekdata.concat(daylist1);
          if (slots[i].opsTeam.length > 0) {
            slots[i].opsTeam.forEach((team, d) => {
              const currentweek1 = j + d.toString();

              const found1 = ballotIs.wonStaff.filter((element) => {
                if (element.opsTeamId) {
                  return (
                    element.opsTeamId.toString() === team._id.toString() &&
                    element.weekNo === j
                  );
                }

                return (
                  element.opsGroupId === opsGrpid &&
                  !element.opsTeamId &&
                  element.weekNO === j
                );
              });

              slots[i].weekRangeSlot[currentweek1].value -= found1.length;
              if (
                opsGroup.opsTeams[d] &&
                opsGroup.opsTeams[d].weekdata &&
                opsGroup.opsTeams[d].weekdata.length > 0
              ) {
                const currentWeekIs = ballotIs.weekRange[j];
                const daylist = getDaysArray(
                  new Date(currentWeekIs.start),
                  new Date(currentWeekIs.end),
                  slots[i].weekRangeSlot[currentweek1].value,
                  j,
                );

                opsGroup.opsTeams[d].weekdata =
                  opsGroup.opsTeams[d].weekdata.concat(daylist);
              } else {
                const tm = { id: team._id, name: team.name, weekdata: [] };

                opsGroup.opsTeams.push(tm);
                const currentWeekIs = ballotIs.weekRange[j];
                const daylist = getDaysArray(
                  new Date(currentWeekIs.start),
                  new Date(currentWeekIs.end),
                  slots[i].weekRangeSlot[currentweek1].value,
                  j,
                );

                opsGroup.opsTeams[d].weekdata =
                  opsGroup.opsTeams[d].weekdata.concat(daylist);
              }
            });
          }
        }
        // delete slots[i].arr;
        weekData.push(opsGroup);
      }
      // after all we need to create ops leave object
      const OpsLeave = {};

      OpsLeave.createdBy = req.user._id;
      OpsLeave.ballots = allballots;
      OpsLeave.adminId = ballotIs.adminId;
      OpsLeave.opsGroupId = ballotIs.opsGroupId;
      OpsLeave.weekRange = ballotIs.weekRange;
      OpsLeave.companyId = req.user.companyId;
      OpsLeave.slotRange = weekData;
      OpsLeave.monthRange = ballotIs.monthRange;
      const opsleave = new OpsLeaves(OpsLeave);
      const leaveops = await opsleave.save();

      return res
        .status(201)
        .json({ status: true, data: leaveops, message: 'got it.' });
      //  return(ballotIs);
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getDateRange(req, res) {
    try {
      const bb = await Ballot.findOne(
        { _id: req.params.id },
        { _id: 1, weekRange: 1 },
      );
      const arrOfWeekIs = bb.weekRange[0];

      const daylist = getDaysArray(
        new Date(arrOfWeekIs.start),
        new Date(arrOfWeekIs.end),
      );

      return res
        .status(201)
        .json({ status: true, data: daylist, message: 'got it.' });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async savePerDayOpsQuota(req, res) {
    try {
      const { opsGroup, opsTeam } = req.body;
      let opsleave = await OpsLeaves.findOne(
        { opsGroupId: opsGroup.id },
        { _id: 1, perDayQuota: 1, opsTeamId: 1 },
      );

      if (!opsleave) {
        res.status(203).json({
          status: false,
          data: null,
          message: 'couldent find this ops group in opsLeave',
        });
      }

      opsleave = JSON.parse(JSON.stringify(opsleave));
      const data = opsGroup;
      let key;

      let ddquota = {};

      data.quota.map((dd) => {
        // dd.value = parseInt(dd.value);
        ddquota = dd;
        [key] = Object.keys(dd);
        return dd;
      });
      if (opsleave.perDayQuota) {
        const filterquota = opsleave.perDayQuota.quota.filter((q) => {
          const qq = Object.prototype.hasOwnProperty.call(q, key);

          return qq;
        });

        if (filterquota.length > 0) {
          for (
            let kk = 0;
            kk <= opsleave.perDayQuota.quota.length - 1;
            kk += 1
          ) {
            if (
              Object.prototype.hasOwnProperty.call(
                opsleave.perDayQuota.quota[kk],
                key,
              )
            ) {
              opsleave.perDayQuota.quota[kk] = ddquota;
            } else {
              // this does not have any own property for that object.
            }
          }
        } else {
          opsleave.perDayQuota.quota.push(ddquota);
        }
      } else {
        opsleave.perDayQuota = {
          id: data.id,
          name: data.name,
          quota: data.quota,
          opsTeams: [],
        };
      }

      // For Ops Teams
      if (opsleave.opsTeamId.length > 0 && opsTeam) {
        if (opsleave.perDayQuota.opsTeams.length > 0) {
          let ttquota;
          let key1;

          opsTeam.quota.map((dd) => {
            // dd.value = parseInt(dd.value);
            ttquota = dd;

            [key1] = Object.keys(dd);
            return dd;
          });

          const Isteam = opsleave.perDayQuota.opsTeams.filter(
            (qa) => qa.id === opsTeam.id,
          );

          if (Isteam && Isteam.length > 0) {
            // This ieam exists there replace it in opsteam array.
            for (
              let tm = 0;
              tm <= opsleave.perDayQuota.opsTeams.length - 1;
              tm += 1
            ) {
              const keyData = key1;

              if (opsleave.perDayQuota.opsTeams[tm].id === opsTeam.id) {
                // update value
                const filtertmquota = opsleave.perDayQuota.opsTeams[
                  tm
                ].quota.filter((q) => {
                  const qq = Object.prototype.hasOwnProperty.call(q, keyData);

                  return qq;
                });

                if (filtertmquota.length > 0) {
                  for (
                    let kk = 0;
                    kk <= opsleave.perDayQuota.opsTeams[tm].quota.length - 1;
                    kk += 1
                  ) {
                    if (
                      Object.prototype.hasOwnProperty.call(
                        opsleave.perDayQuota.opsTeams[tm].quota[kk],
                        keyData,
                      )
                    ) {
                      opsleave.perDayQuota.opsTeams[tm].quota[kk] = ttquota;
                    } else {
                      // this does not have any own property for that object.
                    }
                  }
                } else {
                  opsleave.perDayQuota.opsTeams[tm].quota.push(ttquota);
                }

                // opsleave.perDayQuota.opsTeams[tm].quota = opsTeam.quota;
              } else {
                // nothing to update or save
              }
            }
          } else {
            // does not exists there so just push it directly in opsteam array.
            opsleave.perDayQuota.opsTeams.push(opsTeam);
          }
        } else {
          opsleave.perDayQuota.opsTeams.push(opsTeam);
        }
      }

      const updated = await OpsLeaves.update(
        { _id: opsleave._id },
        { $set: { perDayQuota: opsleave.perDayQuota } },
      );

      if (updated) {
        return res.status(201).json({
          status: true,
          data: updated,
          message: 'Successfully updated quota values.',
        });
      }

      return res.status(203).json({
        status: false,
        data: null,
        message: "couldn't update values",
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getQuotaByOpsGroup(req, res) {
    try {
      const { id } = req.params;
      const opsleave = await OpsLeaves.findOne(
        { opsGroupId: id },
        { _id: 1, perDayQuota: 1, opsTeamId: 1 },
      );

      if (!opsleave) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'couldent find this ops group in opsLeave',
        });
      }

      return res.status(201).json({
        status: true,
        data: opsleave,
        message: 'found data successfully',
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async quotaByOpsGroup(req, res) {
    try {
      const { body } = req;
      const opsleave = await OpsLeaves.findOne(
        { opsGroupId: body.opsGroupId },
        { _id: 1, perDayQuota: 1, opsTeamId: 1 },
      );
      const obj = {};

      if (!opsleave) {
        obj.perDayQuota = {
          quota: [],
        };
        if (body.opsTeamId) {
          obj.perDayQuota.opsTeams = {
            id: body.opsTeamId,
            quota: [],
          };
        }

        return res.status(200).json({
          status: false,
          data: obj,
          message: 'couldent find this ops group in opsLeave',
        });
      }

      const { perDayQuota } = opsleave;

      if (!perDayQuota) {
        obj.perDayQuota = {
          quota: [],
        };
        if (body.opsTeamId) {
          obj.perDayQuota.opsTeams = {
            id: body.opsTeamId,
            quota: [],
          };
        }

        return res.status(200).json({
          status: false,
          data: obj,
          message: 'Per day quota not found',
        });
      }

      // return res.json({ perDayQuota })
      const data = perDayQuota.quota.filter((item) => {
        const year = Object.keys(item)[0];

        return year === req.body.year;
      });

      if (data.length > 0) {
        obj.perDayQuota = {
          quota: data[0],
        };
        if (body.opsTeamId && perDayQuota.opsTeams.length > 0) {
          let finalTeam = null;

          for (let i = 0; i < perDayQuota.opsTeams.length; i += 1) {
            const team = perDayQuota.opsTeams[i];

            if (team.id === body.opsTeamId) {
              finalTeam = team;
              break;
            }
          }
          if (finalTeam) {
            const teamQuota = finalTeam.quota.filter((item) => {
              const year = Object.keys(item)[0];

              return year === req.body.year;
            });

            if (teamQuota.length > 0) {
              obj.perDayQuota.opsTeams = {
                quota: teamQuota[0],
                id: finalTeam.id,
                name: finalTeam.name,
              };
            } else {
              obj.perDayQuota.opsTeams = {
                id: body.opsTeamId,
                quota: [],
                name: finalTeam.name,
              };
            }
          } else {
            obj.perDayQuota.opsTeams = {
              id: body.opsTeamId,
              quota: [],
            };
          }
        } else if (body.opsTeamId) {
          obj.perDayQuota.opsTeams = {
            id: body.opsTeamId,
            quota: [],
          };
        }
      } else {
        obj.perDayQuota = {
          quota: [],
        };
        if (body.opsTeamId) {
          obj.perDayQuota.opsTeams = {
            id: body.opsTeamId,
            quota: [],
          };
        }
      }

      return res.json({ status: true, data: obj });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async getCalenderForYear(req, res) {
    try {
      const id = req.body.opsGroupId;
      const opsGrp = await OpsGroup.findOne(
        { _id: id },
        { userId: 1, opsTeamId: 1 },
      );
      const opsleave = await OpsLeaves.findOne(
        { opsGroupId: id },
        { _id: 1, perDayQuota: 1, opsTeamId: 1 },
      );

      //    let userOnHoliday= await userHoliday.find({opsGroupId:id});//,fromdate:data.date
      //    const Ballots = await Ballot.find({opsGroupId : data.opsGroupId,isCanceled:false},{_id:1,ballotName:1,ballotStartDate:1,ballotEndDate:1,weekRange:1,wonStaff:1});
      // return res.json({opsleave, userOnHoliday})
      if (!opsleave) {
        res.status(203).json({
          status: false,
          data: null,
          message: 'couldent find this ops group in opsLeave',
        });
      }

      if (!req.body.opsTeamId) {
        if (!opsleave.perDayQuota) {
          res.status(203).json({
            status: false,
            data: null,
            message: 'Please set per day quota for requested ops group',
          });
        } else {
          const userOnHoliday = await leaveApplied.find({
            userId: { $in: opsGrp.userId },
            status: { $in: [0, 1, 3, 4, 7, 8] },
            $expr: { $eq: [{ $year: '$startDate' }, req.body.year] },
          });

          // return res.json({ userOnHoliday })
          if (opsleave.perDayQuota.quota.length > 0) {
            let isQuotaForYear = true;

            for (
              let q = 0;
              q <= opsleave.perDayQuota.quota.length - 1;
              q += 1
            ) {
              if (
                Object.prototype.hasOwnProperty.call(
                  opsleave.perDayQuota.quota[q],
                  req.body.year,
                )
              ) {
                isQuotaForYear = false;
                const finalData = opsleave.perDayQuota.quota[q];

                // return res.json({finalData, q})
                // if(finalData){
                for (let j = 0; j < finalData[req.body.year].length; j += 1) {
                  const dayData = finalData[req.body.year][j];
                  // Here I have dates of data.
                  // dd-mm-yyyy
                  let currdate = dayData.date.split('-');

                  // currdate = new Date(+currdate[2], currdate[1] - 1, +currdate[0] + 1).getTime();
                  currdate = new Date(
                    +currdate[2],
                    currdate[1] - 1,
                    +currdate[0],
                  ).getTime(); // Add +1 for local as above commented line

                  const woncount = 0;
                  const countUser = userOnHoliday.filter((item) => {
                    const datePartsss = new Date(item.startDate).getTime();
                    const dateParteee = new Date(item.endDate).getTime(); // Add 18.30 hours for local.

                    return currdate <= dateParteee && currdate >= datePartsss;
                  });
                  //  var filtered = countUser.filter(filterWithStatus);
                  const countFiltered = countUser.length; // - filtered.length;

                  const qo = parseInt(dayData.value, 10);
                  const v = qo - (countFiltered + woncount);

                  finalData[req.body.year][j].value = v;
                  finalData[req.body.year][j].quota = parseInt(qo, 10);
                }
                res.status(201).json({
                  status: true,
                  data: opsleave.perDayQuota.quota[q],
                  message: 'Found requested quota',
                });
              }
            }
            if (isQuotaForYear) {
              return res.json({
                status: false,
                data: null,
                message: 'Please set per day quota for requested ops group',
              });
            }
          } else {
            return res.json({
              status: false,
              data: null,
              message: 'Please set per day quota for requested ops group',
            });
          }
        }
      }

      const opsTm = await OpsTeam.findOne(
        { _id: req.body.opsTeamId },
        { userId: 1 },
      );

      if (!opsleave.perDayQuota) {
        res.status(203).json({
          status: false,
          data: null,
          message:
            'Please set per day quota for requested ops group and ops team',
        });
      } else {
        if (opsleave.perDayQuota.quota.length > 0) {
          for (let q = 0; q <= opsleave.perDayQuota.quota.length - 1; q += 1) {
            if (
              Object.prototype.hasOwnProperty.call(
                opsleave.perDayQuota.quota[q],
                req.body.year,
              )
            ) {
              break;
            }
          }
        }

        if (opsleave.perDayQuota.opsTeams.length > 0) {
          const allTeams = [];
          const filteOtherTeams = opsleave.perDayQuota.opsTeams.filter(
            (q) => q.id !== req.body.opsTeamId,
          );

          if (filteOtherTeams.length > 0) {
            for (let ot = 0; ot <= filteOtherTeams.length - 1; ot += 1) {
              const curreQuota = filteOtherTeams[ot].quota;
              const filterwithprop = curreQuota.filter((cc) =>
                Object.prototype.hasOwnProperty.call(cc, req.body.year),
              );

              if (filterwithprop.length > 0) {
                allTeams.push(filterwithprop[0]);
              }
            }
          }

          const opsTeamdata = opsleave.perDayQuota.opsTeams.filter(
            (q) => q.id === req.body.opsTeamId,
          );

          if (opsTeamdata.length > 0) {
            const userOnHoliday = await leaveApplied.find({
              userId: { $in: opsTm.userId },
              status: { $in: [1, 3, 4, 7, 8] },
              $expr: { $eq: [{ $year: '$startDate' }, req.body.year] },
            });

            let isQuotaForYear = true;

            for (let q = 0; q <= opsTeamdata[0].quota.length - 1; q += 1) {
              if (
                Object.prototype.hasOwnProperty.call(
                  opsTeamdata[0].quota[q],
                  req.body.year,
                )
              ) {
                isQuotaForYear = false;
                const finalData = opsTeamdata[0].quota[q];

                for (let j = 0; j < finalData[req.body.year].length; j += 1) {
                  const dayData = finalData[req.body.year][j];
                  let currdate = dayData.date.split('-');

                  currdate = new Date(
                    +currdate[2],
                    currdate[1] - 1,
                    +currdate[0],
                  ).getTime();
                  // get ballot won counts from ballots
                  const woncount = 0;
                  // Here I have dates of data from casual holidays.
                  const countUser = userOnHoliday.filter((item) => {
                    const datePartsss = new Date(item.startDate).getTime();
                    const dateParteee = new Date(item.endDate).getTime();

                    return currdate <= dateParteee && currdate >= datePartsss;
                  });
                  const countFiltered = countUser.length;
                  const qo = parseInt(dayData.value, 10);
                  const v = countFiltered + woncount;

                  finalData[req.body.year][j].quota = parseInt(qo, 10);
                  finalData[req.body.year][j].value =
                    finalData[req.body.year][j].quota - v;
                }
                // }
                res.status(201).json({
                  status: true,
                  data: finalData,
                  userOnHoliday,
                  message: 'Found requested quota 1',
                });
              }
            }
            if (isQuotaForYear) {
              return res.json({
                status: false,
                data: null,
                message: 'Please set per day quota for requested ops group',
              });
            }
          } else {
            res.status(203).json({
              status: false,
              data: null,
              message: 'Please set Quota Values for requested year first',
            });
          }
        } else {
          return res.json({
            status: false,
            data: null,
            message: 'Please set per day quota for requested ops group',
          });
        }
      }
    } catch (e) {
      res.status(203).json({
        status: false,
        data: null,
        message: 'something went worng or Please check selected year',
      });
    }
    return res;
  }

  async sendResponse(datar, res) {
    const response = [];

    const promiseData = [];
    const userOnHolidayListCall = async (key, value) => {
      try {
        const user = await User.findOne(
          { _id: key },
          { name: 1, staffId: 1, isLeaveSwapAllowed: 1 },
        );

        const User1 = {
          id: user._id,
          name: user.name,
          staffId: user.staffId,
          leaveStatus: value[value.length - 1].leaveStatus,
          type: value[value.length - 1].type,
          leavedata: value,
          isAllowedToSwap: user.isLeaveSwapAllowed,
        };

        if (value[0].status) {
          User1.status = value[value.length - 1].status;
        }

        response.push(User1);
      } catch (e) {
        res.status(501).json({
          status: false,
          data: null,
          message: 'Something went wrong!',
        });
      }
    };

    for (const [key, value] of Object.entries(datar.userOnHoliday)) {
      promiseData.push(userOnHolidayListCall(key, value));
    }

    await Promise.all(promiseData);

    delete datar.userOnHoliday;
    datar.userOnHoliday = response;
    res.status(201).json({
      status: true,
      data: datar,
      message: 'Successfully reveived data.',
    });
  }

  async allocateLeave(req, res) {
    try {
      const request = req.body;

      request.logs = [];
      const myLog = {
        updatedBy: req.user.name,
        message: 1, // 1-Allocation 2- Change date 3-cancellation,
        fromdate: request.fromdate,
        todate: request.todate,
      };

      request.logs.push(myLog);
      const userHoliday = new UserLeaves(request);

      const holiday = await userHoliday.save();
      const startdd = new Date(request.fromdate);
      const enddd = new Date(request.todate);
      let days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));

      days += 1;
      const pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select('opsGroup')
        .lean();

      let configurationNumber = 2;

      if (pageSettingData.opsGroup.blockLeaveConfiguration === 1) {
        configurationNumber = 2;
      }

      if (pageSettingData.opsGroup.blockLeaveConfiguration === 2) {
        configurationNumber = 1;
      }

      if (pageSettingData.opsGroup.blockLeaveConfiguration === 3) {
        configurationNumber = 0;
      }

      let daysToDeduct = days;

      if (daysToDeduct % 7 === 0) {
        let n = daysToDeduct / 7;

        n *= configurationNumber;
        daysToDeduct -= n;
      }

      if (daysToDeduct > 0 && daysToDeduct < 7) {
        if (daysToDeduct === 6) {
          daysToDeduct = 5;
        } else {
          daysToDeduct -= configurationNumber * 0;
        }
      }

      if (daysToDeduct > 7 && daysToDeduct < 14) {
        daysToDeduct -= configurationNumber * 1;
      }

      if (daysToDeduct > 14 && daysToDeduct < 21) {
        daysToDeduct -= configurationNumber * 2;
      }

      if (daysToDeduct > 21 && daysToDeduct < 28) {
        daysToDeduct -= configurationNumber * 3;
      }

      //   if(days%7 == 0){
      //       var no = days/7;
      //       let daysOfFreeLeaves = no*2;
      //       days = days - daysOfFreeLeaves;
      //   }
      await StaffSapData.update(
        { staff_Id: request.userId },
        { $inc: { ballotLeaveBalanced: -daysToDeduct } },
      );

      // let holiday= await userHoliday.save(userholiday);
      if (holiday) {
        res.status(201).json({
          status: true,
          data: holiday,
          message: 'Successfully Allocated leave to user.',
        });
        // Notification saying leave is allocated.
        const user = await User.findOne(
          { _id: req.body.userId },
          { _id: 0, deviceToken: 1 },
        );
        const usersDeviceTokens = [];
        const dd = new Date();

        if (user && user.deviceToken) {
          usersDeviceTokens.push(user.deviceToken);
          const collapseKey = holiday._id;
          let strt = holiday.fromdate.split('-');

          strt = `${strt[2]}-${strt[1]}-${strt[0]}`;
          let end = holiday.todate.split('-');

          end = `${end[2]}-${end[1]}-${end[0]}`;
          const notificationObj = {
            title: 'Leave Allocated.',
            body: `Leave dated from  ${strt} to ${end} has been allocated to you.`,
            bodyText: `Leave dated from  ${strt} to ${end} has been allocated to you.`,
            bodyTime: dd,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          };

          FCM.push(usersDeviceTokens, notificationObj, collapseKey);
        }
      } else {
        res.status(203).json({
          status: false,
          data: null,
          message: 'Unable to allocate leave',
        });
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: null, message: 'Something went wrong!' });
    }
  }

  async getMobileScreenForLeave(req, res) {
    try {
      const ops = await OpsGroup.findOne(
        { userId: req.body.userId, isDelete: false },
        { _id: 1, opsGroupName: 1 },
      );
      const user = await User.findOne(
        { _id: req.body.userId },
        { _id: 0, parentBussinessUnitId: 1 },
      ).populate({
        path: 'parentBussinessUnitId',
        select: 'name',
        populate: {
          path: 'sectionId',
          select: 'name',
          populate: {
            path: 'departmentId',
            select: 'name',
            populate: {
              path: 'companyId',
              select: 'name',
            },
          },
        },
      });
      const BU = `${user.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;
      //  .populate([{
      //      path:'parentBussinessUnitId',select:"name"
      //  }]);

      const dateParts = req.body.date.split('-');
      const dateObject = new Date(
        +dateParts[2],
        dateParts[1] - 1,
        +dateParts[0] + 1,
      );

      const leaves1 = await UserLeaves.find(
        { userId: req.body.userId },
        {
          _id: 1,
          fromdate: 1,
          todate: 1,
          type: 1,
          status: 1,
          attachment: 1,
          reason: 1,
          userId: 1,
          isSwapable: 1,
        },
      );
      // const Ballots = await Ballot.find({opsGroupId : ops._id,isCanceled:false},{_id:1,ballotName:1,ballotStartDate:1,ballotEndDate:1,weekRange:1,wonStaff:1});
      let leaves = JSON.stringify(leaves1);

      leaves = JSON.parse(leaves);
      let all = [];

      for (let leave = 0; leave <= leaves.length - 1; leave += 1) {
        // var datePartsss = leaves[leave].fromdate.split("-");
        // var dateParteee = leaves[leave].todate.split("-");
        const startdd = new Date(leaves[leave].fromdate);
        const startdd1 = nextDayUTC(startdd);
        const enddd = new Date(leaves[leave].todate);
        const end1 = nextDayUTC(enddd);

        if (dateObject <= end1 && dateObject >= startdd1) {
          leaves[leave].isCurrentDate = true;
        }
      }
      // From usersHolidays
      // var leaves1 = leaves.filter(ff=>ff.status !=='cancelled');
      all = all.concat(leaves);
      const dataToSend = { opsName: ops.opsGroupName, Bu: BU, leave: all };

      res.status(201).json({
        status: true,
        data: dataToSend,
        message: 'successfully received data.',
      });
    } catch (e) {
      res
        .status(500)
        .json({ status: false, data: e, message: 'Something went wrong.' });
    }
  }

  async cancelLeaveForStaff(req, res) {
    try {
      const holiday = await UserLeaves.findOne({ _id: req.body._id });
      const user = await User.findOne(
        { _id: req.body.userid },
        { _id: 0, deviceToken: 1 },
      );

      if (holiday) {
        const log = holiday.logs;
        const myLog = {
          updatedBy: req.user.name,
          message: 3, // 1-Allocation 2- Change date 3-cancellation,
          fromdate: holiday.fromdate,
          todate: holiday.todate,
        };

        log.push(myLog);
        holiday.logs = log;
        holiday.status = 'cancelled';
        try {
          await holiday.save();
          const startdd = new Date(holiday.fromdate);
          const enddd = new Date(holiday.todate);
          let days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));

          days += 1;
          const daysAsLeaves = await noOfDays(res, days);

          await StaffSapData.update(
            { staff_Id: holiday.userId },
            { $inc: { ballotLeaveBalanced: daysAsLeaves } },
          );
        } catch (e) {
          res.status(203).json({ status: false, data: e, message: 'error' });
        }
        res
          .status(201)
          .json({ status: false, data: holiday, message: 'Cancelled leave' });
        // Notification saying leave is cancelled.
        const usersDeviceTokens = [];
        const dd = new Date();

        if (user && user.deviceToken) {
          let leaveType = 'Casual';

          if (holiday.type === 1 || holiday.type === 3) {
            leaveType = 'Block';
          }

          usersDeviceTokens.push(user.deviceToken);
          const collapseKey = holiday._id;
          let strt = holiday.fromdate.split('-');

          strt = `${strt[2]}-${strt[1]}-${strt[0]}`;
          let end = holiday.todate.split('-');

          end = `${end[2]}-${end[1]}-${end[0]}`;
          const notificationObj = {
            title: 'Your Leave has been cancelled.',
            body: `Your ${leaveType} leave dated from ${strt} to ${end} has been cancelled.`,
            bodyText: `Your ${leaveType} leave dated from ${strt} to ${end} has been cancelled.`,
            bodyTime: dd,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          };

          FCM.push(usersDeviceTokens, notificationObj, collapseKey);
        }
      } else {
        res.status(203).json({
          status: false,
          data: null,
          message: 'Sorry ! couldnt find similar data',
        });
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: null, message: 'Something went wrong!' });
    }
  }

  async changeLeaveDates(req, res) {
    const data = req.body;
    let frmDt = data.startdate.split('-');

    frmDt = `${frmDt[2]}-${frmDt[1]}-${frmDt[0]}`;
    let toDt = data.enddate.split('-');

    toDt = `${toDt[2]}-${toDt[1]}-${toDt[0]}`;
    // Check if these dates lready assigned;
    let dates = [];
    const startdd = new Date(frmDt);
    const enddd = new Date(toDt);

    // check in that dates.
    dates = getDateArray(startdd, enddd);
    const leaves = await UserLeaves.find({
      userId: data.userId,
      status: { $ne: 'cancelled' },
      type: { $in: [1, 2] },
    });

    for (let km = 0; km <= dates.length - 1; km += 1) {
      for (let leave = 0; leave <= leaves.length - 1; leave += 1) {
        const leavestart = new Date(leaves[leave].fromdate);
        const leaveend = new Date(leaves[leave].todate);

        if (
          dates[km] >= leavestart &&
          dates[km] <= leaveend &&
          leaves[leave].status !== 'cancelled'
        ) {
          // 0 says dates overlapping..
          return res.status(203).json({
            status: false,
            data: null,
            message: 'Dates Overlapping',
          });
          // break;
        }
      }
    }
    try {
      const leave = await UserLeaves.findOne({ _id: data._id });
      let existingleavedates = [];
      const currentStartDate = new Date(leave.fromdate);
      const currentEndDate = new Date(leave.todate);

      // check in that dates.
      existingleavedates = getDateArray(currentStartDate, currentEndDate);
      // let leave = JSON.stringify(Leave);
      // leave = JSON.parse(leave);
      let returnData;

      if (dates.length >= 5) {
        if (leave.type === 1 || leave.type === 3) {
          const existingdates = await noOfDays(res, existingleavedates.length);

          await StaffSapData.update(
            { staff_Id: leave.userId },
            { $inc: { ballotLeaveBalanced: existingdates } },
          );
          const log = leave.logs;
          const myLog = {
            updatedBy: req.user.name,
            message: 2, // 1-Allocation 2- Change date 3-cancellation,
            fromdate: leave.fromdate,
            todate: leave.todate,
            fromCurrentdate: req.body.startdate,
            toCurrentdate: req.body.enddate,
          };

          log.push(myLog);
          leave.logs = log;
          leave.fromdate = frmDt;
          leave.todate = toDt;
          leave.status = 'Allocated';
          leave.type = 3;
          leave.isSwapable = data.isSwapable;
          await leave.save();
          const daysTodeduct = await noOfDays(res, dates.length);

          // var existingdates = await noOfDays(existingleavedates.length);
          //     if((dates.length)%7 == 0){
          //        var no = days/7;
          //        let daysOfFreeLeaves = no*2;
          //        daysTodeduct = daysTodeduct - daysOfFreeLeaves;
          //    }
          await StaffSapData.update(
            { staff_Id: leave.userId },
            { $inc: { ballotLeaveBalanced: -daysTodeduct } },
          );

          returnData = res.status(201).json({
            status: false,
            data: leave,
            message: 'dates changed',
          });
        } else {
          returnData = res.status(203).json({
            status: false,
            data: leave,
            message: 'Casual leave cannot be more than 5 days.',
          });
        }
      } else if (leave.type === 2) {
        const log = leave.logs;
        const myLog = {
          updatedBy: req.user.name,
          message: 2, // 1-Allocation 2- Change date 3-cancellation,
          fromdate: leave.fromdate,
          todate: leave.todate,
          fromCurrentdate: req.body.startdate,
          toCurrentdate: req.body.enddate,
        };

        log.push(myLog);
        leave.logs = log;
        leave.fromdate = frmDt;
        leave.todate = toDt;
        leave.status = 'Allocated';
        leave.type = 2;
        await leave.save();
        if (existingleavedates.length > dates.length) {
          const diff = existingleavedates.length - dates.length;

          await StaffSapData.update(
            { staff_Id: leave.userId },
            { $inc: { ballotLeaveBalanced: diff } },
          );
        } else if (dates.length > existingleavedates.length) {
          const diff = dates.length - existingleavedates.length;

          await StaffSapData.update(
            { staff_Id: leave.userId },
            { $inc: { ballotLeaveBalanced: -diff } },
          );
        }

        returnData = res.status(201).json({
          status: false,
          data: leave,
          message: 'dates changed',
        });
      } else {
        returnData = res.status(203).json({
          status: false,
          data: leave,
          message: 'Block leave cannot be less than 5 days.',
        });
      }

      const user = await User.findOne(
        { _id: leave.userId },
        { _id: 1, name: 1, deviceToken: 1 },
      );
      const usersDeviceTokens = [];
      const dd = new Date();

      if (user && user.deviceToken) {
        let leaveType = 'Casual';

        if (leave.type === 1 || leave.type === 3) {
          leaveType = 'Block';
        }

        usersDeviceTokens.push(user.deviceToken);
        const collapseKey = leave._id;
        const notificationObj = {
          title: 'Leave Changed.',
          body: `Your ${leaveType} Leaves dates have been changed to ${data.startdate} to ${data.enddate}`,
          bodyText: `Your ${leaveType} Leaves dates have been changed to ${data.startdate} to ${data.enddate}`,
          bodyTime: dd,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };

        FCM.push(usersDeviceTokens, notificationObj, collapseKey);
      }

      return returnData;
    } catch (e) {
      return res.status(500).json({
        status: false,
        data: e,
        message: 'Something went wrong!.',
      });
    }
  }

  async findIfDateIsAssigned(req, res) {
    try {
      if (!req.body.opsGroupId || !req.body.userId) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'please select user and OpsGroup.',
        });
      }

      const ballotBalance = await StaffSapData.findOne(
        { staff_Id: req.body.userId },
        { ballotLeaveBalanced: 1 },
      );

      if (!ballotBalance) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'Could not find leave balance for this staff.',
        });
      }

      const pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select('opsGroup')
        .lean();

      let dates = [];
      // var startDate = req.body.fromdate.split("-");
      const startdd = new Date(req.body.fromdate);

      // let endDate= req.body.todate.split("-");
      const enddd = new Date(req.body.todate);

      // check in that dates.
      dates = getDateArray(startdd, enddd);
      let configurationNumber = 2;

      if (pageSettingData.opsGroup.blockLeaveConfiguration === 1) {
        configurationNumber = 2;
      }

      if (pageSettingData.opsGroup.blockLeaveConfiguration === 2) {
        configurationNumber = 1;
      }

      if (pageSettingData.opsGroup.blockLeaveConfiguration === 3) {
        configurationNumber = 0;
      }

      let daysToDeduct = dates.length;

      if (daysToDeduct % 7 === 0) {
        let n = daysToDeduct / 7;

        n *= configurationNumber;
        daysToDeduct -= n;
      }

      if (daysToDeduct > 0 && daysToDeduct < 7) {
        if (daysToDeduct === 6) {
          daysToDeduct = 5;
        } else {
          daysToDeduct -= configurationNumber * 0;
        }
      }

      if (daysToDeduct > 7 && daysToDeduct < 14) {
        daysToDeduct -= configurationNumber * 1;
      }

      if (daysToDeduct > 14 && daysToDeduct < 21) {
        daysToDeduct -= configurationNumber * 2;
      }

      if (daysToDeduct > 21 && daysToDeduct < 28) {
        daysToDeduct -= configurationNumber * 3;
      }

      if (parseInt(ballotBalance.ballotLeaveBalanced, 10) < daysToDeduct) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'This staff does not have sufficient leave ballance',
        });
      }

      const leaves = await UserLeaves.find(
        { userId: req.body.userId },
        { _id: 1, fromdate: 1, todate: 1, type: 1, status: 1 },
      );

      // const Ballots = await Ballot.find({opsGroupId : req.body.opsGroupId,isCanceled:false},{_id:1,ballotName:1,ballotStartDate:1,ballotEndDate:1,weekRange:1,wonStaff:1});
      for (let km = 0; km <= dates.length - 1; km += 1) {
        for (let leave = 0; leave <= leaves.length - 1; leave += 1) {
          const leavestart = new Date(leaves[leave].fromdate);
          const leaveend = new Date(leaves[leave].todate);

          if (
            dates[km] >= leavestart &&
            dates[km] <= leaveend &&
            leaves[leave].status !== 'cancelled'
          ) {
            return res.status(203).json({
              status: false,
              data: null,
              message:
                'Dates overlapping.. please check this user has assigned leave in requested period',
            });
            // break;
          }
        }
      }
      return res
        .status(201)
        .json({ status: false, message: 'Everything is Fine' });
    } catch (e) {
      return res
        .status(500)
        .json({ status: false, message: 'Something went wrong!' });
    }
  }

  async getLeaveByUser(req, res) {
    try {
      if (!req.body.opsGroupId || !req.body.userId) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'please select user and OpsGroup.',
        });
      }

      let isSwap = true;
      const ops = await OpsGroup.findOne(
        { _id: req.body.opsGroupId },
        { swopSetup: 1, userId: 1 },
      );

      if (ops && ops.swopSetup) {
        const isSwappable = parseInt(ops.swopSetup, 10);

        if (isSwappable === 0) {
          isSwap = false;
        } else {
          isSwap = true;
        }
      }

      const leaves = await UserLeaves.find(
        { userId: req.body.userId },
        { _id: 1, fromdate: 1, todate: 1, type: 1, status: 1, isSwapable: 1 },
      );

      for (let l = 0; l <= leaves.length - 1; l += 1) {
        if (leaves[l].isSwapable !== true) {
          leaves[l].isSwapable = isSwap;
        }
      }

      // From usersHolidays
      const leaves1 = leaves.filter((ff) => ff.status !== 'cancelled');
      const resp = { isSwap, data: leaves1 };

      return res.status(201).json({
        status: true,
        data: resp,
        message: 'successfully received data.',
      });
    } catch (e) {
      return res
        .status(500)
        .json({ status: false, message: 'Something went wrong!' });
    }
  }

  async getUserLeaveLogs(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({ errorMessage: errors.array() });
      }

      let leaves = await LeaveLog.find({
        userId: req.body.userId,
        $expr: { $eq: [{ $year: '$startDate' }, req.body.year] },
        $or: [
          {
            isChangeDate: true,
          },
          { status: 5 },
          {
            submittedFrom: 3,
          },
        ],
      }).populate([
        {
          path: 'cancelledBy',
          select: 'staffId name',
        },
        {
          path: 'changeDateHistory.changeBy',
          select: 'staffId name',
        },
        {
          path: 'allocatedBy',
          select: 'staffId name',
        },
      ]);

      leaves = JSON.parse(JSON.stringify(leaves));
      const finalLeave = [];

      for (let i = 0; i < leaves.length; i += 1) {
        if (leaves[i].isChangeDate) {
          const obj = leaves[i];

          for (let j = 0; j < obj.changeDateHistory.length; j += 1) {
            obj.changedBy = obj.changeDateHistory[j];
            finalLeave.push(obj);
          }
        } else {
          finalLeave.push(leaves[i]);
        }
      }
      res.status(201).json({
        status: true,
        data: leaves,
        message: 'successfully received data.',
      });
    } catch (e) {
      res.status(500).json({ status: false, message: 'Something went wrong!' });
    }
  }

  async getUsersListWithSwap(req, res) {
    const requestdata = req.body;

    try {
      if (requestdata.opsTeamId) {
        // ops team id is present there.
        const users = await OpsTeam.findOne(
          { _id: requestdata.opsTeamId },
          { _id: 0, userId: 1 },
        );
        const leaves = await UserLeaves.find(
          { userId: { $in: users.userId } },
          {
            _id: 0,
            fromdate: 1,
            todate: 1,
            type: 1,
            status: 1,
            isSwapable: 1,
            userId: 1,
          },
        );
        // const Ballotings = await Ballot.find({opsGroupId : requestdata.opsGroupId,isCanceled:false},{_id:1,ballotName:1,ballotStartDate:1,ballotEndDate:1,weekRange:1,wonStaff:1});
        let wons = [];

        wons = wons.concat(leaves);
        const data = groupBy(wons, 'userId');
        // find data of individual user
        const response = [];

        const promiseData1 = [];
        const promisesCall = async (key, value) => {
          try {
            const ops = await OpsGroup.findOne(
              { userId: key, isDelete: false },
              { swopSetup: 1 },
            );
            const user = await User.findOne(
              { _id: key },
              { name: 1, staffId: 1, isLeaveSwapAllowed: 1 },
            );

            ops.swopSetup = parseInt(ops.swopSetup, 10);
            let isSwap = false;

            if (ops.swopSetup === 0) {
              isSwap = false;
              if (user.isLeaveSwapAllowed === true) {
                isSwap = false;
              } else if (
                Object.prototype.hasOwnProperty.call(user, 'isLeaveSwapAllowed')
              ) {
                isSwap = user.isLeaveSwapAllowed;
              } else if (user.isLeaveSwapAllowed === false) {
                isSwap = false;
              } else {
                isSwap = false;
              }
            } else {
              isSwap = false;
              if (user.isLeaveSwapAllowed === true) {
                isSwap = true;
              } else if (
                Object.prototype.hasOwnProperty.call(user, 'isLeaveSwapAllowed')
              ) {
                isSwap = user.isLeaveSwapAllowed;
              } else if (user.isLeaveSwapAllowed === false) {
                isSwap = false;
              } else {
                isSwap = false;
              }
            }

            value.map((entry) => {
              if (entry.type === 1) {
                if (ops.swopSetup === 0) {
                  entry.isSwapable = false;
                } else {
                  entry.isSwapable = true;
                }
              }

              return entry;
            });
            const User1 = {
              id: user._id,
              name: user.name,
              staffId: user.staffId,
              leavedata: value,
              isAllowedToSwap: isSwap,
            };

            response.push(User1);
          } catch (e) {
            // res.send(e);
          }
        };

        for (const [key, value] of Object.entries(data)) {
          promiseData1.push(promisesCall(key, value));
        }

        await Promise.all(promiseData1);
        res.status(201).json({
          status: true,
          data: response,
          message: 'successfully received data.',
        });
      } else {
        const users = await OpsGroup.findOne(
          { _id: requestdata.opsGroupId },
          { _id: 0, userId: 1 },
        );
        const leaves = await UserLeaves.find(
          { userId: { $in: users.userId } },
          {
            _id: 0,
            fromdate: 1,
            todate: 1,
            type: 1,
            status: 1,
            isSwapable: 1,
            userId: 1,
          },
        );
        let wons = [];

        wons = wons.concat(leaves);
        const data = groupBy(wons, 'userId');
        // find data of individual user
        const response = [];

        const promiseData = [];
        const OpsGroupListCall = async (key, value) => {
          try {
            const ops = await OpsGroup.findOne(
              { userId: key, isDelete: false },
              { swopSetup: 1 },
            );
            const user = await User.findOne(
              { _id: key },
              { name: 1, staffId: 1, isLeaveSwapAllowed: 1 },
            );

            ops.swopSetup = parseInt(ops.swopSetup, 10);
            let isSwap = false;

            if (ops.swopSetup === 0) {
              isSwap = false;
              if (user.isLeaveSwapAllowed === true) {
                isSwap = false;
              } else if (
                Object.prototype.hasOwnProperty.call(user, 'isLeaveSwapAllowed')
              ) {
                isSwap = user.isLeaveSwapAllowed;
              } else if (user.isLeaveSwapAllowed === false) {
                isSwap = false;
              } else {
                isSwap = false;
              }
            } else {
              isSwap = false;
              if (user.isLeaveSwapAllowed === true) {
                isSwap = true;
              } else if (
                Object.prototype.hasOwnProperty.call(user, 'isLeaveSwapAllowed')
              ) {
                isSwap = user.isLeaveSwapAllowed;
              } else if (user.isLeaveSwapAllowed === false) {
                isSwap = false;
              } else {
                isSwap = false;
              }
            }

            value.map((entry) => {
              if (entry.type === 1) {
                if (ops.swopSetup === 0) {
                  entry.isSwapable = false;
                } else {
                  entry.isSwapable = true;
                }
              }

              return entry;
            });

            const User1 = {
              id: user._id,
              name: user.name,
              staffId: user.staffId,
              leavedata: value,
              isAllowedToSwap: isSwap,
            };

            return response.push(User1);
          } catch (e) {
            return res
              .status(500)
              .json({ status: false, message: 'Something went wrong!', e });
          }
        };

        for (const [key, value] of Object.entries(data)) {
          promiseData.push(OpsGroupListCall(key, value));
        }

        await Promise.all(promiseData);
        res.status(201).json({
          status: true,
          data: response,
          message: 'successfully received data.',
        });
      }
    } catch (e) {
      res.status(500).json({ status: false, message: 'Something went wrong!' });
    }
  }

  async getUsersListWithSwapNew(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({ errorMessage: errors.array() });
      }

      const requestdata = req.body;

      if (requestdata.opsTeamId) {
        // ops team id is present there.
        const users = await OpsTeam.findOne(
          { _id: requestdata.opsTeamId },
          { _id: 0, userId: 1 },
        ).populate([
          {
            path: 'userId',
            select: 'name staffId isLeaveSwapAllowed',
          },
        ]);

        res.status(201).json({
          status: true,
          data: users,
          message: 'successfully received data.',
        });
      } else {
        const users = await OpsGroup.findOne(
          { _id: requestdata.opsGroupId },
          { _id: 0, userId: 1 },
        ).populate([
          {
            path: 'userId',
            select: 'name staffId isLeaveSwapAllowed',
          },
        ]);

        res.status(201).json({
          status: true,
          data: users,
          message: 'successfully received data.',
        });
      }
    } catch (e) {
      res.status(500).json({ status: false, message: 'Something went wrong!' });
    }
  }

  async swapRestrictToUser(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      const userId = req.params.userid;
      const user = await User.findOne(
        { _id: userId },
        { isLeaveSwapAllowed: 1 },
      );

      if (user.isLeaveSwapAllowed && user.isLeaveSwapAllowed === true) {
        await User.findByIdAndUpdate(
          { _id: userId },
          { $set: { isLeaveSwapAllowed: false } },
        );
        return res
          .status(201)
          .json({ status: true, message: 'successfully updated.' });
      }

      await User.findByIdAndUpdate(
        { _id: userId },
        { $set: { isLeaveSwapAllowed: true } },
      );

      return res
        .status(201)
        .json({ status: true, message: 'successfully updated.' });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async checkForDateOverlapWhenApply(res, data) {
    try {
      let dates = [];
      const startDate = data.fromdate.split('-');
      const startdd = new Date(
        +startDate[2],
        startDate[1] - 1,
        +startDate[0] + 1,
      );
      const endDate = data.todate.split('-');
      const enddd = new Date(+endDate[2], endDate[1] - 1, +endDate[0] + 1);

      // check in that dates.
      dates = getDateArray(startdd, enddd);
      const leaves = await UserHoliday.find(
        { userId: data.userId },
        { _id: 1, fromdate: 1, todate: 1, type: 1 },
      );
      const Ballots = await Ballot.find(
        { opsGroupId: data.opsGroupId, isCanceled: false },
        {
          _id: 1,
          ballotName: 1,
          ballotStartDate: 1,
          ballotEndDate: 1,
          weekRange: 1,
          wonStaff: 1,
        },
      );

      for (let km = 0; km <= dates.length - 1; km += 1) {
        for (let leave = 0; leave <= leaves.length - 1; leave += 1) {
          let leaveend;
          let leavestart = leaves[leave].fromdate.split('-');

          leavestart = new Date(
            +leavestart[2],
            leavestart[1] - 1,
            +leavestart[0] + 1,
          );
          if (leaves[leave].todate) {
            leaveend = leaves[leave].todate.split('-');
            leaveend = new Date(
              +leaveend[2],
              leaveend[1] - 1,
              +leaveend[0] + 1,
            );
          }

          if (
            dates[km] >= leavestart &&
            dates[km] <= leaveend &&
            leaves[leave].status !== 'cancelled'
          ) {
            return 0; // 0 says dates overlapping..
            // break;
          }
        }
      }
      // check with Ballots as well
      for (let km = 0; km <= dates.length - 1; km += 1) {
        for (let bb = 0; bb <= Ballots.length - 1; bb += 1) {
          for (let dm = 0; dm <= Ballots[bb].weekRange.length - 1; dm += 1) {
            const start = new Date(Ballots[bb].weekRange[dm].start);
            const end = new Date(Ballots[bb].weekRange[dm].end);
            const end1 = nextDayUTC(end);

            if (dates[km] <= end1 && dates[km] >= start) {
              const wondate = Ballots[bb].wonStaff.filter(
                (ws) =>
                  ws.opsGroupId === data.opsGroupId &&
                  ws.userId === data.userId &&
                  ws.weekNo === dm,
              );

              if (wondate.length > 0) {
                return 0; // 0 says dates overlapping
                // return res.status(203).json({status: false, data: null, message: "Dates overlapping.. plese check if this user has won some ballots"});
              }
            }

            // to add day in end date found from end date of ballot weekRange.
          }
        }
      }
      return 1;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async applyForLeave(req, res) {
    try {
      const request = req.body;
      const ops = await OpsGroup.findOne(
        { userId: request.userId, isDelete: false },
        { _id: 1 },
      );
      const opsTeam = await OpsTeam.findOne(
        { userId: request.userId, isDeleted: false },
        { _id: 1 },
      );
      const data = {
        fromdate: request.fromdate,
        todate: request.todate,
        userId: request.userId,
        opsGroupId: ops._id,
      };
      const check = await this.checkForDateOverlapWhenApply(res, data);

      if (check === 0) {
        return res.status(300).json({
          success: false,
          data: check,
          message: 'Dates overlapping!',
        });
      }

      const myLog = {
        updatedBy: req.user.name,
        message: 4, // 1-Allocation 2- Change date 3-cancellation,4-applied
        fromdate: request.fromdate,
        todate: request.todate,
      };
      const leaveapplication = {
        userId: request.userId,
        username: req.user.name,
        fromdate: request.fromdate,
        todate: request.todate,
        type: request.leaveType,
        reason: request.reason,
        status: 'Applied',
        opsGroupId: ops._id,
        logs: [myLog],
      };

      if (req.body.attachment) {
        leaveapplication.attachment = req.body.attachment[0].url;
        leaveapplication.fileName = req.body.attachment[0].fileName;
      }

      if (opsTeam) {
        leaveapplication.opsTeamId = opsTeam._id;
      }

      const apply = new UserHoliday(leaveapplication);

      apply.save((err, applied) => {
        if (err) {
          return res.status(500).json({
            success: false,
            data: err,
            message: 'Something went wrong!',
          });
        }

        return res.status(201).json({
          success: true,
          data: applied,
          message: 'Successfully saved!',
        });
      });
      return null;
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong!',
      });
    }
  }

  async getMyLeaves(req, res) {
    // In this api , neet to also give swop /no swop status to show and hide swop buttons on mobile
    const userrequested = req.user._id;

    try {
      const leaves1 = await UserHoliday.find(
        { userId: userrequested },
        {
          _id: 1,
          fromdate: 1,
          todate: 1,
          username: 1,
          type: 1,
          status: 1,
          isSwapable: 1,
        },
      );
      let leaves = JSON.stringify(leaves1);

      leaves = JSON.parse(leaves);

      const promiseData = [];
      const leavesListCall = async (l) => {
        const datePartsss = leaves[l].fromdate.split('-');
        const dateParteee = leaves[l].todate.split('-');
        const startdd = new Date(
          +datePartsss[2],
          datePartsss[1] - 1,
          +datePartsss[0] + 1,
        );
        const enddd = new Date(
          +dateParteee[2],
          dateParteee[1] - 1,
          +dateParteee[0] + 1,
        );
        const leaveswaprequest = await SwopRequests.find({
          userTo: req.user._id,
          leaveTo: leaves[l]._id,
        });

        if (leaveswaprequest && leaveswaprequest.length > 0) {
          leaves[l].isSwapRequest = true;
          const pendings = leaveswaprequest.filter(
            (x) => x.requestStatus === 1,
          );

          if (pendings.length > 0) {
            leaves[l].swapCount = pendings.length;
          }
        }

        try {
          const days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));

          leaves[l].days = days + 1;
          return leaves;
        } catch (e) {
          return res.status(500).json({
            success: false,
            data: e,
            message: 'Something went wrong!',
          });
        }
      };

      for (let l = 0; l <= leaves.length - 1; l += 1) {
        promiseData.push(leavesListCall(l));
      }

      await Promise.all(promiseData);

      return res.status(201).json({
        success: true,
        data: leaves,
        message: 'received!',
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong!',
      });
    }
  }

  // Upload social banner image
  async uploadAtachment(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      // const result = await __.scanFile(req.file.filename, `public/uploads/leaves/${req.file.filename}`);
      // if (!!result) {
      //     return __.out(res, 300, result);
      // }
      return __.out(res, 201, {
        filePath: `uploads/leaves/${req.file.filename}`,
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async getLeaveById(req, res) {
    const leaveId = req.params.id;

    try {
      const leave = await UserHoliday.findOne(
        { _id: leaveId },
        {
          userId: 1,
          username: 1,
          fromdate: 1,
          todate: 1,
          attachment: 1,
          isSwapable: 1,
          type: 1,
        },
      );

      return res.status(201).json({
        success: true,
        data: leave,
        message: 'received!',
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong!',
      });
    }
  }

  async updateLeave(req, res) {
    try {
      const currentLeave = await UserHoliday.findOne({ _id: req.body._id });

      const data = {
        opsGroupId: currentLeave.opsGroupId,
        userId: req.user._id,
        fromdate: req.body.fromdate,
        todate: req.body.todate,
        idis: currentLeave._id,
      };
      const check = await this.checkForDateOverlapWhenApply(res, data);

      if (check === 0) {
        return res.status(300).json({
          success: false,
          data: check,
          message: 'Dates overlapping!',
        });
      }

      if (currentLeave) {
        const log = currentLeave.logs;
        const myLog = {
          updatedBy: req.user.name,
          message: 2, // 1-Allocation 2- Change date 3-cancellation,
          fromdate: currentLeave.fromdate,
          todate: currentLeave.todate,
          fromCurrentdate: req.body.fromdate,
          toCurrentdate: req.body.todate,
        };

        log.push(myLog);

        currentLeave.logs = log;
        currentLeave.fromdate = req.body.fromdate;
        currentLeave.todate = req.body.todate;
        currentLeave.type = req.body.type;
        currentLeave.isSwapable = req.body.isSwapable;
        // currentLeave.attachment = req.body.isSwapable;
        await currentLeave.save();
        return res.status(201).json({
          success: true,
          data: currentLeave,
          message: 'Updated Successfully!',
        });
      }

      return res.status(203).json({
        status: false,
        data: null,
        message: 'Sorry ! couldnt find similar data',
      });
    } catch (e) {
      return res
        .status(501)
        .json({ status: false, data: null, message: 'Something went wrong!' });
    }
  }

  async checkIfHasParent(res, ballotid) {
    try {
      const currentBallot = await Ballot.findOne(
        { _id: ballotid },
        { parentBallot: 1, childBallots: 1 },
      );

      if (!currentBallot) {
        // console.logs("NO ballot found");
      } else {
        // console.logs("in else of current data found");
        if (currentBallot.parentBallot) {
          // console.logs("in if of parent data",currentBallot.parentBallot);
          return this.checkIfHasParent(res, currentBallot.parentBallot);
        }

        if (
          currentBallot.childBallots &&
          currentBallot.childBallots.length > 0
        ) {
          let list = [];

          list.push(currentBallot._id);
          list = list.concat(currentBallot.childBallots);
          return list;
        }
      }

      return __.out(res, 500, 'Ballot Not Found');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getSwapDetailChanges(req, res) {
    try {
      const reqdata = req.body;
      const leave = await UserLeaves.findOne({ _id: reqdata.leaveId });
      const frm = leave.fromdate;
      const tm = leave.todate;

      const slotDates = { start: frm, end: tm };
      const ops = await OpsGroup.findOne(
        { userId: req.user._id, isDelete: false },
        { opsGroupName: 1, swopSetup: 1, userId: 1 },
      );

      // .populate({path:'userId',select:'name staffId'});
      if (ops) {
        const currentuser = await User.findOne(
          { _id: req.user._id },
          { _id: 0, parentBussinessUnitId: 1 },
        ).populate({
          path: 'parentBussinessUnitId',
          select: 'name',
          populate: {
            path: 'sectionId',
            select: 'name',
            populate: {
              path: 'departmentId',
              select: 'name',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
        });
        const BU = `${currentuser.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${currentuser.parentBussinessUnitId.sectionId.departmentId.name} > ${currentuser.parentBussinessUnitId.sectionId.name} > ${currentuser.parentBussinessUnitId.name}`;
        const resObj = {};
        const allUsers = ops.userId.filter(
          (op) => op.toString() !== req.user._id.toString(),
        );
        let allLeaves = [];

        if (leave.type === 1 || leave.type === 3) {
          const balloted = await UserLeaves.find({
            type: 1,
            status: 'Balloted',
            userId: { $in: allUsers },
          });

          allLeaves = allLeaves.concat(balloted);
          const blockAllocated = await UserLeaves.find({
            type: 3,
            status: 'Allocated',
            userId: { $in: allUsers },
          });

          allLeaves = allLeaves.concat(blockAllocated);
        } else {
          const casualAllocated = await UserLeaves.find({
            type: 2,
            status: 'Allocated',
            userId: { $in: allUsers },
          });

          allLeaves = allLeaves.concat(casualAllocated);
        }

        resObj.Bu = BU;
        resObj.opsName = ops.opsGroupName;
        resObj.opsGroupId = ops._id;
        if (leave.type === 1) {
          resObj.type = 'Block-Balloted';
        }

        if (leave.type === 3) {
          resObj.type = 'Block-Allocated';
        }

        if (leave.type === 2) {
          resObj.type = 'Casual';
        }

        if (leave.type === 4) {
          resObj.type = 'Special';
        }

        const datePartsss = leave.fromdate;
        const dateParteee = leave.todate;
        const startdd = new Date(datePartsss);
        const enddd = new Date(dateParteee);
        let days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));

        days += 1;
        resObj.leavedays = days - 2;
        resObj.currentdates = slotDates;
        // resObj.users=users,
        resObj.leaveId = reqdata.leaveId;
        resObj.weekRange = [];
        for (let key = 0; key <= allLeaves.length - 1; key += 1) {
          if (
            !(
              leave.fromdate === allLeaves[key].fromdate &&
              leave.todate === allLeaves[key].todate
            )
          ) {
            const from = allLeaves[key].fromdate;
            const to = allLeaves[key].todate;
            const frmdd = new Date(from);
            const todd = new Date(to);
            let totaldays = Math.floor((todd - frmdd) / (1000 * 60 * 60 * 24));

            totaldays += 1;
            let type = '';

            if (totaldays > 7) {
              type = 'Non-standanrd';
            } else {
              type = 'standard';
            }

            const range = {
              date: frmdd,
              start: from,
              end: to,
              days: totaldays,
              type,
            };

            resObj.weekRange.push(range);
          }
        }

        if (leave.type === 1 || leave.type === 3) {
          let weekRange = [];
          const standards = resObj.weekRange.filter(
            (qq) => qq.type === 'standard',
          );
          const BB = standards.sort((a, b) => b.date - a.date);

          BB.reverse();
          const trrObject = removeDuplicates(BB, 'start', 'end');

          weekRange = weekRange.concat(trrObject);
          const nonstandards = resObj.weekRange.filter(
            (qq) => qq.type === 'Non-standanrd',
          );
          const BB1 = nonstandards.sort((a, b) => b.date - a.date);

          BB1.reverse();
          weekRange = weekRange.concat(BB1);
          resObj.weekRange = [];
          resObj.weekRange = weekRange;
        } else {
          //  let weekRange = resObj.weekRange;
          const BB = resObj.weekRange.sort((a, b) => b.date - a.date);

          BB.reverse();
          resObj.weekRange = [];
          resObj.weekRange = BB;
        }

        //  var trrObject=  removeDuplicates(resObj.weekRange, 'start','end');
        // resObj.weekRange = trrObject;
        return res.status(201).json({
          success: true,
          data: resObj,
          message: 'received!',
        });
      }

      return res.status(300).json({
        success: false,
        data: null,
        message: "Couldn't find ops group data of you.",
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getslotswonByUser(req, res) {
    try {
      const leave = await UserLeaves.findOne({ _id: req.body.leaveId });
      let dates = [];
      let startDate = req.body.start.split('-');

      startDate = `${startDate[2]}-${startDate[1]}-${startDate[0]}`;
      startDate = startDate.split('-');
      const startdd = new Date(
        +startDate[2],
        startDate[1] - 1,
        +startDate[0] + 1,
      );
      // let startdd = new Date(req.body.start);
      // let enddd = new Date(req.body.end);
      let endDate = req.body.end.split('-');

      endDate = `${endDate[2]}-${endDate[1]}-${endDate[0]}`;
      endDate = endDate.split('-');
      const enddd = new Date(+endDate[2], endDate[1] - 1, +endDate[0] + 1);

      // check in that dates.
      dates = await getDateArray(startdd, enddd);
      const ops = await OpsGroup.findOne(
        { _id: req.body.opsGroupId },
        { opsGroupName: 1, userId: 1 },
      );
      const allUsers = ops.userId.filter(
        (op) => op.toString() !== req.user._id.toString(),
      );
      let userleaves = [];

      if (leave.type === 1 || leave.type === 3) {
        userleaves = await UserLeaves.find({
          userId: { $in: allUsers },
          type: { $in: [1, 3] },
          status: { $in: ['Allocated', 'Balloted'] },
        }).populate([{ path: 'userId', select: 'name staffId' }]);
      } else {
        userleaves = await UserLeaves.find({
          userId: { $in: allUsers },
          type: 2,
          status: 'Allocated',
        }).populate([{ path: 'userId', select: 'name staffId' }]);
      }

      if (userleaves && userleaves.length > 0) {
        const resArr = [];

        const promiseData = [];
        const userleavesListCall = async (i) => {
          let dateInLeave = [];
          let startleave = userleaves[i].fromdate.split('-');

          startleave = `${startleave[2]}-${startleave[1]}-${startleave[0]}`;
          startleave = startleave.split('-');
          const startddleave = new Date(
            +startleave[2],
            startleave[1] - 1,
            +startleave[0] + 1,
          );
          // let startddleave = new Date(startleave);
          //    let endddleave = new Date(userleaves[i].todate);
          let endleave = userleaves[i].todate.split('-');

          endleave = `${endleave[2]}-${endleave[1]}-${endleave[0]}`;
          endleave = endleave.split('-');
          const endddleave = new Date(
            +endleave[2],
            endleave[1] - 1,
            +endleave[0] + 1,
          );

          //    let endleave= userleaves[i].todate.split("-");
          //    let endddleave = new Date(endleave);
          // check in that dates.
          dateInLeave = await getDateArray(startddleave, endddleave);
          const check = findCommonElement(dates, dateInLeave);

          if (check === true) {
            const sapData = await StaffSapData.findOne(
              { staff_Id: userleaves[i].userId._id },
              { ballotLeaveBalanced: 1 },
            );
            const currObj = {};
            let checkIfUserAlreadyExists;

            if (resArr.length > 0) {
              checkIfUserAlreadyExists = checkOfUser(
                resArr,
                userleaves[i].userId._id,
              );
            }

            if (checkIfUserAlreadyExists !== -1) {
              currObj.type = userleaves[i].type;
              currObj.leaveId = userleaves[i]._id;
              currObj._id = userleaves[i].userId._id;
              currObj.name = userleaves[i].userId.name;
              currObj.staffId = userleaves[i].userId.staffId;
              currObj.ballotBalance = sapData.ballotLeaveBalanced;
              resArr.push(currObj);
            }
          }
        };

        for (let i = 0; i <= userleaves.length - 1; i += 1) {
          promiseData.push(userleavesListCall(i));
        }

        await Promise.all(promiseData);

        return res.status(201).json({
          success: true,
          data: resArr,
          message: 'received!',
        });
      }

      return res.status(300).json({
        success: false,
        data: null,
        message: "Couldn't find requested users leaves.",
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async saveSwopRequest(req, res) {
    try {
      const reqObject = req.body;
      const requiredResult = await __.checkRequiredFields(req, [
        'userFrom',
        'userTo',
        'opsGroupId',
        'leaveFrom',
        'leaveTo',
      ]);

      if (requiredResult.status === false) {
        return res.status(300).json({
          success: false,
          data: null,
          message: 'Missing Fields Error!',
        });
      }

      const requestsswoping = await SwopRequests.find({
        userFrom: req.user._id,
        leaveTo: reqObject.leaveTo,
        requestStatus: 1,
      });

      if (requestsswoping.length > 0) {
        return res.status(300).json({
          success: false,
          data: null,
          message: 'You have already sent request for these leave dates!',
        });
      }

      // check if userFrom already have dates which he is requesting for
      const leaveTo = await UserLeaves.findOne(
        { _id: reqObject.leaveTo },
        { fromdate: 1, todate: 1 },
      );

      if (leaveTo) {
        const userFrom = await UserLeaves.find({
          userId: reqObject.userFrom,
          fromdate: leaveTo.fromdate,
          todate: leaveTo.todate,
        });

        if (userFrom.length > 0) {
          return res.status(300).json({
            success: false,
            data: null,
            message: 'You already have these dates.',
          });
        }
      } else {
        return res.status(300).json({
          success: false,
          data: null,
          message: 'Could not find your leave data!',
        });
      }

      // check if userFrom already has dates within requesting date ranges
      const userFromLeaves = await UserLeaves.find({
        userId: reqObject.userFrom,
      });

      if (userFromLeaves.length > 0) {
        let dates = [];
        const startdd = new Date(leaveTo.fromdate);
        const enddd = new Date(leaveTo.todate);

        // check in that dates.
        dates = getArrayOfDates(startdd, enddd);

        for (let km = 0; km <= dates.length - 1; km += 1) {
          for (let leave = 0; leave <= userFromLeaves.length - 1; leave += 1) {
            const leavestart = new Date(userFromLeaves[leave].fromdate);
            const leaveend = new Date(userFromLeaves[leave].todate);

            if (
              dates[km] >= leavestart &&
              dates[km] <= leaveend &&
              userFromLeaves[leave].status !== 'cancelled'
            ) {
              // 0 says dates overlapping..
              return res.status(300).json({
                success: false,
                data: null,
                message: 'This staff has these dates within this date range.',
              });
              // break;
            }
          }
        }
      }

      // Check if userTo already have those dates which are requested.
      const leaveFrom = await UserLeaves.findOne(
        { _id: reqObject.leaveFrom },
        { fromdate: 1, todate: 1 },
      );

      if (leaveFrom) {
        const userTo = await UserLeaves.find({
          userId: reqObject.userTo,
          fromdate: leaveFrom.fromdate,
          todate: leaveFrom.todate,
        });

        if (userTo.length > 0) {
          return res.status(300).json({
            success: false,
            data: null,
            message: 'This staff already has these dates.',
          });
        }
      } else {
        return res.status(300).json({
          success: false,
          data: null,
          message: 'Could not find leave you are requesting to!',
        });
      }

      const oobj = new SwopRequests(reqObject);

      oobj.save(async (err, resObj) => {
        if (err) {
          return res.status(500).json({
            success: false,
            data: err,
            message: 'Something went wrong!!',
          });
        }

        res.status(201).json({
          success: true,
          data: resObj,
          message: 'Saved!!',
        });
        const user = await User.findOne(
          { _id: reqObject.userTo },
          { _id: 0, deviceToken: 1 },
        );
        const userFrom = await User.findOne(
          { _id: resObj.userFrom },
          { name: 1 },
        );
        const usersDeviceTokens = [];
        const dd = new Date();

        if (user && user.deviceToken) {
          usersDeviceTokens.push(user.deviceToken);
          const collapseKey = resObj._id;
          const notificationObj = {
            title: 'Leave Swap Request.',
            body: `You have Leave Swap request from ${userFrom.name}.`,
            bodyText: `You have Leave Swap request ${userFrom.name}.`,
            bodyTime: dd,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          };

          FCM.push(usersDeviceTokens, notificationObj, collapseKey);
        }

        return __.out(res, 500, 'User Not Found');
      });
      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getMyReceivedSwapRequests(req, res) {
    try {
      const reqdata = req.body;
      const swapRequests = await SwopRequests.find({
        userTo: reqdata.userId,
        leaveTo: reqdata.leaveId,
        requestStatus: 1,
      }).populate([
        { path: 'userFrom', select: 'name staffId' },
        { path: 'opsGroupId', select: 'opsGroupName' },
        { path: 'leaveFrom', select: 'fromdate todate type status' },
        { path: 'leaveTo', select: 'fromdate todate type status' },
      ]);
      const resdata = [];

      if (swapRequests.length > 0) {
        const promiseData = [];
        const swapRequestsListCall = async (i) => {
          const startslotdate = swapRequests[i].leaveFrom.fromdate;
          const endslotdate = swapRequests[i].leaveFrom.todate;
          const slotDates = { start: startslotdate, end: endslotdate };
          const user = await User.findOne(
            { _id: swapRequests[i].userFrom._id },
            { _id: 0, parentBussinessUnitId: 1 },
          ).populate({
            path: 'parentBussinessUnitId',
            select: 'name',
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          });
          const BU = `${user.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;
          const data = {};

          data.Bu = BU;
          data.opsName = swapRequests[i].opsGroupId.opsGroupName;
          data.opsGroupId = swapRequests[i].opsGroupId._id;
          if (swapRequests[i].leaveFrom.type === 1) {
            data.type = 'Block-Balloted';
          }

          if (swapRequests[i].leaveFrom.type === 3) {
            data.type = 'Block-Allocated';
          }

          if (swapRequests[i].leaveFrom.type === 2) {
            data.type = 'Casual';
          }

          if (swapRequests[i].leaveFrom.type === 4) {
            data.type = 'Special';
          }

          // var datePartsss = swapRequests[i].leaveFrom.fromdate.split("-");
          // var dateParteee = swapRequests[i].leaveFrom.todate.split("-");
          const startdd = new Date(swapRequests[i].leaveFrom.fromdate);
          const enddd = new Date(swapRequests[i].leaveFrom.todate);
          let days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));

          days += 1;
          const daysAsLeaves = await noOfDays(res, days);

          //  if(days % 7==0){
          //      var n = days/7;
          //      n = n*2;
          //      days = days-n;
          //  }
          data.leavedays = daysAsLeaves;
          data.slotNoFor = reqdata.slotNo;
          data.leaveId = reqdata.leaveId;
          // var Toslotdate = swapRequests[i].leaveTo.fromdate.split("-");
          // Toslotdate=Toslotdate[2]+'-'+Toslotdate[1]+'-'+Toslotdate[0];
          // var Toendslotdate = swapRequests[i].leaveTo.todate.split("-");
          // Toendslotdate=Toendslotdate[2]+'-'+Toendslotdate[1]+'-'+Toendslotdate[0];
          data.currentdates = {
            start: swapRequests[i].leaveTo.fromdate,
            end: swapRequests[i].leaveTo.todate,
          };
          data.slotToExchange = slotDates;
          data.users = swapRequests[i].userFrom;
          // data.ballotId=reqdata.ballotId;
          data.swapRequestId = swapRequests[i]._id;
          data.requestStatus = swapRequests[i].requestStatus;
          resdata.push(data);
        };

        for (let i = 0; i <= swapRequests.length - 1; i += 1) {
          promiseData.push(swapRequestsListCall(i));
        }

        await Promise.all(promiseData);

        return res.status(201).json({
          success: true,
          data: resdata,
          message: 'received!',
        });
      }

      return res.status(300).json({
        success: false,
        data: null,
        message: "Couldn't find swap requests for this slot.",
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async acceptSwopRequest(req, res) {
    try {
      const data = req.body;

      const swopReq = await SwopRequests.findOne({ _id: data.requestId });

      if (!swopReq) {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find swap request.",
        });
      }

      if (data.action === 2) {
        const leaveTo = await UserLeaves.findOne(
          { _id: swopReq.leaveTo },
          { fromdate: 1, todate: 1, type: 1 },
        );
        const leaveFrom = await UserLeaves.findOne(
          { _id: swopReq.leaveFrom },
          { fromdate: 1, todate: 1, type: 1 },
        );
        // check diffrences of leaves
        // For leaveTodats here
        // var dateLeaveToPartsss = leaveTo.fromdate.split("-");
        // var dateLeaveToParteee = leaveTo.todate.split("-");
        const startLeaveTodd = new Date(leaveTo.fromdate);
        const endLeaveTodd = new Date(leaveTo.todate);
        let LeaveTodays = Math.floor(
          (endLeaveTodd - startLeaveTodd) / (1000 * 60 * 60 * 24),
        );

        LeaveTodays += 1;
        if (leaveTo.type === 1 || leaveTo.type === 3) {
          LeaveTodays = await noOfDays(res, LeaveTodays);
        }

        //  var dateLeaveFromPartsss = leaveFrom.fromdate.split("-");
        //  var dateLeaveFromParteee = leaveFrom.todate.split("-");
        const startLeaveFromdd = new Date(leaveFrom.fromdate);
        const endLeaveFromdd = new Date(leaveFrom.todate);
        let LeaveFromdays = Math.floor(
          (endLeaveFromdd - startLeaveFromdd) / (1000 * 60 * 60 * 24),
        );

        LeaveFromdays += 1;
        if (leaveFrom.type === 1 || leaveFrom.type === 3) {
          LeaveFromdays = await noOfDays(res, LeaveFromdays);
        }

        if (LeaveFromdays > LeaveTodays) {
          const diff = LeaveFromdays - LeaveTodays;

          await StaffSapData.update(
            { staff_Id: swopReq.userFrom },
            { $inc: { ballotLeaveBalanced: diff } },
          );
          await StaffSapData.update(
            { staff_Id: swopReq.userTo },
            { $inc: { ballotLeaveBalanced: -diff } },
          );
        }

        if (LeaveFromdays < LeaveTodays) {
          const diff = LeaveTodays - LeaveFromdays;

          await StaffSapData.update(
            { staff_Id: swopReq.userFrom },
            { $inc: { ballotLeaveBalanced: -diff } },
          );
          await StaffSapData.update(
            { staff_Id: swopReq.userTo },
            { $inc: { ballotLeaveBalanced: diff } },
          );
        }

        // Exchange Actual leaves
        // LevaeFrom
        const userFrom = await User.findOne(
          { _id: swopReq.userFrom },
          { name: 1, staffId: 1 },
        );

        leaveTo.userId = userFrom._id;
        await leaveTo.save();
        const userTo = await User.findOne(
          { _id: swopReq.userTo },
          { name: 1, staffId: 1 },
        );

        leaveFrom.userId = userTo._id;
        await leaveFrom.save();
        swopReq.requestStatus = 2;
        await swopReq.save();
        const userFromTokens = [];
        // same request from dates
        const leavesall = await UserLeaves.find({
          fromdate: leaveFrom.fromdate,
          todate: leaveFrom.todate,
          userId: { $nin: [swopReq.userFrom, swopReq.userTo] },
        });

        if (leavesall.length > 0) {
          const promiseData = [];
          const leavesallCall = async (i) => {
            const sameLeaveFroms = await SwopRequests.find({
              userTo: swopReq.userTo,
              userFrom: leavesall[i].userId,
              requestStatus: 1,
            });

            if (sameLeaveFroms.length > 0) {
              const idss = [];

              const promiseData1 = [];
              const sameLeaveFromsCall = async (element) => {
                idss.push(sameLeaveFroms[element]._id);
                const userFrm = await User.findOne(
                  { _id: sameLeaveFroms[element].userFrom },
                  { _id: 0, deviceToken: 1 },
                );

                userFromTokens.push(userFrm.deviceToken);
              };

              for (
                let element = 0;
                element <= sameLeaveFroms.length - 1;
                element += 1
              ) {
                promiseData1.push(sameLeaveFromsCall(element));
              }

              await Promise.all(promiseData1);

              await SwopRequests.update(
                { _id: { $in: idss } },
                { $set: { requestStatus: 3 } },
                { multi: true },
              );
            }
          };

          for (let i = 0; i <= leavesall.length - 1; i += 1) {
            promiseData.push(leavesallCall(i));
          }

          await Promise.all(promiseData);
        }

        // same leaveTo
        const sameLeaveTos = await SwopRequests.find({
          userTo: swopReq.userTo,
          leaveTo: swopReq.leaveTo,
          requestStatus: 1,
        });

        if (sameLeaveTos.length > 0) {
          const idss = [];

          const promiseData = [];
          const sameLeaveTosCall = async (element) => {
            idss.push(sameLeaveTos[element]._id);
            const userFrm = await User.findOne(
              { _id: swopReq.userFrom },
              { _id: 0, deviceToken: 1 },
            );

            userFromTokens.push(userFrm.deviceToken);
          };

          for (
            let element = 0;
            element <= sameLeaveTos.length - 1;
            element += 1
          ) {
            promiseData.push(sameLeaveTosCall(element));
          }

          await Promise.all(promiseData);

          await SwopRequests.update(
            { _id: { $in: idss } },
            { $set: { requestStatus: 3 } },
            { multi: true },
          );
        }

        res.status(201).json({
          success: true,
          data: swopReq,
          message: 'updated!.',
        });

        const user = await User.findOne(
          { _id: swopReq.userFrom },
          { _id: 0, deviceToken: 1 },
        );
        const userTo1 = await User.findOne(
          { _id: swopReq.userTo },
          { name: 1 },
        );
        const usersDeviceTokens = [];
        const dd = new Date();

        if (user && user.deviceToken) {
          usersDeviceTokens.push(user.deviceToken);
          const collapseKey = swopReq._id;
          const notificationObj = {
            title: 'Leave Swap Request Accepted.',
            body: `Your leave swap request with ${userTo1.name} is Accepted.`,
            bodyText: `Your leave swap request with ${userTo1.name} is Accepted.`,
            bodyTime: dd,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          };

          FCM.push(usersDeviceTokens, notificationObj, collapseKey);
        }

        if (userFromTokens.length > 0) {
          const collapseKey = swopReq._id;
          const notificationObj = {
            title: 'Leave Swap Request Rejected.',
            body: `Your leave swap request with ${userTo1.name} is Rejected.`,
            bodyText: `Your leave swap request with ${userTo1.name} is Rejected.`,
            bodyTime: dd,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          };

          FCM.push(userFromTokens, notificationObj, collapseKey);
        }
      } else {
        // Reject
        swopReq.requestStatus = 3;
        await swopReq.save();
        res.status(201).json({
          success: true,
          data: swopReq,
          message: 'updated!.',
        });
        const user = await User.findOne(
          { _id: swopReq.userFrom },
          { _id: 0, deviceToken: 1 },
        );
        const userTo = await User.findOne({ _id: swopReq.userTo }, { name: 1 });
        const usersDeviceTokens = [];
        const dd = new Date();

        if (user && user.deviceToken) {
          usersDeviceTokens.push(user.deviceToken);
          const collapseKey = swopReq._id;
          const notificationObj = {
            title: 'Leave Swap Request Rejected.',
            body: `Your leave swap request with ${userTo.name} is rejected.`,
            bodyText: `Your leave swap request with ${userTo.name} is rejected.`,
            bodyTime: dd,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          };

          FCM.push(usersDeviceTokens, notificationObj, collapseKey);
        }
      }

      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getMyTeamMembers(req, res) {
    try {
      const reqObj = req.body;
      let users = [];
      let allUsers = [];
      const data = {};
      const opsGrp = await OpsGroup.findOne(
        { userId: req.user._id, isDelete: false },
        { userId: 1, swopSetup: 1, opsGroupName: 1 },
      ).populate([
        {
          path: 'opsTeamId',
          select: ['name', '_id', 'userId'],
        },
        {
          path: 'userId',
          select: ['_id', 'name', 'staffId'],
        },
      ]);

      if (!opsGrp) {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find ops group data of you.",
        });
      }

      const swopsetup = parseInt(opsGrp.swopSetup, 10);

      data.opsGroupId = opsGrp._id;
      data.opsName = opsGrp.opsGroupName;
      if (swopsetup === 0 || swopsetup === 1) {
        users = opsGrp.userId;
      } else {
        const opsTm = await OpsTeam.findOne(
          { userId: req.user._id, isDeleted: false },
          { userId: 1, name: 1 },
        ).populate([
          {
            path: 'userId',
            select: ['_id', 'name', 'staffId'],
          },
        ]);

        if (opsTm && opsTm.userId.length > 0) {
          users = opsTm.userId;
          data.opsTeamId = opsTm._id;
          data.opsTeamName = opsTm.name;
        } else {
          users = opsGrp.userId;
        }
      }

      const dateParts = reqObj.date.split('-');
      const dateObject = new Date(
        +dateParts[2],
        dateParts[1] - 1,
        +dateParts[0] + 1,
      );
      // Leaves data
      let userOnHoliday;

      userOnHoliday = await UserLeaves.find({
        userId: { $in: users },
      }).populate([
        {
          path: 'userId',
          select: 'name staffId',
          populate: {
            path: 'appointmentId',
            select: 'name',
          },
        },
      ]);

      //    let userOnHoliday= await userHoliday.find({opsGroupId:data.opsGroupId,opsTeamId: data.opsTeamId}).populate({path:"userId",select:"staffId"});
      userOnHoliday = userOnHoliday.reduce((accumulator, currentValue) => {
        if (currentValue.todate) {
          let datePartsss = currentValue.fromdate.split('-');

          datePartsss = `${datePartsss[2]}-${datePartsss[1]}-${datePartsss[0]}`;
          datePartsss = datePartsss.split('-');
          let dateParteee = currentValue.todate.split('-');

          dateParteee = `${dateParteee[2]}-${dateParteee[1]}-${dateParteee[0]}`;
          dateParteee = dateParteee.split('-');
          const startdd = new Date(
            +datePartsss[2],
            datePartsss[1] - 1,
            +datePartsss[0] + 1,
          );
          const enddd = new Date(
            +dateParteee[2],
            dateParteee[1] - 1,
            +dateParteee[0] + 1,
          );

          if (dateObject <= enddd && dateObject >= startdd) {
            accumulator.push(currentValue);
          }
          // if(currentValue.fromdate == data.date || currentValue.todate == data.date){
          //     accumulator.push(currentValue);
          // }
        } else if (currentValue.fromdate === data.date) {
          accumulator.push(currentValue);
        }

        return accumulator;
      }, []);
      userOnHoliday = userOnHoliday.filter((uu) => uu.status !== 'cancelled');
      allUsers = allUsers.concat(userOnHoliday);
      const Users = [];
      const appointments = [];

      for (let k = 0; k <= allUsers.length - 1; k += 1) {
        const user = {};

        user.leaveId = allUsers[k]._id;
        user._id = allUsers[k].userId._id;
        user.appointmentId = allUsers[k].userId.appointmentId;
        user.name = allUsers[k].userId.name;
        user.staffId = allUsers[k].userId.staffId;
        Users.push(user);
        appointments.push(user.appointmentId);
      }
      const jsonObject = appointments.map(JSON.stringify);
      const uniqueSet = new Set(jsonObject);
      const uniqueArray = Array.from(uniqueSet).map(JSON.parse);

      return res.status(201).json({
        success: true,
        data: { users: Users, appointment: uniqueArray },
        message: 'Received!.',
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went Wrong!.',
      });
    }
  }

  async getLeaveDetails(req, res) {
    try {
      const reqObject = req.body;
      const ops = await OpsGroup.findOne(
        { userId: req.body.userId, isDelete: false },
        { _id: 1, opsGroupName: 1 },
      );
      const user = await User.findOne(
        { _id: req.body.userId },
        {
          _id: 0,
          parentBussinessUnitId: 1,
          name: 1,
          staffId: 1,
          email: 1,
          profilePicture: 1,
          contactNumber: 1,
        },
      ).populate([
        {
          path: 'parentBussinessUnitId',
          select: 'name',
          populate: {
            path: 'sectionId',
            select: 'name',
            populate: {
              path: 'departmentId',
              select: 'name',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
        },
        {
          path: 'appointmentId',
          select: 'name',
        },
      ]);
      const BU = `${user.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;

      const leave = await UserLeaves.findOne(
        { _id: reqObject.leaveId },
        { fromdate: 1, todate: 1, type: 1 },
      );

      if (!leave) {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find leave for this user.",
        });
      }

      const useResponse = {};

      useResponse.Bu = BU;
      useResponse.opsName = ops.opsGroupName;
      useResponse.form = leave.fromdate;
      useResponse.To = leave.todate;
      useResponse.contactNumber = user.contactNumber;
      useResponse.profilePicture = user.profilePicture;
      useResponse.email = user.email;
      useResponse.staffId = user.staffId;
      useResponse.name = user.name;
      useResponse.appointment = user.appointmentId.name;
      if (leave.type === 1) {
        useResponse.type = 'Block-Balloted';
      }

      if (leave.type === 2) {
        useResponse.type = 'Casual Leave';
      }

      if (leave.type === 3) {
        useResponse.type = 'Block-Allocated';
      }

      if (leave.type === 4) {
        useResponse.type = 'Special Leave';
      }

      return res.status(201).json({
        success: true,
        data: useResponse,
        message: 'data received!.',
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getSwapLogs(req, res) {
    try {
      const reqdata = req.body;

      if (reqdata.ballotId) {
        // const ballot = await Ballot.findOne({_id:reqdata.ballotId},{weekRange:1});
        const ballot = await Ballot.findOne({ _id: reqdata.ballotId });
        let ballotList = [];

        if (ballot.parentBallot) {
          ballotList = await this.checkIfHasParent(res, ballot._id);
        }

        if (ballot.childBallots && ballot.childBallots.length > 0) {
          ballotList.push(ballot._id);
          ballotList = ballotList.concat(ballot.childBallots);
        }

        if (!ballot.parentBallot && !ballot.childBallots.length > 0) {
          ballotList.push(ballot._id);
        }

        const swapRequests1 = await SwopRequests.find({
          ballotId: { $in: ballotList },
          $or: [
            {
              $and: [
                { userFrom: reqdata.userId },
                { slotNumberTo: reqdata.weekNo },
              ],
            },
            {
              $and: [
                { userTo: reqdata.userId },
                { slotNumberFrom: reqdata.weekNo },
              ],
            },
          ],
          requestStatus: 2,
        }).populate([
          {
            path: 'userTo',
            select: 'name staffId',
          },
          {
            path: 'opsGroupId',
            select: 'opsGroupName opsTeamId',
          },
          {
            path: 'userFrom',
            select: 'name staffId',
          },
          {
            path: 'ballotId',
            select: 'ballotName',
          },
        ]);
        let swapRequests = JSON.stringify(swapRequests1);

        swapRequests = JSON.parse(swapRequests);
        const resdata = [];

        const promiseData = [];
        const swapRequestsCall = async (i) => {
          if (
            swapRequests[i].userFrom._id.toString() ===
            reqdata.userId.toString()
          ) {
            if (swapRequests[i].opsGroupId.opsTeamId.length > 0) {
              const Tm = await OpsTeam.findOne(
                { userId: swapRequests[i].userTo._id, isDeleted: false },
                { name: 1 },
              );

              swapRequests[i].teamName = Tm.name;
            }

            swapRequests[i].status = 'Sent';
            const start =
              ballot.weekRange[swapRequests[i].slotNumberFrom].start.split('-');

            swapRequests[i].formdate = `${start[2]}-${start[1]}-${start[0]}`;
            const end =
              ballot.weekRange[swapRequests[i].slotNumberFrom].end.split('-');

            swapRequests[i].todate = `${end[2]}-${end[1]}-${end[0]}`;
          }

          if (
            swapRequests[i].userTo._id.toString() === reqdata.userId.toString()
          ) {
            if (swapRequests[i].opsGroupId.opsTeamId.length > 0) {
              const Tm = await OpsTeam.findOne(
                { userId: swapRequests[i].userFrom._id, isDeleted: false },
                { name: 1 },
              );

              swapRequests[i].teamName = Tm.name;
            }

            swapRequests[i].status = 'Received';
            const start =
              ballot.weekRange[swapRequests[i].slotNumberTo].start.split('-');

            swapRequests[i].formdate = `${start[2]}-${start[1]}-${start[0]}`;
            const end =
              ballot.weekRange[swapRequests[i].slotNumberTo].end.split('-');

            swapRequests[i].todate = `${end[2]}-${end[1]}-${end[0]}`;
          }

          resdata.push(swapRequests[i]);
        };

        for (let i = 0; i <= swapRequests.length - 1; i += 1) {
          promiseData.push(swapRequestsCall(i));
        }

        await Promise.all(promiseData);

        res
          .status(201)
          .json({ status: true, data: resdata, message: 'Received!' });
      } else {
        const swapRequests1 = await SwopRequests.find({
          $or: [
            {
              $and: [
                { userFrom: reqdata.userId },
                { leaveTo: reqdata.leaveId },
              ],
            },
            {
              $and: [
                { userTo: reqdata.userId },
                { leaveFrom: reqdata.leaveId },
              ],
            },
          ],
          requestStatus: 2,
        }).populate([
          {
            path: 'userTo',
            select: 'name staffId',
          },
          {
            path: 'opsGroupId',
            select: 'opsGroupName opsTeamId',
          },
          {
            path: 'userFrom',
            select: 'name staffId',
          },
          {
            path: 'leaveTo',
            select: 'fromdate todate type',
          },
          {
            path: 'leaveFrom',
            select: 'fromdate todate type',
          },
        ]);
        let swapRequests = JSON.stringify(swapRequests1);

        swapRequests = JSON.parse(swapRequests);
        const resdata = [];

        const promiseData = [];
        const swapRequestsListCall = async (i) => {
          if (
            swapRequests[i].userFrom._id.toString() ===
            reqdata.userId.toString()
          ) {
            if (swapRequests[i].opsGroupId.opsTeamId.length > 0) {
              const Tm = await OpsTeam.findOne(
                { userId: swapRequests[i].userTo._id, isDeleted: false },
                { name: 1 },
              );

              swapRequests[i].teamName = Tm.name;
            }

            swapRequests[i].status = 'Sent';
            swapRequests[i].formdate = swapRequests[i].leaveFrom.fromdate;
            swapRequests[i].todate = swapRequests[i].leaveFrom.todate;
            swapRequests[i].type = swapRequests[i].leaveFrom.type;
          }

          if (
            swapRequests[i].userTo._id.toString() === reqdata.userId.toString()
          ) {
            if (swapRequests[i].opsGroupId.opsTeamId.length > 0) {
              const Tm = await OpsTeam.findOne(
                { userId: swapRequests[i].userFrom._id, isDeleted: false },
                { name: 1 },
              );

              swapRequests[i].teamName = Tm.name;
            }

            swapRequests[i].status = 'Received';
            swapRequests[i].formdate = swapRequests[i].leaveTo.fromdate;
            swapRequests[i].todate = swapRequests[i].leaveTo.todate;
            swapRequests[i].type = swapRequests[i].leaveTo.type;
          }

          resdata.push(swapRequests[i]);
        };

        for (let i = 0; i <= swapRequests.length - 1; i += 1) {
          promiseData.push(swapRequestsListCall(i));
        }

        await Promise.all(promiseData);
        res
          .status(201)
          .json({ status: true, data: swapRequests, message: 'Received!' });
      }
    } catch (e) {
      res
        .status(203)
        .json({ status: false, data: null, message: 'something went wrong!' });
    }
  }

  async getMySentSwapRequests(req, res) {
    try {
      const reqdata = req.body;
      const swapRequests = await SwopRequests.find({
        userFrom: reqdata.userId,
        leaveFrom: reqdata.leaveId,
        requestStatus: 1,
      }).populate([
        { path: 'userTo', select: 'name staffId' },
        { path: 'opsGroupId', select: 'opsGroupName' },
        { path: 'leaveFrom', select: 'fromdate todate type status' },
        { path: 'leaveTo', select: 'fromdate todate type status' },
      ]);

      const resdata = [];

      if (swapRequests.length > 0) {
        const promiseData = [];
        const swapRequestsCall = async (i) => {
          const startslotdate = swapRequests[i].leaveFrom.fromdate;
          const endslotdate = swapRequests[i].leaveFrom.todate;
          const slotDates = { start: startslotdate, end: endslotdate };
          const user = await User.findOne(
            { _id: swapRequests[i].userTo._id },
            { _id: 0, parentBussinessUnitId: 1 },
          ).populate({
            path: 'parentBussinessUnitId',
            select: 'name',
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          });
          const BU = `${user.parentBussinessUnitId.sectionId.departmentId.companyId.name} > ${user.parentBussinessUnitId.sectionId.departmentId.name} > ${user.parentBussinessUnitId.sectionId.name} > ${user.parentBussinessUnitId.name}`;
          const data = {};

          data.Bu = BU;
          data.opsName = swapRequests[i].opsGroupId.opsGroupName;
          data.opsGroupId = swapRequests[i].opsGroupId._id;
          if (swapRequests[i].leaveFrom.type === 1) {
            data.type = 'Block-Balloted';
          }

          if (swapRequests[i].leaveFrom.type === 3) {
            data.type = 'Block-Allocated';
          }

          if (swapRequests[i].leaveFrom.type === 2) {
            data.type = 'Casual';
          }

          if (swapRequests[i].leaveFrom.type === 4) {
            data.type = 'Special';
          }

          // var datePartsss = swapRequests[i].leaveTo.fromdate.split("-");
          // var dateParteee = swapRequests[i].leaveTo.todate.split("-");
          const startdd = new Date(swapRequests[i].leaveTo.fromdate);
          const enddd = new Date(swapRequests[i].leaveTo.todate);
          let days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));

          days += 1;
          const daysAsLeaves = await noOfDays(res, days);

          //  if(days % 7==0){
          //     var n = days/7;
          //     n = n*2;
          //     days = days-n;
          // }
          data.leavedays = daysAsLeaves;
          // data.slotNoFor = reqdata.slotNo;
          data.leaveId = reqdata.leaveId;

          const Toslotdate = swapRequests[i].leaveTo.fromdate;
          const Toendslotdate = swapRequests[i].leaveTo.todate;

          data.currentdates = slotDates;
          // data.currentdates= {start:swapRequests[i].leaveFrom.fromdate,end:swapRequests[i].leaveFrom.todate};
          data.slotToExchange = { start: Toslotdate, end: Toendslotdate };
          data.users = swapRequests[i].userTo;
          // data.ballotId=reqdata.ballotId;
          data.swapRequestId = swapRequests[i]._id;
          data.requestStatus = swapRequests[i].requestStatus;
          resdata.push(data);
        };

        for (let i = 0; i <= swapRequests.length - 1; i += 1) {
          promiseData.push(swapRequestsCall(i));
        }

        await Promise.all(promiseData);

        return res.status(201).json({
          success: true,
          data: resdata,
          message: 'received!',
        });
      }

      return res.status(300).json({
        success: false,
        data: null,
        message: "Couldn't find swap requests for this slot.",
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async cancelMySwopRequest(req, res) {
    try {
      const swopId = req.params.id;
      const updated = await SwopRequests.update(
        { _id: swopId },
        { $set: { requestStatus: 4 } },
      );

      if (updated) {
        res.status(201).json({
          status: true,
          data: updated,
          message: 'Successfully updated.',
        });
      } else {
        res.status(203).json({
          status: false,
          data: null,
          message: "couldn't update values",
        });
      }

      return null;
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

async function autoTerminateSwapRequest() {
  const todayIs = new Date();
  let weeksToApply = 1;
  const pageSettingData = await PageSettingModel.findOne({
    companyId: '5a9d162b36ab4f444b4271c8',
    status: 1,
  })
    .select('opsGroup')
    .lean();

  if (pageSettingData.opsGroup.minWeeksBeforeSwop) {
    weeksToApply = pageSettingData.opsGroup.minWeeksBeforeSwop;
  }

  const totaldays = weeksToApply * 7;
  const swapList = await SwopRequests.find({
    requestStatus: 1,
  });

  if (swapList.length > 0) {
    const promiseData = [];
    const userLeavesListCall = async (i) => {
      const leaveTo = await UserLeaves.findOne(
        { _id: swapList[i].leaveTo },
        { fromdate: 1 },
      );
      // var leaveStart = leaveTo.fromdate.split("-");
      const leaveStart = new Date(leaveTo.fromdate);
      let daysleft = Math.floor((leaveStart - todayIs) / (1000 * 60 * 60 * 24));

      daysleft += 1;
      if (daysleft < 0 || daysleft < totaldays) {
        await SwopRequests.update(
          { _id: swapList[i]._id },
          { $set: { requestStatus: 5 } },
        );
      }
    };

    for (let i = 0; i <= swapList.length - 1; i += 1) {
      promiseData.push(userLeavesListCall(i));
    }

    await Promise.all(promiseData);
  }
}

const methods = {};

methods.autoTerminateSwapRequest = async function () {
  const todayIs = new Date();
  let weeksToApply = 1;
  const pageSettingData = await PageSettingModel.findOne({
    companyId: '5a9d162b36ab4f444b4271c8',
    status: 1,
  })
    .select('opsGroup')
    .lean();

  if (pageSettingData.opsGroup.minWeeksBeforeSwop) {
    weeksToApply = pageSettingData.opsGroup.minWeeksBeforeSwop;
  }

  const totaldays = weeksToApply * 7;
  const swapList = await SwopRequests.find({
    requestStatus: 1,
  });

  if (swapList.length > 0) {
    const promiseData = [];
    const swapListCall = async (i) => {
      const leaveTo = await UserLeaves.findOne(
        { _id: swapList[i].leaveTo },
        { fromdate: 1 },
      );
      // var leaveStart = leaveTo.fromdate.split("-");
      const leaveStart = new Date(leaveTo.fromdate);
      let daysleft = Math.floor((leaveStart - todayIs) / (1000 * 60 * 60 * 24));

      daysleft += 1;
      if (daysleft < 0 || daysleft < totaldays) {
        await SwopRequests.update(
          { _id: swapList[i]._id },
          { $set: { requestStatus: 5 } },
        );
      }
    };

    for (let i = 0; i <= swapList.length - 1; i += 1) {
      promiseData.push(swapListCall(i));
    }

    await Promise.all(promiseData);
  }
};

const job = new CronJob({
  cronTime: '0 18 * * *',
  onTick() {
    autoTerminateSwapRequest();
    // Your code that is to be executed on every midnight
  },
  start: true,
  runOnInit: false,
});

job.start();
const opsleave = new OpsLeaveController();

module.exports = opsleave;
module.exports.myMethod = methods;
