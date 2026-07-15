/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { WooCommerceOrder, JobStatus, OrderNote, MaterialItem } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies with higher limit for photos/signatures
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// File-based state persistence for robust developer experience
const STORE_PATH = path.join(process.cwd(), 'src', 'orders-store.json');

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
    service_type: 'AC Installation',
    products: ['Samsung Split AC 1.5 Ton (Inverter)', 'Heavy Duty Outdoor Bracket'],
    technician_status: 'Assigned',
    notes: [
      {
        id: '1',
        author: 'WooCommerce Store',
        message: 'Customer requested installation on third floor exterior wall. Needs long copper piping.',
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
    service_type: 'AC Gas Refilling & Servicing',
    products: ['R410A Refrigerant Refill', 'General Filter Cleaning & Coil Wash'],
    technician_status: 'In Progress',
    notes: [
      {
        id: '1',
        author: 'Admin',
        message: 'Check for cooling coil leakage before filling the gas gas.',
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
    service_type: 'AC Preventive Maintenance',
    products: ['Comprehensive AMC Servicing (Multi-Split Unit)'],
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
    service_type: 'AC Repair (Noise Inspection)',
    products: ['Compressor Mounting Replacements', 'Condenser Fan Lubrication'],
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
      { id: 'm1', name: 'Rubber Dampers', quantity: 4, remarks: 'Compressor mounting' },
      { id: 'm2', name: 'Coil Cleansing Spray', quantity: 1 },
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
// Automatically falls back from pretty permalinks (/wp-json/wc/v3/...) to plain query permalinks (/?rest_route=/wc/v3/...)
// if the target server returns a 404, ensuring universal compatibility.
async function fetchWooCommerce(
  baseUrl: string,
  apiPath: string, // e.g. '/wc/v3/orders' or '/wc/v3/orders/123/notes'
  options: RequestInit = {},
  queryParams: Record<string, string | number> = {}
): Promise<Response> {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  
  // Try default pretty permalinks first
  const prettyParams = new URLSearchParams(queryParams as any).toString();
  const prettyUrl = `${cleanUrl}/wp-json${apiPath}${prettyParams ? '?' + prettyParams : ''}`;
  
  console.log(`[WooCommerce Fetch] Trying pretty URL format: ${prettyUrl}`);
  let response = await fetch(prettyUrl, options);
  
  if (response.status === 404) {
    console.log('[WooCommerce Fetch] Pretty URL returned 404. Retrying with plain query permalinks fallback (/?rest_route=)...');
    // For plain permalinks, we pass the path inside 'rest_route' parameter
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
    // Basic auth header for WooCommerce REST API over HTTPS
    const authString = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
    };

    // Update Order Status
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

    // Add Order Note
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

// -------------------------------------------------------------
// TECHNICIAN DATABASE & AUTHENTICATION (MANUAL TECHNICAL USERS)
// -------------------------------------------------------------
const AUTHORIZED_TECHNICIANS = [
  { email: 'ereshmb@gmail.com', name: 'Eresh M B', password_hash: '10001' },
  { email: 'decentsachin.143@gmail.com', name: 'Sachin', password_hash: '10002' },
  { email: 'nidhishri767@gmail.com', name: 'Nidhishri', password_hash: '10003' }
];

// Helper to filter orders for a specific logged-in technician
function filterOrdersForTechnician(orders: WooCommerceOrder[], techEmail?: string): WooCommerceOrder[] {
  if (!techEmail || techEmail.trim() === '') {
    return orders; // If no user email is active, show everything (unauthenticated / admin overview)
  }
  const emailLower = techEmail.trim().toLowerCase();
  return orders.filter(order => {
    // 1. Show all 'Assigned' (unclaimed) orders so any tech can claim them
    if (order.technician_status === 'Assigned') {
      return true;
    }
    // 2. Show if the order was accepted by this specific technician
    return order.accepted_by_email && order.accepted_by_email.trim().toLowerCase() === emailLower;
  });
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// POST /api/login for Technician authentication
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and numeric password are required' });
  }

  const emailTrim = email.trim().toLowerCase();
  const passwordTrim = password.trim();

  // 1. Try to authenticate via Supabase if configured
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
        // PGRST116 means no rows found, 42P01 means table doesn't exist.
        console.warn('[Auth] Supabase auth error:', error.message);
      }
    } catch (supabaseErr) {
      console.error('[Auth] Supabase connection exception during login:', supabaseErr);
    }
  }

  // 2. Fall back to local hardcoded AUTHORIZED_TECHNICIANS
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

// Health check and WooCommerce configuration status check
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

// POST test-supabase to verify Supabase credentials and reachability
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

    // Test connection by fetching from an arbitrary table (or we can query standard auth session, which is always accessible)
    const { error } = await supabase.from('technicians').select('*').limit(1);

    if (error) {
      // In PostgreSQL/PostgREST, if we receive PGRST116 (no rows), 42P01 (relation/table does not exist), 
      // or similar, it means we DID successfully connect and authenticate!
      // But if we receive an invalid apiKey or JWT signature, it's an authentication error.
      if (error.code === '42P01') {
        return res.json({
          success: true,
          configured: true,
          message: `Successfully connected and authenticated with Supabase! Note: The table 'technicians' does not exist yet (error 42P01), which is normal for a fresh instance. Your credentials are 100% valid.`
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

    return res.json({
      success: true,
      configured: true,
      message: `Successfully connected to Supabase! The project is reachable and you can successfully fetch data from the database.`
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

// POST test-connection to verify WooCommerce credentials and reachability
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

// GET all orders with real-time WooCommerce integration & merging
app.get('/api/orders', async (req, res) => {
  const techEmail = req.query.tech_email as string | undefined;
  try {
    const localOrders = loadOrders();
    const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;

    // If WooCommerce is not configured, return local orders (interactive simulation sandbox mode)
    if (!WOOCOMMERCE_API_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
      console.log('[WooCommerce Sim] Active. Returning persistent local simulated orders.');
      return res.json(filterOrdersForTechnician(localOrders, techEmail));
    }

    // WooCommerce is configured! Attempt to fetch live orders from the WooCommerce REST API.
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
      // Fail-safe graceful fallback: return local database if the WordPress server is down or returns an error
      return res.json(localOrders);
    }

    const wcOrders = await response.json();
    if (!Array.isArray(wcOrders)) {
      console.error('[WooCommerce Pull Error] API response is not a JSON array:', wcOrders);
      return res.json(localOrders);
    }

    console.log(`[WooCommerce Pull Success] Fetched ${wcOrders.length} live orders. Merging with local status store...`);

    // Merge live WooCommerce orders with our local status persistence (technician statuses, materials, photos, etc.)
    const mergedOrders: WooCommerceOrder[] = wcOrders.map((wcOrder: any) => {
      const id = wcOrder.id;
      // Search if we already have local progress state stored for this order ID
      const existing = localOrders.find((o) => o.id === id);

      // Extract customer details safely
      const billing = wcOrder.billing || {};
      const shipping = wcOrder.shipping || {};
      const firstName = billing.first_name || shipping.first_name || 'Valued';
      const lastName = billing.last_name || shipping.last_name || 'Customer';
      const customerName = `${firstName} ${lastName}`.trim();

      // Format clean, human-readable address string
      const addressParts = [
        billing.address_1 || shipping.address_1 || '',
        billing.address_2 || shipping.address_2 || '',
        billing.city || shipping.city || '',
        billing.state || shipping.state || '',
        billing.postcode || shipping.postcode || ''
      ].filter(Boolean);
      const customerAddress = addressParts.join(', ') || 'Address details not specified';

      // Parse payment status details
      let paymentStatus: 'Paid' | 'Unpaid' | 'Cash on Delivery' = 'Unpaid';
      const paymentMethod = (wcOrder.payment_method_title || '').toLowerCase();
      if (paymentMethod.includes('cash') || paymentMethod.includes('cod') || wcOrder.payment_method === 'cod') {
        paymentStatus = 'Cash on Delivery';
      } else if (wcOrder.status === 'completed' || wcOrder.status === 'processing') {
        paymentStatus = 'Paid';
      }

      // Check if order contains a custom preferred_time meta-field, otherwise set dynamic appointment slot
      let preferredTime = 'Today, 10:00 AM - 12:00 PM';
      if (wcOrder.meta_data && Array.isArray(wcOrder.meta_data)) {
        const prefTimeMeta = wcOrder.meta_data.find((m: any) => m.key === 'preferred_time' || m.key === '_preferred_time');
        if (prefTimeMeta) {
          preferredTime = prefTimeMeta.value;
        }
      }

      // Map purchased products
      const products = (wcOrder.line_items || []).map((item: any) => item.name);
      
      // Classify service type based on ordered product names
      let serviceType = 'AC Servicing & Repair';
      const combinedProductsStr = products.join(' ').toLowerCase();
      if (combinedProductsStr.includes('install')) {
        serviceType = 'AC Installation';
      } else if (combinedProductsStr.includes('repair') || combinedProductsStr.includes('fix') || combinedProductsStr.includes('noise') || combinedProductsStr.includes('diagnostic')) {
        serviceType = 'AC Diagnostic & Repair';
      } else if (combinedProductsStr.includes('gas') || combinedProductsStr.includes('refill') || combinedProductsStr.includes('charge')) {
        serviceType = 'AC Gas Charging & Service';
      } else if (combinedProductsStr.includes('leak') || combinedProductsStr.includes('water')) {
        serviceType = 'AC Leak Repair';
      } else if (combinedProductsStr.includes('maintenance') || combinedProductsStr.includes('amc')) {
        serviceType = 'AC Maintenance Contract';
      }

      // Assign beautiful deterministic GPS coordinate offsets centered near SF Silicon Valley 
      // so all orders render dynamically across the live Interactive Service Area Map.
      const offsetLat = ((id * 17) % 100) / 1000 - 0.05;
      const offsetLng = ((id * 23) % 100) / 1000 - 0.05;
      const latitude = existing?.latitude || (37.4223 + offsetLat);
      const longitude = existing?.longitude || (-122.0848 + offsetLng);

      // Synchronize order state:
      // If we already have local progress status (e.g. Reached, Travelling) keep that since it's the real-time tech status.
      // Otherwise, map from standard WooCommerce order status.
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

      // Format custom Customer order notes
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

      // Ensure a system initial receipt note exists
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
        products: products.length > 0 ? products : ['Comprehensive AC Service & Clean'],
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

    // To allow seamless testing, we preserve local simulated orders that do not overlap with live store order IDs
    const liveIds = new Set(mergedOrders.map(o => o.id));
    const onlyLocal = localOrders.filter(o => !liveIds.has(o.id));
    const finalOrders = [...mergedOrders, ...onlyLocal];

    // Save the merged data to the store file so updates by the technician are kept safe
    saveOrders(finalOrders);

    return res.json(filterOrdersForTechnician(finalOrders, techEmail));
  } catch (err: any) {
    console.error('[WooCommerce Pull] Critical error, returning local database as fallback:', err);
    const localOrders = loadOrders();
    return res.json(filterOrdersForTechnician(localOrders, techEmail));
  }
});

// GET order details
app.get('/api/orders/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const orders = loadOrders();
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// POST Accept order
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

  // Sync to WooCommerce (Updates order note and changes WooCommerce status to 'processing' or 'assigned')
  await syncToWooCommerce(id, 'processing', `Technician (${email || 'Self'}) accepted this service request.`);

  res.json({ success: true, order });
});

// POST Reject order
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

  // Sync rejection to WooCommerce (Adds order note so WooCommerce admin sees the rejection)
  await syncToWooCommerce(id, 'on-hold', `Job rejected by technician. Reason: ${reason || 'Unspecified'}`);

  res.json({ success: true, order });
});

// POST Update Workflow Status
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

  // Map to WooCommerce standard statuses
  let wcStatus = 'processing';
  if (status === 'Closed') {
    wcStatus = 'completed';
  }

  await syncToWooCommerce(id, wcStatus, `Work Progress: Technician ${readableStatus}.`);

  res.json({ success: true, order });
});

// POST Add note
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

  // Sync notes directly to WooCommerce
  await syncToWooCommerce(id, order.technician_status === 'Closed' ? 'completed' : 'processing', `Technician Note: ${message}`);

  res.json({ success: true, note: newNote });
});

// POST Upload Photo
app.post('/api/orders/:id/photos', (req, res) => {
  const id = parseInt(req.params.id);
  const { photo } = req.body; // base64 string
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

// POST Add Materials Used
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

// POST Complete / Close Job with Signature
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

  // Sync to WooCommerce as COMPLETED
  await syncToWooCommerce(id, 'completed', `Job fully closed by technician. Signature captured on mobile portal. Final comments: ${notes || 'None'}`);

  res.json({ success: true, order });
});

// GET App Dashboard stats
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

// -------------------------------------------------------------
// VITE CLIENT MIDDLEWARE & ROUTING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AC Tech Server] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
