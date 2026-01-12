import React from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppSelector } from '../../store/hooks';
import './MainLayout.css';

const { Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
  selectedKey?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, selectedKey = 'upload' }) => {
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);
  const sidebarWidth = sidebarCollapsed ? 110 : 250;

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 1. HEADER - Fixed at top, full width */}
      <Header />
      
      {/* 2. MAIN LAYOUT - Starts below header */}
      <Layout style={{ marginTop: '64px' }}>
        {/* 3. SIDEBAR - Fixed left, below header */}
        <Sidebar selectedKey={selectedKey} />
        
        {/* 4. MAIN CONTENT - Right of sidebar, no gaps */}
        <Layout 
          className="main-content-wrapper"
          style={{ 
            marginLeft: `${sidebarWidth}px`,
            transition: 'margin-left 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <Content
            style={{
              padding: '24px',
              background: '#fff',
              margin: 0,
              minHeight: 'calc(100vh - 64px)',
              borderRadius: 0,
              boxShadow: 'none',
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
