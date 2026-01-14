import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  message,
  Popconfirm,
  Tag,
  Typography,
  Row,
  Col,
  Tooltip,
  Switch,
  InputNumber,
  Empty,
  Skeleton,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  StarOutlined,
  StarFilled,
  HomeOutlined,
  ShoppingOutlined,
  ContainerOutlined,
  UserOutlined,
  DollarOutlined,
  NumberOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { SavedAddress, SavedPackage } from '../../types/shipment';
import { savedAddressService, savedPackageService, orderNumberSettingsService, OrderNumberSettings } from '../../services/shipmentService';
import './Master.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface MasterProps {}

const USER_BALANCE_KEY = 'shipping_pro_user_balance';

const Master: React.FC<MasterProps> = () => {
  // Check localStorage for desired tab on mount
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('master_active_tab');
    if (savedTab === 'ship-from' || savedTab === 'ship-to') {
      // Clear the stored tab after reading it
      localStorage.removeItem('master_active_tab');
      return savedTab;
    }
    return 'ship-from';
  });
  const [shipFromAddresses, setShipFromAddresses] = useState<SavedAddress[]>([]);
  const [shipToAddresses, setShipToAddresses] = useState<SavedAddress[]>([]);
  const [packages, setPackages] = useState<SavedPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  // User balance state
  const [userBalance, setUserBalance] = useState<number>(() => {
    const saved = localStorage.getItem(USER_BALANCE_KEY);
    return saved ? parseFloat(saved) : 100.00;
  });
  const [balanceForm] = Form.useForm();
  
  // Order number settings state
  const [orderNumberSettings, setOrderNumberSettings] = useState<OrderNumberSettings | null>(null);
  const [orderNumberSettingsForm] = Form.useForm();
  
  // Modal states
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [packageModalVisible, setPackageModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [editingPackage, setEditingPackage] = useState<SavedPackage | null>(null);
  const [addressForm] = Form.useForm();
  const [packageForm] = Form.useForm();

  useEffect(() => {
    if (activeTab === 'account') {
      // Load balance from localStorage when account tab is selected
      const saved = localStorage.getItem(USER_BALANCE_KEY);
      const balance = saved ? parseFloat(saved) : 100.00;
      setUserBalance(balance);
      balanceForm.setFieldsValue({ balance });
    } else if (activeTab === 'order-number-settings') {
      loadOrderNumberSettings();
    } else {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'ship-from' || activeTab === 'ship-to') {
        // Load addresses separately by type
        const fromAddresses = await savedAddressService.getAll('from');
        const toAddresses = await savedAddressService.getAll('to');
        setShipFromAddresses(fromAddresses);
        setShipToAddresses(toAddresses);
      } else if (activeTab === 'packages') {
        const packagesData = await savedPackageService.getAll();
        setPackages(packagesData);
      }
    } catch (error) {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadOrderNumberSettings = async () => {
    setLoading(true);
    try {
      const settings = await orderNumberSettingsService.getActive();
      setOrderNumberSettings(settings);
      orderNumberSettingsForm.setFieldsValue(settings);
    } catch (error) {
      message.error('Failed to load order number settings');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderNumberSettingsSubmit = async (values: any) => {
    try {
      if (orderNumberSettings?.id) {
        await orderNumberSettingsService.update(orderNumberSettings.id, { ...values, is_active: true });
        message.success('Order number settings updated successfully');
      } else {
        await orderNumberSettingsService.create({ ...values, is_active: true });
        message.success('Order number settings created successfully');
      }
      loadOrderNumberSettings();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to save order number settings');
    }
  };

  const handleBalanceUpdate = async (values: { balance: number }) => {
    try {
      const newBalance = values.balance;
      localStorage.setItem(USER_BALANCE_KEY, newBalance.toString());
      setUserBalance(newBalance);
      message.success('Account balance updated successfully');
      // Trigger a custom event to notify Header component
      window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: newBalance }));
    } catch (error) {
      message.error('Failed to update balance');
    }
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    addressForm.resetFields();
    setAddressModalVisible(true);
  };

  const handleEditAddress = (record: SavedAddress) => {
    setEditingAddress(record);
    addressForm.setFieldsValue(record);
    setAddressModalVisible(true);
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      await savedAddressService.delete(id);
      message.success('Address deleted successfully');
      loadData();
    } catch (error) {
      message.error('Failed to delete address');
    }
  };

  const handleSetDefaultAddress = async (id: number) => {
    try {
      await savedAddressService.setDefault(id);
      message.success('Default address updated');
      loadData();
    } catch (error) {
      message.error('Failed to set default address');
    }
  };

  const handleAddressSubmit = async (values: any) => {
    try {
      // Determine address type based on active tab
      const addressType = activeTab === 'ship-to' ? 'to' : 'from';
      const addressData = { ...values, address_type: addressType };
      
      if (editingAddress) {
        await savedAddressService.update(editingAddress.id, addressData);
        message.success('Address updated successfully');
      } else {
        await savedAddressService.create(addressData);
        message.success('Address created successfully');
      }
      setAddressModalVisible(false);
      addressForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to save address');
    }
  };

  const handleAddPackage = () => {
    setEditingPackage(null);
    packageForm.resetFields();
    setPackageModalVisible(true);
  };

  const handleEditPackage = (record: SavedPackage) => {
    setEditingPackage(record);
    packageForm.setFieldsValue(record);
    setPackageModalVisible(true);
  };

  const handleDeletePackage = async (id: number) => {
    try {
      await savedPackageService.delete(id);
      message.success('Package deleted successfully');
      loadData();
    } catch (error) {
      message.error('Failed to delete package');
    }
  };

  const handleSetDefaultPackage = async (id: number) => {
    try {
      await savedPackageService.setDefault(id);
      message.success('Default package updated');
      loadData();
    } catch (error) {
      message.error('Failed to set default package');
    }
  };

  const handlePackageSubmit = async (values: any) => {
    try {
      if (editingPackage) {
        await savedPackageService.update(editingPackage.id, values);
        message.success('Package updated successfully');
      } else {
        await savedPackageService.create(values);
        message.success('Package created successfully');
      }
      setPackageModalVisible(false);
      packageForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to save package');
    }
  };

  // Filter data based on search
  const getFilteredAddresses = () => {
    const addresses = activeTab === 'ship-from' ? shipFromAddresses : shipToAddresses;
    if (!searchText) return addresses;
    return addresses.filter(
      (addr) =>
        addr.name.toLowerCase().includes(searchText.toLowerCase()) ||
        addr.address.toLowerCase().includes(searchText.toLowerCase()) ||
        addr.city.toLowerCase().includes(searchText.toLowerCase()) ||
        addr.state.toLowerCase().includes(searchText.toLowerCase())
    );
  };

  const getFilteredPackages = () => {
    if (!searchText) return packages;
    return packages.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(searchText.toLowerCase())
    );
  };

  // Address columns
  const addressColumns: ColumnsType<SavedAddress> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <Space>
          {record.is_default && <StarFilled style={{ color: '#faad14' }} />}
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div>
          <div>{`${record.first_name} ${record.last_name || ''}`.trim()}</div>
          {record.phone && <div style={{ color: '#8c8c8c', fontSize: '14px' }}>{record.phone}</div>}
        </div>
      ),
    },
    {
      title: 'Address',
      key: 'address',
      render: (_, record) => (
        <div>
          <div>{record.address}</div>
          {record.address2 && <div>{record.address2}</div>}
          <div>{`${record.city}, ${record.state} ${record.zip_code}`}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Space>
          {record.is_default && <Tag color="gold">Default</Tag>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="Set as Default">
            <Button
              type="text"
              icon={record.is_default ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={() => handleSetDefaultAddress(record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditAddress(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Address"
            description="Are you sure you want to delete this address?"
            onConfirm={() => handleDeleteAddress(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Package columns
  const packageColumns: ColumnsType<SavedPackage> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <Space>
          {record.is_default && <StarFilled style={{ color: '#faad14' }} />}
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: 'Dimensions',
      key: 'dimensions',
      render: (_, record) => (
        <div>
          <strong>{`${record.length}" × ${record.width}" × ${record.height}"`}</strong>
        </div>
      ),
    },
    {
      title: 'Weight',
      key: 'weight',
      render: (_, record) => (
        <div>
          <strong>{`${record.weight_lbs} lb ${record.weight_oz} oz`}</strong>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Space>
          {record.is_default && <Tag color="gold">Default</Tag>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="Set as Default">
            <Button
              type="text"
              icon={record.is_default ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={() => handleSetDefaultPackage(record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditPackage(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Package"
            description="Are you sure you want to delete this package?"
            onConfirm={() => handleDeletePackage(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="master-container">
      <Card className="master-card">
        <div className="master-header">
          <Title level={2} style={{ margin: 0 }}>
            Master Data Management
          </Title>
          <div className="master-subtitle">
            Manage your saved addresses and package presets for quick access
          </div>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="master-tabs"
          items={[
            {
              key: 'ship-from',
              label: (
                <span>
                  <HomeOutlined /> Ship From Addresses
                </span>
              ),
            },
            {
              key: 'ship-to',
              label: (
                <span>
                  <ShoppingOutlined /> Ship To Addresses
                </span>
              ),
            },
            {
              key: 'packages',
              label: (
                <span>
                  <ContainerOutlined /> Package Details
                </span>
              ),
            },
            {
              key: 'order-number-settings',
              label: (
                <span>
                  <NumberOutlined /> Order Number Settings
                </span>
              ),
            },
            {
              key: 'account',
              label: (
                <span>
                  <UserOutlined /> Account Settings
                </span>
              ),
            },
          ]}
        />

        {activeTab !== 'account' && activeTab !== 'order-number-settings' && (
          <div className="master-toolbar">
            <Input
              placeholder={`Search ${activeTab === 'packages' ? 'packages' : 'addresses'}...`}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={activeTab === 'packages' ? handleAddPackage : handleAddAddress}
              size="large"
            >
              Add {activeTab === 'packages' ? 'Package' : 'Address'}
            </Button>
          </div>
        )}

        {activeTab === 'order-number-settings' ? (
          <Card
            style={{
              marginTop: 24,
              maxWidth: 800,
            }}
          >
            <Title level={4} style={{ marginBottom: 24 }}>
              <NumberOutlined style={{ marginRight: 8 }} />
              Sequential Order Number Configuration
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
              Configure how sequential order numbers are generated for empty order_number columns in CSV uploads.
              These settings will be used when generating IDs like ORD-0001, ORD-0002, etc.
            </Text>
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <Form
                form={orderNumberSettingsForm}
                layout="vertical"
                onFinish={handleOrderNumberSettingsSubmit}
                initialValues={{
                  prefix: 'ORD',
                  starting_number: 1,
                  number_format: '0000',
                  separator: '-',
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Prefix"
                      name="prefix"
                      rules={[
                        { required: true, message: 'Please enter prefix' },
                        { max: 20, message: 'Prefix must be 20 characters or less' },
                      ]}
                      tooltip="Prefix for order numbers (e.g., 'ORD', 'ORDER', 'SHIP')"
                    >
                      <Input placeholder="ORD" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Separator"
                      name="separator"
                      rules={[{ max: 5, message: 'Separator must be 5 characters or less' }]}
                      tooltip="Separator between prefix and number (e.g., '-', '_', or leave empty)"
                    >
                      <Input placeholder="-" maxLength={5} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Number Format"
                      name="number_format"
                      rules={[
                        { required: true, message: 'Please enter number format' },
                        { pattern: /^0+$/, message: 'Format must contain only zeros (e.g., 0000, 00000)' },
                      ]}
                      tooltip="Number format: '0000' = 4 digits (ORD-0001), '00000' = 5 digits (ORD-00001)"
                    >
                      <Input placeholder="0000" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Starting Number"
                      name="starting_number"
                      rules={[
                        { required: true, message: 'Please enter starting number' },
                        { type: 'number', min: 1, message: 'Starting number must be 1 or greater' },
                      ]}
                      tooltip="The starting number for sequential IDs"
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        min={1}
                        placeholder="1"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item shouldUpdate={(prevValues, currentValues) => 
                  prevValues.prefix !== currentValues.prefix ||
                  prevValues.separator !== currentValues.separator ||
                  prevValues.number_format !== currentValues.number_format ||
                  prevValues.starting_number !== currentValues.starting_number
                }>
                  {({ getFieldsValue }) => {
                    const values = getFieldsValue();
                    const prefix = values.prefix || 'ORD';
                    const separator = values.separator || '-';
                    const format = values.number_format || '0000';
                    const startNum = values.starting_number || 1;
                    // Calculate padding from format (count zeros)
                    const padding = format.length;
                    const formattedNum = String(startNum).padStart(padding, '0');
                    const example = `${prefix}${separator}${formattedNum}`;
                    return (
                      <Text type="secondary">
                        Example: <Text strong>{example}</Text>
                      </Text>
                    );
                  }}
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" icon={<EditOutlined />}>
                      Save Settings
                    </Button>
                    <Text type="secondary">
                      These settings will be used for all future CSV uploads with empty order_number columns.
                    </Text>
                  </Space>
                </Form.Item>
              </Form>
            )}
          </Card>
        ) : activeTab === 'account' ? (
          <Card
            style={{
              marginTop: 24,
              maxWidth: 600,
            }}
          >
            <Title level={4} style={{ marginBottom: 24 }}>
              <DollarOutlined style={{ marginRight: 8 }} />
              Account Balance
            </Title>
            <Form
              form={balanceForm}
              layout="vertical"
              onFinish={handleBalanceUpdate}
              initialValues={{ balance: userBalance }}
            >
              <Form.Item
                label="Current Balance"
                name="balance"
                rules={[
                  { required: true, message: 'Please enter balance amount' },
                  { type: 'number', min: 0, message: 'Balance cannot be negative' },
                  { type: 'number', max: 999999.99, message: 'Balance is too large' }
                ]}
                hasFeedback
              >
                <InputNumber
                  prefix="$"
                  style={{ width: '100%' }}
                  min={0}
                  max={999999.99}
                  step={0.01}
                  precision={2}
                  placeholder="Enter balance amount"
                  aria-label="Account balance"
                  aria-required="true"
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<EditOutlined />}>
                    Update Balance
                  </Button>
                  <Text type="secondary">
                    Current balance: <Text strong style={{ color: '#52c41a' }}>${userBalance.toFixed(2)}</Text>
                  </Text>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        ) : (
          <>
            {activeTab === 'packages' ? (
          loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : getFilteredPackages().length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  No packages found.{' '}
                  <a 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAddPackage();
                    }}
                    style={{ color: '#1890ff' }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleAddPackage();
                      }
                    }}
                  >
                    Create your first package
                  </a>
                </span>
              }
            />
          ) : (
            <Table<SavedPackage>
              columns={packageColumns}
              dataSource={getFilteredPackages()}
              loading={false}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} packages`,
              }}
              className="master-table"
            />
          )
        ) : loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : getFilteredAddresses().length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                No {activeTab === 'ship-from' ? 'ship-from' : 'ship-to'} addresses found.{' '}
                <a 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAddAddress();
                  }}
                  style={{ color: '#1890ff' }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAddAddress();
                    }
                  }}
                >
                  Create your first address
                </a>
              </span>
            }
          />
        ) : (
          <Table<SavedAddress>
            columns={addressColumns}
            dataSource={getFilteredAddresses()}
            loading={false}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} addresses`,
            }}
            className="master-table"
          />
        )}
          </>
        )}
      </Card>

      {/* Address Modal */}
      <Modal
        title={editingAddress ? 'Edit Address' : 'Add New Address'}
        open={addressModalVisible}
        onCancel={() => {
          setAddressModalVisible(false);
          addressForm.resetFields();
        }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form
          form={addressForm}
          layout="vertical"
          onFinish={handleAddressSubmit}
          className="master-form"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Address Name"
                rules={[{ required: true, message: 'Please enter address name' }]}
              >
                <Input placeholder="e.g., Main Warehouse" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_default" valuePropName="checked" label=" ">
                <Space>
                  <Switch />
                  <span>Set as Default Address</span>
                </Space>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="first_name"
                label="First Name"
                rules={[{ required: true, message: 'Please enter first name' }]}
              >
                <Input placeholder="First Name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_name" label="Last Name">
                <Input placeholder="Last Name" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label="Address Line 1"
            rules={[{ required: true, message: 'Please enter address' }]}
          >
            <TextArea rows={2} placeholder="Street address" />
          </Form.Item>

          <Form.Item name="address2" label="Address Line 2">
            <Input placeholder="Apartment, suite, etc. (optional)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="city"
                label="City"
                rules={[{ required: true, message: 'Please enter city' }]}
              >
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="state"
                label="State"
                rules={[
                  { required: true, message: 'Please enter state' },
                  { len: 2, message: 'State must be 2 characters' },
                ]}
              >
                <Input placeholder="State" maxLength={2} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="zip_code"
                label="ZIP Code"
                rules={[{ required: true, message: 'Please enter ZIP code' }]}
              >
                <Input placeholder="ZIP Code" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="phone" label="Phone Number">
            <Input placeholder="Phone Number (optional)" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingAddress ? 'Update' : 'Create'} Address
              </Button>
              <Button onClick={() => setAddressModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Package Modal */}
      <Modal
        title={editingPackage ? 'Edit Package' : 'Add New Package'}
        open={packageModalVisible}
        onCancel={() => {
          setPackageModalVisible(false);
          packageForm.resetFields();
        }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form
          form={packageForm}
          layout="vertical"
          onFinish={handlePackageSubmit}
          className="master-form"
        >
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="name"
                label="Package Name"
                rules={[{ required: true, message: 'Please enter package name' }]}
              >
                <Input placeholder="e.g., Standard Box" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_default" valuePropName="checked" label=" ">
                <Space>
                  <Switch />
                  <span>Set as Default</span>
                </Space>
              </Form.Item>
            </Col>
          </Row>

          <Title level={5}>Dimensions (inches)</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="length"
                label="Length"
                rules={[
                  { required: true, message: 'Please enter length' },
                  { type: 'number', min: 0.01, message: 'Length must be greater than 0' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  step={0.01}
                  placeholder="Length"
                  addonAfter="in"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="width"
                label="Width"
                rules={[
                  { required: true, message: 'Please enter width' },
                  { type: 'number', min: 0.01, message: 'Width must be greater than 0' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  step={0.01}
                  placeholder="Width"
                  addonAfter="in"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="height"
                label="Height"
                rules={[
                  { required: true, message: 'Please enter height' },
                  { type: 'number', min: 0.01, message: 'Height must be greater than 0' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  step={0.01}
                  placeholder="Height"
                  addonAfter="in"
                />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5}>Weight</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="weight_lbs"
                label="Weight (lbs)"
                rules={[
                  { required: true, message: 'Please enter weight' },
                  { type: 'number', min: 0, message: 'Weight must be 0 or greater' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  placeholder="Pounds"
                  addonAfter="lb"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="weight_oz"
                label="Weight (oz)"
                rules={[
                  { type: 'number', min: 0, message: 'Ounces must be 0 or greater' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  placeholder="Ounces"
                  addonAfter="oz"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingPackage ? 'Update' : 'Create'} Package
              </Button>
              <Button onClick={() => setPackageModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Master;
