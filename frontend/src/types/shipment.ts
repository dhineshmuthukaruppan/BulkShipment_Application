export interface Shipment {
  id: number;
  from_first_name: string;
  from_last_name: string;
  from_address: string;
  from_address2: string;
  from_city: string;
  from_state: string;
  from_zip: string;
  from_phone: string;
  to_first_name: string;
  to_last_name: string;
  to_address: string;
  to_address2: string;
  to_city: string;
  to_state: string;
  to_zip: string;
  to_phone: string;
  weight_lbs: number;
  weight_oz: number;
  length: number;
  width: number;
  height: number;
  order_number: string;
  item_sku: string;
  phone_num1: string;
  phone_num2: string;
  status: 'ready' | 'needs_review' | 'needs_review_address' | 'needs_review_package' | 'invalid';
  validation_errors: string[];
  validation_warnings: string[];
  validation_flags: string[];
  shipping_provider: string;
  shipping_service: string;
  shipping_cost: number | null;
  dimensional_weight?: number | null;
  billable_weight?: number | null;
  weight_type?: 'actual' | 'dimensional' | null;
  shipping_zone?: number | null;
  is_intrastate?: boolean;
  zone_type?: 'intrastate' | 'interstate' | null;
  weight_calculation_breakdown?: string;
  zone_info?: string;
  address_validated: boolean;
  address_validation_api_used: string;
  address_corrections: string[];
  process_date: string | null; // Date when the order was processed (for dashboard analytics)
  formatted_from_address: string;
  formatted_to_address: string;
  package_details: string;
  validation_status: 'valid' | 'warning' | 'invalid';
  has_label?: boolean; // Whether shipment has a shipping label (shipped)
  tracking_number?: string | null; // Tracking number if label exists
  created_at: string;
  updated_at: string;
}

export interface SavedAddress {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  address_type: 'from' | 'to';
  is_default: boolean;
}

export interface SavedPackage {
  id: number;
  name: string;
  length: number;
  width: number;
  height: number;
  weight_lbs: number;
  weight_oz: number;
  is_default: boolean;
}

export interface ShippingService {
  name: string;
  price: number;
  formatted_price: string;
}

export interface ZoneRate {
  base_price: string;
  per_oz_rate: string;
}

export interface ServiceRates {
  zones: {
    [zone: number]: ZoneRate;
  };
  zone_type?: 'intrastate' | 'interstate';
}

export interface ProviderRates {
  [serviceName: string]: ServiceRates;
}

export interface TariffChartData {
  providers: {
    USPS?: ProviderRates;
    UPS?: ProviderRates;
    FedEx?: ProviderRates;
  };
  zone_info: {
    intrastate_zones: number[];
    interstate_zones: number[];
  };
}

export interface CostBreakdown {
  actual_weight_lbs: number;
  actual_weight_oz: number;
  dimensional_weight_lbs?: number | null;
  billable_weight_lbs: number;
  billable_weight_oz: number;
  weight_type: 'actual' | 'dimensional';
  shipping_zone: number;
  zone_type: 'intrastate' | 'interstate';
  provider: string;
  service: string;
  base_price: string;
  per_oz_rate: string;
  calculation: {
    base_price: number;
    weight_oz: number;
    weight_cost: number;
    total: number;
  };
}
