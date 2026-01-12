import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Shipment } from '../types/shipment';

interface WizardContextType {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  shipments: Shipment[];
  setShipments: (shipments: Shipment[]) => void;
  selectedShipments: number[];
  setSelectedShipments: (ids: number[]) => void;
  totalCost: number;
  setTotalCost: (cost: number) => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const WizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipments, setSelectedShipments] = useState<number[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        shipments,
        setShipments,
        selectedShipments,
        setSelectedShipments,
        totalCost,
        setTotalCost,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return context;
};
