const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  title: {
    type: String,
    enum: ["Engr", "Dr", "Prof"],
    required: true
  },

  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  phoneNumber: { type: String},
  age:       { type: Number},
  
  gender: {
    type: String,
    enum: ["Male", "Female"],
    
  },
  
  nationality:   { type: String },
  stateOfOrigin: { type: String },
  dateOfBirth:   { type: Date },
  address:       { type: String },
  
  maritalStatus: {
    type: String,
    enum: ['Single', 'Married'],
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  department: {
  type: String,
  required: true
}
,

  assignedCourses: [
    {
      course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        required: true
      },
      title: {
        type: String,
        
      },
      department: {
        type: String,
        required: true
      },
      level: {
      type: Number, 
      enum: [100, 200, 300, 400, 500],
      required: true
      },
      semester: {
        type: String,
        enum: ["First Semester", "Second Semester"],
        default: "First Semester",
        required: true
      }
    }
  ],

  cvUrl:         { type: String, required: true },
  certificateUrl:{ type: String, required: true },
  profilePhoto:  { type: String },

  passwordHash:  { type: String, required: true },

  teacherId: {
    type: String,
    unique: true,
    sparse: true
  },

  isApproved: {
    type: Boolean,
    default: false
  },

  resetCode: String,
  resetCodeExpiry: Date,

}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);
