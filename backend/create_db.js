require('dotenv').config();
const { Client } = require('pg');

const run = async () => {
    const initialClient = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: 'postgres',
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    try {
        await initialClient.connect();
        const res = await initialClient.query("SELECT datname FROM pg_database WHERE datname = 'collageproject'");
        if (res.rowCount === 0) {
            console.log('Creating database "collageproject"...');
            await initialClient.query('CREATE DATABASE collageproject');
            console.log('Database "collageproject" created successfully!');
        } else {
            console.log('Database "collageproject" already exists.');
        }
    } catch (err) {
        console.error('Error creating database:', err);
        return;
    } finally {
        await initialClient.end();
    }

    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    try {
        await client.connect();

        // Drop tables to recreate with new schema
        await client.query('DROP TABLE IF EXISTS tickets CASCADE;');
        await client.query('DROP TABLE IF EXISTS assets CASCADE;');
        await client.query('DROP TABLE IF EXISTS announcements CASCADE;');
        await client.query('DROP TABLE IF EXISTS attendance CASCADE;');
        await client.query('DROP TABLE IF EXISTS leaves CASCADE;');
        await client.query('DROP TABLE IF EXISTS payrolls CASCADE;');
        await client.query('DROP TABLE IF EXISTS employees CASCADE;');

        await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) DEFAULT 'password123',
        role VARCHAR(50) NOT NULL,
        phone VARCHAR(20),
        department VARCHAR(100),
        designation VARCHAR(100),
        "joinDate" DATE DEFAULT CURRENT_DATE,
        basicPay DECIMAL NOT NULL,
        allowances DECIMAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payrolls (
        id SERIAL PRIMARY KEY,
        employeeId INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        month VARCHAR(20) NOT NULL,
        year INTEGER NOT NULL,
        basicPay DECIMAL NOT NULL,
        allowances DECIMAL NOT NULL,
        pfDeduction DECIMAL,
        esiDeduction DECIMAL,
        tdsDeduction DECIMAL,
        totalDeductions DECIMAL,
        netSalary DECIMAL NOT NULL,
        status VARCHAR(20) DEFAULT 'Generated'
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employeeId INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL,
        UNIQUE (employeeId, date)
      );

      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        employeeId INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        startDate DATE NOT NULL,
        endDate DATE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        appliedOn TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        postedBy INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        employeeId INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'Medium',
        status VARCHAR(20) DEFAULT 'Open',
        adminNote TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        assetName VARCHAR(100) NOT NULL,
        assetType VARCHAR(50) NOT NULL,
        serialNumber VARCHAR(100),
        assignedTo INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'Available',
        purchaseDate DATE,
        notes TEXT
      );
    `);

        console.log("Tables created successfully.");

        const adminEmail = process.env.ADMIN_EMAIL || 'it@test.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
        const userEmail = process.env.USER_EMAIL || 'user@test.com';
        const userPassword = process.env.USER_PASSWORD || 'password123';
        const hrEmail = process.env.HR_EMAIL || 'hr@test.com';
        const hrPassword = process.env.HR_PASSWORD || 'password123';

        const { rowCount } = await client.query("SELECT * FROM employees WHERE email = $1", [adminEmail]);
        if (rowCount === 0) {
            await client.query(`
        INSERT INTO employees (name, email, password, role, phone, department, designation, basicPay, allowances) 
        VALUES 
        ('IT Admin', $1, $2, 'Admin', '9876543210', 'IT', 'System Administrator', 80000, 15000),
        ('HR Manager', $3, $4, 'HR', '9876543211', 'Human Resources', 'HR Manager', 60000, 10000),
        ('Employee One', $5, $6, 'User', '9876543212', 'Engineering', 'Software Developer', 40000, 5000)
      `, [adminEmail, adminPassword, hrEmail, hrPassword, userEmail, userPassword]);
            console.log(`✅ IT Admin user '${adminEmail}' created.`);
            console.log(`✅ HR user '${hrEmail}' created.`);
            console.log(`✅ Employee user '${userEmail}' created.`);

            // Seed announcements
            await client.query(`
        INSERT INTO announcements (title, message, postedBy) VALUES
        ('Welcome to Smart Salary System', 'Hello team! Our new HR management system is now live. Please mark your attendance daily and apply for leaves through the portal.', 2),
        ('System Maintenance Notice', 'Scheduled maintenance on Saturday 10 PM - 2 AM. Please save your work before the window.', 1)
      `);
            console.log("✅ Sample announcements seeded.");

            // Seed sample IT tickets
            await client.query(`
        INSERT INTO tickets (employeeId, category, subject, description, priority, status) VALUES
        (3, 'Hardware', 'Laptop screen flickering', 'My laptop screen flickers when connected to external monitor. Model: Dell Latitude 5520.', 'High', 'Open'),
        (2, 'Software', 'Cannot access HRMS reports', 'Getting permission denied error when trying to export monthly reports.', 'Medium', 'Open'),
        (3, 'Network', 'WiFi keeps disconnecting', 'Office WiFi drops connection every 30 minutes. Happens on all devices.', 'Low', 'Open')
      `);
            console.log("✅ Sample IT tickets seeded.");

            // Seed sample assets
            await client.query(`
        INSERT INTO assets (assetName, assetType, serialNumber, assignedTo, status, purchaseDate, notes) VALUES
        ('Dell Latitude 5520', 'Laptop', 'DL-5520-001', 3, 'Assigned', '2025-01-15', 'Core i7, 16GB RAM, 512GB SSD'),
        ('Dell Latitude 5520', 'Laptop', 'DL-5520-002', 2, 'Assigned', '2025-01-15', 'Core i5, 8GB RAM, 256GB SSD'),
        ('HP Monitor 24"', 'Monitor', 'HP-MON-001', 3, 'Assigned', '2025-02-10', '24 inch Full HD IPS'),
        ('Apple MacBook Pro', 'Laptop', 'AMBP-M2-001', 1, 'Assigned', '2024-11-20', 'M2 Pro, 16GB RAM, 512GB'),
        ('Logitech MX Keys', 'Keyboard', 'LG-MXK-001', NULL, 'Available', '2025-03-01', 'Wireless mechanical keyboard'),
        ('HP LaserJet Pro', 'Printer', 'HP-LJ-001', NULL, 'Available', '2024-06-15', 'Department shared printer')
      `);
            console.log("✅ Sample IT assets seeded.");
        } else {
            console.log(`Admin user '${adminEmail}' already exists!`);
        }

        console.log("Initialization complete!");
    } catch (err) {
        console.error('Error initializing tables:', err);
    } finally {
        await client.end();
    }
};

run();
