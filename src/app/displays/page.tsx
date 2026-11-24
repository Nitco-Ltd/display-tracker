import { Suspense } from "react";
import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { DisplayTable, cohortNote } from "@/components/DisplayTable";
import { filterOptions, loadRows, type SearchParams } from "@/analytics/data";
import { num } from "@/lib/format";

const PAGE = 100;

function qs(sp: SearchParams, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v ? [v] : []) p.append(k, x);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

export default async function Displays({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, options] = await Promise.all([loadRows(sp), filterOptions()]);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const { page: _p, ...filtersOnly } = sp;

  return (
    <>
      <Suspense>
        <FilterBar options={options} />
      </Suspense>
      <Section
        title={`Displays (${num(rows.length)})`}
        note={<>All report columns plus a sales summary. {cohortNote(rows)}. “After” = M+1 onwards, months so far. Avg value = sum of the 14-month window ÷ 14 (report rule).</>}
        action={
          <a href={`/api/export?${qs(filtersOnly)}`} className="rounded-md px-3 py-1.5 text-[13px] font-medium bg-accent text-white">
            Export to Excel
          </a>
        }
      >
        <DisplayTable rows={slice} />
        {pages > 1 && (
          <div className="flex items-center gap-3 mt-3 text-[13px]">
            {page > 1 && <Link href={`/displays?${qs(sp, { page: String(page - 1) })}`}>← Previous</Link>}
            <span className="text-ink-3">
              Page {page} of {pages}
            </span>
            {page < pages && <Link href={`/displays?${qs(sp, { page: String(page + 1) })}`}>Next →</Link>}
          </div>
        )}
      </Section>
    </>
  );
}
