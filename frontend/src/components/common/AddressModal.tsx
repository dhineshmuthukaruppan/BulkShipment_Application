import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Space, Spin } from 'antd';
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
  onOk: (values: any) => Promise<void> | void;
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
  const [saving, setSaving] = useState(false);

  // Get form values from initialValues
  const getFormValues = () => {
    if (!initialValues) return {};
    
    const prefix = addressType === 'from' ? 'from_' : 'to_';
    
    // Extract values from the shipment record
    const formValues: any = {
      first_name: initialValues[`${prefix}first_name` as keyof Shipment] || '',
      last_name: initialValues[`${prefix}last_name` as keyof Shipment] || '',
      address: initialValues[`${prefix}address` as keyof Shipment] || '',
      address2: initialValues[`${prefix}address2` as keyof Shipment] || '',
      city: initialValues[`${prefix}city` as keyof Shipment] || '',
      state: initialValues[`${prefix}state` as keyof Shipment] || '',
      zip: initialValues[`${prefix}zip` as keyof Shipment] || '',
    };
    
    // Handle phone number - check multiple possible fields
    const fromPhone = initialValues[`${prefix}phone` as keyof Shipment];
    const phoneNum1 = initialValues.phone_num1;
    formValues.phone = fromPhone || phoneNum1 || '';
    
    return formValues;
  };

  useEffect(() => {
    if (visible && initialValues) {
      const formValues = getFormValues();
      // Set form values when modal opens
      form.setFieldsValue(formValues);
    } else if (!visible) {
      // Reset form when modal is closed
      form.resetFields();
    }
  }, [visible, initialValues, form, addressType]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      // Call onOk and wait for it to complete
      await onOk(values);
      // Don't reset fields here - let the parent handle it after successful save
    } catch (error) {
      // Validation failed, don't set saving state
      console.error('Form validation failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      width={600}
      centered
      mask={true}
      maskClosable={false}
      okText={saving ? "Saving..." : "Save"}
      cancelText="Cancel"
      destroyOnClose={true}
      confirmLoading={saving}
      okButtonProps={{ loading: saving, disabled: saving }}
      cancelButtonProps={{ disabled: saving }}
    >
      <Spin spinning={saving} tip="Saving and validating address...">
        <Form 
          form={form} 
          layout="vertical" 
          aria-label={title}
          initialValues={visible && initialValues ? getFormValues() : {}}
          preserve={false}
        >
        <Form.Item
          label="First Name"
          name="first_name"
          rules={[
            { required: true, message: 'Please enter first name' },
            { max: 50, message: 'First name must be less than 50 characters' }
          ]}
          hasFeedback
        >
          <Input 
            placeholder="Enter first name"
            aria-label="First name"
            aria-required="true"
          />
        </Form.Item>

        <Form.Item 
          label="Last Name" 
          name="last_name"
          rules={[{ max: 50, message: 'Last name must be less than 50 characters' }]}
          hasFeedback
        >
          <Input 
            placeholder="Enter last name"
            aria-label="Last name"
          />
        </Form.Item>

        <Form.Item
          label="Address Line 1"
          name="address"
          rules={[
            { required: true, message: 'Please enter address' },
            { max: 200, message: 'Address must be less than 200 characters' }
          ]}
          hasFeedback
        >
          <Input 
            placeholder="Enter street address"
            aria-label="Address line 1"
            aria-required="true"
          />
        </Form.Item>

        <Form.Item 
          label="Address Line 2" 
          name="address2"
          rules={[{ max: 200, message: 'Address must be less than 200 characters' }]}
          hasFeedback
        >
          <Input 
            placeholder="Apartment, suite, etc. (optional)"
            aria-label="Address line 2"
          />
        </Form.Item>

        <Space.Compact style={{ width: '100%' }}>
          <Form.Item
            label="City"
            name="city"
            rules={[
              { required: true, message: 'Please enter city' },
              { max: 100, message: 'City must be less than 100 characters' }
            ]}
            style={{ width: '50%', marginRight: '8px' }}
            hasFeedback
          >
            <Input 
              placeholder="Enter city"
              aria-label="City"
              aria-required="true"
            />
          </Form.Item>

          <Form.Item
            label="State"
            name="state"
            rules={[{ required: true, message: 'Please select state' }]}
            style={{ width: '25%', marginRight: '8px' }}
            hasFeedback
          >
            <Select 
              placeholder="Select state"
              options={US_STATES.map(state => ({ label: state, value: state }))}
              aria-label="State"
              aria-required="true"
            />
          </Form.Item>

          <Form.Item
            label="ZIP Code"
            name="zip"
            rules={[
              { required: true, message: 'Please enter ZIP code' },
              { pattern: /^\d{5}(-\d{4})?$/, message: 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)' }
            ]}
            style={{ width: '25%' }}
            hasFeedback
          >
            <Input 
              placeholder="12345"
              aria-label="ZIP code"
              aria-required="true"
              maxLength={10}
            />
          </Form.Item>
        </Space.Compact>

        <Form.Item 
          label="Phone" 
          name="phone"
          rules={[
            { pattern: /^[\d\s\-\(\)]+$/, message: 'Please enter a valid phone number' },
            { max: 20, message: 'Phone number must be less than 20 characters' }
          ]}
          hasFeedback
        >
          <Input 
            placeholder="(555) 123-4567"
            aria-label="Phone number"
            maxLength={20}
          />
        </Form.Item>
      </Form>
      </Spin>
    </Modal>
  );
};

export default AddressModal;

