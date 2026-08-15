import { searchSupervisorEntries } from '../src/modules/staff-supervisor/staff-supervisor-entry-search.service.ts';
import { formatEntrySearchResults } from '../src/modules/staff-supervisor/staff-supervisor-entry-search.formatter.ts';

async function main() {
  try {
    const tickets = await searchSupervisorEntries({ q: 'Nigh Club' });
    console.log('tickets', tickets.length);
    const formatted = await formatEntrySearchResults(tickets);
    console.log(JSON.stringify(formatted, null, 2));
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  }
}

void main();
