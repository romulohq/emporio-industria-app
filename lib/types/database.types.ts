export type OrderStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type OrderPriority = "low" | "medium" | "high";
export type MovementType = "entry" | "exit" | "adjustment";

export type Sector = {
  id: string;
  name: string;
  slug: string;
  unit_id: string | null;
  created_at: string;
};

export type SectorResponsible = {
  id: string;
  sector_id: string;
  role_name: string;
  person_name: string;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
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
  delivery_date: string | null;
  late_for_order_id: string | null;
  late_acknowledged: boolean;
  late_without_order: boolean;
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

export type OrderRegeneration = {
  id: string;
  sector_id: string;
  delivery_date: string;
  version_number: number;
  reason: string | null;
  triggered_by: string | null;
  created_at: string;
  snapshot: unknown;
};

export type LateReportDecisionRow = {
  id: string;
  report_id: string;
  sector_id: string;
  delivery_date: string;
  decision: "regenerated" | "kept";
  decided_by: string | null;
  decided_at: string;
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
  units_per_box: number;
  production_group: number | null;
  responsible_id: string | null;
  is_low_stock: boolean;
  active: boolean;
  converted_to: "subproduct" | "raw_material" | null;
  converted_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StockCount = {
  id: string;
  count_date: string;
  product_id: string;
  sector_id: string;
  boxes: number;
  units_per_box: number;
  stock_units: number;
  counted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleItem = {
  id: string;
  section: "salgados" | "folheados" | "paes" | "cozinha";
  name: string;
  position: number;
  active: boolean;
  recipe_product_id: string | null;
  recipe_subproduct_id: string | null;
  created_at: string;
};

export type ScheduleWeek = {
  week_start: string;
  notes: string;
  holidays: number[];
  updated_at: string;
};

export type ScheduleCell = {
  week_start: string;
  item_id: string;
  weekday: number;
  label: string;
  updated_by: string | null;
  updated_at: string;
};

export type Subproduct = {
  id: string;
  name: string;
  unit: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

export type Recipe = {
  id: string;
  product_id: string | null;
  subproduct_id: string | null;
  yield_quantity: number | null;
  yield_unit: string;
  instructions: string;
  updated_by: string | null;
  updated_at: string;
};

export type HortifrutiCount = {
  count_date: string;
  raw_material_id: string;
  quantity: number;
  counted_by: string | null;
  updated_at: string;
};

export type RawMaterial = {
  id: string;
  name: string;
  unit: string;
  code: string | null;
  category: "geral" | "hortifruti";
  active: boolean;
  created_by: string | null;
  created_at: string;
};

export type RecipeItem = {
  id: string;
  recipe_id: string;
  position: number;
  ingredient_name: string | null;
  subproduct_id: string | null;
  raw_material_id: string | null;
  quantity: number;
  unit: string;
};

export type UserReminder = {
  id: string;
  user_id: string;
  text: string;
  done: boolean;
  created_at: string;
  done_at: string | null;
};

export type ProductionOrder = {
  id: string;
  product_id: string;
  sector_id: string;
  route_id: string | null;
  delivery_date: string | null;
  generated_at: string | null;
  current_version: number;
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

export type ErpImport = {
  id: string;
  file_name: string;
  file_path: string | null;
  unit: string | null;
  period_start: string | null;
  period_end: string | null;
  rows_total: number;
  rows_inserted: number;
  rows_updated: number;
  rows_with_warning: number;
  imported_by: string | null;
  imported_by_name: string | null;
  created_at: string;
};

export type ErpProductionOrder = {
  id: string;
  unit: string;
  order_number: number;
  product_code: string;
  erp_description: string;
  packaging: string | null;
  unit_measure: string | null;
  /** UM que o relatório do ERP trouxe (a unit_measure pode ter sido corrigida para KG) */
  erp_unit_measure: string | null;
  item_type: string | null;
  launch_date: string;
  quantity: number;
  unit_cost: number | null;
  status: string;
  excluded: boolean;
  note: string | null;
  import_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpSector = "Pães" | "Salgados" | "Folheados" | "Cozinha";

export type ErpProductCatalogItem = {
  product_code: string;
  display_name: string;
  sector: ErpSector | null;
  group_name: string | null;
  unit_measure: string | null;
  unit_weight_kg: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
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
      stock_counts: {
        Row: StockCount;
        Insert: Partial<StockCount>;
        Update: Partial<StockCount>;
        Relationships: Relationship[];
      };
      subproducts: {
        Row: Subproduct;
        Insert: Partial<Subproduct>;
        Update: Partial<Subproduct>;
        Relationships: Relationship[];
      };
      user_reminders: {
        Row: UserReminder;
        Insert: Partial<UserReminder>;
        Update: Partial<UserReminder>;
        Relationships: Relationship[];
      };
      hortifruti_counts: {
        Row: HortifrutiCount;
        Insert: Partial<HortifrutiCount>;
        Update: Partial<HortifrutiCount>;
        Relationships: Relationship[];
      };
      app_settings: {
        Row: { key: string; value: string; updated_at: string };
        Insert: { key: string; value: string; updated_at?: string };
        Update: { key?: string; value?: string; updated_at?: string };
        Relationships: Relationship[];
      };
      raw_materials: {
        Row: RawMaterial;
        Insert: Partial<RawMaterial>;
        Update: Partial<RawMaterial>;
        Relationships: Relationship[];
      };
      recipes: {
        Row: Recipe;
        Insert: Partial<Recipe>;
        Update: Partial<Recipe>;
        Relationships: Relationship[];
      };
      recipe_items: {
        Row: RecipeItem;
        Insert: Partial<RecipeItem>;
        Update: Partial<RecipeItem>;
        Relationships: Relationship[];
      };
      schedule_items: {
        Row: ScheduleItem;
        Insert: Partial<ScheduleItem>;
        Update: Partial<ScheduleItem>;
        Relationships: Relationship[];
      };
      schedule_weeks: {
        Row: ScheduleWeek;
        Insert: Partial<ScheduleWeek>;
        Update: Partial<ScheduleWeek>;
        Relationships: Relationship[];
      };
      schedule_cells: {
        Row: ScheduleCell;
        Insert: Partial<ScheduleCell>;
        Update: Partial<ScheduleCell>;
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
      sector_responsibles: {
        Row: SectorResponsible;
        Insert: Partial<SectorResponsible>;
        Update: Partial<SectorResponsible>;
        Relationships: Relationship[];
      };
      order_regenerations: {
        Row: OrderRegeneration;
        Insert: Partial<OrderRegeneration>;
        Update: Partial<OrderRegeneration>;
        Relationships: Relationship[];
      };
      late_report_decisions: {
        Row: LateReportDecisionRow;
        Insert: Partial<LateReportDecisionRow>;
        Update: Partial<LateReportDecisionRow>;
        Relationships: Relationship[];
      };
      erp_imports: {
        Row: ErpImport;
        Insert: Partial<ErpImport>;
        Update: Partial<ErpImport>;
        Relationships: Relationship[];
      };
      erp_production_orders: {
        Row: ErpProductionOrder;
        Insert: Partial<ErpProductionOrder>;
        Update: Partial<ErpProductionOrder>;
        Relationships: Relationship[];
      };
      erp_product_catalog: {
        Row: ErpProductCatalogItem;
        Insert: Partial<ErpProductCatalogItem>;
        Update: Partial<ErpProductCatalogItem>;
        Relationships: Relationship[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
