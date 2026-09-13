/**
 * Clean, lightweight SVG icons for the VisioSpace toolbar.
 * All icons are 24x24 with consistent 1.5px stroke weight.
 */

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const IconCursor = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>
  </svg>
);

export const IconStickyNote = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z"/>
    <polyline points="14 3 14 9 21 9"/>
  </svg>
);

export const IconLink = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
);

export const IconGroup = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);

export const IconHand = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 00-4 0v1"/>
    <path d="M14 10V4a2 2 0 00-4 0v6"/>
    <path d="M10 10.5V6a2 2 0 00-4 0v8"/>
    <path d="M18 8a2 2 0 014 0v7a8 8 0 01-8 8h-2c-2.5 0-4.5-1-6.2-2.8L3.4 17a2 2 0 012.8-2.8L8 16"/>
  </svg>
);

export const IconZoomIn = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="11" y1="8" x2="11" y2="14"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);

export const IconZoomOut = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);

export const IconZoomFit = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6"/>
    <path d="M9 21H3v-6"/>
    <path d="M21 3l-7 7"/>
    <path d="M3 21l7-7"/>
  </svg>
);

export const IconUndo = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
  </svg>
);

export const IconRedo = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 11-2.13-9.36L23 10"/>
  </svg>
);

export const IconExport = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

export const IconImport = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export const IconImage = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

export const IconTrash = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
  </svg>
);

export const IconEdit = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

export const IconCopy = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

export const IconPalette = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="2"/>
    <circle cx="17.5" cy="10.5" r="2"/>
    <circle cx="8.5" cy="7.5" r="2"/>
    <circle cx="6.5" cy="12.5" r="2"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.5 0-.4-.15-.75-.38-1.02-.22-.26-.37-.6-.37-.98 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-9-10-9z"/>
  </svg>
);

export const IconBringToFront = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="8" height="8" rx="1"/>
    <rect x="14" y="14" width="8" height="8" rx="1" fill={color} fillOpacity="0.15"/>
    <rect x="8" y="8" width="8" height="8" rx="1"/>
  </svg>
);

export const IconText = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);

export const IconVoteDot = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill={color} stroke="none" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
  </svg>
);

export const IconUnlink = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.84 12.25l1.72-1.71a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M5.16 11.75l-1.72 1.71a5 5 0 007.07 7.07l1.72-1.71"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
);

// ─── Shape Tool & Geometry Icons ─────────────────────────────────────
export const IconShape = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="11" height="11" rx="1.5" />
    <circle cx="15.5" cy="15.5" r="5.5" stroke={color} />
  </svg>
);

export const IconRectangle = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
  </svg>
);

export const IconCircle = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
  </svg>
);

export const IconTriangle = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3L21 19H3L12 3Z" />
  </svg>
);

export const IconDiamond = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L22 12L12 22L2 12Z" />
  </svg>
);

export const IconStar = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const IconHexagon = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L21 7.2V16.8L12 22L3 16.8V7.2Z" />
  </svg>
);

// ─── Template & Sensemaking Icons ─────────────────────────────────────

/** Toolbar icon: pinboard/corkboard with push-pins */
export const IconTemplate = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Corkboard frame */}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    {/* Push-pin head (top-left card) */}
    <circle cx="8" cy="7" r="1.2" fill={color} stroke="none" />
    {/* Card 1 */}
    <rect x="5.5" y="8" width="5.5" height="4" rx="0.5" />
    {/* Push-pin head (top-right card) */}
    <circle cx="16" cy="7" r="1.2" fill={color} stroke="none" />
    {/* Card 2 */}
    <rect x="13" y="8" width="5.5" height="4" rx="0.5" />
    {/* Yarn string connecting cards */}
    <path d="M11 10Q12 14 13 10" strokeDasharray="1.5 1" />
    {/* Bottom label strip */}
    <line x1="6" y1="16" x2="18" y2="16" />
    <line x1="6" y1="18.5" x2="14" y2="18.5" />
  </svg>
);

/** Minimal line-art pushpin / tack icon matching VisioSpace aesthetic */
export const IconPushpin = ({ size = 36, color = '#a3312b', className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Metal pin needle */}
    <line
      x1="12"
      y1="16"
      x2="12"
      y2="22"
      stroke="#736657"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Pushpin head — flat 2D editorial geometry */}
    <path
      d="M5 16h14v-1.76a2 2 0 0 0-1.11-1.79l-1.79-.9A2 2 0 0 1 15 9.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v3.76a2 2 0 0 1-1.1 1.79l-1.79.9A2 2 0 0 0 5 14.24Z"
      fill={color}
      stroke={color}
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

