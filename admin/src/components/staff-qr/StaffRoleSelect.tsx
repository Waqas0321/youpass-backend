import type { AdminStaffRole } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import {
  filterAssignableStaffRoles,
  normalizedStaffRoleKind,
  resolveAssignableRoleId,
  roleSlugForMember,
} from './staffRoleOptions';

type Props = {
  memberRoleId: string;
  roles: AdminStaffRole[];
  disabled?: boolean;
  onChange: (roleId: string) => void;
};

function roleDisplayLabel(role: AdminStaffRole, t: ReturnType<typeof useI18n>['t']) {
  const slug = role.slug ?? role.id;
  const key = `staffQr.roles.${slug}` as 'staffQr.roles.bar';
  const translated = t(key);
  return translated.startsWith('staffQr.roles.') ? role.label : translated;
}

export function StaffRoleSelect({ memberRoleId, roles, disabled, onChange }: Props) {
  const { t } = useI18n();
  const assignableRoles = filterAssignableStaffRoles(roles);
  const memberSlug = roleSlugForMember(memberRoleId, roles);
  const canSwitch = normalizedStaffRoleKind(memberSlug) != null && assignableRoles.length > 0;

  if (!canSwitch) {
    const role = roles.find((item) => item.id === memberRoleId);
    const color = role?.color ?? '#ffb800';

    return (
      <span
        className="staff-qr-role-pill"
        style={{
          color,
          borderColor: `${color}44`,
          background: `${color}14`,
        }}
      >
        {role ? roleDisplayLabel(role, t) : memberRoleId}
      </span>
    );
  }

  const selectedRoleId = resolveAssignableRoleId(memberRoleId, roles, assignableRoles);
  const selectedRole = assignableRoles.find((role) => role.id === selectedRoleId) ?? assignableRoles[0];
  const color = selectedRole?.color ?? '#ffb800';

  return (
    <select
      className="staff-qr-role-select"
      value={selectedRoleId}
      disabled={disabled}
      aria-label={t('staffQr.colRole')}
      style={{
        color,
        borderColor: `${color}44`,
        background: `${color}14`,
      }}
      onChange={(event) => onChange(event.target.value)}
    >
      {assignableRoles.map((role) => (
        <option key={role.id} value={role.id}>
          {roleDisplayLabel(role, t)}
        </option>
      ))}
    </select>
  );
}
