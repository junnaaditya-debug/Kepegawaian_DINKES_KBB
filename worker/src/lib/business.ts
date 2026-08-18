/** Shared business-rule calculations for kepangkatan (BR-1..BR-6). */

export function monthsBetween(fromIso: string, toDate: Date): number {
  const from = new Date(fromIso);
  if (isNaN(from.getTime())) return 0;
  let months = (toDate.getFullYear() - from.getFullYear()) * 12 + (toDate.getMonth() - from.getMonth());
  if (toDate.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

export interface PeriodeConfig {
  bulan: number;
  tanggal: number;
  label: string;
}

/** Returns the next periode kenaikan pangkat date on/after `from`, per configurable BR-1 parameter. */
export function nextPeriode(periodes: PeriodeConfig[], from: Date): { date: Date; label: string } {
  const year = from.getFullYear();
  const candidates: { date: Date; label: string }[] = [];
  for (const y of [year, year + 1]) {
    for (const p of periodes) {
      candidates.push({ date: new Date(Date.UTC(y, p.bulan - 1, p.tanggal)), label: `${p.label} ${y}` });
    }
  }
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = candidates.find((cand) => cand.date.getTime() >= startOfDay(from).getTime());
  return next ?? candidates[0];
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** All periode occurrences within [from, from + monthsAhead]. */
export function periodesWithinRange(periodes: PeriodeConfig[], from: Date, monthsAhead: number): { date: Date; label: string }[] {
  const end = new Date(from);
  end.setMonth(end.getMonth() + monthsAhead);
  const results: { date: Date; label: string }[] = [];
  const startYear = from.getFullYear();
  const endYear = end.getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    for (const p of periodes) {
      const date = new Date(Date.UTC(y, p.bulan - 1, p.tanggal));
      if (date >= startOfDay(from) && date <= end) {
        results.push({ date, label: `${p.label} ${y}` });
      }
    }
  }
  results.sort((a, b) => a.date.getTime() - b.date.getTime());
  return results;
}
