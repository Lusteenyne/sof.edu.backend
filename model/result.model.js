const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  semester: { type: String, required: true },
  code: { type: String, required: true },
  score: { type: Number, required: true },
  unit: { type: Number, required: true },
  level: { type: Number, enum: [100, 200, 300, 400, 500], required: true },
  session: {
    type: String,
    required: true,
    match: [/^\d{4}[-/]\d{4}$/, 'Session must be in the format YYYY-YYYY or YYYY/YYYY'],
  },
  grade: { type: String, required: true },
  point: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
