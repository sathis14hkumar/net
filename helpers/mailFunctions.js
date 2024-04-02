const nodemailer = require('nodemailer');
const os = require('os');
const smtpTransport = require('nodemailer-smtp-transport');
const hbs = require('nodemailer-express-handlebars');
const __ = require('./globalFunctions');

const testEmail = false;
const testEmailId = 'janen@askpundit.com';

let serverType = null;
let clientBaseUrl = null;
let serverBaseUrl = null;

if (
  os.hostname().indexOf('doodlews-67') === 0 ||
  os.hostname().indexOf('doodlews-88') === 0
) {
  /* localhost */ serverType = 'LOCAL';
  clientBaseUrl = process.env.LOCAL_CLIENT_BASEURL;
  serverBaseUrl = process.env.LOCAL_SERVER_BASEURL;
} else if (os.hostname().indexOf('doodledev') === 0) {
  /* staging */ serverType = 'STAGING';
  clientBaseUrl = process.env.STAGING_CLIENT_BASEURL;
  serverBaseUrl = process.env.STAGING_SERVER_BASEURL;
} /* live */ else {
  /* live hostname = 'ip-172-31-18-55' */
  serverType = 'LIVE';
  clientBaseUrl = process.env.LIVE_CLIENT_BASEURL;
  serverBaseUrl = process.env.LIVE_SERVER_BASEURL;
}

const transporter = nodemailer.createTransport(
  smtpTransport({
    service: 'Office365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
  }),
);

const transporterXforce = nodemailer.createTransport(
  require('nodemailer-smtp-transport')({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    requireTLS: true,
    auth: {
      user: process.env.NODEMAILER_EMAIL_XFORCE,
      pass: process.env.NODEMAILER_PASSWORD_XFORCE,
    },
  }),
);

const options = {
  viewEngine: {
    extname: '.hbs',
    partialsDir: 'public/email/',
    layoutsDir: 'public/email/',
  },
  viewPath: 'public/email/',
  extName: '.hbs',
};

class Mail {
  feedback(userDoc) {
    /* to admin */
    const mailOptions = {
      /* for user */
      from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
      to: testEmail ? testEmailId : userDoc.adminEmail,
      subject: `MySATS+ | Feedback`,
      text: `Hi
                You have received feedback from the staff.
                
                Name :${userDoc.name},
                StaffId:${userDoc.staffId},
                Topic :${userDoc.topic},
                Message :${userDoc.message}`,
    };

    if (testEmail !== true && serverType !== 'LIVE') {
      mailOptions.bcc = testEmailId;
    }

    this.send(mailOptions, false);
  }

  forgotPassword(userDoc) {
    const context = {
      ...userDoc,
    };

    userDoc.companyData.logo = serverBaseUrl + userDoc.companyData.logo;
    userDoc.companyData.url = `${
      clientBaseUrl + userDoc.companyData.pathName
    }#!/`;
    context.url = `${userDoc.companyData.url}set-password/${userDoc.emailToken}`;

    const mailOptions = {
      /* for user */
      from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
      to: userDoc.userEmail,
      subject: `MySATS+ | Password Reset`,
      template: 'resetpassword',
      context,
    };

    if (testEmail !== true && serverType !== 'LIVE') {
      mailOptions.bcc = testEmailId;
    }

    this.send(mailOptions, true);
  }

  newUser(userDoc) {
    const mailOptions = {
      /* for user */
      from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
      to: userDoc.email,
      subject: `MySATS+ | New User`,
      context: {
        ...userDoc,
      },
      template: 'newuser',
    };

    if (testEmail !== true && serverType !== 'LIVE') {
      mailOptions.bcc = testEmailId;
    }

    this.send(mailOptions, true);
  }

