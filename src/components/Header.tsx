import { useEffect, useRef, useState } from "react";
import { MenuIcon, MoonIcon, SunIcon } from "./icons";

const NAV = [["#approach", "Approach"], ["#services", "Services"], ["#programme", "How we work"], ["#contact", "Contact"]] as const;

/** Switches light and dark mode, remembers the choice, and tells Nine (she shows a sun or a moon). */
export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.getAttribute("data-theme") === "dark"); }, []);
  const toggle = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("nm-theme", next); } catch {}
    setDark(next === "dark");
    document.dispatchEvent(new CustomEvent("nine:theme", { detail: { dark: next === "dark" } }));
  };
  return { dark, toggle };
}

export function Header() {
  const { dark, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const spy = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) setActive("#" + en.target.id); }), { rootMargin: "-45% 0px -50% 0px" });
    NAV.forEach(([href]) => { const el = document.querySelector(href); if (el) spy.observe(el); });
    return () => { window.removeEventListener("scroll", onScroll); spy.disconnect(); };
  }, []);

  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <header className={`nm-header${scrolled ? " is-scrolled" : ""}`} id="top">
      <div className="nm-wrap nm-header-in">
        <a className="nm-logo" href="#top" aria-label="Ninth Mind home">
          <img className="nm-logo-img" src="/assets/ninth-mind-logo.png" alt="Ninth Mind: AI-Powered Business Transformation & Training" />
        </a>
        <nav className={`nm-nav${open ? " is-open" : ""}`} id="nav" aria-label="Main" ref={navRef} onClick={e => { if ((e.target as Element).closest("a")) setOpen(false); }}>
          {NAV.map(([href, text]) => <a key={href} href={href} className={active === href ? "is-active" : undefined}>{text}</a>)}
          <div className="nm-theme-row">
            <span>Dark mode</span>
            <button className="nm-icon-btn" type="button" aria-label={label} title={dark ? "Light mode" : "Dark mode"} onClick={toggle}><MoonIcon /></button>
          </div>
        </nav>
        <div className="nm-header-actions">
          <button className="nm-icon-btn nm-theme-btn" type="button" aria-label={label} title={dark ? "Light mode" : "Dark mode"} onClick={toggle}>
            <MoonIcon className="nm-moon" />
            <SunIcon className="nm-sun" />
          </button>
          <button className="nm-btn nm-btn-primary nm-btn-sm nm-header-cta" type="button" data-talk="">Talk to Nine</button>
          <button className="nm-icon-btn nm-menu-btn" type="button" aria-label="Open menu" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(o => !o)}>
            <MenuIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
