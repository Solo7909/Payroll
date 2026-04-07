require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ─── AUTH ────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Temporary users
    const users = [
        { email: 'it@test.com', password: 'password123', role: 'Admin' },
        { email: 'hr@test.com', password: 'password123', role: 'HR' },
        { email: 'user@test.com', password: 'password123', role: 'User' }
    ];

    const user = users.find(
        u => u.email === email && u.password === password
    );

    if (user) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});
    

// ─── EMPLOYEES ───────────────────────────────────────

// GET all employees
app.get('/api/employees', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM employees ORDER BY id ASC');
        const formatted = rows.map(r => ({
            ...r,
            basicPay: r.basicpay,
            joinDate: r.joinDate ? new Date(r.joinDate).toISOString().split('T')[0] : null
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single employee
app.get('/api/employees/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Employee not found' });
        const r = rows[0];
        res.json({ ...r, basicPay: r.basicpay, joinDate: r.joinDate ? new Date(r.joinDate).toISOString().split('T')[0] : null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADD an employee
app.post('/api/employees', async (req, res) => {
    const { name, email, role, phone, department, designation, joinDate, basicPay, allowances } = req.body;
    try {
        const { rows } = await pool.query(
            `INSERT INTO employees (name, email, role, phone, department, designation, "joinDate", basicPay, allowances) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [name, email, role, phone || null, department || null, designation || null, joinDate || null, basicPay || 0, allowances || 0]
        );
        res.json({ success: true, employee: { ...rows[0], basicPay: rows[0].basicpay, joinDate: rows[0].joinDate } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE an employee
app.put('/api/employees/:id', async (req, res) => {
    const { name, email, role, phone, department, designation, joinDate, basicPay, allowances } = req.body;
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `UPDATE employees SET name=$1, email=$2, role=$3, phone=$4, department=$5, designation=$6, "joinDate"=$7, basicPay=$8, allowances=$9 WHERE id=$10 RETURNING *`,
            [name, email, role, phone || null, department || null, designation || null, joinDate || null, basicPay || 0, allowances || 0, id]
        );
        if (rows.length > 0) {
            res.json({ success: true, employee: { ...rows[0], basicPay: rows[0].basicpay, joinDate: rows[0].joinDate } });
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Change password
app.put('/api/employees/:id/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT password FROM employees WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Employee not found' });
        if (rows[0].password !== currentPassword) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        await pool.query('UPDATE employees SET password = $1 WHERE id = $2', [newPassword, id]);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE an employee
app.delete('/api/employees/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PAYROLL ─────────────────────────────────────────

// CALCULATE and GENERATE Payroll
app.post('/api/payroll/calculate', async (req, res) => {
    const { employeeId, month, year } = req.body;
    try {
        const { rows: empRows } = await pool.query('SELECT * FROM employees WHERE id = $1', [employeeId]);
        const employee = empRows[0];
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        // Check if payroll already exists for this month/year
        const { rows: existing } = await pool.query(
            'SELECT * FROM payrolls WHERE employeeId = $1 AND month = $2 AND year = $3',
            [employeeId, month, year]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: `Payroll already generated for ${month} ${year}` });
        }

        const basicPay = Number(employee.basicpay || 0);
        const allowances = Number(employee.allowances || 0);

        const PF = basicPay * 0.12;
        const ESI = basicPay * 0.0075;
        const TDS = basicPay > 50000 ? (basicPay - 50000) * 0.1 : 0;

        const totalDeductions = PF + ESI + TDS;
        const netSalary = (basicPay + allowances) - totalDeductions;

        const { rows: prRows } = await pool.query(
            "INSERT INTO payrolls (employeeId, month, year, basicPay, allowances, pfDeduction, esiDeduction, tdsDeduction, totalDeductions, netSalary) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
            [employeeId, month, year, basicPay, allowances, PF, ESI, TDS, totalDeductions, netSalary]
        );

        const generated = prRows[0];
        const newPayroll = {
            ...generated,
            basicPay: generated.basicpay,
            employeeId: generated.employeeid,
            deductions: { PF: generated.pfdeduction, ESI: generated.esideduction, TDS: generated.tdsdeduction, total: generated.totaldeductions },
            netSalary: generated.netsalary
        };

        res.json({ success: true, payroll: newPayroll });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk payroll generation
app.post('/api/payroll/bulk-generate', async (req, res) => {
    const { month, year } = req.body;
    try {
        const { rows: employees } = await pool.query("SELECT * FROM employees WHERE role != 'Admin'");
        let generated = 0;
        let skipped = 0;
        const results = [];

        for (const employee of employees) {
            // Check if already generated
            const { rows: existing } = await pool.query(
                'SELECT * FROM payrolls WHERE employeeId = $1 AND month = $2 AND year = $3',
                [employee.id, month, year]
            );
            if (existing.length > 0) {
                skipped++;
                continue;
            }

            const basicPay = Number(employee.basicpay || 0);
            const allowances = Number(employee.allowances || 0);
            const PF = basicPay * 0.12;
            const ESI = basicPay * 0.0075;
            const TDS = basicPay > 50000 ? (basicPay - 50000) * 0.1 : 0;
            const totalDeductions = PF + ESI + TDS;
            const netSalary = (basicPay + allowances) - totalDeductions;

            await pool.query(
                "INSERT INTO payrolls (employeeId, month, year, basicPay, allowances, pfDeduction, esiDeduction, tdsDeduction, totalDeductions, netSalary) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                [employee.id, month, year, basicPay, allowances, PF, ESI, TDS, totalDeductions, netSalary]
            );
            generated++;
        }

        res.json({ success: true, generated, skipped, message: `Generated ${generated} payrolls, skipped ${skipped} (already exist)` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all payrolls
app.get('/api/payrolls', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT p.*, e.name as employeeName FROM payrolls p JOIN employees e ON p.employeeId = e.id ORDER BY p.id DESC");
        const enriched = rows.map(r => ({
            ...r,
            employeeName: r.employeename,
            employeeId: r.employeeid,
            basicPay: r.basicpay,
            netSalary: r.netsalary,
            deductions: { PF: r.pfdeduction, ESI: r.esideduction, TDS: r.tdsdeduction, total: r.totaldeductions }
        }));
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ATTENDANCE ──────────────────────────────────────

// Mark Attendance
app.post('/api/attendance/mark', async (req, res) => {
    const { employeeId, date, status } = req.body;
    try {
        const { rows } = await pool.query(
            "INSERT INTO attendance (employeeId, date, status) VALUES ($1, $2, $3) ON CONFLICT (employeeId, date) DO UPDATE SET status = EXCLUDED.status RETURNING *",
            [employeeId, date, status]
        );
        res.json({ success: true, record: { ...rows[0], employeeId: rows[0].employeeid } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Attendance for a single employee
app.get('/api/attendance/:employeeId', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM attendance WHERE employeeId = $1 ORDER BY date DESC", [req.params.employeeId]);
        const formatted = rows.map(r => ({ ...r, employeeId: r.employeeid, date: new Date(r.date).toISOString().split('T')[0] }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all attendance (for HR)
app.get('/api/attendance', async (req, res) => {
    const { date } = req.query;
    try {
        let query = "SELECT a.*, e.name as employeeName, e.department FROM attendance a JOIN employees e ON a.employeeId = e.id";
        let params = [];
        if (date) {
            query += " WHERE a.date = $1";
            params.push(date);
        }
        query += " ORDER BY a.date DESC, e.name ASC";
        const { rows } = await pool.query(query, params);
        const formatted = rows.map(r => ({
            ...r,
            employeeId: r.employeeid,
            employeeName: r.employeename,
            date: new Date(r.date).toISOString().split('T')[0]
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET today's attendance summary
app.get('/api/attendance/today/summary', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { rows: totalRows } = await pool.query("SELECT COUNT(*) as total FROM employees WHERE role != 'Admin'");
        const { rows: presentRows } = await pool.query(
            "SELECT COUNT(*) as present FROM attendance WHERE date = $1 AND status = 'Present'", [today]
        );
        const { rows: absentRows } = await pool.query(
            "SELECT COUNT(*) as absent FROM attendance WHERE date = $1 AND status = 'Absent'", [today]
        );
        const total = parseInt(totalRows[0].total);
        const present = parseInt(presentRows[0].present);
        const absent = parseInt(absentRows[0].absent);
        const notMarked = total - present - absent;

        res.json({ total, present, absent, notMarked, date: today });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── LEAVES ──────────────────────────────────────────

// Apply for leave
app.post('/api/leaves/apply', async (req, res) => {
    const { employeeId, type, startDate, endDate, reason } = req.body;
    try {
        const { rows } = await pool.query(
            "INSERT INTO leaves (employeeId, type, startDate, endDate, reason) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [employeeId, type, startDate, endDate, reason]
        );
        res.json({ success: true, leave: { ...rows[0], employeeId: rows[0].employeeid } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all leaves (for HR) or specific employee
app.get('/api/leaves', async (req, res) => {
    const { employeeId } = req.query;
    try {
        let query = "SELECT l.*, e.name as employeeName, e.department FROM leaves l JOIN employees e ON l.employeeId = e.id ";
        let params = [];

        if (employeeId) {
            query += " WHERE l.employeeId = $1 ";
            params.push(employeeId);
        }
        query += ' ORDER BY l.id DESC';

        const { rows } = await pool.query(query, params);

        const enriched = rows.map(r => ({
            ...r,
            employeeName: r.employeename,
            employeeId: r.employeeid,
            startDate: r.startdate,
            endDate: r.enddate,
            appliedOn: r.appliedon
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// APPROVE/REJECT leave
app.put('/api/leaves/:id/status', async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            "UPDATE leaves SET status=$1 WHERE id=$2 RETURNING *",
            [status, id]
        );
        if (rows.length > 0) {
            res.json({ success: true, leave: rows[0] });
        } else {
            res.status(404).json({ message: 'Leave not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ANNOUNCEMENTS ───────────────────────────────────

// POST announcement
app.post('/api/announcements', async (req, res) => {
    const { title, message, postedBy } = req.body;
    try {
        const { rows } = await pool.query(
            "INSERT INTO announcements (title, message, postedBy) VALUES ($1, $2, $3) RETURNING *",
            [title, message, postedBy]
        );
        res.json({ success: true, announcement: { ...rows[0], createdAt: rows[0].createdat, postedBy: rows[0].postedby } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all announcements
app.get('/api/announcements', async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT a.*, e.name as postedByName FROM announcements a LEFT JOIN employees e ON a.postedBy = e.id ORDER BY a.createdAt DESC"
        );
        const formatted = rows.map(r => ({
            ...r,
            postedBy: r.postedby,
            postedByName: r.postedbyname,
            createdAt: r.createdat
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE announcement
app.delete('/api/announcements/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DASHBOARD STATS ─────────────────────────────────

// Employee dashboard stats
app.get('/api/dashboard/employee/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Attendance stats for current month
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

        const { rows: attendanceRows } = await pool.query(
            "SELECT status, COUNT(*) as count FROM attendance WHERE employeeId = $1 AND date >= $2 AND date <= $3 GROUP BY status",
            [id, monthStart, monthEnd]
        );
        const presentDays = parseInt(attendanceRows.find(r => r.status === 'Present')?.count || 0);
        const absentDays = parseInt(attendanceRows.find(r => r.status === 'Absent')?.count || 0);

        // Today's attendance check
        const today = now.toISOString().split('T')[0];
        const { rows: todayRows } = await pool.query(
            "SELECT * FROM attendance WHERE employeeId = $1 AND date = $2", [id, today]
        );
        const todayAttendance = todayRows.length > 0 ? todayRows[0].status : null;

        // Leave balance (hardcoded limits: Sick=12, Casual=12, Paid=15)
        const yearStart = `${now.getFullYear()}-01-01`;
        const yearEnd = `${now.getFullYear()}-12-31`;
        const { rows: leaveRows } = await pool.query(
            "SELECT type, COUNT(*) as count FROM leaves WHERE employeeId = $1 AND status = 'Approved' AND startDate >= $2 AND endDate <= $3 GROUP BY type",
            [id, yearStart, yearEnd]
        );
        const leaveBalance = {
            Sick: { total: 12, used: parseInt(leaveRows.find(r => r.type === 'Sick')?.count || 0) },
            Casual: { total: 12, used: parseInt(leaveRows.find(r => r.type === 'Casual')?.count || 0) },
            Paid: { total: 15, used: parseInt(leaveRows.find(r => r.type === 'Paid')?.count || 0) },
        };

        // Pending leaves
        const { rows: pendingRows } = await pool.query(
            "SELECT COUNT(*) as count FROM leaves WHERE employeeId = $1 AND status = 'Pending'", [id]
        );
        const pendingLeaves = parseInt(pendingRows[0].count);

        // Latest payroll
        const { rows: payRows } = await pool.query(
            "SELECT * FROM payrolls WHERE employeeId = $1 ORDER BY id DESC LIMIT 1", [id]
        );
        const latestPayroll = payRows.length > 0 ? {
            month: payRows[0].month,
            year: payRows[0].year,
            netSalary: payRows[0].netsalary,
            status: payRows[0].status
        } : null;

        res.json({
            presentDays,
            absentDays,
            todayAttendance,
            leaveBalance,
            pendingLeaves,
            latestPayroll,
            currentMonth: now.toLocaleString('default', { month: 'long' }),
            currentYear: now.getFullYear()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// HR dashboard stats
app.get('/api/dashboard/hr', async (req, res) => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Total employees (non-admin)
        const { rows: empRows } = await pool.query("SELECT COUNT(*) as total FROM employees WHERE role != 'Admin'");
        const totalEmployees = parseInt(empRows[0].total);

        // Present today
        const { rows: presentRows } = await pool.query(
            "SELECT COUNT(*) as present FROM attendance WHERE date = $1 AND status = 'Present'", [today]
        );
        const presentToday = parseInt(presentRows[0].present);

        // Pending leave requests
        const { rows: pendingRows } = await pool.query("SELECT COUNT(*) as count FROM leaves WHERE status = 'Pending'");
        const pendingLeaves = parseInt(pendingRows[0].count);

        // This month's total payroll
        const currentMonth = now.toLocaleString('default', { month: 'long' });
        const currentYear = now.getFullYear();
        const { rows: payRows } = await pool.query(
            "SELECT SUM(netSalary) as total FROM payrolls WHERE month = $1 AND year = $2",
            [currentMonth, currentYear]
        );
        const totalPayroll = parseFloat(payRows[0].total || 0);

        // Department-wise count
        const { rows: deptRows } = await pool.query(
            "SELECT department, COUNT(*) as count FROM employees WHERE role != 'Admin' GROUP BY department ORDER BY count DESC"
        );

        // Recent leaves
        const { rows: recentLeaves } = await pool.query(
            "SELECT l.*, e.name as employeeName FROM leaves l JOIN employees e ON l.employeeId = e.id ORDER BY l.id DESC LIMIT 5"
        );
        const formattedLeaves = recentLeaves.map(r => ({
            ...r,
            employeeName: r.employeename,
            employeeId: r.employeeid,
            startDate: r.startdate,
            endDate: r.enddate,
            appliedOn: r.appliedon
        }));

        res.json({
            totalEmployees,
            presentToday,
            pendingLeaves,
            totalPayroll,
            departments: deptRows,
            recentLeaves: formattedLeaves,
            currentMonth,
            currentYear
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ANALYTICS ───────────────────────────────────────
app.get('/api/analytics', async (req, res) => {
    try {
        const { rows: empRows } = await pool.query('SELECT COUNT(*) as total FROM employees');
        const totalEmployees = parseInt(empRows[0].total) || 0;

        const { rows: payRows } = await pool.query("SELECT month, year, SUM(netSalary) as totalPayout, SUM(basicPay) as basicPay, COUNT(id) as employeesPaid FROM payrolls GROUP BY month, year ORDER BY year DESC, month DESC LIMIT 12");

        const chartData = payRows.map(r => ({
            name: `${r.month} ${r.year}`,
            totalPayout: parseFloat(r.totalpayout),
            basicPay: parseFloat(r.basicpay),
            employeesPaid: parseInt(r.employeespaid)
        }));

        res.json({
            totalEmployees,
            chartData
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── IT TICKETS ──────────────────────────────────────

// Create ticket (employee raises)
app.post('/api/tickets', async (req, res) => {
    const { employeeId, category, subject, description, priority } = req.body;
    try {
        const { rows } = await pool.query(
            "INSERT INTO tickets (employeeId, category, subject, description, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [employeeId, category, subject, description || null, priority || 'Medium']
        );
        res.json({ success: true, ticket: { ...rows[0], employeeId: rows[0].employeeid, createdAt: rows[0].createdat, updatedAt: rows[0].updatedat, adminNote: rows[0].adminnote } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all tickets (for admin)
app.get('/api/tickets', async (req, res) => {
    const { employeeId, status } = req.query;
    try {
        let query = "SELECT t.*, e.name as employeeName, e.department FROM tickets t JOIN employees e ON t.employeeId = e.id";
        let params = [];
        let conditions = [];

        if (employeeId) {
            conditions.push(`t.employeeId = $${conditions.length + 1}`);
            params.push(employeeId);
        }
        if (status) {
            conditions.push(`t.status = $${conditions.length + 1}`);
            params.push(status);
        }
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        query += " ORDER BY t.createdAt DESC";

        const { rows } = await pool.query(query, params);
        const formatted = rows.map(r => ({
            ...r,
            employeeId: r.employeeid,
            employeeName: r.employeename,
            createdAt: r.createdat,
            updatedAt: r.updatedat,
            adminNote: r.adminnote
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update ticket (admin resolves)
app.put('/api/tickets/:id', async (req, res) => {
    const { status, adminNote } = req.body;
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            "UPDATE tickets SET status = $1, adminNote = $2, updatedAt = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
            [status, adminNote || null, id]
        );
        if (rows.length > 0) {
            res.json({ success: true, ticket: { ...rows[0], employeeId: rows[0].employeeid, createdAt: rows[0].createdat, updatedAt: rows[0].updatedat, adminNote: rows[0].adminnote } });
        } else {
            res.status(404).json({ message: 'Ticket not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete ticket
app.delete('/api/tickets/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM tickets WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── IT ASSETS ───────────────────────────────────────

// Create asset
app.post('/api/assets', async (req, res) => {
    const { assetName, assetType, serialNumber, assignedTo, status, purchaseDate, notes } = req.body;
    try {
        const { rows } = await pool.query(
            "INSERT INTO assets (assetName, assetType, serialNumber, assignedTo, status, purchaseDate, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            [assetName, assetType, serialNumber || null, assignedTo || null, status || 'Available', purchaseDate || null, notes || null]
        );
        res.json({ success: true, asset: { ...rows[0], assetName: rows[0].assetname, assetType: rows[0].assettype, serialNumber: rows[0].serialnumber, assignedTo: rows[0].assignedto, purchaseDate: rows[0].purchasedate } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all assets
app.get('/api/assets', async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT a.*, e.name as assignedToName FROM assets a LEFT JOIN employees e ON a.assignedTo = e.id ORDER BY a.id ASC"
        );
        const formatted = rows.map(r => ({
            ...r,
            assetName: r.assetname,
            assetType: r.assettype,
            serialNumber: r.serialnumber,
            assignedTo: r.assignedto,
            assignedToName: r.assignedtoname,
            purchaseDate: r.purchasedate ? new Date(r.purchasedate).toISOString().split('T')[0] : null
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update asset
app.put('/api/assets/:id', async (req, res) => {
    const { assetName, assetType, serialNumber, assignedTo, status, purchaseDate, notes } = req.body;
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            "UPDATE assets SET assetName=$1, assetType=$2, serialNumber=$3, assignedTo=$4, status=$5, purchaseDate=$6, notes=$7 WHERE id=$8 RETURNING *",
            [assetName, assetType, serialNumber || null, assignedTo || null, status || 'Available', purchaseDate || null, notes || null, id]
        );
        if (rows.length > 0) {
            res.json({ success: true, asset: rows[0] });
        } else {
            res.status(404).json({ message: 'Asset not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete asset
app.delete('/api/assets/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM assets WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ADMIN / IT DASHBOARD STATS ──────────────────────
app.get('/api/dashboard/admin', async (req, res) => {
    try {
        const { rows: empRows } = await pool.query("SELECT COUNT(*) as total FROM employees");
        const totalUsers = parseInt(empRows[0].total);

        const { rows: ticketOpen } = await pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Open'");
        const openTickets = parseInt(ticketOpen[0].count);

        const { rows: ticketProgress } = await pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'In Progress'");
        const inProgressTickets = parseInt(ticketProgress[0].count);

        const { rows: ticketResolved } = await pool.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Resolved'");
        const resolvedTickets = parseInt(ticketResolved[0].count);

        const { rows: assetRows } = await pool.query("SELECT COUNT(*) as total FROM assets");
        const totalAssets = parseInt(assetRows[0].total);

        const { rows: assignedAssets } = await pool.query("SELECT COUNT(*) as count FROM assets WHERE assignedTo IS NOT NULL");
        const assigned = parseInt(assignedAssets[0].count);

        const { rows: availableAssets } = await pool.query("SELECT COUNT(*) as count FROM assets WHERE assignedTo IS NULL");
        const available = parseInt(availableAssets[0].count);

        // Tickets by category
        const { rows: categoryRows } = await pool.query("SELECT category, COUNT(*) as count FROM tickets GROUP BY category ORDER BY count DESC");

        // Tickets by priority
        const { rows: priorityRows } = await pool.query("SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority");

        // Recent tickets
        const { rows: recentTickets } = await pool.query(
            "SELECT t.*, e.name as employeeName FROM tickets t JOIN employees e ON t.employeeId = e.id ORDER BY t.createdAt DESC LIMIT 5"
        );
        const formattedTickets = recentTickets.map(r => ({
            ...r, employeeId: r.employeeid, employeeName: r.employeename,
            createdAt: r.createdat, updatedAt: r.updatedat, adminNote: r.adminnote
        }));

        res.json({
            totalUsers, openTickets, inProgressTickets, resolvedTickets,
            totalAssets, assignedAssets: assigned, availableAssets: available,
            ticketsByCategory: categoryRows, ticketsByPriority: priorityRows,
            recentTickets: formattedTickets
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
