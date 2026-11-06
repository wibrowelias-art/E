/* Hand-drawn SVG icons (own paths, sized to match the reference measurements). */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
  focusable: false,
  ...props,
});

const stroke = { stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const HashIcon = ({ size = 20, strokeWidth = 2.1, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M10.2 3.5 7.6 20.5M16.6 3.5 14 20.5M4.4 8.6h16M3.6 15.4h16" {...stroke} strokeWidth={strokeWidth} />
  </svg>
);

export const SpeakerIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3 9.2c0-.7.5-1.2 1.2-1.2H7l4.3-3.6c.7-.6 1.7-.1 1.7.8v13.6c0 .9-1 1.4-1.7.8L7 16H4.2c-.7 0-1.2-.5-1.2-1.2V9.2Z" fill="currentColor" />
    <path d="M16 8.6a4.8 4.8 0 0 1 0 6.8M18.6 6a8.6 8.6 0 0 1 0 12" {...stroke} strokeWidth={2} />
  </svg>
);

export const LockIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7.5 10V7.6a4.5 4.5 0 0 1 9 0V10" {...stroke} strokeWidth={2.4} />
    <rect x="4.6" y="9.6" width="14.8" height="12" rx="2.6" fill="currentColor" />
    <circle cx="12" cy="15" r="1.7" fill="#1a191e" />
    <path d="M12 15.6v2.2" stroke="#1a191e" strokeWidth={1.6} strokeLinecap="round" />
  </svg>
);

export const ChevronDown = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" {...stroke} />
  </svg>
);

export const ChevronRight = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m9.5 6.5 5.5 5.5-5.5 5.5" {...stroke} />
  </svg>
);

export const ChevronLeft = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M15 5.5 8.5 12l6.5 6.5" {...stroke} strokeWidth={2.2} />
  </svg>
);

export const ArrowLeft = ({ size = 24, strokeWidth = 2.2, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M20 12H5m6-7-7 7 7 7" {...stroke} strokeWidth={strokeWidth} />
  </svg>
);

export const SearchIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="10.5" cy="10.5" r="7.2" {...stroke} strokeWidth={2.2} />
    <path d="m16 16 5 5" {...stroke} strokeWidth={2.2} />
  </svg>
);

export const BubbleIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12.2 2.4c5.3 0 9.5 4 9.5 9s-4.2 9-9.5 9c-1.3 0-2.6-.3-3.8-.7l-4.2 1.6c-.6.2-1.2-.4-1-1l1.1-3.6a8.6 8.6 0 0 1-1.6-5.3c0-5 4.2-9 9.5-9Z" fill="currentColor" />
  </svg>
);

export const PlusCircleFill = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="11" fill="currentColor" />
    <path d="M12 6.6v10.8M6.6 12h10.8" stroke="var(--icon-cutout, #222224)" strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);

export const PlusIcon = ({ size = 24, strokeWidth = 2.2, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 5v14M5 12h14" {...stroke} strokeWidth={strokeWidth} />
  </svg>
);

export const InviteIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="10" cy="7" r="4" fill="currentColor" />
    <path d="M2.5 19.3c0-3.5 3.1-6.3 7.5-6.3 1.6 0 3 .4 4.2 1A5.6 5.6 0 0 0 13 21.5H4.2c-.9 0-1.7-.8-1.7-1.7v-.5Z" fill="currentColor" />
    <path d="M18.6 13.4v7.4M14.9 17.1h7.4" {...stroke} strokeWidth={2.3} />
  </svg>
);

export const BellIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 2.6c-3.6 0-6.2 2.8-6.2 6.4v3.6l-1.7 3c-.4.8.1 1.7 1 1.7h13.8c.9 0 1.4-.9 1-1.7l-1.7-3V9c0-3.6-2.6-6.4-6.2-6.4Z" fill="currentColor" />
    <path d="M9.4 19.4a2.7 2.7 0 0 0 5.2 0H9.4Z" fill="currentColor" />
  </svg>
);

export const DottedCircle = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    {Array.from({ length: 8 }).map((_, i) => {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      return <circle key={i} cx={12 + Math.cos(a) * 8} cy={12 + Math.sin(a) * 8} r={1.5} fill="currentColor" opacity={i % 2 ? 0.55 : 1} />;
    })}
  </svg>
);

