import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Radio,
  Checkbox,
  message,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setCurrentStep } from '../../store/slices/wizardSlice';
import { shipmentService } from '../../services/shipmentService';

const { Title, Text } = Typography;

const Step4Purchase: React.FC = () => {
  const dispatch = useAppDispatch();
  const { shipments, totalCost } = useAppSelector((state) => state.wizard);
  const [labelSize, setLabelSize] = useState('letter');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

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
      dispatch(setCurrentStep(5)); // Move to success step
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to purchase labels');
    } finally {
      setPurchasing(false);
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
                onChange={(e) => setLabelSize(e.target.value)}
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
              <Text type="secondary" style={{ fontSize: '16px' }}>Grand Total:</Text>
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
              Step 3
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

