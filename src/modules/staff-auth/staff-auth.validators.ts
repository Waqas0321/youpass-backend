import { z } from 'zod';

export const staffSendCodeSchema = z.object({
  phone: z.string().min(6).max(20),
  country_code: z.string().min(2).max(5),
});

export const staffLoginSchema = z.object({
  phone: z.string().min(6).max(20),
  country_code: z.string().min(2).max(5),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export type StaffSendCodeInput = z.infer<typeof staffSendCodeSchema>;
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const staffLookupSchema = staffSendCodeSchema;
export type StaffLookupInput = StaffSendCodeInput;
