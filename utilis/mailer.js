const nodemailer = require('nodemailer');

// Environment variables
const emailUser = process.env.USER_EMAIL;
const emailPass = process.env.USER_PASS;
const adminEmail = process.env.USER_EMAIL || emailUser;

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

// Base styles used in emails
const baseStyles = `
  body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px; color: #333; }
  .container { max-width: 600px; margin: auto; background: #fff; padding: 30px; border-radius: 8px; }
  .logo { display: block; margin: 0 auto 20px auto; width: 100px; }
  h2 { color: #1a73e8; text-align: center; }
  p { font-size: 16px; line-height: 1.5; text-align: center; }
  .footer { max-width: 600px; margin: 20px auto 0 auto; font-size: 13px; color: #777; text-align: center; }
  .footer a { color: #1a73e8; text-decoration: none; }
  .highlight { color: #1a73e8; font-weight: bold; }
`;

// Wrapper for consistent HTML formatting
const wrapHtml = (bodyContent) => `
  <html>
    <head><style>${baseStyles}</style></head>
    <body>
      <div class="container">
        <img class="logo" src="https://yourdomain.com/assets/logo.png" alt="SOF College of Engineering" />
        ${bodyContent}
      </div>
      <div class="footer">
        <p>SOF College of Engineering • Ologuneru Road • Ibadan, Nigeria</p>
        <p>Need help? <a href="mailto:support@sofcollege.edu.ng">Contact Support</a></p>
        <p>&copy; ${new Date().getFullYear()} SOF College of Engineering. All rights reserved.</p>
      </div>
    </body>
  </html>
`;

// Generic send email function
const sendEmail = async (to, subject, plainText, htmlContent, options = {}) => {
  const mailOptions = {
    from: `"SOF College of Engineering" <${emailUser}>`,
    to,
    subject,
    text: plainText,
    html: wrapHtml(htmlContent), 
    ...options
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}:`, info.messageId);
    return info;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    return null;
  }
};


// Specific mail functions
const sendMail = (email, firstname, studentId) => {
  return sendEmail(
    email,
    'Welcome to SOF College of Engineering',
    `Hello ${firstname},\n\nYour Student ID is: ${studentId}\n\nWelcome aboard!\n\nSOF College of Engineering Team`,
    `<h2>Welcome to SOF College of Engineering, ${firstname}!</h2>
     <p>It's a great pleasure to have you on board.</p>
     <p><strong>Your Student ID:</strong> <span class="highlight">${studentId}</span></p>
     <p>Please keep it safe — you'll need it for logging in and accessing resources.</p>
     <a href="https://your-portal-link.com" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">Visit Student Portal</a>
     <p style="margin-top: 30px;">Best regards,<br/><strong>SOF College of Engineering Team</strong></p>`
  );
};

const sendSuperAdminMail = (email, fullName) => {
  return sendEmail(
    email,
    'Welcome to SOF College of Engineering – Super Admin Access Granted',
    `Hello ${fullName},\n\nYou have been granted Super Admin access with full ownership privileges.\n\nLogin here: https://admin.sofcollege.edu.ng/login`,
    `<h2>Welcome, ${fullName}</h2>
     <p>You are now the Super Admin of SOF College of Engineering.</p>
     <p><strong>Full access</strong> to manage operations and infrastructure has been granted.</p>
     <a href="https://admin.sofcollege.edu.ng/login" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">Access Admin Panel</a>
     <p style="margin-top:30px;"><strong>Leadership begins with vision. Yours is now at the helm.</strong></p>`
  );
};

const sendTeacherWelcomeEmail = (email, title, fullName) => {
  return sendEmail(
    email,
    'Welcome to SOF College of Engineering – Registration Received',
    `Hello ${title} ${fullName},\n\nYour staff registration has been received and is under review.`,
    `<h2>Welcome to SOF College of Engineering, ${title} ${fullName}!</h2>
     <p>Your staff account is pending approval from the School Administration.</p>
     <p>We’re excited to have you on board.</p>`
  );
};

