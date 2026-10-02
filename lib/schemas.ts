import { z } from "zod";
import { CURRENCIES, isValidTimezone, PAYMENT_METHODS } from "@/lib/format";

// Shared by the forms (client-side feedback) and the server actions (trust boundary).

const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

const money = (missing: string) =>
  z
    .number({ error: missing })
    .min(0, "Can't be negative")
    .max(9_999_999_999, "That amount is too large")
    .refine(twoDecimals, "Use at most 2 decimal places");

const count = (missing: string) =>
  z.number({ error: missing }).int("Whole numbers only").min(0, "Can't be negative").max(1_000_000, "Too large");

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name").max(100, "Keep it under 100 characters"),
  sku: z.string().trim().max(50, "Keep the SKU under 50 characters"),
  categoryId: z.union([z.literal(""), z.uuid()]),
  price: money("Enter a selling price"),
  cost: money("Enter a cost price"),
  stockQuantity: count("Enter the stock on hand"),
  lowStockThreshold: count("Enter a low-stock threshold"),
  isActive: z.boolean(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a category name")
  .max(50, "Keep it under 50 characters");

export const adjustStockSchema = z
  .object({
    productId: z.uuid(),
    type: z.enum(["RESTOCK", "ADJUSTMENT"]),
    quantity: count("Enter a quantity"),
    notes: z.string().trim().max(200, "Keep notes under 200 characters"),
  })
  .refine((v) => v.type === "ADJUSTMENT" || v.quantity >= 1, {
    path: ["quantity"],
    message: "Restock at least 1 unit",
  });
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const voidSaleSchema = z.object({
  saleId: z.uuid(),
  reason: z.string().trim().min(1, "Say why you're voiding this sale").max(150, "Use at most 150 characters"),
});
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;

export const settingsSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name").max(100, "Keep it under 100 characters"),
  ownerName: z.string().trim().max(100, "Keep it under 100 characters"),
  currency: z.enum(CURRENCIES),
  taxRate: z
    .number({ error: "Enter a tax rate (0 for none)" })
    .min(0, "Can't be negative")
    .max(100, "Can't be more than 100%")
    .refine(twoDecimals, "Use at most 2 decimal places"),
  timezone: z.string().refine(isValidTimezone, "Choose a timezone"),
  uiTheme: z.enum(["classic", "light", "dark"]),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const newPassword = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");

export const signUpSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name").max(100, "Keep it under 100 characters"),
  ownerName: z.string().trim().max(100, "Keep it under 100 characters"),
  email: z.email("Enter a valid email address"),
  password: newPassword,
  timezone: z.string(),
});

export const resetRequestSchema = z.object({ email: z.email("Enter a valid email address") });

export const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match" });

export const checkoutSchema = z.object({
  saleId: z.uuid(),
  items: z
    .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(10_000) }))
    .min(1, "The cart is empty")
    .max(200, "That's too many different items for one sale"),
  paymentMethod: z.enum(PAYMENT_METHODS.map((m) => m.value) as ["cash", "card", "gcash", "other"]),
  discount: money("Enter a discount (0 for none)"),
  expectedTotal: money("Missing total"),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
