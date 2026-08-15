import 'dotenv/config';
import { staffSupervisorVipManagementService } from '../src/modules/staff-supervisor/staff-supervisor-vip-management.service.js';

async function main() {
  try {
    const result = await staffSupervisorVipManagementService.searchVipTables('Tes');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('FAIL', error);
  }
}

main();
