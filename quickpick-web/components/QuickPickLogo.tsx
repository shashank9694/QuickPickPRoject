type Props = {
  size?: number;   // icon size in px (default 40)
  showText?: boolean;
  className?: string;
};

export default function QuickPickLogo({ size = 40, showText = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Pin icon */}
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="qpbg" x1="60" y1="40" x2="452" y2="472" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#3AD35A" />
            <stop offset="1" stopColor="#118A38" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="116" fill="url(#qpbg)" />
        <g transform="translate(146,104)">
          <path d="M110,300 C68,236 44,218 44,146 A66,66 0 1,1 176,146 C176,218 152,236 110,300 Z" fill="#FFFFFF" />
          <path d="M78,150 L102,174 L146,120" fill="none" stroke="#159A3E"
            strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>

      {showText && (
        <span className="font-extrabold" style={{ fontFamily: "var(--font-poppins, 'Poppins', system-ui, sans-serif)" }}>
          <span className="text-slate-900">Quick</span>
          <span className="text-emerald-600">Pick</span>
        </span>
      )}
    </span>
  );
}
