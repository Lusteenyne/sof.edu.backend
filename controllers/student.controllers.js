const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Student = require('../model/student.model');
const Course = require('../model/course.model');
const Notification = require('../model/notification.model');
const Result = require('../model/result.model');
const fs = require('fs');
const axios = require('axios');
const AssignmentSubmission = require('../model/assignmentSubmission.model');
const Assignment = require('../model/assignment.model');
const Teacher = require('../model/teacher.model')
const Message = require('../model/message.model')
const Payment = require('../model/payment.model');
const PaymentConfig = require('../model/paymentConfig.model');
const { uploadFilesToCloudinary, cloudinary } = require("../utilis/cloudinary");
const {
  sendMail,
 sendPasswordResetEmail,
 sendAssignmentSubmissionEmail,
  sendStudentFeedbackNotice,
  sendStudentMessageNotificationToTeacher,
  sendStudentMessageNotificationToAdmin,
  sendCourseRegistrationMail,
   sendTuitionPaymentToAdmin
} = require('../utilis/mailer');

const saltRounds = 10;
const sendNotification = async ({ message, type = 'info', recipient = null, recipientModel = null }) => {
  try {
    await Notification.create({ message, type, recipient, recipientModel });
  } catch (err) {
    console.error('Notification Error:', err.message);
  }
};
// Generate Student ID
const generateStudentId = async () => {
  const currentYear = new Date().getFullYear();
  const sessionStart = String(currentYear).slice(-2);
  const sessionEnd = String(currentYear + 1).slice(-2);
  const sessionPrefix = `EES/${sessionStart}/${sessionEnd}`;

  const count = await Student.countDocuments({
    studentId: { $regex: `^${sessionPrefix}` }
  });

  const sequenceNumber = String(count + 1).padStart(4, '0');
  const fullId = `${sessionPrefix}/${sequenceNumber}`;

  console.log(`Generated Student ID: ${fullId}`);
  return fullId;
};

