const mongoose = require('mongoose');

const AssignmentSubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  message: { type: String },
  fileUrls: [{ type: String }],
  submittedAt: { type: Date, default: Date.now },
  score: { type: Number, min: 0, max: 100, default: null }, 
});

module.exports = mongoose.model('AssignmentSubmission', AssignmentSubmissionSchema);
