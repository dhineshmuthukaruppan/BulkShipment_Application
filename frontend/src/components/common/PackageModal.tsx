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
      <Form form={form} layout="vertical">
        <Form.Item label="Item ID / SKU" name="item_sku">
          <Input />
        </Form.Item>

        <Form.Item label="Dimensions (inches)">
          <Input.Group compact>
            <Form.Item
              name="length"
              rules={[{ required: true, message: 'Required' }]}
              style={{ width: '33%', marginRight: '8px' }}
            >
              <InputNumber placeholder="Length" min={0.01} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="width"
              rules={[{ required: true, message: 'Required' }]}
              style={{ width: '33%', marginRight: '8px' }}
            >
              <InputNumber placeholder="Width" min={0.01} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="height"
              rules={[{ required: true, message: 'Required' }]}
              style={{ width: '33%' }}
            >
              <InputNumber placeholder="Height" min={0.01} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Input.Group>
        </Form.Item>

        <Form.Item label="Weight">
          <Input.Group compact>
            <Form.Item
              name="weight_lbs"
              rules={[{ required: true, message: 'Required' }]}
              style={{ width: '50%', marginRight: '8px' }}
            >
              <InputNumber placeholder="Pounds" min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="weight_oz"
              rules={[{ required: true, message: 'Required' }]}
              style={{ width: '50%' }}
            >
              <InputNumber placeholder="Ounces" min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Input.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PackageModal;

