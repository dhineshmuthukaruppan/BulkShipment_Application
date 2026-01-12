import React from 'react';
import { Layout, Menu, Button } from 'antd';
import {
  DashboardOutlined,
  TagOutlined,
  UploadOutlined,
  HistoryOutlined,
  DollarOutlined,
  CreditCardOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleSidebar } from '../../store/slices/uiSlice';
import './Sidebar.css';

const { Sider } = Layout;

interface SidebarProps {
  selectedKey: string;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedKey }) => {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((state) => state.ui.sidebarCollapsed);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'create',
      icon: <TagOutlined />,
      label: 'Create a Label',
    },
    {
      key: 'upload',
      icon: <UploadOutlined />,
      label: 'Upload Spreadsheet',
    },
    {
      key: 'history',
      icon: <HistoryOutlined />,
      label: 'Order History',
    },
    {
      key: 'pricing',
      icon: <DollarOutlined />,
      label: 'Pricing',
    },
    {
      key: 'billing',
      icon: <CreditCardOutlined />,
      label: 'Billing',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      key: 'support',
      icon: <QuestionCircleOutlined />,
      label: 'Support & Help',
    },
  ];

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={250}
      collapsedWidth={110}
      style={{
        position: 'fixed',
        left: 0,
        top: '64px',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
      }}
      className="zoho-sidebar"
    >
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultSelectedKeys={['upload']}
        inlineCollapsed={false}
        style={{
          borderRight: 0,
          height: 'calc(100% - 64px)',
          paddingTop: '16px',
          background: '#fff',
        }}
        items={menuItems}
      />
      
      {/* Collapse/Expand Button at Bottom - Labels always in DOM */}
      <div className="sidebar-footer">
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => dispatch(toggleSidebar())}
          className="sidebar-toggle-btn"
        >
          {/* Always render text - visibility controlled by CSS */}
          <span className="sidebar-toggle-text">Collapse</span>
        </Button>
      </div>
    </Sider>
  );
};

export default Sidebar;
