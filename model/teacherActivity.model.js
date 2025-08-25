const mongoose = require('mongoose');

const teacherActivitySchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model('TeacherActivity', teacherActivitySchema);
