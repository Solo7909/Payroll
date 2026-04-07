import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

const API = 'http://localhost:5001/api';

export default function UserDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const [dashboardStats, setDashboardStats] = useState(null);
    const [myPayrolls, setMyPayrolls] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [myTickets, setMyTickets] = useState([]);
    const [leaveForm, setLeaveForm] = useState({ type: 'Sick', startDate: '', endDate: '', reason: '' });
    const [showAttendancePopup, setShowAttendancePopup] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordMsg, setPasswordMsg] = useState('');
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [ticketForm, setTicketForm] = useState({ category: 'Hardware', subject: '', description: '', priority: 'Medium' });

    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        if (!user || user.role !== 'User') {
            navigate('/login');
        } else {
            fetchAll();
        }
    }, [navigate]);

    const fetchAll = async () => {
        await Promise.all([
            fetchDashboardStats(),
            fetchMyPayrolls(),
            fetchAttendance(),
            fetchLeaves(),
            fetchAnnouncements(),
            fetchMyTickets()
        ]);
    };

    const fetchDashboardStats = async () => {
        try {
            const res = await axios.get(`${API}/dashboard/employee/${user?.id}`);
            setDashboardStats(res.data);
            // Show popup only if attendance not marked AND popup wasn't already dismissed today
            const today = new Date().toISOString().split('T')[0];
            const dismissedKey = `attendance_handled_${user?.id}_${today}`;
            if (!res.data.todayAttendance && !sessionStorage.getItem(dismissedKey)) {
                setShowAttendancePopup(true);
            } else {
                setShowAttendancePopup(false);
            }
        } catch (err) { console.error(err); }
    };

    const fetchMyPayrolls = async () => {
        const res = await axios.get(`${API}/payrolls`);
        const filtered = res.data.filter(p => p.employeeId === user?.id);
        setMyPayrolls(filtered);
    };

    const fetchAttendance = async () => {
        const res = await axios.get(`${API}/attendance/${user?.id}`);
        setAttendance(res.data);
    };

    const fetchLeaves = async () => {
        const res = await axios.get(`${API}/leaves?employeeId=${user?.id}`);
        setLeaves(res.data);
    };

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get(`${API}/announcements`);
            setAnnouncements(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchMyTickets = async () => {
        try {
            const res = await axios.get(`${API}/tickets?employeeId=${user?.id}`);
            setMyTickets(res.data);
        } catch (err) { console.error(err); }
    };

    const submitTicket = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/tickets`, {
                employeeId: user.id,
                ...ticketForm
            });
            setTicketForm({ category: 'Hardware', subject: '', description: '', priority: 'Medium' });
            alert('IT support ticket raised! Admin will review it shortly.');
            fetchMyTickets();
        } catch (err) {
            alert('Error raising ticket');
        }
    };

    const markAttendance = async (status) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        try {
            await axios.post(`${API}/attendance/mark`, {
                employeeId: user.id,
                date: today,
                status
            });
            // Mark as handled so popup won't show again today
            sessionStorage.setItem(`attendance_handled_${user.id}_${today}`, 'true');
            setShowAttendancePopup(false);
            fetchDashboardStats();
            fetchAttendance();
        } catch (err) {
            alert("Error marking attendance");
        }
    };

    const applyLeave = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/leaves/apply`, {
                employeeId: user.id,
                ...leaveForm
            });
            setLeaveForm({ type: 'Sick', startDate: '', endDate: '', reason: '' });
            alert("Leave application submitted! Waiting for HR approval.");
            fetchLeaves();
            fetchDashboardStats();
        } catch (err) {
            alert("Error applying leave");
        }
    };

    const changePassword = async (e) => {
        e.preventDefault();
        setPasswordMsg('');
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordMsg('New passwords do not match');
            return;
        }
        try {
            const res = await axios.put(`${API}/employees/${user.id}/password`, {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setPasswordMsg(res.data.message);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setPasswordMsg(err.response?.data?.message || 'Error changing password');
        }
    };

    const downloadPDF = (payroll) => {
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.text("Pay Slip", 105, 20, null, null, "center");

        doc.setFontSize(12);
        doc.text(`Employee: ${user?.name}`, 20, 40);
        doc.text(`Role: ${user?.role}`, 20, 50);
        doc.text(`Month/Year: ${payroll.month} ${payroll.year}`, 20, 60);

        doc.text("Earnings", 20, 80);
        doc.line(20, 82, 100, 82);
        doc.text(`Basic Pay: Rs. ${payroll.basicPay}`, 20, 90);
        doc.text(`Allowances: Rs. ${payroll.allowances}`, 20, 100);

        doc.text("Deductions", 120, 80);
        doc.line(120, 82, 190, 82);
        doc.text(`PF: Rs. ${payroll.deductions.PF}`, 120, 90);
        doc.text(`ESI: Rs. ${payroll.deductions.ESI}`, 120, 100);
        doc.text(`TDS: Rs. ${payroll.deductions.TDS}`, 120, 110);

        doc.setFontSize(16);
        doc.text(`Net Salary: Rs. ${payroll.netSalary}`, 20, 140);

        doc.save(`Payslip_${payroll.month}_${payroll.year}.pdf`);
    };

    const logout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    // Calendar helper
    const calendarData = useMemo(() => {
        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
        const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
        const days = [];
        
        for (let i = 0; i < firstDay; i++) days.push(null);
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const record = attendance.find(a => a.date === dateStr);
            const today = new Date();
            const isToday = d === today.getDate() && calendarMonth === today.getMonth() && calendarYear === today.getFullYear();
            days.push({ day: d, status: record?.status || null, isToday, date: dateStr });
        }
        return days;
    }, [calendarMonth, calendarYear, attendance]);

    const isActive = (path) => {
        if (path === '/user' && location.pathname === '/user') return true;
        if (path !== '/user' && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="dashboard-layout">
            {/* Attendance Popup */}
            {showAttendancePopup && (
                <div className="modal-overlay" onClick={() => { const t = new Date().toISOString().split('T')[0]; sessionStorage.setItem(`attendance_handled_${user?.id}_${t}`, 'true'); setShowAttendancePopup(false); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-icon">👋</div>
                        <h2>Good {new Date().getHours() < 12 ? 'Morning' : 'Afternoon'}, {user?.name}!</h2>
                        <p>You haven't marked your attendance today.<br />{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                        <div className="modal-actions">
                            <button
                                onClick={() => markAttendance('Present')}
                                style={{ background: 'var(--success)', color: 'white' }}
                            >
                                ✅ Mark Present
                            </button>
                            <button
                                onClick={() => { const t = new Date().toISOString().split('T')[0]; sessionStorage.setItem(`attendance_handled_${user?.id}_${t}`, 'true'); setShowAttendancePopup(false); }}
                                style={{ background: '#f3f4f6', color: 'var(--text-main)' }}
                            >
                                Later
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="sidebar" style={{ background: 'linear-gradient(180deg, #0c4a35 0%, #047857 100%)' }}>
                <h2>👤 Employee Portal</h2>
                <ul>
                    <li><Link className={isActive('/user') && !isActive('/user/') ? 'active' : ''} to="/user">
                        <span className="nav-icon">🏠</span> Dashboard
                    </Link></li>
                    <li><Link className={isActive('/user/attendance') ? 'active' : ''} to="/user/attendance">
                        <span className="nav-icon">📅</span> Attendance
                    </Link></li>
                    <li><Link className={isActive('/user/leaves') ? 'active' : ''} to="/user/leaves">
                        <span className="nav-icon">🗓️</span> Leaves
                        {dashboardStats?.pendingLeaves > 0 && <span className="badge">{dashboardStats.pendingLeaves}</span>}
                    </Link></li>
                    <li><Link className={isActive('/user/payslips') ? 'active' : ''} to="/user/payslips">
                        <span className="nav-icon">💰</span> My Payslips
                    </Link></li>
                    <li><Link className={isActive('/user/it-support') ? 'active' : ''} to="/user/it-support">
                        <span className="nav-icon">🎫</span> IT Support
                        {myTickets.filter(t => t.status === 'Open').length > 0 && <span className="badge">{myTickets.filter(t => t.status === 'Open').length}</span>}
                    </Link></li>
                    <li><Link className={isActive('/user/announcements') ? 'active' : ''} to="/user/announcements">
                        <span className="nav-icon">📢</span> Announcements
                        {announcements.length > 0 && <span className="badge">{announcements.length}</span>}
                    </Link></li>
                    <li><Link className={isActive('/user/profile') ? 'active' : ''} to="/user/profile">
                        <span className="nav-icon">⚙️</span> My Profile
                    </Link></li>
                </ul>
                <button onClick={logout}>🚪 Logout</button>
            </div>

            <div className="main-content">
                <h1 className="page-title">Welcome, {user?.name} 👋</h1>

                <Routes>
                    {/* ─── DASHBOARD HOME ─── */}
                    <Route path="/" element={
                        <div>
                            {/* Stats Cards */}
                            <div className="stats-grid">
                                <div className="stat-card green">
                                    <div className="stat-icon">✅</div>
                                    <div className="stat-value">{dashboardStats?.todayAttendance || '—'}</div>
                                    <div className="stat-label">Today's Status</div>
                                </div>
                                <div className="stat-card blue">
                                    <div className="stat-icon">📊</div>
                                    <div className="stat-value">{dashboardStats?.presentDays || 0}</div>
                                    <div className="stat-label">Days Present (This Month)</div>
                                </div>
                                <div className="stat-card orange">
                                    <div className="stat-icon">🗓️</div>
                                    <div className="stat-value">{dashboardStats?.pendingLeaves || 0}</div>
                                    <div className="stat-label">Pending Leaves</div>
                                </div>
                                <div className="stat-card purple">
                                    <div className="stat-icon">💰</div>
                                    <div className="stat-value">
                                        {dashboardStats?.latestPayroll ? `₹${Number(dashboardStats.latestPayroll.netSalary).toLocaleString()}` : '—'}
                                    </div>
                                    <div className="stat-label">Last Salary</div>
                                </div>
                            </div>

                            {/* Leave Balance */}
                            {dashboardStats?.leaveBalance && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h3 style={{ marginBottom: '0.75rem' }}>Leave Balance</h3>
                                    <div className="leave-balance-grid">
                                        {Object.entries(dashboardStats.leaveBalance).map(([type, data]) => (
                                            <div className="leave-balance-card" key={type}>
                                                <div className="leave-type">{type} Leave</div>
                                                <div className="leave-count" style={{ color: data.total - data.used <= 2 ? 'var(--danger)' : 'var(--success)' }}>
                                                    {data.total - data.used}
                                                </div>
                                                <div className="leave-total">of {data.total} remaining</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Announcements */}
                            {announcements.length > 0 && (
                                <div>
                                    <h3 style={{ marginBottom: '0.75rem' }}>📢 Latest Announcements</h3>
                                    {announcements.slice(0, 2).map(a => (
                                        <div className="announcement-card" key={a.id}>
                                            <h4>{a.title}</h4>
                                            <p>{a.message}</p>
                                            <div className="meta">
                                                <span>By {a.postedByName || 'HR'}</span>
                                                <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── ATTENDANCE ─── */}
                    <Route path="attendance" element={
                        <div>
                            <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 'none', textAlign: 'center' }}>
                                <h3>Today's Attendance</h3>
                                <p className="text-muted" style={{ margin: '0.5rem 0 1rem' }}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                                {dashboardStats?.todayAttendance ? (
                                    <span className={`status-badge ${dashboardStats.todayAttendance.toLowerCase()}`} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}>
                                        {dashboardStats.todayAttendance === 'Present' ? '✅' : '❌'} Marked as {dashboardStats.todayAttendance}
                                    </span>
                                ) : (
                                    <div className="flex-gap" style={{ justifyContent: 'center' }}>
                                        <button onClick={() => markAttendance('Present')} className="btn-success" style={{ padding: '0.5rem 1.5rem' }}>✅ Mark Present</button>
                                        <button onClick={() => markAttendance('Absent')} className="btn-danger" style={{ padding: '0.5rem 1.5rem' }}>❌ Mark Absent</button>
                                    </div>
                                )}
                            </div>

                            {/* Calendar View */}
                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <div className="section-header">
                                    <h3>📅 {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long' })} {calendarYear}</h3>
                                    <div className="flex-gap">
                                        <button className="btn-outline" onClick={() => {
                                            if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
                                            else setCalendarMonth(calendarMonth - 1);
                                        }}>◀</button>
                                        <button className="btn-outline" onClick={() => {
                                            if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
                                            else setCalendarMonth(calendarMonth + 1);
                                        }}>▶</button>
                                    </div>
                                </div>
                                <div className="calendar-grid">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                        <div className="calendar-header" key={d}>{d}</div>
                                    ))}
                                    {calendarData.map((d, i) => (
                                        <div key={i} className={`calendar-day ${d ? (d.isToday ? 'today ' : '') + (d.status ? d.status.toLowerCase() : 'unmarked') : 'empty'}`}>
                                            {d?.day || ''}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex-gap mt-2" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.75rem' }}>🟢 Present</span>
                                    <span style={{ fontSize: '0.75rem' }}>🔴 Absent</span>
                                    <span style={{ fontSize: '0.75rem' }}>⬜ Not Marked</span>
                                </div>
                            </div>

                            {/* Monthly Summary */}
                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                <div className="stat-card green">
                                    <div className="stat-value">{dashboardStats?.presentDays || 0}</div>
                                    <div className="stat-label">Present</div>
                                </div>
                                <div className="stat-card red">
                                    <div className="stat-value">{dashboardStats?.absentDays || 0}</div>
                                    <div className="stat-label">Absent</div>
                                </div>
                                <div className="stat-card blue">
                                    <div className="stat-value">
                                        {dashboardStats ? (dashboardStats.presentDays + dashboardStats.absentDays > 0 ? Math.round((dashboardStats.presentDays / (dashboardStats.presentDays + dashboardStats.absentDays)) * 100) : 0) : 0}%
                                    </div>
                                    <div className="stat-label">Attendance %</div>
                                </div>
                            </div>
                        </div>
                    } />

                    {/* ─── LEAVES ─── */}
                    <Route path="leaves" element={
                        <div>
                            {/* Leave Balance */}
                            {dashboardStats?.leaveBalance && (
                                <div className="leave-balance-grid" style={{ marginBottom: '1.5rem' }}>
                                    {Object.entries(dashboardStats.leaveBalance).map(([type, data]) => (
                                        <div className="leave-balance-card" key={type}>
                                            <div className="leave-type">{type} Leave</div>
                                            <div className="leave-count" style={{ color: data.total - data.used <= 2 ? 'var(--danger)' : 'var(--success)' }}>
                                                {data.total - data.used} / {data.total}
                                            </div>
                                            <div className="leave-total">{data.used} used</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Apply Leave Form */}
                            <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 'none' }}>
                                <h3 style={{ marginBottom: '1rem' }}>📝 Apply for Leave</h3>
                                <form onSubmit={applyLeave} className="grid-2">
                                    <div className="form-group">
                                        <label>Leave Type</label>
                                        <select required value={leaveForm.type} onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}>
                                            <option>Sick</option>
                                            <option>Casual</option>
                                            <option>Paid</option>
                                            <option>Half Day</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Reason</label>
                                        <input required value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Brief reason for leave" />
                                    </div>
                                    <div className="form-group">
                                        <label>Start Date</label>
                                        <input type="date" required value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>End Date</label>
                                        <input type="date" required value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                                    </div>
                                    <div className="span-2">
                                        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem' }}>Submit Application →</button>
                                    </div>
                                </form>
                            </div>

                            {/* Leave History */}
                            <h3 style={{ marginBottom: '0.5rem' }}>My Leave Applications</h3>
                            {leaves.length > 0 ? (
                                <table>
                                    <thead>
                                        <tr>
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
                                                <td>{l.type}</td>
                                                <td>{new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()}</td>
                                                <td>{l.reason}</td>
                                                <td>
                                                    <span className={`status-badge ${l.status === 'Approved' ? 'approved' : l.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                                                        {l.status === 'Approved' ? '✅' : l.status === 'Rejected' ? '❌' : '⏳'} {l.status}
                                                    </span>
                                                </td>
                                                <td>{new Date(l.appliedOn).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-icon">🗓️</div>
                                    <p>No leave applications yet</p>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── PAYSLIPS ─── */}
                    <Route path="payslips" element={
                        <div>
                            <h3 style={{ marginBottom: '0.5rem' }}>💰 My Payslips</h3>
                            {myPayrolls.length > 0 ? (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Period</th>
                                            <th>Basic Pay</th>
                                            <th>Allowances</th>
                                            <th>Deductions</th>
                                            <th>Net Salary</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {myPayrolls.map(p => (
                                            <tr key={p.id}>
                                                <td><strong>{p.month} {p.year}</strong></td>
                                                <td>₹{Number(p.basicPay).toLocaleString()}</td>
                                                <td>₹{Number(p.allowances).toLocaleString()}</td>
                                                <td style={{ color: 'var(--danger)' }}>-₹{Number(p.deductions?.total).toLocaleString()}</td>
                                                <td><strong>₹{Number(p.netSalary).toLocaleString()}</strong></td>
                                                <td>
                                                    <button onClick={() => downloadPDF(p)} className="btn-outline">
                                                        📄 Download PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-icon">💰</div>
                                    <p>No payslips generated yet</p>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── ANNOUNCEMENTS ─── */}
                    <Route path="announcements" element={
                        <div>
                            <h3 style={{ marginBottom: '1rem' }}>📢 Company Announcements</h3>
                            {announcements.length > 0 ? announcements.map(a => (
                                <div className="announcement-card" key={a.id}>
                                    <h4>{a.title}</h4>
                                    <p>{a.message}</p>
                                    <div className="meta">
                                        <span>Posted by {a.postedByName || 'HR'}</span>
                                        <span>{new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state">
                                    <div className="empty-icon">📢</div>
                                    <p>No announcements yet</p>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── IT SUPPORT ─── */}
                    <Route path="it-support" element={
                        <div>
                            {/* Raise Ticket Form */}
                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h3 style={{ marginBottom: '1rem' }}>🎫 Raise IT Support Ticket</h3>
                                <form onSubmit={submitTicket} className="grid-2">
                                    <div className="form-group">
                                        <label>Category</label>
                                        <select required value={ticketForm.category} onChange={e => setTicketForm({ ...ticketForm, category: e.target.value })}>
                                            <option>Hardware</option>
                                            <option>Software</option>
                                            <option>Network</option>
                                            <option>Access / Permissions</option>
                                            <option>Email</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Priority</label>
                                        <select value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                                            <option>Low</option>
                                            <option>Medium</option>
                                            <option>High</option>
                                        </select>
                                    </div>
                                    <div className="form-group span-2">
                                        <label>Subject</label>
                                        <input required value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} placeholder="Brief description of your issue" />
                                    </div>
                                    <div className="form-group span-2">
                                        <label>Description</label>
                                        <textarea value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="Detailed explanation (model number, error message, steps to reproduce, etc.)" rows={3} />
                                    </div>
                                    <div className="span-2">
                                        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem' }}>📤 Submit Ticket</button>
                                    </div>
                                </form>
                            </div>

                            {/* My Tickets */}
                            <h3 style={{ marginBottom: '0.5rem' }}>My Tickets</h3>
                            {myTickets.length > 0 ? myTickets.map(t => {
                                const statusColor = { Open: '#ef4444', 'In Progress': '#f59e0b', Resolved: '#10b981', Closed: '#6b7280' };
                                const priorityColor = { High: 'var(--danger)', Medium: 'var(--warning)', Low: 'var(--success)' };
                                return (
                                    <div key={t.id} className="card" style={{ maxWidth: 'none', marginBottom: '0.75rem', borderLeft: `4px solid ${statusColor[t.status] || '#6b7280'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                    <strong>#{t.id} — {t.subject}</strong>
                                                    <span style={{ background: (statusColor[t.status] || '#6b7280') + '20', color: statusColor[t.status], padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>{t.status}</span>
                                                    <span style={{ color: priorityColor[t.priority], fontSize: '0.7rem', fontWeight: 600 }}>● {t.priority}</span>
                                                </div>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                    {t.category} • {new Date(t.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        {t.description && <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{t.description}</p>}
                                        {t.adminNote && (
                                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                                <strong>IT Admin Response:</strong> {t.adminNote}
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div className="empty-state">
                                    <div className="empty-icon">🎫</div>
                                    <p>No support tickets raised yet</p>
                                </div>
                            )}
                        </div>
                    } />

                    {/* ─── PROFILE ─── */}
                    <Route path="profile" element={
                        <div>
                            <div className="card" style={{ maxWidth: 'none', marginBottom: '1.5rem' }}>
                                <h3 style={{ marginBottom: '1rem' }}>👤 My Profile</h3>
                                <div className="profile-grid">
                                    <div className="profile-item">
                                        <label>Full Name</label>
                                        <span>{user?.name}</span>
                                    </div>
                                    <div className="profile-item">
                                        <label>Email</label>
                                        <span>{user?.email}</span>
                                    </div>
                                    <div className="profile-item">
                                        <label>Role</label>
                                        <span>{user?.role}</span>
                                    </div>
                                    <div className="profile-item">
                                        <label>Phone</label>
                                        <span>{user?.phone || 'N/A'}</span>
                                    </div>
                                    <div className="profile-item">
                                        <label>Department</label>
                                        <span>{user?.department || 'N/A'}</span>
                                    </div>
                                    <div className="profile-item">
                                        <label>Designation</label>
                                        <span>{user?.designation || 'N/A'}</span>
                                    </div>
                                    <div className="profile-item">
                                        <label>Join Date</label>
                                        <span>{user?.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div className="profile-item">
                                        <label>Basic Pay</label>
                                        <span>₹{Number(user?.basicPay || user?.basicpay || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="card" style={{ maxWidth: '500px' }}>
                                <h3 style={{ marginBottom: '1rem' }}>🔒 Change Password</h3>
                                <form onSubmit={changePassword}>
                                    <div className="form-group">
                                        <label>Current Password</label>
                                        <input type="password" required value={passwordForm.currentPassword}
                                            onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>New Password</label>
                                        <input type="password" required value={passwordForm.newPassword}
                                            onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Confirm New Password</label>
                                        <input type="password" required value={passwordForm.confirmPassword}
                                            onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
                                    </div>
                                    {passwordMsg && <p style={{ color: passwordMsg.includes('success') ? 'var(--success)' : 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{passwordMsg}</p>}
                                    <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 2rem' }}>Update Password</button>
                                </form>
                            </div>
                        </div>
                    } />
                </Routes>
            </div>
        </div>
    );
}
