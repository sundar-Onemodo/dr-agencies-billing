/**
 * DR Agencies Billing Backend - API Integration Test Script
 * Run this script with: node test-api.js
 * 
 * Note: Ensure the backend server is running and a valid SUPABASE_ANON_KEY is configured in .env.
 */

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

const timestamp = Date.now();
const testUser = {
  name: 'DR Agencies Merchant',
  email: 'yuvi12@gmail.com',
  password: 'Yuvi12'
};

let jwtToken = '';
let createdProductId = '';
let createdBillId = '';

// Helper to log test steps
function logStep(name, success, info = '') {
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`[${status}] ${name} ${info ? `- ${JSON.stringify(info)}` : ''}`);
}

async function runTests() {
  console.log(`\n==================================================`);
  console.log(`Starting API Integration Tests against: ${BASE_URL}`);
  console.log(`==================================================\n`);

  try {
    // 1. Health check (unprotected)
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    logStep('GET /health', healthRes.ok, healthData);

    if (!healthRes.ok) throw new Error('Health check failed, stopping tests.');

    // 2. Access protected route without token (should fail with 401)
    const unauthorizedRes = await fetch(`${BASE_URL}/store/me`);
    const unauthorizedData = await unauthorizedRes.json();
    logStep(
      'GET /store/me (Without Auth Token)', 
      unauthorizedRes.status === 401, 
      `Status: ${unauthorizedRes.status}, Error: ${unauthorizedData.error}`
    );

    // 3. Register user (unprotected)
    console.log(`\nRegistering test user: ${testUser.email}...`);
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const registerData = await registerRes.json();
    logStep('POST /auth/register', registerRes.ok, registerData);

    if (!registerRes.ok) {
      console.log('⚠️ Registration failed. If user already exists or email verification is required, trying login directly...');
    }

    // 4. Login user (unprotected)
    console.log('\nLogging in test user...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    const loginData = await loginRes.json();
    logStep('POST /auth/login', loginRes.ok, loginRes.ok ? { email: testUser.email, tokenReceived: !!loginData.token } : loginData);

    if (!loginRes.ok) {
      console.error('\n❌ Login failed. Tests cannot continue without a JWT token.');
      console.error('If email confirmation is enabled in your Supabase Auth, you must disable it in the Supabase Dashboard under Authentication -> Providers -> Email -> Confirm email.');
      return;
    }

    jwtToken = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    };

    // 5. Store profile - Save (protected)
    console.log('\nSaving Store Profile...');
    const storeProfile = {
      name: 'DR Agencies Test Store',
      address: '123 Main St, Bangalore, India',
      gstin: '29ABCDE1234F1Z1',
      phone: '+91 99999 88888',
      email: testUser.email,
      bankName: 'ICICI Bank',
      accountName: 'DR Agencies Test Store',
      accountNo: '1234567890',
      ifsc: 'ICIC0001234'
    };
    const saveStoreRes = await fetch(`${BASE_URL}/store/save`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(storeProfile)
    });
    const saveStoreData = await saveStoreRes.json();
    logStep('POST /store/save', saveStoreRes.ok, saveStoreData);

    // 6. Store profile - Fetch (protected)
    const getStoreRes = await fetch(`${BASE_URL}/store/me`, { headers: authHeaders });
    const getStoreData = await getStoreRes.json();
    logStep('GET /store/me', getStoreRes.ok, getStoreData);

    // 7. Add Product (protected)
    console.log('\nAdding a Product...');
    const productData = {
      name: 'Test Copper Cable 1.5mm',
      price: 1500.00,
      gstRate: 18
    };
    const addProductRes = await fetch(`${BASE_URL}/products/add`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(productData)
    });
    const addProductData = await addProductRes.json();
    logStep('POST /products/add', addProductRes.ok, addProductData);

    if (addProductRes.ok) {
      createdProductId = addProductData.product.id;
    }

    // 8. List Products (protected)
    const listProductsRes = await fetch(`${BASE_URL}/products/list`, { headers: authHeaders });
    const listProductsData = await listProductsRes.json();
    logStep('GET /products/list', listProductsRes.ok, { count: listProductsData.products?.length });

    // 9. Create Bill/Invoice (protected)
    console.log('\nCreating a Bill...');
    const billData = {
      customerName: 'Karan Electricals',
      invoiceNumber: `INV-TEST-${timestamp}`,
      subtotal: 1500.00,
      cgst: 135.00,
      sgst: 135.00,
      total: 1770.00,
      items: [
        {
          productId: createdProductId,
          name: 'Test Copper Cable 1.5mm',
          qty: 1,
          price: 1500.00,
          amount: 1500.00
        }
      ]
    };
    const createBillRes = await fetch(`${BASE_URL}/bills/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(billData)
    });
    const createBillData = await createBillRes.json();
    logStep('POST /bills/create', createBillRes.ok, createBillData);

    if (createBillRes.ok) {
      createdBillId = createBillData.bill.id;
    }

    // 10. Get Recent Bills (protected)
    const recentBillsRes = await fetch(`${BASE_URL}/bills/recent`, { headers: authHeaders });
    const recentBillsData = await recentBillsRes.json();
    logStep('GET /bills/recent', recentBillsRes.ok, { count: recentBillsData.bills?.length });

    // 11. Get Bill Details by ID (protected)
    if (createdBillId) {
      const getBillRes = await fetch(`${BASE_URL}/bills/${createdBillId}`, { headers: authHeaders });
      const getBillData = await getBillRes.json();
      logStep(`GET /bills/:id (${createdBillId})`, getBillRes.ok, getBillData);
    }

    // 12. Get Reports Summary (protected)
    const todayStr = new Date().toISOString().split('T')[0];
    const reportRes = await fetch(`${BASE_URL}/reports/summary?from=${todayStr}&to=${todayStr}`, { headers: authHeaders });
    const reportData = await reportRes.json();
    logStep(`GET /reports/summary?from=${todayStr}&to=${todayStr}`, reportRes.ok, reportData);

    // 13. Delete product (protected)
    if (createdProductId) {
      console.log('\nCleaning up - Deleting created Product...');
      const deleteProductRes = await fetch(`${BASE_URL}/products/${createdProductId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const deleteProductData = await deleteProductRes.json();
      logStep(`DELETE /products/:id (${createdProductId})`, deleteProductRes.ok, deleteProductData);
    }

    console.log(`\n==================================================`);
    console.log(`API Verification Completed successfully!`);
    console.log(`==================================================\n`);

  } catch (error) {
    console.error('\n❌ Test execution failed due to an unexpected exception:', error);
  }
}

runTests();
