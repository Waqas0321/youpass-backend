import type { User } from '@prisma/client';
import { buildHeaderGreeting } from '../../common/utils/display-name.js';
import { POST_REGISTRATION_POLICY } from '../../common/constants/post-registration-policy.js';
import { configService } from '../config/config.service.js';
import { homeBannersService } from '../config/home-banners.service.js';
import { eventsService } from '../events/events.service.js';
import { invitationsService } from '../invitations/invitations.service.js';
import { buildSearchFiltersConfig } from '../../common/constants/event-search-filters.js';
import type { HomeFeedQuery } from '../events/events.validators.js';
import { listActiveCountries } from '../../common/services/country-config.service.js';

type HomeFeedUser = Pick<User, 'id' | 'fullName' | 'countryCode' | 'category' | 'phone'>;

export const homeService = {
  async getInitialFeed(query: HomeFeedQuery, user?: HomeFeedUser) {
    const activeCountries = await listActiveCountries();
    const defaultCountryCode = activeCountries[0]?.code ?? 'CL';

    const countryCode =
      query.country_code?.toUpperCase() ??
      query.country?.toUpperCase() ??
      user?.countryCode?.toUpperCase() ??
      defaultCountryCode;
    const eventType = query.event_type;
    const context = query.context?.toLowerCase();
    const userId = user?.id;
    const userPhone = user?.phone;

    const [categories, bannerResult, featured, invitationHighlight] = await Promise.all([
      configService.getHomeCategories(countryCode),
      homeBannersService.resolveCarousel({
        countryCode,
        city: query.city,
        userCategory: user?.category,
        userId,
        eventType,
      }),
      eventsService.getFeaturedEvents({ country_code: countryCode, event_type: eventType, limit: 10 }, userId),
      userId && userPhone
        ? invitationsService.getHomeInvitationHighlight(userId, userPhone)
        : Promise.resolve(null),
    ]);

    const bannerSlides = bannerResult.slides;
    const mainBanner = bannerResult.main_banner;
    const bannerIds = bannerSlides
      .map((slide) => slide.tap_action.event_id ?? slide.id)
      .filter((value): value is string => Boolean(value));

    const upcoming = await eventsService.listUpcomingEvents(
      {
        country_code: countryCode,
        event_type: eventType,
        page: query.upcoming_page,
        limit: query.upcoming_limit,
        exclude_ids: bannerIds,
        near_me: query.near_me,
        lat: query.lat,
        lng: query.lng,
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
        main_banner: mainBanner,
        search: {
          placeholder: 'Search events by name',
          filters_enabled: true,
          debounce_ms: 300,
          empty_message: "We couldn't find any events with that term.",
          history_limit: 10,
          filters: buildSearchFiltersConfig(countryCode),
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
