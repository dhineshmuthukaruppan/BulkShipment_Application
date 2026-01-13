import React, { useState } from 'react';
import { Card, Upload, Button, message, Typography, Space, Alert, Spin, List, Popconfirm, Tag, DatePicker, Form, Modal, Table } from 'antd';
import type { UploadProps } from 'antd';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { InboxOutlined, DownloadOutlined, FileTextOutlined, DeleteOutlined, PlayCircleOutlined, CalendarOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { shipmentService } from '../../services/shipmentService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setShipments, setCurrentStep, loadDraft, deleteDraft, clearSelectedShipments } from '../../store/slices/wizardSlice';
import { Shipment } from '../../types/shipment';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Paragraph } = Typography;
const { Dragger } = Upload;

const Step1Upload: React.FC = () => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const { drafts = [] } = useAppSelector((state) => state.wizard);
  const [loading, setLoading] = useState(false);
  const [processDate, setProcessDate] = useState<Dayjs | null>(dayjs()); // Default to today
  const [form] = Form.useForm();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<Shipment[]>([]);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    disabled: loading,
    beforeUpload: (file) => {
      handleUpload(file);
      return false; // Prevent auto upload
    },
    showUploadList: false,
  };

  const handleUpload = async (file: File) => {
    // Validate process date
    if (!processDate) {
      message.error('Please select a process date before uploading');
      return;
    }

    setLoading(true);
    try {
      // Clear Redux state before uploading new CSV
      // This ensures each CSV upload is treated as a separate, isolated batch
      dispatch(setShipments([]));
      dispatch(clearSelectedShipments());
      
      // Format date as YYYY-MM-DD for backend
      const dateString = processDate.format('YYYY-MM-DD');
      const response = await shipmentService.uploadCSV(file, dateString);
      
      // Store preview data instead of immediately saving to Redux
      setPreviewData(response.shipments);
      setPreviewFileName(file.name);
      setPreviewWarnings(response.warnings || []);
      setPreviewVisible(true);
      
      message.success(`Successfully parsed ${response.count} shipments! Please review the preview.`);
    } catch (error: any) {
      const errorMessage = error.message || 
                         error.response?.data?.error || 
                         error.response?.data?.message ||
                         'Failed to upload file. Please check your connection and try again.';
      message.error(errorMessage, 5);
      console.error('Upload error:', error);
      
      // Log detailed error for debugging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      } else if (error.request) {
        console.error('No response received. Is the backend server running?');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePreview = () => {
    // Save to Redux and proceed to Step 2
    dispatch(setShipments(previewData));
    setPreviewVisible(false);
    message.success(`Approved ${previewData.length} shipments. Proceeding to Step 2.`);
    
    // Move to next step
    setTimeout(() => {
      dispatch(setCurrentStep(2));
    }, 500);
  };

  const handleRejectPreview = async () => {
    try {
      // Clear the uploaded data from backend
      await shipmentService.clearAll();
      setPreviewVisible(false);
      setPreviewData([]);
      setPreviewFileName('');
      setPreviewWarnings([]);
      message.info('Preview rejected. The uploaded data has been cleared. Please upload a new file.');
    } catch (error) {
      console.error('Error rejecting preview:', error);
      message.error('Error clearing preview data');
    }
  };

  const formatAddress = (shipment: Shipment, type: 'from' | 'to') => {
    if (type === 'from') {
      return [
        shipment.from_first_name,
        shipment.from_last_name,
        shipment.from_address,
        shipment.from_address2,
        `${shipment.from_city}, ${shipment.from_state} ${shipment.from_zip}`.trim()
      ].filter(Boolean).join(', ');
    } else {
      return [
        shipment.to_first_name,
        shipment.to_last_name,
        shipment.to_address,
        shipment.to_address2,
        `${shipment.to_city}, ${shipment.to_state} ${shipment.to_zip}`.trim()
      ].filter(Boolean).join(', ');
    }
  };

  const formatPackageDetails = (shipment: Shipment) => {
    return `${shipment.length}" x ${shipment.width}" x ${shipment.height}" | ${shipment.weight_lbs} lbs ${shipment.weight_oz} oz`;
  };

  const previewColumns: ColumnsType<Shipment> = [
    {
      title: 'Ship From Address',
      dataIndex: 'formatted_from_address',
      width: 200,
      render: (_: any, record: Shipment) => (
        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '13px' }}>
          {formatAddress(record, 'from')}
        </div>
      ),
    },
    {
      title: 'Ship To Address',
      dataIndex: 'formatted_to_address',
      width: 200,
      render: (_: any, record: Shipment) => (
        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '13px' }}>
          {formatAddress(record, 'to')}
        </div>
      ),
    },
    {
      title: 'Package Details',
      dataIndex: 'package_details',
      width: 180,
      render: (_: any, record: Shipment) => (
        <div style={{ fontSize: '13px' }}>
          {formatPackageDetails(record)}
        </div>
      ),
    },
    {
      title: 'Order No',
      dataIndex: 'order_number',
      width: 120,
      render: (text: string) => text || '-',
    },
  ];

  const downloadTemplate = () => {
    try {
      // Create a link element to trigger download
      const link = document.createElement('a');
      link.href = '/shipping_template.csv';
      link.download = 'shipping_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('Template file downloaded successfully!');
    } catch (error) {
      message.error('Failed to download template file');
      console.error('Download error:', error);
    }
  };

  const handleLoadDraft = (draftId: string) => {
    dispatch(loadDraft(draftId));
    message.success('Draft loaded successfully! Navigating to saved step...');
    // Navigation happens automatically via currentStep update in Redux
    // WizardSteps component will render the correct step based on currentStep
  };

  const handleDeleteDraft = (draftId: string) => {
    dispatch(deleteDraft(draftId));
    message.success('Draft deleted successfully!');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <Title level={2}>Upload Spreadsheet (Step 1 of 3)</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Process Date Input */}
        <Card>
          <Form form={form} layout="vertical">
            <Form.Item
              label={
                <Space>
                  <CalendarOutlined />
                  <span>Process Date</span>
                </Space>
              }
              required
              tooltip="Select the date for this batch. This will be used for dashboard analytics to track orders and spending by date."
            >
              <DatePicker
                style={{ width: '100%', maxWidth: '300px' }}
                value={processDate}
                onChange={(date) => setProcessDate(date)}
                format="DD-MM-YYYY"
                placeholder="Select process date"
                disabledDate={(current) => current && current > dayjs().endOf('day')}
                allowClear={false}
              />
            </Form.Item>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              This date will be associated with all shipments in this batch for dashboard tracking.
            </Typography.Text>
          </Form>
        </Card>

        <Card>
          <Spin spinning={loading}>
            <Dragger {...uploadProps} style={{ padding: '40px' }} disabled={!processDate || loading}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">
                {loading ? 'Processing your file...' : 'Click or drag CSV file to this area to upload'}
              </p>
              <p className="ant-upload-hint">
                {loading 
                  ? 'Please wait while we parse and validate your data.' 
                  : 'Support for CSV files only. The file should follow the template format.'}
              </p>
            </Dragger>
          </Spin>
        </Card>

        <Card title="Need Help?" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadTemplate}
              type="link"
            >
              Download Template File
            </Button>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              <strong>Instructions:</strong>
              <br />
              1. Download the template file above
              <br />
              2. Fill in your shipment data following the template format
              <br />
              3. Upload the completed CSV file using the upload area above
              <br />
              4. Review and edit your data in the next step
            </Paragraph>
          </Space>
        </Card>

        {/* Saved Drafts Section */}
        {drafts.length > 0 && (
          <Card title="Saved Drafts" size="small">
            <List
              dataSource={drafts}
              renderItem={(draft) => (
                <List.Item
                  actions={[
                    <Button
                      key="load"
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handleLoadDraft(draft.id)}
                    >
                      Continue
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="Delete this draft?"
                      description="This action cannot be undone."
                      onConfirm={() => handleDeleteDraft(draft.id)}
                      okText="Yes"
                      cancelText="No"
                      placement="topLeft"
                      overlayStyle={{ 
                        maxWidth: '300px',
                        zIndex: 1050
                      }}
                      getPopupContainer={() => document.body}
                      autoAdjustOverflow
                    >
                      <Button
                        type="link"
                        color="danger"
                        variant="solid"
                        icon={<DeleteOutlined />}
                      >
                        Delete
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: '20px', color: '#1890ff' }} />}
                    title={
                      <Space>
                        <span>{draft.name}</span>
                        <Tag color={draft.step === 2 ? 'blue' : 'green'}>
                          Step {draft.step}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <span>{draft.shipments.length} shipment{draft.shipments.length !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          Last saved: {formatDate(draft.updatedAt)}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

      </Space>

      {/* CSV Preview Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>CSV Preview - {previewFileName}</span>
          </Space>
        }
        open={previewVisible}
        onCancel={handleRejectPreview}
        width={900}
        centered
        mask={true}
        maskClosable={false}
        footer={[
          <Button key="reject" danger icon={<CloseOutlined />} onClick={handleRejectPreview}>
            Reject
          </Button>,
          <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={handleApprovePreview}>
            Approve & Continue to Step 2
          </Button>,
        ]}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {previewWarnings.length > 0 && (
            <Alert
              message="Warnings Found"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
                  {previewWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <div>
            <Typography.Text strong>
              Found {previewData.length} shipment{previewData.length !== 1 ? 's' : ''}. Please review the data below:
            </Typography.Text>
          </div>

          <Table
            columns={previewColumns}
            dataSource={previewData}
            rowKey="id"
            pagination={false}
            scroll={{ 
              x: 'max-content',
              y: '400px'
            }}
            rowClassName={(record, index) => {
              let className = '';
              // Alternating row backgrounds for readability
              if (index % 2 === 1) {
                className += 'table-row-even ';
              }
              return className.trim();
            }}
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: '8px',
            }}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default Step1Upload;
