const mongoose = require('mongoose');

const { Schema } = mongoose;

const MasterBUTableSchema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
  },
  allActiveBusinessUnits: [],
  version: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('masterbutable', MasterBUTableSchema);
