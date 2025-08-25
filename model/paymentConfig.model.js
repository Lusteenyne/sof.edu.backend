// models/PaymentConfig.js
const mongoose = require('mongoose');

const PaymentConfigSchema = new mongoose.Schema({
  level: {
    type: Number,  // Changed from String to Number
    required: true,
  },
  session: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
}, { timestamps: true });

// Compound unique index on level + session
PaymentConfigSchema.index({ level: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('PaymentConfig', PaymentConfigSchema);
