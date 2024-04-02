const os = require('os');

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const swaggerUI = require('swagger-ui-express');

const app = express();
const compression = require('compression');
const helmet = require('helmet');
const chalk = require('chalk');
const bodyParser = require('body-parser');
const passport = require('passport');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const __ = require('./helpers/globalFunctions');
const GlobalLogs = require('./app/models/globalLog');
const { logInfo, logError } = require('./helpers/logger.helper');
const ResponseHelper = require('./helpers/response.helper');

let dbHost;
let environment = 'live';
let port;

if (
  os.hostname().indexOf('doodlews-67') === 0 ||
  os.hostname().indexOf('doodlews-88') === 0 ||
  os.hostname().indexOf('doodlews-70') === 0 ||
  os.hostname().indexOf('doodlews116') === 0 ||
  os.hostname().indexOf('doodle-ws-71') === 0 ||
  os.hostname().indexOf('doodleblue-ws-15') === 0
) {
  /* localhost */
  dbHost = process.env.LOCAL_DB_HOST;
  environment = 'local';
  port = process.env.LOCAL_STAGING_PORT;
} else if (os.hostname().indexOf('doodledev') === 0) {
  /* staging */
  dbHost = process.env.STAGING_DB_HOST;
  environment = 'staging';
  port = process.env.LOCAL_STAGING_PORT;
} /* live */ else {
  /* live hostname = 'ip-172-31-18-55' */
  dbHost = process.env.LIVE_DB_HOST;

  environment = 'live';
  port = process.env.LIVE_PORT;
}

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;
// dbHost = "mongodb://localhost:27017/flexishift";
// dbHost = "mongodb://polarisdev3.gq:27017/flexiDev";
// dbHost = "mongodb://3.0.89.233:27017/flexiDev1";
// dbHost = "mongodb://polarisdev3.gq:27017/Prd";
mongoose.connect(dbHost);
mongoose.connection.on('error', () => {
  logInfo(
    `%s MongoDB connection error. Please make sure MongoDB is running (${dbHost}).`,
    chalk.red('✗'),
  );
  process.exit();
});
logInfo('DATABASE CONNECTED IS: ');
/* Express configuration */
new ResponseHelper().init(app);
app.set('port', port);
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = process.env.ORIGINS?.split(',');
const corsOptions = {
  origin(origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};

app.use(cors(corsOptions));
app.use(compression());

// X-Frame-Options defaults to sameorigin
app.use(helmet.frameguard({ action: 'sameorigin' }));

// Sets "Strict-Transport-Security: max-age=5184000; includeSubDomains".
const sixtyDaysInSeconds = 5184000;

app.use(
  helmet.hsts({
    maxAge: sixtyDaysInSeconds,
  }),
);

// Sets "X-XSS-Protection: 1; mode=block".
app.use(helmet.xssFilter());

// Sets "X-Content-Type-Options: nosniff".
app.use(helmet.noSniff());

app.use(
  bodyParser.json({
    limit: '50mb',
  }),
);
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: '50mb',
    parameterLimit: 1000000,
  }),
);

const opts = {
  explorer: false,
  swaggerOptions: {
    validatorUrl: null,
  },
  customSiteTitle: 'Flexishift - Backend REST Service',
  customfavIcon: 'https://www.doodleblue.com/favicon/16x16.png',
};

const swaggerDocument = require('./docs/swagger.json');

app.use('/docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument, opts));

app.use(passport.initialize());

/**
 * Rate Limiter
 */

app.enable('trust proxy');

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 250,
});

app.use(limiter);

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'"],
      styleSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      requireTrustedTypesFor: ['script'],
    },
  }),
);

/** Clear cache */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
});

