'use client';

import React, { useEffect, useState, useMemo } from 'react';

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



// ─── PIXEL ART SVG SPRITES ───────────────────────────────────────────────────

/** Top-down ceiling fan — 4 straight thick wooden blades */
function FanSprite({ isOn, size = 64 }: { isOn: boolean; size?: number }) {
  const spinStyle: React.CSSProperties = {
    transformOrigin: '22px 22px',
    animation: isOn ? 'fanSpin 0.45s linear infinite' : 'none',
  };

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{ display: 'block', filter: 'drop-shadow(0px 8px 10px rgba(0,0,0,0.5))' }}>
      {/* Intense motion-blur rings when spinning */}
      {isOn && (
        <>
          <circle cx="22" cy="22" r="21" fill="none" stroke="rgba(160,110,60,0.3)" strokeWidth="4" />
          <circle cx="22" cy="22" r="16" fill="none" stroke="rgba(160,110,60,0.2)" strokeWidth="8" />
          <circle cx="22" cy="22" r="10" fill="none" stroke="rgba(160,110,60,0.4)" strokeWidth="3" />
        </>
      )}
      <g style={spinStyle}>
        {/* Blade 1 (Top) */}
        <rect x="19" y="2" width="6" height="18" rx="2" fill="#907060" stroke="#3a2010" strokeWidth="1" />
        {/* Blade 2 (Bottom) */}
        <rect x="19" y="24" width="6" height="18" rx="2" fill="#907060" stroke="#3a2010" strokeWidth="1" />
        {/* Blade 3 (Left) */}
        <rect x="2" y="19" width="18" height="6" rx="2" fill="#c89060" stroke="#3a2010" strokeWidth="1" />
        {/* Blade 4 (Right) */}
        <rect x="24" y="19" width="18" height="6" rx="2" fill="#c89060" stroke="#3a2010" strokeWidth="1" />
        {/* Hub */}
        <circle cx="22" cy="22" r="5" fill="#2a1608" stroke="#4a2e10" strokeWidth="1.2" />
        <circle cx="22" cy="22" r="2.5" fill="#7a4820" />
      </g>
    </svg>
  );
}

/** Hanging ceiling light bulb */
function LightSprite({ isOn, size = 36 }: { isOn: boolean; size?: number }) {
  return (
    <svg width={size} height={size + 8} viewBox="0 0 36 44" style={{ overflow: 'visible', display: 'block', filter: 'drop-shadow(0px 6px 8px rgba(0,0,0,0.4))' }}>
      {/* Multi-layered intense glow aura */}
      {isOn && (
        <>
          <circle cx="18" cy="28" r="32" fill="rgba(255,215,50,0.15)" />
          <circle cx="18" cy="28" r="22" fill="rgba(255,215,50,0.25)" />
          <circle cx="18" cy="28" r="14" fill="rgba(255,230,100,0.5)" />
        </>
      )}
      <line x1="18" y1="0" x2="18" y2="10" stroke="#6a4a30" strokeWidth="2.5" />
      <rect x="14" y="9" width="8" height="6" rx="1.5" fill="#908878" stroke="#5a4030" strokeWidth="1.5" />
      <path
        d="M 9 22 A 9 9 0 1 1 27 22 C 27 26, 25 30, 25 32 L 11 32 C 11 30, 9 26, 9 22 Z"
        fill={isOn ? '#fff27a' : '#d4d0c8'}
        stroke="#5a4030"
        strokeWidth="1.8"
      />
      <rect x="11" y="32" width="14" height="4" rx="1" fill="#808070" stroke="#5a4030" strokeWidth="1.5" />
      <rect x="13" y="36" width="10" height="3" rx="1" fill="#6a6060" stroke="#5a4030" strokeWidth="1.2" />
      {isOn && (
        <path d="M 14 24 Q 15.5 20 18 23 Q 20.5 20 22 24" fill="none" stroke="#ff8800" strokeWidth="1.5" strokeLinecap="round" />
      )}
      {isOn && <ellipse cx="14.5" cy="21" rx="3" ry="2.5" fill="rgba(255,255,200,0.45)" />}
    </svg>
  );
}

/** Top-down pixel desk — chair at TOP (back), monitor at BOTTOM (front) facing the sitter */
function DeskSprite({ size = 70 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ display: 'block' }}>
      {/* ── Chair at the BACK (top) ── */}
      <rect x="13" y="6" width="34" height="7" rx="3.5" fill="#6a3a28" stroke="#3a1a10" strokeWidth="1.8" />
      <rect x="11" y="11" width="38" height="8" rx="3" fill="#5a3020" stroke="#3a1a10" strokeWidth="1.4" />

      {/* ── Desk surface ── */}
      <rect x="4" y="14" width="52" height="42" rx="3" fill="#8a7a68" stroke="#5a4030" strokeWidth="2" />
      <rect x="4" y="52" width="52" height="4" rx="1" fill="#6a5848" />

      {/* ── Monitor at the BOTTOM — screen faces UP toward the chair ── */}
      <rect x="12" y="36" width="30" height="16" rx="2" fill="#2a2838" stroke="#181828" strokeWidth="1.5" />
      <rect x="14" y="38" width="26" height="12" rx="1" fill="#2a6aaa" />
      <rect x="15" y="39" width="9" height="3" rx="0.8" fill="rgba(255,255,255,0.24)" />
      
      {/* ── Keyboard ── */}
      <rect x="15" y="28" width="24" height="5" rx="1" fill="#6a6060" stroke="#4a4040" strokeWidth="1" />
      
      {/* ── Small Plant ── */}
      <circle cx="48" cy="22" r="4" fill="#3a7a28" />
      <circle cx="48" cy="22" r="2.5" fill="#5ab44a" />
    </svg>
  );
}

