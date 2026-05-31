export type JwtPayload = {
  sub: string;
  sessionId: string;
  phone: string;
};

export type AuthRequestContext = {
  ipAddress?: string;
  deviceInfo?: Record<string, unknown>;
};

export type PublicUser = {
  id: string;
  phone: string;
  countryCode: string;
  fullName: string;
  email: string;
  birthdate: string;
  gender: string;
  instagramUsername: string | null;
  profilePhotoUrl: string | null;
  category: string;
  createdAt: string;
};
