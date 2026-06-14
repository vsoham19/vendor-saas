const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabaseAdmin } = require('../dist/src/config/supabase');

// Mock request and response
const req = {
  body: {
    name: 'soham_assistant',
    email: 'soham_assistant@gmail.com',
    password: 'password123',
    vendor_id: 'be1fcfab-75cb-4825-aaa1-04b6af7f130c' // Bebo's vendor ID
  },
  user: {
    id: '8a8a3d72-ef57-4182-9c7f-b23493885f5e' // Isha's auth_user_id
  }
};

const res = {
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log(`Response Status: ${this.statusCode || 200}`);
    console.log('Response JSON:', data);
  }
};

const next = (err) => {
  console.error('Next called with error:', err);
};

async function test() {
  try {
    console.log('--- Direct Staff Invite Handler Test ---');
    // Load the route handler
    const staffRoutes = require('../dist/src/routes/staff').default;
    
    // Find the invite handler inside the router
    const inviteLayer = staffRoutes.stack.find(layer => layer.route && layer.route.path === '/invite');
    if (!inviteLayer) {
      throw new Error('Could not find /invite route layer');
    }
    
    const inviteHandler = inviteLayer.route.stack[0].handle;
    
    console.log('Invoking inviteHandler...');
    await inviteHandler(req, res, next);
  } catch (err) {
    console.error('Test script error:', err);
  }
}

test();
