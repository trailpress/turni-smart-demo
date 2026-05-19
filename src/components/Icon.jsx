const ICONS = {
  bus: (
    <>
      <rect x="6" y="5" width="20" height="17" rx="4" />
      <path d="M9 10h14M9 15h14M11 22v2M21 22v2" />
      <circle cx="11" cy="19" r="1.4" />
      <circle cx="21" cy="19" r="1.4" />
    </>
  ),
  upload: (
    <>
      <path d="M16 21V9" />
      <path d="m11 14 5-5 5 5" />
      <path d="M7 25h18" />
      <path d="M8 5h11l5 5v15H8z" />
      <path d="M19 5v6h6" />
    </>
  ),
  document: (
    <>
      <path d="M9 5h9l5 5v17H9z" />
      <path d="M18 5v6h5" />
      <path d="M12 16h8M12 21h8" />
    </>
  ),
  calendar: (
    <>
      <rect x="6" y="8" width="20" height="18" rx="3" />
      <path d="M10 5v6M22 5v6M6 13h20" />
      <path d="M11 18h3M18 18h3M11 22h3" />
    </>
  ),
  search: (
    <>
      <circle cx="14" cy="14" r="7" />
      <path d="m20 20 5 5" />
    </>
  ),
  route: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="23" cy="24" r="3" />
      <path d="M12 8h5a4 4 0 0 1 0 8h-2a4 4 0 0 0 0 8h5" />
    </>
  ),
  chart: (
    <>
      <path d="M7 25V7" />
      <path d="M7 25h18" />
      <rect x="10" y="15" width="3.5" height="7" rx="1" />
      <rect x="16" y="10" width="3.5" height="12" rx="1" />
      <rect x="22" y="6" width="3.5" height="16" rx="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="16" cy="16" r="10" />
      <path d="M16 10v7l5 3" />
    </>
  ),
  mapPin: (
    <>
      <path d="M16 27s9-8.2 9-15a9 9 0 0 0-18 0c0 6.8 9 15 9 15Z" />
      <circle cx="16" cy="12" r="3" />
    </>
  ),
  tag: (
    <>
      <path d="M6 7v8l10 10 9-9L15 7H6z" />
      <circle cx="11" cy="12" r="1.5" />
    </>
  ),
  question: (
    <>
      <circle cx="16" cy="16" r="11" />
      <path d="M12.5 12.2a4 4 0 0 1 7.5 1.9c0 3.4-4.1 3.1-4.1 6" />
      <path d="M16 24h.1" />
    </>
  ),
  compass: (
    <>
      <circle cx="16" cy="16" r="10" />
      <path d="m20 10-3 8-7 4 3-8 7-4Z" />
    </>
  ),
  copy: (
    <>
      <rect x="11" y="11" width="14" height="14" rx="2" />
      <path d="M7 19V9a2 2 0 0 1 2-2h10" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M7.5 25 9 20.8A10 10 0 1 1 12.1 24L7.5 25Z" />
      <path d="M12.7 11.6c.2-.5.4-.6.8-.6h.6c.2 0 .5.1.6.5l.8 1.9c.1.3.1.6-.1.8l-.5.6c.7 1.2 1.8 2.3 3.1 3l.6-.5c.2-.2.5-.2.8-.1l1.9.8c.4.2.5.4.5.8v.6c0 .4-.2.7-.6.8-.6.2-1.3.3-2 .2-3.5-.5-6.4-3.3-6.9-6.8-.1-.7 0-1.4.4-2Z" />
    </>
  ),
  chevronRight: <path d="m13 8 8 8-8 8" />,
  chevronLeft: <path d="m19 8-8 8 8 8" />,
  plus: (
    <>
      <path d="M16 7v18" />
      <path d="M7 16h18" />
    </>
  ),
};

const assetPath = (fileName) => `${import.meta.env.BASE_URL}assets-webp/${fileName}`;

const ASSET_ICONS = {
  bus: assetPath('bus-front-icon.webp'),
  busMark: assetPath('bus-front-mark.webp'),
  upload: assetPath('icon-upload.webp'),
  route: assetPath('icon-route.webp'),
  calendar: assetPath('icon-calendar.webp'),
  search: assetPath('icon-search.webp'),
  stats: assetPath('icon-stats.webp'),
  rest: assetPath('icon-rest.webp'),
};

export function AssetIcon({ name, className = '', size = 40 }) {
  const src = ASSET_ICONS[name] || ASSET_ICONS.bus;
  return (
    <img
      alt=""
      className={className ? `asset-icon ${className}` : 'asset-icon'}
      height={size}
      src={src}
      style={{ '--asset-icon-size': `${size}px` }}
      width={size}
    />
  );
}

export function Icon({ name, className = '', size = 24, strokeWidth = 2.6 }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 32 32"
      width={size}
    >
      {ICONS[name] || ICONS.document}
    </svg>
  );
}
