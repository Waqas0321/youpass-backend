import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import type { EventWorkspaceNavKey } from './eventWorkspaceNav';

type Props = {
  eventId: string;
  route: string;
  navKey: EventWorkspaceNavKey;
  locked?: boolean;
  icon: ReactNode;
};

export function EventWorkspaceNavLink({
  eventId,
  route,
  navKey,
  locked = false,
  icon,
}: Props) {
  const { t } = useI18n();
  const label = t(`eventWorkspace.nav.${navKey}`);

  if (locked) {
    return (
      <span className="event-workspace__nav-link event-workspace__nav-link--locked" aria-disabled="true">
        {icon}
        <span>{label}</span>
      </span>
    );
  }

  return (
    <NavLink
      to={`/events/${eventId}/${route}`}
      end={route === 'summary'}
      className={({ isActive }) =>
        isActive
          ? 'event-workspace__nav-link event-workspace__nav-link--active'
          : 'event-workspace__nav-link'
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
