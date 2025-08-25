
const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  sender: { type: String, enum: ["admin", "user"], required: true }
});

const contactMessageSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
  replies: [replySchema] 
});

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
