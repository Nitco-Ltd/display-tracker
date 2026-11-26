import { Suspense } from "react";
import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { Section } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { DisplayTable } from "@/components/DisplayTable";
import { Icon } from "@/components/Icon";
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
      <PageHeader
        eyebrow="Displays"
        title={`${num(rows.length)} display${rows.length === 1 ? "" : "s"}`}
        description="Every display in the RMI app, with what the dealer bought of that tile."
      />
      <Suspense>
        <FilterBar options={options} />
      </Suspense>
      <Section
        title="All displays"
        note="“After display” is everything bought from the month after display until now. The Excel file has every report column."
        action={
          <a href={`/api/export?${qs(filtersOnly)}`} className="btn btn-primary">
            <Icon name="download" size={16} />
            Excel
          </a>
        }
      >
        <DisplayTable rows={slice} />
        {pages > 1 && (
          <div className="flex items-center gap-2 mt-4 text-[13px]">
            {page > 1 && <Link className="btn" href={`/displays?${qs(sp, { page: String(page - 1) })}`}>Previous</Link>}
            <span className="text-ink-3">
              Page {page} of {pages}
            </span>
            {page < pages && <Link className="btn" href={`/displays?${qs(sp, { page: String(page + 1) })}`}>Next</Link>}
          </div>
        )}
      </Section>
    </>
  );
}
