const mongoose = require('mongoose');

const { Schema } = mongoose;

const StaffAttendaceSchema = new Schema(
  {
    staff: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    session: {
      type: Schema.Types.ObjectId,
      ref: 'eventsession',
    },
    appointmentSlotNumber: {
      type: Number,
    },
    appointmentType: {
      type: String,
      default: 'auto',
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    usePushEach: true,
    autoIndex: true,
  },
);

// Indexes
StaffAttendaceSchema.index({ event: 1, session: 1, staff: 1 });
StaffAttendaceSchema.index({ session: 1, event: 1 });

const StaffAttendaceModel = mongoose.model(
  'staffAttendance',
  StaffAttendaceSchema,
);

module.exports = StaffAttendaceModel;
