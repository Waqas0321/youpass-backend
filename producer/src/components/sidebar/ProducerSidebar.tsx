import { NavLink, useLocation } from 'react-router-dom';
import { producerNavItems } from '../../layouts/producerNav';
import { useI18n } from '../../i18n/useI18n';
import { IconUsers } from '../ui/Icons';

export function ProducerSidebar() {
  const { t } = useI18n();
  const location = useLocation();
  const registrationActive = location.pathname.startsWith('/producer-registration');

  return (
    <aside className="producer-sidebar">
      <div className="producer-sidebar__brand" aria-label={t('common.brand')}>
        YouPass<sup>®</sup>
      </div>

      <nav className="producer-sidebar__nav" aria-label={t('sidebar.navLabel')}>
        {producerNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'producer-nav-link producer-nav-link--active' : 'producer-nav-link'
              }
            >
              <Icon className="producer-nav-link__icon" />
              <span>{t(`sidebar.${item.labelKey}`)}</span>
            </NavLink>
          );
        })}
      </nav>

      <NavLink
        to="/producer-registration"
        className={() =>
          registrationActive
            ? 'producer-sidebar__cta producer-sidebar__cta--active'
            : 'producer-sidebar__cta'
        }
      >
        <IconUsers className="producer-sidebar__cta-icon" />
        <span>{t('sidebar.producerRegistration')}</span>
      </NavLink>

      <div className="producer-sidebar__footer">
        <div className="producer-sidebar__footer-brand">YouPass<sup>®</sup></div>
        <p className="producer-sidebar__footer-tagline">{t('sidebar.footerTagline')}</p>
        <p className="producer-sidebar__footer-copy">{t('sidebar.footerCopy')}</p>
      </div>
    </aside>
  );
}
