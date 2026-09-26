'use client';

import React, { useState, useEffect } from 'react';

export default function TimeMachineBar({ currentWeek = 3 }) {
  const [data, setData] = useState({
    effectiveTime: null,
    isOverridden: false,
    presets: []
  });
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const refreshClockStatus = async () => {
    try {
      const res = await fetch(`/api/admin/time-machine?week=${currentWeek}`);
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

  useEffect(() => {
    refreshClockStatus();
  }, [currentWeek]);

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

  if (isCollapsed) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          backgroundColor: '#18181b',
          border: data.isOverridden ? '2px solid #f59e0b' : '1px solid #3f3f46',
          borderRadius: '20px',
          padding: '4px 12px',
          color: '#f4f4f5',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'monospace',
          fontSize: '11px',
          cursor: 'pointer',
        }}
        onClick={() => setIsCollapsed(false)}
      >
        <span>{data.isOverridden ? '⏳' : '🟢'}</span>
        <span style={{ color: data.isOverridden ? '#fbbf24' : '#4ade80', fontWeight: 'bold' }}>
          {data.isOverridden ? 'VIRTUAL' : 'LIVE'}: {formattedTime}
        </span>
        <span style={{ color: '#a1a1aa' }}>▲ Open</span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: '#18181b',
        border: data.isOverridden ? '2px solid #f59e0b' : '1px solid #3f3f46',
        borderRadius: '8px',
        padding: '8px 12px',
        color: '#f4f4f5',
        boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: 'monospace',
        fontSize: '12px',
        maxWidth: '96vw',
        overflowX: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
        <span>{data.isOverridden ? '⏳' : '🟢'}</span>
        <strong style={{ color: data.isOverridden ? '#fbbf24' : '#4ade80' }}>
          {data.isOverridden ? 'VIRTUAL' : 'LIVE'}:
        </strong>
        <span style={{ color: '#e4e4e7' }}>{formattedTime}</span>
      </div>

      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        {data.presets &&
          data.presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleSetTime(preset.timestamp)}
              title={preset.description}
              style={{
                backgroundColor: '#27272a',
                border: '1px solid #52525b',
                color: '#fafafa',
                padding: '4px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                whiteSpace: 'nowrap',
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
              fontSize: '10px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            Reset
          </button>
        )}

        <button
          onClick={() => setIsCollapsed(true)}
          title="Minimize time bar"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#a1a1aa',
            padding: '2px 4px',
            cursor: 'pointer',
            fontSize: '11px',
            marginLeft: '4px',
          }}
        >
          ▼
        </button>
      </div>
    </div>
  );
}