const sendNewTeacherNotificationToAdmin = (teacherFullName, department) => {
  return sendEmail(
    adminEmail,
    'New Staff Registration Pending Approval',
    `New Staff registered: ${teacherFullName} – ${department}`,
    `<h2>New Staff Registration Alert</h2>
     <p>A new Staff has submitted a registration request:</p>
     <p><strong>Name:</strong> ${teacherFullName}<br/><strong>Department:</strong> ${department}</p>
     <p>Please review and approve this registration.</p>`
  );
};

const sendTeacherApprovalEmail = (email, title, fullName, teacherId) => {
  return sendEmail(
    email,
    'Your Staff Registration Has Been Approved',
    `Hello ${title} ${fullName},\n\nYour registration has been approved. Your Teacher ID: ${teacherId}`,
    `<h2>Your Account Has Been Approved</h2>
     <p>Welcome, <strong>${title} ${fullName}</strong>!</p>
     <p>Your registration has been approved. Your Staff ID is <span class="highlight">${teacherId}</span>.</p>
     <a href="https://portal.sofcollege.edu.ng/login" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#28a745; color:white; text-decoration:none; border-radius:5px;">Login to Portal</a>`
  );
};

const sendCourseRegistrationMail = (fullName, semester, department, level) => {
  return sendEmail(
    adminEmail,
    'New Course Registration Submitted',
    `Hello Admin,\n\n${fullName}, a student of ${department}, ${level} level, has submitted their course registration for the ${semester}. The submission is awaiting your approval.\n\nPlease log in to the admin portal to review and approve the request.`,
    `<h2>New Course Registration Submitted</h2>
     <p>Hello Admin,</p>
     <p><strong>${fullName}</strong>, a student of <strong>${department}</strong>, <strong>${level} level</strong>, has submitted their course registration for the <strong>${semester}</strong>.</p>
     <p><em>This submission is awaiting your approval.</em></p>
     <a href="https://admin.sofcollege.edu.ng/courses/approvals" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
       Review Course Registration
     </a>`
  );
};

const sendCourseApprovalMail = (email, fullName, semester) => {
  return sendEmail(
    email,
    'Course Registration Approved',
    `Hello ${fullName},\n\nYour course registration for ${semester} has been approved.`,
    `<h2>Course Registration Approved</h2>
     <p>Dear <strong>${fullName}</strong>, your registration for <strong>${semester}</strong> has been approved. You can now access your courses.</p>`
  );
};

const sendTuitionPaymentToAdmin = (fullName, amount, method, department, session) => {
  return sendEmail(
    adminEmail,
    'Tuition Payment Notification',
    `${fullName} made a payment of ₦${amount} via ${method}.`,
    `<h2>Tuition Payment Received</h2>
     <p><strong>${fullName}</strong>, a student of <strong>${department}</strong> (Session: <strong>${session}</strong>), paid <strong>₦${amount}</strong> via <strong>${method}</strong>. Please verify the transaction in the administration portal.</p>
     <p><a href="https://your-admin-portal.com/payments">Verify in Admin Portal</a></p>`
  );
};

const sendTuitionPaymentApproved = (email, fullName, amount, session, level) => {
  return sendEmail(
    email,
    'Tuition Payment Verified',
    `Hi ${fullName}, your tuition payment of ₦${amount} for the ${session} session (${level} Level) has been verified.`,
    `<h2>Payment Verified</h2>
     <p>Dear <strong>${fullName}</strong>,</p>
     <p>Your tuition payment of <strong>₦${amount}</strong> for the <strong>${session}</strong> session (<strong>Level ${level}</strong>) has been successfully verified.</p>
     <p>You now have full access to your student resources.</p>
     <p>Thank you for your payment.</p>`
  );
};

const sendLevelChangeNotification = (email, fullName, newLevel, newSession) => {
  return sendEmail(
    email,
    'Academic Level Updated',
    `Hi ${fullName}, your academic level has been updated to ${newLevel}.`,
    `<h2>Level Advancement</h2>
     <p>Congratulations <strong>${fullName}</strong>,</p>
     <p>We’re pleased to inform you that your academic level has been successfully updated to <strong>${newLevel} Level</strong>, <strong>${newSession}</strong>.</p>
     <p>Please ensure your tuition payment is complete for this level to maintain access to all academic resources.</p>
     <p>Thank you.</p>`
  );
};

