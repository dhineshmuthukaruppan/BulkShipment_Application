import React from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppSelector } from '../../store/hooks';
import { useTheme } from '../../contexts/ThemeContext';
import './MainLayout.css';

const { Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
  selectedKey?: string;
  onMenuClick?: (key: string) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, selectedKey = 'upload', onMenuClick }) => {
  const { theme } = useTheme();
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);
  const sidebarWidth = sidebarCollapsed ? 110 : 250;

  return (
    <Layout style={{ minHeight: '100vh', background: theme === 'dark' ? '#141414' : '#fff' }}>
      {/* 1. HEADER - Fixed at top, full width */}
      <Header />
      
      {/* 2. MAIN LAYOUT - Starts below header */}
      <Layout style={{ marginTop: '64px' }}>
        {/* 3. SIDEBAR - Fixed left, below header */}
        <Sidebar selectedKey={selectedKey} onMenuClick={onMenuClick} />
        
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
              padding: 0,
              background: theme === 'dark' ? '#141414' : '#fff',
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
