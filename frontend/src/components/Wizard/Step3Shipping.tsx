import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Select,
  Modal,
  message,
  Popconfirm,
  Empty,
  Skeleton,
} from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  setShipments,
  updateShipment,
  removeShipment,
  setSelectedShipments,
  clearSelectedShipments,
  setCurrentStep,
  calculateTotalCost,
  saveDraft,
} from '../../store/slices/wizardSlice';
import { shipmentService } from '../../services/shipmentService';
import { Shipment } from '../../types/shipment';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Text } = Typography;

// Shipping providers and their services
const SHIPPING_PROVIDERS = [
  { value: 'USPS', label: 'USPS' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
];

const SHIPPING_SERVICES: Record<string, Array<{ value: string; label: string; priceRange: string }>> = {
  USPS: [
    { value: 'Priority Mail', label: 'Priority Mail', priceRange: '$4.00 - $8.00' },
    { value: 'Ground Shipping', label: 'Ground Shipping', priceRange: '$2.00 - $5.00' },
    { value: 'First Class', label: 'First Class', priceRange: '$3.00 - $6.00' },
  ],
  FedEx: [
    { value: 'FedEx Ground', label: 'FedEx Ground', priceRange: '$5.00 - $10.00' },
    { value: 'FedEx Express', label: 'FedEx Express', priceRange: '$15.00 - $25.00' },
    { value: 'FedEx Overnight', label: 'FedEx Overnight', priceRange: '$25.00 - $40.00' },
  ],
  UPS: [
    { value: 'UPS Ground', label: 'UPS Ground', priceRange: '$5.00 - $10.00' },
    { value: 'UPS Next Day Air', label: 'UPS Next Day Air', priceRange: '$20.00 - $35.00' },
    { value: 'UPS 2nd Day Air', label: 'UPS 2nd Day Air', priceRange: '$12.00 - $20.00' },
  ],
};

const Step3Shipping: React.FC = () => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const { shipments, selectedShipments, totalCost } = useAppSelector((state) => state.wizard);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  useEffect(() => {
    dispatch(calculateTotalCost());
  }, [shipments, dispatch]);

  const handleProviderChange = async (shipmentId: number, provider: string) => {
    try {
      // When provider changes, reset to first service of that provider
      const firstService = SHIPPING_SERVICES[provider]?.[0]?.value || 'Ground Shipping';
      await shipmentService.bulkUpdate([shipmentId], { 
        shipping_provider: provider,
        shipping_service: firstService 
      });
      
      // Fetch only the updated shipment instead of all shipments
      const updated = await shipmentService.getShipment(shipmentId);
      dispatch(updateShipment(updated));
      dispatch(calculateTotalCost());
      message.success('Shipping provider updated');
    } catch (error) {
      message.error('Failed to update shipping provider');
    }
  };

  const handleServiceChange = async (shipmentId: number, service: string) => {
    try {
      const result = await shipmentService.calculateShipping(shipmentId, service);
      
      // Fetch only the updated shipment instead of all shipments
      const updated = await shipmentService.getShipment(shipmentId);
      dispatch(updateShipment(updated));
      dispatch(calculateTotalCost());
      message.success('Shipping cost updated');
    } catch (error) {
      message.error('Failed to update shipping service');
    }
  };

  const handleBulkProviderChange = async (provider: string) => {
    try {
      const firstService = SHIPPING_SERVICES[provider]?.[0]?.value || 'Ground Shipping';
      await shipmentService.bulkUpdate(selectedShipments, { 
        shipping_provider: provider,
        shipping_service: firstService 
      });
      
      // Fetch only the updated shipments instead of all shipments
      const updatedShipments = await Promise.all(
        selectedShipments.map(id => shipmentService.getShipment(id))
      );
      
      // Update Redux state with refreshed shipments
      const updatedShipmentsMap = new Map(updatedShipments.map(s => [s.id, s]));
      const refreshedShipments = shipments.map(s => 
        updatedShipmentsMap.get(s.id) || s
      );
      dispatch(setShipments(refreshedShipments));
      dispatch(clearSelectedShipments());
      dispatch(calculateTotalCost());
      message.success(`Updated ${selectedShipments.length} shipments`);
    } catch (error) {
      message.error('Failed to update shipping providers');
    }
  };

  const handleBulkServiceChange = async (service: string) => {
    try {
      await shipmentService.bulkUpdate(selectedShipments, { shipping_service: service });
      
      // Fetch only the updated shipments instead of all shipments
      const updatedShipments = await Promise.all(
        selectedShipments.map(id => shipmentService.getShipment(id))
      );
      
      // Update Redux state with refreshed shipments
      const updatedShipmentsMap = new Map(updatedShipments.map(s => [s.id, s]));
      const refreshedShipments = shipments.map(s => 
        updatedShipmentsMap.get(s.id) || s
      );
      dispatch(setShipments(refreshedShipments));
      dispatch(clearSelectedShipments());
      dispatch(calculateTotalCost());
      message.success(`Updated ${selectedShipments.length} shipments`);
    } catch (error) {
      message.error('Failed to update shipping services');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await shipmentService.deleteShipment(id);
      dispatch(removeShipment(id));
      dispatch(calculateTotalCost());
      message.success('Shipment deleted');
    } catch (error) {
      message.error('Failed to delete shipment');
    }
  };

  const getServicesForProvider = (provider: string) => {
    return SHIPPING_SERVICES[provider] || SHIPPING_SERVICES['USPS'];
  };

  const getMostAffordableService = (provider: string) => {
    const services = getServicesForProvider(provider);
    // Return the first service (they should be sorted by price)
    return services[0]?.value || 'Ground Shipping';
  };

  const columns: ColumnsType<Shipment> = [
    {
      title: 'Ship From Address',
      dataIndex: 'formatted_from_address',
      ellipsis: true,
    },
    {
      title: 'Ship To Address',
      dataIndex: 'formatted_to_address',
      ellipsis: true,
    },
    {
      title: 'Package Details',
      dataIndex: 'package_details',
      width: 200,
    },
    {
      title: 'Order No',
      dataIndex: 'order_number',
      width: 120,
    },
    {
      title: 'Shipping Provider',
      width: 150,
      render: (_, record) => (
        <Select
          value={record.shipping_provider || 'USPS'}
          style={{ width: '100%' }}
          onChange={(value) => handleProviderChange(record.id, value)}
          options={SHIPPING_PROVIDERS}
        />
      ),
    },
    {
      title: 'Shipping Service',
      width: 200,
      render: (_, record) => {
        const provider = record.shipping_provider || 'USPS';
        const services = getServicesForProvider(provider);
        return (
          <Select
            value={record.shipping_service}
            style={{ width: '100%' }}
            onChange={(value) => handleServiceChange(record.id, value)}
            options={services.map(s => ({
              label: `${s.label} (${s.priceRange})`,
              value: s.value,
            }))}
          />
        );
      },
    },
    {
      title: 'Cost',
      width: 100,
      render: (_, record) => {
        const cost = Number(record.shipping_cost) || 0;
        return <Text strong>${cost.toFixed(2)}</Text>;
      },
    },
    {
      title: 'Actions',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="Delete this shipment?"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedShipments,
    onChange: (selectedKeys: React.Key[]) => {
      dispatch(setSelectedShipments(selectedKeys as number[]));
    },
  };

  return (
    <div>
      <Title level={2}>Select Shipping Provider (Step 3 of 3)</Title>

      {/* Total Price Display in Header Area */}
      <div style={{ 
        marginBottom: '24px', 
        textAlign: 'right',
        padding: '12px 16px',
        background: '#f5f5f5',
        borderRadius: '4px',
      }}>
        <Text strong style={{ fontSize: '18px' }}>
          Total: ${(Number(totalCost) || 0).toFixed(2)}
        </Text>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          {selectedShipments.length > 0 && (
            <Space style={{ marginBottom: 16 }} wrap>
              <Button onClick={() => {
                Modal.confirm({
                  title: 'Change Shipping Provider',
                  content: (
                    <div>
                      <p style={{ marginBottom: 16 }}>Select a shipping provider to apply to all selected shipments:</p>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="Select provider"
                        onChange={(value) => {
                          handleBulkProviderChange(value);
                          Modal.destroyAll();
                        }}
                        options={SHIPPING_PROVIDERS}
                      />
                    </div>
                  ),
                  onOk: () => {},
                  okText: 'Close',
                  cancelText: 'Cancel',
                  centered: true,
                  mask: true,
                  maskClosable: false,
                });
              }}>
                Change Provider for Selected
              </Button>
              <Button onClick={() => {
                // Get the most common provider from selected shipments
                const selectedShipmentData = shipments.filter(s => selectedShipments.includes(s.id));
                const mostCommonProvider = selectedShipmentData[0]?.shipping_provider || 'USPS';
                
                Modal.confirm({
                  title: 'Change Shipping Service',
                  content: (
                    <div>
                      <p style={{ marginBottom: 16 }}>Select a shipping service to apply to all selected shipments:</p>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="Select service"
                        onChange={(value) => {
                          handleBulkServiceChange(value);
                          Modal.destroyAll();
                        }}
                        options={[
                          { 
                            label: 'Switch to the most affordable rate available', 
                            value: getMostAffordableService(mostCommonProvider) 
                          },
                          { 
                            label: 'Change to Priority Mail', 
                            value: 'Priority Mail' 
                          },
                          { 
                            label: 'Change to Ground Shipping', 
                            value: 'Ground Shipping' 
                          },
                        ]}
                      />
                    </div>
                  ),
                  onOk: () => {},
                  okText: 'Close',
                  cancelText: 'Cancel',
                  centered: true,
                  mask: true,
                  maskClosable: false,
                });
              }}>
                Change Service for Selected
              </Button>
            </Space>
          )}

          <Table
            columns={columns}
            dataSource={shipments}
            rowKey="id"
            rowSelection={rowSelection}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Space>
            <Button
              icon={<SaveOutlined />}
              onClick={() => {
                dispatch(calculateTotalCost());
                dispatch(saveDraft({ step: 3 }));
                message.success('Draft saved successfully!');
                dispatch(setCurrentStep(1));
              }}
              disabled={shipments.length === 0}
            >
              Save as Draft
            </Button>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => dispatch(setCurrentStep(2))}
            >
              Step 2
            </Button>
            <Button
              type="primary"
              onClick={() => dispatch(setCurrentStep(4))}
              disabled={shipments.length === 0}
            >
              Step 4 <ArrowRightOutlined />
            </Button>
          </Space>
        </div>
      </Space>
    </div>
  );
};

export default Step3Shipping;