/** Pixel sofa (top-down) - Faces right (backrest on left) */
function SofaSprite() {
  return (
    <svg width="50" height="140" viewBox="0 0 50 140" style={{ display: 'block' }}>
      {/* Backrest (left) */}
      <rect x="2" y="4" width="16" height="132" rx="6" fill="#7a2020" stroke="#5a1010" strokeWidth="2" />
      {/* Top Armrest */}
      <rect x="2" y="4" width="46" height="18" rx="6" fill="#922a2a" stroke="#5a1010" strokeWidth="2" />
      {/* Bottom Armrest */}
      <rect x="2" y="118" width="46" height="18" rx="6" fill="#922a2a" stroke="#5a1010" strokeWidth="2" />
      {/* Cushions */}
      <rect x="16" y="24" width="30" height="30" rx="4" fill="#ac3a3a" stroke="#7a2020" strokeWidth="2" />
      <rect x="16" y="56" width="30" height="28" rx="4" fill="#ac3a3a" stroke="#7a2020" strokeWidth="2" />
      <rect x="16" y="86" width="30" height="30" rx="4" fill="#ac3a3a" stroke="#7a2020" strokeWidth="2" />
    </svg>
  );
}

/** Small armchair (top-down) */
function ArmchairSprite() {
  return (
    <svg width="50" height="48" viewBox="0 0 50 48" style={{ display: 'block' }}>
      {/* Backrest (left) */}
      <rect x="2" y="2" width="14" height="44" rx="5" fill="#7a2020" stroke="#5a1010" strokeWidth="2" />
      {/* Top Armrest */}
      <rect x="2" y="2" width="46" height="14" rx="4" fill="#922a2a" stroke="#5a1010" strokeWidth="2" />
      {/* Bottom Armrest */}
      <rect x="2" y="32" width="46" height="14" rx="4" fill="#922a2a" stroke="#5a1010" strokeWidth="2" />
      {/* Cushion */}
      <rect x="16" y="16" width="28" height="16" rx="3" fill="#ac3a3a" stroke="#7a2020" strokeWidth="2" />
    </svg>
  );
}

/** Coffee table (top-down) */
function CoffeeTableSprite() {
  return (
    <svg width="68" height="52" viewBox="0 0 68 52" style={{ display: 'block' }}>
      <rect x="3" y="3" width="62" height="42" rx="5" fill="#c0986a" stroke="#805a28" strokeWidth="2.5" />
      <rect x="7" y="7" width="54" height="34" rx="4" fill="#d4ae80" />
      <rect x="22" y="16" width="24" height="14" rx="2" fill="#b08850" opacity="0.45" />
    </svg>
  );
}

/** Plant in pot (top-down) */
function PlantSprite({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{ display: 'block' }}>
      <ellipse cx="22" cy="36" rx="11" ry="7" fill="#a07848" stroke="#7a5820" strokeWidth="2" />
      <rect x="13" y="30" width="18" height="8" rx="3" fill="#a07848" stroke="#7a5820" strokeWidth="1.5" />
      <circle cx="22" cy="20" r="12" fill="#3a7a28" />
      <circle cx="14" cy="16" r="8" fill="#4a9a38" />
      <circle cx="30" cy="16" r="8" fill="#4a9a38" />
      <circle cx="22" cy="12" r="8" fill="#5ab44a" />
      <circle cx="22" cy="22" r="6" fill="#4a9a38" />
    </svg>
  );
}

/**
 * Vine decoration — ONLY along the outer frame borders.
 * Uses clipPath so vines can NEVER spill into the room interior.
 * The outer green border is 9px thick, so clips to 30px inset max.
 */
