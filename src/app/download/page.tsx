import { DownloadForm } from "@/components/DownloadForm";
import { filterOptions } from "@/analytics/data";
import { config } from "@/lib/config";

export default async function Download() {
  const options = await filterOptions();
  return (
    <div className="max-w-[1100px]">
      <h1 className="text-[18px] font-semibold mb-1">Display Tracker Report</h1>
      <p className="text-[13px] text-ink-2 mb-4">
        The monthly report in the same layout as RMI&apos;s, with sales from SAP: every display made in the selected month, and that dealer&apos;s
        sales of that design from one month before to twelve months after (months that haven&apos;t started yet are left out). Leave a filter
        on &quot;All&quot; to include everything.
      </p>
      <DownloadForm options={options} />
      <p className="text-[12px] text-ink-3 mt-4">
        The scheduled job also saves the full report, in both versions (without and with ZTDN, ZNTI, ZDMS invoices), for every month still inside its 14-month window to <code>{config().REPORT_OUTPUT_DIR}</code>.
      </p>
    </div>
  );
}
