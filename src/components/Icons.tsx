type P = { size?: number };
const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const Globe = ({ size = 16 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>
);
export const Chevron = ({ size = 12 }: P) => <svg {...base(size)} strokeWidth={2}><path d="M6 9l6 6 6-6" /></svg>;
export const Back = ({ size = 20 }: P) => <svg {...base(size)} strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>;
export const Search = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const Close = ({ size = 16 }: P) => <svg {...base(size)} strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const List = ({ size = 22 }: P) => <svg {...base(size)}><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
export const Bookmark = ({ size = 22, filled = false }: P & { filled?: boolean }) => (
  <svg {...base(size)} fill={filled ? 'currentColor' : 'none'}><path d="M6 4h12v16l-6-4-6 4z" /></svg>
);
export const Sliders = ({ size = 22 }: P) => (
  <svg {...base(size)}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
);
export const ShareIcon = ({ size = 20 }: P) => <svg {...base(size)}><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" /></svg>;
export const External = ({ size = 16 }: P) => <svg {...base(size)} strokeWidth={2}><path d="M7 17L17 7M9 7h8v8" /></svg>;
export const Inspect = ({ size = 22 }: P) => (
  <svg {...base(size)}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8M7.8 10.6l1.9 1.9 3.6-3.8" /></svg>
);
export const People = ({ size = 14 }: P) => (
  <svg {...base(size)}><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5M16 5.5a3 3 0 0 1 0 5.5M17.5 14c1.7.6 2.8 2.4 3 5" /></svg>
);
export const ImageIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16l-5-5-8.5 8.5" /></svg>
);
export const Refresh = ({ size = 16 }: P) => <svg {...base(size)}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></svg>;