function VineDecoration() {
  return (
    <svg
      className="vine-overlay"
      viewBox="0 0 1060 600"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Clip to a border-only band: exclude the inner room area */}
        <clipPath id="borderClip">
          <path d="
            M 0 0 L 1060 0 L 1060 600 L 0 600 Z
            M 50 50 L 1010 50 L 1010 550 L 50 550 Z
          " fillRule="evenodd" />
        </clipPath>
      </defs>

      <g clipPath="url(#borderClip)">
        {/* ── TOP EDGE ── */}
        <path d="M 0 6 Q 180 18 350 6 Q 530 -4 700 8 Q 880 18 1060 5" fill="none" stroke="#2e6020" strokeWidth="5" strokeLinecap="round"/>
        <path d="M 0 2 Q 180 10 350 2 Q 530 -6 700 4 Q 880 12 1060 2" fill="none" stroke="#3a7828" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>

        {/* ── LEFT EDGE ── */}
        <path d="M 5 0 Q 18 150 5 300 Q -6 450 7 600" fill="none" stroke="#2e6020" strokeWidth="5" strokeLinecap="round"/>
        <path d="M 2 0 Q 12 150 2 300 Q -8 450 3 600" fill="none" stroke="#3a7828" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>

        {/* ── RIGHT EDGE ── */}
        <path d="M 1055 0 Q 1042 150 1055 300 Q 1066 450 1053 600" fill="none" stroke="#2e6020" strokeWidth="5" strokeLinecap="round"/>
        <path d="M 1058 0 Q 1048 150 1058 300 Q 1068 450 1057 600" fill="none" stroke="#3a7828" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>

        {/* ── BOTTOM EDGE ── */}
        <path d="M 0 594 Q 180 582 350 594 Q 530 604 700 592 Q 880 582 1060 595" fill="none" stroke="#2e6020" strokeWidth="5" strokeLinecap="round"/>

        {/* ── TOP-LEFT CORNER flowers & leaves ── */}
        <circle cx="14" cy="14" r="8" fill="#d880a0" /><circle cx="14" cy="14" r="4" fill="#f0a8c0" />
        <circle cx="38" cy="8" r="6" fill="#c8d860" /><circle cx="38" cy="8" r="3" fill="#e0f080" />
        <circle cx="8" cy="42" r="6" fill="#d880a0" /><circle cx="8" cy="42" r="3" fill="#f0a8c0" />
        <circle cx="8" cy="80" r="5" fill="#88c898" /><circle cx="8" cy="80" r="2.5" fill="#a8e8b0" />
        <ellipse cx="26" cy="8" rx="10" ry="5" fill="#5ab048" transform="rotate(-20 26 8)"/>
        <ellipse cx="8" cy="58" rx="8" ry="4" fill="#5ab048" transform="rotate(50 8 58)"/>

        {/* ── TOP-RIGHT CORNER flowers & leaves ── */}
        <circle cx="1046" cy="14" r="8" fill="#d880a0" /><circle cx="1046" cy="14" r="4" fill="#f0a8c0" />
        <circle cx="1022" cy="8" r="6" fill="#c8d860" /><circle cx="1022" cy="8" r="3" fill="#e0f080" />
        <circle cx="1052" cy="42" r="6" fill="#d880a0" /><circle cx="1052" cy="42" r="3" fill="#f0a8c0" />
        <circle cx="1052" cy="80" r="5" fill="#88c898" /><circle cx="1052" cy="80" r="2.5" fill="#a8e8b0" />
        <ellipse cx="1034" cy="8" rx="10" ry="5" fill="#5ab048" transform="rotate(20 1034 8)"/>
        <ellipse cx="1052" cy="58" rx="8" ry="4" fill="#5ab048" transform="rotate(-50 1052 58)"/>

        {/* ── TOP EDGE flowers (sprinkled along top wall) ── */}
        <circle cx="200" cy="10" r="5" fill="#d880a0" /><circle cx="200" cy="10" r="2.5" fill="#f0a8c0" />
        <circle cx="350" cy="6" r="5" fill="#c8d860" /><circle cx="350" cy="6" r="2.5" fill="#e0f080" />
        <circle cx="530" cy="12" r="5" fill="#d880a0" /><circle cx="530" cy="12" r="2.5" fill="#f0a8c0" />
        <circle cx="700" cy="8" r="5" fill="#88c898" /><circle cx="700" cy="8" r="2.5" fill="#a8e8b0" />
        <circle cx="880" cy="10" r="5" fill="#c8d860" /><circle cx="880" cy="10" r="2.5" fill="#e0f080" />
        <ellipse cx="440" cy="6" rx="10" ry="4" fill="#5ab048"/>
        <ellipse cx="620" cy="6" rx="10" ry="4" fill="#5ab048"/>

        {/* ── BOTTOM-LEFT CORNER ── */}
        <circle cx="14" cy="586" r="8" fill="#d880a0" /><circle cx="14" cy="586" r="4" fill="#f0a8c0" />
        <circle cx="8" cy="558" r="6" fill="#88c898" /><circle cx="8" cy="558" r="3" fill="#a8e8b0" />
        <ellipse cx="8" cy="542" rx="8" ry="4" fill="#5ab048" transform="rotate(-50 8 542)"/>

        {/* ── BOTTOM-RIGHT CORNER ── */}
        <circle cx="1046" cy="586" r="8" fill="#d880a0" /><circle cx="1046" cy="586" r="4" fill="#f0a8c0" />
        <circle cx="1052" cy="558" r="6" fill="#88c898" /><circle cx="1052" cy="558" r="3" fill="#a8e8b0" />
        <ellipse cx="1052" cy="542" rx="8" ry="4" fill="#5ab048" transform="rotate(50 1052 542)"/>

        {/* ── LEFT WALL flowers (scattered down left) ── */}
        <circle cx="8" cy="160" r="5" fill="#d880a0" /><circle cx="8" cy="160" r="2.5" fill="#f0a8c0" />
        <circle cx="6" cy="280" r="5" fill="#c8d860" /><circle cx="6" cy="280" r="2.5" fill="#e0f080" />
        <circle cx="8" cy="400" r="5" fill="#d880a0" /><circle cx="8" cy="400" r="2.5" fill="#f0a8c0" />
        <circle cx="6" cy="500" r="5" fill="#88c898" /><circle cx="6" cy="500" r="2.5" fill="#a8e8b0" />
        <ellipse cx="6" cy="220" rx="8" ry="4" fill="#5ab048" transform="rotate(60 6 220)"/>
        <ellipse cx="8" cy="460" rx="8" ry="4" fill="#5ab048" transform="rotate(-60 8 460)"/>

        {/* ── RIGHT WALL flowers (scattered down right) ── */}
        <circle cx="1052" cy="160" r="5" fill="#d880a0" /><circle cx="1052" cy="160" r="2.5" fill="#f0a8c0" />
        <circle cx="1054" cy="280" r="5" fill="#c8d860" /><circle cx="1054" cy="280" r="2.5" fill="#e0f080" />
        <circle cx="1052" cy="400" r="5" fill="#d880a0" /><circle cx="1052" cy="400" r="2.5" fill="#f0a8c0" />
        <circle cx="1054" cy="500" r="5" fill="#88c898" /><circle cx="1054" cy="500" r="2.5" fill="#a8e8b0" />
        <ellipse cx="1054" cy="220" rx="8" ry="4" fill="#5ab048" transform="rotate(-60 1054 220)"/>
        <ellipse cx="1052" cy="460" rx="8" ry="4" fill="#5ab048" transform="rotate(60 1052 460)"/>
      </g>
    </svg>
  );
}

