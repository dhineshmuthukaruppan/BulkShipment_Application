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
  address_validated: boolean;
  address_validation_api_used: string;
  address_corrections: string[];
  process_date: string | null; // Date when the order was processed (for dashboard analytics)
  formatted_from_address: string;
  formatted_to_address: string;
  package_details: string;
  validation_status: 'valid' | 'warning' | 'invalid';
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

