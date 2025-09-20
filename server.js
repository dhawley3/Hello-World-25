const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const VapiIntegration = require('./vapi-config');
const Database = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Authentication configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Initialize database
const database = new Database();

// Session configuration
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists with this Google ID
    let user = await database.findUserByGoogleId(profile.id);
    
    if (user) {
      await database.updateUserLastLogin(user.id);
      return done(null, user);
    }
    
    // Check if user exists with this email
    user = await database.findUserByEmail(profile.emails[0].value);
    
    if (user) {
      // Update existing user with Google ID
      await database.updateUserWithGoogleId(user.id, profile.id);
      await database.updateUserLastLogin(user.id);
      return done(null, user);
    }
    
    // Create new user
    const newUser = await database.createUser({
      username: profile.displayName || profile.emails[0].value.split('@')[0],
      email: profile.emails[0].value,
      google_id: profile.id,
      role: 'user'
    });
    
    return done(null, newUser);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await database.findUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Check if user is authenticated (for frontend routes)
const checkAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

// In-memory storage for demo (use database in production)
let negotiations = {};
let negotiationCounter = 0;

// Initialize Vapi integration
let vapi = null;
if (process.env.VAPI_API_KEY) {
  vapi = new VapiIntegration(process.env.VAPI_API_KEY);
}

// Mock CSR API responses
const mockCSRResponses = {
  initial: [
    "Thank you for calling. How can I help you today?",
    "Good day! What seems to be the issue with your order?",
    "Hello, I'm here to assist you with your order concern."
  ],
  partialRefund: [
    "I can see your order. Unfortunately, I can only offer a $5 credit for this issue.",
    "Looking at your order, the best I can do is a partial refund of $8.",
    "I understand your concern, but our policy allows only $10 credit for this type of issue."
  ],
  fullRefund: [
    "I understand your frustration. Let me process a full refund of $12 for your order.",
    "You're absolutely right. I'll approve the full refund of $15 for this inconvenience.",
    "I apologize for the issue. I'm processing a complete refund of $18 for your order."
  ],
  confirmation: [
    "Your refund has been processed. Your confirmation code is REF-2024-001.",
    "Refund approved! Here's your confirmation code: REF-2024-002.",
    "All set! Your confirmation code is REF-2024-003."
  ]
};

// Routes

