const mongoose = require('mongoose');

const { Schema } = mongoose;

const schema = {
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
  },
  tier2: {
    new: [
      {
        type: String,
        default: '',
      },
    ],
    updated: [
      {
        type: String,
        default: '',
      },
    ],
    exists: [
      {
        type: String,
        default: '',
      },
    ],
  },
  tier3: {
    new: [
      {
        type: String,
        default: '',
      },
    ],
    updated: [
      {
        type: String,
        default: '',
      },
    ],
    exists: [
      {
        type: String,
        default: '',
      },
    ],
  },
  title: {
    new: [
      {
        type: String,
        default: '',
      },
    ],
    updated: [
      {
        type: String,
        default: '',
      },
    ],
    exists: [
      {
        type: String,
        default: '',
      },
    ],
  },
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
};
const IntegrationMasterData = new Schema(schema, {
  timestamps: true,
});

module.exports = mongoose.model('IntegrationMasterData', IntegrationMasterData);
