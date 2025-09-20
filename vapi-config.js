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

  // Create or get assistant configuration
  async createAssistant() {
    const assistantConfig = {
      name: "Customer Service Negotiator",
      model: {
        provider: "openai",
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an AI negotiator that takes the user's request and order details and speaks to customer service on their behalf.

Your persona: Professional, polite, but persistent negotiator who advocates for the customer.

Instructions:
1. Always clearly state the order number or refer to the uploaded screenshot at the start of the call.
2. Be specific about the customer's request (refund, return, bill negotiation).
3. If partial refund is offered, politely insist on the full refund with reasoning.
4. Stay calm and professional throughout the negotiation.
5. Always end the call by asking for a confirmation code.
6. On completion, POST the results { refund: amount, code: "confirmation_code" } to the webhook URL.

Example conversation flow:
- "Hello, I'm calling on behalf of a customer regarding order [ORDER_NUMBER]"
- "The customer is requesting a full refund due to [REASON]"
- "I understand you can only offer $X, but given the circumstances, could we discuss the full refund amount of $Y?"
- "Thank you for your assistance. Could you please provide a confirmation code for this transaction?"

Remember: Always be respectful but firm in advocating for the customer's needs.`
          }
        ]
      },
      voice: {
        provider: "elevenlabs",
        voiceId: "21m00Tcm4TlvDq8ikWAM" // Professional female voice
      },
      firstMessage: "Hello, I'm calling on behalf of a customer regarding their order. How can I help you today?",
      serverUrl: process.env.SERVER_URL || "http://localhost:3000",
      serverUrlSecret: "vapi_webhook_secret",
      endCallMessage: "Thank you for your time. Have a great day!",
      endCallPhrases: ["thank you", "goodbye", "have a good day", "bye"],
      maxDurationSeconds: 300, // 5 minutes max
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

  // Start a call with the assistant
  async startCall(customerPhoneNumber, userMessage, orderNumber, screenshotUrl = null) {
    const callConfig = {
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: customerPhoneNumber
      },
      metadata: {
        userMessage: userMessage,
        orderNumber: orderNumber,
        screenshotUrl: screenshotUrl
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