// Authentication routes
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await database.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await database.validatePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await database.updateUserLastLogin(user.id);

    const token = jwt.sign(
      { 
        id: user.id,
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed' }),
  async (req, res) => {
    try {
      // Generate JWT token for the authenticated user
      const token = jwt.sign(
        { 
          id: req.user.id,
          username: req.user.username, 
          role: req.user.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Redirect to frontend with token
      res.redirect(`/?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      }))}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/login?error=oauth_callback_failed');
    }
  }
);

// User registration route
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await database.findUserByUsername(username) || await database.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this username or email' });
    }

    const user = await database.createUser({
      username,
      email,
      password,
      role: 'user'
    });

    const token = jwt.sign(
      { 
        id: user.id,
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      username: req.user.username,
      role: req.user.role
    }
  });
});

app.post('/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Serve the frontend
app.get('/', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Start negotiation endpoint
app.post('/start', authenticateToken, upload.single('screenshot'), async (req, res) => {
  try {
    const { phoneNumber, prompt, orderNumber } = req.body;
    const screenshot = req.file;

    // Validation: Must have phone number
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Customer service phone number is required'
      });
    }

    // Validate phone number format and clean it
    const cleanPhoneNumber = phoneNumber.replace(/[\s-()]/g, '');
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(cleanPhoneNumber)) {
      return res.status(400).json({
        error: 'Please enter a valid phone number starting with + (e.g., +1-800-555-0123)'
      });
    }

    // Validation: Must have either order number or screenshot
    if (!orderNumber && !screenshot) {
      return res.status(400).json({
        error: 'Either order number or screenshot is required'
      });
    }

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required'
      });
    }

    // Generate unique negotiation ID
    const negotiationId = `neg_${++negotiationCounter}_${Date.now()}`;
    
    // Store negotiation in database
    await database.createNegotiation(req.user.id, {
      negotiation_id: negotiationId,
      phone_number: cleanPhoneNumber,
      user_message: prompt,
      order_number: orderNumber,
      screenshot_url: screenshot ? `/uploads/${screenshot.filename}` : null
    });

    // Store negotiation state in memory for backward compatibility
    negotiations[negotiationId] = {
      id: negotiationId,
      status: 'initiated',
      phoneNumber: cleanPhoneNumber,
      prompt,
      orderNumber,
      screenshot: screenshot ? screenshot.filename : null,
      result: null,
      createdAt: new Date().toISOString()
    };

    // Prepare data for Vapi
    const vapiData = {
      phoneNumber: cleanPhoneNumber,
      userMessage: prompt,
      orderNumber: orderNumber,
      screenshot: screenshot ? `/uploads/${screenshot.filename}` : null,
      negotiationId: negotiationId
    };

    console.log('Starting negotiation:', vapiData);
    
    // Use Vapi for real calls
    if (vapi && process.env.VAPI_API_KEY && process.env.VAPI_ASSISTANT_ID && process.env.VAPI_PHONE_NUMBER_ID) {
      try {
        console.log(`📞 Calling customer service: ${cleanPhoneNumber}`);
        
        const callResult = await vapi.startCall(
          cleanPhoneNumber,
          vapiData.userMessage,
          vapiData.orderNumber,
          vapiData.screenshot
        );
        
        negotiations[negotiationId].vapiCallId = callResult.id;
        negotiations[negotiationId].status = 'in_progress';
        
        console.log('✅ Vapi call started successfully:', callResult.id);
        console.log(`📞 Calling: ${phoneNumber}`);
        console.log(`🎯 Request type: ${vapi.detectRequestType(vapiData.userMessage)}`);
        
      } catch (error) {
        console.error('❌ Vapi call failed:', error.response?.data || error.message);
        negotiations[negotiationId].status = 'error';
        negotiations[negotiationId].error = error.message;
      }
    } else {
      console.log('❌ Vapi not configured. Please add VAPI_API_KEY, VAPI_ASSISTANT_ID, and VAPI_PHONE_NUMBER_ID to .env file');
      negotiations[negotiationId].status = 'error';
      negotiations[negotiationId].error = 'Vapi configuration incomplete';
    }

    res.json({
      success: true,
      negotiationId: negotiationId,
      message: 'Negotiation started successfully'
    });

  } catch (error) {
    console.error('Error starting negotiation:', error);
    res.status(500).json({
      error: 'Failed to start negotiation'
    });
  }
});

// Status endpoint for polling
app.get('/status/:negotiationId', authenticateToken, (req, res) => {
  const { negotiationId } = req.params;
  const negotiation = negotiations[negotiationId];

  if (!negotiation) {
    return res.status(404).json({
      error: 'Negotiation not found'
    });
  }

  res.json(negotiation);
});

// Webhook endpoint for Vapi results
app.post('/log', authenticateToken, (req, res) => {
  try {
    const { negotiationId, refund, code } = req.body;

    if (!negotiationId || !negotiations[negotiationId]) {
      return res.status(404).json({
        error: 'Negotiation not found'
      });
    }

    // Update negotiation with results
    negotiations[negotiationId].status = 'completed';
    negotiations[negotiationId].result = {
      refund: parseFloat(refund) || 0,
      confirmationCode: code || 'N/A',
      completedAt: new Date().toISOString()
    };

    console.log('Negotiation completed:', negotiations[negotiationId]);

    res.json({
      success: true,
      message: 'Results logged successfully'
    });

  } catch (error) {
    console.error('Error logging results:', error);
    res.status(500).json({
      error: 'Failed to log results'
    });
  }
});

// Mock CSR API endpoint
app.post('/mock-csr', (req, res) => {
  try {
    const { message, orderNumber } = req.body;
    
    // Simple response logic based on message content
    let response = '';
    
    if (message.toLowerCase().includes('refund') || message.toLowerCase().includes('return')) {
      // Simulate negotiation process
      const random = Math.random();
      if (random < 0.3) {
        response = mockCSRResponses.partialRefund[Math.floor(Math.random() * mockCSRResponses.partialRefund.length)];
      } else {
        response = mockCSRResponses.fullRefund[Math.floor(Math.random() * mockCSRResponses.fullRefund.length)];
      }
    } else if (message.toLowerCase().includes('confirmation') || message.toLowerCase().includes('code')) {
      response = mockCSRResponses.confirmation[Math.floor(Math.random() * mockCSRResponses.confirmation.length)];
    } else {
      response = mockCSRResponses.initial[Math.floor(Math.random() * mockCSRResponses.initial.length)];
    }

    res.json({
      response: response,
      orderNumber: orderNumber,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in mock CSR:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Get phone numbers endpoint
app.get('/phone-numbers', authenticateToken, async (req, res) => {
  try {
    if (!vapi || !process.env.VAPI_API_KEY) {
      return res.status(400).json({
        error: 'Vapi not configured'
      });
    }

    const phoneNumbers = await vapi.getPhoneNumbers();
    
    res.json({
      success: true,
      phoneNumbers: phoneNumbers
    });
  } catch (error) {
    console.error('Error getting phone numbers:', error);
    res.status(500).json({
      error: 'Failed to get phone numbers'
    });
  }
});

// Call monitoring endpoints
app.get('/calls', authenticateToken, async (req, res) => {
  try {
    if (!vapi || !process.env.VAPI_API_KEY) {
      return res.status(400).json({
        error: 'Vapi not configured'
      });
    }

    const { limit = 50, offset = 0 } = req.query;
    const calls = await vapi.getAllCalls(parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      calls: calls,
      total: calls.length
    });
  } catch (error) {
    console.error('Error getting calls:', error);
    res.status(500).json({
      error: 'Failed to get calls'
    });
  }
});

// Get specific call details
app.get('/calls/:callId', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!vapi || !process.env.VAPI_API_KEY) {
      return res.status(400).json({
        error: 'Vapi not configured'
      });
    }

    const callDetails = await vapi.getCallStatus(callId);
    const recording = await vapi.getCallRecording(callId).catch(() => null);
    
    res.json({
      success: true,
      call: callDetails,
      recording: recording
    });
  } catch (error) {
    console.error('Error getting call details:', error);
    res.status(500).json({
      error: 'Failed to get call details'
    });
  }
});

// Get call transcript
app.get('/calls/:callId/transcript', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!vapi || !process.env.VAPI_API_KEY) {
      return res.status(400).json({
        error: 'Vapi not configured'
      });
    }

    const transcript = await vapi.getCallTranscript(callId);
    
    res.json({
      success: true,
      transcript: transcript
    });
  } catch (error) {
    console.error('Error getting call transcript:', error);
    res.status(500).json({
      error: 'Failed to get call transcript'
    });
  }
});

// Get call events (real-time monitoring)
app.get('/calls/:callId/events', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!vapi || !process.env.VAPI_API_KEY) {
      return res.status(400).json({
        error: 'Vapi not configured'
      });
    }

    const events = await vapi.getCallEvents(callId);
    
    res.json({
      success: true,
      events: events
    });
  } catch (error) {
    console.error('Error getting call events:', error);
    res.status(500).json({
      error: 'Failed to get call events'
    });
  }
});

// Simulate negotiation process (replace with actual Vapi integration)
function simulateNegotiation(negotiationId) {
  console.log(`Simulating negotiation for ${negotiationId}`);
  
  // Update status to in progress
  negotiations[negotiationId].status = 'in_progress';
  
  // Simulate negotiation duration (5-10 seconds)
  const duration = 5000 + Math.random() * 5000;
  
  setTimeout(() => {
    // Simulate successful negotiation
    const refundAmount = 10 + Math.random() * 20; // $10-$30
    const confirmationCode = `REF-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    
    // Update with results
    negotiations[negotiationId].status = 'completed';
    negotiations[negotiationId].result = {
      refund: parseFloat(refundAmount.toFixed(2)),
      confirmationCode: confirmationCode,
      completedAt: new Date().toISOString()
    };
    
    console.log(`Negotiation completed for ${negotiationId}:`, negotiations[negotiationId].result);
  }, duration);
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 5MB.'
      });
    }
  }
  
  res.status(500).json({
    error: error.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Vapi Negotiation System is ready!');
});
