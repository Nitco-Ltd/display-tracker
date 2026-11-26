import { DownloadForm } from "@/components/DownloadForm";
import { PageHeader } from "@/components/PageHeader";
import { filterOptions } from "@/analytics/data";

export default async function Download({ searchParams }: PageProps<"/download">) {
  const sp = await searchParams;
  const options = await filterOptions();
  return (
    <div className="max-w-[1100px]">
      <PageHeader
        eyebrow="Report"
        title="Display Tracker Report"
        description="Every display from one month, with what each dealer bought of that tile, in RMI's Excel layout."
      />
      <DownloadForm options={options} initialMonth={typeof sp.month === "string" ? sp.month : undefined} />
    </div>
  );
}
