import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Typography, Tag, Divider, Space, Row, Col } from 'antd';
import { Shipment } from '../../types/shipment';
import { useTheme } from '../../contexts/ThemeContext';

const { Text } = Typography;

interface PackageModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (values: any) => void;
  initialValues?: Partial<Shipment>;
}

const PackageModal: React.FC<PackageModalProps> = ({
  visible,
  onCancel,
  onOk,
  initialValues,
}) => {
  const { theme } = useTheme();
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && initialValues) {
      form.setFieldsValue({
        item_sku: initialValues.item_sku,
        length: initialValues.length,
        width: initialValues.width,
        height: initialValues.height,
        weight_lbs: initialValues.weight_lbs,
        weight_oz: initialValues.weight_oz,
      });
    }
  }, [visible, initialValues, form]);


  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onOk(values);
      form.resetFields();
    } catch (errorInfo) {
      // Validation failed - errors are shown automatically by Ant Design
      // Don't close the modal if validation fails
      console.error('Validation failed:', errorInfo);
    }
  };

  return (
    <Modal
      title="Edit Package Details"
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      width={500}
      centered
      mask={true}
      maskClosable={false}
      okText="Save"
      cancelText="Cancel"
    >
      <Form form={form} layout="vertical" aria-label="Edit Package Details">
        <Row gutter={16}>
          <Col span={24}>
        <Form.Item 
          label="Item ID / SKU" 
          name="item_sku"
          rules={[{ max: 100, message: 'SKU must be less than 100 characters' }]}
          hasFeedback
        >
          <Input 
            placeholder="Enter item SKU (optional)"
            aria-label="Item SKU"
          />
        </Form.Item>
        </Col>
        </Row>

        <Form.Item label="Dimensions (inches)" style={{ marginBottom: 16 }}>
          <Row gutter={8}>
            <Col span={8}>
            <Form.Item
              label="Length"
              name="length"
              rules={[
                { required: true, message: 'Length is required' },
                {
                  validator: (_, value) => {
                    if (value == null || value === '') {
                      return Promise.resolve(); // Let required rule handle this
                    }
                    const numValue = Number(value);
                    if (isNaN(numValue) || numValue <= 0) {
                      return Promise.reject(new Error('Length must be greater than 0'));
                    }
                    if (numValue > 108) {
                      return Promise.reject(new Error('Length cannot exceed 108 inches'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              hasFeedback
              style={{ marginBottom: 0 }}
            >
              <InputNumber 
                type="number"
                style={{ width: '100%' }}
                placeholder="Length" 
                min={0.01} 
                max={108}
                step={0.1} 
                aria-label="Length in inches"
                aria-required="true"
              />
            </Form.Item>
            </Col>
            <Col span={8}>
            <Form.Item
              label="Width"
              name="width"
              rules={[
                { required: true, message: 'Width is required' },
                {
                  validator: (_, value) => {
                    if (value == null || value === '') {
                      return Promise.resolve(); // Let required rule handle this
                    }
                    const numValue = Number(value);
                    if (isNaN(numValue) || numValue <= 0) {
                      return Promise.reject(new Error('Width must be greater than 0'));
                    }
                    if (numValue > 108) {
                      return Promise.reject(new Error('Width cannot exceed 108 inches'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              hasFeedback
              style={{ marginBottom: 0 }}
            >
              <InputNumber 
                type="number"
                style={{ width: '100%' }}
                placeholder="Width" 
                min={0.01} 
                max={108}
                step={0.1} 
                aria-label="Width in inches"
                aria-required="true"
              />
            </Form.Item>
            </Col>
            <Col span={8}>
            <Form.Item
              label="Height"
              name="height"
              rules={[
                { required: true, message: 'Height is required' },
                {
                  validator: (_, value) => {
                    if (value == null || value === '') {
                      return Promise.resolve(); // Let required rule handle this
                    }
                    const numValue = Number(value);
                    if (isNaN(numValue) || numValue <= 0) {
                      return Promise.reject(new Error('Height must be greater than 0'));
                    }
                    if (numValue > 108) {
                      return Promise.reject(new Error('Height cannot exceed 108 inches'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              hasFeedback
              style={{ marginBottom: 0 }}
            >
              <InputNumber 
                type="number"
                style={{ width: '100%' }}
                placeholder="Height" 
                min={0.01} 
                max={108}
                step={0.1} 
                aria-label="Height in inches"
                aria-required="true"
              />
            </Form.Item>
            </Col>
          </Row>
        </Form.Item>

        <Form.Item label="Weight" style={{ marginBottom: 16 }}>
          <Row gutter={8}>
            <Col span={12}>
            <Form.Item
              label="lbs"
              name="weight_lbs"
              rules={[
                { required: true, message: 'Weight in pounds is required' },
                {
                  validator: (_, value) => {
                    if (value == null || value === '') {
                      return Promise.resolve(); // Let required rule handle this
                    }
                    const numValue = Number(value);
                    if (isNaN(numValue) || numValue < 0) {
                      return Promise.reject(new Error('Weight cannot be negative'));
                    }
                    if (numValue > 150) {
                      return Promise.reject(new Error('Weight cannot exceed 150 lbs'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              hasFeedback
              style={{ marginBottom: 0 }}
            >
              <InputNumber 
                placeholder="Pounds" 
                type="number"
                min={0} 
                style={{ width: '100%' }}
                max={150}
                step={0.1} 
                aria-label="Weight in pounds"
                aria-required="true"
              />
            </Form.Item>
            </Col>
            <Col span={12}>
            <Form.Item
              label="oz"
              name="weight_oz"
              rules={[
                { required: true, message: 'Weight in ounces is required' },
                {
                  validator: (_, value) => {
                    if (value == null || value === '') {
                      return Promise.resolve(); // Let required rule handle this
                    }
                    const numValue = Number(value);
                    if (isNaN(numValue) || numValue < 0) {
                      return Promise.reject(new Error('Ounces cannot be negative'));
                    }
                    if (numValue > 15.99) {
                      return Promise.reject(new Error('Ounces cannot exceed 15.99'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              hasFeedback
              style={{ marginBottom: 0 }}
            >
              <InputNumber 
                placeholder="Ounces" 
                type="number"
                min={0} 
                max={15.99}
                step={0.1} 
                style={{ width: '100%' }}
                aria-label="Weight in ounces"
                aria-required="true"
              />
            </Form.Item>
            </Col>
          </Row>
        </Form.Item>

        {/* Weight Calculation Breakdown */}
        {(initialValues?.dimensional_weight != null || initialValues?.billable_weight != null) && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ 
              padding: '12px', 
              background: theme === 'dark' ? '#1f1f1f' : '#f5f5f5', 
              borderRadius: '4px',
              marginBottom: '16px'
            }}>
              <Text strong style={{ fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                Weight Calculation
              </Text>
              <Space direction="vertical" size="small" style={{ width: '100%', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Actual Weight:</Text>
                  <Text>
                    {initialValues?.weight_lbs || form.getFieldValue('weight_lbs') || 0} lbs{' '}
                    {initialValues?.weight_oz || form.getFieldValue('weight_oz') || 0} oz
                  </Text>
                </div>
                {initialValues?.dimensional_weight != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Dimensional Weight:</Text>
                    <Text>
                      {Number(initialValues.dimensional_weight).toFixed(2)} lbs
                      <Text type="secondary" style={{ fontSize: '11px', marginLeft: '4px' }}>
                        (Volume ÷ 166)
                      </Text>
                    </Text>
                  </div>
                )}
                {initialValues?.billable_weight != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <Text strong>Billable Weight:</Text>
                    <Space>
                      <Text strong style={{ color: '#1890ff' }}>
                        {Number(initialValues.billable_weight).toFixed(2)} lbs
                      </Text>
                      {initialValues?.weight_type && (
                        <Tag color={initialValues.weight_type === 'dimensional' ? 'orange' : 'blue'}>
                          {initialValues.weight_type === 'dimensional' ? 'Dimensional' : 'Actual'}
                        </Tag>
                      )}
                    </Space>
                  </div>
                )}
              </Space>
            </div>
          </>
        )}

        {/* Zone Information */}
        {initialValues?.shipping_zone && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ 
              padding: '12px', 
              background: theme === 'dark' ? '#1f1f1f' : '#f5f5f5', 
              borderRadius: '4px'
            }}>
              <Text strong style={{ fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                Shipping Zone
              </Text>
              <Space>
                <Text>Zone {initialValues.shipping_zone}</Text>
                <Tag color={initialValues.zone_type === 'intrastate' ? 'blue' : 'orange'}>
                  {initialValues.zone_type === 'intrastate' ? 'Intrastate' : 'Interstate'}
                </Tag>
              </Space>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default PackageModal;

