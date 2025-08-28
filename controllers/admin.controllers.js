const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const axios = require('axios');
const Message = require('../model/message.model')
const SuperAdmin = require('../model/admin.model');
const AdminActivity = require('../model/adminActivity.model');
const Student = require('../model/student.model');
const ContactMessage = require ('../model/contact.model');
const Teacher = require('../model/teacher.model');
const Course = require('../model/course.model');
const Notification = require('../model/notification.model');
const { uploadFilesToCloudinary, cloudinary } = require("../utilis/cloudinary");
const Result = require('../model/result.model');
const PaymentConfig = require('../model/paymentConfig.model');
const mongoose = require('mongoose');
const Payment = require('../model/payment.model');
const { sendSuperAdminMail, sendEmail, sendPasswordResetEmail, sendTeacherApprovalEmail, sendLandingContactEmail, sendLandingContactAutoReply, sendAdminMessageNotificationToStudent, sendAdminMessageNotificationToTeacher, sendDepartmentChangeMail, sendCourseApprovalMail,sendLevelChangeNotification, sendGeneralFeeUpdateMail, sendTuitionPaymentApproved } = require('../utilis/mailer');

// ADMIN SIGNUP


const adminSignup = async (req, res) => {
  console.log("Admin Signup Request:", req.body);

  const {
    firstName,
    lastName,
    email,
    password,
    phoneNumber,
    gender,
    securityQuestion,
    securityAnswer,
    agreeToTerms,
  } = req.body;

  // Basic validations
  if (!agreeToTerms) {
    return res.status(400).json({ message: "You must agree to the Terms & Conditions." });
  }

  if (!firstName || !lastName) {
    return res.status(400).json({ message: "First and Last name are required." });
  }

  if (!['Male', 'Female'].includes(gender)) {
    return res.status(400).json({ message: 'Please select a valid gender: Male or Female' });
  }

  try {
    // Check if email is already used
    const existing = await SuperAdmin.findOne({ email });
    if (existing) {
      console.log("Signup Failed: Email already in use");
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash sensitive data
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer, 10);

    // Create new admin
    const newAdmin = new SuperAdmin({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phoneNumber,
      gender,
      securityQuestion,
      securityAnswer: hashedAnswer,
      agreeToTerms,
    });

    await newAdmin.save();

    const fullName = `${firstName} ${lastName}`;
    await sendSuperAdminMail(email, fullName);

    console.log("New Super Admin Registered:", newAdmin._id);
    res.status(201).json({ message: "Super Admin registered successfully" });
  } catch (err) {
    console.error("Admin Signup Error:", err);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};



const adminLogin = async (req, res) => {
  console.log("Admin Login Request Body:", req.body);
  const { email, password } = req.body;

  try {
    console.log("Login attempt with:");
    console.log("   Email:", email);
    console.log("   Password:", password);

    // Ensure password is selected
    const admin = await SuperAdmin.findOne({ email }).select('+password');

    if (!admin) {
      console.warn("No admin found for email:", email);
      return res.status(404).json({ message: "Admin not found" });
    }

    console.log("Admin found:", admin.email);
    console.log("Hashed password in DB:", admin.password);

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      console.warn("Password does not match for:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id },
      process.env.SECRETKEY || 'defaultSecret',
      { expiresIn: '7h' }
    );

    console.log("Login successful for:", admin.email);

    res.json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
      },
    });

  } catch (err) {
    console.error("Admin Login Error:", err);
    res.status(500).json({ message: "Login error" });
  }
};

const sendNotification = async ({ message, type = 'info', recipient = null, recipientModel = null }) => {
  try {
    await Notification.create({ message, type, recipient, recipientModel });
  } catch (err) {
    console.error('Notification Error:', err.message);
  }
};


const saltRounds = 10; // add at top

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log('Forgot password request for email:', email);

  try {
    const admin = await SuperAdmin.findOne({ email });
    if (!admin) {
      console.warn('Admin not found for email:', email);
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000);
    admin.resetCode = code;
    admin.resetCodeExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
    await admin.save();

    const fullName = `${admin.firstName} ${admin.lastName}`;
    await sendPasswordResetEmail(email, fullName, code);

    console.log(`Reset code sent to ${email}`);
    res.json({ message: 'Password reset code sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, code, and new password are required' });
  }

  try {
    const admin = await SuperAdmin.findOne({
      email,
      resetCodeExpiry: { $gt: Date.now() },
    });

    if (!admin || admin.resetCode.toString() !== code.toString()) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    admin.password = await bcrypt.hash(newPassword, saltRounds);
    admin.resetCode = undefined;
    admin.resetCodeExpiry = undefined;
    await admin.save();

    console.log('Password reset successful for:', email);
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Password reset error for:', email, err);
    res.status(500).json({ message: 'Server error' });
  }
};

// VERIFY RESET CODE
const verifyCode = async (req, res) => {
  const { email, code } = req.body;

  console.log('Verify code request received:', { email, code });

  if (!email || !code) {
    console.log('Missing email or code in request');
    return res.status(400).json({ message: 'Email and code are required' });
  }

  try {
    const admin = await SuperAdmin.findOne({
      email,
      resetCodeExpiry: { $gt: Date.now() },
    });

    console.log('Admin fetched from DB:', admin);

    if (!admin) {
      console.log('No admin found or reset code expired');
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    console.log('Stored reset code:', admin.resetCode, 'Provided code:', code);

    if (admin.resetCode.toString() !== code.toString()) {
      console.log('Reset code does not match');
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    console.log('Code verified successfully for email:', email);
    res.json({ message: 'Code verified successfully' });
  } catch (err) {
    console.error('Code verification error for:', email, err);
    res.status(500).json({ message: 'Server error' });
  }
};

// CHANGE PASSWORD (authenticated)
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' });
  }

  try {
    const admin = await SuperAdmin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });

    admin.password = await bcrypt.hash(newPassword, saltRounds);
    await admin.save();

    console.log('Password changed successfully for:', admin.email);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error for user id:', req.user?.id, err);
    res.status(500).json({ message: 'Server error' });
  }
};


