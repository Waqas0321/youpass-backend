import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../api/client';
import {
  IconCalendar,
  IconDashboard,
  IconGrid,
  IconImage,
  IconLogout,
  IconMail,
  IconSpark,
  IconZap,
} from './ui/Icons';

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', end: true, icon: IconDashboard },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/events', label: 'Events', icon: IconCalendar },
      { to: '/categories', label: 'Categories', icon: IconGrid },
      { to: '/banners', label: 'Banners', icon: IconImage },
    ],
  },
  {
    label: 'Invitations',
    items: [
      { to: '/invitations', label: 'Producer invites', icon: IconMail },
      { to: '/event-settings', label: 'Event settings', icon: IconGrid },
      { to: '/waitlist', label: 'Waiting list', icon: IconMail },
      { to: '/system', label: 'System jobs', icon: IconZap },
    ],
  },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/events': 'Events',
  '/categories': 'Event categories',
  '/banners': 'Home banners',
  '/invitations': 'Producer invitations',
  '/event-settings': 'Event invitation settings',
  '/waitlist': 'Waiting list',
  '/system': 'System jobs',
};

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] ?? 'Admin';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <IconSpark className="brand-mark__icon" />
          </span>
          <div>
            <strong>YOUPASS</strong>
            <p>Admin Console</p>
          </div>
        </div>

        <div className="sidebar__nav">
          {navSections.map((section) => (
            <div key={section.label} className="nav-section">
              <p className="nav-section__label">{section.label}</p>
              <nav>
                {section.items.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={'end' in link ? link.end : false}
                      className={({ isActive }) =>
                        isActive ? 'nav-link active' : 'nav-link'
                      }
                    >
                      <Icon className="nav-link__icon" />
                      <span>{link.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="sidebar__footer">
          <div className="env-pill">
            <span className="env-pill__dot" />
            Local development
          </div>
          <button
            className="ghost-btn ghost-btn--full"
            onClick={() => {
              clearSession();
              navigate('/login');
            }}
          >
            <IconLogout className="btn-icon" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <p className="topbar__crumb">YouPass / Admin</p>
            <h2 className="topbar__title">{pageTitle}</h2>
          </div>
          <div className="topbar__status">
            <span className="topbar__status-dot" />
            API connected
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
