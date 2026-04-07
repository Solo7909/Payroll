import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import ItDashboard from './it/ItDashboard';
import HrDashboard from './hr/HrDashboard';
import UserDashboard from './user/UserDashboard';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/it/*" element={<ItDashboard />} />
        <Route path="/hr/*" element={<HrDashboard />} />
        <Route path="/user/*" element={<UserDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
