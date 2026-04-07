import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const API = 'http://localhost:5001/api';
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function ItDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const [adminStats, setAdminStats] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [assets, setAssets] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [announcements, setAnnouncements] = useState([]);

    // Ticket update form
    const [editingTicket, setEditingTicket] = useState(null);
    const [ticketUpdate, setTicketUpdate] = useState({ status: '', adminNote: '' });

    // Asset form
    const [showAssetForm, setShowAssetForm] = useState(false);
    const [assetForm, setAssetForm] = useState({
        assetName: '', assetType: 'Laptop', serialNumber: '', assignedTo: '', status: 'Available', purchaseDate: '', notes: ''
    });
    const [editingAssetId, setEditingAssetId] = useState(null);

    // Employee directory
    const [searchTerm, setSearchTerm] = useState('');

    // Announcement form
    const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });

    // Ticket filter
    const [ticketFilter, setTicketFilter] = useState('');

    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        if (!user || user.role !== 'Admin') {
            navigate('/login');
        } else {
            fetchAll();
        }
    }, [navigate]);

    const fetchAll = () => {
        fetchAdminStats();
        fetchTickets();
        fetchAssets();
        fetchEmployees();
        fetchAnnouncements();
    };

    const fetchAdminStats = async () => {
        try {
            const res = await axios.get(`${API}/dashboard/admin`);
            setAdminStats(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchTickets = async () => {
        try {
            const res = await axios.get(`${API}/tickets`);
            setTickets(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchAssets = async () => {
        try {
            const res = await axios.get(`${API}/assets`);
            setAssets(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchEmployees = async () => {
        const res = await axios.get(`${API}/employees`);
        setEmployees(res.data);
    };

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get(`${API}/announcements`);
            setAnnouncements(res.data);
        } catch (err) { console.error(err); }
    };

    // ─── TICKET ACTIONS ─────────────────────────
    const updateTicket = async (id) => {
        try {
            await axios.put(`${API}/tickets/${id}`, ticketUpdate);
            setEditingTicket(null);
            setTicketUpdate({ status: '', adminNote: '' });
            fetchTickets();
            fetchAdminStats();
        } catch (err) {
            alert("Error updating ticket");
        }
    };

    const deleteTicket = async (id) => {
        if (window.confirm("Delete this ticket?")) {
            await axios.delete(`${API}/tickets/${id}`);
            fetchTickets();
            fetchAdminStats();
        }
    };

    // ─── ASSET ACTIONS ──────────────────────────
    const saveAsset = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...assetForm, assignedTo: assetForm.assignedTo || null };
            if (editingAssetId) {
                await axios.put(`${API}/assets/${editingAssetId}`, payload);
            } else {
                await axios.post(`${API}/assets`, payload);
            }
            setAssetForm({ assetName: '', assetType: 'Laptop', serialNumber: '', assignedTo: '', status: 'Available', purchaseDate: '', notes: '' });
            setShowAssetForm(false);
            setEditingAssetId(null);
            fetchAssets();
            fetchAdminStats();
        } catch (err) {
            alert("Error saving asset");
        }
    };

    const editAsset = (asset) => {
        setAssetForm({
            assetName: asset.assetName,
            assetType: asset.assetType,
            serialNumber: asset.serialNumber || '',
            assignedTo: asset.assignedTo || '',
            status: asset.status,
            purchaseDate: asset.purchaseDate || '',
            notes: asset.notes || ''
        });
        setEditingAssetId(asset.id);
        setShowAssetForm(true);
    };

    const deleteAsset = async (id) => {
        if (window.confirm("Delete this asset?")) {
            await axios.delete(`${API}/assets/${id}`);
            fetchAssets();
            fetchAdminStats();
        }
    };

    // ─── EMPLOYEE DIRECTORY (read-only) ──────────
    const getAssetsForEmployee = (empId) => assets.filter(a => a.assignedTo === empId);

    // ─── ANNOUNCEMENT ACTIONS ───────────────────
    const postAnnouncement = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/announcements`, { ...announcementForm, postedBy: user.id });
            setAnnouncementForm({ title: '', message: '' });
            fetchAnnouncements();
        } catch (err) { alert("Error posting announcement"); }
    };

    const deleteAnnouncement = async (id) => {
        if (window.confirm("Delete this announcement?")) {
            await axios.delete(`${API}/announcements/${id}`);
            fetchAnnouncements();
        }
    };

    // ─── DERIVED DATA ───────────────────────────
    const filteredTickets = ticketFilter ? tickets.filter(t => t.status === ticketFilter) : tickets;
    const openTickets = tickets.filter(t => t.status === 'Open');
    const filteredUsers = employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.designation || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const ticketCategoryData = adminStats?.ticketsByCategory?.map(r => ({ name: r.category, value: parseInt(r.count) })) || [];
    const assetTypeData = assets.reduce((acc, a) => {
        const existing = acc.find(x => x.name === a.assetType);
        if (existing) existing.value++;
        else acc.push({ name: a.assetType, value: 1 });
        return acc;
    }, []);

    const priorityColorMap = { High: 'var(--danger)', Medium: 'var(--warning)', Low: 'var(--success)' };
    const statusColorMap = { Open: '#ef4444', 'In Progress': '#f59e0b', Resolved: '#10b981', Closed: '#6b7280' };

    const logout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    const isActive = (path) => {
        if (path === '/it' && location.pathname === '/it') return true;
        if (path !== '/it' && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="dashboard-layout">
            <div className="sidebar" style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #4338ca 100%)' }}>
                <h2>🛡️ IT Admin</h2>
                <ul>
                    <li><Link className={isActive('/it') && !isActive('/it/') ? 'active' : ''} to="/it">
                        <span className="nav-icon">📊</span> Dashboard
                    </Link></li>
                    <li><Link className={isActive('/it/tickets') ? 'active' : ''} to="/it/tickets">
                        <span className="nav-icon">🎫</span> Support Tickets
                        {openTickets.length > 0 && <span className="badge">{openTickets.length}</span>}
                    </Link></li>
                    <li><Link className={isActive('/it/assets') ? 'active' : ''} to="/it/assets">
                        <span className="nav-icon">💻</span> IT Assets
                    </Link></li>
                    <li><Link className={isActive('/it/directory') ? 'active' : ''} to="/it/directory">
                        <span className="nav-icon">👥</span> Employee Directory
                    </Link></li>
                    <li><Link className={isActive('/it/announcements') ? 'active' : ''} to="/it/announcements">
                        <span className="nav-icon">📢</span> Announcements
                    </Link></li>
                    <li><Link className={isActive('/it/settings') ? 'active' : ''} to="/it/settings">
                        <span className="nav-icon">⚙️</span> System Config
                    </Link></li>
                </ul>
                <button onClick={logout}>🚪 Logout</button>
            </div>

            <div className="main-content">
                <h1 className="page-title">IT Admin Panel 🛡️</h1>

                <Routes>
                    {/* ─── DASHBOARD ─── */}
                    <Route path="/" element={
                        <div>
                            <div className="stats-grid">
                                <div className="stat-card red">
                                    <div className="stat-icon">🎫</div>
                                    <div className="stat-value">{adminStats?.openTickets || 0}</div>
                                    <div className="stat-label">Open Tickets</div>
                                </div>
                                <div className="stat-card orange">
                                    <div className="stat-icon">🔧</div>
                                    <div className="stat-value">{adminStats?.inProgressTickets || 0}</div>
                                    <div className="stat-label">In Progress</div>
                                </div>
                                <div className="stat-card green">
                                    <div className="stat-icon">✅</div>
                                    <div className="stat-value">{adminStats?.resolvedTickets || 0}</div>
                                    <div className="stat-label">Resolved</div>
                                </div>
                                <div className="stat-card blue">
                                    <div className="stat-icon">💻</div>
                                    <div className="stat-value">{adminStats?.totalAssets || 0}</div>
                                    <div className="stat-label">Total IT Assets</div>
                                </div>
                                <div className="stat-card purple">
                                    <div className="stat-icon">👥</div>
                                    <div className="stat-value">{adminStats?.totalUsers || 0}</div>
                                    <div className="stat-label">System Users</div>
                                </div>
                            </div>

                            {/* Charts Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div className="card" style={{ maxWidth: 'none' }}>
                                    <h4 style={{ marginBottom: '0.75rem' }}>🎫 Tickets by Category</h4>
                                    {ticketCategoryData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={220}>
                                            <PieChart>
                                                <Pie data={ticketCategoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                                    {ticketCategoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : <p className="text-muted" style={{ textAlign: 'center', padding: '3rem' }}>No ticket data yet</p>}
                                </div>
                                <div className="card" style={{ maxWidth: 'none' }}>
                                    <h4 style={{ marginBottom: '0.75rem' }}>💻 Assets by Type</h4>
                                    {assetTypeData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={220}>
                                            <PieChart>
                                                <Pie data={assetTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                                    {assetTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : <p className="text-muted" style={{ textAlign: 'center', padding: '3rem' }}>No asset data yet</p>}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>⚡ Quick Actions</h4>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <Link to="/it/tickets" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 1.25rem', textDecoration: 'none', display: 'inline-block', background: '#ef4444' }}>
                                        🎫 View Open Tickets ({openTickets.length})
                                    </Link>
                                    <Link to="/it/assets" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 1.25rem', textDecoration: 'none', display: 'inline-block', background: '#3b82f6' }}>
                                        💻 Manage Assets
                                    </Link>
                                    <Link to="/it/directory" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 1.25rem', textDecoration: 'none', display: 'inline-block', background: '#8b5cf6' }}>
                                        👥 Employee Directory
                                    </Link>
                                    <Link to="/it/announcements" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 1.25rem', textDecoration: 'none', display: 'inline-block', background: '#10b981' }}>
                                        📢 Post Notice
                                    </Link>
                                </div>
                            </div>

                            {/* Recent Open Tickets */}
                            {adminStats?.recentTickets?.length > 0 && (
                                <div>
                                    <h4 style={{ marginBottom: '0.5rem' }}>🎫 Recent Tickets</h4>
                                    <table>
                                        <thead>
                                            <tr><th>#</th><th>From</th><th>Category</th><th>Subject</th><th>Priority</th><th>Status</th></tr>
                                        </thead>
                                        <tbody>
                                            {adminStats.recentTickets.map(t => (
                                                <tr key={t.id}>
                                                    <td>#{t.id}</td>
                                                    <td><strong>{t.employeeName}</strong></td>
                                                    <td>{t.category}</td>
                                                    <td>{t.subject}</td>
                                                    <td><span style={{ color: priorityColorMap[t.priority], fontWeight: 600, fontSize: '0.8rem' }}>{t.priority}</span></td>
                                                    <td><span style={{ background: statusColorMap[t.status] + '20', color: statusColorMap[t.status], padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>{t.status}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── SUPPORT TICKETS ─── */}
                    <Route path="tickets" element={
                        <div>
                            <div className="section-header">
                                <h3>🎫 IT Support Tickets</h3>
                                <div className="flex-gap">
                                    {['', 'Open', 'In Progress', 'Resolved', 'Closed'].map(s => (
                                        <button key={s} onClick={() => setTicketFilter(s)}
                                            className={ticketFilter === s ? 'btn-primary' : 'btn-outline'}
                                            style={{ width: 'auto', padding: '0.4rem 0.75rem' }}>
                                            {s || 'All'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
                                <div className="stat-card red">
                                    <div className="stat-value">{tickets.filter(t => t.status === 'Open').length}</div>
                                    <div className="stat-label">Open</div>
                                </div>
                                <div className="stat-card orange">
                                    <div className="stat-value">{tickets.filter(t => t.status === 'In Progress').length}</div>
                                    <div className="stat-label">In Progress</div>
                                </div>
                                <div className="stat-card green">
                                    <div className="stat-value">{tickets.filter(t => t.status === 'Resolved').length}</div>
                                    <div className="stat-label">Resolved</div>
                                </div>
                                <div className="stat-card blue">
                                    <div className="stat-value">{tickets.length}</div>
                                    <div className="stat-label">Total</div>
                                </div>
                            </div>

                            {filteredTickets.length > 0 ? filteredTickets.map(t => (
                                <div key={t.id} className="card" style={{ maxWidth: 'none', marginBottom: '0.75rem', borderLeft: `4px solid ${statusColorMap[t.status] || '#6b7280'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                <strong style={{ fontSize: '1rem' }}>#{t.id} — {t.subject}</strong>
                                                <span style={{ background: statusColorMap[t.status] + '20', color: statusColorMap[t.status], padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>{t.status}</span>
                                                <span style={{ color: priorityColorMap[t.priority], fontSize: '0.7rem', fontWeight: 600 }}>● {t.priority}</span>
                                            </div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                {t.category} • Raised by <strong>{t.employeeName}</strong> ({t.department || 'N/A'}) • {new Date(t.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex-gap">
                                            <button onClick={() => { setEditingTicket(t.id); setTicketUpdate({ status: t.status, adminNote: t.adminNote || '' }); }} className="btn-outline" style={{ padding: '0.3rem 0.6rem' }}>✏️ Update</button>
                                            <button onClick={() => deleteTicket(t.id)} className="btn-danger" style={{ padding: '0.3rem 0.6rem' }}>🗑️</button>
                                        </div>
                                    </div>
                                    {t.description && <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>{t.description}</p>}
                                    {t.adminNote && (
                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                            <strong>Admin Note:</strong> {t.adminNote}
                                        </div>
                                    )}

                                    {editingTicket === t.id && (
                                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                            <div className="grid-2" style={{ gap: '0.75rem' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label>Status</label>
                                                    <select value={ticketUpdate.status} onChange={e => setTicketUpdate({ ...ticketUpdate, status: e.target.value })}>
                                                        <option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option>
                                                    </select>
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label>Admin Note</label>
                                                    <input value={ticketUpdate.adminNote} onChange={e => setTicketUpdate({ ...ticketUpdate, adminNote: e.target.value })}
                                                        placeholder="e.g. Replaced RAM module, issue fixed" />
                                                </div>
                                            </div>
                                            <div className="flex-gap" style={{ marginTop: '0.75rem' }}>
                                                <button onClick={() => updateTicket(t.id)} className="btn-success">💾 Save</button>
                                                <button onClick={() => setEditingTicket(null)} className="btn-outline">Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div className="empty-state"><div className="empty-icon">🎫</div><p>No tickets {ticketFilter ? `with status "${ticketFilter}"` : 'found'}</p></div>
                            )}
                        </div>
                    } />

                    {/* ─── IT ASSETS ─── */}
                    <Route path="assets" element={
                        <div>
                            <div className="section-header">
                                <h3>💻 IT Asset Inventory</h3>
                                <button className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => {
                                    setShowAssetForm(!showAssetForm);
                                    setEditingAssetId(null);
                                    setAssetForm({ assetName: '', assetType: 'Laptop', serialNumber: '', assignedTo: '', status: 'Available', purchaseDate: '', notes: '' });
                                }}>
                                    {showAssetForm ? '✕ Cancel' : '+ Add Asset'}
                                </button>
                            </div>

                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
                                <div className="stat-card blue">
                                    <div className="stat-value">{assets.length}</div>
                                    <div className="stat-label">Total Assets</div>
                                </div>
                                <div className="stat-card green">
                                    <div className="stat-value">{assets.filter(a => a.assignedTo).length}</div>
                                    <div className="stat-label">Assigned</div>
                                </div>
                                <div className="stat-card orange">
                                    <div className="stat-value">{assets.filter(a => !a.assignedTo).length}</div>
                                    <div className="stat-label">Available</div>
                                </div>
                            </div>

                            {showAssetForm && (
                                <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '1rem' }}>{editingAssetId ? '✏️ Edit Asset' : '➕ Add New Asset'}</h4>
                                    <form onSubmit={saveAsset} className="grid-2">
                                        <div className="form-group"><label>Asset Name</label><input required value={assetForm.assetName} onChange={e => setAssetForm({ ...assetForm, assetName: e.target.value })} placeholder="e.g. Dell Latitude 5520" /></div>
                                        <div className="form-group"><label>Type</label>
                                            <select value={assetForm.assetType} onChange={e => setAssetForm({ ...assetForm, assetType: e.target.value })}>
                                                <option>Laptop</option><option>Desktop</option><option>Monitor</option><option>Keyboard</option><option>Mouse</option><option>Headset</option><option>Printer</option><option>Phone</option><option>Other</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>Serial Number</label><input value={assetForm.serialNumber} onChange={e => setAssetForm({ ...assetForm, serialNumber: e.target.value })} /></div>
                                        <div className="form-group"><label>Assign To</label>
                                            <select value={assetForm.assignedTo} onChange={e => setAssetForm({ ...assetForm, assignedTo: e.target.value, status: e.target.value ? 'Assigned' : 'Available' })}>
                                                <option value="">— Unassigned —</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department || e.role})</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group"><label>Status</label>
                                            <select value={assetForm.status} onChange={e => setAssetForm({ ...assetForm, status: e.target.value })}>
                                                <option>Available</option><option>Assigned</option><option>Under Repair</option><option>Retired</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>Purchase Date</label><input type="date" value={assetForm.purchaseDate} onChange={e => setAssetForm({ ...assetForm, purchaseDate: e.target.value })} /></div>
                                        <div className="form-group span-2"><label>Notes</label><input value={assetForm.notes} onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })} placeholder="Specs, condition, etc." /></div>
                                        <div className="span-2">
                                            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem' }}>
                                                {editingAssetId ? '✅ Update' : '➕ Save'} Asset
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <table>
                                <thead>
                                    <tr><th>ID</th><th>Asset</th><th>Type</th><th>Serial #</th><th>Assigned To</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {assets.map(a => (
                                        <tr key={a.id}>
                                            <td>#{a.id}</td>
                                            <td><strong>{a.assetName}</strong>{a.notes && <br />}{a.notes && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.notes}</span>}</td>
                                            <td>{a.assetType}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.serialNumber || '—'}</td>
                                            <td>{a.assignedToName || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                                            <td>
                                                <span className={`status-badge ${a.status === 'Available' ? 'approved' : a.status === 'Assigned' ? 'paid' : a.status === 'Under Repair' ? 'pending' : 'rejected'}`}>
                                                    {a.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex-gap">
                                                    <button onClick={() => editAsset(a)} className="btn-outline">✏️</button>
                                                    <button onClick={() => deleteAsset(a.id)} className="btn-danger">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {assets.length === 0 && (
                                <div className="empty-state"><div className="empty-icon">💻</div><p>No IT assets registered</p></div>
                            )}
                        </div>
                    } />

                    {/* ─── EMPLOYEE DIRECTORY ─── */}
                    <Route path="directory" element={
                        <div>
                            <h3 style={{ marginBottom: '1rem' }}>👥 Employee Directory</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>View employee info and their assigned IT assets. To assign assets, go to <Link to="/it/assets" style={{ color: 'var(--primary)' }}>IT Assets</Link>.</p>

                            <div className="search-bar">
                                <input placeholder="🔍 Search by name, department, or designation..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>

                            {filteredUsers.map(emp => {
                                const empAssets = getAssetsForEmployee(emp.id);
                                return (
                                    <div key={emp.id} className="card" style={{ maxWidth: 'none', marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <strong style={{ fontSize: '1rem' }}>{emp.name}</strong>
                                                <span className={`status-badge ${emp.role === 'Admin' ? 'pending' : emp.role === 'HR' ? 'approved' : 'paid'}`} style={{ marginLeft: '0.5rem' }}>{emp.role}</span>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                                    {emp.designation || 'No designation'} • {emp.department || 'No department'} • {emp.email}
                                                </p>
                                            </div>
                                        </div>
                                        {empAssets.length > 0 ? (
                                            <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>ASSIGNED ASSETS ({empAssets.length})</p>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    {empAssets.map(a => (
                                                        <span key={a.id} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#1d4ed8' }}>
                                                            💻 {a.assetName} <span style={{ color: '#93c5fd', margin: '0 0.25rem' }}>•</span> {a.assetType} <span style={{ color: '#93c5fd', margin: '0 0.25rem' }}>•</span> <span style={{ fontFamily: 'monospace' }}>{a.serialNumber || 'N/A'}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>No assets assigned</p>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <div className="empty-state"><div className="empty-icon">👥</div><p>No employees match your search</p></div>
                            )}
                        </div>
                    } />

                    {/* ─── ANNOUNCEMENTS ─── */}
                    <Route path="announcements" element={
                        <div>
                            <h3 style={{ marginBottom: '1rem' }}>📢 System Announcements</h3>
                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>Post System Notice</h4>
                                <form onSubmit={postAnnouncement}>
                                    <div className="form-group">
                                        <label>Title</label>
                                        <input required value={announcementForm.title} onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })} placeholder="e.g. Scheduled Maintenance, Network Update..." />
                                    </div>
                                    <div className="form-group">
                                        <label>Message</label>
                                        <textarea required value={announcementForm.message} onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })} placeholder="Details about the system notice..." rows={3} />
                                    </div>
                                    <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem' }}>📤 Post Notice</button>
                                </form>
                            </div>

                            {announcements.length > 0 ? announcements.map(a => (
                                <div className="announcement-card" key={a.id}>
                                    <h4>{a.title}</h4>
                                    <p>{a.message}</p>
                                    <div className="meta">
                                        <span>Posted by {a.postedByName || 'IT Admin'} • {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        <button onClick={() => deleteAnnouncement(a.id)} className="btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>🗑️ Delete</button>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state"><div className="empty-icon">📢</div><p>No announcements yet</p></div>
                            )}
                        </div>
                    } />

                    {/* ─── SYSTEM CONFIG ─── */}
                    <Route path="settings" element={
                        <div>
                            <h3 style={{ marginBottom: '1.5rem' }}>⚙️ System Configuration</h3>

                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>🖥️ System Information</h4>
                                <div className="profile-grid">
                                    <div className="profile-item"><label>Application</label><span>Smart Salary System</span></div>
                                    <div className="profile-item"><label>Version</label><span>2.0.0</span></div>
                                    <div className="profile-item"><label>Backend</label><span>Node.js + Express + PostgreSQL</span></div>
                                    <div className="profile-item"><label>Frontend</label><span>React 19 + Vite 7</span></div>
                                    <div className="profile-item"><label>API Server</label><span>http://localhost:5001</span></div>
                                    <div className="profile-item"><label>Database</label><span>collageproject (PostgreSQL)</span></div>
                                </div>
                            </div>

                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>📊 System Statistics</h4>
                                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                    <div className="stat-card blue">
                                        <div className="stat-value">{employees.length}</div>
                                        <div className="stat-label">User Accounts</div>
                                    </div>
                                    <div className="stat-card green">
                                        <div className="stat-value">{assets.length}</div>
                                        <div className="stat-label">IT Assets</div>
                                    </div>
                                    <div className="stat-card orange">
                                        <div className="stat-value">{tickets.length}</div>
                                        <div className="stat-label">Total Tickets</div>
                                    </div>
                                    <div className="stat-card purple">
                                        <div className="stat-value">{announcements.length}</div>
                                        <div className="stat-label">Announcements</div>
                                    </div>
                                </div>
                            </div>

                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>🔐 Security Settings</h4>
                                <table>
                                    <thead><tr><th>Setting</th><th>Value</th><th>Notes</th></tr></thead>
                                    <tbody>
                                        <tr><td>Default Password</td><td><code>password123</code></td><td>Applied to new accounts & resets</td></tr>
                                        <tr><td>Session Storage</td><td>localStorage</td><td>Persists across tabs</td></tr>
                                        <tr><td>Authentication</td><td>Email + Password</td><td>Plain text (demo mode)</td></tr>
                                        <tr><td>CORS</td><td>Enabled (all origins)</td><td>Development configuration</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="card" style={{ maxWidth: '500px' }}>
                                <h4 style={{ marginBottom: '1rem' }}>👤 Admin Profile</h4>
                                <div className="profile-grid">
                                    <div className="profile-item"><label>Name</label><span>{user?.name}</span></div>
                                    <div className="profile-item"><label>Email</label><span>{user?.email}</span></div>
                                    <div className="profile-item"><label>Role</label><span>{user?.role}</span></div>
                                    <div className="profile-item"><label>Department</label><span>{user?.department || 'IT'}</span></div>
                                </div>
                            </div>
                        </div>
                    } />
                </Routes>
            </div>
        </div>
    );
}
