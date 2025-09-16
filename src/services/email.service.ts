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