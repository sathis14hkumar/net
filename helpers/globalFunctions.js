const _ = require('lodash');
const moment = require('moment');
const os = require('os');
const fs = require('fs');
const mongoose = require('mongoose');
const htmlparser = require('htmlparser');
const NodeClam = require('clamscan');
const Twilio = require('twilio');
const request = require('request');
const PDFDocument = require('pdfkit');
// DB Modals

const path = require('path');
const Section = require('../app/models/section');
const User = require('../app/models/user');
const Department = require('../app/models/department');
const SubSection = require('../app/models/subSection');
const Role = require('../app/models/role');
const Notification = require('../app/models/notification');
const Wall = require('../app/models/wall');
const Channel = require('../app/models/channel');
const ChannelPost = require('../app/models/post');
const WallPost = require('../app/models/wallPost');
const PageSetting = require('../app/models/pageSetting');
const Company = require('../app/models/company');
const CustomForm = require('../app/models/customForms');
const BuilderModule = require('../app/models/builderModule');
const { AssignUserRead } = require('./assinguserread');
const { logInfo, logError } = require('./logger.helper');

class GlobalFunctions {
  async writePdfToCustomForm(payload) {
    try {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(
        `./public/uploads/customFormExport/${payload.manageForm}.pdf`,
      );

      doc.pipe(stream);
      doc.fontSize(20);

      // Add an image if attachment is available
      // change it with requirement **
      if (payload.attachementAvailable) {
        const x = (doc.page.width - 100) / 2;
        const imageFileName = path.basename(payload.welComeAttachement);

        doc.image(`public/uploads/wall/${imageFileName}`, x, 5, {
          width: 100,
          height: 100,
        });
        doc.moveDown(); // Move down after the image
      }

      doc.moveDown();
      // Add title and welcome message
      doc.fontSize(16).text(payload.title, { align: 'center' });
      doc.text(payload.welComeMessage, { align: 'center' });
      doc.moveDown(); // Move down after the welcome message

      // Add formId if available
      if (payload.formId) {
        doc
          .text('Form Id:  ', { className: 'question', continued: true })
          .text(payload.formId, { className: 'answer' });
        doc.moveDown(); // Move down after the formId
      }

      // Add questions and answers
      payload.questions.forEach((response) => {
        if (
          response.answer &&
          typeof response.answer === 'string' &&
          response.answer.startsWith('data:image/png;base64')
        ) {
          const base64Data = response.answer.split(';base64,').pop();
          const buffer = Buffer.from(base64Data, 'base64');

          doc.text(`${response.question}:  `, {
            className: 'question',
            continued: true,
          });
          doc.image(buffer, { width: 100, height: 100, className: 'answer' });
          // to align next line it is require
          doc.text();
        } else {
          doc
            .text(`${response.question}:  `, {
              className: 'question',
              continued: true,
            })
            .text(response.answer, { className: 'answer' });
        }

        doc.moveDown(); // Move down after each question-answer pair
      });

      // Add closing message
      doc.text(payload.closingMessage, { align: 'center' });

      // Finalize the PDF
      doc.end();
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkRequiredFields(req, requiredFields, source = false) {
    if (source === 'shift' && req.body.shifts && req.body.shifts.length === 0) {
      delete req.body.shifts;
    }

    if (source === 'updateLocation') {
      if (
        (req.body.locations && req.body.locations.length === 0) ||
        req.body.locations === ''
      ) {
        delete req.body.locations;
      }
    }

    if (source === 'updateSkillSet') {
      if (
        (req.body.subSkillSets && req.body.subSkillSets.length === 0) ||
        req.body.subSkillSets === ''
      ) {
        delete req.body.subSkillSets;
      }
    }

    if (source === 'updateSkillSetAndLocation') {
      if (
        (req.body.subSkillSets && req.body.subSkillSets.length === 0) ||
        req.body.subSkillSets === ''
      ) {
        delete req.body.subSkillSets;
      }

      if (
        (req.body.subCategories && req.body.subCategories.length === 0) ||
        req.body.subCategories === ''
      ) {
        delete req.body.subCategories;
      }

      if (
        (req.body.locations && req.body.locations.length === 0) ||
        req.body.locations === ''
      ) {
        delete req.body.locations;
      }
    }

    if (source === 'subSection') {
      if (req.body.name) {
        requiredFields.push('sectionId');
      }
    }

    if (source === 'post') {
      if (req.body.postType && req.body.postType === 'events') {
        requiredFields.push('eventDetails');
      }
    }

    if (source === 'user') {
      if (req.body.isFlexiStaff === 0) {
        requiredFields.push(
          'parentBussinessUnitId',
          'planBussinessUnitId',
          'viewBussinessUnitId',
        );
        /* Validate creation based on Plan business unit of the planner */
        const planBussinessUnitIdString = req.body.planBussinessUnitId;

        if (planBussinessUnitIdString) {
          const objectPlanBussinessUnitIds = planBussinessUnitIdString.map(
            (v) => mongoose.Types.ObjectId(v),
          );

          const diffArray = await _.differenceWith(
            objectPlanBussinessUnitIds,
            req.user.planBussinessUnitId,
            _.isEqual,
          );

          if (diffArray.length) {
            requiredFields.push('Invalid parentBussinessUnitId');
          }
        }

        if (planBussinessUnitIdString) {
          try {
            // const planBussinessUnitIdArray = JSON.parse(
            //   planBussinessUnitIdString,
            // );

            if (Array.isArray(planBussinessUnitIdString)) {
              const objectIDs = planBussinessUnitIdString.map((x) =>
                mongoose.Types.ObjectId(x),
              );

              const diffArray = await _.differenceWith(
                objectIDs,
                req.user.planBussinessUnitId,
                _.isEqual,
              );

              if (diffArray.length) {
                requiredFields.push('Invalid planBussinessUnitId');
              }
            } else {
              requiredFields.push('Invalid planBussinessUnitId');
            }
          } catch (error) {
            requiredFields.push('Invalid planBussinessUnitId');
          }
        }

        if (req.body.viewBussinessUnitId) {
          const objectIDs = req.body.viewBussinessUnitId?.map((x) =>
            mongoose.Types.ObjectId(x),
          );
          const diffArray = await _.differenceWith(
            objectIDs,
            req.user.planBussinessUnitId,
            _.isEqual,
          );

          if (diffArray.length) {
            requiredFields.push('Invalid viewBussinessUnitId');
          }
        }

        /* end of business unit validation */

        delete req.body.subSkillSet;
      } else {
        requiredFields.push('parentBussinessUnitId');
        const planBussinessUnitIdString = req.body.planBussinessUnitId;

        if (planBussinessUnitIdString) {
          const diffArray = await _.differenceWith(
            [mongoose.Types.ObjectId(planBussinessUnitIdString)],
            req.user.planBussinessUnitId,
            _.isEqual,
          );

          if (diffArray.length) {
            requiredFields.push('Invalid parentBussinessUnitId');
          }
        }

        if (req.body.subSkillSets && req.body.subSkillSets.length === 0)
          delete req.body.subSkillSets;

        delete req.body.planBussinessUnitId;
        delete req.body.viewBussinessUnitId;
      }
    }

    if (source === 'weeklyStaff') {
      if (!req.file || (req.file && req.file.length === 0)) {
        delete req.body.weeklyStaffCsvData;
        requiredFields.push('weeklyStaffCsvData');
      }
    }

    if (source === 'userUpdate') {
      if (req.body.parentBussinessUnitId) {
        const diffArray = await _.differenceWith(
          [mongoose.Types.ObjectId(req.body.parentBussinessUnitId)],
          req.user.planBussinessUnitId,
          _.isEqual,
        );

        if (diffArray.length) {
          requiredFields.push('Invalid parentBussinessUnitId');
        }
      }

      if (req.body.planBussinessUnitId && req.body.isFlexiStaff === 0) {
        const objectIDs = req.body.planBussinessUnitId.map((x) =>
          mongoose.Types.ObjectId(x),
        );
        const diffArray = await _.differenceWith(
          objectIDs,
          req.user.planBussinessUnitId,
          _.isEqual,
        );

        if (diffArray.length) {
          requiredFields.push('Invalid planBussinessUnitId');
        }
      }

      if (req.body.viewBussinessUnitId && req.body.isFlexiStaff === 0) {
        const objectIDs = req.body.viewBussinessUnitId.map((x) =>
          mongoose.Types.ObjectId(x),
        );
        const diffArray = await _.differenceWith(
          objectIDs,
          req.user.planBussinessUnitId,
          _.isEqual,
        );

        if (diffArray.length) {
          requiredFields.push('Invalid viewBussinessUnitId');
        }
      }
    }

    // req.body = _.pickBy(req.body, _.identity); //remove empty string("") , null, undefined properties
    const noMissingFields = _.reduce(
      requiredFields,
      (result, item) => result && item in req.body,
      true,
    );

    if (!noMissingFields) {
      const missingFields = this.getMissingFields(req.body, requiredFields);

      return {
        status: false,
        missingFields,
      };
    }

    return {
      status: true,
    };
  }

  async customCheckRequiredFields(req, requiredFields, source = false) {
    /* by req not by req.body */
    const missingFields = [];

    await req.forEach((element) => {
      if (source === 'shiftDetails') {
        if (element.subSkillSets && element.subSkillSets.length === 0) {
          delete element.subSkillSets;
        }
      }

      const noMissingFields = _.reduce(
        requiredFields,
        (result, item) => result && item in element,
        true,
      );

      if (!noMissingFields) {
        missingFields.push(...this.getMissingFields(element, requiredFields));
      }
    });

    if (missingFields.length !== 0) {
      return {
        status: false,
        missingFields: [...new Set(missingFields)] /* remove duplicates */,
      };
    }

    return {
      status: true,
    };
  }

  log(arg1, arg2) {
    logError(arg1);
    if (arg2) {
      logError(arg2);
    }
  }

  makePwd(length) {
    const string = 'qwertyupasdfghjkzxcvbnm23456789QWERTYUPASDFGHJKZXCVBNM';
    const index = (Math.random() * (string.length - 1)).toFixed(0);

    return length > 0 ? string[index] + this.makePwd(length - 1) : '';
  }

  getMissingFields(requestedJsonInput, requiredFields) {
    const missingFields = requiredFields.filter(
      (value) => !(value in requestedJsonInput),
    );

    function removeUndefined(value) {
      return value !== undefined;
    }

    return missingFields.filter(removeUndefined);
  }

  out(res, statusCode, resultData = null) {
    if (statusCode === 401) {
      res.status(statusCode).json({
        error: 'Unauthorized user',
      });
    } else if (statusCode === 500) {
      res.status(statusCode).json({
        error: 'Internal server error Or Invalid data',
      });
    } else if (statusCode === 400) {
      res.status(statusCode).json({
        error: 'Required fields missing',
        fields: resultData,
      });
    } else if (statusCode === 201) {
      res.status(statusCode).json({
        data: resultData,
      });
    } else if (statusCode === 300) {
      res.status(statusCode).json({
        message: resultData,
      });
    } else {
      /* 200 */
      res.status(statusCode).json({
        message: resultData != null ? resultData : 'success',
      });
    }
  }

  getDateStringFormat(timeZone, fullDate = '') {
    return moment.utc(timeZone).utcOffset(`${fullDate}`).format('DD-MM-YYYY');
  }

  getDayStringFormat(timeZone, fullDate = '') {
    return moment
      .utc(fullDate)
      .utcOffset(`${timeZone}`)
      .format('dddd')
      .toLowerCase();
  }

  getDayStringFormatFromUnix(unix, timeZone = '') {
    return moment
      .unix(unix)
      .utcOffset(`${timeZone}`)
      .format('dddd')
      .toLowerCase();
  }

  getDay(date = '') {
    return moment(date, 'MM-DD-YYYY HH:mm:ss Z').utc().format('dddd');
  }

  getDurationInHours(startDateTime, endDateTime) {
    const start = moment(startDateTime).utc().unix() * 1000;
    const end = moment(endDateTime).utc().unix() * 1000;

    return ((end - start) / 3600000).toFixed(2); // durationInHours
  }

  weekNoStartWithMonday(dt) {
    dt = new Date(dt);
    return Math.ceil(
      (dt - new Date(dt.getFullYear(), 0, 1)) / (3600000 * 24 * 7),
    );
  }

  serverBaseUrl() {
    if (
      os.hostname().indexOf('doodlews-67') > -1 ||
      os.hostname().indexOf('doodlews-39') > -1 ||
      os.hostname().indexOf('doodlews-70') > -1 ||
      os.hostname().indexOf('doodlews116') > -1
    ) {
      /* localhost */ return process.env.LOCAL_SERVER_BASEURL;
    }

    if (os.hostname().indexOf('doodledev') === 0) {
      /* staging */ return process.env.STAGING_SERVER_BASEURL;
    } /* live */

    return process.env.LIVE_SERVER_BASEURL;
  }

  clientBaseUrl() {
    if (
      os.hostname().indexOf('doodlews-67') > -1 ||
      os.hostname().indexOf('doodlews-39') > -1 ||
      os.hostname().indexOf('doodlews-70') > -1
    ) {
      /* localhost */ return process.env.LOCAL_CLIENT_BASEURL;
    }

    if (os.hostname().indexOf('doodledev') === 0) {
      /* staging */ return process.env.STAGING_CLIENT_BASEURL;
    } /* live */

    return process.env.LIVE_CLIENT_BASEURL;
  }

  async getUserPrivilegeObject(privileges) {
    const preDefinedPrivileges = {
      createUser: false,
      editUser: false,
      viewUser: false,
      skillSetSetup: false,
      businessUserSetup: false,
      roleSetup: false,
      setTemplate: false,
      inputWeeklyStaffing: false,
      planShift: false,
      viewShift: false,
      adjustShift: false,
      makeShiftBooking: false,
      myBooking: false,
      viewBooking: false,
      requestBooking: false,
      inputNotification: false,
      viewNotification: false,
      reports: false,
      submitFeedback: false,
      userProfile: false,
      channelSetup: false,
      cancelShift: false,
      manageNews: false,
      manageEvents: false,
      newsAndEvents: false,
      centralBuilder: false,
      externalLink: false,
      manageWall: false,
      myBoards: false,
      lockedAccount: false,
      myForm: false,
      setUpForm: false,
      resetPassword: false,
      myRewards: false,
      redemptionList: false,
      challenges: false,
      challengesWeb: false,
      myPage: false,
      timesheet: false,
      integration: false,
      schemeSetup: false,
      staffView: false,
      approveTimesheet: false,
      viewTimesheet: false,
      editTimesheetAfterLock: false,
      shiftExtension: false,
      facialCreation: false,
      employeeDirectory: false,
      userShiftScheme: false,
      leavePlannerApprover: false,
      leavePlannerMobile: false,
      leavePlannerAdditionalViewMobileApp: false,
    };

    if (!privileges || !privileges.length) {
      return preDefinedPrivileges;
    }

    const accumulatedPrivileges = {};

    for (const eachPrivilege of privileges) {
      if (eachPrivilege.privilegeCategoryId) {
        Object.assign(
          accumulatedPrivileges,
          _.pickBy(eachPrivilege.flags, _.identity),
        );
      }
    }
    Object.assign(preDefinedPrivileges, accumulatedPrivileges);
    return preDefinedPrivileges;
  }

  sortByDate(a, b) {
    if (moment(a.createdAt).isSame(b.createdAt)) {
      return 0;
    }

    return moment(a.createdAt).isAfter(b.createdAt) ? -1 : 1;
  }

  camelToSpace(str) {
    return str.replace(/([A-Z])/g, ' $1').toLowerCase();
  }

  compareArray(a, b) {
    const arr1 = a.sort();
    const arr2 = b.sort();

    return _.isEqual(arr1, arr2);
  }

  toTitleCase(str) {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
    );
  }

  getRandomElement(n, arrData) {
    const newArrData = [...arrData]; // Create a shallow copy of arrData

    if (n >= newArrData.length) {
      return newArrData; // Return a shuffled copy of the original array
    }

    const shuffled = [];

    while (n > 0) {
      const index = Math.floor(Math.random() * newArrData.length);

      shuffled.push(newArrData[index]);
      newArrData.splice(index, 1);
      n -= 1;
    }

    return shuffled;
  }

  getHTMLValues(htmlString = '', tagName = 'video', attriName = 'src') {
    const reqValues = [];
    // HTML Parser
    const rawHtml = htmlString;
    let contentData;
    const handler = new htmlparser.DefaultHandler((error, dom) => {
      contentData = dom;
    });
    const parser = new htmlparser.Parser(handler);

    parser.parseComplete(rawHtml);

    // Split wanted Urls in Parsed html Object
    const getTagValues = function (htmlData, tag, attribute) {
      for (const elem of htmlData) {
        if (elem.name === tag) {
          elem.children = elem.children || [];
          for (const data of elem.children) {
            const atag = {
              url: elem.attribs[attribute],
            };

            if (tag === 'a') {
              atag.name = data.raw;
            }

            reqValues.push(atag);
          }
        }

        if (elem.children) {
          getTagValues(elem.children, tag, attribute);
        }
      }
    };

    // Call function with Object
    getTagValues(contentData, tagName, attriName);

    return reqValues;
  }

  isEqualObjectIds(o1, o2) {
    return mongoose.Types.ObjectId(o1).equals(mongoose.Types.ObjectId(o2));
  }

  checkRole(role) {
    const methods = {
      getPrivilege: async (_id, privilege) => {
        const whereClause = {
          _id,
          status: { $ne: 3 /* $ne => not equal */ },
        };
        const users = await User.findOne(whereClause)
          .populate([
            {
              path: 'role',
              select: 'name description isFlexiStaff privileges',
              populate: {
                path: 'privileges',
                select: 'name description flags privilegeCategoryId',
                populate: {
                  path: 'privilegeCategoryId',
                  select: 'name',
                },
              },
            },
          ])
          .lean();
        const userData = await this.getUserPrivilegeObject(
          users.role.privileges,
        );

        return privilege ? userData[privilege] : userData;
      },
      validate: async (req, res, next) => {
        if (req.user.roleUpdate) {
          const flag = await methods.getPrivilege(req.user._id, role);

          if (!flag) {
            return this.out(
              res,
              300,
              'This account is not permitted to access',
            );
          }

          return next();
        }

        const flag = req.user.privileges[role];

        if (!flag) {
          return this.out(res, 300, 'This account is not permitted to access');
        }

        return next();
      },
    };

    return Object.freeze(methods);
  }

  async scanFile(uploadedFile, localPath) {
    try {
      const fileName = uploadedFile.toLowerCase();
      const formatError = fileName.match(
        /\.(tiff|tif|svg|PNG|png|JPEG|jpeg|jpg|gif|txt|pdf|odt|doc|docx|wmv|mpg|mpeg|mp4|avi|3gp|3g2|xlsx|xls|xlx|xlr|pptx|ppt|odp|key|csv)$/,
      );

      if (!formatError) {
        return `Please upload this type extension tiff,tif,svg,png,jpeg,jpg,gif,txt,pdf,odt,doc,docx,wmv,mpg,mpeg,mp4,avi,3gp,3g2,xlsx,xls,xlx,xlr,pptx,ppt,odp,key|csv`;
      }

      // if(!/\.(png|jpeg|jpg|gif)/.test(`${fileName}`)){
      const options = {
        removeInfected: false, // Removes files if they are infected
        scanLog: '../public/filelogs/error.log', // You're a detail-oriented security professional.
        debugMode: false, // This will put some debug info in your js console
        scanRecursively: true, // Choosing false here will save some CPU cycles
        clamdscan: {
          host: 'clamav-service', //'127.0.0.1',
          port: 3310,
        },
        preference: 'clamscan', // If clamscan is found and active, it will be used by default
      };
      const clamscan = await new NodeClam().init(options);
      const { isInfected, fileSelected, viruses } = await clamscan.isInfected(
        localPath,
      );

      if (isInfected) {
        fs.unlink(localPath, (err, f) => {
          if (err) {
            logError('Error in file removed');
          }

          logInfo('removed virus file', f);
        });
        return `${fileSelected} is infected with ${viruses.join(', ')}.`;
      }

      return false;
      // }
    } catch (error) {
      logError('error in scanFile ', error.stack);
      throw error;
    }
  }

  /* Functions with db */
  // Get user's BU, Department, Sub section
  async getCompanyBU(companyId, type = 'subsection', status = [1, 2]) {
    let returnIds = [];
    // Department
    const departmentIds = await Department.find({
      companyId,
      status: {
        $in: status,
      },
    })
      .select('_id')
      .lean();

    departmentIds.forEach((val) => {
      returnIds.push(val._id);
    });
    if (type === 'department') {
      return returnIds;
    }

    const sectionIds = await Section.find({
      departmentId: {
        $in: returnIds,
      },
      status: {
        $in: status,
      },
    })
      .select('_id')
      .lean();

    returnIds = [];

    sectionIds.forEach((val) => {
      returnIds.push(val._id);
    });
    if (type === 'section') {
      return returnIds;
    }

    // Sub Section
    const subSectionIds = await SubSection.find({
      sectionId: {
        $in: returnIds,
      },
      status: {
        $in: status,
      },
    })
      .select('_id')
      .lean();

    returnIds = [];
    subSectionIds.forEach((val) => {
      returnIds.push(val._id);
    });
    return returnIds;
  }

  async isUserAuthorized(req, wallId) {
    try {
      if (!wallId) return false;

      let usersWallData = await AssignUserRead.getUserInAssignedUser(
        req.user,
        Wall,
      );

      usersWallData = usersWallData.map((wallIdI) => wallIdI.toString());
      if (!usersWallData.length || !usersWallData.includes(wallId.toString()))
        return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  async userDetails(wallData) {
    const userDetails = wallData.assignUsers;
    let userList = [];

    for (const curr of userDetails) {
      const includeOnly = [];
      const excludeOnly = [];

      if (curr.customField.length) {
        for (const customField of curr.customField) {
          includeOnly.push({
            'otherFields.fieldId': customField.fieldId,
            'otherFields.value': customField.value,
          });
          excludeOnly.push({
            'otherFields.fieldId': customField.fieldId,
            'otherFields.value': {
              $ne: customField.value,
            },
          });
        }
      }

      let { businessUnits } = curr;
      const condition = {};

      if (curr.buFilterType === 1) {
        if (curr.allBuToken) {
          // eslint-disable-next-line no-await-in-loop
          const userBus = await User.findById(wallData.createdBy)
            .select('planBussinessUnitId')
            .lean();

          if (userBus) {
            businessUnits = userBus.planBussinessUnitId.map((v) =>
              mongoose.Types.ObjectId(v),
            );
          }
        }

        condition.parentBussinessUnitId = {
          $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
        };
      } else if (curr.buFilterType === 2) {
        condition.parentBussinessUnitId = {
          $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
        };
        condition.$or = [
          {
            appointmentId: {
              $in: curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          {
            subSkillSets: {
              $in: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          {
            _id: {
              $in: curr.user.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          ...includeOnly,
        ];
      } else if (curr.buFilterType === 3) {
        condition.parentBussinessUnitId = {
          $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
        };
        condition.$and = [
          {
            appointmentId: {
              $nin: curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          {
            subSkillSets: {
              $nin: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          {
            _id: {
              $nin: curr.user.map((v) => mongoose.Types.ObjectId(v)),
            },
          },
          ...excludeOnly,
        ];
      }

      // eslint-disable-next-line no-await-in-loop
      const users = await User.aggregate([
        {
          $match: condition,
        },
        {
          $project: { _id: 1 },
        },
      ]).allowDiskUse(true);

      userList = [...userList, ...users];
    }
    return userList.map((user) => user._id);
  }

  async wallUsersList(wallData, id = true) {
    const ids = await this.userDetails(wallData);

    if (id) {
      return ids;
    }

    const users = await User.aggregate([
      {
        $match: {
          _id: {
            $in: ids || [],
          },
        },
      },
      {
        $project: { name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
      },
    ]).allowDiskUse(true);

    return users || [];
  }

  async getCeraToken(companyId) {
    try {
      const companyData = await Company.findById(companyId)
        .select('ceraToken')
        .lean();

      if (!!companyData && companyData.ceraToken) {
        return {
          Authorization: `Token ${companyData.ceraToken}`,
          'Content-Type': 'application/json',
          'User-Agent': process.env.USER_AGENT,
        };
      }

      await this.regenerateCeraToken();

      return {
        Authorization: `Token ${companyData.ceraToken}`,
        'Content-Type': 'application/json',
        'User-Agent': process.env.USER_AGENT,
      };
    } catch (error) {
      // TODO: check this with dev1
      return false;
    }
  }

  async regenerateCeraToken(companyId) {
    try {
      const url = process.env.CERAURL;

      await new Promise((resolve, reject) => {
        request(
          {
            url,
            formData: {
              username: process.env.REWARDUSERNAME,
              password: process.env.REWARDPASSWORD,
            },
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': process.env.USER_AGENT,
            },
          },
          (error, response, body) => {
            if (error) {
              reject(error);
            }

            try {
              body = JSON.parse(body);
              resolve(body);
            } catch (err) {
              reject(body);
            }
          },
        );
      })
        .then(async (success) => {
          await Company.update(
            {
              _id: companyId,
            },
            {
              ceraToken: success.token,
            },
          );

          return success.token;
        })
        .catch((error) => {
          this.log(error);
          return 'Somthing went wrong try later';
        });
      return true;
    } catch (err) {
      this.log(err);
      return err;
    }
  }

  buQuery(sectionId) {
    return {
      path: sectionId,
      select: 'name',
      match: {
        status: 1,
      },
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
    };
  }

  async isModuleIncluded(_id, notIn) {
    try {
      const moduleId = await BuilderModule.findById(_id).select('_id').lean();
      const query = {
        status: 1,
        moduleId: moduleId._id,
      };

      if (notIn) {
        query._id = {
          $nin: notIn || [],
        };
      }

      if (moduleId) {
        const notificationCount = await Notification.count(query).lean();

        if (notificationCount) {
          return {
            status: false,
            message: 'Module already linked in notification',
          };
        }

        const wallPostCount = await WallPost.count(query).lean();

        if (wallPostCount) {
          return {
            status: false,
            message: 'Module already linked in WallPost',
          };
        }

        const postCount = await ChannelPost.count(query).lean();

        if (postCount) {
          return {
            status: false,
            message: 'Module already linked in Channel Posts',
          };
        }

        const customFromCount = await CustomForm.count(query).lean();

        if (customFromCount) {
          return {
            status: false,
            message: 'Module already linked in Customform',
          };
        }

        return { status: true, message: 'Module not linked anywere' };
      }

      return { status: false, message: 'Module Not found' };
    } catch (error) {
      this.log(error, 'isModuleIncluded');
      return { status: false, message: 'Something went wrong' };
    }
  }

  async channelUsersList(channel, responseType = 'id') {
    const userDetails = channel.userDetails || [];

    try {
      let userList = [];

      for (const curr of userDetails) {
        let { businessUnits } = curr;
        const condition = {};

        if (curr.buFilterType === 1) {
          if (curr.allBuToken) {
            // eslint-disable-next-line no-await-in-loop
            const userBus = await User.findById(channel.createdBy)
              .select('planBussinessUnitId')
              .lean();

            if (userBus) {
              businessUnits = userBus.planBussinessUnitId.map((v) =>
                mongoose.Types.ObjectId(v),
              );
            }
          }

          condition.parentBussinessUnitId = {
            $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
          };
        } else if (curr.buFilterType === 2) {
          condition.parentBussinessUnitId = {
            $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
          };
          condition.$or = [
            {
              appointmentId: {
                $in: curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
            {
              subSkillSets: {
                $in: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
            {
              _id: {
                $in: curr.authors.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
          ];
          if (curr.customField.length) {
            condition.$or = condition.$or || [];
            for (const singleCustom of curr.customField) {
              condition.$or.push({
                otherFields: {
                  $elemMatch: {
                    fieldId: singleCustom.fieldId,
                    value: {
                      $in: [singleCustom.value],
                    },
                  },
                },
              });
            }
          }
        } else if (curr.buFilterType === 3) {
          condition.parentBussinessUnitId = {
            $in: businessUnits.map((v) => mongoose.Types.ObjectId(v)),
          };
          condition.$and = [
            {
              appointmentId: {
                $nin: curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
            {
              subSkillSets: {
                $nin: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
            {
              _id: {
                $nin: curr.authors.map((v) => mongoose.Types.ObjectId(v)),
              },
            },
          ];
          if (curr.customField.length) {
            condition.$and = condition.$and || [];
            for (const singleCustom of curr.customField) {
              condition.$and.push({
                'otherFields.fieldId': singleCustom.fieldId,
                'otherFields.value': { $ne: singleCustom.value },
              });
            }
          }
        }

        // eslint-disable-next-line no-await-in-loop
        const users = await User.aggregate([
          {
            $match: condition,
          },
          {
            $project: { name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
          },
        ]).allowDiskUse(true);

        userList = [...userList, ...users];
      }
      if (responseType === 'id') {
        return userList.map((v) => v._id);
      }

      return userList;
    } catch (error) {
      this.log(error);
      return [];
    }
  }

  htmlTagValidate(data) {
    const values = Object.values(data);

    return /^<([a-z]+)([^<]+)*(?:>(.*)<\/\1>|\s+\/>)$/.test(values);
  }

  // Password Validation Company Wise
  async pwdValidation(userData, password) {
    const settingData = await PageSetting.findOne({
      companyId: userData.companyId,
    });

    // Return with messages
    const returnData = {
      status: true,
      message: [],
      pwdSettings: null,
    };

    // No Settings Yet
    if (!settingData) {
      return returnData;
    }

    const { pwdSettings } = settingData;

    // Inactive Management
    if (pwdSettings.status) {
      returnData.pwdSettings = settingData.pwdSettings;
    } else {
      return returnData;
    }

    // Start Validation as per keys
    // Char Length
    if (password.length < pwdSettings.charLength) {
      returnData.message.push(
        `Atleast ${pwdSettings.charLength} characters required`,
      );
      returnData.status = false;
    }

    // Lowercase
    if (pwdSettings.charTypes.lowerCase && !/[a-z]/.test(password)) {
      returnData.message.push(`Atleast one lowercase letter is required`);
      returnData.status = false;
    }

    // Uppercase
    if (pwdSettings.charTypes.upperCase && !/[A-Z]/.test(password)) {
      returnData.message.push(`Atleast one uppercase letter is required`);
      returnData.status = false;
    }

    // Number
    if (pwdSettings.charTypes.numbers && !/[0-9]/.test(password)) {
      returnData.message.push(`Atleast one numaric letter is required`);
      returnData.status = false;
    }

    // Special Character
    if (
      pwdSettings.charTypes.specialChar &&
      !/[!@#$%^&*()_+\-=\\[\]{};':"\\|,.<>\\/?]+/.test(password)
    ) {
      returnData.message.push(`Atleast one special character is required`);
      returnData.status = false;
    }

    return returnData;
  }

  // at manual BU update
  // at user plan BU update
  async updateAllBuToUser(userData, isIndividual) {
    const userId = userData._id;
    const condition = {
      createdBy: userId,
      'assignUsers.allBuToken': true,
    };
    const channelFinder = {
      createdBy: userId,
      'userDetails.allBuToken': true,
    };

    if (isIndividual) {
      condition['assignUsers.allBuTokenStaffId'] = userData.staffId;
      channelFinder['userDetails.allBuTokenStaffId'] = userData.staffId;
    }

    const channels = await Channel.find(channelFinder);
    const boards = await Wall.find(condition);
    const notifications = await Notification.find(condition);
    const forms = await CustomForm.find(condition);

    if (channels) {
      const channelArr = [];

      for (const channel of channels) {
        // channel.userDetails[0].businessUnits = userData.planBussinessUnitId;
        channel.userDetails.forEach((detail) => {
          if (detail.allBuToken) {
            detail.businessUnits = userData.planBussinessUnitId;
          }
        });
        channelArr.push(
          Channel.findOneAndUpdate(
            { _id: channel._id },
            {
              userDetails: channel.userDetails,
            },
          ),
        );
      }
      await Promise.all(channelArr);
    }

    if (boards) {
      const boardArr = [];

      for (const board of boards) {
        // board.assignUsers[0].businessUnits = userData.planBussinessUnitId
        board.assignUsers.forEach((user) => {
          if (user.allBuToken) {
            user.businessUnits = userData.planBussinessUnitId;
          }
        });
        boardArr.push(
          Wall.findOneAndUpdate(
            { _id: board._id },
            {
              assignUsers: board.assignUsers,
            },
          ),
        );
      }
      await Promise.all(boardArr);
    }

    if (notifications) {
      const notiArr = [];

      for (const notification of notifications) {
        // notification.assignUsers[0].businessUnits = userData.planBussinessUnitId
        notification.assignUsers.forEach((user) => {
          if (user.allBuToken) {
            user.businessUnits = userData.planBussinessUnitId;
          }
        });
        notiArr.push(
          Notification.findOneAndUpdate(
            { _id: notification._id },
            {
              assignUsers: notification.assignUsers,
            },
          ),
        );
      }
      await Promise.all(notiArr);
    }

    if (forms) {
      const formsArr = [];

      for (const form of forms) {
        // form.assignUsers[0].businessUnits = userData.planBussinessUnitId
        form.assignUsers.forEach((user) => {
          if (user.allBuToken) {
            user.businessUnits = userData.planBussinessUnitId;
          }
        });
        formsArr.push(
          CustomForm.findOneAndUpdate(
            { _id: form._id },
            {
              assignUsers: form.assignUsers,
            },
          ),
        );
      }
      await Promise.all(formsArr);
    }
  }

  // at manual BU update
  async updateAllBuToAccessUsers(companyId) {
    const systemAdminRoles = await Role.find({
      companyId,
      name: 'System Admin',
    })
      .select('_id')
      .lean();
    const systemAdminRolesIds = systemAdminRoles.map((v) => v._id);
    const planBUUpdatedUsers = await User.find({
      $or: [{ role: { $in: systemAdminRolesIds } }, { allBUAccess: 1 }],
      companyId,
    }).lean();

    // admins and allBUaccess users created forms, boards,... update
    for (const userData of planBUUpdatedUsers) {
      this.updateAllBuToUser(userData).then((result) => {
        logInfo('updateAllBuToUser', result);
      });
    }
  }

  async getPrivilegeData(userInfo) {
    if (!userInfo.roleUpdate) {
      return userInfo.privileges;
    }

    const privilege = userInfo.privileges;
    const whereClause = {
      _id: userInfo._id,
      status: { $ne: 3 /* $ne => not equal */ },
    };
    const users = await User.findOne(whereClause)
      .populate([
        {
          path: 'role',
          select: 'name description isFlexiStaff privileges',
          populate: {
            path: 'privileges',
            select: 'name description flags privilegeCategoryId',
            populate: {
              path: 'privilegeCategoryId',
              select: 'name',
            },
          },
        },
      ])
      .lean();
    const userData = await this.getUserPrivilegeObject(users.role.privileges);

    return userData || privilege;
  }

  async sendSMS(input) {
    try {
      const xForce = 'xForce+';
      const { body, to, isSats, sendFromNumber } = input;
      let from;

      if (isSats) {
        if (sendFromNumber) {
          from = process.env.TWILIO_FROM_XFORCE;
        } else {
          from = process.env.TWILIO_FROM;
        }
      } else {
        from = xForce;
      }

      let client = new Twilio(
        process.env.TWILIO_ACCOUNTSID_XFORCE,
        process.env.TWILIO_AUTHTOKEN_XFORCE,
      );

      if (isSats && !sendFromNumber) {
        client = new Twilio(
          process.env.TWILIO_ACCOUNTSID,
          process.env.TWILIO_AUTHTOKEN,
        );
      }

      await client.messages
        .create({
          body,
          to, // Text this number
          from, // From a valid Twilio number
        })
        .then(
          (data) => {
            this.log(data);
          },
          (error) => {
            this.log(error);
            if (!isSats) {
              input.isSats = true;
              input.sendFromNumber = true;
              this.sendSMS(input);
            }
          },
        );
    } catch (error) {
      /* empty catch block */
    }
  }

  stripeHtml(html) {
    return html
      .replace(/<(?!img|br).*?>/g, '')
      .replace(/<br\s*[/]?>/gi, '')
      .replace(/(\r\n|\n|\r)/gm, '')
      .replace(/&nbsp;/g, '');
  }

  checkHtmlContent(body) {
    const checkIfHtml = (input) =>
      /<((?=!\\-\\-)!\\-\\-[\s\S]*\\-\\-|((?=\?)\?[\s\S]*\?|((?=\/)\/[^.\-\d][^\\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*|[^.\-\d][^\\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:\s[^.\-\d][^\\/\]'"[!#$%&()*+,;<=>?@^`{|}~ ]*(?:=(?:"[^"]*"|'[^']*'|[^'"<\s]*))?)*)\s?\/?))>/.test(
        input,
      );
    const checkInData = (input) => {
      if (Array.isArray(input)) {
        return input.every((v) => checkInData(v));
      }

      if (input instanceof Object) {
        return Object.values(input).every((v) => checkInData(v));
      }

      if (typeof input === 'string') {
        return !checkIfHtml(input);
      }

      return true;
    };

    return checkInData(JSON.parse(JSON.stringify(body)));
  }

  checkSpecialCharacters(body, action) {
    const checkIsParsed = (input) => {
      try {
        if (action === 'profile update') {
          // input.otherFields = JSON.parse(input.otherFields);
          delete input.otherFields;
          delete input.password;
        }

        if (action === 'page settings') {
          delete input.bannerImages;
          // check this
          input.pwdSettings = input.pwdSettings
            ? delete input.pwdSettings.defaultPassword
            : '';
          delete input.externalLinks;
        }

        if (action === 'wall') {
          delete input.bannerImage;
          delete input.assignUsers;
        }

        if (action === 'manageNews') {
          delete input.teaser;
          delete input.content;
          delete input.teaserImage;
          delete input.publishing;
          if (typeof input.eventDetails === 'string') {
            input.eventDetails = JSON.parse(input.eventDetails);
            input.userOptions = JSON.parse(input.userOptions);
          }

          delete input.eventDetails.startDate;
          delete input.eventDetails.endDate;
        }

        if (action === 'manageEvent') {
          delete input.teaser;
          delete input.content;
          delete input.publishing;
          if (typeof input.eventDetails === 'string') {
            input.eventDetails = JSON.parse(input.eventDetails);
            input.wallTitle = JSON.parse(input.wallTitle);
            input.userOptions = JSON.parse(input.userOptions);
          }

          delete input.eventDetails.startDate;
          delete input.eventDetails.endDate;
        }

        if (action === 'notification') {
          delete input.notificationAttachment;
          delete input.effectiveFrom;
          delete input.effectiveTo;
          delete input.activeFrom;
          delete input.activeTo;
          delete input.userAcknowledgedAt;
          delete input.lastNotified;
        }

        if (action === 'modules') {
          delete input.updatedAt;
          delete input.createdAt;
          delete input.question;
          delete input.welComeMessage;
          delete input.closingMessage;
          delete input.welComeAttachement;
          delete input.submissionImage;
          delete input.imageSrc;
          if (input.options) {
            input.options.forEach((link) => {
              delete link.imageSrc;
            });
          }

          delete input.explanation;
        }

        if (action === 'customforms') {
          delete input.assignUsers;
          delete input.formLogo;
        }

        if (action === 'challenges') {
          delete input.challenge.icon;
          delete input.challenge.publishStart;
          delete input.challenge.publishEnd;
          delete input.challenge.challengeStart;
          delete input.challenge.challengeEnd;
        }

        return input;
      } catch (err) {
        return err;
      }
    };

    // check this I think this is not required as used nowhere
    // const checkInData = (input) => {
    //   if (Array.isArray(input)) {
    //     return input.every((v) => checkInData(v));
    //   }

    //   if (input instanceof Object) {
    //     return Object.values(input).every((v) => checkInData(v));
    //   }

    //   if (typeof input === 'string') {
    //     input = input.split('\n').join('');
    //     input = input === '' ? ' ' : input;
    //     return checkSC(input);
    //   }

    //   return true;
    // };

    body = checkIsParsed(JSON.parse(JSON.stringify(body)));
    return true;
  }

  /* init point system for a company */
  async initPointSystem(companyId, justReturn = false) {
    const data = [
      {
        icon: `0`,
        title: `Reward points`,
        description: `This is default point system. all other are non rewarded point system.`,
        isEnabled: true,
      },
    ];

    if (justReturn) return data;

    const pageSetting = await PageSetting.findOne({ companyId });

    pageSetting.pointSystems = data;
    await pageSetting.save();
    return data;
  }

  async getUserToken() {
    return new Promise((resolve, reject) => {
      request(
        {
          url: `${process.env.UNIQ_REWARD_URL}/v2/connect/token`,
          form: {
            client_id: process.env.UNIQ_CLIENT_ID,
            client_secret: process.env.UNIQ_CLIENT_SECRET,
            grant_type: 'client_credentials',
            scope: process.env.UNIQ_SCOPE,
          },
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (error, response, body) => {
          try {
            if (error) {
              return resolve(error);
            }

            body = JSON.parse(body);
            return resolve(body);
          } catch (err) {
            return reject(err);
          }
        },
      );
    });
  }
}
const globalFunctions = new GlobalFunctions();

module.exports = globalFunctions;
