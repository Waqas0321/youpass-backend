/** Event is still shown on Home / upcoming listings. */
export function isEventUpcomingForListing(startsAt: Date, now = new Date()): boolean {
  return startsAt.getTime() >= now.getTime();
}

/** Tickets can still be bought for this event. */
export function isEventPurchasable(
  event: { status: string; startsAt: Date },
  now = new Date(),
): boolean {
  return event.status === 'published' && isEventUpcomingForListing(event.startsAt, now);
}
