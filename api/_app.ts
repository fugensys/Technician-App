import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { WooCommerceOrder, JobStatus, OrderNote, MaterialItem } from '../src/types';

dotenv.config();

const app = express();

// Enable JSON bodies with higher limit for photos/signatures
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Clean access logging middleware (avoids leaking body data, base64 photos or customer PII)
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[HTTP_LOG] INCOMING: ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`[HTTP_LOG] OUTGOING: ${req.method} ${req.url} - Status: ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Environment Configuration & Fallbacks
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || SUPABASE_ANON_KEY || 'ac-tech-jwt-secret-key-12345';

// Initialize Supabase Admin Client using service role key (or fall back to anon key if not set)
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
);

// Interface for Express requests carrying authenticated technician context
interface AuthenticatedRequest extends express.Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

// Token-based Session Verification Middleware
const authenticateToken = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Session expired or token missing. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Session invalid or expired. Please sign in again.' });
    }
    req.user = decoded;
    next();
  });
};

// Seed manual technicians with hashed passwords on startup if empty
async function ensureSupabaseTechniciansSeeded(): Promise<boolean> {
  try {
    const techniciansToSeed = [
      { email: 'ereshmb@gmail.com', password: '10001', name: 'Eresh M B', phone: '+1 (555) 012-1001', role: 'Technician' },
      { email: 'decentsachin.143@gmail.com', password: '10002', name: 'Sachin', phone: '+1 (555) 012-1002', role: 'Technician' },
      { email: 'nidhishri767@gmail.com', password: '10003', name: 'Nidhishri', phone: '+1 (555) 012-1003', role: 'Technician' },
      { email: 'fugensys@gmail.com', password: '10004', name: 'Fugensys Admin', phone: '+1 (555) 012-1004', role: 'Technician' }
    ];

    for (const t of techniciansToSeed) {
      const { data: existing, error } = await supabaseAdmin
        .from('technicians')
        .select('*')
        .eq('email', t.email)
        .maybeSingle();

      const expectedHash = bcrypt.hashSync(t.password, 10);

      if (error) {
        console.warn(`[Supabase Seed] Error checking technician ${t.email}:`, error.message);
        continue;
      }

      if (!existing) {
        console.log(`[Supabase Seed] Inserting missing technician: ${t.email}`);
        await supabaseAdmin.from('technicians').insert({
          email: t.email,
          password_hash: expectedHash,
          name: t.name,
          phone: t.phone,
          role: t.role
        });
      } else {
        const isPlaintextMatch = existing.password_hash === t.password;
        const isBcryptMatch = bcrypt.compareSync(t.password, existing.password_hash);
        
        if (!isPlaintextMatch && !isBcryptMatch) {
          console.log(`[Supabase Seed] Updating password/details for technician: ${t.email}`);
          await supabaseAdmin
            .from('technicians')
            .update({
              password_hash: expectedHash,
              name: t.name,
              phone: t.phone
            })
            .eq('email', t.email);
        }
      }
    }
    return true;
  } catch (err: any) {
    console.error('[Supabase Seed] Exception checking technicians:', err.message || err);
    return false;
  }
}

// Centralized mapping of internal job statuses to external WooCommerce statuses
function getWooCommerceStatus(techStatus: JobStatus): string {
  switch (techStatus) {
    case 'Accepted':
    case 'In Progress':
      return 'processing';
    case 'On Hold':
    case 'Rejected':
      return 'on-hold';
    case 'Closed':
      return 'completed';
    default:
      return 'processing';
  }
}

// Robust WooCommerce endpoint client helper
async function fetchWooCommerce(
  baseUrl: string,
  apiPath: string,
  options: RequestInit = {},
  queryParams: Record<string, string | number> = {}
): Promise<Response> {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  const prettyParams = new URLSearchParams(queryParams as any).toString();
  const prettyUrl = `${cleanUrl}/wp-json${apiPath}${prettyParams ? '?' + prettyParams : ''}`;
  
  console.log(`[WooCommerce Fetch] Querying path: ${prettyUrl}`);
  let response = await fetch(prettyUrl, options);
  
  if (response.status === 404) {
    console.log('[WooCommerce Fetch] Pretty URL returned 404. Falling back to query param routing...');
    const fallbackParams = {
      ...queryParams,
      rest_route: apiPath
    };
    const fallbackParamsStr = new URLSearchParams(fallbackParams as any).toString();
    const fallbackUrl = `${cleanUrl}/?${fallbackParamsStr}`;
    
    console.log(`[WooCommerce Fetch] Querying fallback path: ${fallbackUrl}`);
    const fallbackResponse = await fetch(fallbackUrl, options);
    if (fallbackResponse.status !== 404) {
      return fallbackResponse;
    }
  }
  
  return response;
}

// Synchronization updater for WooCommerce backend
async function syncToWooCommerce(
  orderId: number,
  status: string,
  noteMessage?: string
): Promise<boolean> {
  const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;
  if (!WOOCOMMERCE_API_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
    console.log(`[WooCommerce Sync Simulation] Order #${orderId} set to "${status}". Note: "${noteMessage || 'N/A'}"`);
    return true; // Return true to succeed in simulated/non-configured sandbox environments
  }

  try {
    const authString = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
    };

    console.log(`[WooCommerce Sync] Updating order #${orderId} status to: ${status}`);
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
      console.error(`[WooCommerce Sync] Failed status update for #${orderId}: ${statusResponse.status}`);
      return false;
    }

    if (noteMessage) {
      console.log(`[WooCommerce Sync] Adding comment note to WooCommerce order #${orderId}`);
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
        console.error(`[WooCommerce Sync] Failed note update for #${orderId}: ${noteResponse.status}`);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error(`[WooCommerce Sync] Network exception for #${orderId}:`, err);
    return false;
  }
}

