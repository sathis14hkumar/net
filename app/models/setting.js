const mongoose = require('mongoose');

const { Schema } = mongoose;

const settingSchema = new Schema(
  {
    adminEmail: {
      type: String,
      default: '',
    },
    techEmail: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);
const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;
