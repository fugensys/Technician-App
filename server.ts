/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
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
    technician_status: 'Travelling',
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
    const cleanUrl = WOOCOMMERCE_API_URL.replace(/\/$/, '');
    const updateUrl = `${cleanUrl}/wp-json/wc/v3/orders/${orderId}`;
    
    console.log(`[WooCommerce Real Sync] Syncing status to WooCommerce at ${updateUrl}`);
    const statusResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status })
    });

    if (!statusResponse.ok) {
      console.error(`[WooCommerce Real Sync] Failed to update status: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    // Add Order Note
    if (noteMessage) {
      const noteUrl = `${cleanUrl}/wp-json/wc/v3/orders/${orderId}/notes`;
      console.log(`[WooCommerce Real Sync] Syncing note to WooCommerce at ${noteUrl}`);
      const noteResponse = await fetch(noteUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ note: noteMessage })
      });
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
// API ENDPOINTS
// -------------------------------------------------------------

// Health check and WooCommerce configuration status check
app.get('/api/config-status', (req, res) => {
  const { WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET } = process.env;
  res.json({
    hasWooCommerceConfigured: Boolean(WOOCOMMERCE_API_URL && WOOCOMMERCE_CONSUMER_KEY && WOOCOMMERCE_CONSUMER_SECRET),
    wooCommerceUrl: WOOCOMMERCE_API_URL || 'Not configured',
    hasGoogleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_PLATFORM_KEY),
  });
});

// GET all orders
app.get('/api/orders', (req, res) => {
  const orders = loadOrders();
  res.json(orders);
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
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[index];
  order.technician_status = 'Accepted';
  
  const timestamp = new Date().toISOString();
  const newNote: OrderNote = {
    id: `note-${Date.now()}`,
    author: 'Technician (Self)',
    message: 'Technician accepted this service request. Job added to Accepted List.',
    timestamp,
  };
  order.notes.push(newNote);

  saveOrders(orders);

  // Sync to WooCommerce (Updates order note and changes WooCommerce status to 'processing' or 'assigned')
  await syncToWooCommerce(id, 'processing', 'Technician accepted this service request.');

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
    'Assigned', 'Accepted', 'Travelling', 'Reached', 'Inspection', 
    'Installing', 'Gas Charging', 'Testing', 'Completed', 'Closed'
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid workflow status: ${status}` });
  }

  const order = orders[index];
  order.technician_status = status;

  const timestamp = new Date().toISOString();
  let readableStatus = '';
  switch (status) {
    case 'Travelling': readableStatus = 'is travelling on way to customer location'; break;
    case 'Reached': readableStatus = 'reached customer location'; break;
    case 'Inspection': readableStatus = 'started inspection of the AC system'; break;
    case 'Installing': readableStatus = 'started installation/servicing work'; break;
    case 'Gas Charging': readableStatus = 'is charging/refilling refrigerant gas'; break;
    case 'Testing': readableStatus = 'initiated final testing and air velocity check'; break;
    case 'Completed': readableStatus = 'successfully completed all services and work'; break;
    case 'Closed': readableStatus = 'closed the service ticket'; break;
    default: readableStatus = `updated status to "${status}"`; break;
  }

  const newNote: OrderNote = {
    id: `note-${Date.now()}`,
    author: 'Technician (Self)',
    message: `Work Progress: Technician ${readableStatus}.`,
    timestamp,
  };
  order.notes.push(newNote);

  if (status === 'Completed') {
    order.completed_at = timestamp;
  }

  saveOrders(orders);

  // Map to WooCommerce standard statuses
  let wcStatus = 'processing';
  if (status === 'Completed' || status === 'Closed') {
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
  await syncToWooCommerce(id, order.technician_status === 'Completed' || order.technician_status === 'Closed' ? 'completed' : 'processing', `Technician Note: ${message}`);

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
  const stats = {
    assigned: orders.filter(o => o.technician_status === 'Assigned').length,
    accepted: orders.filter(o => o.technician_status !== 'Assigned' && o.technician_status !== 'Rejected' && o.technician_status !== 'Closed').length,
    completed: orders.filter(o => o.technician_status === 'Closed' || o.technician_status === 'Completed').length,
    rejected: orders.filter(o => o.technician_status === 'Rejected').length,
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