const sendDepartmentChangeMail = (email, fullName, newDepartment) => {
  return sendEmail(
    email,
    'Department Change Confirmation',
    `Hi ${fullName}, your department has been updated to ${newDepartment}.`,
    `<h2>Department Change</h2>
     <p>Dear <strong>${fullName}</strong>,</p>
     <p>This is to notify you that your department has been changed to <strong>${newDepartment}</strong>.</p>
     <p>If this update was not initiated by you, please contact the academic office immediately.</p>
     <p>Best regards,<br/>Academic Affairs</p>`
  );
};

const sendGeneralFeeUpdateMail = (emailList) => {
  const subject = 'Tuition/Fee Update Notification';
  const plainText = `Dear Student,\n\nThe tuition/fee structure has been updated. Please log in to your portal to review.`;
  const htmlContent = `
    <h2>Tuition/Fee Update Notification</h2>
    <p>The school's tuition or fee structure has been updated.</p>
    <p>Please <a href="https://your-school-portal.com/login">log in</a> to review the latest information.</p>
  `;

  return Promise.all(
    emailList.map(email => sendEmail(email, subject, plainText, htmlContent))
  );
};

const sendNewAssignmentEmail = (studentEmail, studentName, courseTitle, courseCode, assignmentTitle, deadline) => {
  return sendEmail(
    studentEmail,
    `New Assignment Posted: ${assignmentTitle} (${courseCode})`,
    `Hello ${studentName},\n\nA new assignment titled "${assignmentTitle}" has been posted for your course: ${courseTitle} (${courseCode}).\n\nDeadline: ${new Date(deadline).toLocaleString()}\n\nPlease log in to your student portal to view and submit before the deadline.\n\nBest regards,\nSOF College of Engineering`,
    `<h2>New Assignment Alert</h2>
     <p>Hello <strong>${studentName}</strong>,</p>
     <p>A new assignment has been posted for your course <strong>${courseTitle} (${courseCode})</strong>.</p>
     <p><strong>Title:</strong> ${assignmentTitle}</p>
     <p><strong>Deadline:</strong> ${new Date(deadline).toLocaleString()}</p>
     <a href="https://student.sofcollege.edu.ng/assignments" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
        View Assignment
     </a>
     <p style="margin-top:30px;">Please make sure to submit your work before the deadline.</p>
     <p>Best regards,<br/><strong>SOF College of Engineering</strong></p>`
  );
};

const sendGradeNotificationEmail = (studentEmail, studentName, assignmentTitle, score) => {
  return sendEmail(
    studentEmail,
    `Your Assignment Has Been Graded: ${assignmentTitle}`,
    `Hello ${studentName},\n\nYour submission for "${assignmentTitle}" has been graded.\nScore: ${score}/100\n\nPlease log in to your student portal to view full details.\n\nBest regards,\nSOF College of Engineering`,
    `<h2>Assignment Graded</h2>
     <p>Hello <strong>${studentName}</strong>,</p>
     <p>Your submission for the assignment <strong>${assignmentTitle}</strong> has been graded.</p>
     <p><strong>Score:</strong> <span class="highlight">${score}/100</span></p>
     <a href="https://student.sofcollege.edu.ng/grades" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#28a745; color:white; text-decoration:none; border-radius:5px;">
        View Grade
     </a>
     <p style="margin-top:30px;">Keep up the good work!</p>
     <p>Best regards,<br/><strong>SOF College of Engineering</strong></p>`
  );
};

const sendAssignmentSubmissionEmail = (teacherEmail, teacherName, studentName, assignmentTitle) => {
  return sendEmail(
    teacherEmail,
    `New Assignment Submission: ${assignmentTitle}`,
    `Hello ${teacherName},\n\n${studentName} has submitted their work for the assignment "${assignmentTitle}".\n\nPlease log in to your teacher portal to review the submission.\n\nBest regards,\nSOF College of Engineering`,
    `<h2>New Assignment Submission</h2>
     <p>Hello <strong>${teacherName}</strong>,</p>
     <p><strong>${studentName}</strong> has submitted their work for the assignment <strong>${assignmentTitle}</strong>.</p>
     <a href="https://teacher.sofcollege.edu.ng/assignments/submissions" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
        Review Submission
     </a>
     <p style="margin-top:30px;">Please review and provide grading/feedback at your earliest convenience.</p>
     <p>Best regards,<br/><strong>SOF College of Engineering</strong></p>`
  );
};




