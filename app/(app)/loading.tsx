import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <section aria-busy="true" aria-label="Loading" className="window flex min-h-0 flex-1 flex-col">
      <div className="titlebar ios:px-4 ios:pt-3 ios:text-[34px] ios:font-bold ios:tracking-[-0.025em] ios:lg:pt-[26px]">
        <span className="flex-1">Loading…</span>
      </div>
      <div className="flex flex-col gap-3 p-3 ios:px-4 ios:lg:pr-7">
        <div className="progress-marquee w-48">
          <span />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-56" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
    </section>
  );
}
