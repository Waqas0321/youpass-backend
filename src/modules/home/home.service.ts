import type { User } from '@prisma/client';
import { buildHeaderGreeting } from '../../common/utils/display-name.js';
import { POST_REGISTRATION_POLICY } from '../../common/constants/post-registration-policy.js';
import { configService } from '../config/config.service.js';
import { eventsService } from '../events/events.service.js';
import { invitationsService } from '../invitations/invitations.service.js';
import type { HomeFeedQuery } from '../events/events.validators.js';

type HomeFeedUser = Pick<User, 'id' | 'fullName' | 'countryCode' | 'category' | 'phone'>;

export const homeService = {
  async getInitialFeed(query: HomeFeedQuery, user?: HomeFeedUser) {
    const countryCode =
      query.country_code?.toUpperCase() ??
      query.country?.toUpperCase() ??
      user?.countryCode;
    const eventType = query.event_type;
    const context = query.context?.toLowerCase();
    const userId = user?.id;
    const userPhone = user?.phone;

    const [categories, featured, invitationHighlight] = await Promise.all([
      configService.getHomeCategories(countryCode),
      eventsService.getFeaturedEvents({ country_code: countryCode, event_type: eventType, limit: 10 }, userId),
      userId && userPhone
        ? invitationsService.getHomeInvitationHighlight(userId, userPhone)
        : Promise.resolve(null),
    ]);

    const bannerSlides = featured.slides.slice(0, 5);
    const bannerIds = bannerSlides.map((s) => s.id);

    const upcoming = await eventsService.listUpcomingEvents(
      {
        country_code: countryCode,
        event_type: eventType,
        page: query.upcoming_page,
        limit: query.upcoming_limit,
        exclude_ids: bannerIds,
      },
      userId,
    );

    return {
      country_code: countryCode ?? null,
      layout: {
        header: {
          greeting: user ? buildHeaderGreeting(user.fullName) : null,
          menu_enabled: true,
        },
        categories,
        main_banner: {
          curated_by: 'youpass',
          title: 'Featured events curated by YouPass',
          slides: bannerSlides,
          indicators: {
            total: bannerSlides.length,
            active_index: 0,
          },
        },
        search: {
          placeholder: 'Search events...',
          filters_enabled: true,
          filters: {
            country_code: countryCode ?? null,
            event_type: eventType ?? null,
            event_types: categories.event_types,
          },
          search_endpoint: '/events',
          search_param: 'q',
        },
        upcoming_events: {
          title: 'UPCOMING EVENTS',
          items: upcoming.items,
          pagination: upcoming.pagination,
        },
      },
      greeting: user
        ? {
            message: buildHeaderGreeting(user.fullName),
            first_name: user.fullName.trim().split(/\s+/)[0] ?? user.fullName,
            full_name: user.fullName,
            category: user.category,
          }
        : null,
      categories: categories,
      carousel: bannerSlides,
      featured_events: featured.events,
      event_types: categories.event_types,
      party_mode: {
        enabled: false,
        banner_visible: POST_REGISTRATION_POLICY.show_party_mode_banner,
      },
      post_registration: context === 'post_register',
      invitations: invitationHighlight,
    };
  },
};
