import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Radio,
  Checkbox,
  message,
  Divider,
  Select,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setCurrentStep, setShipments, setLabelSize } from '../../store/slices/wizardSlice';
import { shipmentService } from '../../services/shipmentService';
import { generateShippingLabelsPDF } from '../../utils/pdfGenerator';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Text } = Typography;

const Step4Purchase: React.FC = () => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const { shipments, totalCost } = useAppSelector((state) => state.wizard);
  const [labelSize, setLabelSizeLocal] = useState('letter');
  const [printSize, setPrintSize] = useState('letter');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [shippedShipments, setShippedShipments] = useState<any[]>([]);

  // Load shipped shipments (those with labels)
  useEffect(() => {
    loadShippedShipments();
  }, []);

  const loadShippedShipments = async () => {
    try {
      const allShipments = await shipmentService.getShipments();
      const shipped = allShipments.filter(s => s.has_label === true);
      setShippedShipments(shipped);
    } catch (error) {
      console.error('Failed to load shipped shipments:', error);
    }
  };

  const handlePurchase = async () => {
    if (shipments.length === 0) {
      message.warning('No shipments to purchase');
      return;
    }

    if (!termsAccepted) {
      message.warning('Please accept the terms and conditions to proceed');
      return;
    }

    setPurchasing(true);
    try {
      const shipmentIds = shipments.map(s => s.id);
      const result = await shipmentService.purchase(shipmentIds, labelSize);
      message.success(`Successfully created ${result.labels_created} labels!`);
      
      // Reload all shipments to get updated has_label and tracking_number
      const allShipments = await shipmentService.getShipments();
      dispatch(setShipments(allShipments));
      
      // Reload shipped shipments after purchase
      await loadShippedShipments();
      dispatch(setCurrentStep(5)); // Move to success step
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to purchase labels');
    } finally {
      setPurchasing(false);
    }
  };

  const handlePrintLabels = () => {
    if (shippedShipments.length === 0) {
      message.warning('No shipped products available to print. Please purchase labels first.');
      return;
    }

    try {
      generateShippingLabelsPDF(shippedShipments, {
        pageSize: printSize as 'letter' | '4x6',
        orientation: 'portrait',
      });
      message.success(`Generated PDF with ${shippedShipments.length} shipping label(s) in ${printSize === 'letter' ? 'A4/Letter' : '4x6'} format`);
    } catch (error: any) {
      message.error(error.message || 'Failed to generate PDF');
    }
  };

  return (
    <div>
      <Title level={2}>Purchase Labels</Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Label Size Selection */}
            <div>
              <Title level={4}>Label Size Selection</Title>
              <Radio.Group 
                value={labelSize} 
                onChange={(e) => {
                  const newSize = e.target.value as 'letter' | '4x6';
                  setLabelSizeLocal(newSize);
                  setPrintSize(newSize);
                  dispatch(setLabelSize(newSize));
                }}
                style={{ marginTop: 16 }}
              >
                <Space direction="vertical">
                  <Radio value="letter">Letter/A4 (Standard paper size - 8.5x11 or A4)</Radio>
                  <Radio value="4x6">4x6 inch (Thermal label format)</Radio>
                </Space>
              </Radio.Group>
            </div>

            <Divider />

            {/* Grand Total Display */}
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: '16px', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : undefined }}>Grand Total:</Text>
              <Title level={2} style={{ margin: '8px 0', color: '#1890ff' }}>
                ${(Number(totalCost) || 0).toFixed(2)}
              </Title>
            </div>

            <Divider />

            {/* Terms Acceptance */}
            <div>
              <Checkbox
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              >
                I accept the terms and conditions
              </Checkbox>
            </div>
          </Space>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => dispatch(setCurrentStep(3))}
            >
              Back
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={handlePurchase}
              loading={purchasing}
              disabled={shipments.length === 0 || !termsAccepted}
            >
              Purchase Labels
            </Button>
          </Space>
        </div>
      </Space>
    </div>
  );
};

export default Step4Purchase;

