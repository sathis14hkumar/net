const mongoose = require('mongoose');

const { Schema } = mongoose;

const RunningNumberSchema = new Schema({
  title: {
    type: String,
    default: '', // Form Submission number holder
  },
  identity: {
    type: String,
    default: '', // formId
  },
  description: {
    type: String,
    default: '', // This collection holds number for generating form number(unique) while create the form. this form number will shown in manage forms
  },
  currentRunningNumber: {
    type: String,
    default: 0,
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
  },
});

module.exports = mongoose.model('runningnumber', RunningNumberSchema);
