import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Skip email service initialization if credentials are not provided
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.info('Email service disabled - SMTP credentials not configured');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('Email service configuration error', error);
        } else {
          logger.info('Email service is ready to send messages');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email service', error);
    }
  }

  async sendEmail(to, subject, htmlContent, textContent = null) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@school.edu',
        to,
        subject,
        html: htmlContent,
        text: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      logger.error('Failed to send email', error, { to, subject });
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send welcome email to new users
  async sendWelcomeEmail(user) {
    const subject = 'Welcome to School Management System';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Our School Management System</h2>
        <p>Dear ${user.name},</p>
        <p>Your account has been successfully created in our School Management System.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Account Details:</h3>
          <p><strong>Name:</strong> ${user.name}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Role:</strong> ${user.role}</p>
          ${user.studentId ? `<p><strong>Student ID:</strong> ${user.studentId}</p>` : ''}
          ${user.teacherId ? `<p><strong>Teacher ID:</strong> ${user.teacherId}</p>` : ''}
        </div>
        <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
        <p>If you have any questions, please contact the IT support team.</p>
        <p>Best regards,<br>School Administration</p>
      </div>
    `;

    return await this.sendEmail(user.email, subject, htmlContent);
  }

  // Send fee reminder email
  async sendFeeReminderEmail(student, fee) {
    const subject = 'Fee Payment Reminder';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Fee Payment Reminder</h2>
        <p>Dear ${student.name},</p>
        <p>This is a reminder that your fee payment is due soon.</p>
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3>Fee Details:</h3>
          <p><strong>Invoice Number:</strong> ${fee.invoiceNumber}</p>
          <p><strong>Fee Type:</strong> ${fee.type}</p>
          <p><strong>Amount:</strong> $${fee.amount}</p>
          <p><strong>Due Date:</strong> ${new Date(fee.dueDate).toLocaleDateString()}</p>
          <p><strong>Outstanding Amount:</strong> $${fee.amount - fee.paidAmount}</p>
        </div>
        <p>Please make the payment before the due date to avoid late fees.</p>
        <p>For payment assistance, please contact the accounts office.</p>
        <p>Best regards,<br>Accounts Department</p>
      </div>
    `;

    return await this.sendEmail(student.email, subject, htmlContent);
  }

  // Send grade notification email
  async sendGradeNotificationEmail(student, grade) {
    const subject = 'New Grade Posted';
    const percentage = ((grade.score / grade.maxScore) * 100).toFixed(1);
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">New Grade Posted</h2>
        <p>Dear ${student.name},</p>
        <p>A new grade has been posted for your recent assessment.</p>
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3>Grade Details:</h3>
          <p><strong>Subject:</strong> ${grade.subjectName}</p>
          <p><strong>Assessment Type:</strong> ${grade.examType}</p>
          <p><strong>Score:</strong> ${grade.score}/${grade.maxScore} (${percentage}%)</p>
          <p><strong>Date:</strong> ${new Date(grade.date).toLocaleDateString()}</p>
          ${grade.comments ? `<p><strong>Comments:</strong> ${grade.comments}</p>` : ''}
        </div>
        <p>Keep up the good work!</p>
        <p>Best regards,<br>Academic Department</p>
      </div>
    `;

    return await this.sendEmail(student.email, subject, htmlContent);
  }

  // Send announcement email
  async sendAnnouncementEmail(recipients, announcement) {
    const subject = `School Announcement: ${announcement.title}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">${announcement.title}</h2>
        <div style="background-color: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
          <p>${announcement.content}</p>
        </div>
        <p><strong>Priority:</strong> ${announcement.priority.toUpperCase()}</p>
        <p><strong>Date:</strong> ${new Date(announcement.createdAt).toLocaleDateString()}</p>
        <p>Best regards,<br>School Administration</p>
      </div>
    `;

    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient.email, subject, htmlContent);
      results.push({ recipient: recipient.email, ...result });
    }

    return results;
  }
}

export default new EmailService();