// Upload base64 image data to Supabase Storage, returning the public access URL
async function uploadPhotoToStorage(orderId: number, base64Data: string): Promise<string> {
  try {
    const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      if (base64Data.startsWith('http')) {
        return base64Data;
      }
      throw new Error('Invalid base64 payload layout');
    }

    const contentType = match[1];
    const base64Str = match[2];
    const buffer = Buffer.from(base64Str, 'base64');
    const bucketName = 'order-photos';

    // Verify bucket presence, auto-create if missing
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    if (!bucketError) {
      const exists = buckets?.some(b => b.name === bucketName);
      if (!exists) {
        console.log(`[Storage] Creating bucket "${bucketName}"...`);
        await supabaseAdmin.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760 // 10MB
        });
      }
    }

    const fileExt = contentType.split('/')[1] || 'jpg';
    const filePath = `${orderId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err: any) {
    console.error('[Storage Error] Failed uploading file, falling back to database column string inline:', err.message || err);
    return base64Data;
  }
}

// Fetch orders from real Supabase tables, optionally filter to unassigned or assigned to specific tech
async function getOrdersFromSupabase(techEmail?: string): Promise<WooCommerceOrder[]> {
  try {
    const { data: dbOrders, error: ordersErr } = await supabaseAdmin
      .from('service_orders')
      .select('*')
      .order('id', { ascending: false });

    if (ordersErr) {
      console.error('[Database Error] Failed to read service_orders:', ordersErr.message);
      return [];
    }

    if (!dbOrders || dbOrders.length === 0) {
      return [];
    }

    // Retrieve associated data in bulk for performance
    const { data: dbNotes } = await supabaseAdmin.from('order_notes').select('*');
    const { data: dbMaterials } = await supabaseAdmin.from('order_materials').select('*');
    const { data: dbPhotos } = await supabaseAdmin.from('order_photos').select('*');

    const notesMap = (dbNotes || []).reduce((acc: Record<number, OrderNote[]>, note: any) => {
      if (!acc[note.order_id]) acc[note.order_id] = [];
      acc[note.order_id].push({
        id: note.id,
        author: note.author,
        message: note.message,
        timestamp: note.timestamp
      });
      return acc;
    }, {});

    const matsMap = (dbMaterials || []).reduce((acc: Record<number, MaterialItem[]>, mat: any) => {
      if (!acc[mat.order_id]) acc[mat.order_id] = [];
      acc[mat.order_id].push({
        id: mat.id,
        name: mat.name,
        quantity: Number(mat.quantity),
        remarks: mat.remarks || ''
      });
      return acc;
    }, {});

    const photosMap = (dbPhotos || []).reduce((acc: Record<number, string[]>, p: any) => {
      if (!acc[p.order_id]) acc[p.order_id] = [];
      acc[p.order_id].push(p.photo_data);
      return acc;
    }, {});

    const orders: WooCommerceOrder[] = dbOrders.map((o: any) => ({
      id: o.id,
      number: o.order_number || `#${o.id}`,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      customer_email: o.customer_email || '',
      customer_address: o.customer_address,
      latitude: o.latitude ? Number(o.latitude) : 0,
      longitude: o.longitude ? Number(o.longitude) : 0,
      preferred_time: o.preferred_time || '',
      payment_status: o.payment_status as any,
      service_type: o.service_type,
      products: o.products || [],
      technician_status: o.technician_status as any,
      rejection_reason: o.rejection_reason || undefined,
      notes: notesMap[o.id] || [],
      photos: photosMap[o.id] || [],
      materials: matsMap[o.id] || [],
      signature: o.digital_signature || null,
      completed_at: o.completed_at || null,
      created_at: o.created_at,
      accepted_by_email: o.accepted_by_email || undefined
    }));

    if (techEmail) {
      const emailLower = techEmail.trim().toLowerCase();
      return orders.filter(o => {
        // Show unassigned orders or orders accepted by this technician
        if (o.technician_status === 'Assigned' && !o.accepted_by_email) {
          return true;
        }
        if (o.accepted_by_email && o.accepted_by_email.trim().toLowerCase() === emailLower) {
          return true;
        }
        return false;
      });
    }

    return orders;
  } catch (err: any) {
    console.error('[Database Error] Fetch operation exception:', err.message || err);
    return [];
  }
}

