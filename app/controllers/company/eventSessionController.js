// Controller Code Starts here
const mongoose = require('mongoose');

const moment = require('moment');
const { parse } = require('json2csv');
const striptags = require('striptags');
const Post = require('../../models/post');
const User = require('../../models/user');
const Event = require('../../models/Event');
const EventSession = require('../../models/EventSession');
const EventSessionLog = require('../../models/eventSessionLogs');
const StaffAttendance = require('../../models/StaffAttendance');
const RSVPRequest = require('../../models/RSVPRequest');
const __ = require('../../../helpers/globalFunctions');
const FCM = require('../../../helpers/fcm');
const ChallengeModule = require('../common/challengeController');

function saveeventSessionLog(session, eventId) {
  return new Promise((resolve, reject) => {
    const object = {
      eventId,
      session,
      description: 'Session Cancelled.',
    };

    new EventSessionLog(object)
      .save()
      .then((savedlog) => {
        resolve(savedlog);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

class EventSessionController {
  async createEvent(req, res) {
    let teaserImage = '';
    let contentImage = '';

    if (typeof req.files[0] !== 'undefined' && req.files[0] !== undefined) {
      teaserImage = req.files[0].filename;
    }

    if (typeof req.files[1] !== 'undefined' && req.files[1] !== undefined) {
      contentImage = req.files[1].filename;
    }

    req.body.teaserImage = teaserImage;
    req.body.contentImage = contentImage;
    const requiredResult = await __.checkRequiredFields(req, ['teaserTitle']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const event = await new Event(req.body).save();

      return __.out(res, 201, event);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async editEvent(req, res) {
    const { event_id: eventID } = req.body;

    if (req.files) {
      if (req.files[0] != null && req.files[0].fieldname === 'teaserImage') {
        req.body.teaserImage = req.files[0].filename;
      }

      if (req.files[1] != null && req.files[1].fieldname === 'contentImage') {
        req.body.contentImage = req.files[1].filename;
      }
    }

    const requiredResult = await __.checkRequiredFields(req, ['event_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let event = await Post.findByIdAndUpdate(eventID, req.body);

      event = await Post.findById(eventID);
      return __.out(res, 201, event);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async deleteEvent(req, res) {
    const { event_id: eventID } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['event_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let event = await Post.findByIdAndUpdate(eventID, { isDeleted: true });

      event = await Post.findById(eventID);
      return __.out(res, 201, event);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async fetchEvents(req, res) {
    try {
      const pageNo = req.body.pageNo ? req.body.pageNo : 0;
      let option = {
        limit: 10,
        skip: pageNo * 10,
      };

      if (pageNo === 'all') option = null;

      const event = await new Promise((resolve, reject) => {
        Event.find(null, null, option)
          .populate('sessionsList')
          .exec((err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
      });

      return __.out(res, 200, event);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getEventDetails(req, res) {
    const { event_id: eventId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['event_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const post = await new Promise((resolve, reject) => {
        Post.findById(eventId)
          .populate('sessions')
          .exec((err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
      });

      return __.out(res, 200, post);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async createSession(req, res) {
    const { event_id: eventID } = req.body;
    const requiredResult = await __.checkRequiredFields(
      req,
      ['event_id'],
      ['sessions'],
    );

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const post = await Post.findById(eventID).populate('wallId');

      if (!post) return __.out(res, 500);

      const insertSessions = [];

      for (const elem of req.body.sessions) {
        try {
          const insertSession = {
            startDate: elem.startDate,
            endDate: elem.endDate,
            startTime: elem.startTime,
            endTime: elem.endTime,
            totalParticipantPerSession: elem.totalParticipantPerSession,
            location: elem.location,
            status: elem.status,
            adminIds: elem.adminIds,
            post,
          };

          insertSessions.push(insertSession);
        } catch (err) {
          __.log(err);
          return __.out(res, 500);
        }
      }

      const data = await EventSession.insertMany(insertSessions);
      const sessionIdArray = [];

      for (let i = 0; i < data.length; i += 1) {
        sessionIdArray.push(data[i]._id);
      }

      post.sessions = sessionIdArray;
      await post.save();
      return __.out(res, 201, data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async editMultipleSessions(req, res) {
    const { event_id: eventID } = req.body;
    const requiredResult = await __.checkRequiredFields(
      req,
      ['event_id'],
      ['sessions'],
    );

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const post = await Post.findById(eventID).populate('wallId');

      if (!post) return __.out(res, 500);

      const successArr = [];
      const failedArr = [];
      const updateSession = async (elem) => {
        try {
          if (elem._id) {
            const eventSession = await EventSession.findByIdAndUpdate(
              elem._id,
              {
                $set: {
                  startDate: elem.startDate,
                  endDate: elem.endDate,
                  startTime: elem.startTime,
                  endTime: elem.endTime,
                  totalParticipantPerSession: elem.totalParticipantPerSession,
                  location: elem.location,
                  adminIds: elem.adminIds,
                },
              },
            );

            if (eventSession) {
              successArr.push({ session_id: elem._id });
            } else {
              failedArr.push({
                session_id: elem._id,
                message: 'Session Id not found',
              });
            }
          } else {
            const insertSession = {
              startDate: elem.startDate,
              endDate: elem.endDate,
              startTime: elem.startTime,
              endTime: elem.endTime,
              totalParticipantPerSession: elem.totalParticipantPerSession,
              location: elem.location,
              status: elem.status,
              adminIds: elem.adminIds,
              post,
            };

            const eventsession = new EventSession(insertSession);
            const newSes = await eventsession.save();

            await post.update({ $push: { sessions: newSes._id } });
          }
        } catch (err) {
          failedArr.push({
            session_id: elem._id,
            message: JSON.stringify(err),
          });
        }
      };

      const deleteSession = async (elem) => {
        if (elem._id) {
          const sessionLog = await saveeventSessionLog(elem, post._d);

          await post.update({ $push: { eventLog: sessionLog._id } });
          const bookSessionList = await RSVPRequest.find({
            $and: [
              { session: elem._id },
              { isRSVPRequestAccepted: { $exists: true } },
            ],
          }).populate({
            path: 'staff',
          });

          if (bookSessionList) {
            const deviceToken = [];

            for (let i = 0; i <= bookSessionList.length - 1; i += 1) {
              deviceToken.push(bookSessionList[i].staff.deviceToken);
            }
            if (deviceToken && deviceToken.length > 0) {
              const pushData = {
                title: 'Session Cancelled!',
                body: `Booked session is cancelled`,
                bodyText: `Session You booked has been cancelled!!`,
                bodyTime: [elem.startDate, elem.endDate],
                bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
              };
              const collapseKey =
                post._id; /* unique id for this particular shift */

              FCM.push(deviceToken, pushData, collapseKey);
            }
          }
        }
      };

      const promisesInsert = [];
      const promisesDelete = [];

      for (const elem of req.body.sessions) {
        promisesInsert.push(updateSession(elem));
      }
      await Promise.all(promisesInsert);

      if (req.body.deletedSessions.length > 0) {
        for (const elem of req.body.deletedSessions) {
          promisesDelete.push(deleteSession(elem));
        }
      }

      await Promise.all(promisesDelete);

      return __.out(res, 201, {
        successArr,
        failedArr,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async cancelSession(req, res) {
    try {
      await EventSession.update(
        { _id: req.body._id },
        { $set: { isCancelled: true } },
      );
      return __.out(res, 201);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  create(req) {
    return new Promise((resolve, reject) => {
      const event = req._id;
      const eventsessions = [];

      try {
        const createSessionPromises = req.eventSessionArray.map(
          async (session) => {
            const eventsession = new EventSession(session);

            eventsession.post = event;
            eventsession.attendaceRequiredCount =
              session.totalParticipantPerSession;
            await eventsession.save();
            return eventsession.toObject();
          },
        );

        Promise.all(createSessionPromises)
          .then((sessionResults) => {
            eventsessions.push(...sessionResults);
            resolve(eventsessions);
          })
          .catch((err) => {
            __.log(err);
            reject(err);
          });
      } catch (err) {
        __.log(err);
        reject(err);
      }
    });
  }

  async editEventSession(req, res) {
    const { session_id: sessionId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['session_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let eventSession = await EventSession.findByIdAndUpdate(
        sessionId,
        req.body,
      ).exec();

      eventSession = await EventSession.findById(sessionId).exec();
      return __.out(res, 201, eventSession);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getSessionsByPost(req, res) {
    const { event_id: eventId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['event_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const post = await Post.findById(eventId).populate('sessions');
      let adminss = [];

      for (let i = 0; i < post.sessions.length; i += 1) {
        if (post.sessions[i].adminIds.length > 0) {
          adminss = [...adminss, ...post.sessions[i].adminIds];
        }
      }
      const adminUser = await User.find(
        { _id: { $in: adminss } },
        { name: 1, _id: 1 },
      ).lean();

      return __.out(res, 201, { sessions: post.sessions, admins: adminUser });
      // return __.out(res, 201, post.sessions);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getSessionsByPostByUser(req, res) {
    const { event_id: eventId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['event_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let post = await Post.findById(eventId).populate('sessions');

      post = JSON.stringify(post);
      post = JSON.parse(post);
      let rsvpBooked = 0;

      const getSession = async (i) => {
        post.sessions[i].isActive = true;
        post.sessions[i].isExpired = false;
        post.sessions[i].isBoooked = false;
        const session = post.sessions[i];
        const sessionTime = new Date(session.endTime);
        const sessionDate = new Date(session.endDate).setHours(
          sessionTime.getHours(),
          sessionTime.getMinutes(),
          sessionTime.getSeconds(),
          0,
        );

        if (new Date() - sessionDate > 0) {
          post.sessions[i].isActive = false;
          post.sessions[i].isExpired = true;
        }

        const rsvpDone = await RSVPRequest.findOne({
          event: eventId,
          staff: req.user._id,
          session: session._id,
        }).sort({ _id: -1 });

        if (rsvpDone) {
          post.sessions[i].isActive = false;
          post.sessions[i].isBoooked = true;
          post.sessions[i].rsvpId = rsvpDone._id;
        }

        if (rsvpDone && rsvpDone.isRSVPCancelled) {
          post.sessions[i].isBoooked = false;
          delete post.sessions[i].rsvpId;
        }

        const rsvpcount = await RSVPRequest.find({
          $and: [
            { event: eventId },
            { session: post.sessions[i]._id },
            { isRSVPRequestAccepted: true },
            { isRSVPCancelled: false },
          ],
        }).count();

        if (rsvpcount === post.sessions[i].totalParticipantPerSession) {
          post.sessions[i].isSlot = true;
        } else {
          post.sessions[i].isSlot = false;
        }
      };
      const promiseCall = [];

      for (let i = 0; i < post.sessions.length; i += 1) {
        promiseCall.push(getSession(i));
      }
      await Promise.all(promiseCall);
      for (let j = 0; j <= post.sessions.length - 1; j += 1) {
        if (post.sessions[j].isBoooked === true) {
          rsvpBooked += 1;
        }
      }
      const response = { RSVPBooked: rsvpBooked, sessions: post.sessions };

      return __.out(res, 201, response);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getSessionsForUser(req, res) {
    try {
      let rsvpDone = await RSVPRequest.find({
        staff: req.user._id,
        isDeleted: false,
        isRSVPCancelled: false,
        isRSVPRequestAccepted: true,
        isRSVPRequested: true,
      }).populate([
        {
          path: 'session',
          match: {
            isCancelled: false,
          },
        },
        {
          path: 'event',
          populate: [
            {
              path: 'wallId',
            },
          ],
        },
      ]);

      // return res.json({ rsvpDone })
      rsvpDone = JSON.parse(JSON.stringify(rsvpDone));
      let finalData = [];
      const currentDate = moment(moment().utc()).format('MM-DD-YYYY HH:mm:ss');

      for (let i = 0; i < rsvpDone.length; i += 1) {
        const { session } = rsvpDone[i];

        if (session) {
          const sessionTime = new Date(session.endTime);
          const sessionDate = new Date(session.endDate).setHours(
            sessionTime.getHours(),
            sessionTime.getMinutes(),
            sessionTime.getSeconds(),
            0,
          );

          if (new Date() - sessionDate < 0) {
            if (rsvpDone[i] && rsvpDone[i].event && rsvpDone[i].event.wallId) {
              rsvpDone[i].event.wallId.eventWallStartDate = moment(
                rsvpDone[i].event.wallId.eventWallStartDate,
              ).format('MM-DD-YYYY HH:mm:ss');
              rsvpDone[i].event.wallId.eventWallEndDate = moment(
                rsvpDone[i].event.wallId.eventWallEndDate,
              ).format('MM-DD-YYYY HH:mm:ss');
              if (
                new Date(
                  rsvpDone[i].event.wallId.eventWallStartDate,
                ).getTime() <= new Date(currentDate).getTime() &&
                new Date(currentDate).getTime() <=
                  new Date(rsvpDone[i].event.wallId.eventWallEndDate).getTime()
              ) {
                rsvpDone[i].event.isWall = true;
              } else {
                rsvpDone[i].event.isWall = false;
              }
            } else {
              rsvpDone[i].event.isWall = false;
            }

            finalData.push(rsvpDone[i]);
          }
        }
      }
      finalData = finalData.sort((a, b) =>
        a.session.startDate && b.session.startDate
          ? new Date(a.session.startDate).getTime() -
            new Date(b.session.startDate).getTime()
          : null,
      );
      // finalData = finalData.sort(function (a, b) { return new Date(a.session.startDate).getTime() - new Date(b.session.startDate).getTime() });
      return __.out(res, 200, finalData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getAllSessionsForUser(req, res) {
    try {
      let rsvpDone = await RSVPRequest.find({
        staff: req.user._id,
        isDeleted: false,
        isRSVPCancelled: false,
        isRSVPRequestAccepted: true,
        isRSVPRequested: true,
      }).populate([
        {
          path: 'session',
          match: {
            isCancelled: false,
          },
        },
        {
          path: 'event',
          populate: [
            {
              path: 'wallId',
            },
          ],
        },
      ]);

      // return res.json({ rsvpDone })
      rsvpDone = JSON.parse(JSON.stringify(rsvpDone));
      let finalData = [];
      let currentDate = new Date(); // moment(moment().utc()).format('MM-DD-YYYY HH:mm:ss');

      currentDate = new Date(currentDate.setMonth(currentDate.getMonth() - 6));
      currentDate = moment(moment(new Date(currentDate)).utc()).format(
        'MM-DD-YYYY HH:mm:ss',
      );

      for (let i = 0; i < rsvpDone.length; i += 1) {
        const { session } = rsvpDone[i];

        if (session) {
          const sessionTime = new Date(session.endTime);
          const sessionDate = new Date(session.endDate).setHours(
            sessionTime.getHours(),
            sessionTime.getMinutes(),
            sessionTime.getSeconds(),
            0,
          );

          if (new Date(currentDate) - sessionDate < 0) {
            if (rsvpDone[i] && rsvpDone[i].event && rsvpDone[i].event.wallId) {
              rsvpDone[i].event.wallId.eventWallStartDate = moment(
                rsvpDone[i].event.wallId.eventWallStartDate,
              ).format('MM-DD-YYYY HH:mm:ss');
              rsvpDone[i].event.wallId.eventWallEndDate = moment(
                rsvpDone[i].event.wallId.eventWallEndDate,
              ).format('MM-DD-YYYY HH:mm:ss');
              if (
                new Date(
                  rsvpDone[i].event.wallId.eventWallStartDate,
                ).getTime() <= new Date(currentDate).getTime() &&
                new Date(currentDate).getTime() <=
                  new Date(rsvpDone[i].event.wallId.eventWallEndDate).getTime()
              ) {
                rsvpDone[i].event.isWall = true;
              } else {
                rsvpDone[i].event.isWall = false;
              }
            } else {
              rsvpDone[i].event.isWall = false;
            }

            finalData.push(rsvpDone[i]);
          }
        }
      }
      finalData = finalData.sort((a, b) =>
        a.session.startDate && b.session.startDate
          ? new Date(b.session.startDate).getTime() -
            new Date(a.session.startDate).getTime()
          : null,
      );
      return __.out(res, 200, finalData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getAdminSessions(req, res) {
    const { event_id: eventId, admin_id: adminId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'admin_id',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const sessions = await EventSession.find({
        adminIds: { $elemMatch: { $eq: adminId } },
        post: eventId,
      }).lean();

      return __.out(res, 201, sessions);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getEventSessionDetails(req, res) {
    const { event_id: eventId, session_id: sessionID } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'session_id',
      'event_id',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const eventSession = await EventSession.findById(sessionID).lean();
      const postDetails = await Post.findById(eventId).lean();
      const attendaceRequiredCount = parseInt(
        eventSession.attendaceRequiredCount,
        10,
      );
      // attendaceRequiredCount =4;
      let staffAttendance = await StaffAttendance.find(
        {
          event: eventId,
          session: sessionID,
          isRSVPCancelled: { $ne: true },
        },
        'appointmentSlotNumber staff appointmentType session',
      )
        .sort('appointmentSlotNumber')
        .populate({
          path: 'staff',
          select:
            'email name role otherFields viewBussinessUnitId planBussinessUnitId planBussinessUnitId profilePicture staffId',
        })
        .lean();
      const listOfAttendees = staffAttendance;

      staffAttendance = staffAttendance.map((x) => x.appointmentSlotNumber);
      const attendance = {};
      let j = 0;

      for (j = 0; j < attendaceRequiredCount; j += 1) {
        attendance[j + 1] = 0;
      }
      staffAttendance.forEach((slot) => {
        attendance[slot] = attendance[slot] ? attendance[slot] + 1 : 1;
      });
      eventSession.attendance = attendance;
      const rsvpRequests = await RSVPRequest.find({
        event: eventId,
        session: sessionID,
        isRSVPCancelled: false,
        isRSVPRequestAccepted: true,
      })
        .populate({
          path: 'staff',
          select:
            'email name role otherFields viewBussinessUnitId planBussinessUnitId planBussinessUnitId profilePicture staffId',
        })
        .lean();

      const rsvpRequestAttendance = async (i) => {
        if (rsvpRequests[i].staff && rsvpRequests[i].staff._id) {
          const attendances = await StaffAttendance.find(
            {
              staff: rsvpRequests[i].staff._id,
              event: eventId,
              session: sessionID,
              status: { $ne: false },
            },
            'appointmentSlotNumber',
          ).lean();

          rsvpRequests[i].attenanceInfo = attendances.map(
            (x) => x.appointmentSlotNumber,
          );
        }
      };
      const promises = [];

      for (let i = 0; i < rsvpRequests.length; i += 1) {
        promises.push(rsvpRequestAttendance(i));
      }
      await Promise.all(promises);
      const rsvp = {};

      rsvp.totalRequest = rsvpRequests.length;
      rsvp.rsvpRequesterList = rsvpRequests;
      rsvp.postDetails = postDetails;
      rsvp.attendanceList = listOfAttendees;
      rsvp.acceptedRequest = rsvpRequests.filter(
        (x) => x.isRSVPRequestAccepted && !x.isRSVPCancelled,
      ).length;
      rsvp.rejectedRequest = rsvpRequests.filter(
        (x) => x.isRSVPRequestDeclined && !x.isRSVPCancelled,
      ).length;
      rsvp.canceledRequest = rsvpRequests.filter(
        (x) => x.isRSVPCancelled,
      ).length;
      rsvp.pendigRequst = rsvpRequests.filter(
        (x) =>
          !x.isRSVPRequestDeclined &&
          !x.isRSVPRequestAccepted &&
          !x.isRSVPCancelled,
      ).length;
      eventSession.rsvp = rsvp;
      eventSession.totalAttendanceTaking =
        postDetails.eventDetails.totalAttendanceTaking;
      return __.out(res, 201, { eventSession });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async createStaffAttendance(req, res) {
    const {
      event_id: eventId,
      staff_id: staffId,
      session_id: sessionId,
      appointmentSlotNumber,
    } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'staff_id',
      'event_id',
      'session_id',
      'appointmentSlotNumber',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const data = req.body;
      const isAttendance = await StaffAttendance.findOne({
        session: sessionId,
        event: eventId,
        staff: staffId,
      }); // check same session have attendance of that staff or not
      const staffAttendance = await new StaffAttendance(data);
      const event = await Post.findOne({
        _id: eventId,
        postType: 'event',
      }).lean();
      const session = await EventSession.findById(sessionId).lean();
      const staff = await User.findById(staffId).lean();

      if (!event || !session || !staff)
        return __.out(res, 400, {
          error: 'event_id, session_id or staff_id did not matched',
        });

      staffAttendance.staff = staffId;
      staffAttendance.event = event;
      staffAttendance.session = session;
      staffAttendance.appointmentType = 'auto';
      const dupplicateCheck = await StaffAttendance.findOne({
        event: eventId,
        staff: staffId,
        session: sessionId,
        appointmentSlotNumber,
      });

      if (dupplicateCheck && !dupplicateCheck.status) {
        await dupplicateCheck.update({ status: true });

        return __.out(res, 201, dupplicateCheck);
      }

      if (dupplicateCheck) return __.out(res, 300, 'Duplicate');

      const data1 = await staffAttendance.save();

      if (!isAttendance) {
        await ChallengeModule.triggerChallenge(
          res,
          staffId,
          eventId,
          'channel',
          3,
        );
      }

      return __.out(res, 201, data1);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async markStaffAbsent(req, res) {
    const {
      event_id: eventId,
      staff_ids: staffIds,
      session_id: sessionId,
    } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'staff_ids',
      'event_id',
      'session_id',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const event = await Post.findOne({
        _id: eventId,
        postType: 'event',
      }).lean();
      const session = await EventSession.findById(sessionId).lean();

      if (!event || !session)
        return __.out(res, 400, {
          error: 'event_id, session_id or staff_id did not matched',
        });

      const result = {
        n: 0,
        nModified: 0,
        ok: 0,
      };

      const staffPromises = staffIds.map(async (staffId) => {
        const staff = await User.findById(staffId).lean();

        if (staff) {
          const data = await StaffAttendance.updateMany(
            {
              event: eventId,
              staff: staffId,
              session: sessionId,
            },
            {
              event: eventId,
              staff: staffId,
              session: sessionId,
              status: false,
            },
            {
              upsert: true,
            },
          );

          return data;
        }

        return null;
      });

      const staffResults = await Promise.all(staffPromises);

      for (const data of staffResults) {
        if (data) {
          result.n += data.n;
          result.nModified += data.nModified;
          result.ok = data.ok;
        }
      }

      return __.out(res, 201, result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async createManualStaffAttendance(req, res) {
    const {
      event_id: eventId,
      staff_ids: staffIds,
      session_id: sessionId,
      appointmentSlotNumber,
    } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'staff_ids',
      'event_id',
      'session_id',
      'appointmentSlotNumber',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const event = await Post.findOne({
        _id: eventId,
        postType: 'event',
      }).lean();
      const session = await EventSession.findById(sessionId).lean();

      if (!event || !session)
        return __.out(res, 400, {
          error: 'event_id, session_id did not matched',
        });

      if (!(typeof staffIds === 'object') || !(staffIds instanceof Array))
        return __.out(res, 400, 'Invalid staff_ids, must be an array');

      const attendances = [];

      const markAttendances = async (i) => {
        const staff = await User.findById(staffIds[i]).lean();

        if (!staff)
          return { success: false, message: `Invalid staff_id ${staffIds[i]}` };

        const attendance = {
          staff: staffIds[i],
          event,
          session,
          appointmentType: 'manual',
          appointmentSlotNumber,
        };
        const dupplicateCheck = await StaffAttendance.find({
          event: eventId,
          staff: staffIds[i],
          session: sessionId,
          appointmentSlotNumber,
        });
        const isAttendance = await StaffAttendance.findOne({
          event: eventId,
          staff: staffIds[i],
          session: sessionId,
        });

        if (!isAttendance) {
          await ChallengeModule.triggerChallenge(
            res,
            staffIds[i],
            eventId,
            'channel',
            3,
          );
        }

        if (dupplicateCheck.length) {
          return {
            success: false,
            message: `Duplicate attendance for staff_id ${staffIds[i]}`,
          };
        }

        attendances.push(attendance);
        return { success: true };
      };
      const promises = [];

      for (let i = 0; i < staffIds.length; i += 1) {
        promises.push(markAttendances(i));
      }
      const result = await Promise.all(promises);
      const filterRecords = result.filter((re) => !re.success);

      if (filterRecords.length > 0) {
        return __.out(res, 300, filterRecords[0].message);
      }

      const data = await StaffAttendance.insertMany(attendances);

      return __.out(res, 201, data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getAttendeesListingPerSlot(req, res) {
    const {
      event_id: eventId,
      session_id: sessionId,
      appointmentSlotNumber,
    } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
      'appointmentSlotNumber',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        event: eventId,
        session: sessionId,
        appointmentSlotNumber,
      };

      // Pagination
      const { pageNo } = req.body;
      let option = {
        limit: 10,
        skip: pageNo * 10,
      };

      if (req.body.pageNo !== 0 && !req.body.pageNo) option = null;

      const data = await StaffAttendance.find(where, null, option)
        .populate({
          path: 'staff',
          populate: {
            path: 'appointmentId parentBussinessUnitId',
          },
        })
        .lean()
        .exec();

      return __.out(res, 201, data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getRSVPAttendanceStatus(req, res) {
    const {
      event_id: eventId,
      session_id: sessionId,
      appointmentSlotNumber,
    } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
      'appointmentSlotNumber',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        event: eventId,
        session: sessionId,
        isDeleted: { $ne: true },
        isRSVPCancelled: { $ne: true },
      };
      // Pagination
      const { pageNo } = req.body;
      let option = {
        limit: 10,
        skip: pageNo * 10,
      };

      if (req.body.pageNo !== 0 && !req.body.pageNo) option = null;

      const rsvps = await RSVPRequest.find(where, null, option)
        .populate({
          path: 'staff',
          populate: [
            {
              path: 'parentBussinessUnitId',
              select: 'sectionId name orgName',
              populate: {
                path: 'sectionId',
                select: 'departmentId name',
                populate: {
                  path: 'departmentId',
                  select: 'name status companyId',
                  populate: {
                    path: 'companyId',
                    select: 'name',
                  },
                },
              },
            },
            {
              path: 'appointmentId',
            },
          ],
        })
        .lean()
        .exec();

      let staffs = rsvps
        .map((x) => x.staff)
        .filter((x) => x)
        .map((x) => x._id);

      staffs = staffs.filter((x, i) => staffs.indexOf(x) === i);
      const attendances = await StaffAttendance.find({
        staff: { $in: staffs },
        event: eventId,
        session: sessionId,
        appointmentSlotNumber,
        status: { $ne: false },
      }).lean();

      const attendedStaffs = attendances.map((x) => x.staff);
      const getAttdanceStatus = async (i) => {
        if (
          rsvps[i].staff &&
          rsvps[i].staff._id &&
          JSON.parse(
            JSON.stringify(attendedStaffs).indexOf(
              rsvps[i].staff._id.toString(),
            ) > -1,
          )
        ) {
          rsvps[i].appointmentStatus = true;
        } else {
          rsvps[i].appointmentStatus = false;
        }

        const attendanceStaff = await StaffAttendance.find(
          {
            staff: rsvps[i].staff._id,
            event: eventId,
            session: sessionId,
            status: { $ne: false },
          },
          { appointmentSlotNumber: 1, staff: 1 },
        ).lean();

        rsvps[i].attendanceStaff = attendanceStaff;
      };

      const promises = [];

      for (let i = 0; i <= rsvps.length - 1; i += 1) {
        promises.push(getAttdanceStatus(i));
      }

      await Promise.all(promises);

      if (req.body.apptStatus === 'P' || req.body.apptStatus === 'p') {
        return __.out(
          res,
          201,
          rsvps.filter((x) => x.appointmentStatus),
        );
      }

      if (req.body.apptStatus === 'A' || req.body.apptStatus === 'a') {
        return __.out(
          res,
          201,
          rsvps.filter((x) => !x.appointmentStatus),
        );
      }

      return __.out(res, 201, rsvps);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async exportAttendees(req, res) {
    const {
      event_id: eventId,
      session_id: sessionId,
      appointmentSlotNumber,
    } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        event: eventId,
        session: sessionId,
      };

      if (parseInt(appointmentSlotNumber, 10) > 0) {
        where.appointmentSlotNumber = appointmentSlotNumber;
      }

      const attendances = await StaffAttendance.find(where)
        .sort('appointmentSlotNumber')
        .populate({
          path: 'staff',
          select: 'name appointmentId staffId parentBussinessUnitId',
          populate: [
            {
              path: 'appointmentId',
              select: 'name',
            },
            {
              path: 'parentBussinessUnitId',
              select: 'name',
            },
          ],
        })
        .populate({
          path: 'session',
          select: 'location startDate endDate',
        })
        .populate({
          path: 'event',
          select: 'teaser sessions',
          options: { lean: true },
        })
        .lean();
      const csvLink = '';
      const fieldsArray = [
        'event title',
        'session number',
        'location',
        'slot number',
        'staffId',
        'staff name',
        'appointment name',
        'parentBussinessUnitId',
        'attendance Date and Time',
        'attendance status',
        'RSVP start Date time',
        'RSVP end date time',
      ];
      const jsonArray = [];

      if (!attendances.length)
        return __.out(res, 201, { csvLink, noData: false });

      attendances.forEach((attendance) => {
        const json = {};

        if (attendance.event && attendance.event.teaser) {
          json['event title'] = attendance.event.teaser.title || null;
        } else {
          json['event title'] = null;
        }

        json['event title'] = striptags(json['event title']);
        json['session number'] =
          attendance.event &&
          attendance.event.sessions &&
          typeof attendance.event.sessions === 'object' &&
          attendance.event.sessions instanceof Array
            ? JSON.parse(JSON.stringify(attendance.event.sessions)).indexOf(
                sessionId,
              )
            : null;

        json['session number'] = parseInt(json['session number'], 10) + 1;
        json.location = attendance.session ? attendance.session.location : null;
        json['slot number'] = attendance.appointmentSlotNumber;
        json.staffId = attendance.staff ? attendance.staff.staffId : null;
        json['staff name'] = attendance.staff ? attendance.staff.name : null;
        json['appointment name'] =
          attendance.staff && attendance.staff.appointmentId
            ? attendance.staff.appointmentId.name
            : null;
        json.parentBussinessUnitId =
          attendance.staff && attendance.staff.parentBussinessUnitId
            ? attendance.staff.parentBussinessUnitId.name
            : null;
        json['attendance Date and Time'] = moment(attendance.createdAt)
          .utcOffset(req.body.timeZone)
          .format('YYYY-MM-DD HH:mm');
        json['attendance status'] = attendance.status;
        json['RSVP start Date time'] = moment(attendance.session.startDate)
          .utcOffset(req.body.timeZone)
          .format('YYYY-MM-DD HH:mm');
        json['RSVP end date time'] = moment(attendance.session.endDate)
          .utcOffset(req.body.timeZone)
          .format('YYYY-MM-DD HH:mm');
        jsonArray.push(json);
      });

      if (!jsonArray.length)
        return __.out(res, 201, { csvLink, noData: false });

      const fields = fieldsArray;
      const opts = { fields };
      const csv = parse(jsonArray, opts);

      res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
      res.set('Content-Type', 'application/csv');
      return res.status(200).json({ csv, noData: true });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async exportAttendeesNew(req, res) {
    const { event_id: eventId, timeZone } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const eventInfoTemp = await this.getAttendanceCount(res, eventId);
      let eventInfo;
      let attendanceCount = 0;

      if (eventInfoTemp) {
        eventInfo = {
          eventId: eventInfoTemp._id,
          name: eventInfoTemp.teaser.title,
          sessionInfo: eventInfoTemp.sessions,
        };
        if (eventInfoTemp.eventDetails) {
          attendanceCount = eventInfoTemp.eventDetails.totalAttendanceTaking;
        }
        // res.json({attendanceCount});
      } else {
        return __.out(res, 201, { csvLink: '', noData: false });
      }

      const result = await RSVPRequest.aggregate([
        {
          $match: {
            event: mongoose.Types.ObjectId(eventId),
            isRSVPCancelled: false,
          },
        },
        {
          $lookup: {
            from: 'users',
            foreignField: '_id',
            localField: 'staff',
            as: 'userInfo',
          },
        },
        {
          $unwind: '$userInfo',
        },
        {
          $lookup: {
            from: 'appointments',
            foreignField: '_id',
            localField: 'userInfo.appointmentId',
            as: 'appointmentId',
          },
        },
        { $unwind: '$appointmentId' },
        {
          $lookup: {
            from: 'subsections',
            foreignField: '_id',
            localField: 'userInfo.parentBussinessUnitId',
            as: 'parentBussinessUnitId',
          },
        },
        { $unwind: '$parentBussinessUnitId' },
        {
          $lookup: {
            from: 'sections',
            foreignField: '_id',
            localField: 'parentBussinessUnitId.sectionId',
            as: 'sectionId',
          },
        },
        { $unwind: '$sectionId' },
        {
          $lookup: {
            from: 'departments',
            foreignField: '_id',
            localField: 'sectionId.departmentId',
            as: 'department',
          },
        },
        { $unwind: '$department' },
        {
          $lookup: {
            from: 'companies',
            foreignField: '_id',
            localField: 'department.companyId',
            as: 'company',
          },
        },
        { $unwind: '$company' },
        {
          $lookup: {
            from: 'staffattendances',
            foreignField: 'event',
            localField: 'event',
            as: 'attendance',
          },
        },
      ]);

      // return res.json(result);
      result.forEach((item) => {
        item.attendance = item.attendance.filter(
          (att) => att.staff.toString() === item.userInfo._id.toString(),
        );
        for (let i = 1; i <= attendanceCount; i += 1) {
          const slotFound = item.attendance.filter(
            (slot) => slot.appointmentSlotNumber === i,
          );

          if (slotFound.length === 0) {
            const slotObj = {
              appointmentSlotNumber: i,
              attendanceStatus: 'No',
            };

            item.attendance.push(slotObj);
          }
        }
      });
      const fieldsArray = [
        'event title',
        'session number',
        'location',
        'number of slot',
        'staffId',
        'staff name',
        'appointment name',
        'parentBussinessUnitId',
        'RSVP start Date time',
        'RSVP end date time',
      ];

      // 'attendance Date and Time', 'attendance status'
      for (let i = 0; i < attendanceCount; i += 1) {
        fieldsArray.push(`Slot ${i + 1} Attendance Date and Time`);
        fieldsArray.push(`Slot ${i + 1} attendance status`);
      }
      const jsonArray = [];
      const sessionNumber = [];

      eventInfo.sessionInfo.forEach((item, index) => {
        const number = index + 1;
        const sessionId = item._id;
        const obj = {
          number,
          sessionId,
          location: item.location,
          startDate: item.startDate,
          endDate: item.endDate,
        };

        sessionNumber.push(obj);
      });
      if (!result.length)
        return __.out(res, 201, { csvLink: '', noData: false });

      result.forEach((attendance) => {
        const json = {};

        json['event title'] = eventInfo ? eventInfo.name : null;
        json['event title'] = striptags(json['event title']);
        const Number = sessionNumber.find(
          (sesNum) =>
            sesNum.sessionId.toString() === attendance.session.toString(),
        );

        if (Number) {
          json['session number'] = Number.number;
          json.location = Number.location;
        } else {
          json['session number'] = 0;
          json.location = 0;
        }

        json['number of slot'] = attendanceCount;
        json.staffId = attendance.userInfo ? attendance.userInfo.staffId : null;
        json['staff name'] = attendance.userInfo
          ? attendance.userInfo.name
          : null;
        json['appointment name'] = attendance.appointmentId
          ? attendance.appointmentId.name
          : null;
        json.parentBussinessUnitId = this.getBuName(attendance);
        if (Number) {
          json['RSVP start Date time'] = moment(Number.startDate)
            .utcOffset(timeZone)
            .format('YYYY-MM-DD HH:mm');
          json['RSVP end date time'] = moment(Number.endDate)
            .utcOffset(timeZone)
            .format('YYYY-MM-DD HH:mm');
        } else {
          json['RSVP start Date time'] = '';
          json['RSVP end date time'] = '';
        }

        for (let i = 1; i <= attendanceCount; i += 1) {
          attendance.attendance.forEach((attItem) => {
            if (attItem.appointmentSlotNumber === i) {
              if (attItem.attendanceStatus === 'No') {
                json[`Slot ${i} Attendance Date and Time`] = '';
                json[`Slot ${i} attendance status`] = '';
              } else if (attItem.status) {
                json[`Slot ${i} Attendance Date and Time`] = moment(
                  attItem.createdAt,
                )
                  .utcOffset(timeZone)
                  .format('YYYY-MM-DD HH:mm');
                json[`Slot ${i} attendance status`] = true;
              } else {
                json[`Slot ${i} Attendance Date and Time`] = '';
                json[`Slot ${i} attendance status`] = '';
              }
            }
          });
        }
        jsonArray.push(json);
      });
      const fields = fieldsArray;
      const opts = { fields };
      const csv = parse(jsonArray, opts);

      res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
      res.set('Content-Type', 'application/csv');
      return res.status(200).json({ csv, noData: true });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  getBuName(attendance) {
    if (attendance.parentBussinessUnitId) {
      return `${attendance.company.name}->${attendance.department.name}->${attendance.sectionId.name}->${attendance.parentBussinessUnitId.name}`;
    }

    return '';
  }

  getAttendanceCount(res, eventId) {
    try {
      return new Promise((resolve, reject) => {
        Post.findById(eventId)
          .populate('sessions')
          .exec((err, data) => {
            if (err) {
              reject(err);
            }

            resolve(data);
          });
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async createRSVPRequest(req, res) {
    const {
      event_id: eventId,
      staff_id: staffId,
      session_id: sessionId,
    } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'staff_id',
      'event_id',
      'session_id',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const data = req.body;
      const rsvpRequest = new RSVPRequest(data);
      const event = await Post.findOne({ _id: eventId, postType: 'event' });
      const session = await EventSession.findOne({
        _id: sessionId,
        post: event,
      }).lean();

      if (!event || !session)
        return __.out(res, 400, { error: 'invalid event_id or session_id' });

      rsvpRequest.staff = staffId;
      rsvpRequest.event = event;
      rsvpRequest.session = session;
      rsvpRequest.isRSVPRequested = true;
      rsvpRequest.isRSVPCancelled = false;
      rsvpRequest.isDeleted = false;
      // Check session expiry
      const sessionTime = new Date(session.endTime);
      const sessionDate = new Date(session.endDate).setHours(
        sessionTime.getHours(),
        sessionTime.getMinutes(),
        sessionTime.getSeconds(),
        0,
      );

      if (new Date() - sessionDate > 0)
        return __.out(res, 201, { error: 'Session expired', data: null });

      // rsvp request overflow check
      const existingAcceptedReq = await RSVPRequest.find({
        isRSVPRequestAccepted: true,
        isRSVPCancelled: { $ne: true },
        isDeleted: { $ne: true },
        event,
        session,
      });

      if (existingAcceptedReq.length >= session.totalParticipantPerSession) {
        return __.out(res, 400, { error: 'All slots are full' });
      }

      const duplicateCheck = await RSVPRequest.find({
        staff: staffId,
        event,
        isRSVPCancelled: { $ne: true },
        isDeleted: { $ne: true },
        session,
      });

      if (duplicateCheck.length)
        return __.out(res, 201, {
          duplicates: duplicateCheck.map((x) => x._id),
        });

      const result = await new Promise((resolve, reject) => {
        rsvpRequest.save((err, resultData) => {
          if (err) {
            __.log(err);
            return reject(err);
          }

          return resolve(resultData);
        });
      });

      return __.out(res, 201, result);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async createRSVPRequestMultiple(req, res) {
    const {
      event_id: eventId,
      staff_id: staffId,
      sessionid: sessionId,
    } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'staff_id',
      'event_id',
      'sessionid',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const failedSessionBooking = [];
      const successSessionBooking = [];

      const event = await Post.findOne({
        _id: eventId,
        postType: 'event',
      });

      const getSuccessBooking = async (i) => {
        const sessionID = sessionId[i];
        const data = req.body;

        data.session_id = sessionID;
        delete data.sessionid;
        const rsvpRequest = await new RSVPRequest(data);

        const session = await EventSession.findOne({
          _id: sessionID,
          post: event,
        }).lean();

        if (!event || !session) {
          failedSessionBooking.push({
            sessionId: sessionID,
            message: 'invalid event_id or session_id',
          });
          // return __.out(res, 400, {'error': 'invalid event_id or session_id'});
        } else {
          rsvpRequest.staff = staffId;
          rsvpRequest.event = event;
          rsvpRequest.session = session;
          rsvpRequest.isRSVPRequested = true;
          rsvpRequest.isRSVPCancelled = false;
          rsvpRequest.isDeleted = false;
          // Check session expiry
          const sessionTime = new Date(session.endTime);
          const sessionDate = new Date(session.endDate).setHours(
            sessionTime.getHours(),
            sessionTime.getMinutes(),
            sessionTime.getSeconds(),
            0,
          );

          if (new Date() - sessionDate > 0) {
            failedSessionBooking.push({
              sessionId: sessionID,
              message: 'Session expired',
            });
          } else {
            // rsvp request overflow check
            const existingAcceptedReq = await RSVPRequest.find({
              isRSVPRequestAccepted: true,
              isRSVPCancelled: { $ne: true },
              isDeleted: { $ne: true },
              event,
              session,
            });

            if (
              existingAcceptedReq.length >= session.totalParticipantPerSession
            ) {
              failedSessionBooking.push({
                sessionID,
                message: 'Session expired',
              });
            } else {
              const duplicateCheck = await RSVPRequest.find({
                staff: staffId,
                event,
                isRSVPCancelled: { $ne: true },
                isDeleted: { $ne: true },
                session,
              });

              // if (duplicateCheck.length) return __.out(res, 201);
              if (duplicateCheck.length) {
                failedSessionBooking.push({
                  sessionId,
                  message: 'duplicate',
                });
              } else {
                await rsvpRequest.save();
                successSessionBooking.push({
                  sessionID,
                  message: 'RSVP Book Successfully',
                });
              }
            }
          }
        }
      };

      const promises = [];

      for (let i = 0; i < sessionId.length; i += 1) {
        promises.push(getSuccessBooking(i));
      }
      await Promise.all(promises);
      return __.out(res, 200, successSessionBooking);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async cancelRSVPRequest(req, res) {
    const { rsvp_id: rsvpId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['rsvp_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Disallow to cancel, if attendance is taken succussfully
      const rsvp = await RSVPRequest.findById(rsvpId).lean();

      const attendance = await StaffAttendance.findOne({
        staff: rsvp.staff,
        event: rsvp.event,
        session: rsvp.session,
        status: { $ne: false },
      }).lean();

      if (attendance) return __.out(res, 300, 'Not allowed');

      const data = await RSVPRequest.findOneAndUpdate(
        {
          _id: rsvpId,
          isRSVPCancelled: { $ne: true },
        },
        { isRSVPCancelled: true },
      )
        .populate('session')
        .lean();

      if (!data) return __.out(res, 201, data); // If already canceled

      const session =
        data && typeof data.session === 'object' ? data.session : false;

      if (!session) return __.out(res, 201, data);

      await EventSession.findByIdAndUpdate(data.session, {
        attendaceRequiredCount: (session.attendaceRequiredCount += 1),
      });
      return __.out(res, 201, data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async cancelRSVPRequestMultiple(req, res) {
    const { rsvpId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['rsvpId']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Disallow to cancel, if attendance is taken succussfully
      const failed = [];
      const success = [];

      const cancelRSVP = async (i) => {
        const rsvpID = rsvpId[i];
        const rsvp = await RSVPRequest.findById(rsvpID).lean();
        const attendance = await StaffAttendance.findOne({
          staff: rsvp.staff,
          event: rsvp.event,
          session: rsvp.session,
          status: { $ne: false },
        }).lean();

        if (attendance) {
          failed.push({ rsvpId: rsvpID, message: 'Not Allowed' });
          // return __.out(res, 300, 'Not allowed');
        } else {
          const data = await RSVPRequest.findOneAndUpdate(
            {
              _id: rsvpID,
              isRSVPCancelled: { $ne: true },
            },
            { isRSVPCancelled: true },
          )
            .populate('session')
            .lean();

          if (!data) {
            failed.push({ rsvpId: rsvpID, message: 'Already Canceled' });
            // return __.out(res, 201, data)
          } else {
            const session =
              data && typeof data.session === 'object' ? data.session : false;

            if (!session) {
              success.push({ rsvpId: rsvpID, message: 'Cancel Successfully' });
              // return __.out(res, 201, data)
            } else {
              await EventSession.findByIdAndUpdate(data.session, {
                attendaceRequiredCount: (session.attendaceRequiredCount += 1),
              });
              success.push({ rsvpId: rsvpID, message: 'Cancel Successfully' });
            }
          }
        }
      };

      const promises = [];

      for (let i = 0; i < rsvpId.length; i += 1) {
        promises.push(cancelRSVP(i));
        // return __.out(res, 201, data)
      }
      await Promise.all(promises);
      return res.json({ status: true, success, failed });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async rejectRSVPRequest(req, res) {
    const { rsvp_id: rsvpId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['rsvp_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const data = await RSVPRequest.findOneAndUpdate(
        {
          _id: rsvpId,
          isRSVPCancelled: { $ne: true },
          isRSVPRequestDeclined: { $ne: true },
        },
        { isRSVPRequestDeclined: true, isRSVPRequestAccepted: false },
      )
        .populate('session')
        .lean();

      if (!data)
        return __.out(res, 400, {
          error: 'Already declined, canceled or invalid request ',
        });

      const session =
        data && typeof data.session === 'object' ? data.session : false;

      if (!session) return __.out(res, 201, data);

      await EventSession.findByIdAndUpdate(data.session, {
        attendaceRequiredCount: (session.attendaceRequiredCount += 1),
      });
      return __.out(res, 201, data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async approveRSVPRequest(req, res) {
    const { rsvp_id: rsvpId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['rsvp_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let data = await RSVPRequest.findOne({
        _id: rsvpId,
        isRSVPRequestAccepted: { $ne: true },
        isRSVPCancelled: { $ne: true },
      }).lean();

      if (!data || typeof data !== 'object')
        return __.out(res, 400, {
          error: 'Already declined, canceled or invalid request',
        });

      const session = await EventSession.findById(data.session).lean();

      if (!session) return __.out(res, 500);

      // RSVP request overflow check
      const existingAcceptedReq = await RSVPRequest.find({
        isRSVPRequestAccepted: true,
        event: data.event,
        session: data.session,
      });

      if (existingAcceptedReq.length >= session.totalParticipantPerSession)
        return __.out(res, 400, { error: 'All slots are full' });

      data = await RSVPRequest.findByIdAndUpdate(rsvpId, {
        isRSVPRequestAccepted: true,
        isRSVPRequestDeclined: false,
      }).lean();
      if (data && typeof data === 'object') {
        // TODO: check this - as findByIdAndUpdate is used
        // If it was not accepted earlier
        // console.log(
        //   await EventSession.findByIdAndUpdate(session, {
        //     attendaceRequiredCount: --session.attendaceRequiredCount,
        //   }),
        // );
      }

      return __.out(res, 201, data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getRSVPEventsForUser(req, res) {
    const { staff_id: staffId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, ['staff_id']);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        staff: staffId,
        isRSVPCancelled: false,
        isRSVPRequestAccepted: true,
      };

      if (req.body.event_id) where.event = req.body.event_id;

      const data = await RSVPRequest.find(where).populate('session').exec();

      return __.out(res, 201, data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getRSVPRequests(req, res) {
    const { session_id: sessionId, event_id: eventId } = req.body;
    const requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
    ]);

    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const where = {
        event: eventId,
        session: sessionId,
        isRSVPCancelled: false,
        isRSVPRequestAccepted: true,
      };
      const data = await RSVPRequest.find(where).populate('staff').exec();

      return __.out(res, 201, data);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

const eventSessionController = new EventSessionController();

module.exports = eventSessionController;