// ─── DEVICE POSITION MAPS ─────────────────────────────────────────────────────

/**
 * Absolute pixel positions for each device inside each room.
 * Room heights: 440px. Top desks: top=56 (90px tall → bottom=146).
 * Bottom desks rotated 180°: bottom=28 → visual top at 440-28-90=322.
 * Fan1 above top desks at top=6. Fan2 between desk rows at top=193.
 * Light3 below bottom desks at bottom=10.
 */
const DEVICE_POSITIONS: Record<string, React.CSSProperties> = {
  // DRAWING ROOM — 2 fans, 3 lights (280px × 440px)
  'drawing-fan-1':   { top: 40,  left: '50%', transform: 'translateX(-50%)' }, // vertically aligned top
  'drawing-fan-2':   { top: 250, left: '50%', transform: 'translateX(-50%)' }, // vertically aligned bottom
  'drawing-light-1': { top: 14,  left: 50 },          
  'drawing-light-2': { top: 14,  right: 14 },         
  'drawing-light-3': { bottom: 18, left: 108 },       

  // WORK ROOMS — 2 fans, 3 lights each (~300px × 440px)
  // Fans are placed along the middle axis, horizontally centered with the desks
  'work1-fan-1':     { top: 100,  left: '50%', transform: 'translateX(-50%)' }, // vertically aligned with top desks
  'work1-fan-2':     { top: 280, left: '50%', transform: 'translateX(-50%)' }, // vertically aligned with bottom desks
  'work1-light-1':   { top: 10,  left: 18 },
  'work1-light-2':   { top: 10,  right: 18 },
  'work1-light-3':   { bottom: 10, left: '50%', transform: 'translateX(-50%)' },

  'work2-fan-1':     { top: 100,  left: '50%', transform: 'translateX(-50%)' },
  'work2-fan-2':     { top: 280, left: '50%', transform: 'translateX(-50%)' },
  'work2-light-1':   { top: 10,  left: 18 },
  'work2-light-2':   { top: 10,  right: 18 },
  'work2-light-3':   { bottom: 10, left: '50%', transform: 'translateX(-50%)' },
};

// ─── ROOM COMPONENTS ──────────────────────────────────────────────────────────

const renderDeviceSprite = (
  d: Device,
  pos: React.CSSProperties,
  hoveredDevice: string | null,
  handleToggle: (id: string) => void,
  setHoveredDevice: (id: string | null) => void,
  renderTooltip: (d: Device, pos: React.CSSProperties) => React.ReactNode,
  fanSize: number
) => {
  const isOn = d.status === 'on';
  return (
    <div key={d.id} className={`device-sprite ${d.type}-${isOn ? 'on' : 'off'}`} style={{ position: 'absolute', zIndex: hoveredDevice === d.id ? 50 : 20, ...pos }}
      onClick={() => handleToggle(d.id)}
      onMouseEnter={() => setHoveredDevice(d.id)}
      onMouseLeave={() => setHoveredDevice(null)}>
      {d.type === 'fan' ? <FanSprite isOn={isOn} size={fanSize} /> : <LightSprite isOn={isOn} size={34} />}
      {hoveredDevice === d.id && renderTooltip(d, pos)}
    </div>
  );
};

export const DrawingRoomContent = ({ devices, hoveredDevice, handleToggle, setHoveredDevice, renderTooltip }: any) => (
  <>
    <div className="furniture" style={{ top: 80, left: 12 }}><SofaSprite /></div>
    <div className="furniture" style={{ bottom: 60, left: 24, transform: 'rotate(-45deg)' }}><ArmchairSprite /></div>
    <div className="furniture" style={{ top: 158, left: 82 }}><CoffeeTableSprite /></div>
    <div className="furniture" style={{ top: 12, left: 12 }}><PlantSprite size={30} /></div>
    <div className="furniture" style={{ bottom: 14, right: 14 }}><PlantSprite size={46} /></div>
    {devices.map((d: any) => {
      const pos = DEVICE_POSITIONS[d.id];
      return pos ? renderDeviceSprite(d, pos, hoveredDevice, handleToggle, setHoveredDevice, renderTooltip, 90) : null;
    })}
  </>
);

