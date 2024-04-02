const mongoose = require('mongoose');

const { Schema } = mongoose;

const GlobalLogSchema = new Schema(
  {
    method: {
      type: String,
      required: true,
    },
    apiPath: {
      type: String,
      required: true,
    },
    userID: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    payload: {
      type: Object,
    },
  },
  {
    timestamps: true,
  },
);

const globalLogs = mongoose.model('GlobalLogs', GlobalLogSchema);

module.exports = globalLogs;
