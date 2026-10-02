import { ShoppingCart } from "lucide-react";
import { Skeleton, TitleBar } from "@/components/ui";

// Register-shaped placeholder: product tiles on the left, the sale on the right.
export default function Loading() {
  return (
    <section aria-busy="true" aria-label="Loading register" className="window flex min-h-0 flex-1 flex-col">
      <div className="ios:hidden">
        <TitleBar title="New Sale" icon={ShoppingCart} />
      </div>
      <p className="hidden px-4 pt-3 text-[34px] font-bold tracking-[-0.025em] ios:block lg:pt-[22px] lg:pl-2">New Sale</p>
      <div className="flex min-h-0 flex-1 gap-2 p-2 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] ios:gap-3 ios:px-4 ios:lg:pr-3 ios:lg:pl-2">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <Skeleton className="h-11" />
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-20" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-26" />
            ))}
          </div>
        </div>
        <div className="hidden flex-col gap-2 lg:flex">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="min-h-40 flex-1" />
          <Skeleton className="h-36" />
          <Skeleton className="h-14" />
        </div>
      </div>
    </section>
  );
}