/** Investigative Sensemaking Web — magnifying glass over a web/thread */
export const IconInvestigate = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Magnifying glass */}
    <circle cx="10.5" cy="10.5" r="6.5" />
    <line x1="15.1" y1="15.1" x2="21" y2="21" />
    {/* Evidence threads inside lens */}
    <circle cx="8" cy="9" r="1" fill={color} stroke="none" />
    <circle cx="13" cy="8.5" r="1" fill={color} stroke="none" />
    <circle cx="10" cy="13" r="1" fill={color} stroke="none" />
    <line x1="8.7" y1="9.5" x2="9.5" y2="12.3" />
    <line x1="10.7" y1="12.5" x2="12.5" y2="9.2" />
  </svg>
);

/** UX Research Affinity Map — speech bubble with affinity dots */
export const IconAffinityMap = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Speech bubble / card cluster */}
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    {/* Affinity sticky squares */}
    <rect x="7" y="7" width="3.5" height="3" rx="0.5" fill={color} fillOpacity="0.15" />
    <rect x="12" y="7" width="3.5" height="3" rx="0.5" fill={color} fillOpacity="0.15" />
    <rect x="9.5" y="11.5" width="3.5" height="3" rx="0.5" fill={color} fillOpacity="0.15" />
  </svg>
);

/** Root Cause & 5 Whys — branching tree */
export const IconRootCause = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Trunk */}
    <line x1="12" y1="3" x2="12" y2="13" />
    {/* Branch left */}
    <line x1="12" y1="8" x2="6" y2="13" />
    {/* Branch right */}
    <line x1="12" y1="8" x2="18" y2="13" />
    {/* Root tendrils */}
    <line x1="12" y1="13" x2="9" y2="18" />
    <line x1="12" y1="13" x2="15" y2="18" />
    <line x1="6" y1="13" x2="4" y2="18" />
    <line x1="18" y1="13" x2="20" y2="18" />
    {/* Node dots */}
    <circle cx="12" cy="3" r="1.3" fill={color} stroke="none" />
    <circle cx="6" cy="13" r="1.3" fill={color} stroke="none" />
    <circle cx="18" cy="13" r="1.3" fill={color} stroke="none" />
    <circle cx="12" cy="13" r="1.3" fill={color} stroke="none" />
    <circle cx="9" cy="18" r="1.3" fill={color} stroke="none" />
    <circle cx="15" cy="18" r="1.3" fill={color} stroke="none" />
    <circle cx="4" cy="18" r="1.3" fill={color} stroke="none" />
    <circle cx="20" cy="18" r="1.3" fill={color} stroke="none" />
  </svg>
);

/** SWOT Strategy — 4-quadrant target/crosshair */
export const IconSwotMatrix = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Outer frame */}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    {/* Cross dividers */}
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="3" y1="12" x2="21" y2="12" />
    {/* Quadrant indicators */}
    <circle cx="7.5" cy="7.5" r="1.2" fill={color} stroke="none" />
    <circle cx="16.5" cy="7.5" r="1.2" fill={color} stroke="none" />
    <circle cx="7.5" cy="16.5" r="1.2" fill={color} stroke="none" />
    <circle cx="16.5" cy="16.5" r="1.2" fill={color} stroke="none" />
  </svg>
);

// ─── Minimap / Radar Icons ────────────────────────────────────────────

/** Radar sweep — concentric arcs with a sweep line and blip dots */
export const IconRadarMap = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Outer circle */}
    <circle cx="12" cy="12" r="9" />
    {/* Middle ring */}
    <circle cx="12" cy="12" r="5.5" opacity="0.5" />
    {/* Inner ring */}
    <circle cx="12" cy="12" r="2" opacity="0.3" />
    {/* Crosshair lines */}
    <line x1="12" y1="3" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="21" />
    <line x1="3" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="21" y2="12" />
    {/* Sweep line */}
    <line x1="12" y1="12" x2="17.5" y2="5" />
    {/* Blip dots */}
    <circle cx="15" cy="9" r="1" fill={color} stroke="none" />
    <circle cx="9" cy="14.5" r="0.8" fill={color} stroke="none" />
  </svg>
);

/** Eye-slash — hide map indicator */
export const IconHideMap = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Eye shape */}
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    {/* Iris */}
    <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
    {/* Slash */}
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ─── Sound Icons ──────────────────────────────────────────────────────

/** Speaker with sound waves — sound enabled */
export const IconSoundOn = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 010 7.07" />
    <path d="M19.07 4.93a10 10 0 010 14.14" />
  </svg>
);

/** Speaker with slash — sound muted */
export const IconSoundOff = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

// ─── Export Formats ───────────────────────────────────────────────────

export const IconPdf = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M10 18v-4" />
    <path d="M10 14h2a1.5 1.5 0 0 1 0 3h-2" />
  </svg>
);

export const IconPng = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export const IconSvgFormat = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <path d="M6 8v8" />
    <path d="M7.5 16.5l9-9" />
  </svg>
);

export const IconJson = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 8c-1.5 0-2 1-2 2v2c0 1-1 1-1 1s1 0 1 1v2c0 1 .5 2 2 2" />
    <path d="M14 8c1.5 0 2 1 2 2v2c0 1 1 1 1 1s-1 0-1 1v2c0 1-.5 2-2 2" />
  </svg>
);

export const IconWarning = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
