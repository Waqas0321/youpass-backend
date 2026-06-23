import { partyModeService } from '../src/modules/party-mode/party-mode.service.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const anonymous = await partyModeService.resolveForUser(undefined, {
    lat: -33.4489,
    lng: -70.6693,
  });
  assert(!anonymous.enabled, 'anonymous users should not get party mode');
  assert(!anonymous.banner_visible, 'anonymous users should not see banner');

  console.log('party-mode service smoke checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
