// Shown instantly while a page's data is prepared, so switching pages never looks frozen.
export default function Loading() {
  const block = "rounded-[14px] bg-[var(--surface-1)] border border-line animate-pulse";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="h-6 w-72 rounded bg-[var(--gridline)] animate-pulse mb-2" />
      <div className="h-4 w-[520px] max-w-full rounded bg-[var(--gridline)] animate-pulse mb-4" />
      <div className={`${block} h-[92px] mb-4`} />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-[96px]`} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className={`${block} h-[340px] lg:col-span-3`} />
        <div className={`${block} h-[340px] lg:col-span-2`} />
      </div>
    </div>
  );
}