// API: Technician Authentication (ONLY Server-side via Supabase)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const emailTrim = email.trim().toLowerCase();
  const passwordTrim = password.trim();

  try {
    // Seed default technician list if missing
    await ensureSupabaseTechniciansSeeded();

    const { data: tech, error } = await supabaseAdmin
      .from('technicians')
      .select('*')
      .eq('email', emailTrim)
      .single();

    if (error || !tech) {
      return res.status(401).json({ error: 'Invalid email or technician passcode.' });
    }

    // Support backward-compatible migration for unhashed seed passwords
    const isPlaintextMatch = tech.password_hash === passwordTrim;
    const isBcryptMatch = bcrypt.compareSync(passwordTrim, tech.password_hash);

    if (isPlaintextMatch || isBcryptMatch) {
      if (isPlaintextMatch) {
        // Upgrade password securely in the background to bcrypt layout
        const secureHash = bcrypt.hashSync(passwordTrim, 10);
        await supabaseAdmin
          .from('technicians')
          .update({ password_hash: secureHash })
          .eq('id', tech.id);
      }

      // Generate signed, secure JWT Session token
      const sessionToken = jwt.sign(
        {
          id: tech.id,
          email: tech.email,
          name: tech.name,
          role: tech.role || 'Technician'
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        user: {
          email: tech.email,
          name: tech.name,
          role: tech.role || 'Technician',
          token: sessionToken
        }
      });
    }

    return res.status(401).json({ error: 'Invalid email or technician passcode.' });
  } catch (err: any) {
    console.error('[Auth Error] Secure login validation failed:', err.message || err);
    return res.status(500).json({ error: 'Database service unavailable. Please retry later.' });
  }
});

