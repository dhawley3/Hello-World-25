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

  // Update existing assistant with dynamic prompt based on user request
  async updateAssistant(userMessage, orderNumber, screenshotUrl, requestType) {
    // Determine the specific system prompt based on request type
    const systemPrompt = this.getSystemPrompt(requestType, userMessage, orderNumber);
    
    const assistantConfig = {
      name: `billbreaker - ${requestType}`,
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          }
        ]
      },
      voice: {
        provider: "vapi",
        voiceId: "Elliot"
      },
      firstMessage: "Hello.",
      voicemailMessage: "Please call back when you're available.",
      endCallMessage: "Goodbye.",
      transcriber: {
        model: "nova-2",
        language: "en",
        provider: "deepgram"
      }
    };

    try {
      // Update the existing assistant with the new configuration
      const response = await axios.patch(
        `${this.baseURL}/assistant/${process.env.VAPI_ASSISTANT_ID}`,
        assistantConfig,
        { headers: this.headers }
      );
      
      console.log('Assistant updated:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating assistant:', error.response?.data || error.message);
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
    } else if (message.includes('cancel') || message.includes('subscription') || message.includes('rate')) {
      return 'subscription';
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
3. Generate questions to ask about the return process and timeline.
4. Draft questions about return policy details and restocking fees and confirm with the customer.
5. Get confirmation code or return authorization number.
6. Generate a script for explaining what item needs to be returned and why
7. End with: "Thank you. Could I get a return authorization number or confirmation code?"

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

      case 'subscription':
        return `${basePrompt}

SPECIFIC INSTRUCTIONS FOR SUBSCRIPTION CANCELLATIONS:
1. Start by saying: "Hello, I'm calling about my bill ${orderNumber || 'account'}."
2. Generate an opening statement for canceling a subscription with account number ABC123.
3. Generate an explanation for canceling because the service doesn't meet expectations.
4. Create a script for canceling due to duplicate charges or billing errors.
5. Generate a script for canceling due to technical issues with the service.
6. Write a script for disputing incorrect charges before canceling.
7. Be persistent but respectful in seeking fair resolution.
8. Get confirmation of any changes made to the account.
9. End with: "Thank you. Could I get a confirmation code for these changes?"

REMEMBER: It may take time. Be patient but persistent.`;

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
    
    // First update the existing assistant with the new configuration
    await this.updateAssistant(userMessage, orderNumber, screenshotUrl, requestType);
    
    const callConfig = {
      assistantId: process.env.VAPI_ASSISTANT_ID,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: {
        number: customerPhoneNumber
      },
      metadata: {
        userMessage: userMessage,
        orderNumber: orderNumber,
        screenshotUrl: screenshotUrl,
        requestType: requestType,
        startTime: new Date().toISOString()
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

  // Get call recording URL
  async getCallRecording(callId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/call/${callId}`,
        { headers: this.headers }
      );
      
      return {
        recordingUrl: response.data.recordingUrl,
        transcriptionUrl: response.data.transcriptionUrl,
        duration: response.data.duration
      };
    } catch (error) {
      console.error('Error getting call recording:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get call transcript
  async getCallTranscript(callId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/call/${callId}/transcript`,
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting call transcript:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get call events (real-time monitoring)
  async getCallEvents(callId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/call/${callId}/events`,
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting call events:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get all calls with filtering
  async getAllCalls(limit = 50, offset = 0) {
    try {
      const response = await axios.get(
        `${this.baseURL}/call?limit=${limit}&offset=${offset}`,
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting all calls:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get all phone numbers
  async getPhoneNumbers() {
    try {
      const response = await axios.get(
        `${this.baseURL}/phone-number`,
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting phone numbers:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = VapiIntegration;
