import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { WooCommerceOrder, JobStatus, OrderNote, MaterialItem } from '../src/types';

dotenv.config();

const app = express();

// Enable JSON bodies with higher limit for photos/signatures
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Logging middleware to trace incoming requests and response status codes
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[HTTP_LOG] INCOMING: ${req.method} ${req.url}`);
  const oldJson = res.json;
  res.json = function (body) {
    console.log(`[HTTP_LOG] OUTGOING: ${req.method} ${req.url} - Status: ${res.statusCode} (${Date.now() - start}ms) - JSON:`, JSON.stringify(body).slice(0, 200));
    return oldJson.call(this, body);
  };
  const oldSend = res.send;
  res.send = function (body) {
    console.log(`[HTTP_LOG] OUTGOING: ${req.method} ${req.url} - Status: ${res.statusCode} (${Date.now() - start}ms)`);
    return oldSend.call(this, body);
  };
  next();
});

// File-based state persistence for robust developer experience
const STORE_PATH = process.env.VERCEL
  ? '/tmp/orders-store.json'
  : path.join(process.cwd(), 'src', 'orders-store.json');

const INITIAL_ORDERS: WooCommerceOrder[] = [
  {
    id: 1201,
    number: '#1201',
    customer_name: 'John Smith',
    customer_phone: '+1 (555) 019-2834',
    customer_email: 'john.smith@gmail.com',
    customer_address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043',
    latitude: 37.4223,
    longitude: -122.0848,
    preferred_time: 'Today, 10:00 AM - 12:00 PM',
    payment_status: 'Paid',
    service_type: 'Washing Machine Installation',
    products: ['Samsung Front Load 8kg Washing Machine', 'Universal Inlet Hose (6ft)', 'Anti-Vibration Pads'],
    technician_status: 'Assigned',
    notes: [
      {
        id: '1',
        author: 'WooCommerce Store',
        message: 'Customer requested installation in first-floor utility room. Confirm inlet pressure.',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
    photos: [],
    materials: [],
    signature: null,
    completed_at: null,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 1202,
    number: '#1202',
    customer_name: 'Emily Johnson',
    customer_phone: '+1 (555) 023-4567',
    customer_email: 'emily.j@outlook.com',
    customer_address: '111 Town and Country Rd, Orange, CA 92868',
    latitude: 33.7884,
    longitude: -117.8714,
    preferred_time: 'Today, 02:30 PM - 04:30 PM',
    payment_status: 'Cash on Delivery',
    service_type: 'Double-Door Refrigerator Repair',
    products: ['Cooling Defrost Thermostat Replacement', 'Gas Leakage Sealing & Recharge'],
    technician_status: 'In Progress',
    notes: [
      {
        id: '1',
        author: 'Admin',
        message: 'Check for gas coil leakage in freezer compartment before starting the compressor recharge.',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: '2',
        author: 'Technician (Self)',
        message: 'Departed from the service center. On the way to customer location.',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
    photos: [],
    materials: [],
    signature: null,
    completed_at: null,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    accepted_by_email: 'ereshmb@gmail.com',
  },
  {
    id: 1203,
    number: '#1203',
    customer_name: 'Robert Chen',
    customer_phone: '+1 (555) 034-5678',
    customer_email: 'rob.chen@techcorp.com',
    customer_address: '345 Spear St, San Francisco, CA 94105',
    latitude: 37.7901,
    longitude: -122.3912,
    preferred_time: 'Tomorrow, 09:00 AM - 11:00 AM',
    payment_status: 'Paid',
    service_type: 'Water Purifier Maintenance & Filter Swap',
    products: ['Active Carbon Sediment Filter Set', 'RO Membrane Replacement'],
    technician_status: 'Assigned',
    notes: [],
    photos: [],
    materials: [],
    signature: null,
    completed_at: null,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 1204,
    number: '#1204',
    customer_name: 'David Miller',
    customer_phone: '+1 (555) 045-6789',
    customer_email: 'david.miller@yahoo.com',
    customer_address: '100 Winchester Circle, Los Gatos, CA 95032',
    latitude: 37.2546,
    longitude: -121.9634,
    preferred_time: 'Yesterday, 11:00 AM',
    payment_status: 'Paid',
    service_type: 'Inverter Air Conditioner Noise Inspection',
    products: ['Outdoor Compressor Rubber Mountings', 'BLDC Fan Motor Lubrication'],
    technician_status: 'Closed',
    notes: [
      {
        id: '1',
        author: 'Technician (Self)',
        message: 'Replaced worn rubber dampers under compressor. Rattling noise fully resolved. Testing completed.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: '2',
        author: 'WooCommerce Store',
        message: 'Technician closed the job. Status synced to Completed in WooCommerce.',
        timestamp: new Date(Date.now() - 3600000 * 23.5).toISOString(),
      },
    ],
    photos: [],
    materials: [
      { id: 'm1', name: 'Run Capacitor (45 uF / 50 uF)', quantity: 1, remarks: 'Compressor startup' },
      { id: 'm2', name: 'High-Strength Insulation Tape', quantity: 1 },
    ],
    signature: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNIDEwIDEwIEwgOTAgOTAiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
    completed_at: new Date(Date.now() - 3600000 * 23.5).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 30).toISOString(),
  },
];

// Helper to load current state of orders
function loadOrders(): WooCommerceOrder[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading order store, falling back to initial data:', err);
  }
  saveOrders(INITIAL_ORDERS);
  return INITIAL_ORDERS;
}

// Helper to save current state of orders
function saveOrders(orders: WooCommerceOrder[]) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to order store:', err);
  }
}

// Robust fetch wrapper for WooCommerce REST API.
async function fetchWooCommerce(
  baseUrl: string,
  apiPath: string,
  options: RequestInit = {},
  queryParams: Record<string, string | number> = {}
): Promise<Response> {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  const prettyParams = new URLSearchParams(queryParams as any).toString();
  const prettyUrl = `${cleanUrl}/wp-json${apiPath}${prettyParams ? '?' + prettyParams : ''}`;
  
  console.log(`[WooCommerce Fetch] Trying pretty URL format: ${prettyUrl}`);
  let response = await fetch(prettyUrl, options);
  
  if (response.status === 404) {
    console.log('[WooCommerce Fetch] Pretty URL returned 404. Retrying with plain query permalinks fallback (/?rest_route=)...');
    const fallbackParams = {
      ...queryParams,
      rest_route: apiPath
    };
    const fallbackParamsStr = new URLSearchParams(fallbackParams as any).toString();
    const fallbackUrl = `${cleanUrl}/?${fallbackParamsStr}`;
    
    console.log(`[WooCommerce Fetch] Trying fallback URL format: ${fallbackUrl}`);
    const fallbackResponse = await fetch(fallbackUrl, options);
    if (fallbackResponse.status !== 404) {
      console.log('[WooCommerce Fetch] Success using plain permalinks fallback!');
      return fallbackResponse;
    }
  }
  
  return response;
}

// Optional WooCommerce API connection wrapper
async function syncToWooCommerce(
  orderId: number,
  status: string,
  noteMessage?: string
) {
  const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;
  if (!WOOCOMMERCE_API_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
    console.log(`[WooCommerce Sim] Order #${orderId} status sync: "${status}". Note: "${noteMessage || 'N/A'}"`);
    return false;
  }

  try {
    const authString = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
    };

    console.log(`[WooCommerce Real Sync] Syncing status to WooCommerce order #${orderId}`);
    const statusResponse = await fetchWooCommerce(
      WOOCOMMERCE_API_URL,
      `/wc/v3/orders/${orderId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status })
      }
    );

    if (!statusResponse.ok) {
      console.error(`[WooCommerce Real Sync] Failed to update status: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    if (noteMessage) {
      console.log(`[WooCommerce Real Sync] Syncing note to WooCommerce order #${orderId}`);
      const noteResponse = await fetchWooCommerce(
        WOOCOMMERCE_API_URL,
        `/wc/v3/orders/${orderId}/notes`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ note: noteMessage })
        }
      );
      if (!noteResponse.ok) {
        console.error(`[WooCommerce Real Sync] Failed to create note: ${noteResponse.status} ${noteResponse.statusText}`);
      }
    }

    return true;
  } catch (err) {
    console.error('[WooCommerce Real Sync] Error synchronizing with external server:', err);
    return false;
  }
}