// Protect all diagnostic routes. Can only be accessed with a valid Session Token
app.get('/api/config-status', authenticateToken as any, (req, res) => {
  const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;
  res.json({
    hasWooCommerceConfigured: Boolean(WOOCOMMERCE_API_URL && WOOCOMMERCE_CONSUMER_KEY && WOOCOMMERCE_CONSUMER_SECRET),
    wooCommerceUrl: WOOCOMMERCE_API_URL || 'Not configured',
    hasGoogleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_PLATFORM_KEY),
    hasSupabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    supabaseUrl: SUPABASE_URL || 'Not configured',
  });
});

app.post('/api/test-supabase', authenticateToken as any, async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.json({
      success: false,
      configured: false,
      message: 'Supabase parameters are not registered in settings panel.'
    });
  }

  try {
    await ensureSupabaseTechniciansSeeded();
    const { data, error } = await supabaseAdmin.from('technicians').select('id').limit(1);

    if (error) {
      return res.json({
        success: false,
        configured: true,
        message: `Database error code: ${error.code} - ${error.message}`
      });
    }

    return res.json({
      success: true,
      configured: true,
      message: 'Successfully established secure server connection with Supabase Instance and seeded records.'
    });
  } catch (err: any) {
    return res.json({
      success: false,
      configured: true,
      message: `Database connection failed: ${err.message || err}`
    });
  }
});

