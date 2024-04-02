const passport = require('passport');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const __ = require('../helpers/globalFunctions');
const User = require('../app/models/user');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

/**
 * Sign in with LinkedIn.
 */
passport.use(
  new LinkedInStrategy(
    {
      clientID: process.env.LINKEDIN_ID,
      clientSecret: process.env.LINKEDIN_SECRET,
      callbackURL: process.env.LINKEDIN_CALLBACK_URL,
      scope: [
        'r_basicprofile',
        'r_fullprofile',
        'r_emailaddress',
        'r_network',
        'r_contactinfo',
        'rw_nus',
        'rw_groups',
        'w_messages',
      ],
      state: true,
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, res) => {
      User.findOne({
        linkedin: profile.id,
      })
        .lean()
        .then((userDoc) => {
          /* If LinkedinID  found */
          if (userDoc !== null) {
            User.findOneAndUpdate(
              {
                _id: req.user._id,
              },
              {
                $set: {
                  firstName: profile.displayName,
                  email: profile._json.emailAddress,
                  profilePicture: profile._json.pictureUrl,
                },
              },
              {
                new: true,
              },
            )
              .lean()
              .then((userDoc1) => {
                if (userDoc1 === null) {
                  return __.out(res, 400, 'Could not update Linkedin Details');
                }

                return __.out(res, 201, userDoc1);
              })
              .catch((err) => __.out(res, 500, err));
          } else {
            /* If LinkedinID not found */
            User.findOne({
              email: profile._json.emailAddress,
            })
              .lean()
              .then((userDoc2) => {
                /* If email exists */
                if (userDoc2 !== null) {
                  User.findOneAndUpdate(
                    {
                      _id: req.user._id,
                    },
                    {
                      $set: {
                        firstName: profile.displayName,
                        email: profile._json.emailAddress,
                        profilePicture: profile._json.pictureUrl,
                      },
                    },
                    {
                      new: true,
                    },
                  )
                    .lean()
                    .then((userDoc3) => {
                      if (userDoc3 === null) {
                        return __.out(
                          res,
                          400,
                          'Could not update Linkedin Details',
                        );
                      }

                      return __.out(res, 201, userDoc3);
                    })
                    .catch((err) => __.out(res, 500, err));
                } else {
                  /* Create new Linkedin user */
                  const user = new User();

                  user.linkedin = profile.id;
                  user.tokens.push({
                    kind: 'linkedin',
                    accessToken,
                  });
                  user.email = profile._json.emailAddress;
                  user.firstName = profile.displayName;
                  user.profilePicture = profile._json.pictureUrl;
                  user
                    .save()
                    .then((userDoc4) => {
                      if (userDoc4 === null) {
                        return __.out(
                          res,
                          201,
                          'Could not save Linkedin details',
                        );
                      }

                      return __.out(res, 201, userDoc4);
                    })
                    .catch((err) => __.out(res, 500, err));
                }
              })
              .catch((err) => __.out(res, 500, err));
          }
        })
        .catch((err) => __.out(res, 500, err));
    },
  ),
);