const AUTHORIZED_TECHNICIANS = [
  { email: 'ereshmb@gmail.com', name: 'Eresh M B', password_hash: '10001' },
  { email: 'decentsachin.143@gmail.com', name: 'Sachin', password_hash: '10002' },
  { email: 'nidhishri767@gmail.com', name: 'Nidhishri', password_hash: '10003' },
  { email: 'fugensys@gmail.com', name: 'Fugensys Admin', password_hash: '10004' }
];

function filterOrdersForTechnician(orders: WooCommerceOrder[], techEmail?: string): WooCommerceOrder[] {
  if (!techEmail || techEmail.trim() === '') {
    return orders;
  }
  const emailLower = techEmail.trim().toLowerCase();
  return orders.filter(order => {
    if (order.technician_status === 'Assigned') {
      return true;
    }
    if (order.accepted_by_email && order.accepted_by_email.trim().toLowerCase() === emailLower) {
      return true;
    }
    const custEmail = (order.customer_email || '').toLowerCase();
    const custName = (order.customer_name || '').toLowerCase();
    const techNamePart = emailLower.includes('eresh') ? 'eresh' : (emailLower.includes('sachin') ? 'sachin' : (emailLower.includes('nidhi') ? 'nidhi' : ''));
    
    if (techNamePart && (custEmail.includes(techNamePart) || custName.includes(techNamePart))) {
      return true;
    }

    return false;
  });
}

