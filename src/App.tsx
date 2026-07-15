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

export default function App() {
  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [stats, setStats] = useState<AppStats>({ assigned: 0, accepted: 0, completed: 0, rejected: 0 });
  const [selectedOrder, setSelectedOrder] = useState<WooCommerceOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assigned' | 'active' | 'completed' | 'config'>('dashboard');
  
  // Technician user authentication state (from localStorage)
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; role: string } | null>(() => {
    const saved = localStorage.getItem('ac_tech_user');
    return saved ? JSON.parse(saved) : null;
  });
  
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
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

  // Fetch initial configuration & orders on change of technician user context
  useEffect(() => {
    fetchConfigAndOrders(currentUser ? currentUser.email : null);
  }, [currentUser]);

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      setTestResult(null);
      const res = await fetch('/api/test-connection', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: data.success,
          message: data.message
        });
        // Also refresh config status
        const configRes = await fetch('/api/config-status');
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
      const res = await fetch('/api/test-supabase', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSupabaseTestResult({
          success: data.success,
          message: data.message
        });
        // refresh config
        const configRes = await fetch('/api/config-status');
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
      
      const configRes = await fetch('/api/config-status');
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfigStatus(configData);
      }

      // Check active technician email to query filtered list
      const emailQuery = techEmail !== undefined ? techEmail : (currentUser ? currentUser.email : null);
      const url = emailQuery ? `/api/orders?tech_email=${encodeURIComponent(emailQuery)}` : '/api/orders';

      const ordersRes = await fetch(url);
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
        calculateStats(ordersData);
      } else {
        throw new Error('Failed to load orders from local API server.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Server connection error.');
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
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        setTempSignature(data.signature);
        setFinalCloseNote('');
        
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
    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser ? currentUser.email : '' })
      });
      if (res.ok) {
        const { order } = await res.json();
        // Update local arrays
        const updatedOrders = orders.map(o => o.id === orderId ? order : o);
        setOrders(updatedOrders);
        calculateStats(updatedOrders);
        setSelectedOrder(order);
        setActiveTab('active');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Reject Order Workflow
  const handleRejectOrder = async (orderId: number, reason: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        const { order } = await res.json();
        const updatedOrders = orders.map(o => o.id === orderId ? order : o);
        setOrders(updatedOrders);
        calculateStats(updatedOrders);
        setRejectionModalId(null);
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(order);
        }
        setActiveTab('dashboard');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Progress Status Update Workflow
  const handleUpdateStatus = async (orderId: number, status: JobStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const { order } = await res.json();
        const updatedOrders = orders.map(o => o.id === orderId ? order : o);
        setOrders(updatedOrders);
        calculateStats(updatedOrders);
        setSelectedOrder(order);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add Note Workflow
  const handleAddNote = async (orderId: number) => {
    if (!newNoteText.trim()) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newNoteText })
      });
      if (res.ok) {
        const { note } = await res.json();
        if (selectedOrder && selectedOrder.id === orderId) {
          const updatedSelected = {
            ...selectedOrder,
            notes: [...selectedOrder.notes, note]
          };
          setSelectedOrder(updatedSelected);
          setOrders(orders.map(o => o.id === orderId ? updatedSelected : o));
        }
        setNewNoteText('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Upload Photo base64
  const handleUploadPhoto = async (orderId: number, base64: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: base64 })
      });
      if (res.ok) {
        if (selectedOrder && selectedOrder.id === orderId) {
          const updatedSelected = {
            ...selectedOrder,
            photos: [...selectedOrder.photos, base64]
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
      const res = await fetch(`/api/orders/${orderId}/materials`, {
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
    try {
      const res = await fetch(`/api/orders/${orderId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: tempSignature,
          notes: finalCloseNote
        })
      });
      if (res.ok) {
        const { order } = await res.json();
        const updatedOrders = orders.map(o => o.id === orderId ? order : o);
        setOrders(updatedOrders);
        calculateStats(updatedOrders);
        setSelectedOrder(order);
        setActiveTab('completed');
      }
    } catch (e) {
      console.error(e);
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
        // Clear old inputs
        setLoginEmail('');
        setLoginPassword('');
      } else {
        let errMsg = 'Authentication failed';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (jsonErr) {
          try {
            const text = await res.text();
            errMsg = text || errMsg;
          } catch (textErr) {
            errMsg = `Error ${res.status}: ${res.statusText}`;
          }
        }
        setLoginError(errMsg);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(`Could not contact authentication server: ${err.message || err}`);
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
            <h1 className="text-2xl font-black tracking-tight text-white">AC Technician Portal</h1>
            <p className="text-xs text-slate-400 mt-2">Sign in using your authorized technical user account</p>
          </div>

          {/* Login Card */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-start space-x-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{loginError}</span>
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

            <div className="border-t border-slate-800/80 pt-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3 text-center">Authorized Sandbox Users</span>
              <div className="space-y-2.5">
                {[
                  { email: 'ereshmb@gmail.com', pass: '10001', name: 'Eresh M B' },
                  { email: 'decentsachin.143@gmail.com', pass: '10002', name: 'Sachin' },
                  { email: 'nidhishri767@gmail.com', pass: '10003', name: 'Nidhishri' },
                  { email: 'fugensys@gmail.com', pass: '10004', name: 'Fugensys Admin' }
                ].map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => {
                      setLoginEmail(u.email);
                      setLoginPassword(u.pass);
                      setLoginError(null);
                    }}
                    className="w-full text-left bg-slate-900 hover:bg-slate-850 p-2.5 rounded-xl border border-slate-800/60 transition-all hover:border-slate-700 flex items-center justify-between text-xs group"
                  >
                    <div>
                      <p className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{u.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{u.email}</p>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                      Pass: {u.pass}
                    </span>
                  </button>
                ))}
              </div>
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
                <span>AC Technician Portal</span>
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
{`-- PostgreSQL Database Schema Design for AC Technician Service Portal

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
                                <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{o.customer_name}</span>
                                </div>
                                <div className="text-xs text-slate-400 flex items-start space-x-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-1">{o.customer_address}</span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center space-x-4">
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptOrder(o.id);
                                    }}
                                    className="flex-1 md:w-28 bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-95"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Accept</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRejectionModalId(o.id);
                                    }}
                                    className="flex-1 md:w-28 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 active:scale-95"
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
                      href={`https://wa.me/${selectedOrder.customer_phone.replace(/[^0-9]/g, '')}?text=Hello%20${selectedOrder.customer_name},%20this%20is%20AC%20Technician%20Rahul%20regarding%20your%20service%20order%20${selectedOrder.number}.`}
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
                              onClick={() => handleAcceptOrder(selectedOrder.id)}
                              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95"
                            >
                              <Check className="w-4 h-4" />
                              <span>Accept Job</span>
                            </button>
                            <button
                              onClick={() => setRejectionModalId(selectedOrder.id)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition-all active:scale-95"
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
                                { status: 'Closed', label: 'Closed' },
                              ].map((step) => {
                                const isActive = selectedOrder.technician_status === step.status;
                                return (
                                  <button
                                    key={step.status}
                                    onClick={() => handleUpdateStatus(selectedOrder.id, step.status as JobStatus)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                                      isActive
                                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                                    }`}
                                  >
                                    {step.label}
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

                  {/* CUSTOMER ADDRESS & MAP DISPATCH */}
                  <div className="space-y-3">
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

                  {/* NOTES PANEL (WOOCOMMERCE INTEGRATED) */}
                  <div className="space-y-3 border-t border-slate-800/80 pt-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">WooCommerce Order Notes</h3>
                    
                    {/* Notes List */}
                    {selectedOrder.notes.length > 0 ? (
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {selectedOrder.notes.map((n) => (
                          <div key={n.id} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                              <span className={n.author.includes('Self') ? 'text-indigo-400' : 'text-slate-300'}>{n.author}</span>
                              <span className="text-slate-500 font-mono">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="Type customer or service updates..."
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                        />
                        <button
                          onClick={() => handleAddNote(selectedOrder.id)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>

                  {/* FINAL SIGNATURE AND COMPLETION PANEL */}
                  {selectedOrder.technician_status === 'Completed' && (
                    <div className="space-y-4 border-t border-slate-800/80 pt-5 bg-indigo-950/10 p-4 rounded-2xl border border-indigo-500/20">
                      <div className="flex items-center space-x-2 text-indigo-400">
                        <PenTool className="w-5 h-5" />
                        <h3 className="text-sm font-bold">Final Job Clearance</h3>
                      </div>

                      {/* Signature pad */}
                      <SignaturePad
                        onSave={(base64) => setTempSignature(base64)}
                        onClear={() => setTempSignature(null)}
                      />

                      {/* Closing comments */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Closing Service Remarks</label>
                        <textarea
                          placeholder="Write final diagnostic outcome (e.g., vacuum pressure checked, ambient temperature registered, job done fully)..."
                          value={finalCloseNote}
                          onChange={(e) => setFinalCloseNote(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                        />
                      </div>

                      <button
                        onClick={() => handleCloseJob(selectedOrder.id)}
                        disabled={!tempSignature}
                        className={`w-full py-2.5 rounded-xl font-extrabold text-xs text-center flex items-center justify-center space-x-1.5 shadow-md transition-all ${
                          tempSignature
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirm Clearance & Close WooCommerce Ticket</span>
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
                onClick={() => handleRejectOrder(rejectionModalId, rejectionReason)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl py-2 text-xs font-bold transition-all active:scale-95 shadow-md shadow-rose-950/20"
              >
                Confirm Reject
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
          <span>© 2026 AC Field Service Technician. Powered by Google AI Studio.</span>
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
