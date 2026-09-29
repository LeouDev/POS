// Mirrors supabase/migrations. Regenerate with `npx supabase gen types typescript --linked`
// once the CLI is linked to the project; keep in sync by hand until then.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PaymentMethod = "cash" | "card" | "gcash" | "other";
export type MovementType = "SALE" | "RESTOCK" | "ADJUSTMENT" | "VOID";
export type SaleStatus = "completed" | "voided";

type ProfileRow = {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string;
  currency: string;
  tax_rate: number;
  timezone: string;
  last_receipt_number: number;
  trial_ends_at: string;
  paid_until: string | null;
  created_at: string;
};

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

type ProductRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  price: number;
  cost: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SaleRow = {
  id: string;
  user_id: string;
  receipt_number: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

type SaleItemRow = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
};

type PaymentRow = {
  id: string;
  user_id: string;
  plan: "monthly" | "yearly";
  amount: number;
  checkout_session_id: string;
  payment_id: string | null;
  method: string | null;
  period_start: string;
  period_end: string;
  paid_at: string;
};

type MovementRow = {
  id: string;
  user_id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<Pick<ProfileRow, "user_id" | "business_name" | "owner_name" | "currency" | "tax_rate" | "timezone">>;
        Update: Partial<Pick<ProfileRow, "business_name" | "owner_name" | "currency" | "tax_rate" | "timezone">>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Pick<CategoryRow, "name"> & Partial<CategoryRow>;
        Update: Partial<Pick<CategoryRow, "name">>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Pick<ProductRow, "name" | "price"> &
          Partial<Omit<ProductRow, "is_low_stock" | "created_at" | "updated_at">>;
        Update: Partial<
          Pick<ProductRow, "category_id" | "name" | "sku" | "price" | "cost" | "low_stock_threshold" | "is_active">
        >;
        Relationships: [
          {
            foreignKeyName: "products_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      sales: {
        Row: SaleRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      sale_items: {
        Row: SaleItemRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: MovementRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: PaymentRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      complete_sale: {
        Args: { p_sale_id: string; p_items: Json; p_payment_method: string; p_discount?: number; p_expected_total?: number | null };
        Returns: SaleRow;
      };
      void_sale: {
        Args: { p_sale_id: string; p_reason: string };
        Returns: SaleRow;
      };
      adjust_stock: {
        Args: { p_product_id: string; p_type: string; p_quantity: number; p_notes?: string | null };
        Returns: ProductRow;
      };
      sales_report: {
        Args: { p_period: string };
        Returns: Json;
      };
      has_access: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      record_payment: {
        Args: {
          p_user_id: string;
          p_plan: string;
          p_amount: number;
          p_checkout_session_id: string;
          p_payment_id?: string | null;
          p_method?: string | null;
        };
        Returns: ProfileRow;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Profile = ProfileRow;
export type Category = CategoryRow;
export type Product = ProductRow;
export type Sale = SaleRow;
export type SaleItem = SaleItemRow;
export type Movement = MovementRow;
export type Payment = PaymentRow;
export type SaleWithItems = Sale & { sale_items: SaleItem[] };
export type ProductWithCategory = Product & { categories: { name: string } | null };

export type ReportPeriod = "today" | "7d" | "week" | "month";

/** Shape of the jsonb returned by public.sales_report(). */
export type SalesReport = {
  period: ReportPeriod;
  timezone: string;
  unit: "hour" | "day";
  from: string;
  to: string;
  revenue: number;
  tax: number;
  discount: number;
  net_sales: number;
  cost: number;
  profit: number;
  transactions: number;
  items_sold: number;
  average: number;
  by_payment: { method: PaymentMethod; total: number; count: number }[];
  top_products: { product_id: string; name: string; quantity: number; revenue: number; profit: number }[];
  series: { at: string; revenue: number; transactions: number }[];
};