let supabaseRLSDetected = false;

async function ensureSupabaseTechniciansSeeded(supabaseClient: any): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.from('technicians').select('id').limit(1);
    if (!error) {
      if (!data || data.length === 0) {
        console.log('[Supabase Seed] "technicians" table is empty. Auto-seeding default technicians...');
        const { error: insertError } = await supabaseClient.from('technicians').insert([
          { email: 'ereshmb@gmail.com', password_hash: '10001', name: 'Eresh M B', phone: '+1 (555) 012-1001', role: 'Technician' },
          { email: 'decentsachin.143@gmail.com', password_hash: '10002', name: 'Sachin', phone: '+1 (555) 012-1002', role: 'Technician' },
          { email: 'nidhishri767@gmail.com', password_hash: '10003', name: 'Nidhishri', phone: '+1 (555) 012-1003', role: 'Technician' },
          { email: 'fugensys@gmail.com', password_hash: '10004', name: 'Fugensys Admin', phone: '+1 (555) 012-1004', role: 'Technician' }
        ]);
        if (insertError) {
          console.error('[Supabase Seed] Insertion failed:', insertError.message);
          if (insertError.code === '42501' || insertError.message.toLowerCase().includes('security') || insertError.message.toLowerCase().includes('rls')) {
            supabaseRLSDetected = true;
          }
          return false;
        } else {
          console.log('[Supabase Seed] Seeding completed successfully!');
          supabaseRLSDetected = false;
          return true;
        }
      }
      return false;
    } else {
      console.log(`[Supabase Seed] Table check returned error (code: ${error.code}): ${error.message}`);
      return false;
    }
  } catch (err: any) {
    console.error('[Supabase Seed] Error during auto-seed:', err.message || err);
    return false;
  }
}

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and numeric password are required' });
  }

  const emailTrim = email.trim().toLowerCase();
  const passwordTrim = password.trim();

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await ensureSupabaseTechniciansSeeded(supabase);

      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('email', emailTrim)
        .eq('password_hash', passwordTrim)
        .single();

      if (!error && data) {
        console.log(`[Auth] User ${emailTrim} authenticated successfully via Supabase`);
        return res.json({
          success: true,
          user: {
            email: data.email,
            name: data.name,
            role: data.role || 'Technician'
          }
        });
      } else if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.warn('[Auth] Supabase auth error:', error.message);
      }
    } catch (supabaseErr) {
      console.error('[Auth] Supabase connection exception during login:', supabaseErr);
    }
  }

  const tech = AUTHORIZED_TECHNICIANS.find(
    t => t.email.toLowerCase() === emailTrim && t.password_hash === passwordTrim
  );

  if (tech) {
    return res.json({
      success: true,
      user: {
        email: tech.email,
        name: tech.name,
        role: 'Technician'
      }
    });
  } else {
    return res.status(401).json({
      success: false,
      error: 'Invalid technician credentials. Please use your manual email and 5-digit password serial.'
    });
  }
});

