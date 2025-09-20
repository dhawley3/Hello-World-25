#!/usr/bin/env node

/**
 * Test script for the Vapi Customer Service Negotiation System
 * Run this to verify the system is working correctly
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function testSystem() {
  console.log('🧪 Testing Vapi Customer Service Negotiation System...\n');

  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server connection...');
    try {
      await axios.get(`${BASE_URL}/`);
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server is not running. Please start it with: npm start');
      return;
    }

    // Test 2: Test /start endpoint with order number
    console.log('\n2️⃣ Testing negotiation with order number...');
    const formData1 = new FormData();
    formData1.append('prompt', 'Get me a refund for my Chipotle order');
    formData1.append('orderNumber', 'CHIP-12345');

    const response1 = await axios.post(`${BASE_URL}/start`, formData1, {
      headers: formData1.getHeaders()
    });

    if (response1.data.success) {
      console.log('✅ Negotiation started successfully');
      console.log(`   Negotiation ID: ${response1.data.negotiationId}`);
      
      // Test 3: Test status polling
      console.log('\n3️⃣ Testing status polling...');
      const negotiationId = response1.data.negotiationId;
      
      // Poll status for a few iterations
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const statusResponse = await axios.get(`${BASE_URL}/status/${negotiationId}`);
          const status = statusResponse.data;
          
          console.log(`   Status: ${status.status} (${i + 1}/5)`);
          
          if (status.status === 'completed') {
            console.log('✅ Negotiation completed successfully!');
            console.log(`   Refund: $${status.result.refund}`);
            console.log(`   Confirmation Code: ${status.result.confirmationCode}`);
            break;
          }
        } catch (error) {
          console.log(`   Error polling status: ${error.message}`);
        }
      }
    } else {
      console.log('❌ Failed to start negotiation:', response1.data.error);
    }

    // Test 4: Test mock CSR endpoint
    console.log('\n4️⃣ Testing mock CSR endpoint...');
    const csrResponse = await axios.post(`${BASE_URL}/mock-csr`, {
      message: 'I need a refund for order CHIP-12345',
      orderNumber: 'CHIP-12345'
    });

    if (csrResponse.data.response) {
      console.log('✅ Mock CSR responding correctly');
      console.log(`   Response: ${csrResponse.data.response}`);
    } else {
      console.log('❌ Mock CSR not responding correctly');
    }

    // Test 5: Test validation (should fail)
    console.log('\n5️⃣ Testing input validation...');
    try {
      const formData2 = new FormData();
      formData2.append('prompt', 'Get me a refund');
      // No order number or screenshot

      const response2 = await axios.post(`${BASE_URL}/start`, formData2, {
        headers: formData2.getHeaders()
      });

      if (!response2.data.success && response2.data.error) {
        console.log('✅ Input validation working correctly');
        console.log(`   Error message: ${response2.data.error}`);
      } else {
        console.log('❌ Input validation not working correctly');
      }
    } catch (error) {
      if (error.response && error.response.data.error) {
        console.log('✅ Input validation working correctly');
        console.log(`   Error message: ${error.response.data.error}`);
      } else {
        console.log('❌ Input validation test failed:', error.message);
      }
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Open http://localhost:3000 in your browser');
    console.log('   2. Try the web interface');
    console.log('   3. Configure Vapi API key for real voice calls');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testSystem();
}

module.exports = { testSystem };
