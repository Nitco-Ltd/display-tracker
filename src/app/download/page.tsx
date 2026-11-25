import { DownloadForm } from "@/components/DownloadForm";
import { PageHeader } from "@/components/PageHeader";
import { filterOptions } from "@/analytics/data";
import { config } from "@/lib/config";

export default async function Download({ searchParams }: PageProps<"/download">) {
  const sp = await searchParams;
  const options = await filterOptions();
  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Download the Display Tracker Report"
        description={
          <>
            RMI&apos;s report layout with sales from SAP: every display put up in the chosen month, and that dealer&apos;s purchases of that tile from the month
            before to 12 months after (months not yet reached are left out). A Summary sheet explains the numbers. Leave a filter on &quot;All&quot; to include
            everything.
          </>
        }
      />
      <DownloadForm options={options} initialMonth={typeof sp.month === "string" ? sp.month : undefined} />
      <p className="text-[12.5px] text-ink-3 mt-4">
        The scheduled job also saves the full report, in both versions (without and with ZTDN, ZNTI, ZDMS invoices), for every month still inside its 14-month
        window to <code className="rounded bg-surface-2 px-1.5 py-0.5 border border-line">{config().REPORT_OUTPUT_DIR}</code>.
      </p>
    </div>
  );
}