export const WorkRoom1Content = ({ devices, hoveredDevice, handleToggle, setHoveredDevice, renderTooltip }: any) => (
  <>
    <div className="furniture" style={{ top: 56, left: 12 }}><DeskSprite size={90} /></div>
    <div className="furniture" style={{ top: 56, right: 12 }}><DeskSprite size={90} /></div>
    <div className="furniture" style={{ bottom: 28, left: 12 }}><DeskSprite size={90} /></div>
    <div className="furniture" style={{ bottom: 28, right: 12 }}><DeskSprite size={90} /></div>
    {devices.map((d: any) => {
      const pos = DEVICE_POSITIONS[d.id];
      return pos ? renderDeviceSprite(d, pos, hoveredDevice, handleToggle, setHoveredDevice, renderTooltip, 100) : null;
    })}
  </>
);

export const WorkRoom2Content = ({ devices, hoveredDevice, handleToggle, setHoveredDevice, renderTooltip }: any) => (
  <>
    <div className="furniture" style={{ top: 56, left: 12 }}><DeskSprite size={90} /></div>
    <div className="furniture" style={{ top: 56, right: 12 }}><DeskSprite size={90} /></div>
    <div className="furniture" style={{ bottom: 28, left: 12 }}><DeskSprite size={90} /></div>
    <div className="furniture" style={{ bottom: 28, right: 12 }}><DeskSprite size={90} /></div>
    <div className="furniture" style={{ bottom: 130, right: 14 }}><PlantSprite size={42} /></div>
    {devices.map((d: any) => {
      const pos = DEVICE_POSITIONS[d.id];
      return pos ? renderDeviceSprite(d, pos, hoveredDevice, handleToggle, setHoveredDevice, renderTooltip, 100) : null;
    })}
  </>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [alerts, setAlerts]     = useState<Alert[]>([]);
  const [now, setNow]           = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null);
  const [currentMiniRoom, setCurrentMiniRoom] = useState(0);
  const [history, setHistory] = useState<{ time: Date, power: number }[]>([]);
  const [isNightMode, setIsNightMode] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // Apply night mode to body
  useEffect(() => {
    if (isNightMode) {
      document.body.classList.add('night-mode');
    } else {
      document.body.classList.remove('night-mode');
    }
  }, [isNightMode]);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5005';

  // Live clock — only starts on client to prevent SSR hydration mismatch
  useEffect(() => {
    const d = new Date();
    setNow(d);
    
    // Auto-detect based on local timezone clock: 9 AM - 5 PM is Day, else Night
    const hour = d.getHours();
    if (hour < 9 || hour >= 17) {
      setIsNightMode(true);
    }
    
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);


  // SSE stream
  useEffect(() => {
    const es = new EventSource(`${backendUrl}/api/stream`);
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        const newDevices = d.devices || [];
        setDevices(newDevices);
        setAlerts(d.alerts || []);

        const watts = newDevices.reduce((s: number, dev: any) => s + dev.powerDraw, 0);
        setHistory(prev => {
          const next = [...prev, { time: new Date(), power: watts }];
          return next.slice(-120); // Keep last 120 data points
        });
      } catch (_) {}
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [backendUrl]);

  // Toggle device
  const handleToggle = async (id: string) => {
    // Optimistic local update so UI feels alive even if backend is offline
    setDevices(prev => prev.map(d => {
      if (d.id !== id) return d;
      return { ...d, status: d.status === 'on' ? 'off' : 'on', lastChanged: new Date().toISOString() };
    }));

    if (connected) {
      try {
        await fetch(`${backendUrl}/api/devices/${id}/toggle`, { method: 'POST' });
      } catch (_) {}
    }
  };

  // Power totals
  const totalWatts = devices.reduce((s, d) => s + d.powerDraw, 0);
  const roomWatts = {
    drawing: devices.filter(d => d.room === 'drawing').reduce((s, d) => s + d.powerDraw, 0),
    work1:   devices.filter(d => d.room === 'work1').reduce((s, d) => s + d.powerDraw, 0),
    work2:   devices.filter(d => d.room === 'work2').reduce((s, d) => s + d.powerDraw, 0),
  };

  // Gauge needle — rounded to 2dp to prevent SSR/client float mismatch
  const maxWatts = 495;
  const fraction = Math.min(Math.max(totalWatts / maxWatts, 0), 1);
  const needleDeg = 180 + fraction * 180;
  const needleRad = (needleDeg * Math.PI) / 180;
  const gCx = 100, gCy = 100, gR = 74;
  const nx = parseFloat((gCx + gR * Math.cos(needleRad)).toFixed(2));
  const ny = parseFloat((gCy + gR * Math.sin(needleRad)).toFixed(2));

  // DateTime format
  const dateStr = now ? now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : '';
  const timeStr = now ? now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';

  const byRoom = (room: 'drawing' | 'work1' | 'work2') =>
    devices.filter(d => d.room === room);

  const renderTooltip = (d: Device, pos: React.CSSProperties) => {
    const timeStr = d.lastChanged 
      ? new Date(d.lastChanged).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) 
      : 'Unknown';
    const action = d.status === 'on' ? 'Turned ON' : 'Turned OFF';
    const isTop = pos.top !== undefined && typeof pos.top === 'number' && pos.top < 120;
    
    return (
      <div className={`custom-tooltip ${isTop ? 'tooltip-bottom' : ''}`}>
        <div className="tooltip-title">{d.name.replace(/Drawing Room |Work Room 1 |Work Room 2 /gi, '')}</div>
        <div className="tooltip-line"><strong>Status:</strong> <span style={{ color: d.status === 'on' ? '#3a7a3a' : '#a05050' }}>{d.status.toUpperCase()}</span></div>
        <div className="tooltip-line"><strong>Power:</strong> {d.powerDraw}W</div>
        <div className="tooltip-line"><strong>{action}:</strong> {timeStr}</div>
      </div>
    );
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="page-wrapper">

      {/* 1. PAGE HEADER */}
      <div className="page-header">
        <h1 className="project-title" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
          <span>OFFICE POWER USAGE</span>
          <button className="theme-toggle-btn" onClick={() => setIsNightMode(!isNightMode)} style={{ 
            fontFamily: "'Press Start 2P', monospace", 
            fontSize: '0.95rem', 
            width: '28px',
            height: '28px',
            padding: 0,
            cursor: 'pointer',
            backgroundColor: isNightMode ? '#18192a' : '#c0b0a0',
            color: isNightMode ? '#e0e0e0' : '#2a2a2a',
            border: '2px solid #5c4033',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isNightMode ? '☾' : '☀'}
          </button>
        </h1>
        <div className="datetime-box-small">
          <span className="datetime-text-small">
            {now ? `${dateStr} – ${timeStr}` : '—'}
          </span>
        </div>
      </div>

      {/* 2. MAIN CONTENT: MAP + SIDEBAR */}
      <div className="main-content">
        <div className="dashboard-top-row">
          {/* ── OFFICE FLOOR MAP ── */}
          <div className="office-map-wrapper">
            <div className="office-map-frame">

              <VineDecoration />

              <div className="rooms-container">

                {/* ── DRAWING ROOM ── */}
                <div className="room drawing-room">
                  <DrawingRoomContent devices={byRoom('drawing')} hoveredDevice={hoveredDevice} handleToggle={handleToggle} setHoveredDevice={setHoveredDevice} renderTooltip={renderTooltip} />
                </div>

                <div className="room-wall" />

                {/* ── WORK ROOM 1 ── */}
                <div className="room work-room-1">
                  <WorkRoom1Content devices={byRoom('work1')} hoveredDevice={hoveredDevice} handleToggle={handleToggle} setHoveredDevice={setHoveredDevice} renderTooltip={renderTooltip} />
                </div>

                <div className="room-wall" />

                {/* ── WORK ROOM 2 ── */}
                <div className="room work-room-2">
                  <WorkRoom2Content devices={byRoom('work2')} hoveredDevice={hoveredDevice} handleToggle={handleToggle} setHoveredDevice={setHoveredDevice} renderTooltip={renderTooltip} />
                </div>
              </div>

              {/* Corridor */}
              <div className="corridor">
                <PlantSprite size={52} />
                <PlantSprite size={40} />
              </div>
            </div>
          </div>

          {/* ── SIDEBAR COLUMN ── */}
          <div className="sidebar-column">
            
            {/* POWER CONSUMPTION BOX */}
            <div className="sidebar-box power-box">
              <div className="sidebar-header">LIVE POWER CONSUMPTION</div>
              <div className="power-section">

              <div className="gauge-container">
                <svg className="gauge-svg" viewBox="0 0 200 118" style={{ overflow: 'visible' }}>
                  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e0d8d0" strokeWidth="22" strokeLinecap="round" />
                  <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#6ab0d8" strokeWidth="22" strokeLinecap="butt" />
                  <path d="M 100 20 A 80 80 0 0 1 180 100" fill="none" stroke="#c84040" strokeWidth="22" strokeLinecap="butt" />
                  <circle cx="100" cy="100" r="58" className="gauge-center-bg" />
                  <text x="100" y="97" textAnchor="middle" dominantBaseline="middle"
                    fontFamily="'Press Start 2P', monospace" fontSize="19" fontWeight="bold" className="gauge-center-text">
                    {totalWatts}W
                  </text>
                  <line x1="100" y1="100" x2={nx} y2={ny} strokeWidth="3" strokeLinecap="round" className="gauge-needle" />
                  <circle cx="100" cy="100" r="5" className="gauge-needle-center" />
                </svg>
              </div>

              <div className="room-power-breakdown">
                <div>Drawing Room: <strong>{roomWatts.drawing}W</strong></div>
                <div>Work Room 1: <strong>{roomWatts.work1}W</strong></div>
                <div>Work Room 2: <strong>{roomWatts.work2}W</strong></div>
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '2px dashed var(--dashed-border, #c0b0a0)' }}>
                  Today's Usage: <strong>4,520W</strong>
                </div>
              </div>
            </div>
          </div>

            {/* ALERTS BOX */}
            <div className={`sidebar-box alerts-box ${alerts.length === 0 ? 'alerts-empty' : ''}`}>
              <div className="alerts-header-bar">ALERTS</div>
              <div className="alerts-list">
                {alerts.length === 0 ? (
                  <div className="no-alerts">✅ No active alerts</div>
                ) : (
                  <>
                    {alerts.slice(0, showAllAlerts ? undefined : 2).map((alert, i) => {
                      const ts = new Date(alert.timestamp);
                      const t = ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                      const isStuck = alert.type === 'stuck-on';
                      return (
                        <div key={i} className="alert-item">
                          <div className="alert-header">
                            <span className="alert-time">{t}</span>
                            <span className={`alert-badge ${isStuck ? 'badge-stuck' : 'badge-after'}`}>
                              {isStuck ? 'STUCK ON' : 'AFTER HOURS'}
                            </span>
                          </div>
                          <div className="alert-message">{alert.message}</div>
                        </div>
                      );
                    })}
                    {alerts.length > 2 && (
                      <button className="show-more-alerts-btn" onClick={() => setShowAllAlerts(!showAllAlerts)}>
                        {showAllAlerts ? 'SHOW LESS ▲' : 'SHOW MORE ▼'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-bottom-row">
          {/* 3. LIVE DEVICE STATUS BAR */}
          <div className="device-status-section">
            <div className="device-status-title">LIVE DEVICE STATUS</div>
            <div className="device-status-cards">
              <DeviceCard label="Drawing Room:" cls="drawing-card" devices={byRoom('drawing')} />
              <DeviceCard label="Work Room 1:"  cls="work1-card"   devices={byRoom('work1')} />
              <DeviceCard label="Work Room 2:"  cls="work2-card"   devices={byRoom('work2')} />
            </div>
          </div>

          <div className="mini-map-carousel">
            <div className="carousel-header">
              <button className="carousel-btn" onClick={() => setCurrentMiniRoom(p => (p + 2) % 3)}>◄</button>
              <div className="carousel-title">{['Drawing Room', 'Work Room 1', 'Work Room 2'][currentMiniRoom]}</div>
              <button className="carousel-btn" onClick={() => setCurrentMiniRoom(p => (p + 1) % 3)}>►</button>
            </div>
            <div className="carousel-body">
              <div className="carousel-viewport">
              {currentMiniRoom === 0 && (
                <div className="mini-room-scale drawing-room">
                  <DrawingRoomContent devices={byRoom('drawing')} hoveredDevice={hoveredDevice} handleToggle={handleToggle} setHoveredDevice={setHoveredDevice} renderTooltip={renderTooltip} />
                </div>
              )}
              {currentMiniRoom === 1 && (
                <div className="mini-room-scale work-room-1">
                  <WorkRoom1Content devices={byRoom('work1')} hoveredDevice={hoveredDevice} handleToggle={handleToggle} setHoveredDevice={setHoveredDevice} renderTooltip={renderTooltip} />
                </div>
              )}
              {currentMiniRoom === 2 && (
                <div className="mini-room-scale work-room-2">
                  <WorkRoom2Content devices={byRoom('work2')} hoveredDevice={hoveredDevice} handleToggle={handleToggle} setHoveredDevice={setHoveredDevice} renderTooltip={renderTooltip} />
                </div>
              )}
            </div>

            <div className="carousel-summary">
              <div className="summary-power">
                TOTAL: <span className="summary-watts">{roomWatts[['drawing', 'work1', 'work2'][currentMiniRoom] as keyof typeof roomWatts]}W</span>
              </div>
              <div className="summary-devices-title">ACTIVE DEVICES</div>
              <div className="summary-devices-list">
                {byRoom(['drawing', 'work1', 'work2'][currentMiniRoom] as 'drawing' | 'work1' | 'work2')
                  .filter(d => d.status === 'on')
                  .map(d => (
                    <div key={d.id} className="summary-device-item">• {d.name.replace(/Drawing Room |Work Room 1 |Work Room 2 /gi, '')}</div>
                  ))}
                {byRoom(['drawing', 'work1', 'work2'][currentMiniRoom] as 'drawing' | 'work1' | 'work2').filter(d => d.status === 'on').length === 0 && (
                  <div className="summary-empty">No active devices</div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div> {/* END main-content */}

      <div className="analytics-bottom-panel">
        <AnalyticsGraph data={history} />
      </div>

    </div>
  );
}

// ─── ANALYTICS GRAPH COMPONENT ───────────────────────────────────────────────

function AnalyticsGraph({ data: liveData }: { data: { time: Date, power: number }[] }) {
  const [range, setRange] = useState<'live' | 'day' | 'month' | 'year'>('live');

  const data = useMemo(() => {
    if (range === 'live') return liveData;
    
    const points = range === 'day' ? 24 : range === 'month' ? 30 : 12;
    const now = new Date();
    const generated = [];
    let basePower = 300;
    
    for (let i = points; i >= 0; i--) {
      const d = new Date(now);
      if (range === 'day') {
        d.setHours(d.getHours() - i);
      } else if (range === 'month') {
        d.setDate(d.getDate() - i);
      } else if (range === 'year') {
        d.setMonth(d.getMonth() - i);
      }
      
      // Predictable pseudo-random walk based on index and range to ensure hydration safety
      const factor = range === 'day' ? 1.5 : range === 'month' ? 0.4 : 0.8;
      basePower += (Math.sin(i * factor) * 80) + (Math.cos(i * factor * 0.5) * 50);
      if (basePower < 100) basePower = 100 + Math.abs(basePower);
      if (basePower > 700) basePower = 700 - (basePower - 700);
      
      generated.push({ time: d, power: Math.round(basePower) });
    }
    return generated;
  }, [range, liveData]);
  const width = 1000;
  const height = 240;
  const padding = 60;

  if (data.length === 0) {
    return (
      <div className="analytics-graph-container">
        <div className="analytics-graph-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{range === 'live' ? 'LIVE POWER TREND' : 'HISTORICAL POWER TREND'}</span>
        </div>
        <div className="no-data">WAITING FOR DATA...</div>
      </div>
    );
  }

  // Give it a fixed minimum headroom (e.g. 100W above the max) so it doesn't feel zoomed in
  const maxPower = Math.max(400, ...data.map(d => d.power)) + 120; 
  
  const parsedPoints = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2);
    const y = (height - padding) - (d.power / maxPower) * (height - padding * 2);
    return { x, y };
  });

  let pathD = `M ${parsedPoints[0].x} ${parsedPoints[0].y}`;
  for (let i = 1; i < parsedPoints.length; i++) {
    const p0 = parsedPoints[i - 1];
    const p1 = parsedPoints[i];
    const cx = (p0.x + p1.x) / 2;
    pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const areaD = `${pathD} L ${parsedPoints[parsedPoints.length - 1].x} ${height - padding} L ${parsedPoints[0].x} ${height - padding} Z`;

  const yLabels = [0, Math.round(maxPower / 2), Math.round(maxPower)];

  return (
    <div className="analytics-graph-container">
      <div className="analytics-graph-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{range === 'live' ? 'LIVE POWER TREND (W)' : 'HISTORICAL POWER TREND (W)'}</span>
        <div className="graph-range-toggles" style={{ display: 'flex', gap: '8px' }}>
          {['live', 'day', 'month', 'year'].map(r => (
            <button key={r} onClick={() => setRange(r as any)} className={`range-btn ${range === r ? 'active' : ''}`}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="svg-wrapper">
        <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="chart-gradient-top" />
              <stop offset="100%" className="chart-gradient-bottom" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {yLabels.map((val, i) => {
            const y = (height - padding) - (val / maxPower) * (height - padding * 2);
            return (
              <g key={`y-${i}`}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#c0b0a0" strokeDasharray="6 6" strokeWidth="2" className="axis-line" />
                <text x={padding - 15} y={y} fontSize="14" fontFamily="'Press Start 2P', monospace" textAnchor="end" dominantBaseline="middle" className="axis-label">
                  {val}
                </text>
              </g>
            );
          })}
          
          {/* X-axis labels */}
          {Array.from({ length: 5 }).map((_, i) => {
            const dataIndex = Math.floor(i * (data.length - 1) / 4);
            const d = data[dataIndex];
            const x = parsedPoints[dataIndex].x;
            
            let dateStr = '';
            let timeStr = '';
            
            if (range === 'live' || range === 'day') {
              dateStr = d.time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              timeStr = d.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            } else if (range === 'month') {
              dateStr = d.time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else if (range === 'year') {
              dateStr = d.time.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }

            return (
              <g key={`x-${i}`}>
                <line x1={x} y1={height - padding} x2={x} y2={height - padding + 8} strokeWidth="2" className="axis-line" />
                <text x={x} y={height - padding + 26} fontSize="10" fontFamily="'Press Start 2P', monospace" textAnchor="middle" className="axis-label">
                  {dateStr}
                </text>
                {timeStr && (
                  <text x={x} y={height - padding + 42} fontSize="10" fontFamily="'Press Start 2P', monospace" textAnchor="middle" className="axis-label">
                    {timeStr}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Filled Area */}
          <path d={areaD} fill="url(#powerGradient)" />
          
          {/* Smooth Line */}
          <path d={pathD} fill="none" className="chart-line" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
}

// ─── DEVICE STATUS CARD ───────────────────────────────────────────────────────

function DeviceCard({ label, cls, devices }: { label: string; cls: string; devices: Device[] }) {
  const fans = devices.filter(d => d.type === 'fan');
  const lights = devices.filter(d => d.type === 'light');

  const renderRow = (d: Device) => {
    const isOn = d.status === 'on';
    const timeStr = d.lastChanged 
      ? new Date(d.lastChanged).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) 
      : '--:--';
    return (
      <div key={d.id} className="device-row">
        <span style={{ fontSize: '0.74rem', fontWeight: 600, width: '60px' }}>{d.name.replace(/Drawing Room |Work Room 1 |Work Room 2 /gi, '')}</span>
        <span className={isOn ? 'status-on' : 'status-off'} style={{ width: '30px' }}>{isOn ? 'On' : 'Off'}</span>
        <span className="device-time" style={{ fontSize: '0.74rem', marginLeft: 'auto' }}>[{timeStr}]</span>
      </div>
    );
  };

  return (
    <div className={`device-card ${cls}`}>
      <div className="device-card-header">{label}</div>
      <div className="device-card-body">
        {fans.length > 0 && (
          <div className="device-group-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>
            <span>Fans</span>
            <span style={{ fontSize: '0.55rem', opacity: 0.7, fontWeight: 'normal', letterSpacing: '0.5px' }}>Last changed</span>
          </div>
        )}
        {fans.map(renderRow)}
        
        {lights.length > 0 && (
          <div className="device-group-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.65rem', fontWeight: 800, marginTop: '8px', textTransform: 'uppercase' }}>
            <span>Lights</span>
            <span style={{ fontSize: '0.55rem', opacity: 0.7, fontWeight: 'normal', letterSpacing: '0.5px' }}>Last changed</span>
          </div>
        )}
        {lights.map(renderRow)}

        {devices.length === 0 && (
          <span className="device-empty-label" style={{ fontSize: '0.7rem', padding: '8px 0' }}>No devices</span>
        )}
      </div>
    </div>
  );
}
