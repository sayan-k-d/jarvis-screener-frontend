'use client';
import { NAV, ICONS, PageId } from '@/lib/nav';

export default function Sidebar({
  page,
  onNav,
  onSignOut,
}: {
  page: PageId;
  onNav: (id: PageId) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <div className="brand-mark">J</div>
        <div className="brand-txt">
          <div className="brand-name">JARVIS</div>
          <div className="brand-sub">INTELLIGENCE GROUP</div>
        </div>
      </div>
      <nav className="nav">
        {NAV.map(([id, label]) => (
          <button
            key={id}
            className={`nav-item ${page === id || (page === 'detail' && id === 'results') ? 'active' : ''}`}
            onClick={() => onNav(id)}
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[id] }} />
            {label}
          </button>
        ))}
      </nav>
      <div className="side-foot">
        <button className="logout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
