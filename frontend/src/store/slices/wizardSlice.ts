import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Shipment } from '../../types/shipment';

export interface Draft {
  id: string;
  name: string;
  step: number; // Step where draft was saved (2 or 3)
  shipments: Shipment[];
  selectedShipments: number[];
  totalCost: number;
  createdAt: string;
  updatedAt: string;
}

interface WizardState {
  currentStep: number;
  shipments: Shipment[];
  selectedShipments: number[];
  totalCost: number;
  drafts: Draft[];
  labelSize: 'letter' | '4x6';
}

const initialState: WizardState = {
  currentStep: 1,
  shipments: [],
  selectedShipments: [],
  totalCost: 0,
  drafts: [],
  labelSize: 'letter',
};

const wizardSlice = createSlice({
  name: 'wizard',
  initialState,
  reducers: {
    setCurrentStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },
    setShipments: (state, action: PayloadAction<Shipment[]>) => {
      // Ensure shipments is always an array
      state.shipments = Array.isArray(action.payload) ? action.payload : [];
    },
    addShipment: (state, action: PayloadAction<Shipment>) => {
      state.shipments.push(action.payload);
    },
    updateShipment: (state, action: PayloadAction<Shipment>) => {
      const index = state.shipments.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.shipments[index] = action.payload;
      }
    },
    removeShipment: (state, action: PayloadAction<number>) => {
      state.shipments = state.shipments.filter(s => s.id !== action.payload);
    },
    setSelectedShipments: (state, action: PayloadAction<number[]>) => {
      state.selectedShipments = action.payload;
    },
    addSelectedShipment: (state, action: PayloadAction<number>) => {
      if (!state.selectedShipments.includes(action.payload)) {
        state.selectedShipments.push(action.payload);
      }
    },
    removeSelectedShipment: (state, action: PayloadAction<number>) => {
      state.selectedShipments = state.selectedShipments.filter(id => id !== action.payload);
    },
    clearSelectedShipments: (state) => {
      state.selectedShipments = [];
    },
    setTotalCost: (state, action: PayloadAction<number>) => {
      state.totalCost = action.payload;
    },
    calculateTotalCost: (state) => {
      state.totalCost = state.shipments.reduce(
        (sum, shipment) => sum + (Number(shipment.shipping_cost) || 0),
        0
      );
    },
    resetWizard: (state) => {
      state.currentStep = 1;
      state.shipments = [];
      state.selectedShipments = [];
      state.totalCost = 0;
      state.labelSize = 'letter';
    },
    setLabelSize: (state, action: PayloadAction<'letter' | '4x6'>) => {
      state.labelSize = action.payload;
    },
    // Draft management
    saveDraft: (state, action: PayloadAction<{ name?: string; step: number }>) => {
      const { name, step } = action.payload;
      const draftName = name || `Draft ${new Date().toLocaleString()}`;
      const draftId = `draft-${Date.now()}`;
      const now = new Date().toISOString();
      
      const newDraft: Draft = {
        id: draftId,
        name: draftName,
        step,
        shipments: [...state.shipments],
        selectedShipments: [...state.selectedShipments],
        totalCost: state.totalCost,
        createdAt: now,
        updatedAt: now,
      };
      
      state.drafts.push(newDraft);
    },
    loadDraft: (state, action: PayloadAction<string>) => {
      const draft = state.drafts.find(d => d.id === action.payload);
      if (draft) {
        // Ensure shipments is always an array
        state.shipments = Array.isArray(draft.shipments) ? [...draft.shipments] : [];
        state.selectedShipments = Array.isArray(draft.selectedShipments) ? [...draft.selectedShipments] : [];
        state.totalCost = draft.totalCost;
        state.currentStep = draft.step;
      }
    },
    deleteDraft: (state, action: PayloadAction<string>) => {
      state.drafts = state.drafts.filter(d => d.id !== action.payload);
    },
    updateDraft: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const draft = state.drafts.find(d => d.id === action.payload.id);
      if (draft) {
        draft.name = action.payload.name;
        draft.updatedAt = new Date().toISOString();
      }
    },
  },
});

export const {
  setCurrentStep,
  setShipments,
  addShipment,
  updateShipment,
  removeShipment,
  setSelectedShipments,
  addSelectedShipment,
  removeSelectedShipment,
  clearSelectedShipments,
  setTotalCost,
  calculateTotalCost,
  resetWizard,
  saveDraft,
  loadDraft,
  deleteDraft,
  updateDraft,
  setLabelSize,
} = wizardSlice.actions;

export default wizardSlice.reducer;

