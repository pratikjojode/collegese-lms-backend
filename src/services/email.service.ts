import { Assessment, LiveLecture, Quiz } from 'generated/prisma';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendPasswordResetEmail = async (toEmail: string, token: string): Promise<void> => {
    const mailOptions = {
        from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Password Reset',
        html: `
            <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
    .header h1 { color: #0056b3; margin: 0; }
    .content { padding-top: 20px; }
    .content h2 { color: #333333; }
    .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Collegese LMS</h1>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hello,</p>
      <p>You requested a password reset for your Collegese LMS account.</p>
      <p>Click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:5173/reset-password?token=${token}" 
           style="background-color: #0056b3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; transition: background-color 0.3s;">
            Reset Password
        </a>
      </div>
      <p style="color: #d32f2f; font-weight: bold;">⚠️ This link will expire in 1 hour.</p>
      <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
      <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
      <p>Best regards,<br>The Collegese Team</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Collegese LMS. All Rights Reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        throw new Error('Failed to send password reset email.');
    }
};

export const sendCertificateEmail = async (
  toEmail: string,
  userName: string,
  courseTitle: string,
  certificateUrl: string
): Promise<void> => {
  const mailOptions = {
    from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your Certificate for ${courseTitle} is Ready!`,
    html: `
      <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
    .header h1 { color: #0056b3; margin: 0; }
    .content { padding-top: 20px; }
    .content h2 { color: #333333; }
    .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Collegese LMS</h1>
    </div>
    <div class="content">
      <h2>Certificate of Completion</h2>
      <p>Hello ${userName},</p>
      <p>Congratulations! You have successfully completed the course: <strong>${courseTitle}</strong>.</p>
      <p>Your certificate is now available. You can view it by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${certificateUrl}" 
           style="background-color: #0056b3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; transition: background-color 0.3s;">
           View Your Certificate
        </a>
      </div>
      <p>If you have any questions, please feel free to reach out.</p>
      <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
      <p>Best regards,<br>The Collegese Team</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Collegese LMS. All Rights Reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send certificate email:", error);
    throw new Error("Failed to send certificate email.");
  }
};

export const sendCertificateVerificationEmail = async (
  toEmail: string,
  userName: string,
  courseTitle: string,
  certificateId: string,
  verifiedUrl: string
): Promise<void> => {
  const mailOptions = {
    from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Verified Certificate - ${courseTitle}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
          .header h1 { color: #0056b3; margin: 0; }
          .content { padding-top: 20px; }
          .content h2 { color: #333333; }
          .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
          .verified-badge { color: #10B981; font-weight: bold; }
          .certificate-id { background-color: #f8f9fa; padding: 10px; border-radius: 4px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Collegese LMS</h1>
          </div>
          <div class="content">
            <h2>Verified Certificate of Completion</h2>
            <p>Hello ${userName},</p>
            <p>Congratulations! Your certificate for <strong>${courseTitle}</strong> has been officially 
               <span class="verified-badge">VERIFIED ✅</span>.</p>
            <div class="certificate-id">
              <strong>Certificate ID:</strong> ${certificateId}
            </div>
            <p>You can download your verified certificate copy by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifiedUrl}"
                 style="background-color: #0056b3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; transition: background-color 0.3s;">
                Download Verified Certificate
              </a>
            </div>
            <p>If you have any questions, please feel free to reach out.</p>
            <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
            <p>Best regards,<br>The Collegese Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send certificate verification email:", error);
    throw new Error("Failed to send certificate verification email.");
  }
};

export const sendExamResultEmail = async (
  toEmail: string,
  userName: string,
  examTitle: string,
  score: number,
  totalMarks: number,
  isPassed: boolean
): Promise<void> => {
  const mailOptions = {
    from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your Exam Result: ${examTitle}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
          .header h1 { color: #0056b3; margin: 0; }
          .content { padding-top: 20px; }
          .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
          .score { font-size: 18px; font-weight: bold; color: #333; margin: 15px 0; }
          .status { font-size: 16px; font-weight: bold; color: ${isPassed ? "#10B981" : "#D32F2F"}; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Collegese LMS</h1>
          </div>
          <div class="content">
            <h2>Exam Result Notification</h2>
            <p>Hello ${userName},</p>
            <p>Your result for the exam <strong>${examTitle}</strong> is now available.</p>
            <p class="score">Score: ${score} / ${totalMarks}</p>
            <p class="status">Status: ${isPassed ? "Passed ✅" : "Failed ❌"}</p>
            <p>Keep learning and improving!</p>
            <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
            <p>Best regards,<br>The Collegese Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Exam result sent to: ${toEmail}`);
  } catch (error) {
    console.error("Failed to send exam result email:", error);
    throw new Error("Failed to send exam result email.");
  }
};

