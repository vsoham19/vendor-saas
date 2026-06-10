const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testNonExistentUUID() {
  console.log('\n--- 1. Testing Non-Existent UUID ---');
  const nonExistentUuid = 'd290f1ee-6c54-4b01-90e6-d701748f0899';
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, full_name, phone, email, address, notes, total_outstanding')
      .eq('id', nonExistentUuid)
      .single();

    console.log('Data:', data);
    console.log('Error:', error);
  } catch (err) {
    console.error('Caught Exception:', err);
  }
}

async function testInvalidUUID() {
  console.log('\n--- 2. Testing Invalid UUID Format ---');
  const invalidUuid = 'invalid-uuid-format';
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, full_name, phone, email, address, notes, total_outstanding')
      .eq('id', invalidUuid)
      .single();

    console.log('Data:', data);
    console.log('Error:', error);
  } catch (err) {
    console.error('Caught Exception:', err);
  }
}

function testNumericCasting() {
  console.log('\n--- 3. Testing Numeric Casting on Undefined/Null/String ---');
  const testCases = [
    { label: 'undefined', val: undefined },
    { label: 'null', val: null },
    { label: 'empty string', val: '' },
    { label: 'valid number', val: 123.45 },
    { label: 'string number', val: '123.45' },
    { label: 'NaN string', val: 'abc' }
  ];

  for (const tc of testCases) {
    try {
      const casted = Number(tc.val || 0);
      const formatted = casted.toLocaleString('en-IN');
      console.log(`Input: ${tc.label} (${tc.val}) -> Casted: ${casted} -> Formatted: ₹${formatted}`);
    } catch (err) {
      console.error(`Input: ${tc.label} failed:`, err.message);
    }
  }
}

async function run() {
  await testNonExistentUUID();
  await testInvalidUUID();
  testNumericCasting();
}

run();
