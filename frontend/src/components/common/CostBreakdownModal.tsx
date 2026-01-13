import React from 'react';
import {
  Modal,
  Typography,
  Tag,
  Divider,
  Space,
  Descriptions,
} from 'antd';
import { CostBreakdown } from '../../types/shipment';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Text } = Typography;

interface CostBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  breakdown: CostBreakdown | null;
  shipmentId?: number;
}

const CostBreakdownModal: React.FC<CostBreakdownModalProps> = ({
  visible,
  onClose,
  breakdown,
  shipmentId,
}) => {
  const { theme } = useTheme();

  if (!breakdown) {
    return null;
  }

  const formatWeight = (lbs: number, oz: number) => {
    if (lbs === 0 && oz === 0) return '0 oz';
    if (lbs === 0) return `${oz} oz`;
    if (oz === 0) return `${lbs} lbs`;
    return `${lbs} lbs ${oz} oz`;
  };

  const formatTotalOz = (lbs: number, oz: number) => {
    const totalOz = (lbs * 16) + oz;
    return `${totalOz} oz`;
  };

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>Shipping Cost Breakdown</Title>
          {shipmentId && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Shipment #{shipmentId}
            </Text>
          )}
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Weight Information */}
        <div>
          <Title level={5}>Weight Information</Title>
          <Descriptions
            column={1}
            bordered
            size="small"
            style={{
              background: theme === 'dark' ? '#1f1f1f' : '#fafafa',
            }}
          >
            <Descriptions.Item label="Actual Weight">
              {formatWeight(breakdown.actual_weight_lbs, breakdown.actual_weight_oz)}
            </Descriptions.Item>
            {breakdown.dimensional_weight_lbs != null && (
              <Descriptions.Item label="Dimensional Weight">
                <Space>
                  <Text>{breakdown.dimensional_weight_lbs.toFixed(2)} lbs</Text>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    (Calculated from dimensions)
                  </Text>
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Billable Weight">
              <Space>
                <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                  {formatWeight(breakdown.billable_weight_lbs, breakdown.billable_weight_oz)}
                </Text>
                <Tag color={breakdown.weight_type === 'dimensional' ? 'orange' : 'blue'}>
                  {breakdown.weight_type === 'dimensional' ? 'Dimensional' : 'Actual'}
                </Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Zone Information */}
        <div>
          <Title level={5}>Zone Information</Title>
          <Descriptions
            column={1}
            bordered
            size="small"
            style={{
              background: theme === 'dark' ? '#1f1f1f' : '#fafafa',
            }}
          >
            <Descriptions.Item label="Shipping Zone">
              <Space>
                <Text strong>Zone {breakdown.shipping_zone}</Text>
                <Tag color={breakdown.zone_type === 'intrastate' ? 'blue' : 'orange'}>
                  {breakdown.zone_type === 'intrastate' ? 'Intrastate' : 'Interstate'}
                </Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Rate Details */}
        <div>
          <Title level={5}>Rate Details</Title>
          <Descriptions
            column={1}
            bordered
            size="small"
            style={{
              background: theme === 'dark' ? '#1f1f1f' : '#fafafa',
            }}
          >
            <Descriptions.Item label="Provider">
              <Text strong>{breakdown.provider}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Service">
              <Text strong>{breakdown.service}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Base Price">
              <Text>${parseFloat(breakdown.base_price).toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={`Per-Ounce Rate (Zone ${breakdown.shipping_zone})`}>
              <Text>${parseFloat(breakdown.per_oz_rate).toFixed(3)}/oz</Text>
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Calculation Breakdown */}
        <div>
          <Title level={5}>Calculation Breakdown</Title>
          <div
            style={{
              padding: '16px',
              background: theme === 'dark' ? '#1f1f1f' : '#f5f5f5',
              borderRadius: '4px',
              border: `1px solid ${theme === 'dark' ? '#303030' : '#d9d9d9'}`,
            }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Step 1: Base Price</Text>
                <Text strong>${breakdown.calculation.base_price.toFixed(2)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>
                  Step 2: Billable Weight = {formatTotalOz(breakdown.billable_weight_lbs, breakdown.billable_weight_oz)}
                </Text>
                <Text>{formatWeight(breakdown.billable_weight_lbs, breakdown.billable_weight_oz)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>
                  Step 3: Weight Cost = {formatTotalOz(breakdown.billable_weight_lbs, breakdown.billable_weight_oz)} × ${parseFloat(breakdown.per_oz_rate).toFixed(3)}/oz
                </Text>
                <Text strong>${breakdown.calculation.weight_cost.toFixed(2)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                <Text strong>Total Cost</Text>
                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                  ${breakdown.calculation.total.toFixed(2)}
                </Text>
              </div>
            </Space>
          </div>
        </div>
      </Space>

      <style>{`
        .ant-descriptions-item-label {
          background: ${theme === 'dark' ? '#1f1f1f' : '#fafafa'} !important;
          color: ${theme === 'dark' ? '#fff' : '#262626'} !important;
        }
        
        .ant-descriptions-item-content {
          background: ${theme === 'dark' ? '#141414' : '#fff'} !important;
          color: ${theme === 'dark' ? '#fff' : '#262626'} !important;
        }
      `}</style>
    </Modal>
  );
};

export default CostBreakdownModal;
