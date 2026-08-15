import 'dotenv/config';
import { staffAuthService } from '../src/modules/staff-auth/staff-auth.service.js';

async function assert(label: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error('FAIL', label, detail ?? '');
    process.exitCode = 1;
    return;
  }
  console.log('PASS', label, detail ?? '');
}

async function main() {
  const staffLookup = await staffAuthService.lookup({
    phone: '987654321',
    country_code: 'CL',
  });
  await assert('staff phone detected', staffLookup.is_staff === true, staffLookup);

  const staffLookupE164 = await staffAuthService.lookup({
    phone: '+56987654321',
    country_code: 'CL',
  });
  await assert('staff e164 detected', staffLookupE164.is_staff === true, staffLookupE164);

  const customerLookup = await staffAuthService.lookup({
    phone: '912345678',
    country_code: 'CL',
  });
  await assert(
    'customer phone not staff',
    customerLookup.is_staff === false,
    customerLookup,
  );

  const unknownLookup = await staffAuthService.lookup({
    phone: '911111111',
    country_code: 'CL',
  });
  await assert(
    'unknown phone not staff',
    unknownLookup.is_staff === false,
    unknownLookup,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
