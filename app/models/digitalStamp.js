const mongoose = require('mongoose');

const { Schema } = mongoose;

const DigitalStampSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    teamId: {
      type: Schema.Types.ObjectId,
    },
    customFormId: {
      type: Schema.Types.ObjectId,
      ref: 'Customform',
    },
    criteriaSourceType: {
      type: Number,
      enum: [6, 7],
      default: 6,
    },
    rewardPoints: {
      type: Number,
      default: 0,
    },
    status: {
      type: Boolean,
      default: true,
    },
    manageFormId: {
      type: Schema.Types.ObjectId,
      ref: 'ManageForm',
    },
    displayField: {
      type: Schema.Types.String,
    },
    displayFieldId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
    },
    displayDescription: {
      type: Schema.Types.String,
    },
    displayDescriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
    },
    criteriaCategory: {
      type: Schema.Types.String,
    },
    criteriaCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
    },
    criteriaCategoryLogo: {
      type: Schema.Types.String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('DigitalStamp', DigitalStampSchema);
