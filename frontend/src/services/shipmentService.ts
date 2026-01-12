import api from './api';
import axios from 'axios';
import { Shipment, SavedAddress, SavedPackage } from '../types/shipment';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

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
    const response = await axios.post(`${API_URL}/shipments/upload_csv/`, formData, {
      headers: {
        // Don't set Content-Type - let axios/browser set it automatically with boundary
      },
    });
    return response.data;
  },

  // Get all shipments
  getShipments: async (): Promise<Shipment[]> => {
    const response = await api.get('/shipments/');
    return response.data;
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
    await api.delete(`/shipments/${id}/`);
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
  calculateShipping: async (id: number, service: string) => {
    const response = await api.post(`/shipments/${id}/calculate_shipping/`, {
      service,
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
};

export const savedAddressService = {
  getAll: async (): Promise<SavedAddress[]> => {
    const response = await api.get('/saved-addresses/');
    return response.data;
  },
};

export const savedPackageService = {
  getAll: async (): Promise<SavedPackage[]> => {
    const response = await api.get('/saved-packages/');
    return response.data;
  },
};
