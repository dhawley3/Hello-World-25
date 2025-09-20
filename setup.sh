#!/bin/bash

# Vapi Customer Service Negotiation System Setup Script

echo "🤖 Setting up Vapi Customer Service Negotiation System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "📥 Please install Node.js from https://nodejs.org/"
    echo "   Or use a package manager:"
    echo "   - macOS: brew install node"
    echo "   - Ubuntu: sudo apt install nodejs npm"
    echo "   - Windows: Download from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    echo "📥 Please install npm or use a Node.js installer that includes npm"
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created. Please edit it with your Vapi API key (optional)"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "🚀 Setup complete! You can now start the server:"
    echo "   npm start"
    echo ""
    echo "🌐 Then open http://localhost:3000 in your browser"
    echo ""
    echo "📚 For more information, see README.md"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
