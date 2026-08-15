export type LoyaltyTier = 'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze';

export type ProducerUser = {
  id: string;
  name: string;
  phone: string;
  joinedAt: string;
  avgTicketClp: number;
  loyaltyTier: LoyaltyTier;
  eventAttendances: number;
  avatarUrl: string;
};

export type LoyaltyFilter = 'all' | LoyaltyTier;

export type JoinDateSort = 'oldest' | 'newest';

export type ConsumptionSort = 'highToLow' | 'lowToHigh';
