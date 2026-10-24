// Icon sprite from design/prototype/index.html (24-unit grid, 1.5 px stroke).

export type IconName =
  | "can"
  | "colour"
  | "artwork"
  | "light"
  | "water"
  | "camera"
  | "effects"
  | "background"
  | "gallery"
  | "undo"
  | "redo"
  | "export"
  | "download"
  | "share"
  | "close"
  | "chev-down"
  | "chev-right"
  | "chev-left"
  | "check"
  | "plus"
  | "upload"
  | "reset"
  | "search"
  | "brush"
  | "spray"
  | "eraser"
  | "trash"
  | "sparkle"
  | "spin"
  | "eye"
  | "fit"
  | "alert"
  | "info"
  | "link"
  | "more"
  | "crosshair"
  | "ang-front"
  | "ang-three"
  | "ang-lid"
  | "ang-hero";

const SPRITE = `<symbol id="i-can" viewBox="0 0 24 24"><path d="M8 3.5h8M7 6.5c0-1.1 2.2-2 5-2s5 .9 5 2M7 6.5v12c0 1.1 2.2 2 5 2s5-.9 5-2v-12M7 6.5c0 1.1 2.2 2 5 2s5-.9 5-2"/></symbol><symbol id="i-colour" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.6-.3-1-.6-1.4-.3-.4-.4-.7-.4-1.1 0-1 .9-1.5 2-1.5h1.5A4.5 4.5 0 0 0 21 10.5C21 6.4 17 3 12 3Z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15.5" cy="7.5" r="1"/></symbol><symbol id="i-artwork" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.5"/><path d="M20.5 15.5 15.5 11l-7 8"/></symbol><symbol id="i-light" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></symbol><symbol id="i-water" viewBox="0 0 24 24"><path d="M12 3.5s-6 6.3-6 10.5a6 6 0 0 0 12 0c0-4.2-6-10.5-6-10.5Z"/><path d="M9 14.5a3 3 0 0 0 2 2.8"/></symbol><symbol id="i-camera" viewBox="0 0 24 24"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.5"/></symbol><symbol id="i-effects" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5 8 12M12 3.5l6.8 4.2M20.5 12l-8.5 0M20.5 12l-3.3 7M12 20.5l4-8M12 20.5 5.2 16.3M3.5 12h8.5M3.5 12l3.3-7"/></symbol><symbol id="i-background" viewBox="0 0 24 24"><path d="M3.5 17.5 9 10l4 5 2.5-3 5 5.5"/><circle cx="17" cy="7" r="2"/><rect x="3.5" y="4.5" width="17" height="15" rx="2"/></symbol><symbol id="i-gallery" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></symbol><symbol id="i-undo" viewBox="0 0 24 24"><path d="M8 7H4v4"/><path d="M4.5 11A8 8 0 1 1 6 17"/></symbol><symbol id="i-redo" viewBox="0 0 24 24"><path d="M16 7h4v4"/><path d="M19.5 11A8 8 0 1 0 18 17"/></symbol><symbol id="i-export" viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></symbol><symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></symbol><symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/></symbol><symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></symbol><symbol id="i-chev-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol><symbol id="i-chev-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol><symbol id="i-chev-left" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></symbol><symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7"/></symbol><symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol><symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V5M8 9l4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></symbol><symbol id="i-reset" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4.5h4.5"/></symbol><symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></symbol><symbol id="i-brush" viewBox="0 0 24 24"><path d="m14 4 6 6-8.5 8.5a3 3 0 0 1-2.1.9H6a2 2 0 0 1-2-2v-3.4a3 3 0 0 1 .9-2.1L14 4Z"/><path d="m11 7 6 6"/></symbol><symbol id="i-spray" viewBox="0 0 24 24"><rect x="7" y="9" width="8" height="12" rx="1.5"/><path d="M9 9V6.5h4V9M9 4.5h4"/><path d="M18 6h1M18 9h1M18 12h1M20.5 7.5h1M20.5 10.5h1"/></symbol><symbol id="i-eraser" viewBox="0 0 24 24"><path d="m8.5 19.5-4.4-4.4a1.5 1.5 0 0 1 0-2.1L13.7 3.4a1.5 1.5 0 0 1 2.1 0l4.8 4.8a1.5 1.5 0 0 1 0 2.1L11.5 19.5H8.5Z"/><path d="M6 11.5 12.5 18M4 20h16"/></symbol><symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></symbol><symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8Z"/><path d="M19 15c.3 1.7 1.3 2.7 3 3-1.7.3-2.7 1.3-3 3-.3-1.7-1.3-2.7-3-3 1.7-.3 2.7-1.3 3-3Z"/></symbol><symbol id="i-spin" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8.5" ry="3.5"/><path d="M12 3.5v17"/><path d="m18.5 8.5 2-1 .5 2.3"/></symbol><symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></symbol><symbol id="i-fit" viewBox="0 0 24 24"><path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/></symbol><symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3.5 21 19.5H3L12 3.5Z"/><path d="M12 10v4M12 16.5v.5"/></symbol><symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.5"/></symbol><symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1"/></symbol><symbol id="i-more" viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/></symbol><symbol id="i-crosshair" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></symbol><symbol id="i-ang-front" viewBox="0 0 32 32"><rect x="11" y="6" width="10" height="21" rx="2.5"/><path d="M11 10h10M11 24h10"/></symbol><symbol id="i-ang-three" viewBox="0 0 32 32"><path d="M10.5 9c0-1.4 2.5-2.4 5.5-2.4s5.5 1 5.5 2.4v15.5c0 1.4-2.5 2.5-5.5 2.5s-5.5-1.1-5.5-2.5V9Z"/><ellipse cx="16" cy="9" rx="5.5" ry="2.4"/></symbol><symbol id="i-ang-lid" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="6.5"/><path d="M16 12.5v4M14.5 18.5h3"/></symbol><symbol id="i-ang-hero" viewBox="0 0 32 32"><path d="M9 11.5c0-2 3.1-3.5 7-3.5s7 1.5 7 3.5V21c0 2.6-3.1 4.5-7 4.5S9 23.6 9 21v-9.5Z"/><ellipse cx="16" cy="11.5" rx="7" ry="3.5"/><path d="M4 27h24"/></symbol>`;

export function IconSprite() {
  return <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<defs>${SPRITE}</defs>` }} />;
}

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