export const MicIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="8.2" y="2.5" width="7.6" height="12" rx="3.8" fill="currentColor" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.2" {...stroke} strokeWidth={2} />
  </svg>
);

export const MicOffIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="8.2" y="2.5" width="7.6" height="12" rx="3.8" fill="currentColor" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.2" {...stroke} strokeWidth={2} />
    <path d="M3.5 3.5 20.5 20.5" stroke="var(--danger)" strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);

export const HeadphonesIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3.5 15v-3a8.5 8.5 0 0 1 17 0v3" {...stroke} strokeWidth={2} />
    <rect x="2.6" y="13" width="5.4" height="8" rx="2" fill="currentColor" />
    <rect x="16" y="13" width="5.4" height="8" rx="2" fill="currentColor" />
  </svg>
);

export const HeadphonesOffIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3.5 15v-3a8.5 8.5 0 0 1 17 0v3" {...stroke} strokeWidth={2} />
    <rect x="2.6" y="13" width="5.4" height="8" rx="2" fill="currentColor" />
    <rect x="16" y="13" width="5.4" height="8" rx="2" fill="currentColor" />
    <path d="M3.5 3.5 20.5 20.5" stroke="var(--danger)" strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);

export const GearIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path
      fillRule="evenodd"
      fill="currentColor"
      d="M10.6 2.2h2.8l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.4 2.4-2 1.7c.1.7.1 1.4 0 2.1l2 1.7-1.4 2.4-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-2.8l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.4-2.4 2-1.7a6.6 6.6 0 0 1 0-2.1l-2-1.7 1.4-2.4 2.5.9c.5-.4 1.1-.7 1.7-.9l.5-2.6Zm1.4 6.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z"
      transform="translate(0 1.4)"
    />
  </svg>
);

export const ThreadsIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 4.5h10.5a2 2 0 0 1 2 2V12M5 4.5a2 2 0 0 0-2 2v6.3a2 2 0 0 0 2 2h1.5v3l3.4-3" {...stroke} />
    <path d="M12.5 12.5h7a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-1.5 1.5H19v2l-2.6-2h-3.9a1.5 1.5 0 0 1-1.5-1.5V14a1.5 1.5 0 0 1 1.5-1.5Z" fill="currentColor" />
  </svg>
);

export const PinIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M14.3 3.3 20.7 9.7l-1.6 1.1-1.5-.4-3.2 3.2.4 3.9-1.5 1.5-3.4-3.4-4.6 4.6-1-1 4.6-4.6L5.5 11.2 7 9.7l3.9.4 3.2-3.2-.4-1.5 1.1-1.6Z" fill="currentColor" />
  </svg>
);

export const MembersIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="9" cy="7.5" r="3.6" fill="currentColor" />
    <path d="M2.5 18.6c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6v.4c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1v-.4Z" fill="currentColor" />
    <circle cx="16.6" cy="8.2" r="2.9" fill="currentColor" opacity={0.85} />
    <path d="M17 13.4c2.7.3 4.5 2.2 4.5 4.8v.3c0 .5-.4.9-.9.9h-3.3a5 5 0 0 0 .1-1c0-1.8-.2-3.4-.4-5Z" fill="currentColor" opacity={0.85} />
  </svg>
);

export const InboxIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 13.5 6.2 5.6A2 2 0 0 1 8.1 4.2h7.8a2 2 0 0 1 1.9 1.4L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.5Z" {...stroke} />
    <path d="M4 13.5h4.5l1.2 2h4.6l1.2-2H20" {...stroke} />
  </svg>
);

export const HelpIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9.5" {...stroke} />
    <path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.7.3-1.2.9-1.2 1.7v.4" {...stroke} />
    <circle cx="12" cy="17.2" r="1.25" fill="currentColor" />
  </svg>
);

export const GifIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="3.2" {...stroke} />
    <path d="M10 10.2a2.3 2.3 0 0 0-1.9-1C6.8 9.2 6 10.3 6 12s.8 2.8 2.2 2.8c1 0 1.8-.6 1.8-1.7v-.6H8.4M12.5 9.2v5.6M15.2 14.8V9.2h3M15.2 12h2.4" {...stroke} strokeWidth={1.7} />
  </svg>
);

