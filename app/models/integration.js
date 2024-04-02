const mongoose = require('mongoose');

const { Schema } = mongoose;

const Integration = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    newUsers: [
      {
        type: String,
        default: '',
      },
    ],
    updatedUsers: [
      {
        type: String,
        default: '',
      },
    ],
    nonUpdatedUsers: [
      {
        type: String,
        default: '',
      },
    ],
    sourcePath: {
      type: String,
    },
    errorFilePath: {
      type: String,
    },
    status: {
      /** 1: Success, 2: Partially Success, 3: File not found */
      type: String,
      default: 'Success',
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
Integration.index({ companyId: 1 });

module.exports = mongoose.model('Integration', Integration);
