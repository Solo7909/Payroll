import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const API_URL = import.meta.env.VITE_API_URL;

            const res = await axios.post(`${API_URL}/api/login`, {
                email,
                password
            });

            if (res.data.success) {
                const user = res.data.user;
                localStorage.setItem('user', JSON.stringify(user));

                if (user.role === 'Admin') {
                    navigate('/it');
                } else if (user.role === 'HR') {
                    navigate('/hr');
                } else {
                    navigate('/user');
                }
            } else {
                setError('Invalid credentials');
            }

        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check credentials.');
        }
    };

    return (
        <div className="auth-container">
            <div className="card">
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    Smart Salary System
                </h2>

                <form onSubmit={handleLogin}>
                    {error && (
                        <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}

                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Email"
                        required
                    />

                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                    />

                    <button type="submit">Login</button>
                </form>
            </div>
        </div>
    );
}
