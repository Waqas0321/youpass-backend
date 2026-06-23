import type { Prisma, TicketOfferingType } from '@prisma/client';

const MONGO_OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function isMongoObjectId(value: string): boolean {
  return MONGO_OBJECT_ID_PATTERN.test(value);
}

export function buildVenueTableRefFilter(tableRef: string) {
  if (isMongoObjectId(tableRef)) {
    return { OR: [{ id: tableRef }, { externalId: tableRef }] };
  }

  return { externalId: tableRef };
}

export function buildVenueZoneRefFilter(zoneRef: string) {
  if (isMongoObjectId(zoneRef)) {
    return { OR: [{ id: zoneRef }, { externalId: zoneRef }] };
  }

  return { externalId: zoneRef };
}

export function buildVenueTableAdminRefFilter(tableRef: string) {
  if (isMongoObjectId(tableRef)) {
    return {
      OR: [{ id: tableRef }, { externalId: tableRef }, { label: tableRef }],
    };
  }

  return { OR: [{ externalId: tableRef }, { label: tableRef }] };
}

export function buildOfferingRefFilter(
  offeringRef: string,
  typeRef: TicketOfferingType | null,
): Prisma.EventTicketOfferingWhereInput {
  if (isMongoObjectId(offeringRef)) {
    return {
      OR: [{ id: offeringRef }, ...(typeRef ? [{ type: typeRef }] : [])],
    };
  }

  if (typeRef) {
    return { type: typeRef };
  }

  return { id: '000000000000000000000000' };
}
