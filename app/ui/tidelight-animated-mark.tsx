export default function TidelightAnimatedMark({ className = "" }: { className?: string }) {
  return <svg className={`tidelight-animated-mark${className ? ` ${className}` : ""}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path className="tidelight-mark-wave tidelight-mark-wave-primary" d="M9 34.5c8 0 8-11 16-11s8 11 16 11 8-11 16-11" />
    <path className="tidelight-mark-wave tidelight-mark-wave-secondary" d="M9 45c8 0 8-6.5 16-6.5S33 45 41 45s8-6.5 16-6.5" />
    <circle className="tidelight-mark-spark" cx="49" cy="16" r="3.5" />
  </svg>;
}
