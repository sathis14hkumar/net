const mongoose = require('mongoose');

const { Schema } = mongoose;

const BuTemplateSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    adminEmail: {
      type: String,
      default: '',
    },
    techEmail: {
      type: String,
      default: '',
    },
    shiftCancelHours: {
      type: Number,
      default: 0,
    },
    notificRemindDays: {
      type: Number,
      default: 0,
    },
    notificRemindHours: {
      type: Number,
      default: 0,
    },
    standByShiftPermission: {
      type: Boolean,
      default: false,
    },
    cancelShiftPermission: {
      type: Boolean,
      default: false,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    subCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubCategory',
      },
    ],
    subSkillSets: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubSkillSet',
      },
    ],
    reportingLocation: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ReportingLocation',
      },
    ],
    role: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
    },
    appointments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Appointment',
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
BuTemplateSchema.index({ companyId: 1 });

module.exports = mongoose.model('BuTemplate', BuTemplateSchema);
