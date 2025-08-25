const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  code: { type: String, required: true }, // remove unique: true here
  department: { type: String, required: true },
  unit: { type: Number, required: true },
  semester: {
    type: String,
    default: 'First Semester',
    enum: ['First Semester', 'Second Semester'],
  },
  level: {
    type: Number,
    required: true,
    enum: [100, 200, 300, 400, 500],
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: false, 
  },
}, { timestamps: true });


courseSchema.index({ code: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Course', courseSchema);
