import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  DatePicker,
  Table,
  Tag,
  Space,
  Select,
  Skeleton,
  Empty,
} from 'antd';
import {
  ShoppingOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { shipmentService } from '../../services/shipmentService';
import { Shipment } from '../../types/shipment';
import './Dashboard.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface DashboardStats {
  totalShipments: number;
  completedShipments: number;
  shippedShipments: number; // Shipments with labels (4th stage completed)
  inProgressShipments: number;
  totalRevenue: number;
  shipmentsByStatus: Record<string, number>;
  shipmentsByDate: Array<{ date: string; count: number; revenue: number }>;
  recentShipments: Shipment[];
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [stats, setStats] = useState<DashboardStats>({
    totalShipments: 0,
    completedShipments: 0,
    shippedShipments: 0,
    inProgressShipments: 0,
    totalRevenue: 0,
    shipmentsByStatus: {},
    shipmentsByDate: [],
    recentShipments: [],
  });

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const allShipments = await shipmentService.getShipments();
      
      // Filter by date range if selected
      let filteredShipments = allShipments;
      if (dateRange[0] && dateRange[1]) {
        filteredShipments = allShipments.filter(shipment => {
          if (!shipment.process_date) return false;
          const processDate = dayjs(shipment.process_date);
          return processDate.isAfter(dateRange[0]!.subtract(1, 'day')) && 
                 processDate.isBefore(dateRange[1]!.add(1, 'day'));
        });
      }

      // Calculate statistics
      const totalShipments = filteredShipments.length;
      const completedShipments = filteredShipments.filter(s => s.status === 'ready').length;
      const shippedShipments = filteredShipments.filter(s => s.has_label === true).length; // 4th stage completed
      const inProgressShipments = filteredShipments.filter(s => 
        s.status === 'needs_review' || 
        s.status === 'needs_review_address' || 
        s.status === 'needs_review_package'
      ).length;
      
      const totalRevenue = filteredShipments.reduce((sum, s) => {
        return sum + (Number(s.shipping_cost) || 0);
      }, 0);

      // Group by status
      const shipmentsByStatus: Record<string, number> = {};
      filteredShipments.forEach(shipment => {
        shipmentsByStatus[shipment.status] = (shipmentsByStatus[shipment.status] || 0) + 1;
      });

      // Group by date
      const dateMap = new Map<string, { count: number; revenue: number }>();
      filteredShipments.forEach(shipment => {
        if (shipment.process_date) {
          const date = shipment.process_date;
          const existing = dateMap.get(date) || { count: 0, revenue: 0 };
          dateMap.set(date, {
            count: existing.count + 1,
            revenue: existing.revenue + (Number(shipment.shipping_cost) || 0),
          });
        }
      });
      const shipmentsByDate = Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Recent shipments (last 10)
      const recentShipments = filteredShipments
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      setStats({
        totalShipments,
        completedShipments,
        shippedShipments,
        inProgressShipments,
        totalRevenue,
        shipmentsByStatus,
        shipmentsByDate,
        recentShipments,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      ready: { color: 'success', label: 'Ready' },
      needs_review: { color: 'warning', label: 'Needs Review' },
      needs_review_address: { color: 'orange', label: 'Needs Review - Address' },
      needs_review_package: { color: 'orange', label: 'Needs Review - Package' },
      invalid: { color: 'error', label: 'Invalid' },
    };
    const config = statusConfig[status] || { color: 'default', label: status };
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  const recentColumns: ColumnsType<Shipment> = [
    {
      title: 'Order Number',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'Recipient',
      key: 'recipient',
      width: 200,
      render: (_, record) => `${record.to_first_name} ${record.to_last_name}`.trim() || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status, record) => (
        <Space direction="vertical" size={4}>
          {getStatusTag(status)}
          {record.has_label && (
            <Tag color="green" style={{ margin: 0 }}>Shipped</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Tracking',
      key: 'tracking',
      width: 120,
      render: (_, record) => record.tracking_number || '-',
    },
    {
      title: 'Shipping Cost',
      dataIndex: 'shipping_cost',
      key: 'shipping_cost',
      width: 120,
      render: (cost) => cost ? `$${Number(cost).toFixed(2)}` : '-',
    },
    {
      title: 'Process Date',
      dataIndex: 'process_date',
      key: 'process_date',
      width: 120,
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : '-',
    },
  ];

  const completionRate = stats.totalShipments > 0 
    ? ((stats.completedShipments / stats.totalShipments) * 100).toFixed(1)
    : '0';

  return (
    <div className="dashboard-container">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        <Space>
          <RangePicker
            format="YYYY-MM-DD"
            onChange={(dates) => {
              if (dates) {
                setDateRange([dates[0], dates[1]]);
              } else {
                setDateRange([null, null]);
              }
            }}
            placeholder={['Start Date', 'End Date']}
            allowClear
          />
        </Space>
      </div>

      {loading ? (
        <div style={{ padding: '24px' }}>
          <Skeleton active paragraph={{ rows: 4 }} style={{ marginBottom: 24 }} />
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={i}>
                <Card>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))}
          </Row>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : (
        <>
          {/* Statistics Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={8} xl={6}>
              <Card className="stat-card stat-card-primary">
                <Statistic
                  title="Total Shipments"
                  value={stats.totalShipments}
                  prefix={<ShoppingOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                {dateRange[0] && dateRange[1] && (
                  <div style={{ marginTop: 8, fontSize: '14px', color: '#8c8c8c' }}>
                    {dayjs(dateRange[0]).format('MMM DD')} - {dayjs(dateRange[1]).format('MMM DD, YYYY')}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8} xl={6}>
              <Card className="stat-card stat-card-success">
                <Statistic
                  title="Shipped (Stage 4)"
                  value={stats.shippedShipments}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                  suffix={
                    <span style={{ fontSize: '15px', color: '#8c8c8c' }}>
                      ({stats.totalShipments > 0 ? ((stats.shippedShipments / stats.totalShipments) * 100).toFixed(1) : '0'}%)
                    </span>
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8} xl={6}>
              <Card className="stat-card stat-card-info">
                <Statistic
                  title="Ready for Shipping"
                  value={stats.completedShipments}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                  suffix={
                    <span style={{ fontSize: '15px', color: '#8c8c8c' }}>
                      ({completionRate}%)
                    </span>
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8} xl={6}>
              <Card className="stat-card stat-card-warning">
                <Statistic
                  title="In Progress"
                  value={stats.inProgressShipments}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8} xl={6}>
              <Card className="stat-card stat-card-revenue">
                <Statistic
                  title="Total Revenue"
                  value={stats.totalRevenue}
                  precision={2}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Charts and Details Row */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* Status Distribution */}
            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <FileTextOutlined />
                    <span>Status Distribution</span>
                  </Space>
                }
                className="dashboard-card"
              >
                {Object.keys(stats.shipmentsByStatus).length > 0 ? (
                  <div className="status-distribution">
                    {Object.entries(stats.shipmentsByStatus).map(([status, count]) => {
                      const percentage = stats.totalShipments > 0 
                        ? ((count / stats.totalShipments) * 100).toFixed(1)
                        : '0';
                      return (
                        <div key={status} className="status-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>{getStatusTag(status)}</span>
                            <span style={{ fontWeight: 600 }}>{count} ({percentage}%)</span>
                          </div>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: status === 'ready' ? '#52c41a' : 
                                                status === 'invalid' ? '#ff4d4f' : '#faad14'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty description="No data available" />
                )}
              </Card>
            </Col>

            {/* Shipments by Date */}
            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <CalendarOutlined />
                    <span>Shipments by Date</span>
                  </Space>
                }
                className="dashboard-card"
              >
                {stats.shipmentsByDate.length > 0 ? (
                  <div className="date-stats">
                    {stats.shipmentsByDate.slice(-7).map((item) => (
                      <div key={item.date} className="date-stat-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500 }}>
                            {dayjs(item.date).format('MMM DD, YYYY')}
                          </span>
                          <Space>
                            <span style={{ color: '#1890ff' }}>{item.count} orders</span>
                            <span style={{ color: '#722ed1', fontWeight: 600 }}>
                              ${item.revenue.toFixed(2)}
                            </span>
                          </Space>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="No data available" />
                )}
              </Card>
            </Col>
          </Row>

          {/* Recent Shipments Table */}
          <Card 
            title={
              <Space>
                <FileTextOutlined />
                <span>Recent Shipments</span>
              </Space>
            }
            className="dashboard-card"
          >
            {stats.recentShipments.length > 0 ? (
              <Table
                columns={recentColumns}
                dataSource={stats.recentShipments}
                rowKey="id"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                size="small"
              />
            ) : (
              <Empty description="No recent shipments" />
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default Dashboard;