// defining router
const loginRoute = require('./app/routes/loginRouter');
const externalRoute = require('./app/routes/externalFormRoute');
const logRoute = require('./app/routes/logRouter');
/* company */
const companyUserRoute = require('./app/routes/company/companyUserRouter');
const roleRoute = require('./app/routes/company/roleRouter');
const companyRoute = require('./app/routes/company/companyRouter');
const departmentRoute = require('./app/routes/company/departmentRouter');
const sectionRoute = require('./app/routes/company/sectionRouter');
const subSectionRoute = require('./app/routes/company/subSectionRouter');
const businessUnitRoute = require('./app/routes/company/businessUnitRouter');
const skillSetRoute = require('./app/routes/company/skillSetRouter');
const subSkillSetRoute = require('./app/routes/company/subSkillSetRouter');
const reportingLocationRoute = require('./app/routes/company/reportingLocationRouter');
const shiftRoute = require('./app/routes/company/shiftRouter');
const templateRoute = require('./app/routes/company/templateRouter');
const weeklyStaffingRoute = require('./app/routes/company/weeklyStaffingRouter');
const privilegeCategoryRoute = require('./app/routes/company/privilegeCategoryRouter');
const privilegeRoute = require('./app/routes/company/privilegeRouter');
const categoryRoute = require('./app/routes/company/categoryRouter');
const subCategoryRoute = require('./app/routes/company/subCategoryRouter');
const appointmentRoute = require('./app/routes/company/appointmentRouter');
const notificationRoute = require('./app/routes/company/notificationRouter');
const manageNotificationRoute = require('./app/routes/company/manageNotificationRouter');
const settingRoute = require('./app/routes/company/settingRouter');
const reportsRoute = require('./app/routes/company/reportsRouter');
const shiftLogRouter = require('./app/routes/company/shiftLogRouter');
const channelRoute = require('./app/routes/company/channelRouter');
const postRoute = require('./app/routes/company/postRouter');
const userFieldRoute = require('./app/routes/company/userFieldRouter');
const centralBuilderRoute = require('./app/routes/company/centralBuilderRouter');
const pageSettingRoute = require('./app/routes/company/pageSettingrouter');
const postLogRoute = require('./app/routes/company/postLogRouter');
const wallRoute = require('./app/routes/company/wallRouter');
const timeSheetRoute = require('./app/routes/company/timesheetRouter');
const buTemplateRoute = require('./app/routes/company/buTemplateRouter');
const customForm = require('./app/routes/company/customFormRouter');
const resetPasswordRoute = require('./app/routes/company/resetPasswordRouter');
const assignShiftRoute = require('./app/routes/company/assignShiftRouter');
const ballotRoute = require('./app/routes/company/ballotRouter');
const leaveApplicationRoute = require('./app/routes/company/leavesRouter');
/* staff */
const staffShiftRoute = require('./app/routes/staff/staffShiftRouter');
const staffUserRoute = require('./app/routes/staff/staffUserRouter');
const staffNotificationRoute = require('./app/routes/staff/staffNotificationRouter');
const integrationRoute = require('./app/routes/company/integrationRouter');
const opsGroupRoute = require('./app/routes/company/opsGroupRouter');
const eventSessionRoute = require('./app/routes/company/eventSessionRouter');
/* Common */
const commonPostRoute = require('./app/routes/common/postRouter');
const questionModuleRoute = require('./app/routes/common/questionModuleRouter');
const myBoardRoute = require('./app/routes/common/myBoardRouter');
const wallPostRoute = require('./app/routes/common/wallPostRouter');
const reportRoute = require('./app/routes/common/reportPostRouter');
const emojiRoute = require('./app/routes/common/emojiRouter');
const rewardRoute = require('./app/routes/common/rewardRouter');
const redeemedSettingRoute = require('./app/routes/common/redeemedSettingRouter');
const challengeRoute = require('./app/routes/common/challengeRouter');
const addOnSchemesRoute = require('./app/routes/company/addOnSchemesRouter');
const leaveTypeRoute = require('./app/routes/company/leaveTypeRouter');
const leaveGroupRoute = require('./app/routes/company/leaveGroupRouter');
const leaveManagementRoute = require('./app/routes/company/leaveManagementRouter');
const newLeavePlannerRoute = require('./app/routes/company/newLeavePlannerRouter');
const swappingRouter = require('./app/routes/company/swappingRouter');
/* Super Admin Routes */
const superAdminLoginRoute = require('./app/routes/superadmin/loginRouter');
const superAdmincompanyRoute = require('./app/routes/superadmin/companyRouter');
const superAdminList = require('./app/routes/superadmin/list');
const facialRoute = require('./app/routes/company/facialDataRouter');
const schemeRoute = require('./app/routes/company/schemeRouter');
const csvDownload = require('./app/routes/common/csv-download');
const attendanceRoute = require('./app/routes/company/attendanceRouter');

require('./helpers/authApi');

// app.get("/", function(req, res) {
//   res.send("Welcome Flexishift!");
// });

// app.use(function(req, res, next) {
//   next();
// });

/* Routes */
app.use('/login', loginRoute);
app.use('/superadmin/auth/', superAdminLoginRoute);
app.use('/log', logRoute);
app.use('/integration', integrationRoute);
/* External Routes */
app.use('/external', externalRoute);
app.use('/*.jpg', csvDownload);
app.use('/*.jpeg', csvDownload);
app.use('/*.png', csvDownload);
app.use('/*.gif', csvDownload);
app.use('/*.mp4', csvDownload);
app.use('/*.mpg', csvDownload);
app.use('/*.mpeg', csvDownload);
app.use('/*.3gp', csvDownload);
app.use('/*.avi', csvDownload);
app.use('/*.pdf', csvDownload);

/* Super Admin Routes ends */

/*
 Reset Password Duration Status
 */
/* ,
    process.env.API_KEY */