// Register Student
const registerStudent = async (req, res) => {
  console.log("Register request received:", req.body);
  const { firstname, lastname, email, password, department } = req.body;

  if (!firstname || !lastname || !email || !password || !department) {
    console.warn("Missing required registration fields");
    return res
      .status(400)
      .json({ message: "All required fields must be filled" });
  }

  try {
    console.log(`Checking if student email exists: ${email}`);
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      console.warn("Email already registered");
      return res.status(400).json({ message: "Email already registered" });
    }

    // hash password + generate student ID
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const studentId = await generateStudentId();

    // create new student
    const newStudent = new Student({
      firstname,
      lastname,
      email,
      department,
      password: hashedPassword,
      studentId,
    });

    console.log("Saving new student record to database");
    await newStudent.save();

    // send email (with error handling)
    try {
      await sendMail(email, firstname, studentId);
      console.log(`Welcome email sent to ${email}`);
    } catch (mailError) {
      console.error(`Failed to send welcome email to ${email}:`, mailError);
    }

    res.status(201).json({
      message: "Student registered successfully",
      studentId,
    });
  } catch (error) {
    console.error("Error during student registration:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login Student
const loginStudent = async (req, res) => {
  console.log("Login request received:", req.body);
  const { studentId, password } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    console.log(`Looking up student by ID: ${studentId}`);

    if (!student) {
      console.warn("Invalid student ID");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      console.warn("Incorrect password");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!process.env.SECRETKEY) {
      console.error("SECRETKEY not set in environment variables");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const token = jwt.sign(
      { id: student._id },
      process.env.SECRETKEY,
      { expiresIn: "7h" }
    );

    console.log(`Login successful for student ID: ${studentId}`);

    res.status(200).json({
      message: "Login successful",
      token,
      student: {
        id: student._id,
        studentId: student.studentId,
        firstname: student.firstname,
        email: student.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Get Student Profile
const getStudentProfile = async (req, res) => {
  console.log(`Fetching profile for student ID: ${req.user.id}`);
  try {
    const student = await Student.findById(req.user.id).select('-password');
    if (!student) {
      console.warn('Student not found');
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (err) {
    console.error('Error fetching student profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Student Profile
const updateStudentProfile = async (req, res) => {
  console.log(`Updating profile for student ID: ${req.user.id}`);
  console.log('Request body:', req.body);

  try {
    const allowedFields = [
      'phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const student = await Student.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    });

    if (!student) {
      console.warn('Student not found for update');
      return res.status(404).json({ message: 'Student not found' });
    }

    console.log('Profile updated:', student);
    res.json({ message: 'Profile updated', student });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log('Forgot password request for email:', email);

  try {
    const student = await Student.findOne({ email });
    if (!student) {
      console.warn('Student not found for email:', email);
      return res.status(404).json({ message: 'Student not found' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000);
    student.resetCode = code;
    student.resetCodeExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
    await student.save();

    const fullName = `${student.firstname} ${student.lastname}`;
    await sendPasswordResetEmail(email, fullName, code); 

    console.log(`Reset code sent to ${email}`);
    res.json({ message: 'Password reset code sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, code, and new password are required' });
  }

  console.log('Reset password request for:', email, 'with code:', code);

  try {
    const student = await Student.findOne({
      email,
      resetCodeExpiry: { $gt: Date.now() },
    });

    if (!student || student.resetCode.toString() !== code.toString()) {
      console.warn('Invalid or expired reset code for:', email);
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    student.password = await bcrypt.hash(newPassword, saltRounds);
    student.resetCode = undefined;
    student.resetCodeExpiry = undefined;
    await student.save();

    console.log('Password reset successful for:', email);
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Password reset error for:', email, err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify Reset Code
const verifyCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and code are required' });
  }

  console.log(`Verifying reset code for: ${email}`);

  try {
    const student = await Student.findOne({
      email,
      resetCodeExpiry: { $gt: Date.now() },
    });

    if (!student || student.resetCode.toString() !== code.toString()) {
      console.warn('Invalid or expired code for:', email);
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    console.log('Code verified successfully for:', email);
    res.json({ message: 'Code verified successfully' });
  } catch (err) {
    console.error('Code verification error for:', email, err);
    res.status(500).json({ message: 'Server error' });
  }
};
// Change Password (authenticated)
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' });
  }

  console.log('Change password request for user id:', req.user?.id);

  try {
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });

    student.password = await bcrypt.hash(newPassword, saltRounds);
    await student.save();

    console.log('Password changed successfully for:', student.email);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error for user id:', req.user?.id, err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Upload Profile Photo
const uploadProfilePhoto = async (req, res) => {
  console.log('Upload profile photo request received');

  try {
    if (!req.file?.path) {
      console.warn('No image file uploaded');
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    const upload = await cloudinary.uploader.upload(req.file.path, {
      folder: 'student-profile-photos',
    });

    const student = await Student.findById(req.user.id);
    student.profilePhoto = upload.secure_url;
    await student.save();

    console.log('Profile photo uploaded and saved:', student.profilePhoto);
    res.json({
      message: 'Profile photo updated',
      url: student.profilePhoto,
    });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get My Courses
const getMyCourses = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).populate('courses.course');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    res.json({ courses: student.courses });
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// Submit Feedback
const sendFeedback = async (req, res) => {
  console.log('Feedback submitted:', req.body);
  const { subject, message } = req.body;

  try {
    await sendStudentFeedbackNotice(req.user.id, subject, message);
    console.log(`Feedback sent by student ID: ${req.user.id}`);
    res.json({ message: 'Feedback submitted' });
  } catch (err) {
    console.error('Feedback submission error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Check if Email Exists
const checkEmailExists = async (req, res) => {
  const { email } = req.query;
  console.log('Checking if email exists:', email);

  if (!email) {
    return res.status(400).json({ message: 'Email query parameter is required' });
  }

  try {
    const student = await Student.findOne({ email });
    const exists = !!student;

    if (exists) {
      console.warn('Email already exists');
    } else {
      console.log('Email is available');
    }

    res.status(200).json({ exists });
  } catch (err) {
    console.error('Email check error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Student Info
const getStudentInfo = async (req, res) => {
  console.log(`Getting student info for: ${req.user.id}`);

  try {
    const student = await Student.findById(req.user.id).select(
      'firstname lastname studentId department level semester profilePhoto cgpa paymentStatus session'
    );

    if (!student) return res.status(404).json({ message: 'Student not found' });

    let cgpa = student.cgpa;
    if (cgpa === undefined || cgpa === null) {
      const results = await Result.find({ student: student._id, status: 'Approved' });

      let totalPoints = 0;
      let totalUnits = 0;

      results.forEach(result => {
        totalPoints += (result.point || 0) * (result.unit || 0);
        totalUnits += result.unit || 0;
      });

      cgpa = totalUnits > 0 ? parseFloat((totalPoints / totalUnits).toFixed(2)) : 0;
      student.cgpa = cgpa;
      await student.save();
    }

    const recentActivities = [
      { description: "Submitted CSC301 assignment", timestamp: new Date(Date.now() - 86400000) },
      { description: "Attended Data Structures class", timestamp: new Date(Date.now() - 172800000) },
      { description: "Joined online exam prep session", timestamp: new Date(Date.now() - 259200000) }
    ];

    res.json({
      fullName: `${student.firstname} ${student.lastname}`,
      studentId: student.studentId,
      department: student.department,
      level: student.level,
      semester: student.semester,
      session: student.session,
      profilepic: student.profilePhoto || null,
      cgpa,
      paymentStatus: student.paymentStatus || "Pending",
      recentActivities
    });
  } catch (err) {
    console.error('Error fetching student info:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Dashboard Stats
const getDashboardStats = async (req, res) => {
  console.log(`Fetching dashboard stats for student ID: ${req.user.id}`);

  try {
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const coursesForStudent = await Course.find({
      level: student.level,
      department: student.department,
      semester: student.semester,
    });

    res.json({ enrolledCourses: coursesForStudent.length });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Notifications for a specific student only
const getNotifications = async (req, res) => {
  try {
    const studentId = req.user.id;

    const notifications = await Notification.find({
      recipientModel: 'Student',
      recipient: studentId, // only for this student
    }).sort({ createdAt: -1 });

    res.status(200).json({ notifications });
  } catch (err) {
    console.error('Get student notifications error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark Notifications as Read
const markNotificationsRead = async (req, res) => {
  try {
    const studentId = req.user.id;

    await Notification.updateMany({
      $or: [
        { recipient: null, recipientModel: 'Student' },
        { recipient: studentId, recipientModel: 'Student' }
      ],
      isRead: false
    }, { isRead: true });

    res.status(200).json({ message: 'Notifications marked as read' });
  } catch (err) {
    console.error('Error marking student notifications as read:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Available Courses
const getAvailableCoursesForStudent = async (req, res) => {
  try {
    console.log('Fetching available courses for student:', req.user.id);

    const student = await Student.findById(req.user.id);
    if (!student) {
      console.warn('Student not found:', req.user.id);
      return res.status(404).json({ message: 'Student not found' });
    }

    const { department, level, semester } = student;
    const normalizedSemester = semester.trim();

    const filter = {
      department,
      level: Number(level),
      semester: normalizedSemester,
    };

    const matchingCourses = await Course.find(filter);

    console.log(`Found ${matchingCourses.length} matching course(s).`);
    res.json({ courses: matchingCourses });
  } catch (err) {
    console.error('Error fetching available courses:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


const submitCourses = async (req, res) => {
  try {
    console.log('Submit courses for studentId:', req.user.id, 'Payload:', req.body.courseIds);

    const { courseIds } = req.body;
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ message: 'No courses selected' });
    }

    const student = await Student.findById(req.user.id).select(
      'courses firstname lastname email semester department level phoneNumber age gender dateOfBirth address'
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before submitting courses',
        missingFields,
      });
    }

    const existingCourseIds = student.courses.map(c => c.course.toString());
    const newCourses = courseIds.filter(id => !existingCourseIds.includes(id));

    if (newCourses.length === 0) {
      return res.status(400).json({ message: 'All selected courses are already submitted' });
    }

    const toAdd = newCourses.map(id => ({
      course: id,
      status: 'pending',
      createdAt: new Date()
    }));

    await Student.findByIdAndUpdate(
      req.user.id,
      { $push: { courses: { $each: toAdd } } },
      { new: true, runValidators: false }
    );

    console.log(`Added ${toAdd.length} new course(s) for approval.`);

    await sendNotification({
      type: 'info',
      message: `${student.firstname} ${student.lastname} submitted ${toAdd.length} course(s) for approval.`,
      recipientModel: 'Admin',
    });

    await sendCourseRegistrationMail(
      `${student.firstname} ${student.lastname}`,
      student.semester || 'Current Semester',
      student.department,
      student.level
    );

    res.status(200).json({
      message: 'Courses submitted successfully',
      added: toAdd.length
    });

  } catch (err) {
    console.error('Submit courses error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSubmittedCourses = async (req, res) => {
  try {
    console.log('Fetch submitted courses for student:', req.user.id);

    const student = await Student
      .findById(req.user.id)
      .populate('courses.course', 'code title unit semester level department');

    if (!student) return res.status(404).json({ message: 'Student not found' });

// Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before getting your submitted courses',
        missingFields,
      });
    }




    // Filter courses based on student's current semester, level, and department
    const filteredCourses = student.courses.filter((entry) => {
      const course = entry.course;

      return (
        course &&
        course.semester === student.semester &&
        course.level === student.level &&
        course.department === student.department
      );
    });

    res.status(200).json({ courses: filteredCourses });
  } catch (err) {
    console.error('Error fetching submitted courses:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getStudentApprovedResults = async (req, res) => {
  const studentId = req.user.id;
  console.log(`Request to fetch approved results for student ID: ${studentId}`);

  try {
    //  Fetch student record
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

// Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before seeing your approved courses',
        missingFields,
      });
    }


    //  Get all approved results for the student
    const results = await Result.find({
      student: student._id,
      status: 'Approved',
    });

    console.log(`Fetched ${results.length} approved results`);

    // Calculate CGPA
    let totalPoints = 0.0;
    let totalUnits = 0.0;

    results.forEach((result) => {
      const point = result.point || 0.0;
      const unit = result.unit || 0.0;

      totalPoints += point * unit;
      totalUnits += unit;
    });

    const cgpa =
      totalUnits > 0
        ? parseFloat((totalPoints / totalUnits).toFixed(2))
        : "0.00";

    // Get courses for the student's semester, level, and department
    const semesterCourses = await Course.find({
      semester: student.semester,
      level: student.level,
      department: student.department,
    });

    const allCourseCodes = semesterCourses
      .map((course) => course.code)
      .filter(Boolean);

    
    // Failed courses (point = 0)
    const failedCourses = results
      .filter((result) => result.point === 0)
      .map((result) => ({
        code: result.code,
        point: 0,
      }));

    // Courses not yet attempted
    const notTakenCourses = allCourseCodes
      .filter((code) => !results.map((r) => r.code).includes(code))
      .map((code) => ({
        code,
        point: 0,
      }));

    const outstandingCourses = [...failedCourses, ...notTakenCourses];

   // Update CGPA in student record
    student.cgpa = cgpa;
    await student.save();

    // Send response
    res.json({
      student: {
        fullName: `${student.firstname} ${student.lastname}`,
        studentId: student.studentId,
        level: student.level,
        session: student.session,
        semester: student.semester,
        department: student.department,
        cgpa,
      },
      cgpa,
      results,
      outstandingCourses: outstandingCourses.length > 0 ? outstandingCourses : "Nil",
    });
  } catch (err) {
    console.error("Error fetching student approved results:", err);
    res.status(500).json({ message: "Server error while fetching results" });
  }
};



const getStudentPayments = async (req, res) => {
  try {
    const studentId = req.user.id;
    if (!studentId) {
      console.log('Unauthorized: No student ID found in token');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      console.log(`Student not found: ${studentId}`);
      return res.status(404).json({ message: 'Student not found' });
    }

    // Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before accessing this feature',
        missingFields,
      });
    }


    const level = Number(student.level);
    const session = student.session?.trim();

    console.log('Fetching payment config for level:', level, 'session:', session);

    // Try to get level/session-specific config first
    let config = await PaymentConfig.findOne({ level, session });

    // If no specific config found, fallback to global (no filters)
    if (!config) {
      console.log('No specific config found. Falling back to any available config...');
      config = await PaymentConfig.findOne({});
    }

    if (!config) {
      console.warn('No payment configuration found');
      const placeholder = {
        studentId,
        session,
        level,
        amountExpected: 0,
        amountPaid: 0,
        status: 'pending',
        remark: 'No payment config available',
        method: 'transfer',
        verifiedByAdmin: false,
        createdAt: new Date(),
      };
      return res.json([placeholder]);
    }

    const amountExpected = config.amount || 0;

    const payments = await Payment.find({ studentId }).sort({ createdAt: -1 });
    console.log(`Found ${payments.length} payment(s) for student ${studentId}`);

    // Check if current level/session already has a payment
    const hasCurrentPayment = payments.some(
      (p) => Number(p.level) === level && p.session === session
    );

    if (!hasCurrentPayment) {
      console.log('No payment found for current level/session. Adding placeholder...');
      payments.unshift({
        _id: `placeholder-${Date.now()}`, // dummy ID for frontend React keys
        studentId,
        session,
        level,
        amountExpected,
        amountPaid: 0,
        status: 'pending',
        remark: 'No payment made yet',
        method: 'transfer',
        verifiedByAdmin: false,
        createdAt: new Date(),
        receiptURL: '',
        reference: '',
      });
    }

    return res.json(payments);
  } catch (err) {
    console.error('Error getting payments:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};







const uploadTransferReceipt = async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ message: 'Unauthorized' });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

// Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before accessing this feature',
        missingFields,
      });
    }



    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const existingPending = await Payment.findOne({
      studentId,
      session: student.session,
      level: student.level,
      status: 'pending',
      method: 'transfer',
    });

    if (existingPending) {
      return res.status(409).json({ message: 'Pending transfer already uploaded. Awaiting verification.' });
    }

    const config = await PaymentConfig.findOne();
    if (!config) return res.status(500).json({ message: 'Payment configuration missing' });

    const result = await cloudinary.uploader.upload(file.path, { folder: 'receipts' });

    const newPayment = new Payment({
  studentId,
  session: student.session,
  level: student.level,
  semester: student.semester,      
  department: student.department,   
  reference: `TRF-${Date.now()}`,   
  amountExpected: config.amount || 0,
  amountPaid: 0,
  status: 'pending',
  receiptURL: result.secure_url,
  method: 'transfer',
  remark: 'Awaiting verification',
  verifiedByAdmin: false,
});


    await newPayment.save();

    fs.unlink(file.path, err => {
      if (err) console.error('Failed to delete uploaded file:', err);
    });

    // Notify Admin (email + in-app)
    const fullName = `${student.firstname} ${student.lastname}`;
    await sendTuitionPaymentToAdmin(fullName, config.amount, 'transfer', student.department, student.session);
    await sendNotification({
      message: `${fullName} uploaded a bank transfer receipt for ₦${config.amount}.`,
      type: 'info',
      recipientModel: 'Admin',
      link: '/admin/payments',
    });

    return res.status(201).json({ message: 'Receipt uploaded successfully', payment: newPayment });

  } catch (err) {
    console.error('Error uploading receipt:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


const initiatePaystackPayment = async (req, res) => {
  try {
    const studentId = req.user.id;
    console.log('Student ID:', studentId);

    const student = await Student.findById(studentId);
    if (!student || !student.email) {
      console.warn('Student not found or email missing');
      return res.status(401).json({ message: 'Unauthorized or missing student data' });
    }

    const config = await PaymentConfig.findOne({});
    if (!config || !config.amount) {
      console.warn('No payment config or amount found');
      return res.status(400).json({ message: 'No global payment config found' });
    }

    const amount = config.amount;
    const metadata = {
      studentId: student._id.toString(),
      name: `${student.firstname} ${student.lastname}`,
      session: student.session,
      level: student.level,
    };

    console.log('Initiating Paystack payment with:', { amount, metadata });

    return res.status(200).json({ amount, metadata });
  } catch (err) {
    console.error('Paystack init error:', err.message);
    return res.status(500).json({ message: 'Server error initializing payment' });
  }
};



const verifyPaystackPayment = async (req, res) => {
  try {
    const reference = req.params.reference;
    if (!reference) return res.status(400).json({ message: 'Transaction reference is required' });

    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = paystackRes.data.data;
    if (data.status !== 'success') {
      return res.status(400).json({ message: 'Transaction not successful' });
    }

    const studentId = data.metadata?.studentId;
    if (!studentId) return res.status(400).json({ message: 'Student ID is missing in payment metadata' });

    const existingPayment = await Payment.findOne({ reference }).populate('studentId');
    if (existingPayment) {
      return res.status(200).json({
        message: 'Payment already verified',
        payment: {
          ...existingPayment._doc,
          firstname: existingPayment.studentId.firstname,
          lastname: existingPayment.studentId.lastname,
        },
      });
    }

    const student = await Student.findById(studentId);
    if (!student || !student.department || !student.semester) {
      return res.status(400).json({ message: 'Student record missing or incomplete' });
    }

    const newPayment = await Payment.create({
      studentId,
      amountExpected: data.amount / 100,
      amountPaid: data.amount / 100,
      paidAt: new Date(data.paid_at),
      method: 'online',
      status: 'pending',
      session: data.metadata?.session,
      level: data.metadata?.level,
      semester: student.semester,
      department: student.department,
      reference: data.reference,
      receiptURL: data.authorization?.receipt_url || '',
    });

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { paymentStatus: 'pending' },
      { new: true }
    );

    const fullName = `${student.firstname} ${student.lastname}`;

    await sendNotification({
      message: `Your payment for session ${data.metadata.session} (${data.metadata.level} Level) is now pending admin approval.`,
      type: 'info',
      recipient: updatedStudent._id,
      recipientModel: 'Student',
    });

    // Notify Admin (email + in-app)
    await sendTuitionPaymentToAdmin(fullName,
  data.amount / 100,
  'online (Paystack)',
  student.department,
  data.metadata?.session);

    await sendNotification({
      message: `${fullName} made a tuition payment of ₦${data.amount / 100} via Paystack.`,
      type: 'info',
      recipientModel: 'Admin',
    
    });

    const populatedPayment = await Payment.findById(newPayment._id).populate('studentId');

    return res.status(200).json({
      message: 'Payment recorded and pending admin approval',
      payment: {
        ...populatedPayment._doc,
        firstname: populatedPayment.studentId.firstname,
        lastname: populatedPayment.studentId.lastname,
      },
    });

  } catch (error) {
    console.error('Waiting for administration verfication:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to verify payment' });
  }
};

const getStudentAssignments = async (req, res) => {
  const studentId = req.user.id;
  console.log(`[GET ASSIGNMENTS] Student ${studentId} is requesting their assignments.`);

  try {
    const student = await Student.findById(studentId).populate('courses.course');

    if (!student) {
      console.warn(`[GET ASSIGNMENTS] Student with ID ${studentId} not found.`);
      return res.status(404).json({ message: 'Student not found' });
    }
// Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before accessing this feature',
        missingFields,
      });
    }

    const courseIds = student.courses.map(c => c.course?._id).filter(Boolean);
    console.log(`[GET ASSIGNMENTS] Student is registered for courses: ${courseIds.join(', ')}`);

    const assignments = await Assignment.find({
      course: { $in: courseIds },
    })
    .populate('course', 'code title')
    .sort({ createdAt: -1 });

    console.log(`[GET ASSIGNMENTS] Found ${assignments.length} assignments.`);

    res.status(200).json({ assignments });

  } catch (err) {
    console.error("[GET ASSIGNMENTS] Error fetching student assignments:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const submitAssignment = async (req, res) => {
  const studentId = req.user.id;
  const { assignmentId } = req.params;
  const { message } = req.body;

  console.log(`Submit assignment | Student: ${studentId} | Assignment: ${assignmentId}`);
  console.log("Message:", message);
  console.log("Files:", req.files ? req.files.map(f => f.originalname).join(', ') : 'No files uploaded');

  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      console.warn(`Assignment with ID ${assignmentId} not found.`);
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before accessing this feature',
        missingFields,
      });
    }


    const student = await Student.findById(studentId).select('firstname lastname');
    if (!student) {
      console.warn(`Student with ID ${studentId} not found.`);
      return res.status(404).json({ message: 'Student not found' });
    }

    // Upload files to Cloudinary (if any)
    const cloudinaryResults = req.files?.length
      ? await uploadFilesToCloudinary(req.files)
      : {};

    const fileUrls = Object.values(cloudinaryResults).map(file => file.url);

    const submission = new AssignmentSubmission({
      assignmentId,
      studentId,
      message,
      fileUrls,
      submittedAt: new Date(),
    });

    await submission.save();

    // Notify the teacher (in-app)
    await sendNotification({
      type: 'info',
      message: `${student.firstname} ${student.lastname} submitted an assignment.`,
      recipientModel: 'Teacher',
      recipientId: assignment.teacherId,
    });

    // Fetch teacher email for email notification
    const teacher = await Teacher.findById(assignment.teacherId).select('title firstName lastName email');
    if (teacher?.email) {
      await sendAssignmentSubmissionEmail(
        teacher.email,
        `${teacher.title} ${teacher.firstName} ${teacher.lastName}`,
        `${student.firstname} ${student.lastname}`,
        assignment.title
      );
    }

    console.log(`Assignment ${assignmentId} submitted by student ${studentId}`);

    res.status(201).json({
      message: 'Assignment submitted successfully',
      submission,
    });

  } catch (err) {
    console.error("Error submitting assignment:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const getStudentGrade = async (req, res) => {
  const studentId = req.user.id;
  const { assignmentId } = req.params;

  try {
    const student = await Student.findById(studentId).select(
      'phoneNumber age gender dateOfBirth address'
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before accessing grades',
        missingFields,
      });
    }

    const submission = await AssignmentSubmission.findOne({
      assignmentId,
      studentId,
    }).populate('assignmentId', 'title deadline');

    if (!submission) {
      return res.status(404).json({ message: 'No submission found for this assignment' });
    }

    res.status(200).json({
      message: 'Submission found',
      score: submission.score != null ? submission.score : 0,
      submittedAt: submission.submittedAt,
      assignmentTitle: submission.assignmentId.title,
      deadline: submission.assignmentId.deadline,
      fileUrls: submission.fileUrls,
      submissionMessage: submission.message,
    });
  } catch (err) {
    console.error('Error fetching student grade:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getStudentSubmissions = async (req, res) => {
  const studentId = req.user.id;
  console.log(`[GET SUBMISSIONS] Student ${studentId} is requesting their submissions.`);

  try {
    const student = await Student.findById(studentId).select(
      'phoneNumber age gender dateOfBirth address'
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before accessing submissions',
        missingFields,
      });
    }

    const submissions = await AssignmentSubmission.find({ studentId })
      .populate('assignmentId', 'title deadline course')
      .sort({ submittedAt: -1 });

    res.status(200).json({ submissions });
  } catch (err) {
    console.error(`[GET SUBMISSIONS] Error fetching submissions for student ${studentId}:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateAssignmentSubmission = async (req, res) => {
  const studentId = req.user.id;
  const { assignmentId } = req.params;
  const { message } = req.body;

  console.log(`Updating assignment submission for student ${studentId}, assignment ${assignmentId}`);

  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const student = await Student.findById(studentId).select(
      'firstname lastname phoneNumber age gender dateOfBirth address'
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Profile completion check
    const requiredFields = ['phoneNumber',
      'age',
      'gender',
      'maritalStatus',
      'dateOfBirth',
      'nationality',
      'stateOfOrigin',
      'address',];
    const missingFields = requiredFields.filter(
      (field) => !student[field] || student[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before updating submissions',
        missingFields,
      });
    }

    // Upload updated files (if any)
    const cloudinaryResults = req.files?.length
      ? await uploadFilesToCloudinary(req.files)
      : {};

    const fileUrls = Object.values(cloudinaryResults).map(file => file.url);

    const updatedSubmission = await AssignmentSubmission.findOneAndUpdate(
      { studentId, assignmentId },
      {
        message,
        ...(fileUrls.length && { fileUrls }),
        submittedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!updatedSubmission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    await sendNotification({
      type: 'info',
      message: `${student.firstname} ${student.lastname} updated their assignment submission.`,
      recipientModel: 'Teacher',
      recipientId: assignment.teacherId,
    });

    res.status(200).json({
      message: 'Submission updated successfully',
      submission: updatedSubmission,
    });
  } catch (error) {
    console.error(`Error updating submission for student ${studentId}:`, error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


//to het all teachers
const getAllTeachers = async (req, res) => {
  try {
    const studentId = req.user.id;
    const student = await Student.findById(studentId).select('courses');

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

   

    const enrolledCourseIds = student.courses.map(c => c.course);  
    console.log("Student's enrolled courses:", enrolledCourseIds);

    if (!enrolledCourseIds || enrolledCourseIds.length === 0) {
      return res.status(200).json([]);
    }

    const teachers = await Teacher.find(
      { 'assignedCourses.course': { $in: enrolledCourseIds } },
      'title firstName lastName department assignedCourses email'
    );

    console.log("Teachers found:", teachers.length);
    res.status(200).json(teachers);

  } catch (err) {
    console.error("Error fetching teachers:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// Student → Teacher
const sendMessageToTeacher = async (req, res) => {
  console.log("Student sending message to teacher");

  try {
    const studentId = req.user.id;
    const { teacherId, text } = req.body;

    // Basic validation
    if (!teacherId || !text?.trim()) {
      console.warn("Missing teacherId or text");
      return res.status(400).json({ message: "Teacher ID and message text are required" });
    }

    // Fetch teacher
    const teacher = await Teacher.findById(teacherId).select("firstname lastname email");
    if (!teacher) {
      console.warn("Teacher not found with ID:", teacherId);
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Safeguard: Prevent sending emails to admin
    if (!teacher.email || teacher.email.toLowerCase().includes("admin")) {
      console.warn("Invalid teacher email detected:", teacher.email);
      return res.status(400).json({ message: "Invalid teacher email" });
    }

    // Fetch student
    const student = await Student.findById(studentId).select("firstname lastname email");
    if (!student) {
      console.warn("Student not found with ID:", studentId);
      return res.status(404).json({ message: "Student not found" });
    }

    const studentFullName = `${student.firstname} ${student.lastname}`;

    // Create message document
    const message = new Message({
      sender: `Student-${studentId}`,
      senderId: studentId,
      recipient: `Teacher-${teacher._id}`,
      receiverId: teacher._id,
      receiverType: "Teacher",
      text: text.trim(),
      timestamp: new Date(),
      isRead: false,
    });

    await message.save();
    console.log("Message saved to DB:", message._id);

    // Send email notification
    await sendStudentMessageNotificationToTeacher(
      teacher.email,
      studentFullName,
      text.trim()
    );
    console.log("Email sent to teacher:", teacher.email);

    // Send in-app notification
    await sendNotification({
      message: `New message from ${studentFullName}`,
      type: "info",
      recipientModel: "Teacher",
      recipientId: teacher._id
    });
    console.log("In-app notification sent to teacher:", teacher._id);

    return res.status(200).json({ message: "Message sent successfully", data: message });

  } catch (error) {
    console.error("Error sending message to teacher:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Student → Admin
const sendMessageToAdminFromStudent = async (req, res) => {
  console.log("Student sending message to admin");

  try {
    const studentId = req.user.id;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const student = await Student.findById(studentId).select("firstname lastname email");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const message = new Message({
      sender: `Student-${student._id}`,
      recipient: "Admin",
      senderId: student._id,
      text,
      timestamp: new Date(),
      receiverType: "Admin",
      isRead: false,
    });

    await message.save();

    const studentFullName = `${student.firstname} ${student.lastname}`;

    // Email notification to admin
    await sendStudentMessageNotificationToAdmin(studentFullName, text);

    // In-app notification to admin
    await sendNotification({
      message: `New message from ${studentFullName}`,
      type: "info",
      recipientModel: "Admin",
      recipientId: null
    });

    return res.status(200).json(message);
  } catch (error) {
    console.error("Error sending message to Admin:", error);
    return res.status(500).json({ message: "Server error sending message to Admin" });
  }
};

// Student ↔ Teacher messages
const getMessagesWithTeacher = async (req, res) => {
  console.log("Fetching student-teacher messages");

  try {
    const studentId = req.user.id;
    const { teacherId } = req.query;

    if (!teacherId) {
      console.log("Missing teacherId");
      return res.status(400).json({ message: "Teacher ID is required" });
    }

    const messages = await Message.find({
      $or: [
        { sender: `Student-${studentId}`, recipient: `Teacher-${teacherId}` },
        { sender: `Teacher-${teacherId}`, recipient: `Student-${studentId}` },
      ],
    }).sort({ timestamp: 1 });

    console.log("Fetched messages:", messages.length);

    await Message.updateMany(
      {
        sender: `Teacher-${teacherId}`,
        recipient: `Student-${studentId}`,
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching student-teacher messages:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Student ↔ Admin messages
const getMessagesWithAdmin = async (req, res) => {
  console.log("Fetching student-admin messages");

  try {
    const studentId = req.user.id;

    const messages = await Message.find({
      $or: [
        { sender: `Student-${studentId}`, recipient: "Admin" },
        { sender: "Admin", recipient: `Student-${studentId}` },
      ],
    }).sort({ timestamp: 1 });

    console.log("Fetched messages:", messages.length);

    await Message.updateMany(
      {
        sender: "Admin",
        recipient: `Student-${studentId}`,
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching student-admin messages:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Unread counts for Student
const getStudentUnreadCounts = async (req, res) => {
  console.log("Getting student unread message counts");

  try {
    const studentId = req.user.id;

    const unreadFromAdmin = await Message.countDocuments({
      recipient: `Student-${studentId}`,
      sender: "Admin",
      isRead: false,
    });

    const teacherMessages = await Message.aggregate([
      {
        $match: {
          recipient: `Student-${studentId}`,
          isRead: false,
          sender: { $regex: "^Teacher-" },
        },
      },
      {
        $group: {
          _id: "$senderId",
          count: { $sum: 1 },
        },
      },
    ]);

    const teacherCounts = {};
    teacherMessages.forEach((msg) => {
      teacherCounts[msg._id.toString()] = msg.count;
    });

    console.log("Unread from Admin:", unreadFromAdmin);
    console.log("Unread from Teachers:", teacherCounts);

    res.json({
      admin: unreadFromAdmin,
      teachers: teacherCounts,
    });
  } catch (err) {
    console.error("Error getting student unread message counts:", err);
    res.status(500).json({ message: "Server error" });
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

module.exports = {
  sendNotification,
  registerStudent,
  loginStudent,
  getStudentProfile,
  updateStudentProfile,
  forgotPassword,
  resetPassword,
  verifyCode,
  changePassword,
  uploadProfilePhoto,
  getMyCourses,
  sendFeedback,
  checkEmailExists,
  // getAvailableCourses,
  getStudentInfo,
  getDashboardStats,
  getNotifications,
  markNotificationsRead,
  getAvailableCoursesForStudent,
  submitCourses,
  getSubmittedCourses,
  getStudentApprovedResults,
  getStudentPayments,
  uploadTransferReceipt,
  initiatePaystackPayment,
  verifyPaystackPayment,
  getStudentAssignments,
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
};
