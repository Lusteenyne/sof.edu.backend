const express = require('express');
const studentrouter = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { upload } = require('../utilis/cloudinary');

const {
  registerStudent,
  checkEmailExists,
  loginStudent,
  getStudentProfile,
  updateStudentProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  initiatePaystackPayment,
  uploadProfilePhoto,
  uploadTransferReceipt,
  getMyCourses,
  getStudentPayments,
  sendFeedback,
  getAvailableCoursesForStudent,
  getStudentInfo,
  getDashboardStats,
  getNotifications,
  markNotificationsRead,
  submitCourses,
  getSubmittedCourses,
  getStudentApprovedResults,
  verifyPaystackPayment,
  getStudentAssignments,
  verifyCode,
  submitAssignment,
  getStudentGrade,
  getStudentSubmissions,
  updateAssignmentSubmission,
  editMessage,
  deleteMessage,
  getStudentUnreadCounts,
  sendMessageToTeacher,
  sendMessageToAdminFromStudent,
  getMessagesWithTeacher,
  getMessagesWithAdmin,
  getAllTeachers,
} = require('../controllers/student.controllers');

// Register a new student
studentrouter.post('/register', registerStudent);

// Check if email exists
studentrouter.get('/check-email', checkEmailExists);

// Student login
studentrouter.post('/login', loginStudent);

// Get and update student profile
studentrouter.get('/profile', authenticateToken, getStudentProfile);
studentrouter.patch('/profile', authenticateToken, updateStudentProfile);

// Password routes
studentrouter.post('/forgot-password', forgotPassword);
studentrouter.post('/reset-password', resetPassword);
studentrouter.post('/verify-code', verifyCode);
studentrouter.patch('/change-password', authenticateToken, changePassword);

// Upload profile photo
studentrouter.post('/upload-profile-photo', authenticateToken, upload.single('profilePhoto'), uploadProfilePhoto);

// Student courses
studentrouter.get('/courses', authenticateToken, getMyCourses);

// Feedback
studentrouter.post('/send-feedback', authenticateToken, sendFeedback);

// Student info and dashboard
studentrouter.get('/info', authenticateToken, getStudentInfo);
studentrouter.get('/dashboard/stats', authenticateToken, getDashboardStats);

// Notifications
studentrouter.get('/notifications', authenticateToken, getNotifications);
studentrouter.patch('/notifications/mark-read', authenticateToken, markNotificationsRead);

// Available courses
studentrouter.get('/courses/matching', authenticateToken, getAvailableCoursesForStudent);

// Submit courses
studentrouter.post('/courses/submit', authenticateToken, submitCourses);  
studentrouter.get('/courses/submitted', authenticateToken, getSubmittedCourses);

// Approved results
studentrouter.get('/approved-results', authenticateToken, getStudentApprovedResults);

// Payments
studentrouter.get('/payments', authenticateToken, getStudentPayments);
studentrouter.post('/payments/upload-transfer-receipt', authenticateToken, upload.single('receipt'), uploadTransferReceipt);
studentrouter.post('/payments/initiate-paystack', authenticateToken, initiatePaystackPayment);
studentrouter.get('/payments/verify-paystack/:reference', authenticateToken, verifyPaystackPayment);

// Assignments
studentrouter.get('/assignments', authenticateToken, getStudentAssignments);
studentrouter.post('/assignments/:assignmentId/submit', authenticateToken, upload.array('files', 3), submitAssignment);
studentrouter.get('/assignment/:assignmentId/grade', authenticateToken, getStudentGrade);
studentrouter.get('/submissions', authenticateToken, getStudentSubmissions);
studentrouter.put('/assignments/:assignmentId/update', authenticateToken, upload.array('files', 3), updateAssignmentSubmission);

// Messaging routes
studentrouter.put('/editMessage/:id', authenticateToken, editMessage);
studentrouter.delete('/deleteMessage/:id', authenticateToken, deleteMessage);
studentrouter.post('/messages/teacher', authenticateToken, sendMessageToTeacher);
studentrouter.post('/messages/admin', authenticateToken, sendMessageToAdminFromStudent);
studentrouter.get('/messages/teacher', authenticateToken, getMessagesWithTeacher);
studentrouter.get('/messages/admin', authenticateToken, getMessagesWithAdmin);
studentrouter.get('/messages/unread-counts', authenticateToken, getStudentUnreadCounts);
studentrouter.get('/teachers', authenticateToken, getAllTeachers);


module.exports = studentrouter;
