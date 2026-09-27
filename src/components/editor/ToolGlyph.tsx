export function ToolGlyph({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  switch (name) {
    case "zoom":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4M11 8v6M8 11h6" />
        </svg>
      )
    case "hand":
      return (
        <svg {...common}>
          <path d="M8 11V6.5a1.2 1.2 0 0 1 2.4 0V11M10.4 10.5V5.2a1.2 1.2 0 0 1 2.4 0V11M12.8 10.2V6.4a1.2 1.2 0 0 1 2.4 0V12M15.2 11.2v-2a1.2 1.2 0 0 1 2.3.4c.2 1.2.4 2.6-.2 4.2-1 2.6-2.8 4.2-5.6 4.2H10c-2.4 0-4-1.6-4-3.6V9.2a1.2 1.2 0 0 1 2.4 0V11" />
        </svg>
      )
    case "move":
      return (
        <svg {...common}>
          <path d="M12 3v18M3 12h18M12 3l-2.2 2.2M12 3l2.2 2.2M12 21l-2.2-2.2M12 21l2.2-2.2M3 12l2.2-2.2M3 12l2.2 2.2M21 12l-2.2-2.2M21 12l-2.2 2.2" />
        </svg>
      )
    case "marquee":
      return (
        <svg {...common}>
          <path d="M5 5h4M15 5h4v4M19 15v4h-4M9 19H5v-4" strokeDasharray="2.2 2" />
        </svg>
      )
    case "quick":
      return (
        <svg {...common}>
          <path d="M14 4l-2 6h5l-7 10 2-6H7l7-10z" />
        </svg>
      )
    case "wand":
      return (
        <svg {...common}>
          <path d="M4 20l10-10M14 6l4 4M16 4l1.5 1.5M19 7l1.5 1.5M8 8l1 1" />
        </svg>
      )
    case "redeye":
      return (
        <svg {...common}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.2" />
          <path d="M5 19L19 5" />
        </svg>
      )
    case "heal":
      return (
        <svg {...common}>
          <path d="M8 16l8-8 2 2-8 8H8v-2z" />
          <path d="M14 6l2-2 4 4-2 2" />
        </svg>
      )
    case "clone":
      return (
        <svg {...common}>
          <circle cx="9" cy="10" r="4" />
          <circle cx="15" cy="14" r="4" />
        </svg>
      )
    case "blur":
      return (
        <svg {...common}>
          <path d="M12 4c2 3 2 5 0 8s-2 5 0 8" />
          <path d="M8 6c1.4 2 1.4 3.4 0 5.2M16 6c-1.4 2-1.4 3.4 0 5.2" />
        </svg>
      )
    case "sponge":
      return (
        <svg {...common}>
          <path d="M6 14c0-4 2-8 6-8s6 4 6 8-2 5-6 5-6-1-6-5z" />
          <path d="M9 13h.01M12 11h.01M14 14h.01" />
        </svg>
      )
    case "brush":
      return (
        <svg {...common}>
          <path d="M15 4l5 5-8 8H7v-5l8-8z" />
          <path d="M5 19c1.2-1 2.2-.6 3 .2" />
        </svg>
      )
    case "eraser":
      return (
        <svg {...common}>
          <path d="M4 15l7-7 6 6-4 4H8L4 15z" />
          <path d="M13 8l3 3" />
        </svg>
      )
    case "bucket":
      return (
        <svg {...common}>
          <path d="M8 13l6-6 3 3-6 6H8v-3z" />
          <path d="M16 8l2-2M18 16c1.2 0 2 .8 2 1.6S19.2 19 18 19s-2-.6-2-1.4.8-1.6 2-1.6z" />
        </svg>
      )
    case "shape":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="1" />
        </svg>
      )
    case "type":
      return (
        <svg {...common}>
          <path d="M6 6h12M12 6v12M9 18h6" />
        </svg>
      )
    case "pencil":
      return (
        <svg {...common}>
          <path d="M5 19l3-1 10-10-2-2L6 16l-1 3z" />
          <path d="M14 6l2 2" />
        </svg>
      )
    case "subject":
      return (
        <svg {...common}>
          <circle cx="12" cy="7.5" r="2.2" />
          <path d="M7.5 18.5c.4-3 2-4.5 4.5-4.5s4.1 1.5 4.5 4.5" />
          <path d="M18 5.5l.7 1.4 1.4.2-1.1.9.3 1.4L18 8.7l-1.3.7.3-1.4-1.1-.9 1.4-.2z" />
        </svg>
      )
    case "crop":
      return (
        <svg {...common}>
          <path d="M7 3v14h14M17 21V7H3" />
        </svg>
      )
    case "cookie":
      return (
        <svg {...common}>
          <path d="M6 6h8l4 4v8H6V6z" />
          <path d="M14 6v4h4" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      )
  }
}
