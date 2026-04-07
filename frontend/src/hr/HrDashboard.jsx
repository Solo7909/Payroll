import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';

const API = 'http://localhost:5001/api';

export default function HrDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const [employees, setEmployees] = useState([]);
    const [payrolls, setPayrolls] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [hrStats, setHrStats] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [todayAttendance, setTodayAttendance] = useState([]);

    // Form states
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '', email: '', role: 'User', phone: '', department: '', designation: '', joinDate: '', basicPay: 0, allowances: 0
    });
    const [editingId, setEditingId] = useState(null);

    // Search/filter
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterRole, setFilterRole] = useState('');

    // Announcement form
    const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });

    // Payroll bulk
    const [bulkMonth, setBulkMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
    const [bulkYear, setBulkYear] = useState(new Date().getFullYear());

    // Attendance date selector
    const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        if (!user || user.role !== 'HR') {
            navigate('/login');
        } else {
            fetchAll();
        }
    }, [navigate]);

    const fetchAll = () => {
        fetchEmployees();
        fetchPayrolls();
        fetchLeaves();
        fetchHrStats();
        fetchAnnouncements();
        fetchTodayAttendance();
    };

    const fetchEmployees = async () => {
        const res = await axios.get(`${API}/employees`);
        setEmployees(res.data);
    };

    const fetchPayrolls = async () => {
        const res = await axios.get(`${API}/payrolls`);
        setPayrolls(res.data);
    };

    const fetchLeaves = async () => {
        const res = await axios.get(`${API}/leaves`);
        setLeaves(res.data);
    };

    const fetchHrStats = async () => {
        try {
            const res = await axios.get(`${API}/dashboard/hr`);
            setHrStats(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get(`${API}/announcements`);
            setAnnouncements(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchTodayAttendance = async (date) => {
        try {
            const dateParam = date || format(new Date(), 'yyyy-MM-dd');
            const res = await axios.get(`${API}/attendance?date=${dateParam}`);
            setTodayAttendance(res.data);
        } catch (err) { console.error(err); }
    };

    // Employee CRUD
    const handleSaveEmployee = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await axios.put(`${API}/employees/${editingId}`, formData);
            } else {
                await axios.post(`${API}/employees`, formData);
            }
            setFormData({ name: '', email: '', role: 'User', phone: '', department: '', designation: '', joinDate: '', basicPay: 0, allowances: 0 });
            setShowAddForm(false);
            setEditingId(null);
            fetchEmployees();
            fetchHrStats();
        } catch (err) {
            alert("Error saving employee");
        }
    };

    const handleEdit = (emp) => {
        setFormData({
            ...emp,
            phone: emp.phone || '',
            department: emp.department || '',
            designation: emp.designation || '',
            joinDate: emp.joinDate || ''
        });
        setEditingId(emp.id);
        setShowAddForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this employee? This action cannot be undone.")) {
            await axios.delete(`${API}/employees/${id}`);
            fetchEmployees();
            fetchHrStats();
        }
    };

    // Leave management
    const handleLeaveStatus = async (id, status) => {
        await axios.put(`${API}/leaves/${id}/status`, { status });
        fetchLeaves();
        fetchHrStats();
    };

    // Payroll
    const generatePayroll = async (employeeId) => {
        try {
            await axios.post(`${API}/payroll/calculate`, {
                employeeId,
                month: new Date().toLocaleString('default', { month: 'long' }),
                year: new Date().getFullYear()
            });
            alert('Payroll generated successfully!');
            fetchPayrolls();
            fetchHrStats();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to generate payroll');
        }
    };

    const bulkGeneratePayroll = async () => {
        try {
            const res = await axios.post(`${API}/payroll/bulk-generate`, {
                month: bulkMonth,
                year: bulkYear
            });
            alert(res.data.message);
            fetchPayrolls();
            fetchHrStats();
        } catch (err) {
            alert('Failed to generate bulk payroll');
        }
    };

    // Attendance management
    const markAttendanceForEmployee = async (employeeId, status) => {
        try {
            await axios.post(`${API}/attendance/mark`, {
                employeeId,
                date: attendanceDate,
                status
            });
            fetchTodayAttendance(attendanceDate);
            fetchHrStats();
        } catch (err) {
            alert("Error marking attendance");
        }
    };

    // Announcements
    const postAnnouncement = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/announcements`, {
                ...announcementForm,
                postedBy: user.id
            });
            setAnnouncementForm({ title: '', message: '' });
            fetchAnnouncements();
        } catch (err) {
            alert("Error posting announcement");
        }
    };

    const deleteAnnouncement = async (id) => {
        if (window.confirm("Delete this announcement?")) {
            await axios.delete(`${API}/announcements/${id}`);
            fetchAnnouncements();
        }
    };

    // Filtered employees
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = !filterDept || emp.department === filterDept;
        const matchesRole = !filterRole || emp.role === filterRole;
        return matchesSearch && matchesDept && matchesRole;
    });

    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
    const pendingLeaves = leaves.filter(l => l.status === 'Pending');

    const logout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    const isActive = (path) => {
        if (path === '/hr' && location.pathname === '/hr') return true;
        if (path !== '/hr' && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="dashboard-layout">
            <div className="sidebar" style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #2563eb 100%)' }}>
                <h2>🏢 HR Portal</h2>
                <ul>
                    <li><Link className={isActive('/hr') && !isActive('/hr/') ? 'active' : ''} to="/hr">
                        <span className="nav-icon">📊</span> Dashboard
                    </Link></li>
                    <li><Link className={isActive('/hr/employees') ? 'active' : ''} to="/hr/employees">
                        <span className="nav-icon">👥</span> Employees
                    </Link></li>
                    <li><Link className={isActive('/hr/attendance') ? 'active' : ''} to="/hr/attendance">
                        <span className="nav-icon">✅</span> Attendance
                    </Link></li>
                    <li><Link className={isActive('/hr/leaves') ? 'active' : ''} to="/hr/leaves">
                        <span className="nav-icon">📋</span> Leave Requests
                        {pendingLeaves.length > 0 && <span className="badge">{pendingLeaves.length}</span>}
                    </Link></li>
                    <li><Link className={isActive('/hr/payrolls') ? 'active' : ''} to="/hr/payrolls">
                        <span className="nav-icon">💰</span> Payroll
                    </Link></li>
                    <li><Link className={isActive('/hr/announcements') ? 'active' : ''} to="/hr/announcements">
                        <span className="nav-icon">📢</span> Announcements
                    </Link></li>
                </ul>
                <button onClick={logout}>🚪 Logout</button>
            </div>

            <div className="main-content">
                <h1 className="page-title">Welcome, {user?.name} 👋</h1>

                <Routes>
                    {/* ─── HR DASHBOARD HOME ─── */}
                    <Route path="/" element={
                        <div>
                            <div className="stats-grid">
                                <div className="stat-card blue">
                                    <div className="stat-icon">👥</div>
                                    <div className="stat-value">{hrStats?.totalEmployees || 0}</div>
                                    <div className="stat-label">Total Employees</div>
                                </div>
                                <div className="stat-card green">
                                    <div className="stat-icon">✅</div>
                                    <div className="stat-value">{hrStats?.presentToday || 0}</div>
                                    <div className="stat-label">Present Today</div>
                                </div>
                                <div className="stat-card orange">
                                    <div className="stat-icon">⏳</div>
                                    <div className="stat-value">{hrStats?.pendingLeaves || 0}</div>
                                    <div className="stat-label">Pending Leaves</div>
                                </div>
                                <div className="stat-card purple">
                                    <div className="stat-icon">💰</div>
                                    <div className="stat-value">₹{Number(hrStats?.totalPayroll || 0).toLocaleString()}</div>
                                    <div className="stat-label">Payroll This Month</div>
                                </div>
                            </div>

                            {/* Department Breakdown */}
                            {hrStats?.departments && hrStats.departments.length > 0 && (
                                <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                    <h3 style={{ marginBottom: '1rem' }}>🏢 Department Breakdown</h3>
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        {hrStats.departments.map((d, i) => (
                                            <div key={i} style={{
                                                background: '#f8fafc', padding: '0.75rem 1.25rem',
                                                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                                            }}>
                                                <strong>{d.department || 'Unassigned'}</strong>
                                                <span className="status-badge paid">{d.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h3 style={{ marginBottom: '1rem' }}>⚡ Quick Actions</h3>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <Link to="/hr/employees" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 1.25rem', textDecoration: 'none', display: 'inline-block' }}>
                                        👥 Manage Employees
                                    </Link>
                                    <Link to="/hr/attendance" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 1.25rem', textDecoration: 'none', display: 'inline-block', background: 'var(--success)' }}>
                                        ✅ Mark Attendance
                                    </Link>
                                    <Link to="/hr/leaves" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 1.25rem', textDecoration: 'none', display: 'inline-block', background: 'var(--warning)' }}>
                                        📋 Review Leaves ({pendingLeaves.length})
                                    </Link>
                                </div>
                            </div>

                            {/* Recent Leave Requests */}
                            {hrStats?.recentLeaves && hrStats.recentLeaves.length > 0 && (
                                <div>
                                    <h3 style={{ marginBottom: '0.5rem' }}>📋 Recent Leave Requests</h3>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Type</th>
                                                <th>Dates</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hrStats.recentLeaves.map(l => (
                                                <tr key={l.id}>
                                                    <td>{l.employeeName}</td>
                                                    <td>{l.type}</td>
                                                    <td>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()}</td>
                                                    <td>
                                                        <span className={`status-badge ${l.status === 'Approved' ? 'approved' : l.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                                                            {l.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {l.status === 'Pending' && (
                                                            <div className="flex-gap">
                                                                <button onClick={() => handleLeaveStatus(l.id, 'Approved')} className="btn-success">Approve</button>
                                                                <button onClick={() => handleLeaveStatus(l.id, 'Rejected')} className="btn-danger">Reject</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── EMPLOYEE DIRECTORY ─── */}
                    <Route path="employees" element={
                        <div>
                            <div className="section-header">
                                <h3>👥 Employee Directory</h3>
                                <button className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => {
                                    setShowAddForm(!showAddForm);
                                    setEditingId(null);
                                    setFormData({ name: '', email: '', role: 'User', phone: '', department: '', designation: '', joinDate: '', basicPay: 0, allowances: 0 });
                                }}>
                                    {showAddForm ? '✕ Cancel' : '+ Add Employee'}
                                </button>
                            </div>

                            {showAddForm && (
                                <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 'none' }}>
                                    <h4 style={{ marginBottom: '1rem' }}>{editingId ? '✏️ Edit Employee' : '➕ Add New Employee'}</h4>
                                    <form onSubmit={handleSaveEmployee} className="grid-2">
                                        <div className="form-group"><label>Name</label><input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                        <div className="form-group"><label>Email</label><input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                                        <div className="form-group"><label>Role</label>
                                            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                                <option>User</option><option>HR</option><option>Admin</option>
                                            </select>
                                        </div>
                                        <div className="form-group"><label>Phone</label><input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                                        <div className="form-group"><label>Department</label><input type="text" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} /></div>
                                        <div className="form-group"><label>Designation</label><input type="text" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} /></div>
                                        <div className="form-group"><label>Join Date</label><input type="date" value={formData.joinDate} onChange={e => setFormData({ ...formData, joinDate: e.target.value })} /></div>
                                        <div className="form-group"><label>Basic Pay (₹)</label><input type="number" required value={formData.basicPay} onChange={e => setFormData({ ...formData, basicPay: Number(e.target.value) })} /></div>
                                        <div className="form-group"><label>Allowances (₹)</label><input type="number" required value={formData.allowances} onChange={e => setFormData({ ...formData, allowances: Number(e.target.value) })} /></div>
                                        <div className="span-2">
                                            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem' }}>
                                                {editingId ? '✅ Update' : '➕ Save'} Employee
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Search & Filter Bar */}
                            <div className="search-bar">
                                <input
                                    placeholder="🔍 Search by name or email..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                                    <option value="">All Departments</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                                    <option value="">All Roles</option>
                                    <option>User</option><option>HR</option><option>Admin</option>
                                </select>
                            </div>

                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Department</th>
                                        <th>Role</th>
                                        <th>Base Salary</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.map(emp => (
                                        <tr key={emp.id}>
                                            <td><strong>{emp.name}</strong></td>
                                            <td>{emp.email}</td>
                                            <td>{emp.department || '—'}</td>
                                            <td><span className={`status-badge ${emp.role === 'Admin' ? 'pending' : emp.role === 'HR' ? 'approved' : 'paid'}`}>{emp.role}</span></td>
                                            <td>₹{Number(emp.basicPay).toLocaleString()}</td>
                                            <td>
                                                <div className="flex-gap">
                                                    <button onClick={() => handleEdit(emp)} className="btn-outline">✏️ Edit</button>
                                                    <button onClick={() => handleDelete(emp.id)} className="btn-danger">🗑️</button>
                                                    <button onClick={() => generatePayroll(emp.id)} className="btn-success">💰 Pay</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredEmployees.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">👥</div>
                                    <p>No employees match your filters</p>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── ATTENDANCE MANAGEMENT ─── */}
                    <Route path="attendance" element={
                        <div>
                            <div className="section-header">
                                <h3>✅ Attendance Management</h3>
                                <div className="flex-gap" style={{ alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date:</label>
                                    <input type="date" value={attendanceDate}
                                        onChange={e => { setAttendanceDate(e.target.value); fetchTodayAttendance(e.target.value); }}
                                        style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                                    />
                                </div>
                            </div>

                            {/* Today's Summary */}
                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
                                <div className="stat-card green">
                                    <div className="stat-value">{todayAttendance.filter(a => a.status === 'Present').length}</div>
                                    <div className="stat-label">Present</div>
                                </div>
                                <div className="stat-card red">
                                    <div className="stat-value">{todayAttendance.filter(a => a.status === 'Absent').length}</div>
                                    <div className="stat-label">Absent</div>
                                </div>
                                <div className="stat-card blue">
                                    <div className="stat-value">{employees.filter(e => e.role !== 'Admin').length - todayAttendance.length}</div>
                                    <div className="stat-label">Not Marked</div>
                                </div>
                            </div>

                            <table>
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Department</th>
                                        <th>Status</th>
                                        <th>Mark Attendance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.filter(e => e.role !== 'Admin').map(emp => {
                                        const record = todayAttendance.find(a => a.employeeId === emp.id);
                                        return (
                                            <tr key={emp.id}>
                                                <td><strong>{emp.name}</strong></td>
                                                <td>{emp.department || '—'}</td>
                                                <td>
                                                    {record ? (
                                                        <span className={`status-badge ${record.status.toLowerCase()}`}>
                                                            {record.status === 'Present' ? '✅' : '❌'} {record.status}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Not marked</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="flex-gap">
                                                        <button onClick={() => markAttendanceForEmployee(emp.id, 'Present')} className="btn-success">Present</button>
                                                        <button onClick={() => markAttendanceForEmployee(emp.id, 'Absent')} className="btn-danger">Absent</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    } />

                    {/* ─── LEAVE MANAGEMENT ─── */}
                    <Route path="leaves" element={
                        <div>
                            <h3 style={{ marginBottom: '1rem' }}>📋 Leave Requests Management</h3>

                            {/* Pending Leaves first */}
                            {pendingLeaves.length > 0 && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <h4 style={{ color: 'var(--warning-text)', marginBottom: '0.75rem' }}>⏳ Pending Approval ({pendingLeaves.length})</h4>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Department</th>
                                                <th>Type</th>
                                                <th>Dates</th>
                                                <th>Reason</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingLeaves.map(l => (
                                                <tr key={l.id}>
                                                    <td><strong>{l.employeeName}</strong></td>
                                                    <td>{l.department || '—'}</td>
                                                    <td>{l.type}</td>
                                                    <td>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()}</td>
                                                    <td>{l.reason}</td>
                                                    <td>
                                                        <div className="flex-gap">
                                                            <button onClick={() => handleLeaveStatus(l.id, 'Approved')} className="btn-success">✅ Approve</button>
                                                            <button onClick={() => handleLeaveStatus(l.id, 'Rejected')} className="btn-danger">❌ Reject</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* All Leaves */}
                            <h4 style={{ marginBottom: '0.5rem' }}>All Leave History</h4>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Type</th>
                                        <th>Dates</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Applied On</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaves.map(l => (
                                        <tr key={l.id}>
                                            <td>{l.employeeName}</td>
                                            <td>{l.type}</td>
                                            <td>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()}</td>
                                            <td>{l.reason}</td>
                                            <td>
                                                <span className={`status-badge ${l.status === 'Approved' ? 'approved' : l.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                                                    {l.status}
                                                </span>
                                            </td>
                                            <td>{new Date(l.appliedOn).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {leaves.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">📋</div>
                                    <p>No leave requests found</p>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── PAYROLL ─── */}
                    <Route path="payrolls" element={
                        <div>
                            <div className="section-header">
                                <h3>💰 Payroll Management</h3>
                            </div>

                            {/* Bulk Generate */}
                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>⚡ Bulk Generate Payroll</h4>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Month</label>
                                        <select value={bulkMonth} onChange={e => setBulkMonth(e.target.value)}>
                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Year</label>
                                        <input type="number" value={bulkYear} onChange={e => setBulkYear(Number(e.target.value))}
                                            style={{ width: '100px' }} />
                                    </div>
                                    <button onClick={bulkGeneratePayroll} className="btn-primary" style={{ width: 'auto', padding: '0.7rem 1.5rem', marginBottom: '0' }}>
                                        🚀 Generate for All Employees
                                    </button>
                                </div>
                            </div>

                            <h4 style={{ marginBottom: '0.5rem' }}>Recent Payrolls</h4>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Month/Year</th>
                                        <th>Basic Pay</th>
                                        <th>Allowances</th>
                                        <th>Deductions</th>
                                        <th>Net Salary</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrolls.map(p => (
                                        <tr key={p.id}>
                                            <td><strong>{p.employeeName}</strong></td>
                                            <td>{p.month} {p.year}</td>
                                            <td>₹{Number(p.basicPay).toLocaleString()}</td>
                                            <td>₹{Number(p.allowances).toLocaleString()}</td>
                                            <td style={{ color: 'var(--danger)' }}>-₹{Number(p.deductions?.total).toLocaleString()}</td>
                                            <td><strong>₹{Number(p.netSalary).toLocaleString()}</strong></td>
                                            <td><span className="status-badge paid">{p.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {payrolls.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">💰</div>
                                    <p>No payrolls generated yet</p>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── ANNOUNCEMENTS ─── */}
                    <Route path="announcements" element={
                        <div>
                            <h3 style={{ marginBottom: '1rem' }}>📢 Announcements Manager</h3>

                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>Post New Announcement</h4>
                                <form onSubmit={postAnnouncement}>
                                    <div className="form-group">
                                        <label>Title</label>
                                        <input required value={announcementForm.title}
                                            onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                                            placeholder="Announcement title..." />
                                    </div>
                                    <div className="form-group">
                                        <label>Message</label>
                                        <textarea required value={announcementForm.message}
                                            onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                                            placeholder="Write your announcement message..." rows={3} />
                                    </div>
                                    <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem' }}>
                                        📤 Post Announcement
                                    </button>
                                </form>
                            </div>

                            <h4 style={{ marginBottom: '0.75rem' }}>Previous Announcements</h4>
                            {announcements.length > 0 ? announcements.map(a => (
                                <div className="announcement-card" key={a.id}>
                                    <h4>{a.title}</h4>
                                    <p>{a.message}</p>
                                    <div className="meta">
                                        <span>Posted by {a.postedByName || 'HR'} • {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        <button onClick={() => deleteAnnouncement(a.id)} className="btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state">
                                    <div className="empty-icon">📢</div>
                                    <p>No announcements posted yet</p>
                                </div>
                            )}
                        </div>
                    } />
                </Routes>
            </div>
        </div>
    );
}
