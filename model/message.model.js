const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: String,
  recipient: String,
   read: { type: Boolean, default: false },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
  },
  text: String,
  timestamp: Date,
  
});

module.exports = mongoose.model("Message", messageSchema);
