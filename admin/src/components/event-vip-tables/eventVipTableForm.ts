import type { AdminVenueTableInput } from '../../api/client';

export type VipZoneOption = {
  zoneId: string;
  externalId: string;
  label: string;
};

export type VipTableCreateFormState = {
  number: string;
  zoneId: string;
  capacity: string;
  price: string;
};

export const EMPTY_VIP_TABLE_FORM: VipTableCreateFormState = {
  number: '',
  zoneId: '',
  capacity: '',
  price: '',
};

export function mapVipTableFormToInput(
  form: VipTableCreateFormState,
  zone: VipZoneOption,
): AdminVenueTableInput {
  const number = Number(form.number);

  return {
    external_id: `${zone.externalId}-m${number}`,
    number,
    label: `Mesa ${number}`,
    price: Number(form.price),
    capacity: Number(form.capacity),
    status: 'available',
    position_x: 0.5,
    position_y: 0.5,
  };
}
