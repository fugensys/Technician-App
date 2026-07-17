/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin
} from '@vis.gl/react-google-maps';
import {
  Phone,
  MessageSquare,
  MapPin,
  Navigation,
  Check,
  X,
  Briefcase,
  Calendar,
  User,
  Clock,
  ArrowRight,
  Search,
  FileText,
  Settings,
  AlertCircle,
  CheckCircle2,
  Camera,
  Layers,
  ChevronRight,
  Activity,
  PenTool,
  Package,
  Wrench,
  Wifi,
  WifiOff
} from 'lucide-react';
import { WooCommerceOrder, JobStatus, OrderNote, MaterialItem, AppStats } from './types';
import SignaturePad from './components/SignaturePad';
import PhotoUploader from './components/PhotoUploader';
import MaterialTracker from './components/MaterialTracker';

const GOOGLE_MAPS_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const hasValidMapsKey = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== 'YOUR_API_KEY';

const OFFLINE_FALLBACK_ORDERS: WooCommerceOrder[] = [
  {
    id: 14,
    number: '#14',
    customer_name: 'Eresh MB',
    customer_phone: 'N/A',
    customer_email: 'eresh@fugensoftware.com',
    customer_address: '122, 6th C Main, 4th block, Bangalore, KA, 560011',
    latitude: 37.4103,
    longitude: -122.1128,
    preferred_time: 'Today, 10:00 AM - 12:00 PM',
    payment_status: 'Cash on Delivery',
    service_type: 'Product Servicing & Repair',
    products: ['Samsung S24'],
    technician_status: 'Closed',
    notes: [
      {
        id: 'wc-sys-init-14',
        author: 'WooCommerce Store',
        message: 'Order #14 imported successfully. Current WooCommerce Status: completed.',
        timestamp: '2026-07-14T11:33:46'
      }
    ],
    photos: [],
    materials: [],
    signature: null,
    completed_at: '2026-07-14T11:34:36',
    created_at: '2026-07-14T11:33:46'
  },
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
  }
];

const filterOrdersForClient = (ordersList: WooCommerceOrder[], techEmail: string | null) => {
  if (!techEmail) return ordersList;
  const emailLower = techEmail.toLowerCase();
  return ordersList.filter(order => {
    if (order.technician_status === 'Assigned') return true;
    if (order.accepted_by_email && order.accepted_by_email.toLowerCase() === emailLower) return true;
    
    const custEmail = (order.customer_email || '').toLowerCase();
    const custName = (order.customer_name || '').toLowerCase();
    const techNamePart = emailLower.includes('eresh') ? 'eresh' : (emailLower.includes('sachin') ? 'sachin' : (emailLower.includes('nidhi') ? 'nidhi' : ''));
    if (techNamePart && (custEmail.includes(techNamePart) || custName.includes(techNamePart))) {
      return true;
    }
    return false;
  });
};

// Helper to parse a variety of timezone-naive/ISO/UTC date formats robustly for sorting
const parseNoteTimestamp = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  let s = String(ts).trim();
  // Check if it's purely digits (milliseconds timestamp)
  if (/^\d+$/.test(s)) {
    return parseInt(s, 10);
  }
  // If it's WooCommerce format without Z/offset (e.g. "2026-07-17T11:33:00" or "2026-07-17 11:33:00")
  // treat it as UTC consistently with technician logs which are generated in UTC ISO format.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + ':00Z';
  }
  const d = new Date(s);
  const time = d.getTime();
  return isNaN(time) ? 0 : time;
};

