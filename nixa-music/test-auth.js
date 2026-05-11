const axios = require('axios');

async function testAuth() {
  try {
    // Test login
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@nixa.com',
      password: 'admin123'
    });
    
    console.log('Login successful:', loginResponse.data);
    
    // Test finance API with token
    const token = loginResponse.data.token;
    const financeResponse = await axios.get('http://localhost:5000/api/finance/summary', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Finance API response:', financeResponse.data);
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testAuth();
