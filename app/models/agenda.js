const mongoose = require('mongoose');

const { Schema } = mongoose;

const AgendaSchema = new Schema({
  name: {
    type: String,
    required: true,
    index: true,
  },
  data: {},
  type: {
    type: String,
    default: 'normal',
    enum: ['normal', 'single'],
  },
  priority: {
    type: Number,
    default: 0,
    min: -20,
    max: 20,
    index: 1,
  },
  nextRunAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  lastModifiedBy: {
    type: String,
  },
  lockedAt: {
    type: Date,
    index: true,
  },
  lastFinishedAt: Date,
});

const agendaJobs = mongoose.model('agendaJobs', AgendaSchema, 'agendaJobs');

module.exports = agendaJobs;
