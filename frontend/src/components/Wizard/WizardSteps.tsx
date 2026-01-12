import React from 'react';
import { Steps, Card, Button, Space, Typography, message } from 'antd';
import { DownloadOutlined, PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { resetWizard } from '../../store/slices/wizardSlice';
import Step1Upload from './Step1Upload';
import Step2Review from './Step2Review';
import Step3Shipping from './Step3Shipping';
import Step4Purchase from './Step4Purchase';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Paragraph } = Typography;

const WizardSteps: React.FC = () => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const { currentStep, shipments } = useAppSelector((state) => state.wizard);

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
    // Simulate print - in a real app, this would open print dialog
    message.success('Print dialog opened. In a production app, this would open the browser print dialog.');
    window.print();
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
    <div style={{ padding: '24px', background: '#fff', minHeight: '100vh' }}>
      <Steps 
        current={currentStep - 1} 
        items={stepItems}
        style={{ marginBottom: '32px' }} 
      />
      {renderContent()}
    </div>
  );
};

export default WizardSteps;
