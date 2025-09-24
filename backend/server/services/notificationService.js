import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send email notification
export const sendEmailNotification = async (to, subject, html, text) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email credentials not configured, skipping email notification');
      return { success: false, message: 'Email not configured' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('Email sending failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send SMS notification (placeholder - integrate with SMS service)
export const sendSMSNotification = async (phoneNumbers, message) => {
  try {
    // Integrate with SMS service like Twilio, AWS SNS, etc.
    console.log('SMS notification:', { phoneNumbers, message });
    
    // For now, just log the SMS
    return {
      success: true,
      message: 'SMS notification logged (integration pending)'
    };
  } catch (error) {
    console.error('SMS sending failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Main notification service
export const sendNotification = async (notificationData) => {
  const {
    type,
    title,
    message,
    recipients,
    phoneNumbers,
    studentId,
    templateData = {}
  } = notificationData;

  const results = {
    email: null,
    sms: null
  };

  try {
    // Generate email content based on type
    const emailContent = generateEmailContent(type, title, message, templateData);
    
    // Send email notifications
    if (recipients && recipients.length > 0) {
      results.email = await sendEmailNotification(
        recipients,
        title,
        emailContent.html,
        emailContent.text
      );
    }

    // Send SMS notifications
    if (phoneNumbers && phoneNumbers.length > 0) {
      results.sms = await sendSMSNotification(phoneNumbers, message);
    }

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Notification service error:', error);
    return {
      success: false,
      error: error.message,
      results
    };
  }
};

// Generate email content based on notification type
const generateEmailContent = (type, title, message, templateData) => {
  const baseStyle = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background: #f9f9f9; }
      .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      .button { display: inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; }
    </style>
  `;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      ${baseStyle}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>School Management System</h1>
        </div>
        <div class="content">
          <h2>${title}</h2>
          <p>${message}</p>
  `;

  // Add type-specific content
  switch (type) {
    case 'attendance':
      if (templateData.studentName && templateData.date) {
        html += `
          <div style="background: white; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0;">
            <strong>Student:</strong> ${templateData.studentName}<br>
            <strong>Date:</strong> ${templateData.date}<br>
            <strong>Status:</strong> ${templateData.status}<br>
            ${templateData.reason ? `<strong>Reason:</strong> ${templateData.reason}` : ''}
          </div>
        `;
      }
      break;
      
    case 'fee':
      if (templateData.amount && templateData.dueDate) {
        html += `
          <div style="background: white; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0;">
            <strong>Amount:</strong> $${templateData.amount}<br>
            <strong>Due Date:</strong> ${templateData.dueDate}<br>
            ${templateData.description ? `<strong>Description:</strong> ${templateData.description}` : ''}
          </div>
        `;
      }
      break;
      
    case 'grade':
      if (templateData.subject && templateData.marks) {
        html += `
          <div style="background: white; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0;">
            <strong>Subject:</strong> ${templateData.subject}<br>
            <strong>Marks:</strong> ${templateData.marks}/${templateData.totalMarks}<br>
            <strong>Grade:</strong> ${templateData.grade}<br>
          </div>
        `;
      }
      break;
      
    case 'announcement':
      html += `
        <div style="background: white; padding: 15px; border-left: 4px solid #6366f1; margin: 15px 0;">
          <p>${templateData.content || message}</p>
        </div>
      `;
      break;
  }

  html += `
        </div>
        <div class="footer">
          <p>This is an automated message from School Management System.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    ${title}
    
    ${message}
    
    ${templateData.studentName ? `Student: ${templateData.studentName}` : ''}
    ${templateData.date ? `Date: ${templateData.date}` : ''}
    ${templateData.status ? `Status: ${templateData.status}` : ''}
    ${templateData.reason ? `Reason: ${templateData.reason}` : ''}
    
    ---
    School Management System
    This is an automated message. Please do not reply.
  `;

  return { html, text };
};

// Notification templates
export const NotificationTemplates = {
  ATTENDANCE_ABSENT: {
    title: 'Attendance Alert - Student Absent',
    getMessage: (studentName, date, reason) => 
      `Your child ${studentName} was marked absent on ${date}${reason ? `. Reason: ${reason}` : ''}.`
  },
  
  ATTENDANCE_LATE: {
    title: 'Attendance Alert - Student Late',
    getMessage: (studentName, date, reason) => 
      `Your child ${studentName} was marked late on ${date}${reason ? `. Reason: ${reason}` : ''}.`
  },
  
  FEE_REMINDER: {
    title: 'Fee Payment Reminder',
    getMessage: (studentName, amount, dueDate) => 
      `Fee payment of $${amount} for ${studentName} is due on ${dueDate}.`
  },
  
  FEE_OVERDUE: {
    title: 'Fee Payment Overdue',
    getMessage: (studentName, amount, daysOverdue) => 
      `Fee payment of $${amount} for ${studentName} is ${daysOverdue} days overdue.`
  },
  
  GRADE_PUBLISHED: {
    title: 'New Grades Available',
    getMessage: (studentName, subject) => 
      `New grades have been published for ${studentName} in ${subject}.`
  },
  
  EXAM_SCHEDULED: {
    title: 'Exam Scheduled',
    getMessage: (examTitle, subject, date, time) => 
      `${examTitle} for ${subject} has been scheduled on ${date} at ${time}.`
  },
  
  ANNOUNCEMENT: {
    title: 'School Announcement',
    getMessage: (content) => content
  }
};

export default {
  sendNotification,
  sendEmailNotification,
  sendSMSNotification,
  NotificationTemplates
};