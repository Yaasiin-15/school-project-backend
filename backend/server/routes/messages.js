import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

const router = express.Router();

// Get users for chat (excluding current user)
router.get('/users/chat-users', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    // Get all users except current user
    const users = await User.find({ 
      _id: { $ne: currentUserId },
      isActive: true 
    }).select('name email role profileImage lastLogin');
    
    // Get chat metadata for each user
    const chatUsersPromises = users.map(async (user) => {
      // Get last message with this user
      const lastMessage = await Message.findOne({
        $or: [
          { senderId: currentUserId, receiverId: user._id },
          { senderId: user._id, receiverId: currentUserId }
        ]
      }).sort({ createdAt: -1 });
      
      // Count unread messages from this user
      const unreadCount = await Message.countDocuments({
        senderId: user._id,
        receiverId: currentUserId,
        isRead: false
      });
      
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.profileImage,
        lastSeen: user.lastLogin,
        isOnline: user.lastLogin && (new Date() - user.lastLogin) < 300000, // 5 minutes
        lastMessage: lastMessage?.message || null,
        lastMessageTime: lastMessage?.createdAt || null,
        unreadCount
      };
    });
    
    const chatUsers = await Promise.all(chatUsersPromises);
    
    // Sort by last message time, then by online status
    chatUsers.sort((a, b) => {
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      }
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return 0;
    });
    
    res.json({
      success: true,
      data: chatUsers
    });
  } catch (error) {
    console.error('Fetch chat users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat users',
      error: error.message
    });
  }
});

// Get messages between current user and another user
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Get messages between the two users
    const [messages, totalCount] = await Promise.all([
      Message.find({
        $or: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId }
        ]
      })
      .populate('senderId', 'name profileImage')
      .populate('receiverId', 'name profileImage')
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit),
      
      Message.countDocuments({
        $or: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId }
        ]
      })
    ]);
    
    // Mark messages from the other user as read
    await Message.updateMany(
      {
        senderId: userId,
        receiverId: currentUserId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );
    
    // Format messages for response
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      senderId: msg.senderId._id,
      receiverId: msg.receiverId._id,
      senderName: msg.senderName,
      receiverName: msg.receiverName,
      message: msg.message,
      messageType: msg.messageType,
      attachments: msg.attachments,
      timestamp: msg.createdAt,
      isRead: msg.isRead,
      readAt: msg.readAt,
      priority: msg.priority,
      subject: msg.subject
    }));
    
    res.json({
      success: true,
      data: formattedMessages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalMessages: totalCount
      }
    });
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// Send a new message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId, message, messageType = 'text', priority = 'normal', subject } = req.body;
    
    if (!receiverId || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message are required'
      });
    }
    
    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }
    
    const newMessage = new Message({
      senderId,
      receiverId,
      senderName: req.user.name,
      receiverName: receiver.name,
      message: message.trim(),
      messageType,
      priority,
      subject
    });
    
    await newMessage.save();
    
    // Populate sender and receiver info
    await newMessage.populate('senderId', 'name profileImage');
    await newMessage.populate('receiverId', 'name profileImage');
    
    // In a real application, you would emit this message via Socket.IO
    // io.to(receiverId).emit('newMessage', newMessage);
    
    res.status(201).json({
      success: true,
      data: {
        _id: newMessage._id,
        senderId: newMessage.senderId._id,
        receiverId: newMessage.receiverId._id,
        senderName: newMessage.senderName,
        receiverName: newMessage.receiverName,
        message: newMessage.message,
        messageType: newMessage.messageType,
        timestamp: newMessage.createdAt,
        isRead: newMessage.isRead,
        priority: newMessage.priority,
        subject: newMessage.subject
      },
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// Mark messages as read
router.put('/:userId/read', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;
    
    // Mark all messages from userId to currentUserId as read
    const result = await Message.updateMany(
      {
        senderId: userId,
        receiverId: currentUserId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} messages marked as read`
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
});

// Delete a message
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { messageId } = req.params;
    
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // Check if user is authorized to delete (sender or receiver)
    if (message.senderId.toString() !== currentUserId.toString() && 
        message.receiverId.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this message'
      });
    }
    
    // Soft delete for the current user
    await message.deleteForUser(currentUserId);
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

// Get unread message count
router.get('/unread/count', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    const unreadCount = await Message.countDocuments({
      receiverId: currentUserId,
      isRead: false
    });
    
    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
});

// Search messages
router.get('/search/:query', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { query } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Search messages where current user is sender or receiver
    const [searchResults, totalCount] = await Promise.all([
      Message.find({
        $and: [
          {
            $or: [
              { senderId: currentUserId },
              { receiverId: currentUserId }
            ]
          },
          {
            $or: [
              { message: { $regex: query, $options: 'i' } },
              { subject: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      })
      .populate('senderId', 'name profileImage')
      .populate('receiverId', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit),
      
      Message.countDocuments({
        $and: [
          {
            $or: [
              { senderId: currentUserId },
              { receiverId: currentUserId }
            ]
          },
          {
            $or: [
              { message: { $regex: query, $options: 'i' } },
              { subject: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      })
    ]);
    
    // Format results
    const formattedResults = searchResults.map(msg => ({
      _id: msg._id,
      senderId: msg.senderId._id,
      receiverId: msg.receiverId._id,
      senderName: msg.senderName,
      receiverName: msg.receiverName,
      message: msg.message,
      subject: msg.subject,
      timestamp: msg.createdAt,
      isRead: msg.isRead,
      priority: msg.priority
    }));
    
    res.json({
      success: true,
      data: formattedResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalResults: totalCount
      }
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search messages',
      error: error.message
    });
  }
});

// Update user online status
router.put('/users/status', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    // Update user's last login time to indicate they're active
    await User.findByIdAndUpdate(currentUserId, {
      lastLogin: new Date()
    });
    
    res.json({
      success: true,
      message: 'Status updated successfully'
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
});

export default router;