export default function App() {
  // Synchronous in-flight request tracker to prevent stale-closure duplicate submissions
  const inFlightRequests = useRef<Set<string>>(new Set());

  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [stats, setStats] = useState<AppStats>({ assigned: 0, accepted: 0, completed: 0, rejected: 0 });
  const [selectedOrder, setSelectedOrder] = useState<WooCommerceOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assigned' | 'active' | 'completed' | 'config'>('dashboard');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Technician user authentication state (from localStorage)
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; role: string; token?: string } | null>(() => {
    const saved = localStorage.getItem('ac_tech_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Secure API fetch wrapper with token injection and automatic session timeout handling
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {})
    };
    if (currentUser?.token) {
      headers['Authorization'] = `Bearer ${currentUser.token}`;
    }
    try {
      const res = await fetch(url, {
        ...options,
        headers
      });
      if (res.status === 401 || res.status === 403) {
        console.warn('Session expired or unauthorized. Logging out.');
        setCurrentUser(null);
        localStorage.removeItem('ac_tech_user');
      }
      return res;
    } catch (err) {
      console.error('Fetch network exception:', err);
      throw err;
    }
  };
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  
  // Technician local statuses
  const [technicianStatus, setTechnicianStatus] = useState<'Online' | 'Offline'>('Online');
  const [rejectionModalId, setRejectionModalId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Busy today');
  
  // Forms & Interactivity states
  const [newNoteText, setNewNoteText] = useState('');
  const [tempSignature, setTempSignature] = useState<string | null>(null);
  const [finalCloseNote, setFinalCloseNote] = useState('');
  const [isClosingJobLoading, setIsClosingJobLoading] = useState(false);
  const [isAcceptingOrderId, setIsAcceptingOrderId] = useState<number | null>(null);
  const [isRejectingOrderId, setIsRejectingOrderId] = useState<number | null>(null);
  const [isUpdatingStatusOrderId, setIsUpdatingStatusOrderId] = useState<number | null>(null);
  const [isAddingNoteOrderId, setIsAddingNoteOrderId] = useState<number | null>(null);
  const [closeJobError, setCloseJobError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [isIframe, setIsIframe] = useState(false);
  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);
  
  // WooCommerce & Supabase connection state info
  const [configStatus, setConfigStatus] = useState({
    hasWooCommerceConfigured: false,
    wooCommerceUrl: '',
    hasGoogleMapsConfigured: false,
    hasSupabaseConfigured: false,
    supabaseUrl: ''
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  // Fetch initial configuration & orders on change of technician user context
  useEffect(() => {
    fetchConfigAndOrders(currentUser ? currentUser.email : null);
  }, [currentUser]);

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      setTestResult(null);
      const res = await apiFetch('/api/test-connection', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: data.success,
          message: data.message
        });
        // Also refresh config status
        const configRes = await apiFetch('/api/config-status');
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfigStatus(configData);
        }
      } else {
        setTestResult({
          success: false,
          message: `Server responded with an error code: ${res.status} ${res.statusText}`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Failed to contact the server: ${err.message || err}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestSupabase = async () => {
    try {
      setTestingSupabase(true);
      setSupabaseTestResult(null);
      const res = await apiFetch('/api/test-supabase', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSupabaseTestResult({
          success: data.success,
          message: data.message
        });
        // refresh config
        const configRes = await apiFetch('/api/config-status');
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfigStatus(configData);
        }
      } else {
        setSupabaseTestResult({
          success: false,
          message: `Server responded with an error code: ${res.status} ${res.statusText}`
        });
      }
    } catch (err: any) {
      setSupabaseTestResult({
        success: false,
        message: `Failed to contact the server: ${err.message || err}`
      });
    } finally {
      setTestingSupabase(false);
    }
  };

  const fetchConfigAndOrders = async (techEmail?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      setIsOfflineMode(false);
      
      const configRes = await apiFetch('/api/config-status').catch(() => null);
      if (configRes && configRes.ok) {
        const configData = await configRes.json();
        setConfigStatus(configData);
      }

      // Check active technician email to query filtered list
      const emailQuery = techEmail !== undefined ? techEmail : (currentUser ? currentUser.email : null);
      if (!emailQuery) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const url = `/api/orders?tech_email=${encodeURIComponent(emailQuery)}`;

      const ordersRes = await apiFetch(url).catch(() => null);
      if (ordersRes && ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
        calculateStats(ordersData);
      } else {
        throw new Error('Failed to load orders from local API server.');
      }
    } catch (err: any) {
      console.warn('Backend fetch failed or was blocked by iframe cookie filters. Using offline simulation mode:', err);
      // Fallback to client-side local simulation mode
      const emailQuery = techEmail !== undefined ? techEmail : (currentUser ? currentUser.email : null);
      const clientOrders = filterOrdersForClient(OFFLINE_FALLBACK_ORDERS, emailQuery);
      setOrders(clientOrders);
      calculateStats(clientOrders);
      setIsOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ordersList: WooCommerceOrder[]) => {
    setStats({
      assigned: ordersList.filter(o => o.technician_status === 'Assigned').length,
      accepted: ordersList.filter(o => o.technician_status !== 'Assigned' && o.technician_status !== 'Rejected' && o.technician_status !== 'Closed').length,
      completed: ordersList.filter(o => o.technician_status === 'Closed').length,
      rejected: ordersList.filter(o => o.technician_status === 'Rejected').length,
    });
  };

  const selectOrderWithDetails = async (orderId: number) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        setTempSignature(data.signature);
        setFinalCloseNote('');
        setCloseJobError(null);
        setIsClosingJobLoading(false);
        
        // If selecting from list, open correct viewing workflow if not already
        if (data.technician_status === 'Assigned') {
          setActiveTab('assigned');
        } else if (data.technician_status === 'Closed' || data.technician_status === 'Rejected') {
          setActiveTab('completed');
        } else {
          setActiveTab('active');
        }
      }
    } catch (e) {
      console.error('Error fetching details for order', orderId, e);
    }
  };

  // Accept Order Workflow
  const handleAcceptOrder = async (orderId: number) => {
    const actionKey = `accept-${orderId}`;
    console.log(`[FRONTEND_HANDLER] handleAcceptOrder invoked for order ${orderId}. Current in-flight actions:`, Array.from(inFlightRequests.current));
    
    if (inFlightRequests.current.has(actionKey)) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate accept request for order ${orderId} (Already in-flight!)`);
      return;
    }
    
    if (isAcceptingOrderId === orderId) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate accept request for order ${orderId} (isAcceptingOrderId === orderId)`);
      return;
    }

    inFlightRequests.current.add(actionKey);
    setIsAcceptingOrderId(orderId);
    console.log(`[FRONTEND_API_SEND] Sending Accept order POST request for order ${orderId}`);

    try {
      const res = await apiFetch(`/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser ? currentUser.email : '' })
      });
      
      console.log(`[FRONTEND_API_RECEIVE] Received response for Accept order ${orderId}: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const { order, wooCommerceSyncFailed, warning } = data;
        if (wooCommerceSyncFailed) {
          setSyncWarning(warning || "Update saved, but WooCommerce sync failed — will need to be retried or checked.");
        } else {
          setSyncWarning(null);
        }
        console.log(`[FRONTEND_API_SUCCESS] Accept order ${orderId} succeeded.`);
        // Update local arrays
        const updatedOrders = orders.map(o => o.id === orderId ? order : o);
        setOrders(updatedOrders);
        calculateStats(updatedOrders);
        setSelectedOrder(order);
        setActiveTab('active');
      } else if (res.status === 409) {
        const errData = await res.json();
        console.warn(`[FRONTEND_API_CONFLICT] Accept order ${orderId} conflict: ${errData.error}`);
        alert(errData.error || 'This job has already been accepted by another technician.');
        // Refresh order list
        fetchConfigAndOrders();
      } else {
        console.error(`[FRONTEND_API_ERROR] Accept order ${orderId} failed with status: ${res.status}`);
      }
    } catch (e) {
      console.error('[FRONTEND_API_EXCEPTION] Accept order exception:', e);
    } finally {
      inFlightRequests.current.delete(actionKey);
      setIsAcceptingOrderId(null);
      console.log(`[FRONTEND_HANDLER] handleAcceptOrder completed for order ${orderId}. Removed action key.`);
    }
  };

  // Reject Order Workflow
  const handleRejectOrder = async (orderId: number, reason: string) => {
    const actionKey = `reject-${orderId}`;
    console.log(`[FRONTEND_HANDLER] handleRejectOrder invoked for order ${orderId}. Current in-flight actions:`, Array.from(inFlightRequests.current));

    if (inFlightRequests.current.has(actionKey)) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate reject request for order ${orderId} (Already in-flight!)`);
      return;
    }

    if (isRejectingOrderId === orderId) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate reject request for order ${orderId} (isRejectingOrderId === orderId)`);
      return;
    }

    inFlightRequests.current.add(actionKey);
    setIsRejectingOrderId(orderId);
    console.log(`[FRONTEND_API_SEND] Sending Reject order POST request for order ${orderId}`);

    try {
      const res = await apiFetch(`/api/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      console.log(`[FRONTEND_API_RECEIVE] Received response for Reject order ${orderId}: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const { order, wooCommerceSyncFailed, warning } = data;
        if (wooCommerceSyncFailed) {
          setSyncWarning(warning || "Update saved, but WooCommerce sync failed — will need to be retried or checked.");
        } else {
          setSyncWarning(null);
        }
        console.log(`[FRONTEND_API_SUCCESS] Reject order ${orderId} succeeded.`);
        const updatedOrders = orders.map(o => o.id === orderId ? order : o);
        setOrders(updatedOrders);
        calculateStats(updatedOrders);
        setRejectionModalId(null);
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(order);
        }
        setActiveTab('dashboard');
      } else {
        console.error(`[FRONTEND_API_ERROR] Reject order ${orderId} failed with status: ${res.status}`);
      }
    } catch (e) {
      console.error('[FRONTEND_API_EXCEPTION] Reject order exception:', e);
    } finally {
      inFlightRequests.current.delete(actionKey);
      setIsRejectingOrderId(null);
      console.log(`[FRONTEND_HANDLER] handleRejectOrder completed for order ${orderId}. Removed action key.`);
    }
  };

  // Progress Status Update Workflow
  const handleUpdateStatus = async (orderId: number, status: JobStatus) => {
    const actionKey = `status-${orderId}`;
    console.log(`[FRONTEND_HANDLER] handleUpdateStatus invoked for order ${orderId}, status: ${status}. Current in-flight actions:`, Array.from(inFlightRequests.current));

    if (inFlightRequests.current.has(actionKey)) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate status update request for order ${orderId} to ${status} (Already in-flight!)`);
      return;
    }

    if (isUpdatingStatusOrderId === orderId) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate status update request for order ${orderId} to ${status} (isUpdatingStatusOrderId === orderId)`);
      return;
    }

    inFlightRequests.current.add(actionKey);
    setIsUpdatingStatusOrderId(orderId);
    console.log(`[FRONTEND_API_SEND] Sending Status update POST request for order ${orderId} to ${status}`);

    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      console.log(`[FRONTEND_API_RECEIVE] Received response for status update of order ${orderId}: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const { order, wooCommerceSyncFailed, warning } = data;
        if (wooCommerceSyncFailed) {
          setSyncWarning(warning || "Update saved, but WooCommerce sync failed — will need to be retried or checked.");
        } else {
          setSyncWarning(null);
        }
        console.log(`[FRONTEND_API_SUCCESS] Status update of order ${orderId} to ${status} succeeded.`);
        const updatedOrders = orders.map(o => o.id === orderId ? order : o);
        setOrders(updatedOrders);
        calculateStats(updatedOrders);
        setSelectedOrder(order);
      } else {
        console.error(`[FRONTEND_API_ERROR] Status update of order ${orderId} failed with status: ${res.status}`);
      }
    } catch (e) {
      console.error('[FRONTEND_API_EXCEPTION] Status update exception:', e);
    } finally {
      inFlightRequests.current.delete(actionKey);
      setIsUpdatingStatusOrderId(null);
      console.log(`[FRONTEND_HANDLER] handleUpdateStatus completed for order ${orderId}, status: ${status}. Removed action key.`);
    }
  };

  // Add Note Workflow
  const handleAddNote = async (orderId: number) => {
    if (!newNoteText.trim()) return;
    const actionKey = `note-${orderId}`;
    console.log(`[FRONTEND_HANDLER] handleAddNote invoked for order ${orderId}. Current in-flight actions:`, Array.from(inFlightRequests.current));

    if (inFlightRequests.current.has(actionKey)) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate add note request for order ${orderId} (Already in-flight!)`);
      return;
    }

    if (isAddingNoteOrderId === orderId) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate add note request for order ${orderId} (isAddingNoteOrderId === orderId)`);
      return;
    }

    inFlightRequests.current.add(actionKey);
    setIsAddingNoteOrderId(orderId);
    console.log(`[FRONTEND_API_SEND] Sending Add note POST request for order ${orderId}`);

    try {
      const res = await apiFetch(`/api/orders/${orderId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newNoteText })
      });

      console.log(`[FRONTEND_API_RECEIVE] Received response for Add note to order ${orderId}: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const { note, wooCommerceSyncFailed, warning } = data;
        if (wooCommerceSyncFailed) {
          setSyncWarning(warning || "Update saved, but WooCommerce sync failed — will need to be retried or checked.");
        } else {
          setSyncWarning(null);
        }
        console.log(`[FRONTEND_API_SUCCESS] Add note to order ${orderId} succeeded.`);
        if (selectedOrder && selectedOrder.id === orderId) {
          const updatedSelected = {
            ...selectedOrder,
            notes: [...selectedOrder.notes, note]
          };
          setSelectedOrder(updatedSelected);
          setOrders(orders.map(o => o.id === orderId ? updatedSelected : o));
        }
        setNewNoteText('');
      } else {
        console.error(`[FRONTEND_API_ERROR] Add note to order ${orderId} failed with status: ${res.status}`);
      }
    } catch (e) {
      console.error('[FRONTEND_API_EXCEPTION] Add note exception:', e);
    } finally {
      inFlightRequests.current.delete(actionKey);
      setIsAddingNoteOrderId(null);
      console.log(`[FRONTEND_HANDLER] handleAddNote completed for order ${orderId}. Removed action key.`);
    }
  };

  // Upload Photo base64
  const handleUploadPhoto = async (orderId: number, base64: string) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: base64 })
      });
      if (res.ok) {
        const data = await res.json();
        if (selectedOrder && selectedOrder.id === orderId) {
          const updatedSelected = {
            ...selectedOrder,
            photos: data.photos // Use storage URL array returned by the secure server
          };
          setSelectedOrder(updatedSelected);
          setOrders(orders.map(o => o.id === orderId ? updatedSelected : o));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add Material item
  const handleAddMaterial = async (orderId: number, material: Omit<MaterialItem, 'id'>) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(material)
      });
      if (res.ok) {
        const { materials } = await res.json();
        if (selectedOrder && selectedOrder.id === orderId) {
          const updatedSelected = { ...selectedOrder, materials };
          setSelectedOrder(updatedSelected);
          setOrders(orders.map(o => o.id === orderId ? updatedSelected : o));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Final Close Job Workflow
  const handleCloseJob = async (orderId: number) => {
    if (!finalCloseNote || finalCloseNote.trim() === '') {
      setCloseJobError('Final closing comment note is required before closing the job.');
      return;
    }

    const actionKey = `close-${orderId}`;
    console.log(`[FRONTEND_HANDLER] handleCloseJob invoked for order ${orderId}. Current in-flight actions:`, Array.from(inFlightRequests.current));

    if (inFlightRequests.current.has(actionKey)) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate close job request for order ${orderId} (Already in-flight!)`);
      return;
    }

    if (isClosingJobLoading) {
      console.warn(`[FRONTEND_HANDLER] Blocked duplicate close job request for order ${orderId} (isClosingJobLoading is true)`);
      return;
    }

    inFlightRequests.current.add(actionKey);
    setIsClosingJobLoading(true);
    setCloseJobError(null);
    console.log(`[FRONTEND_API_SEND] Sending Close job POST request for order ${orderId}`);

    try {
      const res = await apiFetch(`/api/orders/${orderId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: tempSignature,
          notes: finalCloseNote.trim()
        })
      });

      console.log(`[FRONTEND_API_RECEIVE] Received response for Close job ${orderId}: ${res.status}`);
      if (res.ok) {
        const { order } = await res.json();
        console.log(`[FRONTEND_API_SUCCESS] Close job ${orderId} succeeded.`);
        const updatedOrders = orders.map(o => o.id === orderId ? order : o);
        setOrders(updatedOrders);
        calculateStats(updatedOrders);
        setSelectedOrder(order);
        setFinalCloseNote('');
        setTempSignature(null);
        setCloseJobError(null);
        setActiveTab('completed');
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error(`[FRONTEND_API_ERROR] Close job ${orderId} failed:`, errData.error);
        setCloseJobError(errData.error || 'Failed to close the job. WooCommerce sync might have failed.');
      }
    } catch (e: any) {
      console.error('[FRONTEND_API_EXCEPTION] Close job exception:', e);
      setCloseJobError(e?.message || 'Network or connection error. Please check your credentials and try again.');
    } finally {
      inFlightRequests.current.delete(actionKey);
      setIsClosingJobLoading(false);
      console.log(`[FRONTEND_HANDLER] handleCloseJob completed for order ${orderId}. Removed action key.`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoggingIn(true);
      setLoginError(null);

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem('ac_tech_user', JSON.stringify(data.user));
        setLoginEmail('');
        setLoginPassword('');
      } else {
        let errMsg = `Server returned error status ${res.status}.`;
        try {
          const text = await res.text();
          try {
            const errData = JSON.parse(text);
            errMsg = errData.error || errMsg;
          } catch {
            if (text.includes('<!DOCTYPE') || text.includes('<html>')) {
              errMsg = `Authentication Failed (${res.status}): Server returned an HTML error page. This can occur if the server is starting up, deploying, or blocked by a proxy. Please reload the page.`;
            } else if (text.trim()) {
              errMsg = `Authentication Failed (${res.status}): ${text.substring(0, 150)}`;
            }
          }
        } catch (e) {}
        setLoginError(errMsg);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(`Network/Connection Error: ${err.message || err}. Please ensure the server is active.`);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ac_tech_user');
    setOrders([]);
    setSelectedOrder(null);
  };

  // Search and filter orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.number.includes(searchQuery) ||
      o.customer_phone.includes(searchQuery) ||
      o.service_type.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    return o.technician_status === statusFilter;
  });

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center font-sans px-4 py-12 selection:bg-indigo-500 selection:text-white antialiased">
        <div className="w-full max-w-md space-y-8 animate-fadeIn">
          {/* Logo / Brand Header */}
          <div className="text-center">
            <div className="inline-flex w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center text-white font-black shadow-lg shadow-indigo-950/50 mb-4 border border-indigo-500/30">
              <Wrench className="w-8 h-8 text-indigo-100" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Technician Portal</h1>
            <p className="text-xs text-slate-400 mt-2">Sign in using your authorized technical user account</p>
          </div>

          {/* Login Card */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
            {isIframe && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl flex flex-col space-y-2.5 animate-fadeIn">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>IFrame Cookie Restriction Detected:</strong> If you get a blank red box, <strong>Error 404</strong>, or cannot sign in, please click the button below to open the portal in a new tab.
                  </span>
                </div>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 px-4 rounded-xl text-center transition-all inline-flex items-center justify-center space-x-1 shadow-md active:scale-95"
                >
                  <span>Open Portal in New Tab ↗</span>
                </a>
              </div>
            )}

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex flex-col space-y-1.5 animate-shake">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
                {loginError.toLowerCase().includes('404') && (
                  <p className="text-[10px] text-rose-400 pl-6 leading-relaxed">
                    This error usually happens because browsers block cookies inside iframes. 
                    Please use the <strong>"Open Portal in New Tab"</strong> button above to bypass this.
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">5-Digit Password</label>
                <input
                  type="password"
                  required
                  maxLength={5}
                  placeholder="•••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95 disabled:opacity-55"
              >
                {loggingIn ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-indigo-200 border-t-transparent rounded-full animate-spin mr-1.5" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>



            <div className="border-t border-slate-800/80 pt-4 flex flex-col items-center space-y-1 text-center">
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${configStatus.hasSupabaseConfigured ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Supabase DB: {configStatus.hasSupabaseConfigured ? 'Connected' : 'Not Configured'}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 leading-normal max-w-xs">
                {configStatus.hasSupabaseConfigured
                  ? `Active on: ${configStatus.supabaseUrl}`
                  : 'Running in simulated sandbox mode.'}
              </p>
              <button 
                type="button" 
                onClick={() => window.location.reload()}
                className="text-[9px] text-indigo-400 hover:text-indigo-300 font-semibold underline mt-1 cursor-pointer"
              >
                Force Refresh Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white antialiased">
      
      {/* 1. APP HEADER */}
      <header id="app-header" className="bg-slate-950 border-b border-slate-800/80 sticky top-0 z-40 px-4 py-3 shadow-md backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-inner shadow-indigo-400">
              <Wrench className="w-5 h-5 text-indigo-100 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center space-x-1.5">
                <span>Technician Portal</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono">PWA</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium flex items-center space-x-1">
                <span className="text-indigo-300 font-semibold">{currentUser ? currentUser.name : ' राहुल '}</span>
                <span className="text-slate-600">•</span>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${technicianStatus === 'Online' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                <span>{technicianStatus}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Online Status Switcher */}
            <button
              onClick={() => setTechnicianStatus(prev => prev === 'Online' ? 'Offline' : 'Online')}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center space-x-1 transition-all ${
                technicianStatus === 'Online'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {technicianStatus === 'Online' ? <Wifi className="w-3.5 h-3.5 mr-1" /> : <WifiOff className="w-3.5 h-3.5 mr-1" />}
              <span className="hidden sm:inline">{technicianStatus === 'Online' ? 'Go Offline' : 'Go Online'}</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg font-semibold border border-slate-700 transition-all flex items-center space-x-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>
      
      {syncWarning && (
        <div id="woocommerce-sync-warning-banner" className="bg-amber-500/10 border-b border-amber-500/35 px-4 py-3 text-xs text-amber-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-bounce" />
            <span>
              <strong>Warning:</strong> {syncWarning}
            </span>
          </div>
          <button
            onClick={() => setSyncWarning(null)}
            className="text-amber-400 hover:text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/20 hover:border-amber-500/40 transition-all text-[10px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {isOfflineMode && (
        <div id="offline-sandbox-banner" className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs text-amber-300 flex items-center justify-center space-x-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <span>
            <strong>IFrame Sandbox Mode Active:</strong> Using client-side simulation because browser blocked cookies. Click the button to the right to open in a new tab for full live WooCommerce sync.
          </span>
          <a
            href={window.location.origin}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-lg text-[10px] ml-2 transition-all inline-flex items-center space-x-1"
          >
            <span>Open in New Tab ↗</span>
          </a>
        </div>
      )}

      {/* 2. MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {loading ? (
          <div className="col-span-12 flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Fetching service records from WooCommerce dashboard...</p>
          </div>
        ) : error ? (
          <div className="col-span-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 text-center max-w-md mx-auto my-12">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="font-bold text-white mb-1">API Server Error</h3>
            <p className="text-slate-400 text-xs mb-4">{error}</p>
            <button
              onClick={fetchConfigAndOrders}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {/* 3A. LEFT RAIL / CENTRAL WORKFLOW (8 COLS ON DESKTOP) */}
            <section className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-6">
              
              {/* METRICS DASHBOARD CARDS */}
              <div id="stats-dashboard" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => { setActiveTab('assigned'); setSelectedOrder(null); }}
                  className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                    activeTab === 'assigned'
                      ? 'bg-amber-600/10 border-amber-500/50 text-white'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/30'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Assigned Feed</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black font-mono tracking-tight text-amber-400">{stats.assigned}</span>
                    <span className="text-xs text-slate-400">Jobs</span>
                  </div>
                  <div className="absolute right-3 bottom-3 p-1.5 rounded-lg bg-slate-800 text-amber-400 group-hover:scale-110 transition-transform">
                    <Briefcase className="w-4 h-4" />
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('active'); setSelectedOrder(null); }}
                  className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                    activeTab === 'active'
                      ? 'bg-indigo-600/10 border-indigo-500/50 text-white'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/30'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Jobs</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black font-mono tracking-tight text-indigo-400">{stats.accepted}</span>
                    <span className="text-xs text-slate-400">Accepted</span>
                  </div>
                  <div className="absolute right-3 bottom-3 p-1.5 rounded-lg bg-slate-800 text-indigo-400 group-hover:scale-110 transition-transform">
                    <Activity className="w-4 h-4" />
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('completed'); setSelectedOrder(null); }}
                  className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                    activeTab === 'completed'
                      ? 'bg-emerald-600/10 border-emerald-500/50 text-white'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/30'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Completed</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black font-mono tracking-tight text-emerald-400">{stats.completed}</span>
                    <span className="text-xs text-slate-400">Tickets</span>
                  </div>
                  <div className="absolute right-3 bottom-3 p-1.5 rounded-lg bg-slate-800 text-emerald-400 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </button>

                <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-950/20 text-left relative overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Rejected</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black font-mono tracking-tight text-rose-400">{stats.rejected}</span>
                    <span className="text-xs text-slate-400">Total</span>
                  </div>
                  <div className="absolute right-3 bottom-3 p-1.5 rounded-lg bg-slate-900 text-rose-400">
                    <X className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* TABS SELECTOR BUTTONS */}
              <div id="tabs-navigation" className="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/50">
                <button
                  onClick={() => { setActiveTab('dashboard'); setSelectedOrder(null); }}
                  className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Orders
                </button>
                <button
                  onClick={() => { setActiveTab('assigned'); setSelectedOrder(null); }}
                  className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'assigned'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  New Feed ({stats.assigned})
                </button>
                <button
                  onClick={() => { setActiveTab('active'); setSelectedOrder(null); }}
                  className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'active'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  My Jobs ({stats.accepted})
                </button>
                <button
                  onClick={() => { setActiveTab('completed'); setSelectedOrder(null); }}
                  className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'completed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  History
                </button>
                <button
                  onClick={() => { setActiveTab('config'); }}
                  className={`p-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'config'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Configure WooCommerce Setup"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {/* LIST VIEWS ACCORDING TO TABS */}

              {/* A. CONFIG TAB */}
              {activeTab === 'config' && (
                <div id="settings-panel" className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-6 space-y-6">
                  <div className="flex items-start space-x-3">
                    <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-400">
                      <Settings className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">System Settings & Integration</h2>
                      <p className="text-xs text-slate-400">Configure real-time sync with your WooCommerce WordPress website.</p>
                    </div>
                  </div>

                  {/* WooCommerce status info */}
                  <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WooCommerce REST Sync</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${configStatus.hasWooCommerceConfigured ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        <span className="text-sm font-semibold text-white">
                          {configStatus.hasWooCommerceConfigured ? 'Direct API Connected' : 'Simulated Sandbox Mode'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        {configStatus.hasWooCommerceConfigured
                          ? `Currently forwarding orders and notes directly to WooCommerce site: ${configStatus.wooCommerceUrl}`
                          : 'Currently using persistent in-memory simulation because environment variables are not yet configured.'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Google Maps Services</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${hasValidMapsKey ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="text-sm font-semibold text-white">
                          {hasValidMapsKey ? 'Advanced Maps SDK Active' : 'Fallback Embed Map Active'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        {hasValidMapsKey
                          ? 'Advanced dynamic routing, customer pin markers, and coordinates plotting is active using standard Google API.'
                          : 'Standard embedded iframe coordinate visualization is active. Provide key to activate advanced marker paths.'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supabase Integration</span>
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${configStatus.hasSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        <span className="text-sm font-semibold text-white">
                          {configStatus.hasSupabaseConfigured ? 'Active Database Sync' : 'Simulated Sandbox Mode'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        {configStatus.hasSupabaseConfigured
                          ? `Connected to Supabase project: ${configStatus.supabaseUrl}`
                          : 'Currently using persistent mock database because Supabase environment variables are not configured.'}
                      </p>
                    </div>
                  </div>

                  {/* Connection Test Trigger & Results */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* WooCommerce Test */}
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                            <Activity className="w-3.5 h-3.5 text-indigo-400" />
                            <span>WooCommerce REST check</span>
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">Perform a diagnostic check of WooCommerce REST API integration.</p>
                        </div>
                        <button
                          onClick={handleTestConnection}
                          disabled={testingConnection}
                          className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all flex items-center justify-center space-x-1.5 ${
                            testingConnection
                              ? 'bg-slate-850 text-slate-500 border-slate-800 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30 hover:scale-[1.02] shadow-md shadow-indigo-950/40 active:scale-[0.98]'
                          }`}
                        >
                          {testingConnection ? (
                            <>
                              <span className="inline-block w-3 h-3 border-2 border-indigo-200 border-t-transparent rounded-full animate-spin mr-1" />
                              <span>Pinging...</span>
                            </>
                          ) : (
                            <>
                              <Wifi className="w-3.5 h-3.5 mr-1" />
                              <span>Test Store API</span>
                            </>
                          )}
                        </button>
                      </div>

                      {testResult && (
                        <div className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 animate-fadeIn ${
                          testResult.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {testResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="space-y-1">
                            <p className="font-bold">{testResult.success ? 'Store Sync Passed' : 'Store Sync Failed'}</p>
                            <p className="text-[11px] opacity-90 leading-relaxed">{testResult.message}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Supabase Test */}
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Supabase DB Check</span>
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">Perform a diagnostic ping and authentication check of Supabase database connection.</p>
                        </div>
                        <button
                          onClick={handleTestSupabase}
                          disabled={testingSupabase}
                          className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all flex items-center justify-center space-x-1.5 ${
                            testingSupabase
                              ? 'bg-slate-850 text-slate-500 border-slate-800 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 hover:scale-[1.02] shadow-md shadow-indigo-950/40 active:scale-[0.98]'
                          }`}
                        >
                          {testingSupabase ? (
                            <>
                              <span className="inline-block w-3 h-3 border-2 border-emerald-200 border-t-transparent rounded-full animate-spin mr-1" />
                              <span>Connecting...</span>
                            </>
                          ) : (
                            <>
                              <Wifi className="w-3.5 h-3.5 mr-1" />
                              <span>Test Supabase</span>
                            </>
                          )}
                        </button>
                      </div>

                      {supabaseTestResult && (
                        <div className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 animate-fadeIn ${
                          supabaseTestResult.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          {supabaseTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="space-y-1">
                            <p className="font-bold">{supabaseTestResult.success ? 'Supabase Sync Passed' : 'Supabase Sync Failed'}</p>
                            <p className="text-[11px] opacity-90 leading-relaxed whitespace-pre-wrap">{supabaseTestResult.message}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detailed setup instructions */}
                  <div className="space-y-3 bg-slate-900/30 p-5 rounded-xl border border-slate-800/50">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">How to connect your live store</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      To synchronize this Technician Applet with your live WordPress/WooCommerce website:
                    </p>
                    <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside leading-relaxed pl-1">
                      <li>
                        Go to your WordPress dashboard → <strong>WooCommerce</strong> → <strong>Settings</strong> → <strong>Advanced</strong> → <strong>REST API</strong>.
                      </li>
                      <li>
                        Click <strong>Add Key</strong>. Generate a key with <strong>Read/Write</strong> permissions.
                      </li>
                      <li>
                        Open <strong>Settings</strong> (⚙️ gear icon, top-right corner of AI Studio) → select <strong>Secrets</strong>.
                      </li>
                      <li>
                        Add the following keys and values:
                        <ul className="list-disc list-inside pl-4 mt-1.5 space-y-1 text-[11px] font-mono text-indigo-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                          <li><code>WOOCOMMERCE_API_URL</code>: Your store base URL</li>
                          <li><code>WOOCOMMERCE_CONSUMER_KEY</code>: e.g. <code>ck_...</code></li>
                          <li><code>WOOCOMMERCE_CONSUMER_SECRET</code>: e.g. <code>cs_...</code></li>
                          <li><code>GOOGLE_MAPS_PLATFORM_KEY</code>: Your Google Maps API Key</li>
                          <li><code>SUPABASE_URL</code>: Your Supabase Project API URL</li>
                          <li><code>SUPABASE_ANON_KEY</code>: Your Supabase Public client key</li>
                        </ul>
                      </li>
                      <li>
                        Press <strong>Enter</strong>. The application container compiles, binds credentials securely backend-side, and restarts in 3 seconds!
                      </li>
                    </ol>
                  </div>

                  {/* Database Schema Visualizer */}
                  <div className="space-y-3 bg-slate-900/30 p-5 rounded-xl border border-slate-800/50">
                    <div className="flex items-center space-x-2 text-indigo-400">
                      <Layers className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">Designed Database Schema</h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Below is the PostgreSQL relational database schema diagram and seed statements designed for this portal. 
                      This ensures full transactional tracking of service tickets, signatures, materials, and technician authorization:
                    </p>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 overflow-x-auto">
                      <pre className="text-[10px] font-mono text-emerald-300/90 leading-relaxed select-all">
{`-- PostgreSQL Database Schema Design for Technician Portal

CREATE TABLE technicians (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- 5-digit Numeric
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'Technician'
);

-- Seed Manual Technical Users
INSERT INTO technicians (email, password_hash, name) VALUES
('ereshmb@gmail.com', '10001', 'Eresh M B'),
('decentsachin.143@gmail.com', '10002', 'Sachin'),
('nidhishri767@gmail.com', '10003', 'Nidhishri');

CREATE TABLE service_orders (
    id INT PRIMARY KEY, -- Maps directly to WooCommerce Order ID
    order_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_address TEXT NOT NULL,
    technician_status VARCHAR(50) DEFAULT 'Assigned', -- 'Assigned', 'Accepted', 'In Progress', 'On Hold', 'Closed'
    accepted_by_email VARCHAR(255) REFERENCES technicians(email) ON DELETE SET NULL
);

CREATE TABLE order_notes (
    id VARCHAR(100) PRIMARY KEY,
    order_id INT REFERENCES service_orders(id) ON DELETE CASCADE,
    author VARCHAR(100) NOT NULL,
    message TEXT NOT NULL
);`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* B. LIST OF ORDERS (dashboard / assigned / active / completed) */}
              {activeTab !== 'config' && (
                <div className="space-y-4">
                  {/* Search and filter bar */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search customer, order ID, or product..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    {activeTab === 'dashboard' && (
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                      >
                        <option value="all">All Technician Statuses</option>
                        <option value="Assigned">Assigned (New)</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Travelling">Travelling</option>
                        <option value="Reached">Reached</option>
                        <option value="Inspection">Inspection</option>
                        <option value="Installing">Installing</option>
                        <option value="Gas Charging">Gas Charging</option>
                        <option value="Testing">Testing</option>
                        <option value="Closed">Closed</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    )}
                  </div>

                  {/* Filter tabs display subset indicator */}
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-semibold text-slate-400 capitalize">
                      {activeTab === 'dashboard' ? 'General Order List' : `${activeTab} orders`} ({filteredOrders.length})
                    </span>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-[11px] text-indigo-400 hover:underline"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>

                  {/* Orders Cards Container */}
                  <div className="space-y-3.5">
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-16 bg-slate-950/20 border border-slate-800/60 rounded-2xl">
                        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">No matching WooCommerce orders found in this tab.</p>
                      </div>
                    ) : (
                      filteredOrders.map((o) => {
                        const isAssigned = o.technician_status === 'Assigned';
                        const isClosed = o.technician_status === 'Closed';
                        const isRejected = o.technician_status === 'Rejected';
                        const isActive = !isAssigned && !isClosed && !isRejected;

                        return (
                          <div
                            key={o.id}
                            onClick={() => selectOrderWithDetails(o.id)}
                            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                              selectedOrder?.id === o.id
                                ? 'bg-indigo-950/20 border-indigo-500 shadow-lg shadow-indigo-950/30 ring-1 ring-indigo-500/30'
                                : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/10'
                            }`}
                          >
                            {/* Left: order core identifier & customer info */}
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="bg-slate-800 text-slate-300 font-mono text-[11px] font-black px-2 py-0.5 rounded-lg border border-slate-700/80">
                                  {o.number}
                                </span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-200 font-semibold">{o.service_type}</span>
                                
                                {/* Status badges */}
                                {isAssigned && (
                                  <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">
                                    Assigned (New)
                                  </span>
                                )}
                                {isActive && (
                                  <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                                    {o.technician_status}
                                  </span>
                                )}
                                {isClosed && (
                                  <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                                    Closed (Job Work Done)
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-full">
                                    Rejected
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1">
                                <div className="text-sm font-bold text-white flex items-center justify-between">
                                  <div className="flex items-center space-x-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{o.customer_name}</span>
                                  </div>
                                </div>
                                
                                <div className="text-xs text-slate-400 flex items-start space-x-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-1">{o.customer_address}</span>
                                </div>

                                <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                                  <a
                                    href={`tel:${o.customer_phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center space-x-1 text-slate-300 hover:text-emerald-400 transition-colors font-medium bg-slate-900/40 hover:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800/80"
                                    title="Call Customer"
                                  >
                                    <Phone className="w-3 h-3 text-emerald-400" />
                                    <span>{o.customer_phone}</span>
                                  </a>
                                  <a
                                    href={`https://wa.me/${o.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${o.customer_name}, this is your technician ${currentUser?.name || 'Eresh'} regarding your service order ${o.number}.`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center space-x-1 text-slate-300 hover:text-green-400 transition-colors font-medium bg-slate-900/40 hover:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800/80"
                                    title="Chat on WhatsApp"
                                  >
                                    <MessageSquare className="w-3 h-3 text-green-400" />
                                    <span>WhatsApp</span>
                                  </a>
                                </div>

                                <div className="text-xs text-slate-500 flex items-center space-x-4 pt-0.5">
                                  <span className="flex items-center space-x-1">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span>{o.preferred_time}</span>
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${o.payment_status === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    <span>{o.payment_status}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Quick action buttons for list */}
                            <div className="flex flex-row md:flex-col items-stretch gap-2 w-full md:w-auto border-t border-slate-800/60 md:border-t-0 pt-3 md:pt-0">
                              {isAssigned && (
                                <div className="flex md:flex-col items-center gap-2 w-full md:w-auto">
                                  <button
                                    disabled={isAcceptingOrderId === o.id || isRejectingOrderId === o.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptOrder(o.id);
                                    }}
                                    className="flex-1 md:w-28 bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isAcceptingOrderId === o.id ? (
                                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isAcceptingOrderId === o.id ? 'Accepting...' : 'Accept'}</span>
                                  </button>
                                  <button
                                    disabled={isAcceptingOrderId === o.id || isRejectingOrderId === o.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRejectionModalId(o.id);
                                    }}
                                    className="flex-1 md:w-28 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              )}
                              {!isAssigned && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectOrderWithDetails(o.id);
                                  }}
                                  className="w-full md:w-28 bg-slate-800 hover:bg-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold border border-slate-700 transition-all flex items-center justify-center space-x-1"
                                >
                                  <span>View Details</span>
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 3B. RIGHT RAIL / CORE JOB DETAIL VIEW (4 COLS ON DESKTOP) */}
            <aside className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-6">
              
              {selectedOrder ? (
                <div id="job-details-card" className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 space-y-6 sticky top-20 shadow-xl overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-slate-800">
                  
                  {/* DETAIL HEADER */}
                  <div className="flex justify-between items-start border-b border-slate-800/80 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono text-[11px] font-black px-2.5 py-0.5 rounded-lg">
                          {selectedOrder.number}
                        </span>
                        <span className="text-xs text-slate-500">WooCommerce ID: {selectedOrder.id}</span>
                      </div>
                      <h2 className="text-base font-extrabold text-white mt-1.5 leading-snug">{selectedOrder.service_type}</h2>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1">
                        <span>Status:</span>
                        <span className="font-bold text-indigo-400">{selectedOrder.technician_status}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="text-slate-500 hover:text-slate-300 p-1 bg-slate-900 border border-slate-800 rounded-lg transition-colors"
                      title="Collapse details"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* CUSTOMER CONTACT QUICK ACTIONS */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50">
                    <a
                      href={`tel:${selectedOrder.customer_phone}`}
                      className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg p-2.5 text-xs font-bold text-center flex items-center justify-center space-x-2 border border-slate-700 transition-colors shadow-sm"
                    >
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <span>Call Customer</span>
                    </a>
                    <a
                      href={`https://wa.me/${selectedOrder.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${selectedOrder.customer_name}, this is your technician ${currentUser?.name || 'Eresh'} regarding your service order ${selectedOrder.number}.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg p-2.5 text-xs font-bold text-center flex items-center justify-center space-x-2 border border-slate-700 transition-colors shadow-sm"
                    >
                      <MessageSquare className="w-4 h-4 text-green-400" />
                      <span>WhatsApp</span>
                    </a>
                  </div>

                  {/* ACTIVE WORKFLOW STEP CONTROLLER */}
                  {selectedOrder.technician_status !== 'Closed' && selectedOrder.technician_status !== 'Rejected' && (
                    <div className="space-y-3 bg-slate-900/20 border border-slate-800/80 rounded-2xl p-4">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Job Progress Workflow</span>
                      
                      {selectedOrder.technician_status === 'Assigned' ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400 leading-relaxed">This job is currently assigned to you. Accept the ticket to unlock directions and work logging.</p>
                          <div className="flex gap-2">
                            <button
                              disabled={isAcceptingOrderId === selectedOrder.id || isRejectingOrderId === selectedOrder.id}
                              onClick={() => handleAcceptOrder(selectedOrder.id)}
                              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAcceptingOrderId === selectedOrder.id ? (
                                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              <span>{isAcceptingOrderId === selectedOrder.id ? 'Accepting Job...' : 'Accept Job'}</span>
                            </button>
                            <button
                              disabled={isAcceptingOrderId === selectedOrder.id || isRejectingOrderId === selectedOrder.id}
                              onClick={() => setRejectionModalId(selectedOrder.id)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Next Status Suggestion Slider / Button */}
                           <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Update Current Status</label>
                            
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { status: 'Accepted', label: 'Accepted' },
                                { status: 'In Progress', label: 'In Progress' },
                                { status: 'On Hold', label: 'On Hold' },
                              ].map((step) => {
                                const isActive = selectedOrder.technician_status === step.status;
                                const isThisUpdating = isUpdatingStatusOrderId === selectedOrder.id;
                                return (
                                  <button
                                    key={step.status}
                                    disabled={isThisUpdating}
                                    onClick={() => {
                                      console.log(`[FRONTEND_CLICK] Status update button clicked for order ${selectedOrder.id} - target status: ${step.status}`);
                                      handleUpdateStatus(selectedOrder.id, step.status as JobStatus);
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                                      isActive
                                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                                    }`}
                                  >
                                    {isThisUpdating && isActive && (
                                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                    )}
                                    <span>{step.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Quick action helper notes */}
                          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                            <strong>Note:</strong> Every status update is automatically pushed as an annotated order note directly to your WooCommerce admin dashboard.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* NOTES PANEL (WOOCOMMERCE INTEGRATED) */}
                  <div className="space-y-3 border-t border-slate-800/80 pt-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">WooCommerce Order Notes</h3>
                    
                    {/* Notes List */}
                    {selectedOrder.notes.length > 0 ? (
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {[...selectedOrder.notes]
                          .sort((a, b) => parseNoteTimestamp(b.timestamp) - parseNoteTimestamp(a.timestamp))
                          .map((n) => (
                            <div key={n.id} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                <span className={n.author.includes('Self') ? 'text-indigo-400' : 'text-slate-300'}>{n.author}</span>
                                <span className="text-slate-500 font-mono">
                                  {(() => {
                                    const parsed = parseNoteTimestamp(n.timestamp);
                                    if (parsed === 0) return 'N/A';
                                    const d = new Date(parsed);
                                    return d.toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    });
                                  })()}
                                </span>
                              </div>
                              <p className="text-slate-200 leading-relaxed font-medium">{n.message}</p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-1">No notes logged for this service ticket yet.</p>
                    )}

                    {/* New Note Form */}
                    {selectedOrder.technician_status !== 'Closed' && selectedOrder.technician_status !== 'Rejected' && (
                      <div className="space-y-2.5">
                        {/* Quick-tap Presets Row for order status notes */}
                        <div className="flex flex-wrap gap-1.5 pb-0.5">
                          {[
                            'Job Started',
                            'Parts Replaced',
                            'Diagnostic Complete',
                            'Waiting on Parts',
                            'Waiting on Customer Approval',
                            'Customer Not Available',
                            'Installation Complete'
                          ].map((phrase) => (
                            <button
                              key={phrase}
                              type="button"
                              disabled={isAddingNoteOrderId === selectedOrder.id}
                              onClick={() => {
                                setNewNoteText((prev) => {
                                  const trimmed = prev.trim();
                                  if (!trimmed) return phrase;
                                  return `${trimmed} ${phrase}`;
                                });
                              }}
                              className="text-[10px] font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800/80 rounded-full px-2.5 py-1 transition-all cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {phrase}
                            </button>
                          ))}
                        </div>

                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Type customer or service updates..."
                            value={newNoteText}
                            onChange={(e) => setNewNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddNote(selectedOrder.id);
                              }
                            }}
                            disabled={isAddingNoteOrderId === selectedOrder.id}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <button
                            disabled={!newNoteText.trim() || isAddingNoteOrderId === selectedOrder.id}
                            onClick={() => handleAddNote(selectedOrder.id)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAddingNoteOrderId === selectedOrder.id ? (
                              <>
                                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                <span>Sending...</span>
                              </>
                            ) : (
                              <span>Send</span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CUSTOMER ADDRESS & MAP DISPATCH */}
                  <div className="space-y-3 border-t border-slate-800/80 pt-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Service Location & Address</h3>
                      <div className="flex items-center space-x-3 text-xs">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedOrder.customer_address)}&travelmode=driving`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1"
                          title="Open Google Maps Driving Directions"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Get Directions</span>
                        </a>
                        <span className="text-slate-800">|</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrder.customer_address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-rose-400 hover:text-rose-300 font-bold flex items-center space-x-1"
                          title="View on Google Maps Search"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Search GPS</span>
                        </a>
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-300 flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">{selectedOrder.customer_name}</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">{selectedOrder.customer_address}</p>
                      </div>
                    </div>

                    {/* INTERACTIVE MAP COMPONENT */}
                    {selectedOrder.latitude && selectedOrder.longitude && selectedOrder.latitude !== 0 && selectedOrder.longitude !== 0 ? (
                      <div className="h-44 w-full rounded-xl overflow-hidden border border-slate-800 relative bg-slate-950">
                        {hasValidMapsKey ? (
                          <APIProvider apiKey={GOOGLE_MAPS_KEY} version="weekly">
                            <Map
                              defaultCenter={{ lat: selectedOrder.latitude, lng: selectedOrder.longitude }}
                              defaultZoom={13}
                              mapId="DEMO_MAP_ID"
                              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                              style={{ width: '100%', height: '100%' }}
                              disableDefaultUI={true}
                            >
                              <AdvancedMarker position={{ lat: selectedOrder.latitude, lng: selectedOrder.longitude }} title={selectedOrder.customer_name}>
                                <Pin background="#ef4444" glyphColor="#fff" />
                              </AdvancedMarker>
                            </Map>
                          </APIProvider>
                        ) : (
                          // Clean, high-fidelity fallback using standard Google Maps embed (perfect coordinate accuracy)
                          <iframe
                            title="Customer Location Embed"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer"
                            src={`https://maps.google.com/maps?q=${selectedOrder.latitude},${selectedOrder.longitude}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="h-32 w-full rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 flex flex-col items-center justify-center text-center p-4">
                        <MapPin className="w-5 h-5 text-slate-500 mb-1.5 flex-shrink-0 animate-pulse" />
                        <p className="text-[11px] font-semibold text-slate-300">Map preview unavailable</p>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">Coordinates not resolved. Please use 'Get Directions' or 'Search GPS' instead.</p>
                      </div>
                    )}
                  </div>

                  {/* ORDER ITEM INFORMATION */}
                  <div className="space-y-2 bg-slate-900/10 border border-slate-800/80 rounded-xl p-3.5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Products Ordered</h3>
                    <div className="space-y-1.5">
                      {selectedOrder.products.map((p, idx) => (
                        <div key={idx} className="flex items-center space-x-2 text-xs font-semibold text-white">
                          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PHOTO EVIDENCE LOCK */}
                  {selectedOrder.technician_status !== 'Assigned' && selectedOrder.technician_status !== 'Closed' && selectedOrder.technician_status !== 'Rejected' && (
                    <div className="border-t border-slate-800/80 pt-5">
                      <PhotoUploader
                        photos={selectedOrder.photos}
                        onUpload={(base64) => handleUploadPhoto(selectedOrder.id, base64)}
                      />
                    </div>
                  )}

                  {/* MATERIALS USED LOG */}
                  {selectedOrder.technician_status !== 'Assigned' && selectedOrder.technician_status !== 'Closed' && selectedOrder.technician_status !== 'Rejected' && (
                    <div className="border-t border-slate-800/80 pt-5">
                      <MaterialTracker
                        materials={selectedOrder.materials}
                        onAdd={(m) => handleAddMaterial(selectedOrder.id, m)}
                      />
                    </div>
                  )}



                  {/* FINAL SIGNATURE AND COMPLETION PANEL */}
                  {selectedOrder.technician_status !== 'Closed' && selectedOrder.technician_status !== 'Rejected' && selectedOrder.technician_status !== 'Assigned' && (
                    <div className="space-y-4 border-t border-slate-800/80 pt-5 bg-indigo-950/10 p-4 rounded-2xl border border-indigo-500/20">
                      <div className="flex items-center space-x-2 text-indigo-400">
                        <PenTool className="w-5 h-5" />
                        <h3 className="text-sm font-bold">Final Job Clearance</h3>
                      </div>

                      {/* Signature pad */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Customer Digital Signature <span className="text-emerald-400 font-bold">* Required</span>
                        </span>
                        <SignaturePad
                          onSave={(base64) => setTempSignature(base64)}
                          onClear={() => setTempSignature(null)}
                        />
                      </div>

                      {/* Closing comments */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center block">
                          <span>Closing Service Remarks</span>
                          <span className="text-rose-400 font-bold text-[9px] uppercase font-mono tracking-normal">* Required</span>
                        </label>
                        <textarea
                          placeholder="Write final diagnostic outcome (e.g., check list done, temperature checked, job done fully)..."
                          value={finalCloseNote}
                          onChange={(e) => {
                            setFinalCloseNote(e.target.value);
                            if (e.target.value.trim() !== '') {
                              setCloseJobError(null);
                            }
                          }}
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                        />
                      </div>

                      {/* Display Sync/Close Error & Retry */}
                      {closeJobError && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-start space-x-2.5 animate-fadeIn">
                          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1.5 flex-1">
                            <p className="font-bold text-[11px] text-rose-400">WooCommerce Sync Error</p>
                            <p className="text-[11px] opacity-90 leading-relaxed">{closeJobError}</p>
                            <button
                              onClick={() => handleCloseJob(selectedOrder.id)}
                              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline block mt-1"
                            >
                              Retry Closing Job
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => handleCloseJob(selectedOrder.id)}
                        disabled={!tempSignature || !finalCloseNote.trim() || isClosingJobLoading}
                        className={`w-full py-2.5 rounded-xl font-extrabold text-xs text-center flex items-center justify-center space-x-1.5 shadow-md transition-all ${
                          tempSignature && finalCloseNote.trim() && !isClosingJobLoading
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 cursor-pointer hover:scale-[1.01]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                        }`}
                      >
                        {isClosingJobLoading ? (
                          <>
                            <span className="inline-block w-3.5 h-3.5 border-2 border-emerald-200 border-t-transparent rounded-full animate-spin mr-1.5" />
                            <span>Syncing WooCommerce Ticket...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Confirm Clearance & Close WooCommerce Ticket</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* COMPLETED SIGNATURE/CLOSING DETAILS ARCHIVE DISPLAY */}
                  {(selectedOrder.technician_status === 'Closed' || selectedOrder.technician_status === 'Completed') && selectedOrder.signature && (
                    <div className="border-t border-slate-800/80 pt-5 space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Job Signature Verification</span>
                      <div className="p-3 bg-white border border-slate-100 rounded-xl max-w-[200px] shadow-inner">
                        <img
                          src={selectedOrder.signature}
                          alt="Verification Customer Signature"
                          className="max-h-24 mx-auto object-contain"
                        />
                      </div>
                      {selectedOrder.completed_at && (
                        <p className="text-[10px] text-slate-500 font-semibold font-mono">
                          Cleared timestamp: {new Date(selectedOrder.completed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div id="no-selection-placeholder" className="bg-slate-950/30 border border-slate-800/80 rounded-2xl p-8 text-center hidden lg:flex flex-col items-center justify-center h-96 space-y-4">
                  <div className="w-14 h-14 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-950/50">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white">No Order Selected</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Select a service ticket from your list to initiate routing instructions, upload parts, log materials, and complete customer check-ins.</p>
                  </div>
                </div>
              )}
            </aside>
          </>
        )}
      </main>

      {/* 4. REJECTION MODAL */}
      {rejectionModalId !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white">Reject Service Request</h3>
              <button
                onClick={() => setRejectionModalId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to reject this ticket? WooCommerce will mark the order on-hold and notify administrators.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Specify Rejection Reason</label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Busy today">Busy (Schedule Clash)</option>
                <option value="Too Far">Customer Too Far (Distance limit exceeded)</option>
                <option value="Vehicle Breakdown">Vehicle Issue / Tool Maintenance</option>
                <option value="Emergency Leave">Personal Emergency</option>
                <option value="Other">Other Reasons</option>
              </select>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                disabled={isRejectingOrderId === rejectionModalId}
                onClick={() => handleRejectOrder(rejectionModalId, rejectionReason)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl py-2 text-xs font-bold transition-all active:scale-95 shadow-md shadow-rose-950/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
              >
                {isRejectingOrderId === rejectionModalId && (
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                )}
                <span>Confirm Reject</span>
              </button>
              <button
                onClick={() => setRejectionModalId(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl py-2 text-xs font-bold border border-slate-700 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MINIMALIST FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-4 px-4 text-center text-slate-500 text-[10px] tracking-wide mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© 2026 Technician Portal. Powered by Google AI Studio.</span>
          <div className="flex space-x-3 text-[9px] font-mono text-slate-400">
            <span>Server: Active</span>
            <span>•</span>
            <span>OAuth & REST: Enabled</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
