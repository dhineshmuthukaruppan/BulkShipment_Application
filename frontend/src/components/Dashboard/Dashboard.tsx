import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  DatePicker,
  Space,
  Skeleton,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  DollarOutlined,
  CheckCircleOutlined,
  ShoppingOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { shipmentService } from '../../services/shipmentService';
import { Shipment } from '../../types/shipment';
import './Dashboard.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface DailyData {
  date: string;
  amountSpent: number;
  ordersShipped: number;
}

interface DashboardMetrics {
  totalSpent: number;
  ordersShipped: number;
  averageOrderValue: number;
  totalShipments: number;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalSpent: 0,
    ordersShipped: 0,
    averageOrderValue: 0,
    totalShipments: 0,
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

      // Calculate metrics
      const shippedShipments = filteredShipments.filter(s => s.has_label);
      const totalSpent = shippedShipments.reduce((sum, s) => sum + (Number(s.shipping_cost) || 0), 0);
      const ordersShipped = shippedShipments.length;
      const averageOrderValue = ordersShipped > 0 ? totalSpent / ordersShipped : 0;
      const totalShipments = filteredShipments.length;

      setMetrics({
        totalSpent,
        ordersShipped,
        averageOrderValue,
        totalShipments,
      });

      // Group by date: calculate amount spent and orders shipped per day
      const dateMap = new Map<string, { amountSpent: number; ordersShipped: number }>();
      
      filteredShipments.forEach(shipment => {
        if (shipment.process_date) {
          const date = shipment.process_date;
          const existing = dateMap.get(date) || { amountSpent: 0, ordersShipped: 0 };
          
          // Amount spent = shipping cost (only for shipped orders)
          if (shipment.has_label) {
            existing.amountSpent += Number(shipment.shipping_cost) || 0;
            existing.ordersShipped += 1;
          }
          
          dateMap.set(date, existing);
        }
      });

      const daily = Array.from(dateMap.entries())
        .map(([date, data]) => ({ 
          date, 
          amountSpent: Number(data.amountSpent.toFixed(2)),
          ordersShipped: data.ordersShipped
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Format dates for display
      const formattedDaily = daily.map(item => ({
        ...item,
        dateFormatted: dayjs(item.date).format('MMM DD'),
      }));

      setDailyData(formattedDaily);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data - ensure we have data points even if empty
  const chartData = dailyData.length > 0 
    ? dailyData 
    : [{ date: dayjs().format('YYYY-MM-DD'), dateFormatted: dayjs().format('MMM DD'), amountSpent: 0, ordersShipped: 0 }];

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
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          {/* Key Metrics Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="metric-card">
                <Statistic
                  title="Total Spent"
                  value={metrics.totalSpent}
                  prefix={<DollarOutlined style={{ color: '#1890ff' }} />}
                  precision={2}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="metric-card">
                <Statistic
                  title="Orders Shipped"
                  value={metrics.ordersShipped}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="metric-card">
                <Statistic
                  title="Average Order Value"
                  value={metrics.averageOrderValue}
                  prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
                  precision={2}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="metric-card">
                <Statistic
                  title="Total Shipments"
                  value={metrics.totalShipments}
                  prefix={<InboxOutlined style={{ color: '#fa8c16' }} />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Daily Spending & Shipped Orders Chart */}
          <Card 
            title={
              <Space>
                <InboxOutlined />
                <span>Daily Spending & Shipped Orders</span>
              </Space>
            }
            className="dashboard-card"
          >
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="dateFormatted" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left"
                  label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Orders', angle: 90, position: 'insideRight' }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: any, name?: string | undefined) => {
                    if (name === 'amountSpent') {
                      return [`$${Number(value).toFixed(2)}`, 'Amount Spent ($)'];
                    }
                    return [value, name || 'Orders Shipped'];
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => {
                    if (value === 'amountSpent') return 'Amount Spent ($)';
                    if (value === 'ordersShipped') return 'Orders Shipped';
                    return value;
                  }}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="amountSpent" 
                  stroke="#722ed1" 
                  strokeWidth={2}
                  dot={{ fill: '#722ed1', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="amountSpent"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="ordersShipped" 
                  stroke="#52c41a" 
                  strokeWidth={2}
                  dot={{ fill: '#52c41a', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="ordersShipped"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
};

export default Dashboard;