export const StickerIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M14 21H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v6l-7 7Z" {...stroke} />
    <path d="M14 21v-3.5a3.5 3.5 0 0 1 3.5-3.5H21" {...stroke} />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" />
  </svg>
);

export const EmojiIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9.5" {...stroke} />
    <circle cx="9" cy="10" r="1.3" fill="currentColor" />
    <circle cx="15" cy="10" r="1.3" fill="currentColor" />
    <path d="M8 14.2a4.6 4.6 0 0 0 8 0" {...stroke} />
  </svg>
);

export const ReactIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M20.5 11.5a8.5 8.5 0 1 1-8-8.5" {...stroke} />
    <circle cx="9" cy="10.5" r="1.2" fill="currentColor" />
    <circle cx="14.5" cy="10.5" r="1.2" fill="currentColor" />
    <path d="M8.3 14.5a4.3 4.3 0 0 0 7.4 0M19 2.5v6M16 5.5h6" {...stroke} />
  </svg>
);

export const ReplyIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M9.5 5 3.5 11l6 6M4 11h9.5a7 7 0 0 1 7 7v1" {...stroke} />
  </svg>
);

export const EditIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M14.8 4.6 19.4 9.2 8.6 20H4v-4.6L14.8 4.6Z" {...stroke} />
    <path d="m12.6 6.8 4.6 4.6" {...stroke} />
  </svg>
);

export const MoreIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="5" cy="12" r="2" fill="currentColor" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <circle cx="19" cy="12" r="2" fill="currentColor" />
  </svg>
);

export const CrownIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3 8.5 7.5 12 12 5l4.5 7L21 8.5 19 18H5L3 8.5Z" fill="currentColor" />
    <rect x="5" y="19" width="14" height="2" rx="1" fill="currentColor" />
  </svg>
);

export const CloseIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M6 6l12 12M18 6 6 18" {...stroke} strokeWidth={2.2} />
  </svg>
);

export const CompassIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9.5" {...stroke} />
    <path d="m15.6 8.4-2 5.2-5.2 2 2-5.2 5.2-2Z" fill="currentColor" />
  </svg>
);

export const StageWaveIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)} viewBox="0 0 14 14">
    <rect className="wave-bar wave-bar-1" x="1" y="4" width="2" height="6" rx="1" fill="currentColor" />
    <rect className="wave-bar wave-bar-2" x="6" y="2" width="2" height="10" rx="1" fill="currentColor" />
    <rect className="wave-bar wave-bar-3" x="11" y="5" width="2" height="4" rx="1" fill="currentColor" />
  </svg>
);

export const BadgeFlower = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path
      fill="currentColor"
      d="M12 1.8 14.3 3.6l2.9-.4 1.1 2.7 2.7 1.1-.4 2.9 1.8 2.3-1.8 2.3.4 2.9-2.7 1.1-1.1 2.7-2.9-.4L12 22.2l-2.3-1.8-2.9.4-1.1-2.7-2.7-1.1.4-2.9L1.6 12l1.8-2.3-.4-2.9 2.7-1.1 1.1-2.7 2.9.4L12 1.8Z"
    />
    <path d="M8.2 12.3 12 8.6l3.8 3.7v3.5H8.2v-3.5Z" fill="#fff" />
    <rect x="11" y="13" width="2" height="2.8" fill="currentColor" />
  </svg>
);

export const EmojiFillIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path
      fillRule="evenodd"
      fill="currentColor"
      d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.6 8.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm6.8 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM7.3 13.8c-.4 0-.7.4-.5.8a5.8 5.8 0 0 0 10.4 0c.2-.4-.1-.8-.5-.8H7.3Z"
    />
  </svg>
);

export const SendIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3.4 4.2c-.3-.9.6-1.7 1.5-1.3l15.9 8c.8.4.8 1.6 0 2l-15.9 8c-.9.4-1.8-.4-1.5-1.3L5.9 12 3.4 4.2Zm3.7 6.6h6.4a1.2 1.2 0 1 1 0 2.4H7.1L6.2 16l11-4L6.2 8l.9 2.8Z" fill="currentColor" fillRule="evenodd" />
  </svg>
);
