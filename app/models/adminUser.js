const mongoose = require('mongoose');
const bcrypt = require('bcrypt-nodejs');

const { Schema } = mongoose;

const AdminUserSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    userName: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    profilePicture: {
      type: String,
      default: '',
    },
    contactNumber: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['superadmin', 'adminuser'],
      default: 'adminuser',
    },
    deviceToken: {
      type: String,
    },
    loggedIn: {
      type: Date,
    },
    otp: {
      type: String,
      default: '',
    },
    status: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// method to encrypt password
AdminUserSchema.methods.generateHash = function (password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// method to decrypt password
AdminUserSchema.methods.validPassword = function (password) {
  const adminUser = this;

  return bcrypt.compareSync(password, adminUser.password);
};
const AdminUser = mongoose.model('AdminUser', AdminUserSchema);

module.exports = AdminUser;