app.get('/api/config-status', (req, res) => {
  const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  res.json({
    hasWooCommerceConfigured: Boolean(WOOCOMMERCE_API_URL && WOOCOMMERCE_CONSUMER_KEY && WOOCOMMERCE_CONSUMER_SECRET),
    wooCommerceUrl: WOOCOMMERCE_API_URL || 'Not configured',
    hasGoogleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_PLATFORM_KEY),
    hasSupabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    supabaseUrl: SUPABASE_URL || 'Not configured',
  });
});

app.post('/api/test-supabase', async (req, res) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.json({
      success: false,
      configured: false,
      message: 'Supabase URL or Anon Key is missing from your environment variables. Please add SUPABASE_URL and SUPABASE_ANON_KEY under Settings -> Secrets.'
    });
  }

  try {
    console.log(`[Supabase Test] Initializing client for ${SUPABASE_URL}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const seeded = await ensureSupabaseTechniciansSeeded(supabase);
    const { error } = await supabase.from('technicians').select('*').limit(1);

    if (error) {
      if (error.code === '42P01') {
        return res.json({
          success: true,
          configured: true,
          message: `Successfully connected and authenticated with Supabase! Note: The table 'technicians' does not exist yet (error 42P01). Please run the SQL queries in 'src/db_schema.sql' inside your Supabase SQL Editor to initialize all tables.`
        });
      } else if (error.code === 'PGRST301' || error.message.toLowerCase().includes('apikey') || error.message.toLowerCase().includes('jwt')) {
        return res.json({
          success: false,
          configured: true,
          message: `Authentication failed (Code ${error.code}). Your SUPABASE_ANON_KEY appears to be invalid: ${error.message}`
        });
      } else {
        return res.json({
          success: false,
          configured: true,
          message: `Supabase returned an error (Code ${error.code}): ${error.message}`
        });
      }
    }

    if (supabaseRLSDetected) {
      return res.json({
        success: true,
        configured: true,
        message: `Successfully connected to Supabase, but Row-Level Security (RLS) is active on your 'technicians' table and is blocking client access!\n\nTo make your portal accounts and any custom accounts you add work, please execute the following command in your Supabase SQL Editor:\n\nALTER TABLE technicians DISABLE ROW LEVEL SECURITY;\n\n(Alternatively, create a SELECT policy allowing 'anon' public access).`
      });
    }

    return res.json({
      success: true,
      configured: true,
      message: seeded 
        ? `Successfully connected to Supabase and auto-seeded the default technicians into the 'technicians' table!` 
        : `Successfully connected and authenticated with Supabase! Your technicians database has been verified.`
    });
  } catch (err: any) {
    console.error('[Supabase Test] Critical exception:', err);
    return res.json({
      success: false,
      configured: true,
      message: `Failed to connect to Supabase: ${err.message || err}`
    });
  }
});

app.post('/api/test-connection', async (req, res) => {
  const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;
  
  if (!WOOCOMMERCE_API_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
    return res.json({
      success: false,
      configured: false,
      message: 'WooCommerce API credentials are not set in environment variables. Currently running in Simulated Sandbox Mode with persistent mock orders.'
    });
  }

  try {
    const authString = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
    };

    const response = await fetchWooCommerce(
      WOOCOMMERCE_API_URL,
      '/wc/v3/orders',
      {
        method: 'GET',
        headers,
      },
      { per_page: 1 }
    );

    if (response.ok) {
      return res.json({
        success: true,
        configured: true,
        message: `Successfully connected! Your WordPress/WooCommerce server is responsive and accepted API credentials. Reachable at: ${WOOCOMMERCE_API_URL}`
      });
    } else {
      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = errJson.message || errJson.code || '';
      } catch (e) {
        errorDetail = response.statusText || `HTTP Status ${response.status}`;
      }
      return res.json({
        success: false,
        configured: true,
        message: `WooCommerce server returned an error: ${response.status} (${errorDetail}). Please check that Consumer Key and Secret are correct and have read/write permissions.`
      });
    }
  } catch (err: any) {
    console.error('[WooCommerce Connection Test] Error testing connection:', err);
    return res.json({
      success: false,
      configured: true,
      message: `Network Connection Error: Could not resolve or reach ${WOOCOMMERCE_API_URL}. Check if the URL is correct, public, uses HTTPS, and has no firewall blocking requests. Details: ${err.message || err}`
    });
  }
});

app.get('/api/orders', async (req, res) => {
  const techEmail = req.query.tech_email as string | undefined;
  try {
    const localOrders = loadOrders();
    const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;

    if (!WOOCOMMERCE_API_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
      console.log('[WooCommerce Sim] Active. Returning persistent local simulated orders.');
      return res.json(filterOrdersForTechnician(localOrders, techEmail));
    }

    const authString = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
    };

    const response = await fetchWooCommerce(
      WOOCOMMERCE_API_URL,
      '/wc/v3/orders',
      {
        method: 'GET',
        headers,
      },
      { per_page: 50 }
    );

    if (!response.ok) {
      console.error(`[WooCommerce Pull Error] WooCommerce API responded with status ${response.status}: ${response.statusText}`);
      return res.json(localOrders);
    }

    const wcOrders = await response.json();
    if (!Array.isArray(wcOrders)) {
      console.error('[WooCommerce Pull Error] API response is not a JSON array:', wcOrders);
      return res.json(localOrders);
    }

    console.log(`[WooCommerce Pull Success] Fetched ${wcOrders.length} live orders. Merging with local status store...`);

    const mergedOrders: WooCommerceOrder[] = wcOrders.map((wcOrder: any) => {
      const id = wcOrder.id;
      const existing = localOrders.find((o) => o.id === id);

      const billing = wcOrder.billing || {};
      const shipping = wcOrder.shipping || {};
      const firstName = billing.first_name || shipping.first_name || 'Valued';
      const lastName = billing.last_name || shipping.last_name || 'Customer';
      const customerName = `${firstName} ${lastName}`.trim();

      const addressParts = [
        billing.address_1 || shipping.address_1 || '',
        billing.address_2 || shipping.address_2 || '',
        billing.city || shipping.city || '',
        billing.state || shipping.state || '',
        billing.postcode || shipping.postcode || ''
      ].filter(Boolean);
      const customerAddress = addressParts.join(', ') || 'Address details not specified';

      let paymentStatus: 'Paid' | 'Unpaid' | 'Cash on Delivery' = 'Unpaid';
      const paymentMethod = (wcOrder.payment_method_title || '').toLowerCase();
      if (paymentMethod.includes('cash') || paymentMethod.includes('cod') || wcOrder.payment_method === 'cod') {
        paymentStatus = 'Cash on Delivery';
      } else if (wcOrder.status === 'completed' || wcOrder.status === 'processing') {
        paymentStatus = 'Paid';
      }

      let preferredTime = 'Today, 10:00 AM - 12:00 PM';
      if (wcOrder.meta_data && Array.isArray(wcOrder.meta_data)) {
        const prefTimeMeta = wcOrder.meta_data.find((m: any) => m.key === 'preferred_time' || m.key === '_preferred_time');
        if (prefTimeMeta) {
          preferredTime = prefTimeMeta.value;
        }
      }

      const products = (wcOrder.line_items || []).map((item: any) => item.name);
      
      let serviceType = 'Product Servicing & Repair';
      const combinedProductsStr = products.join(' ').toLowerCase();
      if (combinedProductsStr.includes('install')) {
        serviceType = 'Equipment Installation';
      } else if (combinedProductsStr.includes('repair') || combinedProductsStr.includes('fix') || combinedProductsStr.includes('noise') || combinedProductsStr.includes('diagnostic')) {
        serviceType = 'Product Diagnostic & Repair';
      } else if (combinedProductsStr.includes('gas') || combinedProductsStr.includes('refill') || combinedProductsStr.includes('charge')) {
        serviceType = 'System Recharge & Service';
      } else if (combinedProductsStr.includes('leak') || combinedProductsStr.includes('water')) {
        serviceType = 'Leak Detection & Repair';
      } else if (combinedProductsStr.includes('maintenance') || combinedProductsStr.includes('amc')) {
        serviceType = 'Annual Maintenance Contract';
      }

      const offsetLat = ((id * 17) % 100) / 1000 - 0.05;
      const offsetLng = ((id * 23) % 100) / 1000 - 0.05;
      const latitude = existing?.latitude || (37.4223 + offsetLat);
      const longitude = existing?.longitude || (-122.0848 + offsetLng);

      let technicianStatus: JobStatus = 'Assigned';
      if (existing) {
        technicianStatus = existing.technician_status;
      } else {
        if (wcOrder.status === 'completed') {
          technicianStatus = 'Closed';
        } else if (wcOrder.status === 'on-hold') {
          technicianStatus = 'Assigned';
        }
      }

      const notesList: OrderNote[] = [];
      if (wcOrder.customer_note && wcOrder.customer_note.trim() !== '') {
        notesList.push({
          id: `wc-cust-${id}`,
          author: 'Customer Note',
          message: wcOrder.customer_note,
          timestamp: wcOrder.date_created || new Date().toISOString()
        });
      }

      const mergedNotes = existing ? [...existing.notes] : notesList;

      if (mergedNotes.length === 0) {
        mergedNotes.push({
          id: `wc-sys-init-${id}`,
          author: 'WooCommerce Store',
          message: `Order #${wcOrder.number || id} imported successfully. Current WooCommerce Status: ${wcOrder.status}.`,
          timestamp: wcOrder.date_created || new Date().toISOString()
        });
      }

      return {
        id,
        number: `#${wcOrder.number || id}`,
        customer_name: customerName,
        customer_phone: billing.phone || shipping.phone || 'N/A',
        customer_email: billing.email || 'N/A',
        customer_address: customerAddress,
        latitude,
        longitude,
        preferred_time: preferredTime,
        payment_status: paymentStatus,
        service_type: serviceType,
        products: products.length > 0 ? products : ['Comprehensive Product Service & Clean'],
        technician_status: technicianStatus,
        rejection_reason: existing?.rejection_reason,
        notes: mergedNotes,
        photos: existing?.photos || [],
        materials: existing?.materials || [],
        signature: existing?.signature || null,
        completed_at: existing?.completed_at || (wcOrder.status === 'completed' ? (wcOrder.date_completed || new Date().toISOString()) : null),
        created_at: wcOrder.date_created || new Date().toISOString()
      };
    });

    const liveIds = new Set(mergedOrders.map(o => o.id));
    const onlyLocal = localOrders.filter(o => !liveIds.has(o.id));
    const finalOrders = [...mergedOrders, ...onlyLocal];

    saveOrders(finalOrders);

    return res.json(filterOrdersForTechnician(finalOrders, techEmail));
  } catch (err: any) {
    console.error('[WooCommerce Pull] Critical error, returning local database as fallback:', err);
    const localOrders = loadOrders();
    return res.json(filterOrdersForTechnician(localOrders, techEmail));
  }
});

