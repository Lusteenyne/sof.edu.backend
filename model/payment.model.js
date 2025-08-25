const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  session: { type: String, required: true },
  level: { type: String, required: true },
  department: { type: String, required: true }, 
  semester: { type: String, required: true },   
  method: { type: String, enum: ['online', 'transfer'], required: true },
  amountExpected: Number,
  amountPaid: Number,
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  receiptURL: String,
  receiptAmountText: String,
  reference: { type: String, required: true, unique: true },
  remark: String,
  verifiedByAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payment', PaymentSchema);
