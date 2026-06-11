/** Inviolable post-registration navigation rules for Flutter. */
export const POST_REGISTRATION_POLICY = {
  navigate_to: 'you_home' as const,
  show_welcome_screen: true,
  welcome_duration_seconds: 2,
  open_hamburger_menu: false,
  open_profile: false,
  show_onboarding: false,
  request_permissions: false,
  show_party_mode_banner: false,
  profile_completion_later: true,
  preload_endpoint: '/home/initial-feed',
  analytics_endpoint: '/analytics/event/registration-completed',
} as const;

export function buildPostRegistrationNavigation(linkedInvitations = 0) {
  return {
    ...POST_REGISTRATION_POLICY,
    flow: linkedInvitations > 0 ? 'welcome_then_home_with_invitation' : 'welcome_then_home',
    forbidden_routes: ['profile', 'hamburger_menu', 'onboarding', 'permissions_prompt'],
    highlight_pending_invitation: linkedInvitations > 0,
    linked_invitations_count: linkedInvitations,
  };
}

export function buildWelcomePayload(fullName: string) {
  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;
  return {
    title: `Welcome to YouPass, ${firstName}!`,
    subtitle: 'Your access to the best events starts here',
    duration_seconds: POST_REGISTRATION_POLICY.welcome_duration_seconds,
    user_name: firstName,
  };
}
