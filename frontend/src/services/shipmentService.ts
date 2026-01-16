import api, { API_URL } from './api';
import axios from 'axios';
import { Shipment, SavedAddress, SavedPackage, TariffChartData, CostBreakdown } from '../types/shipment';

export const shipmentService = {
  // Upload CSV
  uploadCSV: async (file: File, processDate?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (processDate) {
      formData.append('process_date', processDate);
    }
    // Use axios directly for file uploads to avoid Content-Type header conflicts
    // Axios will automatically set the correct Content-Type with boundary for FormData
    try {
      const response = await axios.post(`${API_URL}/shipments/upload_csv/`, formData, {
        headers: {
          // Don't set Content-Type - let axios/browser set it automatically with boundary
        },
        timeout: 60000, // 60 second timeout for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return response.data;
    } catch (error: any) {
      // Provide more detailed error messages
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timeout - the file may be too large or the server is not responding');
      } else if (error.response) {
        // Server responded with error status
        const errorMessage = error.response.data?.error || 
                           error.response.data?.message || 
                           `Server error: ${error.response.status} ${error.response.statusText}`;
        throw new Error(errorMessage);
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('No response from server. Please check if the backend server is running on http://localhost:8000');
      } else {
        // Something else happened
        throw new Error(error.message || 'Failed to upload file');
      }
    }
  },

  // Get all shipments
  getShipments: async (): Promise<Shipment[]> => {
    try {
      const response = await api.get('/shipments/');
      // Ensure we always return an array
      if (Array.isArray(response.data)) {
        return response.data;
      }
      // Handle case where API returns an object with results property
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      // Return empty array if data is not in expected format
      console.warn('API response is not an array:', response.data);
      return [];
    } catch (error: any) {
      console.error('Failed to fetch shipments:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  },

  // Get single shipment
  getShipment: async (id: number): Promise<Shipment> => {
    const response = await api.get(`/shipments/${id}/`);
    return response.data;
  },

  // Update shipment
  updateShipment: async (id: number, data: Partial<Shipment>): Promise<Shipment> => {
    const response = await api.patch(`/shipments/${id}/`, data);
    return response.data;
  },

  // Delete shipment
  deleteShipment: async (id: number): Promise<void> => {
    try {
      await api.delete(`/shipments/${id}/`);
    } catch (error: any) {
      // If shipment doesn't exist (404), treat as success (already deleted)
      if (error.response && error.response.status === 404) {
        console.warn(`Shipment ${id} not found (may have been already deleted)`);
        return; // Treat as success
      }
      // Re-throw other errors
      throw error;
    }
  },

  // Bulk update
  bulkUpdate: async (ids: number[], updates: any) => {
    const response = await api.post('/shipments/bulk_update/', {
      ids,
      updates,
    });
    return response.data;
  },

  // Validate address
  validateAddress: async (id: number) => {
    const response = await api.post(`/shipments/${id}/validate_address/`);
    return response.data;
  },

  // Calculate shipping
  calculateShipping: async (id: number, service: string, provider?: string): Promise<{
    service: string;
    provider?: string;
    cost: number;
    formatted_cost: string;
    breakdown?: CostBreakdown;
  }> => {
    const response = await api.post(`/shipments/${id}/calculate_shipping/`, {
      service,
      provider,
    });
    return response.data;
  },

  // Purchase labels
  purchase: async (shipmentIds: number[], labelSize: string) => {
    const response = await api.post('/shipments/purchase/', {
      shipment_ids: shipmentIds,
      label_size: labelSize,
    });
    return response.data;
  },

  // Clear all shipments (for preview rejection)
  clearAll: async () => {
    const response = await api.delete('/shipments/clear_all/');
    return response.data;
  },

  // Get tariff chart
  getTariffChart: async (): Promise<TariffChartData> => {
    try {
      const response = await api.get('/shipments/get_tariff_chart/');
      const data = response.data;
      // Ensure the response has the expected structure
      if (!data || !data.providers) {
        console.warn('Invalid tariff chart data structure:', data);
        return {
          providers: {},
          zone_info: {
            intrastate_zones: [],
            interstate_zones: [],
          },
        };
      }
      // Ensure zone_info exists
      if (!data.zone_info) {
        data.zone_info = {
          intrastate_zones: [],
          interstate_zones: [],
        };
      }
      return data;
    } catch (error: any) {
      console.error('Failed to fetch tariff chart:', error);
      // Return empty structure on error
      return {
        providers: {},
        zone_info: {
          intrastate_zones: [],
          interstate_zones: [],
        },
      };
    }
  },

  // Test address validation
  testValidateAddress: async (address: {
    first_name?: string;
    last_name?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
  }) => {
    const response = await api.post('/shipments/test_validate_address/', {
      address,
    });
    return response.data;
  },

  // Batch validate both addresses
  batchValidateAddresses: async (fromAddress: {
    first_name?: string;
    last_name?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
  }, toAddress: {
    first_name?: string;
    last_name?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
  }) => {
    const response = await api.post('/shipments/batch_validate_addresses/', {
      from_address: fromAddress,
      to_address: toAddress,
    });
    return response.data;
  },
};

export const savedAddressService = {
  getAll: async (addressType?: 'from' | 'to'): Promise<SavedAddress[]> => {
    try {
      const params = addressType ? { address_type: addressType } : {};
      const response = await api.get('/saved-addresses/', { params });
      // Ensure we always return an array
      if (Array.isArray(response.data)) {
        return response.data;
      }
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      console.warn('API response is not an array:', response.data);
      return [];
    } catch (error: any) {
      console.error('Failed to fetch saved addresses:', error);
      return [];
    }
  },
  getById: async (id: number): Promise<SavedAddress> => {
    const response = await api.get(`/saved-addresses/${id}/`);
    return response.data;
  },
  create: async (data: Partial<SavedAddress>): Promise<SavedAddress> => {
    const response = await api.post('/saved-addresses/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<SavedAddress>): Promise<SavedAddress> => {
    const response = await api.patch(`/saved-addresses/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/saved-addresses/${id}/`);
  },
  setDefault: async (id: number): Promise<SavedAddress> => {
    const response = await api.patch(`/saved-addresses/${id}/`, { is_default: true });
    return response.data;
  },
};

export const savedPackageService = {
  getAll: async (): Promise<SavedPackage[]> => {
    try {
      const response = await api.get('/saved-packages/');
      // Ensure we always return an array
      if (Array.isArray(response.data)) {
        return response.data;
      }
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      console.warn('API response is not an array:', response.data);
      return [];
    } catch (error: any) {
      console.error('Failed to fetch saved packages:', error);
      return [];
    }
  },
  getById: async (id: number): Promise<SavedPackage> => {
    const response = await api.get(`/saved-packages/${id}/`);
    return response.data;
  },
  create: async (data: Partial<SavedPackage>): Promise<SavedPackage> => {
    const response = await api.post('/saved-packages/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<SavedPackage>): Promise<SavedPackage> => {
    const response = await api.patch(`/saved-packages/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/saved-packages/${id}/`);
  },
  setDefault: async (id: number): Promise<SavedPackage> => {
    const response = await api.patch(`/saved-packages/${id}/`, { is_default: true });
    return response.data;
  },
};

export interface OrderNumberSettings {
  id?: number;
  prefix: string;
  starting_number: number;
  number_format: string;
  separator: string;
  is_active: boolean;
  example?: string;
  created_at?: string;
  updated_at?: string;
}

export const orderNumberSettingsService = {
  getActive: async (): Promise<OrderNumberSettings> => {
    const response = await api.get('/order-number-settings/active/');
    return response.data;
  },
  getAll: async (): Promise<OrderNumberSettings[]> => {
    const response = await api.get('/order-number-settings/');
    return response.data;
  },
  getById: async (id: number): Promise<OrderNumberSettings> => {
    const response = await api.get(`/order-number-settings/${id}/`);
    return response.data;
  },
  create: async (data: Partial<OrderNumberSettings>): Promise<OrderNumberSettings> => {
    const response = await api.post('/order-number-settings/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<OrderNumberSettings>): Promise<OrderNumberSettings> => {
    const response = await api.patch(`/order-number-settings/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/order-number-settings/${id}/`);
  },
};
