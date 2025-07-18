# Production Setup Instructions

## Initial Database Setup

1. **Start MongoDB**: Make sure MongoDB is running on your system
2. **Update Environment**: Copy `.env.example` to `.env` and update with your settings
3. **Create Initial Admin User**: Use this endpoint to create your first admin user

```bash
curl -X POST http://localhost:3001/api/auth/create-initial-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "School Administrator",
    "email": "admin@yourschool.com",
    "password": "SecurePassword123!"
  }'
```

## Important Security Notes

1. **Change Default JWT Secret**: Update `JWT_SECRET` in your `.env` file
2. **Use Strong Passwords**: Ensure all user accounts have strong passwords
3. **Database Security**: Secure your MongoDB installation
4. **HTTPS**: Use HTTPS in production
5. **Environment Variables**: Never commit `.env` files to version control

## User Management

After creating the initial admin user:

1. **Login as Admin**: Use the admin credentials to login
2. **Create Users**: Add teachers, students, and other staff through the management interface
3. **Set Roles**: Assign appropriate roles (admin, teacher, student, parent, accountant)
4. **Configure Settings**: Set up classes, subjects, and other school-specific data

## Database Collections

The system will automatically create these collections:
- `users` - All user accounts (students, teachers, admin, etc.)
- `classes` - Class information 
- `grades` - Student grades and assessments
- `fees` - Fee records and payments
- `announcements` - School announcements

## Backup Strategy

1. **Regular Backups**: Set up automated MongoDB backups
2. **Test Restores**: Regularly test backup restoration
3. **Off-site Storage**: Store backups securely off-site

## Monitoring

1. **Server Monitoring**: Monitor server health and performance
2. **Database Monitoring**: Track database performance and usage
3. **User Activity**: Monitor user login and activity patterns
4. **Error Logging**: Implement comprehensive error logging

## Support

For technical support or questions about the system setup, please refer to the documentation or contact your system administrator.