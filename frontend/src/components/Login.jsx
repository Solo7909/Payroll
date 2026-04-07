import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const API_URL = "https://payroll-backend-yg7n.onrender.com";
    const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
        const API_URL = import.meta.env.VITE_API_URL;

        alert("API URL: " + API_URL); // 👈 SHOWS if env works

        const res = await axios.post(`${API_URL}/api/login`, {
            email,
            password
        });

        alert("Response: " + JSON.stringify(res.data)); // 👈 SHOWS backend response

        if (res.data.success) {
            const user = res.data.user;
            localStorage.setItem('user', JSON.stringify(user));

            if (user.role === 'Admin') navigate('/it');
            else if (user.role === 'HR') navigate('/hr');
            else navigate('/user');
        } else {
            setError('Invalid credentials');
        }

    } catch (err) {
        alert("ERROR: " + err); // 👈 CRITICAL
        console.log(err);
        setError('Login failed');
    }
};

    return (
        <div className="auth-container">
            <div className="card">
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Smart Salary System</h2>
                <form onSubmit={handleLogin}>
                    {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="e.g. hr@test.com"
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            placeholder="password123"
                        />
                    </div>
                    <button type="submit" className="btn-primary">Sign In</button>
                </form>
                <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Test accounts:<br /> it@test.com, hr@test.com, user@test.com<br />
                    (Password: password123)
                </p>
            </div>
        </div>
    );
}
