const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, unique: true },
  department: { type: String, required: true },
  phoneNumber: { type: String },
  age: { type: Number },
  gender: {
    type: String,
    enum: ['Male', 'Female'],
    
  },
  level: {
    type: Number,
    enum: [100, 200, 300, 400, 500],
    default: 100,
    required: true,
  },
  semester: {
    type: String,
    enum: ['First Semester', 'Second Semester'],
    default: 'First Semester',
    set: v => v.trim(),
  },
  session: {
    type: String,
    default: function () {
      const year = new Date().getFullYear();
      return `${year}/${year + 1}`;
    },
    required: true,
  },
  password: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  profilePhoto: { type: String, default: '' },
  resetCode: String,
  resetCodeExpiry: Date,
  maritalStatus: {
    type: String,
    enum: ['Single', 'Married', 'Divorced', 'Widowed'],
    default: 'Single',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  dateOfBirth: { type: Date },
  nationality: { type: String },
  stateOfOrigin: { type: String },
  address: { type: String },

 
  results: [
    {
      course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
      },
      score: { type: Number, required: true },
      unit: { type: Number, required: true },
      level: {
        type: Number,
        enum: [100, 200, 300, 400, 500],
        required: true,
      },
      semester: { type: String, required: true },
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
    },
  ],

  
  courses: [
    {
      course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
