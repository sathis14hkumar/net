const { ExtractJwt, Strategy: JwtStrategy } = require('passport-jwt');
const passport = require('passport');
const fs = require('fs');
const User = require('../app/models/user');
const AdminUser = require('../app/models/adminUser');
const __ = require('./globalFunctions');
const AuthenticatedModel = require('../app/models/authenticated');

const accessPublicKey = fs.readFileSync('access-public-key.pem', 'utf8');

ExtractJwt.fromAuthHeaderAsBearerToken();

const jwtOptions = {
  secretOrKey: accessPublicKey,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  algorithms: ['RS256'],
  ignoreExpiration: true,
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
    // SUPER ADMIN APIs
    try {
      if (new Date() > new Date(jwtPayload.exp * 1000)) {
        return done({ status: 403, message: ' Token expired' }, false);
      }

      if (
        jwtPayload.flexiController &&
        jwtPayload.flexiController === 'superadmin'
      ) {
        const user = await AdminUser.findOne({
          _id: jwtPayload.id,
          role: jwtPayload.role,
          status: 1,
        }).exec();

        __.log(user);
        if (!user) {
          return done(null, false);
        }

        if (!user.role) {
          return done(null, false);
        }

        const authData = await AuthenticatedModel.findOne({
          tokenId: jwtPayload.tokenId,
          userId: jwtPayload.id,
          status: true,
        }).exec();

        if (!authData) {
          return done(null, false);
        }

        user.tokenId = jwtPayload.tokenId;

        return done(null, user);
      }

      const user = await User.findOne({
        _id: jwtPayload.id,
        status: 1,
      })
        .populate([
          {
            path: 'role', // using but adding into token data
            select: 'name description isFlexiStaff',
          },
          {
            path: 'schemeId', // using but adding into token data
            select: 'shiftSchemeType', // ** this data we will use in booking API so one query will reduce there on user collection
          },
          {
            path: 'companyId', // using but adding into token data
            select: 'name logo', // not using
          },
        ])
        .exec();

      if (!user) {
        return done(null, false);
      }

      const authData = await AuthenticatedModel.findOne({
        tokenId: jwtPayload.tokenId,
        userId: jwtPayload.id,
        status: true,
      }).exec();

      if (!authData) {
        return done(null, false);
      }

      if (!user.role) {
        return done(null, false);
      }

      // Current Device
      user.tokenId = jwtPayload.tokenId;
      user.company = user.companyId;
      user.companyId = user.companyId._id;
      user.privileges = jwtPayload.privileges;
      user.authenticateId = authData._id;
      // All bu access
      user.allBUAccess = user.allBUAccess || 0;

      // Staff
      user.isFlexiStaff = user.role.isFlexiStaff;
      return done(null, user);
    } catch (err) {
      return done(err, false);
    }
  }),
);
