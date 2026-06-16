import { z } from 'zod';

const producerFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  logo_url: z.string().url().max(2000).optional().nullable(),
  type_label: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  coverage_label: z.string().trim().max(120).optional().nullable(),
});

export const createProducerSchema = producerFieldsSchema;

export const updateProducerSchema = producerFieldsSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
);

export type CreateProducerInput = z.infer<typeof createProducerSchema>;
export type UpdateProducerInput = z.infer<typeof updateProducerSchema>;
