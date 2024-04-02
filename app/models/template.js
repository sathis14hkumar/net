const mongoose = require('mongoose');

const { Schema } = mongoose;

const TemplateSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    weekNumber: {
      type: Number,
      default: 1,
    },
    weekRangeStartsAt: {
      type: Date,
    },
    weekRangeEndsAt: {
      type: Date,
    },
    plannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isSplitShift: {
      type: Boolean,
      default: false,
    },
    shifts: [
      {
        isSplitShift: {
          type: Boolean,
          default: false,
        },
        subSkillSets: [
          {
            type: Schema.Types.ObjectId,
            ref: 'SubSkillSet',
          },
        ],
        skillSetTierType: {
          type: Number,
          default: 2,
        },
        mainSkillSets: [
          {
            type: Schema.Types.ObjectId,
            ref: 'SkillSet',
          },
        ],
        totalStaffNeedCount: {
          type: Number,
          default: 0,
        },
        staffNeedCount: {
          type: Number,
          default: 0,
        },
        backUpStaffNeedCount: {
          type: Number,
          default: 0,
        },
        date: {
          type: Date,
        },
        day: {
          type: String,
          default: '',
        },
        startTime: {
          type: Date,
        },
        endTime: {
          type: Date,
        },
        startTimeInSeconds: {
          type: Number,
        },
        endTimeInSeconds: {
          type: Number,
        },
        reportLocationId: {
          type: Schema.Types.ObjectId,
          ref: 'ReportingLocation',
        },
        status: {
          type: Number,
          default: 0,
        },
        splitStartTime: {
          type: Date,
        },
        splitEndTime: {
          type: Date,
        },
        uniqueId: {
          type: Schema.Types.ObjectId,
        },
        _id: {
          type: Schema.Types.ObjectId,
        },
      },
    ],
    status: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
TemplateSchema.index({ plannedBy: 1, businessUnitId: 1 });

const Template = mongoose.model('Template', TemplateSchema);

module.exports = Template;