export const sendExamMail = async (exam: any, recipientEmail: string) => {
    try {
        const mailOptions = {
            from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `New Exam Created: ${exam.title}`,
            html: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                        .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
                        .header h1 { color: #0056b3; margin: 0; }
                        .content { padding-top: 20px; }
                        .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
                        .details { font-size: 16px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 Collegese LMS</h1>
                        </div>
                        <div class="content">
                            <h2>New Exam Notification</h2>
                            <p>Hello,</p>
                            <p>A new exam, <strong>${exam.title}</strong>, has been created and is now available.</p>
                            <div class="details">
                                <p><strong>Description:</strong> ${exam.description || 'No description'}</p>
                                <p><strong>Duration:</strong> ${exam.durationMins} minutes</p>
                                <p><strong>Total Marks:</strong> ${exam.totalMarks}</p>
                                <p><strong>Passing Marks:</strong> ${exam.passingMarks}</p>
                                <p><strong>Is Final Exam:</strong> ${exam.isFinalExam ? 'Yes' : 'No'}</p>
                            </div>
                            <p>Please log in to your account to view the exam details and begin.</p>
                            <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
                            <p>Best regards,<br>The Collegese Team</p>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${recipientEmail}!`);
    } catch (err: any) {
        console.error("Failed to send email:", err);
    }
};


export const sendLiveLectureScheduledEmail = async (
    recipientEmail: string,
    recipientName: string,
    lecture: LiveLecture
): Promise<void> => {
    const mailOptions = {
        from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: `New Live Lecture Scheduled: ${lecture.title}`,
        html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
                    .header h1 { color: #0056b3; margin: 0; }
                    .content { padding-top: 20px; }
                    .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
                    .details { font-size: 16px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 Collegese LMS</h1>
                    </div>
                    <div class="content">
                        <h2>New Live Lecture Scheduled Notification</h2>
                        <p>Hello ${recipientName},</p>
                        <p>A new live lecture, <strong>${lecture.title}</strong>, has been scheduled for your course.</p>
                        <div class="details">
                            <p><strong>Start Time:</strong> ${new Date(lecture.startTime).toLocaleString()}</p>
                            <p><strong>End Time:</strong> ${new Date(lecture.endTime).toLocaleString()}</p>
                            <p><strong>Room ID:</strong> ${lecture.roomId}</p>
                        </div>
                        <p>Please log in to your account at the scheduled time to join the lecture.</p>
                        <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
                        <p>Best regards,<br>The Collegese Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Live lecture notification sent to: ${recipientEmail}`);
    } catch (error) {
        console.error("Failed to send live lecture email:", error);
        throw new Error("Failed to send live lecture email.");
    }
};

export const sendQuizCreatedEmail = async (
    recipientEmail: string,
    recipientName: string,
    quiz: Quiz
): Promise<void> => {
    const mailOptions = {
        from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: `New Quiz Available: ${quiz.title}`,
        html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
                    .header h1 { color: #0056b3; margin: 0; }
                    .content { padding-top: 20px; }
                    .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
                    .details { font-size: 16px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 Collegese LMS</h1>
                    </div>
                    <div class="content">
                        <h2>New Quiz Notification</h2>
                        <p>Hello ${recipientName},</p>
                        <p>A new quiz, <strong>${quiz.title}</strong>, has been created for your course. It is now available for you to take.</p>
                        <div class="details">
                            <p><strong>Description:</strong> ${quiz.description || 'No description provided.'}</p>
                            <p><strong>Time Limit:</strong> ${quiz.timeLimit ? `${quiz.timeLimit} minutes` : 'No time limit'}</p>
                            <p><strong>Answer Reveal Policy:</strong> ${quiz.answerRevealPolicy || 'Not specified'}</p>
                        </div>
                        <p>Log in to your account to view the quiz details and begin.</p>
                        <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
                        <p>Best regards,<br>The Collegese Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Quiz notification sent to: ${recipientEmail}`);
    } catch (error) {
        console.error("Failed to send quiz notification email:", error);
    }
};


export const sendAssessmentEmail = async (
    recipientEmail: string,
    recipientName: string,
    assessment: Assessment
): Promise<void> => {
    const mailOptions = {
        from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: `New Assessment: ${assessment.title}`,
        html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
                    .header h1 { color: #0056b3; margin: 0; }
                    .content { padding-top: 20px; }
                    .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
                    .details { font-size: 16px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 Collegese LMS</h1>
                    </div>
                    <div class="content">
                        <h2>New Assessment Notification</h2>
                        <p>Hello ${recipientName},</p>
                        <p>A new assessment titled <strong>${assessment.title}</strong> has been published in your course.</p>
                        <div class="details">
                            <p><strong>Description:</strong> ${assessment.description || 'No description provided.'}</p>
                           
                            <p><strong>Total Marks:</strong> ${assessment.totalMarks}</p>
                            <p><strong>Submission Type:</strong> ${assessment.submissionType}</p>
                        </div>
                        <p>Please log in to your account to view the assessment details and submit your work before the deadline.</p>
                        <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
                        <p>Best regards,<br>The Collegese Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Assessment notification sent to: ${recipientEmail}`);
    } catch (error) {
        console.error("Failed to send assessment email:", error);
    }
};

export const sendLoginNotificationEmail = async (
    recipientEmail: string,
    recipientName: string,
    loginDetails: { ipAddress: string; loginTime: Date }
): Promise<void> => {
    const mailOptions = {
        from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: 'New Login to Your Collegese LMS Account',
        html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
                    .header h1 { color: #0056b3; margin: 0; }
                    .content { padding-top: 20px; }
                    .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
                    .details { font-size: 16px; margin: 15px 0; }
                    .alert-note { color: #d32f2f; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 Collegese LMS</h1>
                    </div>
                    <div class="content">
                        <h2>Login Notification</h2>
                        <p>Hello ${recipientName},</p>
                        <p>There was a recent login to your account. If this was you, you can safely ignore this email.</p>
                        <div class="details">
                            <p><strong>Login Time:</strong> ${loginDetails.loginTime.toLocaleString()}</p>
                            <p><strong>IP Address:</strong> ${loginDetails.ipAddress}</p>
                        </div>
                        <p class="alert-note">If you did not authorize this login, please change your password immediately.</p>
                        <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
                        <p>Best regards,<br>The Collegese Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Login notification sent to: ${recipientEmail}`);
    } catch (error) {
        console.error("Failed to send login notification email:", error);
    }
};


export const sendMaintenanceModeEmail = async (
    recipientEmail: string,
    recipientName: string,
    recipientRole: string,
    isMaintenanceMode: boolean,
    reason: string
): Promise<void> => {
    const statusText = isMaintenanceMode ? "Enabled" : "Disabled";
    const statusColor = isMaintenanceMode ? "#D32F2F" : "#10B981";
    const subject = `System Maintenance Mode ${statusText}`;
    
    let personalizedGreeting = `Dear ${recipientName},`;
    let mainMessage = `The system's maintenance mode has been updated.`;
    
    if (recipientRole === 'STUDENT') {
        personalizedGreeting = `Dear Student,`;
        mainMessage = `The system is currently undergoing maintenance. Access to your courses and materials may be temporarily unavailable.`;
    } else if (recipientRole === 'TEACHER') {
        personalizedGreeting = `Dear Teacher,`;
        mainMessage = `The system is currently undergoing maintenance. Course management features and live sessions may be affected.`;
    } else if (recipientRole === 'ADMIN' || recipientRole === 'SUPER_ADMIN') {
        personalizedGreeting = `Dear Administrator,`;
        mainMessage = `The system's maintenance mode has been updated.`;
    }
    
    const mailOptions = {
        from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: subject,
        html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
                    .header h1 { color: #0056b3; margin: 0; }
                    .content { padding-top: 20px; }
                    .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
                    .status-box { font-size: 18px; font-weight: bold; color: #ffffff; background-color: ${statusColor}; padding: 10px 20px; border-radius: 5px; text-align: center; display: inline-block; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 Collegese LMS</h1>
                    </div>
                    <div class="content">
                        <h2>System Maintenance Update</h2>
                        <p>${personalizedGreeting}</p>
                        <p>${mainMessage}</p>
                        <p>Maintenance Mode Status: <span class="status-box">${statusText}</span></p>
                        <p><strong>Reason:</strong> ${reason}</p>
                        <p>If you have any questions, please contact technical support.</p>
                        <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
                        <p>Best regards,<br>The Collegese Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Maintenance mode notification sent to: ${recipientEmail}`);
    } catch (error) {
        console.error("Failed to send maintenance mode email:", error);
    }
};

export const sendWhitelistUpdateEmail = async (
    recipientEmail: string,
    recipientName: string,
    whitelistUserNames: string[]
): Promise<void> => {
    const userListHtml = whitelistUserNames.length > 0
        ? `<ul>${whitelistUserNames.map(name => `<li>${name}</li>`).join('')}</ul>`
        : `<p>No users are currently on the whitelist.</p>`;

    const mailOptions = {
        from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: `System Maintenance Whitelist Updated`,
        html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
                    .header h1 { color: #0056b3; margin: 0; }
                    .content { padding-top: 20px; }
                    .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 Collegese LMS</h1>
                    </div>
                    <div class="content">
                        <h2>Maintenance Whitelist Update</h2>
                        <p>Dear ${recipientName},</p>
                        <p>The list of users who are allowed to access the system during maintenance mode has been updated.</p>
                        <p><strong>Whitelisted Users:</strong></p>
                        ${userListHtml}
                        <p>If you have any questions, please contact technical support.</p>
                        <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
                        <p>Best regards,<br>The Collegese Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Whitelist update notification sent to: ${recipientEmail}`);
    } catch (error) {
        console.error("Failed to send whitelist update email:", error);
    }
};