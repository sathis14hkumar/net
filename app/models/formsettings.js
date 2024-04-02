const mongoose = require('mongoose');

const { Schema } = mongoose;

const FormSetting = new Schema(
  {
    fieldStatus: [
      {
        _id: {
          type: Schema.Types.ObjectId,
        },
        status: {
          type: Boolean,
          default: false,
        },
      },
    ],
    statusFilter: [
      {
        _id: {
          type: Schema.Types.ObjectId,
        },
        status: {
          type: Boolean,
          default: false,
        },
      },
    ],
    formId: {
      type: Schema.Types.ObjectId,
      ref: 'Customform',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
FormSetting.index({ createdBy: 1 });

module.exports = mongoose.model('FormSetting', FormSetting);
