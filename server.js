const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const VapiIntegration = require('./vapi-config');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start negotiation endpoint
app.post('/start', upload.single('screenshot'), async (req, res) => {
  try {
    const { prompt, orderNumber } = req.body;
    const screenshot = req.file;

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
    
    // Store negotiation state
    negotiations[negotiationId] = {
      id: negotiationId,
      status: 'initiated',
      prompt,
      orderNumber,
      screenshot: screenshot ? screenshot.filename : null,
      result: null,
      createdAt: new Date().toISOString()
    };

    // Prepare data for Vapi
    const vapiData = {
      userMessage: prompt,
      orderNumber: orderNumber,
      screenshot: screenshot ? `/uploads/${screenshot.filename}` : null,
      negotiationId: negotiationId
    };

    console.log('Starting negotiation:', vapiData);
    
    // Try to use Vapi if configured, otherwise simulate
    if (vapi && process.env.VAPI_ASSISTANT_ID) {
      try {
        // For demo purposes, we'll use a mock phone number
        // In production, you'd want to use actual customer service numbers
        const mockCSRNumber = "+1234567890"; // Replace with actual CSR number
        
        const callResult = await vapi.startCall(
          mockCSRNumber,
          vapiData.userMessage,
          vapiData.orderNumber,
          vapiData.screenshot
        );
        
        negotiations[negotiationId].vapiCallId = callResult.id;
        negotiations[negotiationId].status = 'in_progress';
        
        console.log('Vapi call started:', callResult.id);
      } catch (error) {
        console.error('Vapi call failed, falling back to simulation:', error);
        // Fall back to simulation if Vapi fails
        setTimeout(() => {
          simulateNegotiation(negotiationId);
        }, 2000);
      }
    } else {
      console.log('Vapi not configured, using simulation');
      // Simulate Vapi call if not configured
      setTimeout(() => {
        simulateNegotiation(negotiationId);
      }, 2000);
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
app.get('/status/:negotiationId', (req, res) => {
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
app.post('/log', (req, res) => {
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
