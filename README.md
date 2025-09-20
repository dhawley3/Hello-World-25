# 🤖 Vapi Customer Service Negotiation System

An AI-powered customer service negotiation system that uses Vapi to automatically handle refunds, returns, and bill negotiations on behalf of users.

## 🚀 Features

- **AI-Powered Negotiation**: Uses Vapi to make voice calls to customer service representatives
- **Smart Validation**: Requires either order number or screenshot upload
- **Real-time Updates**: Frontend polls backend for negotiation status
- **File Upload Support**: Upload order screenshots for verification
- **Mock CSR Integration**: Simulated customer service responses for testing
- **Beautiful UI**: Modern, responsive frontend with real-time status updates

## 📋 Requirements

- Node.js (v14 or higher)
- npm or yarn
- Vapi API key (optional - falls back to simulation mode)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dhawley3/Hello-World-25.git
   cd Hello-World-25
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file:
   ```env
   # Vapi Configuration (Required for real voice calls)
   VAPI_API_KEY=your_vapi_api_key_here
   CUSTOMER_SERVICE_NUMBER=+1234567890
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   SERVER_URL=http://localhost:3000
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔧 How It Works

### Flow Overview

1. **User Input**: User provides a prompt (e.g., "Get me a refund for my Chipotle order") and either an order number or screenshot
2. **Validation**: Backend validates that either order number or screenshot is provided
3. **AI Negotiation**: Vapi agent makes a voice call to customer service (or simulates if not configured)
4. **Real-time Updates**: Frontend polls `/status` endpoint for updates
5. **Results**: Webhook receives negotiation results and updates the UI

### API Endpoints

- `POST /start` - Start a new negotiation
- `GET /status/:id` - Get negotiation status
- `POST /log` - Webhook for Vapi results
- `POST /mock-csr` - Mock customer service responses

### File Structure

```
├── server.js              # Main Express server
├── vapi-config.js         # Vapi integration class
├── package.json           # Dependencies and scripts
├── public/
│   └── index.html         # Frontend interface
├── uploads/               # Screenshot uploads (auto-created)
└── README.md             # This file
```

## 🎯 Usage

1. **Open the frontend** at `http://localhost:3000`

2. **Enter your request** in the prompt field:
   - "Get me a refund for my Chipotle order"
   - "I want to return this defective product"
   - "Negotiate my internet bill"

3. **Provide order information**:
   - Enter order number (e.g., "ORDER-12345")
   - OR upload a screenshot of your order

4. **Click "Start AI Negotiation"**

5. **Watch the magic happen**:
   - Status updates in real-time
   - AI agent negotiates on your behalf
   - Results displayed when complete

## 🔌 Vapi Integration

### Setup Vapi (Required for Real Calls)

1. **Get Vapi API Key**
   - Sign up at [vapi.ai](https://vapi.ai)
   - Get your API key from the dashboard
   - Add it to your `.env` file as `VAPI_API_KEY`

2. **Configure Customer Service Number**
   - Set `CUSTOMER_SERVICE_NUMBER` in your `.env` file
   - Use the actual customer service number you want to call
   - For testing, you can use your own number

3. **Dynamic Agent Behavior**
   - The system automatically detects request type (refund, return, appointment, bill)
   - Creates specialized AI agents for each scenario
   - Each agent has tailored conversation flows and negotiation strategies

4. **Real Voice Calls**
   - The AI will make actual phone calls to customer service
   - Agents adapt their approach based on the customer's specific request
   - All calls include proper greetings and professional conversation flow

### Request Types Supported

- **Refunds**: "Get me a refund for my order"
- **Returns**: "I want to return this product"
- **Appointments**: "Cancel my appointment"
- **Bill Negotiations**: "Negotiate my internet bill"
- **General**: Any other customer service request

## 🎨 Frontend Features

- **Modern UI**: Beautiful gradient design with responsive layout
- **File Upload**: Drag-and-drop or click to upload screenshots
- **Real-time Status**: Live updates during negotiation
- **Error Handling**: Clear error messages and validation
- **Results Display**: Shows refund amount and confirmation code

## 🧪 Testing

### Test Scenarios

1. **Valid Order Number**
   ```
   Prompt: "Get me a refund for my Chipotle order"
   Order Number: "CHIP-12345"
   ```

2. **Screenshot Upload**
   ```
   Prompt: "Return this defective product"
   Screenshot: [upload order screenshot]
   ```

3. **Error Cases**
   - No order number or screenshot
   - Empty prompt
   - Invalid file types

### Mock CSR Responses

The system includes realistic customer service responses:
- Initial greetings
- Partial refund offers
- Full refund approvals
- Confirmation codes

## 🚀 Deployment

### Environment Variables

```env
PORT=3000
NODE_ENV=production
VAPI_API_KEY=your_production_vapi_key
VAPI_ASSISTANT_ID=your_assistant_id
SERVER_URL=https://your-domain.com
```

### Production Considerations

- Use a database instead of in-memory storage
- Implement proper authentication
- Add rate limiting
- Set up proper logging
- Use HTTPS for file uploads
- Configure proper CORS settings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check the console logs for debugging
- Ensure all environment variables are set
- Verify file upload permissions
- Check Vapi API key validity

## 🎉 Demo

Try these example prompts:
- "Get me a refund for my delayed Amazon order ORDER-AMZ-789"
- "Return this broken iPhone case" (upload screenshot)
- "Negotiate my $120 internet bill down to $80"

The AI agent will handle the entire negotiation process and report back with results!

---

**Built with ❤️ using Vapi, Express, and modern web technologies**