  newCompanyUser(userDoc) {
    userDoc.companyData_name = userDoc.companyData.name;
    userDoc.companyData_logo = userDoc.companyData.logo;
    userDoc.companyData_url = userDoc.companyData.url;
    const isSats = !!userDoc.companyData_name.match(/sats/i);

    userDoc.companyData_logo = `${serverBaseUrl}uploads/companyLogos/mysatsplus_xforce.png`;
    userDoc.companyData_url = `${
      clientBaseUrl +'users/login/'+ userDoc.companyData.pathName
    }#!/`;

    let template = 'newCompanyUser_xforce';
    let fromAddress = process.env.NODEMAILER_EMAIL_XFORCE;
    let subject = `Welcome to xForce+ for ${userDoc.companyData_name}`;

    if (isSats) {
      fromAddress = process.env.NODEMAILER_EMAIL;
      template = 'newCompanyUser';
      userDoc.companyData_logo = `${serverBaseUrl}uploads/companyLogos/mysatsplus.png`;
      subject = `MySATS+ | New User`;
    }

    const mailOptions = {
      /* for user */
      from: `${userDoc.companyData_name}<${fromAddress}>`,
      to: userDoc.email,
      subject,
      context: {
        ...userDoc,
      },
      template,
    };

    if (testEmail !== true && serverType !== 'LIVE') {
      mailOptions.bcc = testEmailId;
    }

    if (isSats) {
      this.send(mailOptions, true);
    } else {
      this.send_xforce(mailOptions, true);
    }
  }

  notificReminder(data) {
    if (data.companyData.logo.indexOf('http') === -1) {
      data.companyData.logo = serverBaseUrl + data.companyData.logo;
    }

    const mailOptions = {
      from: `${data.companyData.name} <${data.companyData.email}>`,
      to: data.userData.email,
      subject: `${data.companyData.name} | Notification Reminder`,
      context: {
        ...data,
      },
      template: 'notificationReminder',
    };

    if (testEmail !== true && serverType !== 'LIVE') {
      mailOptions.bcc = testEmailId;
    }

    this.send(mailOptions, true);
  }

  userFeedback(userDoc) {
    /* to admin */
    const mailOptions = {
      /* for user */
      from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
      to: testEmail ? testEmailId : userDoc.email,
      subject: `MySATS+ | Feedback`,
      text: `Hi,

            Name :${userDoc.name},
            Email :${userDoc.email},
            Phone :${userDoc.phone},
            Message :${userDoc.feedback}`,
    };

    if (testEmail !== true && serverType !== 'LIVE') {
      mailOptions.bcc = testEmailId;
    }

    this.send(mailOptions, false);
  }

  async sendOtp(userDoc) {
    const companyName =
      userDoc.companyId.name === 'SATS' ? 'MySATS+' : userDoc.companyId.name;
    const mailOptions = {
      from: `${companyName} <${process.env.NODEMAILER_EMAIL}>`,
      to: userDoc.email,
      subject: `${companyName} | Ontime Password`,
      context: {
        ...userDoc,
      },
      template: 'otp',
    };

    await this.sendNow(mailOptions, true);
  }

  async sendNow(mailOptions, withTemplate = false) {
    if (withTemplate) {
      options.viewEngine.defaultLayout = mailOptions.template;
      transporter.use('compile', hbs(options));
    }

    await transporter
      .sendMail(mailOptions)
      .then(() => {
        __.log(`email sent`);
      })
      .catch(() => {
        __.log(`something problem with mail function`);
      });
  }

  send(mailOptions, withTemplate = false) {
    if (withTemplate) {
      options.viewEngine.defaultLayout = mailOptions.template;
      transporter.use('compile', hbs(options));
    }

    transporter
      .sendMail(mailOptions)
      .then((data) => {
        __.log('email sent');
        __.log(data);
      })
      .catch((err) => {
        __.log(err);
      });
  }

  send_xforce(mailOptions, withTemplate = false) {
    if (withTemplate) {
      options.viewEngine.defaultLayout = mailOptions.template;
      transporterXforce.use('compile', hbs(options));
    }

    transporterXforce
      .sendMail(mailOptions)
      .then((data) => {
        __.log('email sent');
        __.log(data);
      })
      .catch((err) => {
        __.log(err);
      });
  }
}

const mail = new Mail();

module.exports = mail;
