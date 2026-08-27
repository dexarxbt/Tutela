import { CHAIN_IDS } from '@tutela/protocol';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { chainLabel, shortenAddress, useWallet } from './wallet';
import { successfulLifecycle } from './data';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand${light ? ' brand--light' : ''}`} to="/" aria-label="Tutela home">
      <svg
        className="brand__mark"
        viewBox="0 0 48 48"
        role="img"
        aria-label="Tutela protected passage mark"
      >
        <rect width="48" height="48" rx="13" fill="currentColor" />
        <path d="M18.5 12.5h-6v23h6M29.5 12.5h6v23h-6" className="mark-brackets" />
        <path d="M18 18h12M24 18v14" className="mark-t" />
      </svg>
      <span>Tutela</span>
    </Link>
  );
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    programs: (
      <>
        <path d="M4 20V8l8-4 8 4v12" />
        <path d="M8 20v-6h8v6M8 10h.01M16 10h.01" />
      </>
    ),
    coverage: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7M10 14 21 3" />
        <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" />
        <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, chainId, connecting, error, connect, switchToCC3 } = useWallet();
  if (!address) {
    return (
      <>
        <button
          className={`button button--ink${compact ? ' button--compact' : ''}`}
          type="button"
          onClick={() => void connect()}
          disabled={connecting}
        >
          <Icon name="wallet" size={17} />
          {connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
        {error && (
          <span className="wallet-error" role="alert">
            {error}
          </span>
        )}
      </>
    );
  }
  const wrongNetwork = chainId !== CHAIN_IDS.cc3Testnet;
  return (
    <div className="wallet-cluster">
      {wrongNetwork && (
        <button className="network-switch" type="button" onClick={() => void switchToCC3()}>
          Switch to CC3
        </button>
      )}
      <button className="wallet-address" type="button" title={address}>
        <span className={`network-dot${wrongNetwork ? ' network-dot--warning' : ''}`} />
        <span>{chainLabel(chainId)}</span>
        <strong>{shortenAddress(address)}</strong>
      </button>
    </div>
  );
}

export function VerifiedEvidenceBanner() {
  return (
    <div className="verified-evidence-banner" role="status">
      <span>Verified evidence snapshots</span>
      <p>
        Two repository-validated testnet lifecycles are shown. Values are not a live index of
        current chain state.
      </p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replaceAll(' ', '-');
  return (
    <span className={`status status--${normalized}`}>
      <span />
      {status}
    </span>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav: Array<[string, string, string]> = [
    ['overview', '/app', 'Overview'],
    ['programs', '/app/programs', 'Programs'],
    ['coverage', '/app/coverage', 'Coverage'],
    ['activity', '/app/activity', 'Activity'],
  ];
  return (
    <div className="app-layout">
      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__top">
          <Brand />
          <button
            className="icon-button sidebar__close"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="app-nav" aria-label="Application navigation">
          {nav.map(([icon, to, label]) => (
            <NavLink key={to} to={to} end={to === '/app'} onClick={() => setMobileOpen(false)}>
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="environment">
            <span className="environment__pulse" />
            <div>
              <strong>Verified testnet snapshots</strong>
              <small>Explorer-backed success and failure</small>
            </div>
          </div>
          <Link to={`/receipt/${successfulLifecycle.id}`}>
            Open verified receipt <Icon name="arrow" size={16} />
          </Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <button
            className="icon-button app-header__menu"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>
          <div className="app-header__trail">
            <span>Attestcoin testnet</span>
            <span className="trail-dot" />
            <span>Sepolia → Creditcoin CC3</span>
          </div>
          <WalletButton compact />
        </header>
        <VerifiedEvidenceBanner />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function Definition({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="definition">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : ''}>{value}</dd>
    </div>
  );
}

export function CopyValue({ value, display }: { value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-value"
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      title={`Copy ${value}`}
    >
      <span>{display ?? value}</span>
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      <span className="sr-only">{copied ? 'Copied' : 'Copy value'}</span>
    </button>
  );
}