const sendTeacherMessageNotificationToAdmin = (teacherFullName, messagePreview) => {
  return sendEmail(
    adminEmail,
    'New Message from Teacher',
    `Hello Admin,\n\nYou have received a new message from ${teacherFullName}.\n\nPreview:\n${messagePreview}\n\nLog in to your admin portal to read and reply.`,
    `<h2>New Message from Teacher</h2>
     <p>Hello Admin,</p>
     <p>You have received a new message from <strong>${teacherFullName}</strong>.</p>
     <blockquote style="background:#f4f4f4; padding:10px; border-left:4px solid #1a73e8; margin:20px 0;">
       ${messagePreview}
     </blockquote>
     <a href="https://admin.sofcollege.edu.ng/messages" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
        Log In to View Message
     </a>`
  );
};

const sendStudentMessageNotificationToAdmin = (studentFullName, messagePreview) => {
  return sendEmail(
    adminEmail,
    'New Message from Student',
    `Hello Admin,\n\nYou have received a new message from ${studentFullName}.\n\nPreview:\n${messagePreview}\n\nLog in to your admin portal to read and reply.`,
    `<h2>New Message from Student</h2>
     <p>Hello Admin,</p>
     <p>You have received a new message from <strong>${studentFullName}</strong>.</p>
     <blockquote style="background:#f4f4f4; padding:10px; border-left:4px solid #1a73e8; margin:20px 0;">
       ${messagePreview}
     </blockquote>
     <a href="https://admin.sofcollege.edu.ng/messages" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
        Log In to View Message
     </a>`
  );
};
// ===== ADMIN → TEACHER =====
const sendAdminMessageNotificationToTeacher = (teacherEmail, teacherFullName,  messagePreview) => {
  return sendEmail(
    teacherEmail,
    'New Message from the School Administration',
    `Hello ${teacherFullName},\n\nYou have received a new message from the School Administration.\n\nPreview:\n${messagePreview}\n\nLog in to your staff portal to read and reply.`,
    `<h2>New Message from the School Administration</h2>
    <p>Hello <strong>${teacherFullName}</strong>,</p>
     <p>You have received a new message from <strong>the School Administration</strong>.</p>
     <blockquote style="background:#f4f4f4; padding:10px; border-left:4px solid #1a73e8; margin:20px 0;">
       ${messagePreview}
     </blockquote>
     <a href="https://teacher.sofcollege.edu.ng/messages" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
        Log In to View Message
     </a>`
  );
};

// ===== STUDENT → TEACHER =====
const sendStudentMessageNotificationToTeacher = (teacherEmail, studentFullName, messagePreview) => {
  return sendEmail(
    teacherEmail,
    'New Message from Student',
    `Hello,\n\nYou have received a new message from ${studentFullName}.\n\nPreview:\n${messagePreview}\n\nLog in to your staff portal to read and reply.`,
    `<h2>New Message from ${studentFullName}</h2>
     <p>Hello,</p>
     <p>You have received a new message from <strong>${studentFullName}</strong>.</p>
     <blockquote style="background:#f4f4f4; padding:10px; border-left:4px solid #1a73e8; margin:20px 0;">
       ${messagePreview}
     </blockquote>
     <a href="https://teacher.sofcollege.edu.ng/messages" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
        Log In to View Message
     </a>`
  );
};

// ===== ADMIN → STUDENT =====
const sendAdminMessageNotificationToStudent = (studentEmail, studentFullName, messagePreview) => {
  return sendEmail(
    studentEmail,
    'New Message from the School Administration',
    `Hello ${studentFullName},\n\nYou have received a new message from the School Administration.\n\nPreview:\n${messagePreview}\n\nLog in to your student portal to read and reply.`,
    `<h2>New Message from the School Administration</h2>
     <p>Hello <strong>${studentFullName}</strong>,</p>
     <p>You have received a new message from <strong>the School Administration</strong>.</p>
     <blockquote style="background:#f4f4f4; padding:10px; border-left:4px solid #1a73e8; margin:20px 0;">
       ${messagePreview}
     </blockquote>
     <a href="https://student.sofcollege.edu.ng/messages" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
        Log In to View Message
     </a>`
  );
};