app.get('/api/orders/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const orders = loadOrders();
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

app.post('/api/orders/:id/accept', async (req, res) => {
  const id = parseInt(req.params.id);
  const { email } = req.body;
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[index];
  order.technician_status = 'Accepted';
  if (email) {
    order.accepted_by_email = email;
  }
  
  const timestamp = new Date().toISOString();
  const newNote: OrderNote = {
    id: `note-${Date.now()}`,
    author: email ? `Technician (${email})` : 'Technician (Self)',
    message: `Technician accepted this service request. Job assigned to ${email || 'Self'}.`,
    timestamp,
  };
  order.notes.push(newNote);

  saveOrders(orders);

  await syncToWooCommerce(id, 'processing', `Technician (${email || 'Self'}) accepted this service request.`);

  res.json({ success: true, order });
});

app.post('/api/orders/:id/reject', async (req, res) => {
  const id = parseInt(req.params.id);
  const { reason } = req.body;
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[index];
  order.technician_status = 'Rejected';
  order.rejection_reason = reason || 'Unspecified reason';

  const timestamp = new Date().toISOString();
  const newNote: OrderNote = {
    id: `note-${Date.now()}`,
    author: 'Technician (Self)',
    message: `Technician rejected this service request. Reason: ${reason || 'Unspecified'}.`,
    timestamp,
  };
  order.notes.push(newNote);

  saveOrders(orders);

  await syncToWooCommerce(id, 'on-hold', `Job rejected by technician. Reason: ${reason || 'Unspecified'}`);

  res.json({ success: true, order });
});

app.post('/api/orders/:id/status', async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body as { status: JobStatus };
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const validStatuses: JobStatus[] = [
    'Assigned', 'Accepted', 'In Progress', 'On Hold', 'Closed', 'Rejected'
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid workflow status: ${status}` });
  }

  const order = orders[index];
  order.technician_status = status;

  const timestamp = new Date().toISOString();
  let readableStatus = '';
  switch (status) {
    case 'Accepted': readableStatus = 'accepted the order'; break;
    case 'In Progress': readableStatus = 'started work (In Progress)'; break;
    case 'On Hold': readableStatus = 'placed the service on hold'; break;
    case 'Closed': readableStatus = 'closed the service ticket'; break;
    case 'Rejected': readableStatus = 'rejected the order'; break;
    default: readableStatus = `updated status to "${status}"`; break;
  }

  const newNote: OrderNote = {
    id: `note-${Date.now()}`,
    author: 'Technician (Self)',
    message: `Work Progress: Technician ${readableStatus}.`,
    timestamp,
  };
  order.notes.push(newNote);

  if (status === 'Closed') {
    order.completed_at = timestamp;
  }

  saveOrders(orders);

  let wcStatus = 'processing';
  if (status === 'Closed') {
    wcStatus = 'completed';
  }

  await syncToWooCommerce(id, wcStatus, `Work Progress: Technician ${readableStatus}.`);

  res.json({ success: true, order });
});

app.post('/api/orders/:id/notes', async (req, res) => {
  const id = parseInt(req.params.id);
  const { message } = req.body;
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const order = orders[index];
  const newNote: OrderNote = {
    id: `note-${Date.now()}`,
    author: 'Technician (Self)',
    message: message.trim(),
    timestamp: new Date().toISOString(),
  };
  order.notes.push(newNote);

  saveOrders(orders);

  await syncToWooCommerce(id, order.technician_status === 'Closed' ? 'completed' : 'processing', `Technician Note: ${message}`);

  res.json({ success: true, note: newNote });
});

app.post('/api/orders/:id/photos', (req, res) => {
  const id = parseInt(req.params.id);
  const { photo } = req.body;
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (!photo) {
    return res.status(400).json({ error: 'Photo data (base64) is required' });
  }

  const order = orders[index];
  order.photos.push(photo);

  saveOrders(orders);
  res.json({ success: true, count: order.photos.length });
});

app.post('/api/orders/:id/materials', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, quantity, remarks } = req.body;
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (!name || !quantity) {
    return res.status(400).json({ error: 'Material name and quantity are required' });
  }

  const order = orders[index];
  const newMaterial: MaterialItem = {
    id: `mat-${Date.now()}`,
    name,
    quantity: parseFloat(quantity),
    remarks: remarks || '',
  };
  order.materials.push(newMaterial);

  saveOrders(orders);
  res.json({ success: true, materials: order.materials });
});

app.post('/api/orders/:id/close', async (req, res) => {
  const id = parseInt(req.params.id);
  const { signature, notes } = req.body;
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[index];
  order.technician_status = 'Closed';
  order.signature = signature || null;
  order.completed_at = new Date().toISOString();

  if (notes && notes.trim() !== '') {
    order.notes.push({
      id: `note-close-${Date.now()}`,
      author: 'Technician (Self)',
      message: `Final Closing Note: ${notes.trim()}`,
      timestamp: new Date().toISOString(),
    });
  }

  order.notes.push({
    id: `note-sys-${Date.now()}`,
    author: 'WooCommerce Store',
    message: 'Technician closed the job. WooCommerce Order Status changed to Completed.',
    timestamp: new Date().toISOString(),
  });

  saveOrders(orders);

  await syncToWooCommerce(id, 'completed', `Job fully closed by technician. Signature captured on mobile portal. Final comments: ${notes || 'None'}`);

  res.json({ success: true, order });
});

app.get('/api/stats', (req, res) => {
  const orders = loadOrders();
  const techEmail = req.query.tech_email as string | undefined;

  let filteredOrders = orders;
  if (techEmail && techEmail.trim() !== '') {
    const emailLower = techEmail.trim().toLowerCase();
    filteredOrders = orders.filter(o =>
      o.technician_status === 'Assigned' ||
      (o.accepted_by_email && o.accepted_by_email.toLowerCase() === emailLower)
    );
  }

  const stats = {
    assigned: filteredOrders.filter(o => o.technician_status === 'Assigned').length,
    accepted: filteredOrders.filter(o => o.technician_status !== 'Assigned' && o.technician_status !== 'Rejected' && o.technician_status !== 'Closed').length,
    completed: filteredOrders.filter(o => o.technician_status === 'Closed').length,
    rejected: filteredOrders.filter(o => o.technician_status === 'Rejected').length,
  };
  res.json(stats);
});

export default app;
