const axios = require('axios');

async function testServer() {
    try {
        const baseUrl = 'http://localhost:8000';
        
        console.log('🧪 Testing DTZ_NOVA_XMD Server...\n');
        
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthRes = await axios.get(`${baseUrl}/health`);
        console.log('✅ Health:', healthRes.data);
        
        // Test status endpoint
        console.log('\n2. Testing status endpoint...');
        const statusRes = await axios.get(`${baseUrl}/status`);
        console.log('✅ Status:', statusRes.data);
        
        // Test homepage
        console.log('\n3. Testing homepage...');
        const homeRes = await axios.get(`${baseUrl}/`);
        console.log('✅ Homepage loaded (status:', homeRes.status, ')');
        
        // Test QR page
        console.log('\n4. Testing QR page...');
        const qrRes = await axios.get(`${baseUrl}/qr`);
        console.log('✅ QR page loaded (status:', qrRes.status, ')');
        
        // Test Pair page
        console.log('\n5. Testing Pair page...');
        const pairRes = await axios.get(`${baseUrl}/pair`);
        console.log('✅ Pair page loaded (status:', pairRes.status, ')');
        
        console.log('\n🎉 All tests passed! Server is running correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testServer();
