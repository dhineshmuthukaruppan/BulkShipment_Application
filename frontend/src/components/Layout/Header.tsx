import React, { useState } from 'react';
import { Layout, Typography, Space, Badge, Avatar, Dropdown, Row, Col, Divider, MenuProps } from 'antd';
import { 
  UserOutlined, 
  BellOutlined,
  SettingOutlined,
  LogoutOutlined,
  CreditCardOutlined,
  MessageOutlined,
} from '@ant-design/icons';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface HeaderProps {
  userName?: string;
  balance?: number;
  userEmail?: string;
  userPhone?: string;
}

const Header: React.FC<HeaderProps> = ({ 
  userName = 'John Doe', 
  balance = 100.00,
  userEmail = 'john.doe@example.com',
  userPhone = '+1 (555) 123-4567'
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

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
          <CreditCardOutlined style={{ fontSize: 14 }} />
          <Text style={{ fontSize: 14, lineHeight: '22px', fontFamily: 'Inter, sans-serif' }}>
            Manage Subscription & Usage
          </Text>
        </Space>
      ),
    },
    {
      key: 'help',
      label: (
        <Space size={8}>
          <MessageOutlined style={{ fontSize: 14 }} />
          <Text style={{ fontSize: 14, lineHeight: '22px', fontFamily: 'Inter, sans-serif' }}>
            Help & Support
          </Text>
        </Space>
      ),
    },
    {
      key: 'logout',
      label: (
        <Space size={8}>
          <LogoutOutlined style={{ fontSize: 14 }} />
          <Text style={{ fontSize: 14, lineHeight: '22px', fontFamily: 'Inter, sans-serif' }}>
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
        backgroundColor: '#ffffff',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        width: 320,
        padding: '4px 0',
        margin: 0,
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
                fontSize: 14, 
                lineHeight: '22px',
                color: '#000000',
                display: 'block',
                marginBottom: 4,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
              }}>
                {userName}
              </Text>
              <Text style={{ 
                fontSize: 14, 
                lineHeight: '22px',
                color: '#000000',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
              }}>
                Account Balance: <Text strong style={{ color: '#52c41a' }}>${balance.toFixed(2)}</Text>
              </Text>
            </Col>
          </Row>
        </div>

        <div style={{ backgroundColor: '#f5f5f5' }}>
          <Divider style={{ margin: 0, borderColor: 'rgba(0, 0, 0, 0.06)' }} />
          
          {/* Contact Details Section */}
          <div style={{ 
            backgroundColor: '#f5f5f5',
            padding: '12px 16px',
            margin: '0px 0',
          }}>
            {userPhone && userPhone !== 'N/A' && (
              <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                <Col>
                  <Text style={{ fontSize: 12, lineHeight: '20px', color: '#000000', fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>
                    Phone
                  </Text>
                </Col>
                <Col>
                  <Text strong style={{ fontSize: 12, lineHeight: '20px', color: '#000000', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                    {userPhone}
                  </Text>
                </Col>
              </Row>
            )}
            {userEmail && userEmail !== 'N/A' && (
              <Row justify="space-between" align="middle">
                <Col>
                  <Text style={{ fontSize: 12, lineHeight: '20px', color: '#000000', fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>
                    Email
                  </Text>
                </Col>
                <Col>
                  <Text strong style={{ fontSize: 12, lineHeight: '20px', color: '#000000', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
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
                e.currentTarget.style.backgroundColor = '#f5f5f5';
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
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #f0f0f0',
        height: '64px',
        lineHeight: '64px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
            fontSize: '12px', 
            color: 'rgba(0, 0, 0, 0.65)',
            fontStyle: 'italic',
            fontFamily: 'Inter, sans-serif',
          }}>
            Bulk Shipping Platform
          </Text>
        </div>
      </div>
      
      {/* RIGHT: User info and notifications */}
      <Space size="large" style={{ height: '100%', alignItems: 'center' }}>
        <Badge count={0} size="small">
          <BellOutlined 
            style={{ 
              fontSize: '18px', 
              cursor: 'pointer',
              color: '#595959'
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
            e.currentTarget.style.backgroundColor = '#f5f5f5';
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
              <div style={{ fontWeight: '500', fontSize: '14px', color: '#262626' }}>
                {userName}
              </div>
              <div style={{ 
                color: '#52c41a', 
                fontWeight: '600', 
                fontSize: '14px'
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
