/* ============================================================================
   Coach Tools · shared year-group helpers
   England academic year runs Sept–Aug; Reception = year 0 of school. These are
   purely client-side display calculations — never written back to Airtable —
   so they can never clobber a deliberately-uncertain "Current Year Source"
   value on a Student record.

   Used by admin/students/index.html and the discipline Register pages
   (e.g. football/register/, gymnastics/register/). Load this script before
   any page script that calls calcYearGroup()/isUncertain().
   ============================================================================ */

function calcYearGroup(receptionStartYear) {
  if (!receptionStartYear) return '';
  const now = new Date();
  const academicYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1; // month 8 = September
  const yearsIn = academicYearStart - Number(receptionStartYear);
  if (yearsIn < 0) return 'Not yet started';
  if (yearsIn === 0) return 'Reception';
  if (yearsIn <= 6) return `Year ${yearsIn}`;
  return `Year ${yearsIn} (secondary)`;
}

function isUncertain(yearSource) {
  return /\?|\//.test(String(yearSource || ''));
}