// APPROVE TEACHER
const approveTeacher = async (req, res) => {
  console.log("Approve Teacher Request:", req.params);
  try {
    const { teacherId } = req.params;
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    if (teacher.isApproved) return res.status(400).json({ message: "Already approved" });

    const datePart = moment().format('YYMMDD');
    const approvedCountToday = await Teacher.countDocuments({
      isApproved: true,
      updatedAt: { $gte: moment().startOf('day'), $lt: moment().endOf('day') }
    });

    const countPart = (approvedCountToday + 1).toString().padStart(2, '0');
    teacher.teacherId = `STF/${datePart}/${countPart}`;
    teacher.isApproved = true;
    teacher.status = "approved";
    await teacher.save();

    // Notify the Admin who approved
    await sendNotification({
      message: `You approved Staff ${teacher.firstName}`,
      type: 'info',
      recipient: req.user.id,
      recipientModel: 'Admin'
    });

    // Notify the Teacher: Approval
    await sendNotification({
      message: `Your account has been approved by the School Administration. Your ID is ${teacher.teacherId}`,
      type: 'success',
      recipient: teacher._id,
      recipientModel: 'Teacher'
    });

    // Notify the Teacher: Prompt to update profile
    await sendNotification({
      message: `Please update your profile before accessing the full dashboard.`,
      type: 'warning',
      recipient: teacher._id,
      recipientModel: 'Teacher'
    });

    // Send Email to Teacher
   await sendTeacherApprovalEmail(
  teacher.email,
  teacher.title,
  `${teacher.firstName} ${teacher.lastName}`,
  teacher.teacherId
);

    console.log("Teacher Approved:", teacher.teacherId);

    res.status(200).json({ message: "Teacher approved", teacherId: teacher.teacherId });

  } catch (error) {
    console.error("Approve Teacher Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


const rejectTeacher = async (req, res) => {
  console.log("Reject Teacher Request:", req.params);
  try {
    const { teacherId } = req.params;
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    // Optionally, check if already approved
    if (teacher.isApproved) {
      return res.status(400).json({ message: "Cannot reject an already approved teacher" });
    }

    // Notify the Admin who rejected
    await sendNotification({
      message: `You rejected Staff ${teacher.firstName}`,
      type: 'info',
      recipient: req.user.id,
      recipientModel: 'Admin'
    });

    // Notify the Teacher: Rejection
    await sendNotification({
      message: `Your account has been rejected by the School Administration.`,
      type: 'error',
      recipient: teacher._id,
      recipientModel: 'Teacher'
    });

    // // Optionally, send email to Teacher
    // await sendTeacherRejectionEmail(
    //   teacher.email,
    //   teacher.title,
    //   `${teacher.firstName} ${teacher.lastName}`
    // );

    // Remove the teacher from database
    await teacher.deleteOne();

    console.log("Teacher Rejected and Removed:", teacherId);
    res.status(200).json({ message: "Teacher rejected and removed" });

  } catch (error) {
    console.error("Reject Teacher Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

const deleteTeacher = async (req, res) => {
  console.log("Delete Teacher Request:", req.params);
  try {
    const { teacherId } = req.params;
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    // Optionally, notify the teacher before deletion
    await sendNotification({
      message: `Your account has been deleted by the School Administration.`,
      type: 'error',
      recipient: teacher._id,
      recipientModel: 'Teacher'
    });

    // Delete the teacher
    await teacher.deleteOne();

    console.log("Teacher Deleted:", teacherId);
    res.status(200).json({ message: "Teacher deleted successfully" });

  } catch (error) {
    console.error("Delete Teacher Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};



// DASHBOARD STATS
const getAdminDashboardStats = async (req, res) => {
  console.log("Fetching Dashboard Stats");

  try {
    const totalStudents = await Student.countDocuments();
    const totalTeachers = await Teacher.countDocuments();
    const approvedTeachers = await Teacher.countDocuments({ isApproved: true });

    // Sum of all payments with status "paid"
    const revenueResult = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: "$amountPaid" } } }
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    console.log("Stats:", {
      totalStudents,
      totalTeachers,
      approvedTeachers,
      totalRevenue,
    });

    res.status(200).json({
      totalStudents,
      totalTeachers,
      approvedTeachers,
      totalRevenue,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// GET NOTIFICATIONS
const getAdminNotifications = async (req, res) => {
  try {
    const adminId = req.user.id;

    const notifications = await Notification.find({
      $or: [
        { recipientModel: 'Admin', recipient: adminId },
        { recipientModel: 'Admin', recipient: null }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json({ notifications });
  } catch (err) {
    console.error("Get Admin Notifications Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// MARK NOTIFICATIONS READ
const markNotificationsAsRead = async (req, res) => {
  console.log("Marking All Notifications As Read");
  try {
    await Notification.updateMany({ isRead: false }, { isRead: true });
    res.status(200).json({ message: "All marked as read" });
  } catch (err) {
    console.error("Mark Notifications Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET ADMIN INFO
const getAdminInfo = async (req, res) => {
  console.log("Fetching Admin Info:", req.user?.id);

  try {
    // Ensure the user ID is present
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing user ID" });
    }

    // Fetch super admin without sensitive fields
    const admin = await SuperAdmin.findById(req.user.id).select('-password -securityAnswer');

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    // Format the response for frontend compatibility
    res.status(200).json({
      success: true,
      data: {
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        profilePhoto: admin.profilePhoto || "", 
      },
      message: "Admin info fetched successfully",
    });

  } catch (error) {
    console.error("Get Admin Info Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// TEACHER MANAGEMENT
const getAllTeachers = async (req, res) => {
  console.log("Fetching All Teachers");

  try {
    const teachers = await Teacher.find()
      .select("-passwordHash") // Hide sensitive info
      .populate("assignedCourses.course", "name code") 
      .lean(); // Optional: improves performance

    console.log(`${teachers.length} teachers fetched successfully`);
    res.status(200).json({ teachers });
  } catch (error) {
    console.error("Get Teachers Error:", error);
    res.status(500).json({ message: "Server error fetching teachers" });
  }
};

//to updatebyadmin
const updateTeacherByAdmin = async (req, res) => {
  console.log(`Admin updating department for teacher: ${req.params.id}`);

  try {
    const { department } = req.body;

    if (!department || !Array.isArray(department) || department.length === 0) {
      return res.status(400).json({
        message: "Invalid department data. Provide a non-empty array of departments.",
      });
    }

    const updatedTeacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: { department } },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!updatedTeacher) {
      console.warn(`Teacher not found: ${req.params.id}`);
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Send notification to the teacher
    await sendNotification({
      message: "Your department information has been updated.",
      type: "info",
      recipient: updatedTeacher._id,
      recipientModel: "Teacher",
    });

    res.status(200).json({
      message: "Department updated successfully",
      teacher: updatedTeacher,
    });
  } catch (err) {
    console.error("Error updating department:", err);
    res.status(500).json({ message: "Server error updating department" });
  }
};



// STUDENT MANAGEMENT
const getAllStudents = async (req, res) => {
  console.log("Fetching All Students");
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.status(200).json({ students });
  } catch (err) {
    console.error("Get Students Error:", err);
    res.status(500).json({ message: "Failed to fetch students" });
  }
};

const updateStudentDetails = async (req, res) => {
  const { studentId } = req.params;
  const { level, semester, department } = req.body;

  console.log(`Updating student ${studentId} with:`, { level, semester, department });

  try {
    const student = await Student.findById(studentId);
    if (!student) {
      console.log("Student not found");
      return res.status(404).json({ message: "Student not found" });
    }

    let hasChanges = false;

    // LEVEL + SESSION UPDATE
    if (level !== undefined && level !== student.level) {
      console.log(`Attempting to update level from ${student.level} to ${level}`);
      student.level = level;
      hasChanges = true;

      // SESSION CALCULATION
      const baseYear = 2025; 
      const currentLevelNum = parseInt(level);
      const levelOffset = (currentLevelNum / 100) - 1;
      const startYear = baseYear + levelOffset;
      const endYear = startYear + 1;
      student.session = `${startYear}/${endYear}`;

      console.log(`Automatically updated session to ${student.session}`);

      // PAYMENT CHECK
      const paidPayment = await Payment.findOne({
        studentId: student._id,
        level: level,
        session: student.session,
        status: 'paid',
        verifiedByAdmin: true,
      });

      student.paymentStatus = paidPayment ? 'paid' : 'pending';
      console.log(`Payment status for new level: ${student.paymentStatus}`);

      await sendNotification({
        message: `Hello ${student.firstname}, welcome to ${level} level.`,
        type: "info",
        recipient: student._id,
        recipientModel: "Student",
      });

      if (!paidPayment) {
        await sendNotification({
          message: `Payment is pending for ${level} level (${student.session}). Please complete your payment to gain full access.`,
          type: "warning",
          recipient: student._id,
          recipientModel: "Student",
        });
        console.log("Pending payment notification sent");
      }

      // Email level change
      await sendLevelChangeNotification(
        student.email,
        `${student.firstname} ${student.lastname}`,
        student.level,
        student.session
      );
    }

    // SEMESTER UPDATE
    if (semester !== undefined && semester !== student.semester) {
      console.log(`Updating semester from ${student.semester} to ${semester}`);
      student.semester = semester;
      hasChanges = true;

      await sendNotification({
        message: `Hello ${student.firstname}, welcome to ${semester}.`,
        type: "info",
        recipient: student._id,
        recipientModel: "Student",
      });
    }

    // DEPARTMENT UPDATE
    if (department !== undefined && department !== student.department) {
      console.log(`Updating department from ${student.department} to ${department}`);
      student.department = department;
      hasChanges = true;

      await sendNotification({
        message: `Your department has been changed to ${department}.`,
        type: "info",
        recipient: student._id,
        recipientModel: "Student",
      });

      await sendDepartmentChangeMail(
        student.email,
        `${student.firstname} ${student.lastname}`,
        department
      );
    }

    if (hasChanges) {
      await student.save();
      console.log("Student details updated and saved successfully");
    } else {
      console.log("No changes detected in student details");
    }

    res.status(200).json({ message: "Student details updated", student });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Failed to update student details" });
  }
};




const deleteStudent = async (req, res) => {
  console.log("Delete Student:", req.params.id);
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.status(200).json({ message: "Student deleted" });
  } catch (err) {
    console.error("Delete Student Error:", err);
    res.status(500).json({ message: "Failed to delete student" });
  }
};

const assignCourseToStudent = async (req, res) => {
  console.log("Assign Course to Student:", req.params.id, req.body);

  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { course: req.body.course },
      { new: true }
    );

    if (!student) return res.status(404).json({ message: "Student not found" });

    //  Notify the student about the course assignment
    await sendNotification({
      message: `You have been assigned to the course: ${req.body.course}`,
      type: "info",
      recipient: student._id,
      recipientModel: "Student",
    });

    res.status(200).json({ message: "Course assigned", student });

  } catch (err) {
    console.error("Assign Course to Student Error:", err);
    res.status(500).json({ message: "Failed to assign course" });
  }
};


const promoteStudent = async (req, res) => {
  console.log("Promote Student:", req.params.id);
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const nextLevel = (parseInt(student.level) || 0) + 1;
    student.level = nextLevel;
    await student.save();

    await sendNotification({
      message: `You have been promoted to level ${nextLevel}`,
      type: "info",
      recipient: student._id,
      recipientModel: "Student",
    });  


    res.status(200).json({ message: `Promoted to level ${nextLevel}`, student });
  } catch (err) {
    console.error("Promote Student Error:", err);
    res.status(500).json({ message: "Promotion failed" });
  }
};



const changeStudentDepartment = async (req, res) => {
  console.log("Change Department:", req.params.id, req.body);

  try {
    const { department } = req.body;

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { department },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

  

    // Send notification email
    await sendDepartmentChangeMail(student);

    res.status(200).json({ message: "Department updated", student });
  } catch (err) {
    console.error("Change Department Error:", err);
    res.status(500).json({ message: "Failed to update department" });
  }
};

// COURSE MANAGEMENT
const createCourse = async (req, res) => {
  console.log("[CREATE COURSE] Request Body:", req.body);
  try {
    let { title, code, unit, semester, level, department } = req.body;

    if (!title || !code || !unit || !semester || !level || !department) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    semester = semester.trim();

    const course = new Course({ title, code, unit, semester, level, department });
    await course.save();

    console.log("[CREATE COURSE] Course Created:", course);
    res.status(201).json({ message: "Course created", course });
  } catch (err) {
    if (err.code === 11000) {
      console.log("[CREATE COURSE] Duplicate Error:", err.keyValue);
      return res.status(400).json({
        message: `Course with code "${err.keyValue.code}" already exists in this department`
      });
    }

    console.error("[CREATE COURSE] Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const getCoursesByFilter = async (req, res) => {
  console.log("[GET COURSES] Incoming query params:", req.query);

  try {
    const { level, department, semester } = req.query;
    const filter = {};

    if (level) {
      const parsedLevel = parseInt(level);
      if (!isNaN(parsedLevel)) {
        filter.level = parsedLevel;
      } else {
        console.warn("[GET COURSES] Invalid level value:", level);
      }
    }

    if (department) filter.department = department;
    if (semester) filter.semester = semester.trim(); // normalize

    console.log("[GET COURSES] Using filter:", filter);

    const courses = await Course.find(filter);

    console.log(`[GET COURSES] Found ${courses.length} course(s):`);
    courses.forEach((course, index) => {
      console.log(
        `  ${index + 1}. ${course.code} - ${course.title} | Dept: ${course.department}, Level: ${course.level}, Semester: ${course.semester}`
      );
    });

    res.status(200).json({ courses });
  } catch (err) {
    console.error("[GET COURSES] Error:", err);
    res.status(500).json({ message: "Error fetching courses" });
  }
};

const updateCourse = async (req, res) => {
  const { courseId } = req.params; 
  const updates = req.body;

  console.log(`[UPDATE COURSE] Updating course ID: ${courseId}`);
  console.log(`[UPDATE COURSE] Payload:`, updates);

  if (updates.semester) {
    updates.semester = updates.semester.trim(); 
  }

  try {
    const course = await Course.findByIdAndUpdate(courseId, updates, { new: true });
    if (!course) {
      console.log(`[UPDATE COURSE] Course not found: ${courseId}`);
      return res.status(404).json({ message: 'Course not found' });
    }

    console.log(`[UPDATE COURSE] Course updated successfully:`, course);
    res.json(course);
  } catch (error) {
    console.error(`[UPDATE COURSE] Error:`, error);
    res.status(500).json({ message: 'Failed to update course' });
  }
};

// ───── DELETE COURSE ─────
const deleteCourse = async (req, res) => {
  const { courseId } = req.params;  
  console.log(`[DELETE COURSE] Deleting course ID: ${courseId}`);

  try {
    const deleted = await Course.findByIdAndDelete(courseId);
    if (!deleted) {
      console.log(`[DELETE COURSE] Course not found: ${courseId}`);
      return res.status(404).json({ message: 'Course not found' });
    }

    console.log(`[DELETE COURSE] Course deleted successfully`);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error(`[DELETE COURSE] Error:`, error);
    res.status(500).json({ message: 'Failed to delete course' });
  }
};

// ───── ASSIGN MULTIPLE COURSES TO STUDENT ─────
const assignCoursesToStudent = async (req, res) => {
  const studentId = req.params.id;

  try {
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const semester = student.semester.trim();

    console.log("Looking for courses with:");
    console.log({
      department: student.department,
      level: student.level,
      semester: semester
    });

    const eligibleCourses = await Course.find({
      department: student.department,
      level: student.level,
      semester: semester,
    });

    console.log("Eligible courses found in DB:");
    eligibleCourses.forEach(c =>
      console.log(`- ${c.code} (${c.title}) [${c._id}]`)
    );

    if (eligibleCourses.length === 0) {
      return res.status(404).json({ message: "No eligible courses found for the student." });
    }

    const existingCourseIds = student.courses.map(c => c.course?.toString());
    console.log("Student's existing assigned course IDs:", existingCourseIds);

    const newCoursesToAssign = eligibleCourses
      .filter(course => {
        const isAssigned = existingCourseIds.includes(course._id.toString());
        console.log(`Course ${course.code} (${course._id}) - Already assigned? ${isAssigned}`);
        return !isAssigned;
      })
      .map(course => ({
        course: course._id,
        status: "pending",
      }));

    if (newCoursesToAssign.length === 0) {
      return res.status(200).json({ message: "All eligible courses are already assigned." });
    }

    student.courses.push(...newCoursesToAssign);
    await student.save();

    const updatedStudent = await Student.findById(studentId).populate('courses.course');

    return res.status(200).json({
      message: "Eligible courses assigned successfully.",
      student: updatedStudent,
    });

  } catch (error) {
    console.error("Error assigning courses:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getStudentWithCourses = async (req, res) => {
  try {
    console.log("Fetching student with ID:", req.params.id);
    const student = await Student.findById(req.params.id).populate('courses.course');
    if (!student) {
      console.log("Student not found for ID:", req.params.id);
      return res.status(404).json({ message: 'Student not found' });
    }
    console.log("Found student:", student);
    res.json({ student });
  } catch (err) {
    console.error('Error fetching student with courses:', err);
    res.status(500).json({ message: 'Server error' });
  }
};



const approveStudentCourse = async (req, res) => {
  const { studentId, courseId } = req.params;

  console.log("[APPROVE] Student ID:", studentId);
  console.log("[APPROVE] Course ID:", courseId);

  try {
    const student = await Student.findById(studentId)
      .populate('courses.course')
      .select('firstname lastname email level courses semester');

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const courseEntry = student.courses.find(c => c.course._id.toString() === courseId);
    if (!courseEntry) {
      return res.status(404).json({ message: "Course not found in student's list" });
    }

    if (courseEntry.status === "approved") {
      return res.status(200).json({ message: "Course already approved", student });
    }

    // Approve the course
    courseEntry.status = "approved";
    await student.save();

    const courseCode = courseEntry.course.code || "Unknown Code";
    const courseTitle = courseEntry.course.title || "Untitled Course";

    // Send notification for this specific course approval
    await sendNotification({
      message: `Your course registration for ${courseCode} has been approved.`,
      type: "success",
      recipient: student._id,
      recipientModel: "Student",
    });

    // Check if ALL courses are now approved
    const allApproved = student.courses.every(c => c.status === "approved");

    if (allApproved) {
      // All courses approved – send email once
      await sendCourseApprovalMail(
        student.email,
        `${student.firstname} ${student.lastname}`,
        student.semester || "this semester"
      );
    }

    res.status(200).json({
      message: "Course approved" + (allApproved ? " – All courses approved" : ""),
      student,
    });

  } catch (err) {
    console.error("[APPROVE] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const rejectStudentCourse = async (req, res) => {
  const { studentId, courseId } = req.params;

  console.log("[REJECT] Student ID:", studentId);
  console.log("[REJECT] Course ID:", courseId);

  try {
    const student = await Student.findById(studentId).populate('courses.course');
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const courseEntry = student.courses.find(c => c.course._id.toString() === courseId);
    if (!courseEntry) {
      return res.status(404).json({ message: "Course not found in student's list" });
    }

    if (courseEntry.status === "rejected") {
      return res.status(200).json({ message: "Course already rejected", student });
    }

    courseEntry.status = "rejected";
    await student.save();

    const courseCode = courseEntry.course.code || "Unknown Code";

    await sendNotification({
      message: `Your course registration for ${courseCode} has been rejected. Please contact the administration for more details.`,
      type: "error",
      recipient: student._id,
      recipientModel: "Student",
    });

    res.status(200).json({ message: "Course rejected", student });
  } catch (err) {
    console.error("[REJECT] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const assignCourseToTeacher = async (req, res) => {
  const { teacherId } = req.params;
  const { courses, department, level, semester } = req.body;

  try {
    console.log(`Assigning courses [${courses}] to teacher ${teacherId}`);

    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ message: "No courses provided" });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      console.warn("Teacher not found");
      return res.status(404).json({ message: "Teacher not found" });
    }

    const existingDepartments = new Set(teacher.department);
    const existingLevels = new Set(teacher.assignedCourses.map(item => item.level));
    const existingSemesters = new Set(teacher.assignedCourses.map(item => item.semester));

    const assignedNow = [];
    const assignedCodes = [];

    for (const courseId of courses) {
      const course = await Course.findById(courseId);
      if (!course) {
        console.warn(`Course not found: ${courseId}`);
        continue;
      }

      const alreadyAssigned = teacher.assignedCourses.some(
        (item) => item.course.toString() === courseId
      );
      if (alreadyAssigned) {
        console.log(`Course already assigned: ${courseId}`);
        continue;
      }

      teacher.assignedCourses.push({
        course: courseId,
        title: course.title,
        department,
        level: Number(level),
        semester,
      });

      if (teacher.department !== department) {
  teacher.department = department;
  console.log(`Teacher department changed to: ${department}`);
}


      assignedNow.push(courseId);
      assignedCodes.push(course.code);
      console.log(`Assigned course ${courseId}`);
    }

    await teacher.save();

    if (assignedNow.length === 0) {
      return res.status(200).json({ message: "No new courses assigned", assigned: [] });
    }

    await sendNotification({
      message: `You have been assigned to teach: ${assignedCodes.join(", ")}`,
      type: "info",
      recipient: teacher._id,
      recipientModel: "Teacher",
    });

    if (!existingDepartments.has(department)) {
      await sendNotification({
        message: `You have been newly assigned to department: ${department}`,
        type: "info",
        recipient: teacher._id,
        recipientModel: "Teacher",
      });
    }

    if (!existingLevels.has(Number(level))) {
      await sendNotification({
        message: `You have been newly assigned to level: ${level}`,
        type: "info",
        recipient: teacher._id,
        recipientModel: "Teacher",
      });
    }

    if (!existingSemesters.has(semester)) {
      await sendNotification({
        message: `You have been newly assigned to semester: ${semester}`,
        type: "info",
        recipient: teacher._id,
        recipientModel: "Teacher",
      });
    }

    res.status(200).json({
      message: "Courses assigned successfully",
      assigned: assignedNow,
    });

  } catch (err) {
    console.error("Error assigning courses:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ───── REMOVE ASSIGNED COURSE FROM TEACHER ─────
const removeAssignedCourseFromTeacher = async (req, res) => {
  const { teacherId, courseId } = req.params;

  try {
    console.log(`Removing course ${courseId} from teacher ${teacherId}`);

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      console.warn("Teacher not found");
      return res.status(404).json({ message: "Teacher not found" });
    }

    const course = await Course.findById(courseId);
    let courseCode = `Course ID ${courseId}`;
    if (course) {
      courseCode = course.code;
      console.log(`Course found: ${courseCode}`);
    } else {
      console.warn(`Course not found in DB for ID: ${courseId}`);
    }

    const initialCount = teacher.assignedCourses.length;

    teacher.assignedCourses = teacher.assignedCourses.filter(
      (item) => item.course.toString() !== courseId
    );

    if (teacher.assignedCourses.length === initialCount) {
      console.log("Course not assigned previously");
      return res.status(404).json({ message: "Course not assigned to teacher" });
    }

    // Save teacher update
    await teacher.save();
    console.log(`Course "${courseCode}" removed from teacher`);

    // Update the course so it is no longer tied to the teacher
    if (course) {
      course.teacherId = null; 
      await course.save();
      console.log(`Course "${courseCode}" teacherId cleared`);
    }

    // Notify teacher
    await sendNotification({
      message: `The course "${courseCode}" has been removed from your teaching assignments.`,
      type: "warning",
      recipient: teacher._id,
      recipientModel: "Teacher",
    });

    res.status(200).json({ message: "Course removed from teacher" });

  } catch (err) {
    console.error("Error removing course:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const approveStudentResult = async (req, res) => {
  const { studentId } = req.params;
  const { code, semester } = req.body;

  console.log(`Incoming request to approve result for studentId: ${studentId}`);
  console.log(`Searching for result with code: ${code}, semester: ${semester}`);

  if (!code || !semester) {
    return res.status(400).json({ message: "Missing code or semester in request" });
  }

  try {
    const result = await Result.findOne({ student: studentId, code, semester });

    if (!result) {
      console.log(`Result not found for studentId: ${studentId}, code: ${code}, semester: ${semester}`);
      return res.status(404).json({ message: "Result entry not found" });
    }

    result.status = "Approved";
    await result.save();

    console.log(`Result status updated to approved for studentId: ${studentId}`);

    // 🔔 Notify student
    await sendNotification({
      message: `Your result for course "${code}" (${semester}) has been approved.`,
      type: "success",
      recipient: studentId,
      recipientModel: "Student",
    });

    // Notify teacher
    if (result.teacher) {
      const teacher = await Teacher.findById(result.teacher).select('firstName lastName');
      const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : "Teacher";

      await sendNotification({
        message: `The result you submitted for course "${code}" (${semester}) has been approved for one of your students.`,
        type: "info",
        recipient: result.teacher,
        recipientModel: "Teacher",
      });

      console.log(`Notification sent to teacher: ${teacherName}`);
    }

    res.json({ message: "Result approved successfully" });
  } catch (err) {
    console.error("Server error while approving result:", err);
    res.status(500).json({ message: "Server error" });
  }
};


const getStudentResults = async (req, res) => {
  const { studentId } = req.params;

  console.log(`Incoming request to get results for student ID: ${studentId}`);

  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    console.warn(`Invalid student ID format: ${studentId}`);
    return res.status(400).json({ message: "Invalid student ID" });
  }

  try {
    const student = await Student.findById(studentId);
    if (!student) {
      console.warn(`Student not found for ID: ${studentId}`);
      return res.status(404).json({ message: "Student not found" });
    }

    const results = await Result.find({ student: studentId }).populate('course'); 

    console.log(`Retrieved ${results.length} results for student ID: ${studentId}`);
    res.json({ results });

  } catch (err) {
    console.error("Error fetching student results:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload Profile Photo Controller
const uploadProfilePhoto = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file?.path) {
      return res.status(400).json({ message: "No image file uploaded." });
    }

    // Fetch super admin from DB
    const superAdmin = await SuperAdmin.findById(req.user.id);
    if (!superAdmin) {
      return res.status(404).json({ message: 'Super Admin not found.' });
    }

    console.log(`Uploading profile photo for: ${req.user.id}`);

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'superadmin_profiles',
      use_filename: true,
    });

    // Validate upload result
    if (!uploadResult?.secure_url) {
      return res.status(500).json({ message: "Image upload failed." });
    }

    // Save image URL to super admin profile
    superAdmin.profilePhoto = uploadResult.secure_url;
    await superAdmin.save();

    // Log activity
    if (typeof logActivity === 'function') {
      await logActivity(superAdmin._id, 'Uploaded profile photo');
    }

    console.log(`Upload successful. URL: ${superAdmin.profilePhoto}`);

    // Send success response
    res.json({
      message: 'Profile photo updated successfully',
      url: superAdmin.profilePhoto,
    });

  } catch (err) {
    console.error('Error uploading profile photo:', err);
    res.status(500).json({ message: "Server error during image upload" });
  }
};


const getAdminProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Unauthorized: Missing user info.' });
    }

    console.log(`Fetching profile for Super Admin: ${req.user.id}`);

    const superAdmin = await SuperAdmin.findById(req.user.id).select('-password');
    if (!superAdmin) {
      console.warn(`Super Admin not found: ${req.user.id}`);
      return res.status(404).json({ message: 'Super Admin not found.' });
    }

    res.status(200).json({ success: true, superAdmin });
  } catch (err) {
    console.error('Error fetching Super Admin profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Super Admin Profile
const updateAdminProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Unauthorized: Missing user info.' });
    }

    const allowedFields = [
      'firstName',
      'lastName',
      'phoneNumber',
      'age',
      'gender',
      'nationality',
      'stateOfOrigin',
      'dateOfBirth',
      'address',
      'maritalStatus',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    console.log(`Updating profile for Super Admin: ${req.user.id}`, updates);

    const updatedSuperAdmin = await SuperAdmin.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedSuperAdmin) {
      return res.status(404).json({ message: 'Super Admin not found.' });
    }

    // Optional: log activity for audit trail
    if (typeof logActivity === 'function') {
      await logActivity(req.user.id, 'Updated profile');
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      superAdmin: updatedSuperAdmin,
    });
  } catch (err) {
    console.error('Error updating Super Admin profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
// Get all payments

const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: 'studentId',
        select: 'firstname lastname studentId matricNumber department level semester session'
      })
      .sort({ createdAt: -1 });

    console.log(`[ADMIN] Retrieved ${payments.length} payments`);
    res.status(200).json({ payments });
  } catch (error) {
    console.error('[ERROR] getAllPayments:', error.message);
    res.status(500).json({ message: 'Failed to retrieve all payments' });
  }
};

// Get payments by specific student (all statuses)
const getPaymentsByStudentId = async (req, res) => {
  const { studentId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      console.warn(`[WARN] Invalid studentId format: ${studentId}`);
      return res.status(400).json({ message: 'Invalid student ID format' });
    }

    const payments = await Payment.find({ studentId }) 
      .sort({ createdAt: -1 })
      .populate({
        path: 'studentId',
        select: 'firstname lastname studentId matricNumber department level semester session'
      });

    if (!payments.length) {
      console.log(`[INFO] No payments found for student ${studentId}`);
      return res.status(200).json({ payments: [] });
    }

    console.log(`[INFO] Found ${payments.length} payment(s) for student ${studentId}`);
    res.status(200).json({ payments });
  } catch (error) {
    console.error(`[ERROR] getPaymentsByStudentId (${studentId}):`, error.message);
    res.status(500).json({ message: 'Failed to retrieve payments for this student' });
  }
};


// Verify a payment
const verifyPayment = async (req, res) => {
  const { paymentId } = req.params;
  const { remark, status = 'paid' } = req.body;

  const validStatuses = ['paid', 'rejected', 'pending'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value. Must be: paid, rejected, or pending.' });
  }

  try {
    const payment = await Payment.findById(paymentId).populate('studentId');

    if (!payment) {
      console.warn(`Payment with ID ${paymentId} not found`);
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.verifiedByAdmin && status === 'paid') {
      return res.status(400).json({ message: 'Payment already verified as paid' });
    }

    // Update payment fields
    payment.status = status;
    payment.verifiedByAdmin = status === 'paid';
    if (remark) payment.remark = remark;
    if (status === 'paid') {
      payment.amountPaid = payment.amountExpected;
    }

    if (req.admin?.id) {
      payment.verifiedByAdminId = req.admin.id;
    }

    await payment.save();

    const student = payment.studentId;
    if (student) {
      student.paymentStatus =
        status === 'paid' ? 'paid' : status === 'rejected' ? 'na' : 'pending';
      await student.save();

      // In-app notification
      await sendNotification({
        message: `Your payment for session ${payment.session} (Level ${payment.level}) has been marked as "${status}".`,
        type:
          status === 'paid'
            ? 'success'
            : status === 'rejected'
            ? 'danger'
            : 'info',
        recipient: student._id,
        recipientModel: 'Student',
      });

      // Tuition-specific notification
      if (status === 'paid') {
       await sendTuitionPaymentApproved(
  student.email,
  `${student.firstname} ${student.lastname}`,
  payment.amountPaid,
  payment.session,
  payment.level
);


      }
    }

    console.log(`Payment ${paymentId} marked as "${status}"`);
    res.status(200).json({ message: `Payment ${status}`, payment });
  } catch (error) {
    console.error(`verifyPayment (${paymentId}):`, error.message);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
};

// Dashboard summary: Total paid amount
const getTotalPaidAmount = async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'paid' });
    const totalAmount = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    console.log(`[ADMIN] Total paid: ₦${totalAmount} from ${payments.length} payments`);
    res.status(200).json({ totalPaid: totalAmount });
  } catch (error) {
    console.error('[ADMIN] getTotalPaidAmount ERROR:', error.message);
    res.status(500).json({ message: 'Failed to calculate total paid amount' });
  }
};



// Update default payment amount


const updatePaymentConfig = async (req, res) => {
  const { amount, level, session } = req.body;

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ message: 'Invalid payment amount' });
  }

  const query = {};
  if (typeof level === 'number') query.level = level;
  if (typeof session === 'string') query.session = session.trim();

  try {
    const updated = await PaymentConfig.findOneAndUpdate(
      query,
      { amount },
      { new: true, upsert: true }
    );

    console.log(`[ADMIN] Payment config updated to ₦${amount} (level: ${query.level || 'all'}, session: ${query.session || 'all'})`);

    const studentQuery = {};
    if (query.level) studentQuery.level = query.level;
    if (query.session) studentQuery.session = query.session;

    const students = await Student.find(studentQuery).select('email -_id');
    const emailList = students.map(s => s.email).filter(Boolean);

    if (emailList.length > 0) {
      await sendGeneralFeeUpdateMail(emailList);
      console.log(`Notification sent to ${emailList.length} students.`);
    } else {
      console.log('No student emails found for notification.');
    }

    res.status(200).json({ message: 'Payment amount updated and notifications sent', amount: updated.amount });

  } catch (error) {
    console.error('[ERROR] updatePaymentConfig:', error.message);
    res.status(500).json({ message: 'Failed to update payment amount' });
  }
};


// Current global payment config

const getPaymentConfig = async (req, res) => {
  try {
    const { level, session } = req.query;

    let query = {};
    if (level) query.level = Number(level);
    if (session) query.session = session.trim();

    const config = await PaymentConfig.findOne(query);

    if (!config) return res.status(200).json({ amount: 0 });

    res.status(200).json({ amount: config.amount });
  } catch (error) {
    console.error('[ERROR] getPaymentConfig:', error.message);
    res.status(500).json({ message: 'Failed to fetch payment config' });
  }
};
// Admin → Teacher
const sendMessageToTeacher = async (req, res) => {
  console.log("Admin sending message to teacher");

  try {
    const { teacherId, text } = req.body;

    if (!text || !teacherId) {
      return res.status(400).json({ message: "Teacher and text are required" });
    }

    const teacher = await Teacher.findById(teacherId).select("title firstName lastName email");
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

     const teacherFullName = ` ${teacher.title} ${teacher.firstName} ${teacher.lastName}`;

    const message = new Message({
      sender: "Admin",
      recipient: `Teacher-${teacherId}`,
      receiverId: teacher._id,
      text,
      timestamp: new Date(),
      isRead: false
    });

    await message.save();
    console.log("Message to teacher saved:", message);

    // Email notification
    await sendAdminMessageNotificationToTeacher(
      teacher.email,
      teacherFullName,
      text.length > 100 ? text.slice(0, 100) + "..." : text
    );

    // In-app notification
    await sendNotification({
      message: `New message from the School Administration.`,
      type: "info",
      recipientModel: "Teacher",
      recipientId: teacher._id
    });

    return res.status(200).json(message);
  } catch (error) {
    console.error("Error sending message to teacher:", error);
    return res.status(500).json({ message: "Server error sending message to teacher" });
  }
};

const getAllMessages = async (req, res) => {
  console.log("Fetching messages for admin");

  try {
    const { teacherId, studentId } = req.query;

    if (!teacherId && !studentId) {
      return res.status(400).json({ message: "Missing teacherId or studentId" });
    }

    let messages;

    if (teacherId) {
      const teacherTag = `Teacher-${teacherId}`;
      messages = await Message.find({
        $or: [
          { sender: "Admin", recipient: teacherTag },
          { sender: teacherTag, recipient: "Admin" },
        ],
      }).sort({ timestamp: 1 });
    }

    if (studentId) {
      const studentTag = `Student-${studentId}`;
      messages = await Message.find({
        $or: [
          { sender: "Admin", recipient: studentTag },
          { sender: studentTag, recipient: "Admin" },
        ],
      }).sort({ timestamp: 1 });
    }

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ message: "Server error fetching messages" });
  }
};

const editMessage = async (req, res) => {
  console.log("Request to edit message");

  try {
    const { id } = req.params;
    const { newText } = req.body;

    console.log(`Message ID: ${id}, New Text: "${newText}"`);

    if (!newText?.trim()) {
      console.log("Invalid new text provided");
      return res.status(400).json({ message: "New text required" });
    }

    const message = await Message.findById(id);
    if (!message) {
      console.log("Message not found");
      return res.status(404).json({ message: "Message not found" });
    }

    message.text = newText;
    await message.save();

    console.log("Message edited successfully");
    res.status(200).json(message);
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ message: "Server error editing message" });
  }
};
const deleteMessage = async (req, res) => {
  console.log("Request to delete message");

  try {
    const { id } = req.params;
    console.log(`Message ID to delete: ${id}`);

    const deleted = await Message.findByIdAndDelete(id);

    if (!deleted) {
      console.log("Message not found for deletion");
      return res.status(404).json({ message: "Message not found" });
    }

    console.log("Message deleted successfully");
    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ message: "Server error deleting message" });
  }
};

const getMessagesFromTeacherToAdmin = async (req, res) => {
  console.log("Fetching messages from Teacher to Admin");
  const { teacherId } = req.query;
  console.log("Query teacherId:", teacherId);

  if (!teacherId) return res.status(400).json({ message: "teacherId required" });

  try {
    const teacherTag = `Teacher-${teacherId}`;
    const messages = await Message.find({
      sender: teacherTag,
      recipient: "Admin",
    }).sort({ timestamp: 1 });

    console.log("Messages from teacher:", messages.length);
    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages from teacher:", error);
    return res.status(500).json({ message: "Server error fetching messages" });
  }
};
const getMessageFromStudent = async (req, res) => {
  console.log("Fetching messages from Student to Admin");
  const { studentId } = req.query;
  console.log("Query studentId:", studentId);

  if (!studentId) return res.status(400).json({ message: "studentId required" });

  try {
    const studentTag = `Student-${studentId}`;
    const messages = await Message.find({
      sender: studentTag,
      recipient: "Admin",
    }).sort({ timestamp: 1 });

    console.log("Messages from student:", messages.length);
    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching student-admin messages:", error);
    res.status(500).json({ message: "Server error fetching messages" });
  }
};



// Admin → Student
const sendMessageToStudent = async (req, res) => {
  console.log("Admin sending message to student");

  try {
    const { studentId, text } = req.body;

    if (!text || !studentId) {
      return res.status(400).json({ message: "Student and text are required" });
    }

    const student = await Student.findById(studentId).select("firstname lastname email");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const studentFullName = `${student.firstname} ${student.lastname}`;

    const message = new Message({
      sender: "Admin",
      recipient: `Student-${studentId}`,
      receiverId: student._id,
      text,
      timestamp: new Date(),
      isRead: false
    });

    await message.save();
    console.log("Message to student saved:", message);

    // Email notification
    await sendAdminMessageNotificationToStudent(
      student.email,
      studentFullName,
      text.length > 100 ? text.slice(0, 100) + "..." : text
    );

    // In-app notification
    await sendNotification({
      message: `New message from Admin`,
      type: "info",
      recipientModel: "Student",
      recipientId: student._id
    });

    return res.status(200).json(message);
  } catch (error) {
    console.error("Error sending message to student:", error);
    return res.status(500).json({ message: "Server error sending message to student" });
  }
};

const sendMessageFromLanding = async (req, res) => {
  try {
    console.log("Incoming request to sendMessageFromLanding");

    const { name, email, message } = req.body;
    console.log("Request body:", { name, email, message });

    if (!name || !email || !message) {
      console.log("Validation failed: Missing required fields");
      return res.status(400).json({ error: "All fields are required." });
    }

    // Save to database
    const savedMessage = await ContactMessage.create({
      name,
      email,
      message
    });
    console.log("Message saved to database:", savedMessage);

    // Send email to Admin
    const adminInfo = await sendLandingContactEmail(name, email, message);
    console.log("Admin email send result:", adminInfo);

    // Send auto-reply to User
    const userInfo = await sendLandingContactAutoReply(name, email);
    console.log("User auto-reply send result:", userInfo);

    if (!adminInfo || !userInfo) {
      console.log("Error: One or more emails failed to send");
      return res.status(500).json({ error: "Failed to send one or more emails." });
    }

    console.log("Contact message process completed successfully");
    res.json({
      success: true,
      message: "Your message has been sent successfully and stored in our system."
    });
  } catch (error) {
    console.error("Error in sendMessageFromLanding:", error);
    res.status(500).json({ error: "Server error." });
  }
};

const getAllContactMessages = async (req, res) => {
  try {
    console.log("Fetching all contact messages...");
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    console.log(`Found ${messages.length} messages`);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    res.status(500).json({ error: "Server error." });
  }
};

// Admin replies to user
const replyToContactMessage = async (req, res) => {
  try {
    const { messageId, replyMessage } = req.body;

    if (!messageId || !replyMessage) {
      return res.status(400).json({ error: "Message ID and reply are required." });
    }

    const contact = await ContactMessage.findById(messageId);
    if (!contact) {
      return res.status(404).json({ error: "Original message not found." });
    }

    const reply = { message: replyMessage, sender: "admin", date: new Date() };
    contact.replies.push(reply);
    await contact.save();

    const plainText = replyMessage.replace(/<[^>]*>?/gm, "");
    const htmlContent = `<div style="font-family: Arial, sans-serif; font-size: 14px;">${replyMessage}</div>`;

    await sendEmail(contact.email, `Re: ${contact.message.substring(0, 30)}...`, plainText, htmlContent);

    res.json({ success: true, message: "Reply sent and saved." });
  } catch (error) {
    console.error("Error sending reply:", error);
    res.status(500).json({ error: "Server error." });
  }
};




module.exports = {
  adminSignup,
  adminLogin,
  approveTeacher,
  forgotPassword,
  resetPassword,
  verifyCode,
  changePassword,
  getAdminDashboardStats,
  sendNotification,
  getAdminNotifications,
  markNotificationsAsRead,
  getAdminInfo,
  getAllTeachers,
  rejectTeacher,
  deleteTeacher,
  // assignCourseToTeacher,
  // assignMultipleCoursesToTeacher,
  getAllStudents,
  deleteStudent,
  assignCourseToStudent,
  promoteStudent,
  changeStudentDepartment,
  createCourse,
  getCoursesByFilter,
  updateCourse,
  deleteCourse,
  assignCoursesToStudent,
  approveStudentCourse,
  getStudentWithCourses,
 rejectStudentCourse,
  updateTeacherByAdmin,
  assignCourseToTeacher,
  removeAssignedCourseFromTeacher,
  approveStudentResult,
  getStudentResults, 
  uploadProfilePhoto,
  getAdminProfile,
  updateAdminProfile,
  updateStudentDetails,
  getAllPayments,
  getPaymentsByStudentId,
  verifyPayment,
   getTotalPaidAmount,
    updatePaymentConfig,
  getPaymentConfig,
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
 
};


