const Teacher = require('../model/teacher.model');
const Course = require('../model/course.model');
const Student = require('../model/student.model');
const TeacherActivity = require('../model/teacherActivity.model');
const Result = require('../model/result.model');
const Message = require('../model/message.model');
const mongoose = require('mongoose');
const Notification = require('../model/notification.model');
const AssignmentSubmission = require('../model/assignmentSubmission.model');
const Assignment = require('../model/assignment.model');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { uploadFilesToCloudinary, cloudinary } = require("../utilis/cloudinary");
const {
  sendTeacherWelcomeEmail,
  sendPasswordResetEmail,
  sendGradeNotificationEmail,
  sendNewAssignmentEmail,
  sendNewTeacherNotificationToAdmin,
  sendTeacherMessageNotificationToStudent,
  sendTeacherMessageNotificationToAdmin,
  sendResetToken,
  sendTeacherFeedbackNotice
} = require("../utilis/mailer");

const saltRounds = 10;


const sendNotification = async ({ message, type = 'info', recipient = null, recipientModel = null }) => {
  try {
    await Notification.create({ message, type, recipient, recipientModel });
  } catch (err) {
    console.error('Notification Error:', err.message);
  }
};

const registerTeacher = async (req, res) => {
  try {
    console.log("Received teacher registration request");

    // Check if files exist
    if (!req.files?.cv || !req.files?.certificate) {
      return res.status(400).json({ message: "CV and Certificate PDFs are required." });
    }

    // Validate request body
    const { title, firstName, lastName, email, department, password } = req.body;
    if (!title || !firstName || !lastName || !email || !department || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({ email: email.toLowerCase() });
    if (existingTeacher) {
      return res.status(400).json({ message: "Email already registered." });
    }

    // Get file paths (served from backend /uploads)
    const cvFile = req.files.cv[0];
    const certificateFile = req.files.certificate[0];

    const cvUrl = `/uploads/${cvFile.filename}`;
    const certificateUrl = `/uploads/${certificateFile.filename}`;

    console.log("Files saved locally:", { cvUrl, certificateUrl });

    // Hash password
    console.log("Hashing password...");
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create teacher
    const newTeacher = new Teacher({
      title,
      firstName,
      lastName,
      email: email.toLowerCase(),
      department,
      cvUrl,
      certificateUrl,
      passwordHash,
      teacherId: `TCH${Date.now().toString().slice(-5)}`,
    });

    await newTeacher.save();
    console.log("Teacher created:", newTeacher._id);

    // Send notifications
    await sendTeacherWelcomeEmail(email, title, `${firstName} ${lastName}`);
    await sendNewTeacherNotificationToAdmin(`${title} ${firstName} ${lastName}`, department);

    // Respond
    res.status(201).json({
      message: "Teacher registered successfully",
      cvUrl,
      certificateUrl,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


// Login
const loginTeacher = async (req, res) => {
  try {
    const { teacherId, password } = req.body;
    console.log(`Login attempt for teacherId: ${teacherId}`);

    if (!teacherId || !password) {
      return res.status(400).json({ message: "Teacher ID and password are required." });
    }

    const teacher = await Teacher.findOne({ teacherId });
    if (!teacher) {
      console.warn(`Teacher not found: ${teacherId}`);
      return res.status(404).json({ message: "Teacher not found." });
    }

    const isMatch = await bcrypt.compare(password, teacher.passwordHash);
    if (!isMatch) {
      console.warn(`Invalid password for: ${teacherId}`);
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign({ id: teacher._id }, process.env.SECRETKEY || 'defaultSecret', { expiresIn: '6h' });

    await logActivity(teacher._id, 'Logged in');
    console.log(`Login successful for: ${teacherId}`);

    res.status(200).json({
      message: "Login successful",
      token,
      teacher: {
        id: teacher._id,
        fullName: `${teacher.title} ${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        teacherId: teacher.teacherId
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Profile

const getTeacherProfile = async (req, res) => {
  try {
    console.log(`Fetching profile for teacher: ${req.user.id}`);

    const teacher = await Teacher.findById(req.user.id).select(
      "title firstName lastName email profilePhoto teacherId department gender phoneNumber age nationality stateOfOrigin dateOfBirth address maritalStatus"
    );

    if (!teacher) {
      console.warn(`Teacher not found: ${req.user.id}`);
      return res.status(404).json({ message: "Teacher not found." });
    }

    const fullName = `${teacher.title} ${teacher.firstName} ${teacher.lastName}`.trim();

    res.status(200).json({
      title: teacher.title,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      fullName,
      email: teacher.email,
      teacherId: teacher.teacherId,
      department: teacher.department,
      gender: teacher.gender,
      phoneNumber: teacher.phoneNumber,
      age: teacher.age,
      nationality: teacher.nationality,
      stateOfOrigin: teacher.stateOfOrigin,
      dateOfBirth: teacher.dateOfBirth,
      address: teacher.address,
      maritalStatus: teacher.maritalStatus,

      profilePhoto: teacher.profilePhoto || "",
    });
  } catch (err) {
    console.error("Error fetching teacher profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH Teacher Profile
const updateTeacherProfile = async (req, res) => {
  try {
    const allowedFields = [
      'title',
      'firstName',
      'lastName',
      'phoneNumber',
      'age',
      'gender',
      'department',
      'nationality',
      'stateOfOrigin',
      'dateOfBirth',
      'address',
      'maritalStatus',
    ];

    const updates = {};

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    console.log(`Updating profile for teacher: ${req.user.id}`, updates);

    const updatedTeacher = await Teacher.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedTeacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    await logActivity(req.user.id, 'Updated profile');

    res.status(200).json({ message: 'Profile updated', teacher: updatedTeacher });
  } catch (err) {
    console.error('Error updating teacher profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Courses and Students
const getAssignedCourses = async (req, res) => {
  try {
    console.log(`Fetching assigned courses for teacher ID: ${req.user.id}`);

    const teacher = await Teacher.findById(req.user.id).populate({
      path: 'assignedCourses.course',
      model: 'Course',
      select: 'title code unit status',
    });

    if (!teacher) {
      console.warn('Teacher not found');
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Profile completion check
    const requiredFields = [
      'title',
      'firstName',
      'lastName',
      'phoneNumber',
      'age',
      'gender',
      'department',
      'nationality',
      'stateOfOrigin',
      'dateOfBirth',
      'address',
      'maritalStatus',
    ];

    const missingFields = requiredFields.filter(
      (field) =>
        teacher[field] === null ||
        teacher[field] === undefined ||
        teacher[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before accessing this feature',
        missingFields,
      });
    }

    console.log('Raw assignedCourses:', teacher.assignedCourses);

    const assignedCourses = teacher.assignedCourses
      .filter((ac) => ac.course)
      .map((ac) => {
        const courseInfo = {
          _id: ac.course._id,
          title: ac.course.title,
          code: ac.course.code,
          unit: ac.course.unit,
          status: ac.course.status || 'Pending',
          department: ac.department,
          level: ac.level,
          semester: ac.semester,
        };

        console.log('Processed assigned course:', courseInfo);
        return courseInfo;
      });

    console.log(`Total assigned courses found: ${assignedCourses.length}`);

    return res.status(200).json(assignedCourses);
  } catch (err) {
    console.error('Error fetching assigned courses:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getMyStudents = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const courseIds = teacher.assignedCourses.map((ac) => ac.course.toString());
    console.log(`Course IDs assigned to teacher:`, courseIds);

    const students = await Student.find({
      'courses.course': { $in: courseIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .populate('courses.course', 'title code')
      .select('firstname lastname studentId courses level department');

    console.log(`Total students found: ${students.length}`);

    students.forEach((student) => {
      const enrolledCourses = student.courses
        .filter((c) => courseIds.includes(c.course._id.toString()))
        .map((c) => `${c.course.title} (${c.course.code})`)
        .join(', ');

      console.log(
        `Student: ${student.firstname} ${student.lastname}, ID: ${student.studentId}, Courses: ${enrolledCourses}`
      );
    });

    return res.json({ students });
  } catch (err) {
    console.error('Error fetching students:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log('Forgot password request for teacher email:', email);

  try {
    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      console.warn('Teacher not found for email:', email);
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000);
    teacher.resetCode = code;
    teacher.resetCodeExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
    await teacher.save();

    const fullName = `${teacher.title} ${teacher.firstName} ${teacher.lastName}`;
    await sendPasswordResetEmail(email, fullName, code);

    console.log(`Reset code sent to teacher ${email}`);
    res.json({ message: 'Password reset code sent' });
  } catch (err) {
    console.error('Forgot password error for teacher:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, code, and new password are required' });
  }

  console.log('Reset password request for teacher:', email, 'with code:', code);

  try {
    const teacher = await Teacher.findOne({
      email,
      resetCodeExpiry: { $gt: Date.now() },
    });

    if (!teacher || teacher.resetCode.toString() !== code.toString()) {
      console.warn('Invalid or expired reset code for teacher:', email);
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    teacher.password = await bcrypt.hash(newPassword, saltRounds);
    teacher.resetCode = undefined;
    teacher.resetCodeExpiry = undefined;
    await teacher.save();

    console.log('Password reset successful for teacher:', email);
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Password reset error for teacher:', email, err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify Reset Code
const verifyCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and code are required' });
  }

  console.log(`Verifying reset code for teacher: ${email}`);

  try {
    const teacher = await Teacher.findOne({
      email,
      resetCodeExpiry: { $gt: Date.now() },
    });

    if (!teacher || teacher.resetCode.toString() !== code.toString()) {
      console.warn('Invalid or expired code for teacher:', email);
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    console.log('Code verified successfully for teacher:', email);
    res.json({ message: 'Code verified successfully' });
  } catch (err) {
    console.error('Code verification error for teacher:', email, err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Change Password (authenticated)
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' });
  }

  console.log('Change password request for teacher id:', req.user?.id);

  try {
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    const isMatch = await bcrypt.compare(currentPassword, teacher.password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });

    teacher.password = await bcrypt.hash(newPassword, saltRounds);
    await teacher.save();

    console.log('Password changed successfully for teacher:', teacher.email);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error for teacher id:', req.user?.id, err);
    res.status(500).json({ message: 'Server error' });
  }
};


// Upload profile photo
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file?.path) return res.status(400).json({ message: "No image file uploaded." });

    const teacher = await Teacher.findById(req.user.id);
    console.log(`Uploading profile photo for: ${req.user.id}`);
    const upload = await cloudinary.uploader.upload(req.file.path);
    teacher.profilePhoto = upload.secure_url;
    await teacher.save();

    await logActivity(teacher._id, 'Uploaded profile photo');
    console.log(`Upload URL: ${teacher.profilePhoto}`);
    res.json({ message: 'Profile photo updated', url: teacher.profilePhoto });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// View students with search & pagination
const viewStudents = async (req, res) => {
  const { name = '', page = 1, limit = 10 } = req.query;
  try {
    console.log(`Viewing students - Teacher: ${req.user.id}, Search: ${name}, Page: ${page}, Limit: ${limit}`);
    const teacher = await Teacher.findById(req.user.id);
    const students = await Student.find({
      course: teacher.course,
      firstname: { $regex: name, $options: 'i' }
    })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    await logActivity(req.user.id, 'Viewed student list');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Feedback
const sendFeedback = async (req, res) => {
  const { subject, message } = req.body;
  try {
    console.log(`Feedback submitted by: ${req.user.id} | Subject: ${subject}`);
    await sendTeacherFeedbackNotice(req.user.id, subject, message);
    await logActivity(req.user.id, 'Submitted feedback');
    res.json({ message: 'Feedback submitted to admin' });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get recent activity logs
const getActivityLogs = async (req, res) => {
  try {
    console.log(`Fetching activity logs for teacher: ${req.user.id}`);

    const logs = await TeacherActivity.find({ teacher: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10); // Latest 10 logs

    const formatted = logs.map(log => ({
      message: log.action,
      timestamp: log.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Log a new activity
const logActivity = async (teacherId, action) => {
  try {
    console.log(`Activity logged - Teacher: ${teacherId}, Action: ${action}`);
    await TeacherActivity.create({ teacher: teacherId, action });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};




const getDashboardStats = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    console.log("Fetching dashboard stats for teacher:", teacher._id);

    const courseIds = (teacher.assignedCourses || [])
      .map(ac => ac.course)
      .filter(id => mongoose.Types.ObjectId.isValid(id));

    const totalClasses = await Course.countDocuments({
      _id: { $in: courseIds }
    });

    const totalStudents = await Student.countDocuments({
      courses: { $elemMatch: { course: { $in: courseIds } } }
    });

    const submittedAssignments = await AssignmentSubmission.countDocuments({
      teacherId: teacher._id
    });

    console.log("teacherId:", teacher.teacherId);
    console.log("department:", teacher.department);
    console.log("totalClasses:", totalClasses);
    console.log("totalStudents:", totalStudents);
    console.log("submittedAssignments:", submittedAssignments);

    return res.json({
      teacherId: teacher.teacherId || "N/A",
      department: teacher.department || "N/A",
      totalClasses,
      totalStudents,
      submittedAssignments
    });
    
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getTeacherNotifications = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const notifications = await Notification.find({
      recipientModel: 'Teacher',
      recipient: teacherId   
    }).sort({ createdAt: -1 });

    res.status(200).json({ notifications });
  } catch (err) {
    console.error("Get Teacher Notifications Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


 const markTeacherNotificationsAsRead = async (req, res) => {
  try {
    const teacherId = req.user.id;

    await Notification.updateMany({
      $or: [
        { recipient: null },
        { recipient: teacherId, recipientModel: 'Teacher' }
      ],
      isRead: false
    }, { isRead: true });

    res.status(200).json({ message: 'Notifications marked as read' });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const submitResults = async (req, res) => {
  try {
    const { results } = req.body;
    const { courseId } = req.params;
    const teacherId = req.user.id;

    console.log('Incoming request to submit results');
    console.log('Teacher ID:', teacherId);
    console.log('Course ID:', courseId);
    console.log('Results payload:', results);

    if (!courseId || !results || !Array.isArray(results)) {
      return res.status(400).json({ message: 'Missing or invalid data' });
    }

    // Fetch teacher details
    const teacher = await Teacher.findById(teacherId).select('firstName lastName title');
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }



    // Fetch course to get code
    const course = await Course.findById(courseId).select('code');
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const savedResults = [];
    const updatedResults = [];
    const newResults = [];

    for (const result of results) {
      const {
        studentId,
        grade,
        point,
        score,
        semester,
        unit,
        session,
        code
      } = result;

      const student = await Student.findById(studentId);
      if (!student) continue;

      const level = student.level;
      const fallbackSession = student.session || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
      const finalSession = session || fallbackSession;

      const existing = await Result.findOne({
        student: studentId,
        course: courseId,
        teacher: teacherId,
      });

      if (existing) {
        existing.grade = grade;
        existing.point = point;
        existing.score = score;
        existing.semester = semester;
        existing.unit = unit;
        existing.level = level;
        existing.session = finalSession;
        existing.code = code;
        existing.status = 'Pending';

        await existing.save();
        savedResults.push(existing);
        updatedResults.push(existing);
      } else {
        const newResult = new Result({
          student: studentId,
          teacher: teacherId,
          course: courseId,
          grade,
          point,
          score,
          semester,
          unit,
          level,
          session: finalSession,
          code,
          status: 'Pending',
        });

        await newResult.save();
        savedResults.push(newResult);
        newResults.push(newResult);
      }
    }

    // Notify Admin with course code and teacher name
    if (newResults.length > 0 || updatedResults.length > 0) {
      await sendNotification({
        message: ` ${teacher.title || ''} ${teacher.firstName} ${teacher.lastName} submitted ${newResults.length} new and updated ${updatedResults.length} result(s) for course ${course.code}.`,
        type: 'info',
        recipientModel: 'Admin',
      });
    }

    res.status(201).json({
      message: 'Results submitted successfully',
      results: savedResults,
      new: newResults.length,
      updated: updatedResults.length,
    });

  } catch (err) {
    console.error(' Error submitting results:', err);
    res.status(500).json({ message: 'Server error submitting results' });
  }
};

const getSubmittedResults = async (req, res) => {
  try {
    const { courseId } = req.params;
    const teacherId = req.user.id;

    console.log('Fetching submitted results...');
    console.log('Teacher ID:', teacherId);
    console.log('Course ID:', courseId);

    // Fetch teacher first
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

   
    // Fetch submitted results
    const results = await Result.find({ course: courseId, teacher: teacherId })
      .populate('student', 'firstname lastname studentId level department')
      .sort({ createdAt: -1 });

    if (!results.length) {
      console.warn('No results found for this course and teacher');
      return res.status(404).json({ message: 'No submitted results found.' });
    }

    console.log(`Fetched ${results.length} submitted result(s)`);
    return res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching submitted results:', err);
    return res.status(500).json({ message: 'Server error fetching submitted results' });
  }
};

const getStudentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const teacher = await Teacher.findById(req.user.id);

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
   

    const isAssigned = teacher.assignedCourses.some(
      (ac) => ac.course.toString() === courseId
    );

    if (!isAssigned) {
      return res.status(403).json({ message: 'Course not assigned to this teacher' });
    }

    const students = await Student.find({
      'courses.course': new mongoose.Types.ObjectId(courseId),
    })
      .populate('courses.course', 'name code')
      .select('firstname lastname studentId courses level department');

    console.log(`Found ${students.length} students for course ${courseId}`);

    return res.json(students);
  } catch (err) {
    console.error('Error fetching students by course:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


const giveAssignments = async (req, res) => {
  const { title, description, deadline } = req.body;
  const { courseId } = req.params;
  const teacherId = req.user.id;

  console.log("Received assignment creation request");
  console.log("Title:", title);
  console.log("Description:", description);
  console.log("Deadline:", deadline);
  console.log("Course ID:", courseId);

  if (!title || !description || !deadline || !courseId) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    // Profile completion check
    const requiredFields = [
      'title',
      'firstName',
      'lastName',
      'phoneNumber',
      'age',
      'gender',
      'department',
      'nationality',
      'stateOfOrigin',
      'dateOfBirth',
      'address',
      'maritalStatus',
    ];
    const missingFields = requiredFields.filter(
      (field) =>
        teacher[field] === null ||
        teacher[field] === undefined ||
        teacher[field].toString().trim() === ''
    );
    if (missingFields.length > 0) {
      return res.status(403).json({
        message: 'Complete your profile before accessing this feature',
        missingFields,
      });
    }

    const course = await Course.findById(courseId).select("title code");
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    // Check if teacher is assigned to this course
    const isAssigned = teacher.assignedCourses?.some(
      (ac) => ac.course.toString() === courseId.toString()
    );
    if (!isAssigned) {
      console.warn("Unauthorized course access attempt by teacher:", teacherId);
      return res.status(403).json({ message: 'You are not authorized to assign to this course.' });
    }

    const fileUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const newAssignment = new Assignment({
      title,
      description,
      deadline: new Date(deadline),
      fileUrls,
      course: courseId,
      teacherId,
    });

    await newAssignment.save();

    // Fetch students enrolled in the course
    const students = await Student.find({ 'courses.course': courseId })
      .select('_id email firstname lastname');

    for (const student of students) {
      const fullName = `${student.firstname || ""} ${student.lastname || ""}`.trim() || "Student";

      // Send notification
      await sendNotification({
        message: `New assignment titled "${title}" has been posted for your course "${course.title}".`,
        type: 'info',
        recipient: student._id,
        recipientModel: 'Student'
      });

      // Send email
      if (student.email) {
        await sendNewAssignmentEmail(
          student.email,
          fullName,
          course.title,
          course.code,
          title,
          deadline
        );
      }
    }

    return res.status(201).json({
      message: 'Assignment created successfully',
      assignment: newAssignment,
    });

  } catch (err) {
    console.error("Error creating assignment:", err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getAssignmentsByCourse = async (req, res) => {
  const { courseId } = req.params;
  const teacherId = req.user.id;

  console.log(`Fetching assignments for Course ID: ${courseId} by Teacher ID: ${teacherId}`);

  try {
    const teacher = await Teacher.findById(teacherId);

    const isAssigned = teacher?.assignedCourses?.some(ac =>
      ac.course.toString() === courseId.toString()
    );

    if (!isAssigned) {
      console.warn(`Unauthorized access attempt to course ${courseId} by teacher ${teacherId}`);
      return res.status(403).json({ message: 'Unauthorized access to course' });
    }

    const assignments = await Assignment.find({ course: courseId, teacherId }).sort({ createdAt: -1 });

    console.log(`Found ${assignments.length} assignments for course ${courseId}`);
    res.status(200).json(assignments);

  } catch (err) {
    console.error("Error fetching assignments:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateAssignment = async (req, res) => {
  const { assignmentId } = req.params;
  const { title, description, deadline } = req.body;
  const teacherId = req.user.id;

  console.log(`Received update request for Assignment ID: ${assignmentId}`);
  console.log("Teacher ID:", teacherId);
  console.log("New title:", title);
  console.log("New description:", description);
  console.log("New deadline:", deadline);

  try {
    const assignment = await Assignment.findOne({ _id: assignmentId, teacherId });

    if (!assignment) {
      console.log(`Assignment not found or not owned by teacher ${teacherId}`);
      return res.status(404).json({ message: 'Assignment not found or unauthorized' });
    }

    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (deadline) assignment.deadline = new Date(deadline);

    if (req.files && req.files.length > 0) {
      const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
      assignment.fileUrls = fileUrls;
      console.log("Updated file URLs:", fileUrls);
    }

    await assignment.save();
    console.log("Assignment updated successfully:", assignment._id);

    // Notify enrolled students about the update
    const students = await Student.find({ 'courses.course': assignment.course }).select('_id');
    const notifications = students.map(student => ({
      type: 'info',
      message: `The assignment "${assignment.title}" has been updated.`,
      recipientModel: 'Student',
      recipientId: student._id,
      
    }));

    await Promise.all(notifications.map(n => sendNotification(n)));

    res.status(200).json({ message: 'Assignment updated', assignment });

  } catch (err) {
    console.error("Error updating assignment:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteAssignment = async (req, res) => {
  const { assignmentId } = req.params;
  const teacherId = req.user.id;

  try {
    const assignment = await Assignment.findOne({ _id: assignmentId, teacherId });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found or unauthorized' });
    }

    // Optional: delete associated submissions
    await AssignmentSubmission.deleteMany({ assignmentId: assignment._id });

    // Delete the assignment itself
    await Assignment.deleteOne({ _id: assignmentId });

    console.log(`Assignment ${assignmentId} deleted by teacher ${teacherId}`);
    res.status(200).json({ message: 'Assignment deleted successfully' });

  } catch (err) {
    console.error('Error deleting assignment:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};



// Get Submissions for an Assignment
const getSubmissionsForAssignment = async (req, res) => {
  const { assignmentId } = req.params;
  const teacherId = req.user.id;

  try {
    const assignment = await Assignment.findOne({ _id: assignmentId, teacherId });
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found or unauthorized' });
    }

    const submissions = await AssignmentSubmission.find({ assignmentId })
      .populate('studentId', 'firstname lastname level department')
      .sort({ submittedAt: -1 });

    res.status(200).json({ submissions });
  } catch (err) {
    console.error('[GET SUBMISSIONS] Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Submit/Update Grade
const submitGrade = async (req, res) => {
  const { submissionId } = req.params;
  const { score } = req.body;
  const teacherId = req.user.id;

  if (score === undefined || score < 0 || score > 100) {
    return res.status(400).json({ message: 'Score must be between 0 and 100' });
  }

  try {
    const submission = await AssignmentSubmission.findById(submissionId);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    const assignment = await Assignment.findById(submission.assignmentId);
    if (!assignment || assignment.teacherId.toString() !== teacherId) {
      return res.status(403).json({ message: 'Unauthorized to grade this submission' });
    }

    submission.score = score;
    await submission.save();

    // Notify student in-app
    await sendNotification({
      type: 'success',
      message: `Your submission for "${assignment.title}" has been graded.`,
      recipientModel: 'Student',
      recipientId: submission.studentId,
    });

    // Send email
    const student = await Student.findById(submission.studentId).select('firstname lastname email');
    if (student?.email) {
      await sendGradeNotificationEmail(
        student.email,
        `${student.firstname} ${student.lastname}`,
        assignment.title,
        score
      );
    }

    res.status(200).json({ message: 'Score submitted', submission });
  } catch (err) {
    console.error('[SUBMIT GRADE] Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};



const getAllStudentSubmissionsToTeacher = async (req, res) => {
  const teacherId = req.user.id;

  console.log(`[GET ALL SUBMISSIONS] Requested by teacher ID: ${teacherId}`);

  try {
    // Step 1: Find all assignments created by this teacher
    const teacherAssignments = await Assignment.find({ teacherId }, '_id title course');

    if (!teacherAssignments.length) {
      console.log(`[GET ALL SUBMISSIONS] No assignments found for teacher ID: ${teacherId}`);
      return res.status(200).json({ totalSubmissions: 0, submissions: [] });
    }

    const assignmentIds = teacherAssignments.map(a => a._id);
    console.log(`[GET ALL SUBMISSIONS] Found ${assignmentIds.length} assignments.`);

    // Step 2: Find all submissions for those assignments
    const submissions = await AssignmentSubmission.find({ assignmentId: { $in: assignmentIds } })
      .populate('studentId', 'firstname lastname department level')
      .populate('assignmentId', 'title deadline')
      .sort({ submittedAt: -1 });

    console.log(`[GET ALL SUBMISSIONS] Found ${submissions.length} submissions for teacher.`);

    // Step 3: Format and return the results
    const result = submissions.map(sub => ({
      submissionId: sub._id,
      assignmentTitle: sub.assignmentId?.title,
      deadline: sub.assignmentId?.deadline,
      submittedAt: sub.submittedAt,
      score: sub.score || null,
      student: {
        id: sub.studentId?._id,
        name: `${sub.studentId?.firstname} ${sub.studentId?.lastname}`,
        department: sub.studentId?.department,
        level: sub.studentId?.level
      }
    }));

    res.status(200).json({
      totalSubmissions: result.length,
      submissions: result
    });

  } catch (err) {
    console.error('[GET ALL SUBMISSIONS] Error occurred:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Teacher → Admin
const sendMessageToAdmin = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const teacher = await Teacher.findById(teacherId).select("title firstName lastName email");
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const message = new Message({
      sender: `Teacher-${teacher._id}`,
      recipient: "Admin",
      senderId: teacher._id,
      text,
      timestamp: new Date(),
      receiverType: "Admin",
      isRead: false,
    });

    await message.save();

    const teacherFullName = `${teacher.title} ${teacher.firstName} ${teacher.lastName}`;

    // Email notification to admin
    await sendTeacherMessageNotificationToAdmin(teacherFullName, text);

    // In-app notification to admin
    await sendNotification({
      message: `New message from ${teacherFullName}`,
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


// Admin → Teacher
const getMessagesBetweenTeacherAndAdmin = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const messages = await Message.find({
      $or: [
        { sender: `Teacher-${teacherId}`, recipient: "Admin" },
        { sender: "Admin", recipient: `Teacher-${teacherId}` },
      ],
    }).sort({ timestamp: 1 });

    // Mark unread Admin → Teacher messages as read
    await Message.updateMany(
      {
        sender: "Admin",
        recipient: `Teacher-${teacherId}`,
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages between teacher and admin:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Teacher → Student
const sendMessageToStudent = async (req, res) => {
  try {
    const { studentId, text } = req.body;
    const teacherId = req.user.id;

    if (!text || !studentId) {
      return res.status(400).json({ message: "Student and text are required" });
    }

    const student = await Student.findById(studentId).select("firstName lastName email");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const teacher = await Teacher.findById(teacherId).select("title firstName lastName email");
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const message = new Message({
      sender: `Teacher-${teacherId}`,
      recipient: `Student-${student._id}`,
      teacherId,
      studentId,
      text,
      timestamp: new Date(),
      isRead: false,
    });

    await message.save();

    const teacherFullName = ` ${teacher.title} ${teacher.firstName} ${teacher.lastName}`;

    // Email notification to student
    await sendTeacherMessageNotificationToStudent(
      student.email,
     teacherFullName,
      text
    );

    // In-app notification to student
    await sendNotification({
      message: `New message from ${teacherFullName}`,
      type: "info",
      recipientModel: "Student",
      recipientId: student._id
    });

    return res.status(200).json(message);
  } catch (error) {
    console.error("Error sending message to student:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


// Admin → all Teachers (no marking needed)
const getMessageFromAdmin = async (req, res) => {
  try {
    const messages = await Message.find({ recipient: { $regex: /^Teacher-/ } })
      .sort({ timestamp: 1 })
      .lean();

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages from Admin:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Messages between Teacher ↔ Student
const getMessagesFromTeacherToStudent = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { studentId } = req.query;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    const messages = await Message.find({
      $or: [
        { sender: `Teacher-${teacherId}`, recipient: `Student-${studentId}` },
        { sender: `Student-${studentId}`, recipient: `Teacher-${teacherId}` },
      ],
    })
      .populate("studentId", "firstname lastname")
      .populate("teacherId", "firstName lastName")
      .sort({ timestamp: 1 });

    await Message.updateMany(
      {
        sender: `Student-${studentId}`,
        recipient: `Teacher-${teacherId}`,
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching teacher-student messages:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Unread message counts
const getUnreadCounts = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Admin → Teacher
    const unreadFromAdmin = await Message.countDocuments({
      recipient: `Teacher-${teacherId}`,
      sender: 'Admin',
      isRead: false,
    });

    // Student → Teacher
    const studentMessages = await Message.aggregate([
      {
        $match: {
          recipient: `Teacher-${teacherId}`,
          isRead: false,
          sender: { $regex: '^Student-' },
        },
      },
      {
        $group: {
          _id: '$senderId',
          count: { $sum: 1 },
        },
      },
    ]);

    const studentCounts = {};
    studentMessages.forEach((msg) => {
      studentCounts[msg._id.toString()] = msg.count;
    });

    res.json({
      admin: unreadFromAdmin,
      students: studentCounts,
    });
  } catch (err) {
    console.error("Error getting unread message counts:", err);
    res.status(500).json({ message: "Server error" });
  }
};



const getTeacherStudentMessages = async (req, res) => {
  console.log("Fetching messages between teacher and student");

  try {
    const { studentId } = req.query;
    const teacherId = req.user.id;

    // Convert string IDs to ObjectId
    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);

    const messages = await Message.find({
      $or: [
        { teacherId: teacherObjectId, studentId: studentObjectId },
        { teacherId: teacherObjectId, recipient: `Student-${studentId}` },
      ],
    })
      .populate("studentId", "firstname lastname")
      .sort({ timestamp: 1 });

    console.log(`Found ${messages.length} messages`);
    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching teacher-student messages:", error);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
};


const editMessage = async (req, res) => {
  console.log("Request to edit message");

  try {
    const { id } = req.params;
    const { newText } = req.body;

    if (!newText?.trim()) {
      console.log("Invalid or empty new text");
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
    return res.status(200).json(message);
  } catch (error) {
    console.error("Error editing message:", error);
    return res.status(500).json({ message: "Server error editing message" });
  }
};

const deleteMessage = async (req, res) => {
  console.log("Request to delete message");

  try {
    const { id } = req.params;

    const deleted = await Message.findByIdAndDelete(id);

    if (!deleted) {
      console.log("Message not found for deletion");
      return res.status(404).json({ message: "Message not found" });
    }

    console.log("Message deleted successfully");
    return res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ message: "Server error deleting message" });
  }
};



module.exports = {
  
  sendNotification,
  registerTeacher,
  loginTeacher,
  getTeacherProfile,
  updateTeacherProfile,
  getAssignedCourses,
  getMyStudents,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyCode,
  uploadProfilePhoto,
  viewStudents,
  sendFeedback,
  getActivityLogs,
  getTeacherNotifications,
  getDashboardStats,
  markTeacherNotificationsAsRead,
submitResults,
 
  getStudentsByCourse,
  getSubmittedResults,
giveAssignments,
getAssignmentsByCourse,
updateAssignment,
getSubmissionsForAssignment,
deleteAssignment,
submitGrade,
getAllStudentSubmissionsToTeacher,
sendMessageToAdmin,
sendMessageToStudent,
deleteMessage,
editMessage,
getMessageFromAdmin,
getTeacherStudentMessages,
getMessagesFromTeacherToStudent,
getMessagesBetweenTeacherAndAdmin ,
getUnreadCounts
};
