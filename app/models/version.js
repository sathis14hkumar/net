const mongoose = require('mongoose');

const { Schema } = mongoose;

const VersionSchema = new Schema(
  {
    android: {
      type: String,
      default: '',
    },
    ios: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    playStorePath: {
      type: String,
      default: '',
    },
    appleStorePath: {
      type: String,
      default: '',
    },
    app: {
      type: 'String',
      default: '',
    },
    status: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Version', VersionSchema);
