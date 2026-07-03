'use client';

import React, { useEffect, useState } from 'react';

interface Device {
  id: string;
  name: string;
  type: 'fan' | 'light';
  room: 'drawing' | 'work1' | 'work2';
  status: 'on' | 'off';
  powerDraw: number;
  lastChanged: string;
}

interface Alert {
  type: 'after-hours' | 'stuck-on';
  room: string;
  deviceIds: string[];
  message: string;
  timestamp: string;
}

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Theme Mode: 'day' | 'night'
  const [themeMode, setThemeMode] = useState<'day' | 'night'>('day');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  // 1. SSE Stream Subscription
  useEffect(() => {
    console.log('[Dashboard] Connecting to SSE stream...');
    const eventSource = new EventSource(`${backendUrl}/api/stream`);

    eventSource.onopen = () => {
      console.log('[Dashboard] SSE Stream opened successfully.');
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setDevices(data.devices || []);
        setAlerts(data.alerts || []);
      } catch (err) {
        console.error('[Dashboard] Error parsing SSE payload:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[Dashboard] SSE Stream encountered an error:', err);
      setConnected(false);
      setError('Connection to energy server lost.');
    };

    return () => {
      console.log('[Dashboard] Closing SSE stream...');
      eventSource.close();
    };
  }, [backendUrl]);

  // 2. Day/Night Theme Auto-Detection & Body Sync
  useEffect(() => {
    // Auto-detect based on local timezone clock: 9 AM - 5 PM is Day, else Night
    const hour = new Date().getHours();
    const initialTheme = hour >= 9 && hour < 17 ? 'day' : 'night';
    setThemeMode(initialTheme);
    document.body.className = `${initialTheme}-mode`;
  }, []);

  // Sync theme mode to body whenever state changes
  const toggleThemeMode = () => {
    const nextTheme = themeMode === 'day' ? 'night' : 'day';
    setThemeMode(nextTheme);
    document.body.className = `${nextTheme}-mode`;
  };

  // Toggle helper
  const handleToggle = async (deviceId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/devices/${deviceId}/toggle`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Failed to toggle device ${deviceId}`);
      }
      const updatedDevice = await res.json();
      console.log(`[Dashboard] Manually toggled ${deviceId}:`, updatedDevice);
    } catch (err) {
      console.error('[Dashboard] Toggle failed:', err);
    }
  };

  // Compute usage aggregate locally
  const totalWatts = devices.reduce((sum, d) => sum + d.powerDraw, 0);
  const roomWatts = {
    drawing: devices.filter((d) => d.room === 'drawing').reduce((sum, d) => sum + d.powerDraw, 0),
    work1: devices.filter((d) => d.room === 'work1').reduce((sum, d) => sum + d.powerDraw, 0),
    work2: devices.filter((d) => d.room === 'work2').reduce((sum, d) => sum + d.powerDraw, 0),
  };

  // SVG Gauge Math
  // Semicircle gauge: angle goes from 180 (left) to 0 (right)
  const maxCapacity = 495; // (6 * 60) + (9 * 15)
  const fraction = Math.min(Math.max(totalWatts / maxCapacity, 0), 1);
  const needleAngle = 180 + fraction * 180; // maps to degrees [180, 360]
  const angleRad = (needleAngle * Math.PI) / 180;
  
  // Semicircle center at (50, 48), radius 34
  const cx = 50;
  const cy = 48;
  const r = 34;
  const needleX = cx + r * Math.cos(angleRad);
  const needleY = cy + r * Math.sin(angleRad);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Panel */}
      <header className="pixel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '6px' }}>
            ⚡ The Big Boss Idea
          </h1>
          <p style={{ fontFamily: 'inherit', fontSize: '1.05rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Office Energy Real-Time Monitor - Team IUT_zerowin
          </p>
        </div>
        
        {/* Settings Widget & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* Day/Night Override Switch */}
          <div 
            onClick={toggleThemeMode} 
            className="theme-switch-container"
            title={`Current: ${themeMode.toUpperCase()} Mode. Click to toggle override.`}
          >
            <span className="theme-switch-icon">
              {themeMode === 'day' ? '☀️' : '🌙'}
            </span>
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-pixel-title)', color: 'var(--text-main)', textTransform: 'uppercase' }}>
              {themeMode} mode
            </span>
          </div>

          {/* Connected Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--well-bg)', border: '2px solid var(--wood-border)', padding: '6px 12px', borderRadius: '20px' }}>
            <div 
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: connected ? 'var(--accent-teal)' : 'var(--alert-coral)',
                boxShadow: connected ? '0 0 6px var(--accent-teal)' : 'none',
              }}
            />
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-pixel-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {connected ? 'SYNCED' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid-container">
        
        {/* Left Column: Power Load Gauge & Office Layout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Total Power Load Gauge */}
          <section className="pixel-card">
            <h2 style={{ fontSize: '0.85rem', marginBottom: '16px', color: 'var(--text-main)' }}>🔌 Total Power Load</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '24px' }}>
              {/* SVG Semicircle Dial */}
              <div style={{ width: '220px', height: '140px', position: 'relative' }}>
                <svg viewBox="0 0 100 60" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  {/* Outer Semicircle Rim */}
                  <path 
                    d="M 12 48 A 38 38 0 0 1 88 48" 
                    fill="none" 
                    stroke="var(--wood-border)" 
                    strokeWidth="8"
                    strokeLinecap="square"
                  />
                  {/* Semicircle Track */}
                  <path 
                    d="M 12 48 A 38 38 0 0 1 88 48" 
                    fill="none" 
                    stroke="var(--well-bg)" 
                    strokeWidth="4"
                    strokeLinecap="square"
                  />
                  {/* Gauge Colored Filling Zone */}
                  {fraction > 0 && (
                    <path 
                      d={`M 12 48 A 38 38 0 0 1 ${cx + 38 * Math.cos(angleRad)} ${cy + 38 * Math.sin(angleRad)}`} 
                      fill="none" 
                      stroke={fraction > 0.7 ? 'var(--alert-coral)' : 'var(--accent-teal)'}
                      strokeWidth="4"
                      strokeLinecap="square"
                    />
                  )}
                  {/* Needle Center Pivot */}
                  <circle cx={cx} cy={cy} r="4" fill="var(--wood-border)" />
                  {/* Needle Line */}
                  <line 
                    x1={cx} 
                    y1={cy} 
                    x2={needleX} 
                    y2={needleY} 
                    stroke="var(--alert-coral)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                  />
                  {/* Center cover */}
                  <circle cx={cx} cy={cy} r="2" fill="#fff" />
                  
                  {/* Dial ticks */}
                  <text x="7" y="55" fontSize="6" fontFamily="var(--font-pixel-title)" fill="var(--text-main)">0W</text>
                  <text x="83" y="55" fontSize="6" fontFamily="var(--font-pixel-title)" fill="var(--text-main)">495W</text>
                  <text x="44" y="8" fontSize="6" fontFamily="var(--font-pixel-title)" fill="var(--text-main)">250W</text>
                </svg>
              </div>

              {/* Digital Watts Readout */}
              <div style={{ textAlign: 'center' }}>
                <div className="pixel-well" style={{ minWidth: '160px', padding: '12px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-pixel-title)', fontSize: '1.6rem', color: 'var(--alert-coral)', letterSpacing: '2px' }}>
                    {totalWatts}W
                  </div>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-pixel-title)', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>
                    Current Usage
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '1.05rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Max Load Capacity: {maxCapacity}W
                </div>
              </div>
            </div>
          </section>

          {/* Top-Down Office Layout */}
          <section className="pixel-card">
            <h2 style={{ fontSize: '0.85rem', marginBottom: '16px' }}>🗺️ Top-Down Office Layout</h2>
            
            {/* Rooms View */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Rooms Side-by-side */}
              <div style={{ display: 'flex', width: '100%', gap: '10px', flexWrap: 'wrap' }}>
                
                {/* 1. Drawing Room */}
                <div style={{ flex: '1 1 30%', minWidth: '220px', minHeight: '270px', position: 'relative', border: '4px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ebd9be' : '#272338', padding: '12px', borderRadius: '8px', transition: 'background-color 0.3s ease' }}>
                  <div style={{ fontFamily: 'var(--font-pixel-title)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', pointerEvents: 'none' }}>
                    Drawing Room
                  </div>
                  
                  {/* Furniture Decor */}
                  <div style={{ width: '36px', height: '110px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#a37f62' : '#3d2e25', position: 'absolute', left: '15px', top: '55px', borderRadius: '4px', boxShadow: '0 4px 0px rgba(0,0,0,0.1)' }} title="Lounge Couch" />
                  <div style={{ width: '22px', height: '38px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#86553c' : '#331d11', position: 'absolute', left: '60px', top: '90px', borderRadius: '4px', boxShadow: '0 3px 0px rgba(0,0,0,0.1)' }} title="Coffee Table" />
                  
                  {/* Devices mapping */}
                  {renderRoomSprites(devices, 'drawing', handleToggle, themeMode)}
                </div>

                {/* 2. Work Room 1 */}
                <div style={{ flex: '1 1 30%', minWidth: '220px', minHeight: '270px', position: 'relative', border: '4px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#e2d3bb' : '#202133', padding: '12px', borderRadius: '8px', transition: 'background-color 0.3s ease' }}>
                  <div style={{ fontFamily: 'var(--font-pixel-title)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', pointerEvents: 'none' }}>
                    Work Room 1
                  </div>
                  
                  {/* Desks and Chairs */}
                  <div style={{ width: '42px', height: '28px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ac9d8c' : '#3c3a4d', position: 'absolute', left: '15px', top: '55px', borderRadius: '4px' }} title="Employee Desk 1" />
                  <div style={{ width: '42px', height: '28px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ac9d8c' : '#3c3a4d', position: 'absolute', right: '15px', top: '55px', borderRadius: '4px' }} title="Employee Desk 2" />
                  <div style={{ width: '42px', height: '28px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ac9d8c' : '#3c3a4d', position: 'absolute', left: '15px', bottom: '55px', borderRadius: '4px' }} title="Employee Desk 3" />
                  <div style={{ width: '42px', height: '28px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ac9d8c' : '#3c3a4d', position: 'absolute', right: '15px', bottom: '55px', borderRadius: '4px' }} title="Employee Desk 4" />
                  
                  {/* Devices mapping */}
                  {renderRoomSprites(devices, 'work1', handleToggle, themeMode)}
                </div>

                {/* 3. Work Room 2 */}
                <div style={{ flex: '1 1 30%', minWidth: '220px', minHeight: '270px', position: 'relative', border: '4px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#e2d3bb' : '#202133', padding: '12px', borderRadius: '8px', transition: 'background-color 0.3s ease' }}>
                  <div style={{ fontFamily: 'var(--font-pixel-title)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', pointerEvents: 'none' }}>
                    Work Room 2
                  </div>
                  
                  {/* Desks and Chairs */}
                  <div style={{ width: '42px', height: '28px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ac9d8c' : '#3c3a4d', position: 'absolute', left: '15px', top: '55px', borderRadius: '4px' }} title="Employee Desk 1" />
                  <div style={{ width: '42px', height: '28px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ac9d8c' : '#3c3a4d', position: 'absolute', right: '15px', top: '55px', borderRadius: '4px' }} title="Employee Desk 2" />
                  <div style={{ width: '42px', height: '28px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ac9d8c' : '#3c3a4d', position: 'absolute', left: '15px', bottom: '55px', borderRadius: '4px' }} title="Employee Desk 3" />
                  <div style={{ width: '42px', height: '28px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#ac9d8c' : '#3c3a4d', position: 'absolute', right: '15px', bottom: '55px', borderRadius: '4px' }} title="Employee Desk 4" />
                  
                  {/* Devices mapping */}
                  {renderRoomSprites(devices, 'work2', handleToggle, themeMode)}
                </div>
              </div>

              {/* Bottom Hallway Corridor */}
              <div style={{ border: '4px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#d8c8af' : '#2f2b3f', height: '55px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', transition: 'background-color 0.3s ease' }}>
                <div style={{ position: 'absolute', bottom: '-4px', width: '44px', height: '8px', borderLeft: '4px solid var(--wood-border)', borderRight: '4px solid var(--wood-border)', backgroundColor: 'var(--primary-yellow)', borderRadius: '2px' }} />
                <span style={{ fontFamily: 'var(--font-pixel-title)', fontSize: '0.6rem', color: 'var(--text-main)', pointerEvents: 'none' }}>
                  ⬆️ OFFICE ENTRY HALLWAY ⬆️
                </span>
                
                {/* Water cooler decoration */}
                <div style={{ width: '18px', height: '30px', border: '3px solid var(--wood-border)', backgroundColor: themeMode === 'day' ? '#cbe3db' : '#4d5c66', position: 'absolute', right: '15px', top: '8px', borderRadius: '3px' }} title="Water Cooler" />
              </div>
            </div>
            
            {/* Quick Map Legend */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--primary-yellow)', fontSize: '1.3rem' }}>💡</span> Lights (Radial Glow if ON)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-teal)', fontSize: '1.3rem' }}>🌀</span> Fans (Spin &amp; Blur if ON)
              </div>
              <div style={{ fontSize: '0.95rem' }}>
                * Hover sprites for info, Click to toggle.
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Alerts, Breakdowns, switchboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Alerts Panel */}
          <section className="pixel-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '0.85rem', marginBottom: '16px' }}>⚠️ Active Anomalies</h2>
            
            <div className="pixel-well" style={{ flex: 1, minHeight: '160px', maxHeight: '250px', overflowY: 'auto' }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--accent-teal)', fontSize: '1.15rem', fontWeight: 600 }}>
                  😊 ALL ENERGY METRICS NOMINAL.<br/>NO ALERTS active!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {alerts.map((alert, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        border: '3px solid var(--wood-border)', 
                        padding: '10px 12px', 
                        backgroundColor: alert.type === 'after-hours' ? 'rgba(226, 122, 96, 0.2)' : 'rgba(244, 178, 63, 0.2)',
                        color: 'var(--text-main)',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        borderRadius: '6px'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', marginTop: '-3px' }}>
                        {alert.type === 'after-hours' ? '🚨' : '⏳'}
                      </span>
                      <div>
                        <div style={{ fontFamily: 'var(--font-pixel-title)', fontSize: '0.55rem', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--alert-coral)' }}>
                          {alert.type}
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>
                          {alert.message}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Triggered: {new Date(alert.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Room Breakdown Bars */}
          <section className="pixel-card">
            <h2 style={{ fontSize: '0.85rem', marginBottom: '16px' }}>📊 Room Breakdowns</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Drawing Room */}
              {renderRoomUsageBar('Drawing Room', roomWatts.drawing, 165)}
              {/* Work Room 1 */}
              {renderRoomUsageBar('Work Room 1', roomWatts.work1, 165)}
              {/* Work Room 2 */}
              {renderRoomUsageBar('Work Room 2', roomWatts.work2, 165)}
            </div>
          </section>

          {/* Live Device Status Panel & Switchboard */}
          <section className="pixel-card">
            <h2 style={{ fontSize: '0.85rem', marginBottom: '16px' }}>🎛️ Office Switchboard</h2>
            
            <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {['drawing', 'work1', 'work2'].map((roomKey) => {
                const roomDevices = devices.filter((d) => d.room === roomKey);
                
                return (
                  <div key={roomKey} style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '0.65rem', borderBottom: '2px solid var(--wood-border)', paddingBottom: '4px', marginBottom: '10px', color: 'var(--text-muted)' }}>
                      {getRoomDisplayName(roomKey)}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {roomDevices.map((d) => (
                        <div 
                          key={d.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '8px 10px', 
                            border: '2px solid var(--wood-border)', 
                            backgroundColor: d.status === 'on' ? 'var(--well-bg)' : 'var(--bg-panel)',
                            borderRadius: '6px',
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span 
                              style={{ 
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                border: '2px solid var(--wood-border)',
                                borderRadius: '2px',
                                backgroundColor: d.status === 'on' ? 'var(--accent-teal)' : 'var(--alert-coral)',
                                transition: 'background-color 0.2s ease'
                              }}
                            />
                            <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{d.name}</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: d.status === 'on' ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                              {d.status === 'on' ? `${d.powerDraw}W` : '0W'}
                            </span>
                            <button 
                              className={`pixel-btn ${d.status === 'on' ? 'btn-danger' : 'btn-success'}`}
                              style={{ fontSize: '0.5rem', padding: '4px 8px', borderWidth: '2px', boxShadow: '0 2px 0px var(--wood-shadow)' }}
                              onClick={() => handleToggle(d.id)}
                            >
                              {d.status === 'on' ? 'TURN OFF' : 'TURN ON'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>

      {/* Footer Info */}
      <footer style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        © {new Date().getFullYear()} The Big Boss Idea • National Hackathon MVP • Created with ❤️ by Team IUT_zerowin
      </footer>
    </div>
  );
}

// Room display name helper
function getRoomDisplayName(room: string): string {
  switch (room) {
    case 'drawing': return 'Drawing Room';
    case 'work1': return 'Work Room 1';
    case 'work2': return 'Work Room 2';
    default: return room;
  }
}

// Rendering room sprites in layout absolute placements
function renderRoomSprites(devices: Device[], roomKey: string, onToggle: (id: string) => void, themeMode: 'day' | 'night') {
  const roomDevices = devices.filter((d) => d.room === roomKey);
  
  // Coordinate positions mapping 5 devices per room
  const positions: Record<string, { top: string; left: string }> = {
    'fan-1': { top: '30px', left: '30px' },
    'fan-2': { top: '160px', left: '140px' },
    'light-1': { top: '30px', left: '140px' },
    'light-2': { top: '95px', left: '85px' },
    'light-3': { top: '160px', left: '30px' },
  };

  return roomDevices.map((d) => {
    const match = d.id.match(/(fan-\d|light-\d)$/);
    const key = match ? match[0] : '';
    const pos = positions[key] || { top: '20px', left: '20px' };

    const isOn = d.status === 'on';

    return (
      <div 
        key={d.id} 
        onClick={() => onToggle(d.id)}
        style={{
          position: 'absolute',
          top: pos.top,
          left: pos.left,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'transform 0.1s ease',
          userSelect: 'none'
        }}
        title={`${d.name} (${isOn ? d.powerDraw : 0}W) - Click to Toggle`}
      >
        <div className="glow-wrapper">
          {/* Radial ambient glow rings underneath active sprites */}
          {isOn && d.type === 'light' && <div className="glow-bleed-yellow" />}
          {isOn && d.type === 'fan' && <div className="glow-bleed-teal" />}

          {d.type === 'fan' ? (
            /* SVG FAN SPRITE */
            <svg 
              width="36" height="36" 
              viewBox="0 0 32 32"
              className={isOn ? 'animate-glow-fan' : ''}
              style={{ transition: 'filter 0.3s ease' }}
            >
              {/* Fan body ring border */}
              <circle cx="16" cy="16" r="14" fill={themeMode === 'day' ? '#a4b0be' : '#4d5566'} stroke="var(--wood-border)" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="10" fill={themeMode === 'day' ? '#ced6e0' : '#373a52'} />
              
              {/* Fan blades rotatable group */}
              <g className={isOn ? 'animate-spin-blades' : ''}>
                <circle cx="16" cy="16" r="3" fill="var(--wood-border)" />
                {/* Blades */}
                <rect x="14" y="4" width="4" height="9" fill={isOn ? 'var(--accent-teal)' : '#747d8c'} stroke="var(--wood-border)" strokeWidth="1.5" />
                <rect x="14" y="19" width="4" height="9" fill={isOn ? 'var(--accent-teal)' : '#747d8c'} stroke="var(--wood-border)" strokeWidth="1.5" />
                <rect x="4" y="14" width="9" height="4" fill={isOn ? 'var(--accent-teal)' : '#747d8c'} stroke="var(--wood-border)" strokeWidth="1.5" />
                <rect x="19" y="14" width="9" height="4" fill={isOn ? 'var(--accent-teal)' : '#747d8c'} stroke="var(--wood-border)" strokeWidth="1.5" />
              </g>
            </svg>
          ) : (
            /* SVG LIGHTBULB SPRITE */
            <svg 
              width="32" height="32" 
              viewBox="0 0 32 32"
              className={isOn ? 'animate-glow-bulb' : ''}
              style={{ transition: 'filter 0.3s ease' }}
            >
              {/* Bulb base screw thread */}
              <rect x="12" y="20" width="8" height="4" fill="#747d8c" stroke="var(--wood-border)" strokeWidth="2" />
              <rect x="14" y="24" width="4" height="2" fill="var(--wood-border)" />
              {/* Glass bulb */}
              <path 
                d="M 10 12 A 6 6 0 1 1 22 12 C 22 15, 20 18, 20 20 L 12 20 C 12 18, 10 15, 10 12 Z" 
                fill={isOn ? 'var(--primary-yellow)' : '#d2d6d9'} 
                stroke="var(--wood-border)" 
                strokeWidth="2"
              />
              {/* Filament */}
              <path d="M 14 15 L 16 12 L 18 15" fill="none" stroke={isOn ? '#ff7f50' : '#747d8c'} strokeWidth="1.5" />
            </svg>
          )}
        </div>
        
        {/* Shorthand status indicator dot */}
        <div 
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isOn ? 'var(--accent-teal)' : '#a4b0be',
            marginTop: '3px',
            border: '1px solid var(--wood-border)',
            transition: 'background-color 0.2s ease',
            zIndex: 3
          }}
        />
      </div>
    );
  });
}

// Room usage horizontal bar chart
function renderRoomUsageBar(label: string, value: number, max: number) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const color = percentage > 60 ? 'var(--alert-coral)' : 'var(--accent-teal)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', marginBottom: '4px', fontWeight: 600 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--font-pixel-title)', fontSize: '0.55rem', color: color }}>
          {value}W / {max}W
        </span>
      </div>
      <div 
        style={{
          height: '22px',
          border: '3px solid var(--wood-border)',
          backgroundColor: 'var(--well-bg)',
          borderRadius: '6px',
          overflow: 'hidden',
          boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.1)'
        }}
      >
        <div 
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: color,
            transition: 'width 0.3s ease, background-color 0.3s ease'
          }}
        />
      </div>
    </div>
  );
}