async function addGlobalLogs(method, apiPath, userID, payload) {
  try {
    if (method !== 'GET') {
      const insertData = {
        method,
        apiPath,
        userID,
        payload,
      };

      new GlobalLogs(insertData).save().then(() => ({}));
    }

    return true;
  } catch (err) {
    logError(`Adding GlobalLogs is having an error`, err);
    return false;
  }
}

app.use(
  passport.authenticate('jwt', {
    session: false,
  }),
  (req, res, next) => {
    addGlobalLogs(req.method, req.path, req.user._id, req.body).then(() => {});
    next();
    // if (
    //   !!req.user &&
    //   req.user.pwdDurationStatus &&
    //   req.user.pwdDurationStatus == true // this logic we will come to any other common API
    // ) {
    //   next();
    // } else {
    //   res.send(401, {
    //     error: 'Passwordchange',
    //     message: 'You have to change your password',
    //   });
    // }
  },
);

/* Company Routes starts */
app.use('/facial', facialRoute);
app.use('/scheme', schemeRoute);
app.use('/attendance', attendanceRoute);
app.use('/companyuser', companyUserRoute);
app.use('/user', companyUserRoute);
app.use('/timesheet', timeSheetRoute);
app.use('/role', roleRoute);
app.use('/company', companyRoute);
app.use('/department', departmentRoute);
app.use('/section', sectionRoute);
app.use('/subsection', subSectionRoute);
app.use('/businessunit', businessUnitRoute);
app.use('/skillset', skillSetRoute);
app.use('/subskillset', subSkillSetRoute);
app.use('/repotinglocation', reportingLocationRoute);
app.use('/shift', shiftRoute);
app.use('/template', templateRoute);
app.use('/weeklystaffing', weeklyStaffingRoute);
app.use('/privilegeCategory', privilegeCategoryRoute);
app.use('/privilege', privilegeRoute);
app.use('/category', categoryRoute);
app.use('/subcategory', subCategoryRoute);
app.use('/appointment', appointmentRoute);
app.use('/notification', notificationRoute);
app.use('/manage-notification', manageNotificationRoute);
app.use('/setting', settingRoute);
app.use('/reports', reportsRoute);
app.use('/shiftLog', shiftLogRouter);
app.use('/channel', channelRoute);
app.use('/post', postRoute);
app.use('/userField', userFieldRoute);
app.use('/custom-field', userFieldRoute);
app.use('/centralBuilder', centralBuilderRoute);
app.use('/pageSetting', pageSettingRoute);
app.use('/wall', wallRoute);
app.use('/postLog', postLogRoute);
app.use('/buTemplate', buTemplateRoute);
app.use('/customForm', customForm);
app.use('/event', eventSessionRoute);
app.use('/assginshift', assignShiftRoute);
app.use('/ballot', ballotRoute);
app.use('/leaveapplication', leaveApplicationRoute);
app.use('/resetPass', resetPasswordRoute);
app.use('/opsgroup', opsGroupRoute);
app.use('/addOnSchemes', addOnSchemesRoute);
app.use('/leavetype', leaveTypeRoute);
app.use('/leavegroup', leaveGroupRoute);
app.use('/leavemanagement', leaveManagementRoute);
app.use('/newleaveplanner', newLeavePlannerRoute);
app.use('/swap', swappingRouter);
/* company Routes ends */

/* staff Routes starts */
app.use('/staffuser', staffUserRoute);
app.use('/staffshift', staffShiftRoute);
app.use('/staffnotification', staffNotificationRoute);
/* staff Routes ends */

/* Common Routes starts */
app.use('/common/post/', commonPostRoute);
app.use('/common/questionModule/', questionModuleRoute);
app.use('/common/myBoards/', myBoardRoute);
app.use('/common/wallPost/', wallPostRoute);
app.use('/common/report/', reportRoute);
app.use('/common/emoji/', emojiRoute);
app.use('/common/redemption/', rewardRoute);
app.use('/common/redeemedSetting/', redeemedSettingRoute);
app.use('/common/challenge/', challengeRoute);

/* Common Routes ends */

/* Super Admin Routes starts */
app.use('/superadmin/company/', superAdmincompanyRoute);
app.use('/superadmin/list', superAdminList);
/* Super Admin Routes ends */

// Download CSV
app.use('/uploads/*', csvDownload);
app.use('*.csv', csvDownload);

// if (environment != "local")
/* cron for only live */
require('./helpers/cron');
// eslint-disable-next-line no-unused-vars
const errorhandle = (error, request, response, next) => {
  if (typeof error === 'string') {
    response.status(500).json({ message: error });
  }

  response.status(error.status || 500).json({ message: error.message });
};

app.use(errorhandle);

/* Start Express server. */
app.listen(app.get('port'), () => {
  logInfo(
    `%s App is running at ${__.serverBaseUrl()} `,
    chalk.blue('✓'),
    app.get('port'),
    environment,
  );
  logInfo('Press CTRL-C to exit');
});

module.exports = app;
