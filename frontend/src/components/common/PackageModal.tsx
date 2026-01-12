import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber } from 'antd';
import { Shipment } from '../../types/shipment';

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

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      onOk(values);
      form.resetFields();
    });
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

        <Form.Item label="Dimensions (inches)" required>
          <Input.Group compact>
            <Form.Item
              name="length"
              rules={[
                { required: true, message: 'Length is required' },
                { type: 'number', min: 0.01, message: 'Length must be greater than 0' },
                { type: 'number', max: 108, message: 'Length cannot exceed 108 inches' }
              ]}
              style={{ width: '33%', marginRight: '8px' }}
              hasFeedback
            >
              <InputNumber 
                placeholder="Length" 
                min={0.01} 
                max={108}
                step={0.1} 
                style={{ width: '100%' }}
                aria-label="Length in inches"
                aria-required="true"
              />
            </Form.Item>
            <Form.Item
              name="width"
              rules={[
                { required: true, message: 'Width is required' },
                { type: 'number', min: 0.01, message: 'Width must be greater than 0' },
                { type: 'number', max: 108, message: 'Width cannot exceed 108 inches' }
              ]}
              style={{ width: '33%', marginRight: '8px' }}
              hasFeedback
            >
              <InputNumber 
                placeholder="Width" 
                min={0.01} 
                max={108}
                step={0.1} 
                style={{ width: '100%' }}
                aria-label="Width in inches"
                aria-required="true"
              />
            </Form.Item>
            <Form.Item
              name="height"
              rules={[
                { required: true, message: 'Height is required' },
                { type: 'number', min: 0.01, message: 'Height must be greater than 0' },
                { type: 'number', max: 108, message: 'Height cannot exceed 108 inches' }
              ]}
              style={{ width: '33%' }}
              hasFeedback
            >
              <InputNumber 
                placeholder="Height" 
                min={0.01} 
                max={108}
                step={0.1} 
                style={{ width: '100%' }}
                aria-label="Height in inches"
                aria-required="true"
              />
            </Form.Item>
          </Input.Group>
        </Form.Item>

        <Form.Item label="Weight" required>
          <Input.Group compact>
            <Form.Item
              name="weight_lbs"
              rules={[
                { required: true, message: 'Weight in pounds is required' },
                { type: 'number', min: 0, message: 'Weight cannot be negative' },
                { type: 'number', max: 150, message: 'Weight cannot exceed 150 lbs' }
              ]}
              style={{ width: '50%', marginRight: '8px' }}
              hasFeedback
            >
              <InputNumber 
                placeholder="Pounds" 
                min={0} 
                max={150}
                step={0.1} 
                style={{ width: '100%' }}
                aria-label="Weight in pounds"
                aria-required="true"
              />
            </Form.Item>
            <Form.Item
              name="weight_oz"
              rules={[
                { required: true, message: 'Weight in ounces is required' },
                { type: 'number', min: 0, message: 'Ounces cannot be negative' },
                { type: 'number', max: 15.99, message: 'Ounces cannot exceed 15.99' }
              ]}
              style={{ width: '50%' }}
              hasFeedback
            >
              <InputNumber 
                placeholder="Ounces" 
                min={0} 
                max={15.99}
                step={0.1} 
                style={{ width: '100%' }}
                aria-label="Weight in ounces"
                aria-required="true"
              />
            </Form.Item>
          </Input.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PackageModal;

