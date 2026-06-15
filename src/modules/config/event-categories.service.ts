import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import type {
  CreateEventCategoryInput,
  UpdateEventCategoryInput,
} from './event-categories.validators.js';

function formatPublicCategory(type: {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  displayOrder: number;
}) {
  return {
    id: type.id,
    slug: type.slug,
    name: type.name,
    label: type.name,
    icon: type.icon,
    display_order: type.displayOrder,
    displayOrder: type.displayOrder,
  };
}

function formatAdminCategory(type: {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
}) {
  return {
    ...formatPublicCategory(type),
    is_active: type.isActive,
    isActive: type.isActive,
  };
}

export const eventCategoriesService = {
  async listActive() {
    const types = await prisma.eventType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    return types.map(formatPublicCategory);
  },

  async listAll() {
    const types = await prisma.eventType.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return types.map(formatAdminCategory);
  },

  async create(input: CreateEventCategoryInput) {
    const existing = await prisma.eventType.findUnique({ where: { slug: input.slug } });
    if (existing) {
      throw new AppError(409, 'CATEGORY_EXISTS', 'An event category with this slug already exists');
    }

    const type = await prisma.eventType.create({
      data: {
        slug: input.slug,
        name: input.name,
        icon: input.icon ?? null,
        displayOrder: input.display_order ?? 0,
        isActive: true,
      },
    });

    return formatAdminCategory(type);
  },

  async update(id: string, input: UpdateEventCategoryInput) {
    const current = await prisma.eventType.findUnique({ where: { id } });
    if (!current) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Event category not found');
    }

    if (input.slug && input.slug !== current.slug) {
      const slugTaken = await prisma.eventType.findUnique({ where: { slug: input.slug } });
      if (slugTaken) {
        throw new AppError(409, 'CATEGORY_EXISTS', 'An event category with this slug already exists');
      }
    }

    const type = await prisma.eventType.update({
      where: { id },
      data: {
        slug: input.slug,
        name: input.name,
        icon: input.icon === null ? null : input.icon,
        displayOrder: input.display_order,
        isActive: input.is_active,
      },
    });

    return formatAdminCategory(type);
  },
};
