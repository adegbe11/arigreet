import React, { useId } from "react";

/* Arigreet pin: a Klein Blue location pin crossed by a lime band — the moment
   two people meet at one point. Parts carry class names so the splash can
   choreograph them individually. */
export function PinMark({ size = 40, className = "", title }) {
  const id = useId().replace(/:/g, "");
  const pin =
    "M50 4C29.6 4 13 20.4 13 40.6c0 14.3 8.2 25.4 18.6 36.5L50 114l18.4-36.9C78.8 66 87 54.9 87 40.6 87 20.4 70.4 4 50 4Z";
  return (
    <svg
      className={"pinmark " + className}
      width={size}
      height={size * 1.18}
      viewBox="0 0 100 118"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
    >
      <defs>
        <linearGradient id={id + "r"} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#3a6bff" />
          <stop offset="0.5" stopColor="#0d3dd0" />
          <stop offset="1" stopColor="#002fa7" />
        </linearGradient>
        <linearGradient id={id + "t"} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#0028a6" />
          <stop offset="1" stopColor="#001673" />
        </linearGradient>
        <radialGradient id={id + "g"}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id + "b"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#CCFF00" />
          <stop offset="1" stopColor="#CCFF00" />
        </linearGradient>
        <linearGradient id={id + "s"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={id + "m"}>
          <path d={pin} fill="#fff" />
          <circle cx="50" cy="40.6" r="15.5" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${id}m)`}>
        <rect
          className="pm-ring"
          x="0"
          y="0"
          width="100"
          height="118"
          fill={`url(#${id}r)`}
        />
        <path
          className="pm-tail"
          d="M40 74L72 52.5H100V118H50Z"
          fill={`url(#${id}t)`}
        />
        <circle cx="33" cy="18" r="34" fill={`url(#${id}g)`} />
        <g transform="rotate(20 50 60)">
          <rect
            className="pm-shine"
            x="-60"
            y="-10"
            width="34"
            height="140"
            fill={`url(#${id}s)`}
          />
        </g>
      </g>
      <g transform="rotate(-35 40 65)">
        <rect
          className="pm-band"
          x="15"
          y="57"
          width="50"
          height="16"
          rx="8"
          fill={`url(#${id}b)`}
        />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "", split = false }) {
  const letters = (text, offset = 0) =>
    split
      ? [...text].map((c, i) => (
          <span className="wm-letter" key={i} style={{ "--i": i + offset }}>
            {c}
          </span>
        ))
      : text;
  return (
    <span className={"wordmark " + className} role="img" aria-label="Arigreet">
      <span className="wm-ari" aria-hidden="true">
        {letters("Ari")}
      </span>
      <span className="wm-greet" aria-hidden="true">
        {letters("greet", 3)}
      </span>
    </span>
  );
}
