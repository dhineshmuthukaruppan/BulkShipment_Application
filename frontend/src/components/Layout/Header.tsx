import React, { useState, useEffect } from 'react';
import { Layout, Typography, Space, Badge, Avatar, Dropdown, Row, Col, Divider, MenuProps, Button, Tooltip } from 'antd';
import { 
  UserOutlined, 
  BellOutlined,
  SettingOutlined,
  LogoutOutlined,
  CreditCardOutlined,
  MessageOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface HeaderProps {
  userName?: string;
  balance?: number;
  userEmail?: string;
  userPhone?: string;
}

const USER_BALANCE_KEY = 'shipping_pro_user_balance';

const Header: React.FC<HeaderProps> = ({ 
  userName = 'John Doe', 
  balance: propBalance = 100.00,
  userEmail = 'john.doe@example.com',
  userPhone = '+1 (555) 123-4567'
}) => {
  const { theme, toggleTheme } = useTheme();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [balance, setBalance] = useState<number>(() => {
    const saved = localStorage.getItem(USER_BALANCE_KEY);
    return saved ? parseFloat(saved) : propBalance;
  });

  // Listen for balance updates from Master component
  useEffect(() => {
    const handleBalanceUpdate = (event: CustomEvent) => {
      setBalance(event.detail);
    };

    window.addEventListener('balanceUpdated', handleBalanceUpdate as EventListener);
    
    // Also check localStorage periodically in case it was updated directly
    const interval = setInterval(() => {
      const saved = localStorage.getItem(USER_BALANCE_KEY);
      if (saved) {
        const newBalance = parseFloat(saved);
        if (newBalance !== balance) {
          setBalance(newBalance);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate as EventListener);
      clearInterval(interval);
    };
  }, [balance]);

  // Get user initials for avatar
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Profile dropdown menu items
  interface ProfileMenuItem {
    key: string;
    label: React.ReactNode;
  }

  const profileMenuItems: ProfileMenuItem[] = [
    {
      key: 'subscription',
      label: (
        <Space size={8}>
          <CreditCardOutlined style={{ fontSize: 16 }} />
          <Text style={{ fontSize: 15, lineHeight: '22px', fontFamily: 'Inter, sans-serif' }}>
            Manage Subscription & Usage
          </Text>
        </Space>
      ),
    },
    {
      key: 'help',
      label: (
        <Space size={8}>
          <MessageOutlined style={{ fontSize: 16 }} />
          <Text style={{ fontSize: 15, lineHeight: '22px', fontFamily: 'Inter, sans-serif' }}>
            Help & Support
          </Text>
        </Space>
      ),
    },
    {
      key: 'logout',
      label: (
        <Space size={8}>
          <LogoutOutlined style={{ fontSize: 16 }} />
          <Text style={{ fontSize: 15, lineHeight: '22px', fontFamily: 'Inter, sans-serif' }}>
            Logout
          </Text>
        </Space>
      ),
    },
  ];

  const handleProfileMenuClick = (key: string) => {
    switch (key) {
      case 'subscription':
        // Navigate to subscription page
        console.log('Navigate to subscription');
        break;
      case 'help':
        // Navigate to help page
        console.log('Navigate to help');
        break;
      case 'logout':
        // Handle logout
        console.log('Logout');
        break;
    }
    setProfileDropdownOpen(false);
  };

  // Profile Dropdown Content Component
  const ProfileDropdownContent = () => {
    return (
      <div style={{ 
        backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: theme === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
        width: 320,
        padding: '4px 0',
        margin: 0,
        border: theme === 'dark' ? '1px solid #303030' : 'none',
      }}>
        {/* User Info Section */}
        <div style={{ padding: '12px 16px' }}>
          <Row align="middle" gutter={16}>
            <Col>
              <Avatar 
                size={64} 
                style={{ backgroundColor: '#1890ff' }}
              >
                {getInitials(userName)}
              </Avatar>
            </Col>
            <Col flex="1">
              <Text strong style={{ 
                fontSize: 15, 
                lineHeight: '22px',
                color: theme === 'dark' ? '#fff' : '#000000',
                display: 'block',
                marginBottom: 4,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
              }}>
                {userName}
              </Text>
              <Text style={{ 
                fontSize: 15, 
                lineHeight: '22px',
                color: theme === 'dark' ? '#fff' : '#000000',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
              }}>
                Account Balance: <Text strong style={{ color: '#52c41a' }}>${balance.toFixed(2)}</Text>
              </Text>
            </Col>
          </Row>
        </div>

        <div style={{ backgroundColor: theme === 'dark' ? '#141414' : '#f5f5f5' }}>
          <Divider style={{ margin: 0, borderColor: theme === 'dark' ? '#303030' : 'rgba(0, 0, 0, 0.06)' }} />
          
          {/* Contact Details Section */}
          <div style={{ 
            backgroundColor: theme === 'dark' ? '#141414' : '#f5f5f5',
            padding: '12px 16px',
            margin: '0px 0',
          }}>
            {userPhone && userPhone !== 'N/A' && (
              <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                <Col>
                  <Text style={{ fontSize: 14, lineHeight: '20px', color: theme === 'dark' ? '#fff' : '#000000', fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>
                    Phone
                  </Text>
                </Col>
                <Col>
                  <Text strong style={{ fontSize: 14, lineHeight: '20px', color: theme === 'dark' ? '#fff' : '#000000', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                    {userPhone}
                  </Text>
                </Col>
              </Row>
            )}
            {userEmail && userEmail !== 'N/A' && (
              <Row justify="space-between" align="middle">
                <Col>
                  <Text style={{ fontSize: 14, lineHeight: '20px', color: theme === 'dark' ? '#fff' : '#000000', fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>
                    Email
                  </Text>
                </Col>
                <Col>
                  <Text strong style={{ fontSize: 14, lineHeight: '20px', color: theme === 'dark' ? '#fff' : '#000000', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                    {userEmail}
                  </Text>
                </Col>
              </Row>
            )}
          </div>
        </div>

        {/* Menu Items Section */}
        <div style={{ padding: '8px 0' }}>
          {profileMenuItems.map((item) => (
            <div
              key={item.key}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'all 0.2s ease',
                margin: '2px 0',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme === 'dark' ? '#262626' : '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => handleProfileMenuClick(item.key)}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AntHeader
      style={{
        position: 'fixed',
        top: 0,
        zIndex: 1000,
        width: '100%',
        background: theme === 'dark' ? '#1f1f1f' : '#fff',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${theme === 'dark' ? '#303030' : '#f0f0f0'}`,
        height: '64px',
        lineHeight: '64px',
        boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* LEFT: Application logo with name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Logo placeholder - you can replace this with an actual logo image */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '18px',
          flexShrink: 0,
        }}>
          SP
        </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
          <Text style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1890ff',
            fontFamily: 'Inter, sans-serif',
          }}>
            Shipping Pro
          </Text>
          <Text style={{ 
            fontSize: '14px', 
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
            fontStyle: 'italic',
            fontFamily: 'Inter, sans-serif',
          }}>
            Bulk Shipping Platform
          </Text>
        </div>
      </div>
      
      {/* RIGHT: User info and notifications */}
      <Space size="large" style={{ height: '100%', alignItems: 'center' }}>
        <Tooltip title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
          <Button
            type="text"
            icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
            onClick={toggleTheme}
            style={{
              fontSize: '18px',
              color: theme === 'dark' ? '#fff' : '#595959',
            }}
          />
        </Tooltip>
        <Badge count={0} size="small">
          <BellOutlined 
            style={{ 
              fontSize: '18px', 
              cursor: 'pointer',
              color: theme === 'dark' ? '#fff' : '#595959'
            }} 
          />
        </Badge>
        
        {/* User Avatar with Dropdown */}
        <Dropdown
          dropdownRender={() => <ProfileDropdownContent />}
          trigger={['click']}
          placement="bottomRight"
          open={profileDropdownOpen}
          onOpenChange={setProfileDropdownOpen}
          overlayClassName="user-profile-dropdown"
          align={{ offset: [0, 8] }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '8px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#262626' : '#f5f5f5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          >
            <Avatar 
              size={38}
              style={{ 
                backgroundColor: '#1890ff',
                boxShadow: '0px 2px 0px 0px rgba(5, 145, 255, 0.1)',
                marginRight: '12px',
              }}
            >
              {getInitials(userName)}
            </Avatar>
            <div style={{ lineHeight: '1.5' }}>
              <div style={{ fontWeight: '500', fontSize: '15px', color: theme === 'dark' ? '#fff' : '#262626' }}>
                {userName}
              </div>
              <div style={{ 
                color: '#52c41a', 
                fontWeight: '600', 
                fontSize: '15px'
              }}>
                ${balance.toFixed(2)}
              </div>
            </div>
          </div>
        </Dropdown>
      </Space>
      
      {/* Custom CSS for dropdown alignment */}
      <style>{`
        .user-profile-dropdown {
          padding: 0 !important;
          margin: 0 !important;
        }
        /* Ensure dropdown aligns to right edge */
        .ant-dropdown.user-profile-dropdown {
          right: 24px !important;
        }
        .ant-dropdown.user-profile-dropdown .ant-dropdown-content {
          margin-right: 0 !important;
        }
        /* Position the dropdown wrapper correctly */
        .ant-dropdown.user-profile-dropdown .ant-dropdown-content-wrapper {
          right: 0 !important;
          left: auto !important;
        }
      `}</style>
    </AntHeader>
  );
};

export default Header;
