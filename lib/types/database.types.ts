export type OrderStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type OrderPriority = "low" | "medium" | "high";
export type MovementType = "entry" | "exit" | "adjustment";

export type Sector = {
  id: string;
  name: string;
  slug: string;
  unit_id: string | null;
  responsible_name: string | null;
  created_at: string;
};

export type ProductionUnit = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type DeliveryRoute = {
  id: string;
  unit_id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Store = {
  id: string;
  route_id: string;
  name: string;
  access_token: string;
  active: boolean;
  created_at: string;
};

export type StoreProductMin = {
  store_id: string;
  product_id: string;
  min_quantity: number;
  updated_at: string;
};

export type StoreStockReport = {
  id: string;
  store_id: string;
  product_id: string;
  quantity_reported: number;
  submission_id: string;
  late_for_order_id: string | null;
  late_acknowledged: boolean;
  created_at: string;
};

export type OrderSource = "manual" | "auto_route";

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DeliveryPeriod = "morning" | "afternoon";

export type StoreDeliveryDay = {
  store_id: string;
  weekday: Weekday;
  period: DeliveryPeriod;
  position: number;
};

export type ProductionOrderContribution = {
  order_id: string;
  store_id: string;
  sector_id: string;
  quantity: number;
  report_id: string | null;
  locked: boolean;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type UserSector = {
  user_id: string;
  sector_id: string;
  created_at: string;
};

export type Product = {
  id: string;
  sector_id: string;
  name: string;
  sku: string | null;
  unit: string;
  current_quantity: number;
  min_quantity: number;
  is_low_stock: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductionOrder = {
  id: string;
  product_id: string;
  sector_id: string;
  route_id: string | null;
  delivery_date: string | null;
  generated_at: string | null;
  source: OrderSource;
  quantity: number;
  status: OrderStatus;
  priority: OrderPriority;
  notes: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StockMovement = {
  id: string;
  product_id: string;
  sector_id: string;
  movement_type: MovementType;
  quantity: number;
  reason: string | null;
  production_order_id: string | null;
  created_by: string;
  created_at: string;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  public: {
    Tables: {
      sectors: {
        Row: Sector;
        Insert: Partial<Sector>;
        Update: Partial<Sector>;
        Relationships: Relationship[];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: Relationship[];
      };
      user_sectors: {
        Row: UserSector;
        Insert: Partial<UserSector>;
        Update: Partial<UserSector>;
        Relationships: [
          {
            foreignKeyName: "user_sectors_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: Product;
        Insert: Partial<Product>;
        Update: Partial<Product>;
        Relationships: Relationship[];
      };
      production_orders: {
        Row: ProductionOrder;
        Insert: Partial<ProductionOrder>;
        Update: Partial<ProductionOrder>;
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: StockMovement;
        Insert: Partial<StockMovement>;
        Update: Partial<StockMovement>;
        Relationships: Relationship[];
      };
      production_units: {
        Row: ProductionUnit;
        Insert: Partial<ProductionUnit>;
        Update: Partial<ProductionUnit>;
        Relationships: Relationship[];
      };
      delivery_routes: {
        Row: DeliveryRoute;
        Insert: Partial<DeliveryRoute>;
        Update: Partial<DeliveryRoute>;
        Relationships: Relationship[];
      };
      stores: {
        Row: Store;
        Insert: Partial<Store>;
        Update: Partial<Store>;
        Relationships: Relationship[];
      };
      store_product_mins: {
        Row: StoreProductMin;
        Insert: Partial<StoreProductMin>;
        Update: Partial<StoreProductMin>;
        Relationships: Relationship[];
      };
      store_stock_reports: {
        Row: StoreStockReport;
        Insert: Partial<StoreStockReport>;
        Update: Partial<StoreStockReport>;
        Relationships: Relationship[];
      };
      production_order_contributions: {
        Row: ProductionOrderContribution;
        Insert: Partial<ProductionOrderContribution>;
        Update: Partial<ProductionOrderContribution>;
        Relationships: Relationship[];
      };
      store_delivery_days: {
        Row: StoreDeliveryDay;
        Insert: Partial<StoreDeliveryDay>;
        Update: Partial<StoreDeliveryDay>;
        Relationships: Relationship[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
