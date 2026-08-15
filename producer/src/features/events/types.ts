export type EventCategoryTone = 'concert' | 'festival' | 'party';

export type TicketCategoryId = 'general' | 'vip' | 'vipTable' | 'backstage' | 'courtesy';

export type TicketCategorySales = {
  id: TicketCategoryId;
  sold: number;
  total: number;
  color: string;
};

export type EventContact = {
  id: string;
  name: string;
  phone: string;
  initials: string;
};

export type ProducerEvent = {
  id: string;
  title: string;
  displayTitle: string;
  venue: string;
  date: string;
  scheduleStart: string;
  scheduleEnd: string;
  openingTime: string;
  closingTime: string;
  categoryTone: EventCategoryTone;
  producer: string;
  producers: string;
  capacity: number;
  address: string;
  posterUrl: string;
  salesStatus: 'active' | 'paused';
  ticketsSold: number;
  ticketCategories: TicketCategorySales[];
  contacts: EventContact[];
};

export type CalendarEventListItem = Pick<
  ProducerEvent,
  | 'id'
  | 'title'
  | 'venue'
  | 'date'
  | 'scheduleStart'
  | 'scheduleEnd'
  | 'categoryTone'
  | 'producer'
  | 'producers'
  | 'capacity'
  | 'address'
>;
