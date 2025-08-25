// models/notification.model.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'warning', 'success'], default: 'info' },
  isRead: { type: Boolean, default: false },
  recipient: { type: mongoose.Schema.Types.ObjectId, refPath: 'recipientModel', default: null }, // null = global
  recipientModel: { type: String, enum: ['Student', 'Teacher', 'Admin'], default: null }, // to resolve polymorphic ref
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);
