const mongoose = require('mongoose');

const { Schema } = mongoose;

const AttendanceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
    },
    shiftDetailId: {
      type: Schema.Types.ObjectId,
      ref: 'ShiftDetails',
    },
    clockInDateTime: {
      type: Date,
    },
    clockOutDateTime: {
      type: Date,
    },
    attendanceTakenBy: {
      type: Schema.Types.ObjectId,
    },
    attendanceMode: {
      type: String,
    },
    duration: {
      type: Number,
      default: 0,
    },
    totalBreakDuration: {
      type: Number,
      default: 0,
    },

    breakTime: [
      {
        startTime: {
          type: Date,
        },
        endTime: {
          type: Date,
        },
        duration: {
          type: Number,
        },
      },
    ],
    businessUnitId: {
      type: Schema.Types.ObjectId,
    },
    approval: {
      shift: {
        type: Boolean,
        default: false,
      },
      clocked: {
        type: Boolean,
        default: false,
      },
      neither: {
        type: Boolean,
        default: false,
      },
      neitherMessage: {
        type: String,
      },
      approveClockInTime: {
        type: String,
      },
      approveClockOutTime: {
        type: String,
      },
      duration: {
        type: Number,
      },
      totalBreakDuration: { type: Number, default: 0 },
      breakTime: [
        {
          endTime: {
            type: Date,
          },
          startTime: {
            type: Date,
          },
          duration: {
            type: Number,
          },
        },
      ],
    },
    status: {
      type: Number,
      default: 0, // 0: no 1: clockintaken, 2: clockout taken , 3: approval true, 4 failed
    },
    IsLock: {
      type: Boolean,
      default: false,
    },
    isAutoApprove: {
      type: Boolean,
      default: false,
    },
    checkInLocation: {
      type: String,
      default: '',
    },
    checkOutLocation: {
      type: String,
      default: '',
    },
    otDuration: {
      type: Number,
      default: 0,
    },
    isAbsent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
AttendanceSchema.index({ shiftDetailId: 1, userId: 1 });
AttendanceSchema.index({ status: 1, createdAt: 1 });

const Attendance = mongoose.model('Attendance', AttendanceSchema);

module.exports = Attendance;
