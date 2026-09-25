'use client';

import React, { useState, useEffect } from 'react';

export default function TimeMachineBar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState({
    effectiveTime: null,
    isOverridden: false,
    presets: []
  });
  const [loading, setLoading] = useState(true);

  // Check admin status from local storage
  const checkAdminStatus = () => {
    try {
      const stored = localStorage.getItem('nfl_pickem_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        // User is admin if explicitly flagged OR is the master user_1 / Ryan
        const adminCheck = Boolean(
          parsed.isAdmin === true || 
          parsed.id === 'user_1' || 
          parsed.name?.toLowerCase() === 'ryan'
        );
        setIsAdmin(adminCheck);
        return adminCheck;
      }
    } catch (e) {
      console.error('Failed to parse admin session for time machine:', e);
    }
    setIsAdmin(false);
    return false;
  };

  useEffect(() => {
    const hasAdmin = checkAdminStatus();
    if (hasAdmin) {
      refreshClockStatus();
    } else {
      setLoading(false);
    }

    // Re-check if login/logout happens
    const handleStorageChange = () => {
      const currentlyAdmin = checkAdminStatus();
      if (currentlyAdmin) refreshClockStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const refreshClockStatus = async () => {
    try {
      const res = await fetch('/api/admin/time-machine');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load virtual clock status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetTime = async (timestamp) => {
    setLoading(true);
    try {
      await fetch('/api/admin/time-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp }),
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to update virtual clock:', err);
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/time-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset virtual clock:', err);
      setLoading(false);
    }
  };

  // Strictly block rendering if not an admin
  if (!isAdmin) {
    return null;
  }

  if (loading && !data.effectiveTime) {
    return null;
  }

  const formattedTime = data.effectiveTime
    ? new Date(data.effectiveTime).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : '';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: '#18181b',
        border: data.isOverridden ? '2px solid #f59e0b' : '1px solid #3f3f46',
        borderRadius: '8px',
        padding: '10px 16px',
        color: '#f4f4f5',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'monospace',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>{data.isOverridden ? '⏳' : '🟢'}</span>
        <strong style={{ color: data.isOverridden ? '#fbbf24' : '#4ade80' }}>
          {data.isOverridden ? 'VIRTUAL CLOCK' : 'SYSTEM CLOCK'}:
        </strong>
        <span>{formattedTime}</span>
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {data.presets && data.presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handleSetTime(preset.timestamp)}
            title={preset.description}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #52525b',
              color: '#fafafa',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            {preset.label}
          </button>
        ))}

        {data.isOverridden && (
          <button
            onClick={handleReset}
            style={{
              backgroundColor: '#7f1d1d',
              border: '1px solid #ef4444',
              color: '#fee2e2',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}