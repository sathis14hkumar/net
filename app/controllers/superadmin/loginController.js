const jwt = require('jsonwebtoken');
const fs = require('fs');
const uuid = require('node-uuid');
const AdminUser = require('../../models/adminUser');
const mailer = require('../../../helpers/mailFunctions');
const __ = require('../../../helpers/globalFunctions');
const User = require('../../models/user');

const accessPrivateKey = fs.readFileSync('access-private-key.pem', 'utf8');
const refreshPrivateKey = fs.readFileSync('refresh-private-key.pem', 'utf8');
const AuthenticatedModel = require('../../models/authenticated');

// Native Login
class AdminAuthController {
  async createAdminUser() {
    // let insert = new AdminUser();
    // insert.name = "Super Admin";
    // insert.userName = "admin";
    // insert.password = insert.generateHash('test123');
    // insert.role = "superadmin";
    // insert.email = "janen@askpundit.com";
    // insert.contactNumber = "9551705709";
    // console.log(insert)
    // let insertedDoc = await insert.save();
    // console.log(insertedDoc)
    // res.send('ok');
  }

  async login(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'userName',
        'password',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const userData = await AdminUser.findOne({
        userName: req.body.userName,
        status: {
          $ne: 3,
        },
      });

      if (userData === null) {
        return __.out(res, 300, 'User not found');
      }

      if (userData.status !== 1) {
        return __.out(res, 300, 'Authentication failed. Inactive account.');
      }

      const validPassword = userData.validPassword(req.body.password);

      if (!validPassword) {
        return __.out(res, 300, 'Authentication failed. Wrong password.');
      }

      userData.loggedIn = Date.now();
      if (req.body.deviceToken) userData.deviceToken = req.body.deviceToken;

      const tokenId = uuid.v4();

      await new AuthenticatedModel({ tokenId, userId: userData._id }).save();

      const updatedData = await userData.save();
      const doc = updatedData.toObject();
      const user = {
        id: doc._id,
        loggedIn: doc.loggedIn,
        role: doc.role,
        flexiController: 'superadmin',
        tokenId,
      };

      const token = jwt.sign(user, accessPrivateKey, {
        algorithm: 'RS256',
        expiresIn: process.env.EXPIRYTIME,
      });

      const refreshToken = jwt.sign(user, refreshPrivateKey, {
        algorithm: 'RS256',
      });

      const newUserData = doc;

      newUserData.userId = userData._id;
      newUserData.flexiController = 'superadmin';
      delete newUserData._id;

      return __.out(res, 201, {
        data: newUserData,
        token: `Bearer ${token}`,
        refreshToken: `Bearer ${refreshToken}`,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  test(req, res) {
    __.out(res, 200);
  }

  async logout(req, res) {
    try {
      __.log(req.user);

      const updated = await AdminUser.findOneAndUpdate(
        {
          _id: req.user._id,
        },
        {
          $set: {
            loggedIn: new Date(),
          },
        },
      );

      __.log('updated', updated);
      __.out(res, 201, 'You have been logged out successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async forgotPassword(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'staffId',
        'email',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const userData = await User.findOne({
        staffId: req.body.staffId.toLowerCase(),
        status: 1,
      }).lean();

      if (userData != null) {
        if (
          userData.email.toLowerCase().trim() !==
          req.body.email.toLowerCase().trim()
        ) {
          return __.out(res, 300, 'Invalid email');
        }

        const emailToken = jwt.sign(
          {
            _id: userData._id,
            loggedIn: userData.loggedIn,
          },
          process.env.API_KEY,
          {
            expiresIn: '2h',
          },
        );
        const mailData = {
          userName: userData.name,
          userEmail: userData.email,
          staffId: userData.staffId,
          emailToken,
        };

        await mailer.forgotPassword(mailData);

        return res.status(200).json({
          message:
            'Please check your registered email account to reset your password.',
          data: {
            staffId: userData.staffId,
          },
        });
      }

      return __.out(res, 300, 'Invalid StaffId');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async checkTokenForForgotPassword(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const parsedToken = jwt.verify(req.params.token, process.env.API_KEY);
      const userData = await User.findOne({
        _id: parsedToken._id,
        loggedIn: parsedToken.loggedIn,
      }).lean();

      if (userData != null) {
        return __.out(res, 201, {
          data: {
            userId: parsedToken._id,
          },
          message: 'Link verified successfully',
        });
      }

      return __.out(res, 300, 'Invalid link / Link has already been used');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          message: 'Your link has expired',
        });
      }

      __.log(err);
      return __.out(res, 500);
    }
  }

  async resetPassword(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = __.checkRequiredFields(req, [
        'userId',
        'password',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const userData = await User.find({
        _id: req.body.userId,
        status: 1,
      });

      if (userData === null) {
        return __.out(res, 300, 'Invalid staffId');
      }

      const { generateHash } = new User();
      const hashVal = generateHash(req.body.password);

      await User.findOneAndUpdate(
        {
          _id: req.body.userId,
        },
        {
          $set: {
            password: hashVal,
          },
        },
      ).lean();

      return __.out(res, 201, `Password updated successfully`);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

const adminAuth = new AdminAuthController();

module.exports = adminAuth;
