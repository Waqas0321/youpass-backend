import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../api/client';
import { useI18n } from '../i18n/useI18n';
import {
  IconCalendar,
  IconDashboard,
  IconDrink,
  IconGrid,
  IconImage,
  IconLogout,
  IconMapPin,
  IconMail,
  IconSpark,
  IconUsers,
  IconZap,
} from './ui/Icons';
import { LanguageToggle } from './ui/LanguageToggle';

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const navSections = [
    {
      label: t('adminLayout.sectionOverview'),
      items: [
        { to: '/', label: t('adminLayout.dashboard'), end: true, icon: IconDashboard },
      ],
    },
    {
      label: t('adminLayout.sectionContent'),
      items: [
        { to: '/events', label: t('adminLayout.events'), icon: IconCalendar },
        { to: '/drink-menus', label: t('adminLayout.drinkMenus'), icon: IconDrink },
        { to: '/producers', label: t('adminLayout.producers'), icon: IconUsers },
        { to: '/venues', label: t('adminLayout.venues'), icon: IconMapPin },
        { to: '/categories', label: t('adminLayout.categories'), icon: IconGrid },
        { to: '/banners', label: t('adminLayout.banners'), icon: IconImage },
      ],
    },
    {
      label: t('adminLayout.sectionInvitations'),
      items: [
        { to: '/invitations', label: t('adminLayout.producerInvites'), icon: IconMail },
        { to: '/event-settings', label: t('adminLayout.eventSettings'), icon: IconGrid },
        { to: '/waitlist', label: t('adminLayout.waitingList'), icon: IconMail },
        { to: '/system', label: t('adminLayout.systemJobs'), icon: IconZap },
      ],
    },
  ];

  const pageTitle = t(`adminLayout.pageTitles.${location.pathname}`) || 'Admin';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <IconSpark className="brand-mark__icon" />
          </span>
          <div>
            <strong>YOUPASS</strong>
            <p>{t('common.adminConsole')}</p>
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
            {t('common.localDevelopment')}
          </div>
          <button
            className="ghost-btn ghost-btn--full"
            onClick={() => {
              clearSession();
              navigate('/login');
            }}
          >
            <IconLogout className="btn-icon" />
            {t('common.signOut')}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <p className="topbar__crumb">{t('common.youpassAdmin')}</p>
            <h2 className="topbar__title">{pageTitle}</h2>
          </div>
          <div className="topbar__actions">
            <LanguageToggle />
            <div className="topbar__status">
              <span className="topbar__status-dot" />
              {t('common.apiConnected')}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
