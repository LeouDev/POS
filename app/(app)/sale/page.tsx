import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { Window } from "@/components/window";
import { getCategories, getProducts, getProfile } from "@/lib/data";
import { Register } from "./register";

export const metadata: Metadata = { title: "New Sale" };

export default async function SalePage() {
  const [products, categories, profile] = await Promise.all([getProducts(), getCategories(), getProfile()]);
  const sellable = products.filter((p) => p.is_active);
  const used = new Set(sellable.map((p) => p.category_id));
  const register = (
    <Register
      products={sellable}
      categories={categories.filter((c) => used.has(c.id))}
      hasUncategorized={sellable.some((p) => !p.category_id)}
      currency={profile.currency}
      taxRate={profile.tax_rate}
      businessName={profile.business_name}
      timezone={profile.timezone}
      nextReceipt={profile.last_receipt_number + 1}
    />
  );

  // White/Black: the register titles its own product column, so the cart card runs the full height.
  if (profile.ui_theme === "light" || profile.ui_theme === "dark") {
    return <div className="flex min-h-0 flex-1 flex-col">{register}</div>;
  }

  return (
    <Window
      title={`New Sale - ${profile.business_name}`}
      icon={ShoppingCart}
      bodyClassName="flex flex-col overflow-hidden !p-1.5 sm:!p-2"
    >
      {register}
    </Window>
  );
}