// ===== TEACHER → STUDENT =====
const sendTeacherMessageNotificationToStudent = (studentEmail, teacherFullName, messagePreview) => {
  return sendEmail(
    studentEmail,
    'New Message from Staff',
    `Hello, \n\nYou have received a new message from ${teacherFullName}.\n\nPreview:\n${messagePreview}\n\nLog in to your student portal to read and reply.`,
    `<h2>New Message from ${teacherFullName}</h2>
     <p>Hello,</p>
     <p>You have received a new message from <strong>${teacherFullName}</strong>.</p>
     <blockquote style="background:#f4f4f4; padding:10px; border-left:4px solid #1a73e8; margin:20px 0;">
       ${messagePreview}
     </blockquote>
     <a href="https://student.sofcollege.edu.ng/messages" 
        style="display:inline-block; margin-top:20px; padding:10px 20px; background:#1a73e8; color:white; text-decoration:none; border-radius:5px;">
        Log In to View Message
     </a>`
  );
};

// Email when user submits form
const sendLandingContactEmail = (name, email, message) => {
  const subject = "New Contact Form Submission – SOF College of Engineering";

  const plainText = `Hello Admin,

You have received a new message from the website landing page:

Name: ${name}
Email: ${email}
Message: ${message}

Regards,
SOF College Website
`;

  const htmlContent = `
    <h2>Contact Form Submission</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Message:</strong></p>
    <blockquote style="background:#f4f4f4; padding:10px; border-left:4px solid #1a73e8; margin:20px 0;">
      ${message}
    </blockquote>
  `;

  return sendEmail(adminEmail, subject, plainText, htmlContent, { replyTo: email });
};

// Auto reply to user
const sendLandingContactAutoReply = (name, email) => {
  const subject = "We Received Your Message – SOF College of Engineering";

  const plainText = `Hello ${name},

Thank you for contacting SOF College of Engineering.
We have received your message and our team will get back to you shortly.

If our response is delayed, please contact the school administration team via WhatsApp: https://wa.me/2349054694470

Best regards,
SOF College of Engineering
`;

  const htmlContent = `
    <h2>Thank You for Contacting Us</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>We have received your message and our team will get back to you shortly.</p>
    <p>If our response is delayed, please contact the school administration team via <a href="https://wa.me/2349054694470" target="_blank" rel="noopener" style="color: #0b5ed7; text-decoration: none;">WhatsApp</a>.</p>
    <p>We appreciate your interest in SOF College of Engineering.</p>
  `;

  return sendEmail(email, subject, plainText, htmlContent);
};

const sendPasswordResetEmail = (email, fullName, code) => {
  return sendEmail(
    email,
    'Password Reset Request',
    `Hello ${fullName},\n\nWe received a request to reset your password.\nUse this code to reset it: ${code}\n\nIf you did not request this, please ignore this email.`,
    `<h2>Password Reset Request</h2>
     <p>Hello <strong>${fullName}</strong>,</p>
     <p>We received a request to reset your password. Use the following code to reset it:</p>
     <h3 style="color:#dc3545; margin-top:10px;">${code}</h3>
     <p style="margin-top: 20px;">If you did not request a password reset, you can safely ignore this email.</p>`
  );
};


module.exports = {
  sendEmail,
  sendMail,
  sendPasswordResetEmail,
  sendSuperAdminMail,
  sendTeacherWelcomeEmail,
  sendNewTeacherNotificationToAdmin,
  sendTeacherApprovalEmail,
  sendCourseRegistrationMail,
  sendCourseApprovalMail,
  sendTuitionPaymentToAdmin,
  sendTuitionPaymentApproved,
  sendLevelChangeNotification,
  sendDepartmentChangeMail,
  sendGeneralFeeUpdateMail,
  sendAdminMessageNotificationToStudent,
  sendTeacherMessageNotificationToStudent,
  sendStudentMessageNotificationToTeacher,
  sendAdminMessageNotificationToTeacher,
  sendTeacherMessageNotificationToAdmin,
  sendStudentMessageNotificationToAdmin,
 sendLandingContactEmail,
 sendLandingContactAutoReply,
 sendNewAssignmentEmail,
 sendGradeNotificationEmail,
  sendAssignmentSubmissionEmail,
};