app.post('/api/test-connection', authenticateToken as any, async (req, res) => {
  const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;
  if (!WOOCOMMERCE_API_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
    return res.json({
      success: false,
      configured: false,
      message: 'WooCommerce credentials not registered in system variables.'
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
      { method: 'GET', headers },
      { per_page: 1 }
    );

    if (response.ok) {
      return res.json({
        success: true,
        configured: true,
        message: `Reachable WooCommerce instance at: ${WOOCOMMERCE_API_URL}`
      });
    }

    return res.json({
      success: false,
      configured: true,
      message: `Remote server code ${response.status}: ${response.statusText}`
    });
  } catch (err: any) {
    return res.json({
      success: false,
      configured: true,
      message: `Failed to resolve route: ${err.message || err}`
    });
  }
});

// Protect all Order API routes
app.use('/api/orders', authenticateToken as any);

// API: Fetch and Sync Orders (Filters live pull to "completed" with full pagination)
app.get('/api/orders', async (req: AuthenticatedRequest, res) => {
  const techEmail = req.user?.email;

  try {
    const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;

    if (!WOOCOMMERCE_API_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
      console.log('[WooCommerce Sim Mode] Returning existing records directly from Supabase DB.');
      const localOrders = await getOrdersFromSupabase(techEmail);
      return res.json(localOrders);
    }

    const authString = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
    };

    // Paginate to pull ALL live "completed" status orders
    let allLiveWcOrders: any[] = [];
    let pageNum = 1;
    const batchSize = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await fetchWooCommerce(
        WOOCOMMERCE_API_URL,
        '/wc/v3/orders',
        { method: 'GET', headers },
        { status: 'completed', per_page: batchSize, page: pageNum }
      );

      if (!response.ok) {
        console.error(`[WooCommerce Pull Error] API responded with status ${response.status} on page ${pageNum}`);
        break;
      }

      const batchOrders = await response.json();
      if (!Array.isArray(batchOrders)) {
        console.error(`[WooCommerce Pull Error] Non-array format payload received:`, batchOrders);
        break;
      }

      allLiveWcOrders = allLiveWcOrders.concat(batchOrders);
      if (batchOrders.length < batchSize) {
        hasMorePages = false;
      } else {
        pageNum++;
      }
    }

    console.log(`[WooCommerce Sync] Loaded ${allLiveWcOrders.length} Completed orders. Syncing into Supabase...`);

    // Write all synced orders to Supabase Database
    for (const wcOrder of allLiveWcOrders) {
      const id = wcOrder.id;

      // Check if order already has an active local supervisor assigned/accepted
      const { data: existingRecord } = await supabaseAdmin
        .from('service_orders')
        .select('*')
        .eq('id', id)
        .single();

      const billing = wcOrder.billing || {};
      const shipping = wcOrder.shipping || {};
      const customerName = `${billing.first_name || shipping.first_name || 'Valued'} ${billing.last_name || shipping.last_name || 'Customer'}`.trim();

      const addressParts = [
        billing.address_1 || shipping.address_1 || '',
        billing.address_2 || shipping.address_2 || '',
        billing.city || shipping.city || '',
        billing.state || shipping.state || '',
        billing.postcode || shipping.postcode || ''
      ].filter(Boolean);
      const customerAddress = addressParts.join(', ') || 'Address details not specified';

      let paymentStatus = 'Unpaid';
      const payMethod = (wcOrder.payment_method_title || '').toLowerCase();
      if (payMethod.includes('cash') || payMethod.includes('cod') || wcOrder.payment_method === 'cod') {
        paymentStatus = 'Cash on Delivery';
      } else {
        paymentStatus = 'Paid';
      }

      let preferredTime = 'Today, 10:00 AM - 12:00 PM';
      if (wcOrder.meta_data && Array.isArray(wcOrder.meta_data)) {
        const timeMeta = wcOrder.meta_data.find((m: any) => m.key === 'preferred_time' || m.key === '_preferred_time');
        if (timeMeta) {
          preferredTime = timeMeta.value;
        }
      }

      const productsList = (wcOrder.line_items || []).map((item: any) => item.name);
      let serviceType = 'Product Servicing & Repair';
      const combinedProdStr = productsList.join(' ').toLowerCase();
      if (combinedProdStr.includes('install')) {
        serviceType = 'Equipment Installation';
      } else if (combinedProdStr.includes('repair') || combinedProdStr.includes('fix') || combinedProdStr.includes('noise')) {
        serviceType = 'Product Diagnostic & Repair';
      } else if (combinedProdStr.includes('gas') || combinedProdStr.includes('refill')) {
        serviceType = 'System Recharge & Service';
      }

      const offsetLat = ((id * 17) % 100) / 1000 - 0.05;
      const offsetLng = ((id * 23) % 100) / 1000 - 0.05;
      const latitude = existingRecord?.latitude || (37.4223 + offsetLat);
      const longitude = existingRecord?.longitude || (-122.0848 + offsetLng);

      const techStatus = existingRecord?.technician_status || 'Assigned';

      const orderPayload = {
        id,
        order_number: wcOrder.number ? `#${wcOrder.number}` : `#${id}`,
        customer_name: customerName,
        customer_phone: billing.phone || shipping.phone || 'N/A',
        customer_email: billing.email || '',
        customer_address: customerAddress,
        latitude,
        longitude,
        preferred_time: preferredTime,
        payment_status: paymentStatus,
        service_type: serviceType,
        products: productsList.length > 0 ? productsList : ['Comprehensive AC Service & Clean'],
        technician_status: techStatus,
        rejection_reason: existingRecord?.rejection_reason || null,
        digital_signature: existingRecord?.digital_signature || null,
        completed_at: existingRecord?.completed_at || (techStatus === 'Closed' ? new Date().toISOString() : null),
        created_at: wcOrder.date_created || new Date().toISOString(),
        accepted_by_email: existingRecord?.accepted_by_email || null
      };

      await supabaseAdmin.from('service_orders').upsert(orderPayload);

      // Create a default sync note if notes are completely empty
      const { count } = await supabaseAdmin
        .from('order_notes')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', id);

      if (count === 0) {
        const initialNotes = [];
        if (wcOrder.customer_note && wcOrder.customer_note.trim() !== '') {
          initialNotes.push({
            id: `wc-cust-${id}`,
            order_id: id,
            author: 'Customer Note',
            message: wcOrder.customer_note,
            timestamp: wcOrder.date_created || new Date().toISOString()
          });
        }
        initialNotes.push({
          id: `wc-sys-init-${id}`,
          order_id: id,
          author: 'WooCommerce Store',
          message: `Order #${wcOrder.number || id} synchronized successfully. Current WooCommerce Status: Completed.`,
          timestamp: wcOrder.date_created || new Date().toISOString()
        });

        await supabaseAdmin.from('order_notes').insert(initialNotes);
      }
    }

    const localOrders = await getOrdersFromSupabase(techEmail);
    return res.json(localOrders);
  } catch (err: any) {
    console.error('[WooCommerce Pull Error] Fetch sync exception:', err.message || err);
    // Return direct database records as robust fallback
    const localOrders = await getOrdersFromSupabase(techEmail);
    return res.json(localOrders);
  }
});

