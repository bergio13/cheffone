'use client';

import { Moon, Sun } from 'lucide-react';

/**
 * Toggles light/dark by setting data-theme on <html> and persisting the choice.
 * Stateless on purpose: the visible icon is chosen by CSS from data-theme (see globals.css),
 * which avoids a server/client hydration mismatch.
 */
export default function ThemeToggle({ className }) {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('cheffone_theme', next);
    } catch {}
  };

  return (
    <button className={className} onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode">
      <Moon size={18} className="theme-icon-light" />
      <Sun size={18} className="theme-icon-dark" />
    </button>
  );
}
