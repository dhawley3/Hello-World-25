const axios = require('axios');

class VapiIntegration {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.vapi.ai';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Create or get assistant configuration based on user request
  async createAssistant(userMessage, orderNumber, screenshotUrl, requestType) {
    // Determine the specific system prompt based on request type
    const systemPrompt = this.getSystemPrompt(requestType, userMessage, orderNumber);
    
    const assistantConfig = {
      name: `Customer Service Agent - ${requestType}`,
      model: {
        provider: "openai",
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt
          }
        ]
      },
      voice: {
        provider: "elevenlabs",
        voiceId: "21m00Tcm4TlvDq8ikWAM" // Professional female voice
      },
      firstMessage: "Hello, how can I help you today?",
      serverUrl: process.env.SERVER_URL || "http://localhost:3000",
      serverUrlSecret: "vapi_webhook_secret",
      endCallMessage: "Thank you for your time. Have a great day!",
      endCallPhrases: ["thank you", "goodbye", "have a good day", "bye"],
      maxDurationSeconds: 600, // 10 minutes max for complex negotiations
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 1,
      interruptionThreshold: 500,
      voicemailDetection: false,
      backgroundSound: "off",
      webhook: {
        url: `${process.env.SERVER_URL || "http://localhost:3000"}/log`,
        secret: "vapi_webhook_secret"
      }
    };

    try {
      const response = await axios.post(
        `${this.baseURL}/assistant`,
        assistantConfig,
        { headers: this.headers }
      );
      
      console.log('Assistant created:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating assistant:', error.response?.data || error.message);
      throw error;
    }
  }

  // Detect request type from user message
  detectRequestType(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('refund') || message.includes('money back')) {
      return 'refund';
    } else if (message.includes('return') || message.includes('send back')) {
      return 'return';
    } else if (message.includes('cancel') && (message.includes('appointment') || message.includes('booking'))) {
      return 'appointment';
    } else if (message.includes('bill') || message.includes('charge') || message.includes('rate') || message.includes('negotiate')) {
      return 'bill';
    } else {
      return 'general';
    }
  }

  // Get system prompt based on request type
  getSystemPrompt(requestType, userMessage, orderNumber) {
    const basePrompt = `You are a professional AI assistant calling customer service on behalf of a customer. You have the following information:
- Customer Request: "${userMessage}"
- Order/Reference Number: "${orderNumber || 'Not provided - customer has screenshot'}"
- Request Type: ${requestType}

You are calling to resolve this issue. Be polite, professional, and persistent.`;

    switch (requestType.toLowerCase()) {
      case 'refund':
        return `${basePrompt}

SPECIFIC INSTRUCTIONS FOR REFUND REQUESTS:
1. Start by saying: "Hello, I'm calling about a refund request for order ${orderNumber || 'the attached screenshot'}."
2. Explain the customer's situation and why they need a refund.
3. If offered a partial refund, politely insist on the full amount with valid reasoning.
4. Always ask for a confirmation code or reference number at the end.
5. End with: "Thank you for your help. Could I get a confirmation code for this refund?"

REMEMBER: Be firm but respectful. The customer deserves a fair resolution.`;

      case 'return':
        return `${basePrompt}

SPECIFIC INSTRUCTIONS FOR RETURN REQUESTS:
1. Start by saying: "Hello, I'm calling about a return request for order ${orderNumber || 'the attached screenshot'}."
2. Explain what the customer wants to return and why.
3. Inquire about return process, shipping labels, and refund timeline.
4. Confirm return policy details and any restocking fees.
5. Get confirmation code or return authorization number.
6. End with: "Thank you. Could I get a return authorization number or confirmation code?"

REMEMBER: Ensure the customer understands the return process completely.`;

      case 'appointment':
        return `${basePrompt}

SPECIFIC INSTRUCTIONS FOR APPOINTMENT CANCELLATIONS:
1. Start by saying: "Hello, I'm calling to cancel an appointment for ${orderNumber || 'the attached screenshot'}."
2. Provide appointment details if available.
3. Confirm cancellation policy and any fees.
4. Ask about rescheduling options if appropriate.
5. Get confirmation of cancellation.
6. End with: "Thank you. Could I get a cancellation confirmation number?"

REMEMBER: Be clear about cancellation policies and any associated fees.`;

      case 'bill':
        return `${basePrompt}

SPECIFIC INSTRUCTIONS FOR BILL NEGOTIATIONS:
1. Start by saying: "Hello, I'm calling about my bill ${orderNumber || 'account'}."
2. Explain the customer's concerns about their current charges.
3. Negotiate for better rates or dispute incorrect charges.
4. Be persistent but respectful in seeking fair resolution.
5. Get confirmation of any changes made to the account.
6. End with: "Thank you. Could I get a confirmation code for these changes?"

REMEMBER: Bill negotiations may take time. Be patient but persistent.`;

      default:
        return `${basePrompt}

GENERAL INSTRUCTIONS:
1. Start by saying: "Hello, I'm calling about ${orderNumber || 'the attached screenshot'}."
2. Clearly explain the customer's request: "${userMessage}"
3. Work with the representative to resolve the issue.
4. Be persistent but always professional and polite.
5. Always ask for a confirmation code or reference number.
6. End with: "Thank you for your help. Could I get a confirmation code for this?"

REMEMBER: Your goal is to get the best possible outcome for the customer.`;
    }
  }

  // Start a call with the assistant
  async startCall(customerPhoneNumber, userMessage, orderNumber, screenshotUrl = null) {
    // Detect request type from user message
    const requestType = this.detectRequestType(userMessage);
    
    // First create a dynamic assistant based on the request type
    const assistant = await this.createAssistant(userMessage, orderNumber, screenshotUrl, requestType);
    
    const callConfig = {
      assistantId: assistant.id,
      customer: {
        number: customerPhoneNumber
      },
      metadata: {
        userMessage: userMessage,
        orderNumber: orderNumber,
        screenshotUrl: screenshotUrl,
        requestType: requestType,
        assistantId: assistant.id
      }
    };

    try {
      const response = await axios.post(
        `${this.baseURL}/call`,
        callConfig,
        { headers: this.headers }
      );
      
      console.log('Call started:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error starting call:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get call status
  async getCallStatus(callId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/call/${callId}`,
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting call status:', error.response?.data || error.message);
      throw error;
    }
  }

  // End a call
  async endCall(callId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/call/${callId}/end`,
        {},
        { headers: this.headers }
      );
      
      console.log('Call ended:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error ending call:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = VapiIntegration;