// API: Get Order Details
app.get('/api/orders/:id', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const techEmail = req.user?.email;

  try {
    const orders = await getOrdersFromSupabase(techEmail);
    const order = orders.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found or access unauthorized.' });
    }
    return res.json(order);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// API: Accept Order (Locks down assignments so technicians cannot overwrite another's work)
app.post('/api/orders/:id/accept', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const techEmail = req.user?.email;

  if (!techEmail) {
    return res.status(401).json({ error: 'Identity verification failed.' });
  }

  try {
    const { data: order, error } = await supabaseAdmin
      .from('service_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Stop another technician from overwriting an already-accepted job
    if (order.technician_status !== 'Assigned' && order.accepted_by_email && order.accepted_by_email !== techEmail) {
      return res.status(409).json({
        error: `Conflict: This job has already been accepted by technician ${order.accepted_by_email}.`
      });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('service_orders')
      .update({
        technician_status: 'Accepted',
        accepted_by_email: techEmail
      })
      .eq('id', id);

    if (updateErr) {
      throw updateErr;
    }

    const timestamp = new Date().toISOString();
    const noteId = `note-${Date.now()}`;
    await supabaseAdmin.from('order_notes').insert({
      id: noteId,
      order_id: id,
      author: `Technician (${techEmail})`,
      message: `Technician accepted this service request. Job assigned to ${techEmail}.`,
      timestamp
    });

    const mappedWooStatus = getWooCommerceStatus('Accepted');
    await syncToWooCommerce(id, mappedWooStatus, `Technician (${techEmail}) accepted this service request.`);

    const updatedOrders = await getOrdersFromSupabase(techEmail);
    const updatedOrder = updatedOrders.find(o => o.id === id);

    return res.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error('[Database Error] Failed to accept order:', err.message || err);
    return res.status(500).json({ error: 'Failed to accept order.' });
  }
});

// API: Reject Order
app.post('/api/orders/:id/reject', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const { reason } = req.body;
  const techEmail = req.user?.email;

  if (!techEmail) {
    return res.status(401).json({ error: 'Identity verification failed.' });
  }

  try {
    const { error: updateErr } = await supabaseAdmin
      .from('service_orders')
      .update({
        technician_status: 'Rejected',
        rejection_reason: reason || 'Unspecified reason',
        accepted_by_email: techEmail
      })
      .eq('id', id);

    if (updateErr) {
      throw updateErr;
    }

    const timestamp = new Date().toISOString();
    const noteId = `note-${Date.now()}`;
    await supabaseAdmin.from('order_notes').insert({
      id: noteId,
      order_id: id,
      author: `Technician (${techEmail})`,
      message: `Technician rejected this service request. Reason: ${reason || 'Unspecified'}.`,
      timestamp
    });

    const mappedWooStatus = getWooCommerceStatus('Rejected');
    await syncToWooCommerce(id, mappedWooStatus, `Job rejected by technician. Reason: ${reason || 'Unspecified'}`);

    const updatedOrders = await getOrdersFromSupabase(techEmail);
    const updatedOrder = updatedOrders.find(o => o.id === id);

    return res.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error('[Database Error] Failed to reject order:', err.message || err);
    return res.status(500).json({ error: 'Failed to reject order.' });
  }
});

// API: Update Status
app.post('/api/orders/:id/status', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body as { status: JobStatus };
  const techEmail = req.user?.email;

  const validStatuses: JobStatus[] = [
    'Assigned', 'Accepted', 'In Progress', 'On Hold', 'Closed', 'Rejected'
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status code: ${status}` });
  }

  if (!techEmail) {
    return res.status(401).json({ error: 'Identity verification failed.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const updatePayload: any = {
      technician_status: status
    };

    if (status === 'Closed') {
      updatePayload.completed_at = timestamp;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('service_orders')
      .update(updatePayload)
      .eq('id', id);

    if (updateErr) {
      throw updateErr;
    }

    let readableStatus = '';
    switch (status) {
      case 'Accepted': readableStatus = 'accepted the order'; break;
      case 'In Progress': readableStatus = 'started work (In Progress)'; break;
      case 'On Hold': readableStatus = 'placed the service on hold'; break;
      case 'Closed': readableStatus = 'closed the service ticket'; break;
      case 'Rejected': readableStatus = 'rejected the order'; break;
      default: readableStatus = `updated status to "${status}"`; break;
    }

    const noteId = `note-${Date.now()}`;
    await supabaseAdmin.from('order_notes').insert({
      id: noteId,
      order_id: id,
      author: `Technician (${techEmail})`,
      message: `Work Progress: Technician ${readableStatus}.`,
      timestamp
    });

    const mappedWooStatus = getWooCommerceStatus(status);
    await syncToWooCommerce(id, mappedWooStatus, `Work Progress: Technician ${readableStatus}.`);

    const updatedOrders = await getOrdersFromSupabase(techEmail);
    const updatedOrder = updatedOrders.find(o => o.id === id);

    return res.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error('[Database Error] Failed to update status:', err.message || err);
    return res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// API: Add Note
app.post('/api/orders/:id/notes', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const { message } = req.body;
  const techEmail = req.user?.email;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  if (!techEmail) {
    return res.status(401).json({ error: 'Identity verification failed.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const noteId = `note-${Date.now()}`;
    
    const newNote = {
      id: noteId,
      order_id: id,
      author: `Technician (${techEmail})`,
      message: message.trim(),
      timestamp
    };

    const { error: insertErr } = await supabaseAdmin.from('order_notes').insert(newNote);
    if (insertErr) {
      throw insertErr;
    }

    const { data: order } = await supabaseAdmin.from('service_orders').select('technician_status').eq('id', id).single();
    const currentTechStatus = order?.technician_status || 'Accepted';
    const mappedWooStatus = getWooCommerceStatus(currentTechStatus);

    await syncToWooCommerce(id, mappedWooStatus, `Technician Note: ${message}`);

    return res.json({ success: true, note: newNote });
  } catch (err: any) {
    console.error('[Database Error] Failed to write note:', err.message || err);
    return res.status(500).json({ error: 'Failed to record work comment.' });
  }
});

// API: Upload Job Photos (Saves directly to Supabase Storage bucket and creates database record)
app.post('/api/orders/:id/photos', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const { photo } = req.body;
  const techEmail = req.user?.email;

  if (!photo) {
    return res.status(400).json({ error: 'Base64 image content is required.' });
  }

  if (!techEmail) {
    return res.status(401).json({ error: 'Identity verification failed.' });
  }

  try {
    const storageUrl = await uploadPhotoToStorage(id, photo);

    const { error: insertErr } = await supabaseAdmin
      .from('order_photos')
      .insert({
        order_id: id,
        photo_data: storageUrl
      });

    if (insertErr) {
      throw insertErr;
    }

    const { data: dbPhotos } = await supabaseAdmin
      .from('order_photos')
      .select('photo_data')
      .eq('order_id', id);

    const photosList = (dbPhotos || []).map(p => p.photo_data);

    return res.json({ success: true, count: photosList.length, photos: photosList });
  } catch (err: any) {
    console.error('[Database Error] Failed to upload photo:', err.message || err);
    return res.status(500).json({ error: 'Failed to upload photo.' });
  }
});

// API: Add Materials Used Tracker
app.post('/api/orders/:id/materials', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const { name, quantity, remarks } = req.body;
  const techEmail = req.user?.email;

  if (!name || !quantity) {
    return res.status(400).json({ error: 'Material item description and quantity are required.' });
  }

  if (!techEmail) {
    return res.status(401).json({ error: 'Identity verification failed.' });
  }

  try {
    const matId = `mat-${Date.now()}`;
    const newMat = {
      id: matId,
      order_id: id,
      name,
      quantity: parseFloat(quantity),
      remarks: remarks || ''
    };

    const { error: insertErr } = await supabaseAdmin.from('order_materials').insert(newMat);
    if (insertErr) {
      throw insertErr;
    }

    const { data: dbMats } = await supabaseAdmin
      .from('order_materials')
      .select('*')
      .eq('order_id', id);

    const updatedMatsList: MaterialItem[] = (dbMats || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      quantity: Number(m.quantity),
      remarks: m.remarks || ''
    }));

    return res.json({ success: true, materials: updatedMatsList });
  } catch (err: any) {
    console.error('[Database Error] Failed to write material:', err.message || err);
    return res.status(500).json({ error: 'Failed to append material usage.' });
  }
});

// API: Close/Finish Ticket with signature
app.post('/api/orders/:id/close', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const { signature, notes } = req.body;
  const techEmail = req.user?.email;

  if (!techEmail) {
    return res.status(401).json({ error: 'Identity verification failed.' });
  }

  if (!notes || notes.trim() === '') {
    return res.status(400).json({ error: 'Final comment note is required before closing the job.' });
  }

  try {
    const timestamp = new Date().toISOString();

    // 1. Sync to WooCommerce FIRST before altering local Supabase status
    const mappedWooStatus = getWooCommerceStatus('Closed');
    const syncSuccess = await syncToWooCommerce(
      id,
      mappedWooStatus,
      `Job fully closed by technician. Signature captured on mobile portal. Final comments: ${notes.trim()}`
    );

    const { WOOCOMMERCE_API_URL } = process.env;
    // If WooCommerce is configured but sync fails, reject closure and return an error
    if (WOOCOMMERCE_API_URL && !syncSuccess) {
      return res.status(502).json({
        error: 'WooCommerce Sync Failed: Could not sync status or final comment to WooCommerce. Job has NOT been closed. Please try again.'
      });
    }

    // 2. Commit status changes to Supabase ONLY if WooCommerce sync was successful
    const { error: updateErr } = await supabaseAdmin
      .from('service_orders')
      .update({
        technician_status: 'Closed',
        digital_signature: signature || null,
        completed_at: timestamp
      })
      .eq('id', id);

    if (updateErr) {
      throw updateErr;
    }

    await supabaseAdmin.from('order_notes').insert({
      id: `note-close-${Date.now()}`,
      order_id: id,
      author: `Technician (${techEmail})`,
      message: `Final Closing Note: ${notes.trim()}`,
      timestamp
    });

    await supabaseAdmin.from('order_notes').insert({
      id: `note-sys-${Date.now()}`,
      order_id: id,
      author: 'WooCommerce Store',
      message: 'Technician closed the job. WooCommerce Order Status changed to Completed.',
      timestamp
    });

    const updatedOrders = await getOrdersFromSupabase(techEmail);
    const updatedOrder = updatedOrders.find(o => o.id === id);

    return res.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error('[Database Error] Failed to close order:', err.message || err);
    return res.status(500).json({ error: 'Failed to complete job checkout: ' + (err.message || err) });
  }
});

// API: Aggregate Stats based on Technician assignment scope
app.get('/api/stats', async (req: AuthenticatedRequest, res) => {
  const techEmail = req.user?.email;

  try {
    const orders = await getOrdersFromSupabase(techEmail);

    const stats = {
      assigned: orders.filter(o => o.technician_status === 'Assigned').length,
      accepted: orders.filter(o => o.technician_status !== 'Assigned' && o.technician_status !== 'Rejected' && o.technician_status !== 'Closed').length,
      completed: orders.filter(o => o.technician_status === 'Closed').length,
      rejected: orders.filter(o => o.technician_status === 'Rejected').length,
    };
    return res.json(stats);
  } catch (err: any) {
    console.error('[Database Error] Failed to compile statistics:', err.message || err);
    return res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

export default app;
