import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, clearSession, getSession } from '../../api/client';
import { useSelectedEvent } from '../../context/SelectedEventContext';
import { useI18n } from '../../i18n/useI18n';
import { IconBell, IconChevronDown, IconLogout, IconPlus } from '../ui/Icons';
import { LanguageToggle } from '../ui/LanguageToggle';

type EventsPageHeaderProps = {
  onCreateEvent: () => void;
};

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function EventsPageHeader({ onCreateEvent }: EventsPageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { selectedEvent } = useSelectedEvent();
  const headerRef = useRef<HTMLElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [producerName, setProducerName] = useState(t('dashboard.defaultProducer'));

  useEffect(() => {
    const eventProducer = selectedEvent?.producer_name?.trim();
    if (eventProducer) {
      setProducerName(eventProducer);
      return;
    }

    const session = getSession();
    void adminApi.producers().then((result) => {
      const producers = result.data?.producers ?? [];
      const sessionProducer = producers.find((producer) => producer.id === session?.producerId);
      setProducerName(sessionProducer?.name ?? producers[0]?.name ?? t('dashboard.defaultProducer'));
    });
  }, [selectedEvent?.id, selectedEvent?.producer_name, t]);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  const initials = useMemo(() => initialsFromName(producerName) || 'YP', [producerName]);

  return (
    <header ref={headerRef} className="dash-header events-page-header">
      <div className="dash-header__intro">
        <h1 className="dash-header__title">{t('eventsPage.title')}</h1>
        <p className="dash-header__subtitle">{t('eventsPage.subtitle')}</p>
      </div>

      <div className="dash-header__aside">
        <div className="dash-header__toolbar">
          <div className="dash-header__locale">
            <LanguageToggle />
          </div>
          <button
            type="button"
            className="dash-header__notify"
            aria-label={t('eventWorkspace.notifications')}
          >
            <IconBell />
          </button>
          <div className="dash-header__menu-wrap">
            <button
              type="button"
              className={`dash-header__profile ${profileOpen ? 'dash-header__profile--open' : ''}`}
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="dash-header__profile-text">
                <strong>{producerName}</strong>
                <span>{t('common.administrator')}</span>
              </span>
              <span className="dash-header__avatar">{initials}</span>
              <IconChevronDown className="dash-header__chevron" />
            </button>
            {profileOpen ? (
              <ul className="dash-header__popover dash-header__popover--menu" role="menu">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="dash-header__menu-item"
                    onClick={() => {
                      setProfileOpen(false);
                      clearSession();
                      navigate('/login');
                    }}
                  >
                    <IconLogout className="dash-header__menu-icon" />
                    {t('common.signOut')}
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        </div>

        <button type="button" className="events-page-header__create" onClick={onCreateEvent}>
          <IconPlus />
          {t('eventsPage.createEvent')}
        </button>
      </div>
    </header>
  );
}
