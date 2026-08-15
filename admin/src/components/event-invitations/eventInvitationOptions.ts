export type InvitationListOption = {
  value: string;
  labelKey: string;
};

export type InvitationTypeOption = {
  value: string;
  labelKey: string;
};

export type CreateListGuestRow = {
  id: string;
  name: string;
  phone: string;
  listAssignment: string;
  invitationType: string;
};

export const INVITATION_LIST_OPTIONS: InvitationListOption[] = [
  { value: 'RRPP', labelKey: 'lists.rrpp' },
  { value: 'Influencers', labelKey: 'lists.influencers' },
  { value: 'Staff', labelKey: 'lists.staff' },
  { value: 'Sponsors', labelKey: 'lists.sponsors' },
  { value: 'Artistas', labelKey: 'lists.artists' },
  { value: 'VIP invitados', labelKey: 'lists.vip' },
];

export const INVITATION_TYPE_OPTIONS: InvitationTypeOption[] = [
  { value: 'general', labelKey: 'productTypes.general' },
  { value: 'vip', labelKey: 'productTypes.vip' },
  { value: 'vip_table', labelKey: 'productTypes.vip_table' },
  { value: 'backstage', labelKey: 'productTypes.backstage' },
];

let rowCounter = 0;

export function createEmptyGuestRow(): CreateListGuestRow {
  rowCounter += 1;
  return {
    id: `row-${rowCounter}`,
    name: '',
    phone: '',
    listAssignment: '',
    invitationType: '',
  };
}

export function createInitialGuestRows(count = 5): CreateListGuestRow[] {
  return Array.from({ length: count }, () => createEmptyGuestRow());
}

export function countValidGuestRows(rows: CreateListGuestRow[]) {
  return rows.filter((row) => row.name.trim() && row.phone.trim()).length;
}
