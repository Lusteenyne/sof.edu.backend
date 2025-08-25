const express = require('express');
const adminrouter = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { upload } = require('../utilis/cloudinary');
const {
  // Auth
  adminSignup,
  adminLogin,
  getAdminInfo,

  // Dashboard & Notifications
  getAdminDashboardStats,
  getAdminNotifications,
  markNotificationsAsRead,

  // Admin Profile
  getAdminProfile,
  updateAdminProfile,
  uploadProfilePhoto,

  // Teacher Management
  getAllTeachers,
  approveTeacher,
  rejectTeacher,
  deleteTeacher,
  assignCourseToTeacher,
  removeAssignedCourseFromTeacher,
  updateTeacherByAdmin,

  // Student Management
  getAllStudents,
  getStudentWithCourses,
  getStudentResults,
  deleteStudent,
  assignCourseToStudent,
  assignCoursesToStudent,
  promoteStudent,
  changeStudentDepartment,
  updateStudentDetails,

  // Course Management
  createCourse,
  getCoursesByFilter,
  updateCourse,
  deleteCourse,

  // Course Approval/Rejection
  approveStudentCourse,
  rejectStudentCourse,
  approveStudentResult,

  getAllPayments,
  getPaymentsByStudentId,
  verifyPayment,
  getPaymentConfig,
  updatePaymentConfig,
forgotPassword,
  resetPassword,
  verifyCode,
  changePassword,
  sendMessageToTeacher,
  getAllMessages,
  editMessage,
  deleteMessage,
  getMessagesFromTeacherToAdmin,
  getMessageFromStudent,
  sendMessageToStudent,
  sendMessageFromLanding,
  getAllContactMessages,
  replyToContactMessage,
} = require('../controllers/admin.controllers');


// ─────────── AUTH ROUTES ───────────
adminrouter.post('/signup', adminSignup);
adminrouter.post('/login', adminLogin);
adminrouter.get('/info', authenticateToken, getAdminInfo);


// ─────────── DASHBOARD & NOTIFICATIONS ───────────
adminrouter.get('/dashboard/stats', authenticateToken, getAdminDashboardStats);
adminrouter.get('/notifications', authenticateToken, getAdminNotifications);
adminrouter.patch('/notifications/mark-read', authenticateToken, markNotificationsAsRead);


// ─────────── ADMIN PROFILE ROUTES ───────────
adminrouter.get('/profile', authenticateToken, getAdminProfile);
adminrouter.patch('/profile', authenticateToken, updateAdminProfile);
adminrouter.post(
  '/upload-profile-photo',
  authenticateToken,
  upload.single('profilePhoto'), 
  uploadProfilePhoto
);
adminrouter.post('/forgot-password', forgotPassword);
adminrouter.post('/reset-password', resetPassword);
adminrouter.post('/verify-code', verifyCode);
adminrouter.patch('/change-password', authenticateToken, changePassword);


// ─────────── TEACHER ROUTES ───────────
adminrouter.get('/teachers', authenticateToken, getAllTeachers);
adminrouter.patch('/teachers/:teacherId/approve', authenticateToken, approveTeacher);
adminrouter.patch('/teachers/:teacherId/reject', authenticateToken, rejectTeacher);
adminrouter.delete('/teachers/:teacherId', authenticateToken, deleteTeacher);
adminrouter.patch('/teachers/:teacherId/assign-courses', authenticateToken, assignCourseToTeacher);
adminrouter.delete('/teachers/:teacherId/remove-course/:courseId', authenticateToken, removeAssignedCourseFromTeacher);
adminrouter.patch('/teachers/:teacherId/update-department', authenticateToken, updateTeacherByAdmin);


// ─────────── STUDENT ROUTES ───────────
adminrouter.get('/students', authenticateToken, getAllStudents);
adminrouter.get('/students/:studentId', authenticateToken, getStudentWithCourses);
adminrouter.get('/students/:studentId/results', authenticateToken, getStudentResults);
adminrouter.delete('/students/:studentId', authenticateToken, deleteStudent);
adminrouter.patch('/students/:studentId/assign-course', authenticateToken, assignCourseToStudent);
adminrouter.post('/students/:studentId/assign-courses', authenticateToken, assignCoursesToStudent);
adminrouter.post('/students/:studentId/promote', authenticateToken, promoteStudent);
adminrouter.patch('/students/:studentId/department', authenticateToken, changeStudentDepartment);
adminrouter.patch('/students/:studentId/update', authenticateToken, updateStudentDetails);


// ─────────── STUDENT COURSE APPROVAL/REJECTION ───────────
adminrouter.patch('/students/:studentId/courses/:courseId/approve', authenticateToken, approveStudentCourse);
adminrouter.patch('/students/:studentId/courses/:courseId/reject', authenticateToken, rejectStudentCourse);


// ─────────── STUDENT RESULT APPROVAL ───────────
adminrouter.patch('/students/:studentId/results/approve', authenticateToken, approveStudentResult);


// ─────────── COURSE ROUTES ───────────
adminrouter.post('/courses', authenticateToken, createCourse);
adminrouter.get('/courses', authenticateToken, getCoursesByFilter);
adminrouter.patch('/courses/:courseId', authenticateToken, updateCourse);
adminrouter.delete('/courses/:courseId', authenticateToken, deleteCourse);

// ─────────── PAYMENTS ROUTES ───────────
adminrouter.get('/payments', authenticateToken, getAllPayments); // Get all payments
adminrouter.get('/payments/student/:studentId', authenticateToken, getPaymentsByStudentId); // Get payments for student
adminrouter.patch('/payments/:paymentId/verify', authenticateToken, verifyPayment); // Verify payment
adminrouter.get('/payments/config', authenticateToken, getPaymentConfig);
adminrouter.patch('/payments/config', authenticateToken, updatePaymentConfig);


adminrouter.post('/messages/send', authenticateToken, sendMessageToTeacher);
adminrouter.get('/messages', authenticateToken, getAllMessages);

adminrouter.put('/editMessage/:id', authenticateToken, editMessage);
adminrouter.delete('/deleteMessage/:id', authenticateToken, deleteMessage);
adminrouter.get('/messages/from-teachers', authenticateToken, getMessagesFromTeacherToAdmin);
adminrouter.get('/messages/from-students', authenticateToken,getMessageFromStudent)
adminrouter.post('/messages/send-to-student', authenticateToken, sendMessageToStudent);
adminrouter.post('/contact', sendMessageFromLanding);
adminrouter.get('/get-contact', authenticateToken, getAllContactMessages);
adminrouter.post('/send-reply', authenticateToken, replyToContactMessage)



module.exports = adminrouter;
