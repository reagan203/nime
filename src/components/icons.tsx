import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, sw: number | string) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
});

export const MicIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 2)} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
export const ArrowIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const BackIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const CloseIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const MenuIcon = ({ size = 20, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const MoonIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 1.8)} {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>;
export const SunIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 1.8)} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>;
export const MailIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 1.8)} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
export const MobileIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 1.8)} {...p}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18h2" /></svg>;
export const WhatsAppIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 1.8)} {...p}><path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z" /><path d="M9 9.5c.3 1.8 2.2 3.8 4 4.2l1.1-1.1 1.9.8c-.2 1-1.1 1.6-2 1.5-3-.4-5.4-2.9-5.8-5.8-.1-.9.5-1.8 1.5-2l.8 1.9L9 9.5Z" /></svg>;
export const PinIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 1.8)} {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const GlobeIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 1.8)} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
export const LinkedInIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 1.8)} {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" /></svg>;
export const DocIcon = ({ size = 16, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M4 5h11l5 5v9a1 1 0 0 1-1 1H4z" /><path d="M15 5v5h5M8 13h8M8 17h5" /></svg>;
export const SoundOnIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>;
export const SoundOffIcon = ({ size = 18, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m16 9 5 6M21 9l-5 6" /></svg>;
