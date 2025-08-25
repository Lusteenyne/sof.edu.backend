const express = require('express');
const teacherrouter = express.Router();
const { upload } = require('../utilis/cloudinary');
const authenticateToken = require('../middleware/authenticateToken');

const {
  registerTeacher,
  loginTeacher,
  getTeacherProfile,
  updateTeacherProfile,
  getStudentsByCourse,
  getAssignedCourses,
  getMyStudents,
  forgotPassword,
  resetPassword,
  submitResults,
  changePassword,
  uploadProfilePhoto,
  viewStudents,
  sendFeedback,
  getActivityLogs,
  getDashboardStats,
  markTeacherNotificationsAsRead,
  getTeacherNotifications,
  getSubmittedResults,
  giveAssignments,
  getAssignmentsByCourse,
  updateAssignment,
  deleteAssignment,
  getSubmissionsForAssignment,
submitGrade,
getAllStudentSubmissionsToTeacher,
sendMessageToAdmin,
sendMessageToStudent,
deleteMessage,
verifyCode,
editMessage,
getMessageFromAdmin,
getMessagesFromTeacherToStudent,
getMessagesBetweenTeacherAndAdmin,
getUnreadCounts,

} = require('../controllers/teacher.controllers');

// Registration with file upload
teacherrouter.post('/register', upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'certificate', maxCount: 1 }
]), registerTeacher);

// Authentication
teacherrouter.post('/login', loginTeacher);
teacherrouter.post('/forgot-password', forgotPassword);
teacherrouter.post('/reset-password', resetPassword);

teacherrouter.post('/verify-code', verifyCode);

teacherrouter.patch('/change-password', authenticateToken, changePassword);

// Profile
teacherrouter.get('/profile', authenticateToken, getTeacherProfile);
teacherrouter.patch('/profile', authenticateToken, upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'certificate', maxCount: 1 }
]), updateTeacherProfile);
teacherrouter.post('/upload-profile-photo', authenticateToken, upload.single('photo'), uploadProfilePhoto);

// Courses & Students
teacherrouter.get('/courses', authenticateToken, getAssignedCourses);
teacherrouter.get('/students', authenticateToken, getMyStudents);
teacherrouter.get('/view-students', authenticateToken, viewStudents);

// Feedback & Logs
teacherrouter.post('/send-feedback', authenticateToken, sendFeedback);
teacherrouter.get('/recent-activity', authenticateToken, getActivityLogs);


teacherrouter.get('/dashboard/stats', authenticateToken, getDashboardStats);


teacherrouter.get('/notifications', authenticateToken, getTeacherNotifications);
teacherrouter.patch('/notifications/mark-read', authenticateToken, markTeacherNotificationsAsRead);

// Results Submission
teacherrouter.post('/course/:courseId/submit-results', authenticateToken, submitResults);

// Get Submitted Results
teacherrouter.get('/course/:courseId/submitted-results', authenticateToken, getSubmittedResults);


// Students by Course
teacherrouter.get('/course/:courseId/students', authenticateToken, getStudentsByCourse);
// Assignments
teacherrouter.post(
  '/course/:courseId/give-assignments',
  authenticateToken,
  upload.array('files', 5),
  giveAssignments
);



teacherrouter.get(
  '/course/:courseId/assignments',
  authenticateToken,
  getAssignmentsByCourse
);

teacherrouter.patch(
  '/assignments/:assignmentId',
  authenticateToken,
  upload.array('files', 5),
  updateAssignment
);


teacherrouter.delete(
  '/assignments/:assignmentId',
  authenticateToken,
  deleteAssignment
);

teacherrouter.get(
  '/assignments/:assignmentId/submissions',
  authenticateToken,
  getSubmissionsForAssignment
);
 teacherrouter.post(
  '/assignments/submission/:submissionId/grade',
  authenticateToken,
  submitGrade
);


// Get all student submissions to teacher
teacherrouter.get(
  '/assignments/submissions/all',
  authenticateToken,
  getAllStudentSubmissionsToTeacher
);

// Send message to a specific student
teacherrouter.post('/messages/send', authenticateToken, sendMessageToStudent);

// Send message to admin
teacherrouter.post('/messages/send-admin', authenticateToken, sendMessageToAdmin);

teacherrouter.put('/editMessage/:id', authenticateToken, editMessage);
teacherrouter.delete('/deleteMessage/:id', authenticateToken, deleteMessage);
teacherrouter.get('/messages/admin', authenticateToken,getMessageFromAdmin)
teacherrouter.get("/messages/admin-thread", authenticateToken, getMessagesBetweenTeacherAndAdmin);
teacherrouter.get("/unread-counts", authenticateToken, getUnreadCounts);
teacherrouter.get("/messages/student", authenticateToken, getMessagesFromTeacherToStudent)
module.exports = teacherrouter;
