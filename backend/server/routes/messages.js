import express from 'express';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Mock data for demonstration
let messages = [
  {
    _id: '1',
    senderId: 'user1',
    receiverId: 'user2',
    senderName: 'John Smith',
    message: 'Hello! How are the students doing in your class?',
    timestamp: new Date(Date.now() - 3600000),
    isRead: true
  },
  {
    _id: '2',
    senderId: 'user2',
    receiverId: 'user1',
    senderName: 'Sarah Johnson',
    message: 'Hi! They are doing well. Most students are keeping up with the curriculum.',
    timestamp: new Date(Date.now() - 3000000),
    isRead: true
  },
  {
    _id: '3',
    senderId: 'user1',
    receiverId: 'user2',
    senderName: 'John Smith',
    message: 'That\'s great to hear! I wanted to discuss the upcoming project.',
    timestamp: new Date(Date.now() - 1800000),
    isRead: false
  }
];

let users = [
  {
    _id: 'user1',
    name: 'John Smith',
    role: 'teacher',
    email: 'john.smith@school.edu',
    avatar: null,
    lastSeen: new Date(),
    isOnline: true
  },
  {
    _id: 'user2',
    name: 'Sarah Johnson',
    role: 'parent',
    email: 'sarah.johnson@email.com',
    avatar: null,
    lastSeen: new Date(Date.now() - 300000),
    isOnline: false
  },
  {
    _id: 'user3',
    name: 'Mike Wilson',
    role: 'student',
    email: 'mike.wilson@student.edu',
    avatar: null,
    lastSeen: new Date(Date.now() - 600000),
    isOnline: true
  },
  {
    _id: 'user4',
    name: 'Emily Davis',
    role: 'admin',
    email: 'emily.davis@school.edu',
    avatar: null,
    lastSeen: new Date(Date.now() - 120000),
    isOnline: true
  }
];

// Get users for chat (excluding current user)
router.get('/users/chat-users', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    // Filter out current user and add chat metadata
    const chatUsers = users
      .filter(user => user._id !== currentUserId)
      .map(user => {
        // Get last message with this user
        const lastMessage = messages
          .filter(msg => 
            (msg.senderId === currentUserId && msg.receiverId === user._id) ||
            (msg.senderId === user._id && msg.receiverId === currentUserId)
          )
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        
        // Count unread messages from this user
        const unreadCount = messages.filter(msg => 
          msg.senderId === user._id && 
          msg.receiverId === currentUserId && 
          !msg.isRead
        ).length;
        
        return {
          ...user,
          lastMessage: lastMessage?.message || null,
          lastMessageTime: lastMessage?.timestamp || null,
          unreadCount
        };
      })
      .sort((a, b) => {
        // Sort by last message time, then by online status
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
    const currentUserId = req.user.id;
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Get messages between the two users
    const conversation = messages
      .filter(msg => 
        (msg.senderId === currentUserId && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === currentUserId)
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Mark messages from the other user as read
    messages = messages.map(msg => {
      if (msg.senderId === userId && msg.receiverId === currentUserId) {
        return { ...msg, isRead: true };
      }
      return msg;
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMessages = conversation.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedMessages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(conversation.length / limit),
        totalMessages: conversation.length
      }
    });
  } catch (error) {
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
    const senderId = req.user.id;
    const { receiverId, message } = req.body;
    
    if (!receiverId || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message are required'
      });
    }
    
    // Check if receiver exists
    const receiver = users.find(user => user._id === receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }
    
    const sender = users.find(user => user._id === senderId);
    
    const newMessage = {
      _id: Date.now().toString(),
      senderId,
      receiverId,
      senderName: sender?.name || 'Unknown User',
      message: message.trim(),
      timestamp: new Date(),
      isRead: false
    };
    
    messages.push(newMessage);
    
    // In a real application, you would emit this message via Socket.IO
    // io.to(receiverId).emit('newMessage', newMessage);
    
    res.status(201).json({
      success: true,
      data: newMessage,
      message: 'Message sent successfully'
    });
  } catch (error) {
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
    const currentUserId = req.user.id;
    const { userId } = req.params;
    
    // Mark all messages from userId to currentUserId as read
    messages = messages.map(msg => {
      if (msg.senderId === userId && msg.receiverId === currentUserId) {
        return { ...msg, isRead: true };
      }
      return msg;
    });
    
    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
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
    const currentUserId = req.user.id;
    const { messageId } = req.params;
    
    const messageIndex = messages.findIndex(msg => 
      msg._id === messageId && msg.senderId === currentUserId
    );
    
    if (messageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or you are not authorized to delete it'
      });
    }
    
    messages.splice(messageIndex, 1);
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
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
    const currentUserId = req.user.id;
    
    const unreadCount = messages.filter(msg => 
      msg.receiverId === currentUserId && !msg.isRead
    ).length;
    
    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
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
    const currentUserId = req.user.id;
    const { query } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Search messages where current user is sender or receiver
    const searchResults = messages
      .filter(msg => 
        (msg.senderId === currentUserId || msg.receiverId === currentUserId) &&
        msg.message.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = searchResults.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(searchResults.length / limit),
        totalResults: searchResults.length
      }
    });
  } catch (error) {
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
    const currentUserId = req.user.id;
    const { isOnline } = req.body;
    
    const userIndex = users.findIndex(user => user._id === currentUserId);
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        isOnline: Boolean(isOnline),
        lastSeen: new Date()
      };
    }
    
    res.json({
      success: true,
      message: 'Status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
});

export default router;