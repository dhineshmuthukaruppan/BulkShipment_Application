import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Space } from 'antd';
import { Shipment } from '../../types/shipment';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR'
];

interface AddressModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (values: any) => void;
  initialValues?: Partial<Shipment>;
  title: string;
  addressType: 'from' | 'to';
}

const AddressModal: React.FC<AddressModalProps> = ({
  visible,
  onCancel,
  onOk,
  initialValues,
  title,
  addressType,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && initialValues) {
      const prefix = addressType === 'from' ? 'from_' : 'to_';
      form.setFieldsValue({
        first_name: initialValues[`${prefix}first_name` as keyof Shipment],
        last_name: initialValues[`${prefix}last_name` as keyof Shipment],
        address: initialValues[`${prefix}address` as keyof Shipment],
        address2: initialValues[`${prefix}address2` as keyof Shipment],
        city: initialValues[`${prefix}city` as keyof Shipment],
        state: initialValues[`${prefix}state` as keyof Shipment],
        zip: initialValues[`${prefix}zip` as keyof Shipment],
        phone: initialValues[`${prefix}phone` as keyof Shipment] || 
               (addressType === 'to' ? initialValues.phone_num1 : ''),
      });
    }
  }, [visible, initialValues, form, addressType]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      onOk(values);
      form.resetFields();
    });
  };

  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      width={600}
      centered
      mask={true}
      maskClosable={false}
      okText="Save"
      cancelText="Cancel"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="First Name"
          name="first_name"
          rules={[{ required: true, message: 'Please enter first name' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item label="Last Name" name="last_name">
          <Input />
        </Form.Item>

        <Form.Item
          label="Address Line 1"
          name="address"
          rules={[{ required: true, message: 'Please enter address' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item label="Address Line 2" name="address2">
          <Input />
        </Form.Item>

        <Space.Compact style={{ width: '100%' }}>
          <Form.Item
            label="City"
            name="city"
            rules={[{ required: true, message: 'Please enter city' }]}
            style={{ width: '50%', marginRight: '8px' }}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="State"
            name="state"
            rules={[{ required: true, message: 'Please select state' }]}
            style={{ width: '25%', marginRight: '8px' }}
          >
            <Select options={US_STATES.map(state => ({ label: state, value: state }))} />
          </Form.Item>

          <Form.Item
            label="ZIP Code"
            name="zip"
            rules={[{ required: true, message: 'Please enter ZIP code' }]}
            style={{ width: '25%' }}
          >
            <Input />
          </Form.Item>
        </Space.Compact>

        <Form.Item label="Phone" name="phone">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddressModal;

