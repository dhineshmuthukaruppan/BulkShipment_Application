import React, { useEffect } from 'react';
import { Steps, Card, Button, Space, Typography, message } from 'antd';
import { DownloadOutlined, PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { resetWizard, clearSelectedShipments } from '../../store/slices/wizardSlice';
import Step1Upload from './Step1Upload';
import Step2Review from './Step2Review';
import Step3Shipping from './Step3Shipping';
import Step4Purchase from './Step4Purchase';
import { useTheme } from '../../contexts/ThemeContext';
import { generateShippingLabelsPDF } from '../../utils/pdfGenerator';

const { Title, Paragraph } = Typography;

const WizardSteps: React.FC = () => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const { currentStep, shipments, labelSize } = useAppSelector((state) => state.wizard);

  // Clear selected shipments when step changes
  useEffect(() => {
    dispatch(clearSelectedShipments());
  }, [currentStep, dispatch]);

  const steps = [
    {
      title: 'Upload',
      content: <Step1Upload />,
    },
    {
      title: 'Review & Edit',
      content: <Step2Review />,
    },
    {
      title: 'Select Shipping',
      content: <Step3Shipping />,
    },
    {
      title: 'Purchase',
      content: <Step4Purchase />,
    },
  ];

  const handleDownload = () => {
    // Simulate download - in a real app, this would download the labels
    message.success('Labels download initiated. In a production app, this would download the label files.');
  };

  const handlePrint = () => {
    // Filter only shipped products (those with labels)
    const shippedShipments = shipments.filter(s => s.has_label === true);
    
    if (shippedShipments.length === 0) {
      message.warning('No shipped products available to print. Please purchase labels first.');
      return;
    }

    try {
      generateShippingLabelsPDF(shippedShipments, {
        pageSize: labelSize || 'letter',
        orientation: 'portrait',
      });
      message.success(`Generated PDF with ${shippedShipments.length} shipping label(s) in ${labelSize === 'letter' ? 'A4/Letter' : '4x6'} format`);
    } catch (error: any) {
      message.error(error.message || 'Failed to generate PDF');
    }
  };

  const handleStartOver = () => {
    dispatch(resetWizard());
  };

  const renderContent = () => {
    if (currentStep === 5) {
      // Success step - PRD Section 4.4.3
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <CheckCircleOutlined 
              style={{ 
                fontSize: '64px', 
                color: '#52c41a', 
                marginBottom: '24px' 
              }} 
            />
            <Title level={2} style={{ color: '#52c41a', marginBottom: '16px' }}>
              Success!
            </Title>
            <Paragraph style={{ fontSize: '18px', marginBottom: '8px' }}>
              Successfully created <strong>{shipments.length}</strong> shipping label{shipments.length !== 1 ? 's' : ''}!
            </Paragraph>
            <Paragraph type="secondary" style={{ marginBottom: '32px' }}>
              Your labels are ready for download and printing.
            </Paragraph>
            
            {/* Download/Print Options - PRD 4.4.3 */}
            <Space size="large" style={{ marginBottom: '32px' }}>
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
              >
                Download Labels
              </Button>
              <Button
                size="large"
                icon={<PrinterOutlined />}
                onClick={handlePrint}
              >
                Print Labels
              </Button>
            </Space>
            
            <div>
              <Button onClick={handleStartOver}>
                Create New Labels
              </Button>
            </div>
          </div>
        </Card>
      );
    }
    return steps[currentStep - 1]?.content;
  };

  // Convert steps to items format for Ant Design v5
  const stepItems = steps.map((step) => ({
    title: step.title,
  }));

  return (
    <div style={{ padding: '24px', background: theme === 'dark' ? '#141414' : '#fff', minHeight: '100vh', transition: 'background-color 0.3s ease' }}>
      <Steps 
        current={currentStep - 1} 
        items={stepItems}
        style={{ marginBottom: '32px' }} 
      />
      <style>{`
        /* Dark mode Steps styling */
        .ant-steps-item-icon {
          background-color: ${theme === 'dark' ? '#1f1f1f' : '#fff'} !important;
          border-color: ${theme === 'dark' ? '#434343' : '#d9d9d9'} !important;
        }
        
        .ant-steps-item-wait .ant-steps-item-icon {
          background-color: ${theme === 'dark' ? '#1f1f1f' : '#fff'} !important;
          border-color: ${theme === 'dark' ? '#434343' : '#d9d9d9'} !important;
          color: ${theme === 'dark' ? '#fff' : '#000000d9'} !important;
        }
        
        .ant-steps-item-process .ant-steps-item-icon {
          background-color: #1890ff !important;
          border-color: #1890ff !important;
          color: #fff !important;
        }
        
        .ant-steps-item-finish .ant-steps-item-icon {
          background-color: ${theme === 'dark' ? '#1f1f1f' : '#fff'} !important;
          border-color: #1890ff !important;
        }
        
        .ant-steps-item-finish .ant-steps-item-icon > .ant-steps-icon {
          color: #1890ff !important;
        }
        
        .ant-steps-item-title {
          color: ${theme === 'dark' ? '#fff' : '#000000d9'} !important;
        }
        
        .ant-steps-item-description {
          color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : '#00000073'} !important;
        }
        
        /* Step tail/connector lines */
        .ant-steps-item-tail::after {
          background-color: ${theme === 'dark' ? '#434343' : '#f0f0f0'} !important;
        }
        
        .ant-steps-item-finish > .ant-steps-item-container > .ant-steps-item-tail::after {
          background-color: #1890ff !important;
        }
      `}</style>
      {renderContent()}
    </div>
  );
};

export default WizardSteps;
