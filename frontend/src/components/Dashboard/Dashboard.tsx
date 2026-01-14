import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  DatePicker,
  Space,
  Skeleton,
  Empty,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  ShoppingOutlined,
  CheckCircleOutlined,
  LineChartOutlined,
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
  amountSpent: number; // Total shipping cost for that day
  ordersShipped: number; // Count of shipped orders (has_label = true)
}

interface SummaryStats {
  totalSpent: number;
  totalOrders: number;
  averageOrderValue: number;
  totalShipments: number;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalSpent: 0,
    totalOrders: 0,
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
          amountSpent: data.amountSpent,
          ordersShipped: data.ordersShipped
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyData(daily);

      // Calculate summary statistics
      const totalSpent = daily.reduce((sum, d) => sum + d.amountSpent, 0);
      const totalOrders = daily.reduce((sum, d) => sum + d.ordersShipped, 0);
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      const totalShipments = filteredShipments.length;

      setSummaryStats({
        totalSpent,
        totalOrders,
        averageOrderValue,
        totalShipments,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate max values for scaling
  const maxAmount = Math.max(...dailyData.map(d => d.amountSpent), 1);
  const maxOrders = Math.max(...dailyData.map(d => d.ordersShipped), 1);

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
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card><Skeleton active /></Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card><Skeleton active /></Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card><Skeleton active /></Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card><Skeleton active /></Card>
          </Col>
        </Row>
      ) : (
        <>
          {/* Summary Statistics Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title="Total Spent"
                  value={summaryStats.totalSpent}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title="Orders Shipped"
                  value={summaryStats.totalOrders}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title="Average Order Value"
                  value={summaryStats.averageOrderValue}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title="Total Shipments"
                  value={summaryStats.totalShipments}
                  prefix={<ShoppingOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Daily Line Chart */}
          <Card 
            title={
              <Space>
                <LineChartOutlined />
                <span>Daily Spending & Shipped Orders</span>
              </Space>
            }
            className="dashboard-card"
          >
            {dailyData.length > 0 ? (
              <div className="line-chart-container">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={dailyData.map(item => ({
                      date: dayjs(item.date).format('MMM DD'),
                      fullDate: item.date,
                      'Amount Spent ($)': Number(item.amountSpent.toFixed(2)),
                      'Orders Shipped': item.ordersShipped,
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis 
                      yAxisId="left"
                      label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      label={{ value: 'Orders', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip 
                      formatter={(value: any, name?: string) => {
                        const displayName = name || '';
                        if (displayName === 'Amount Spent ($)') {
                          return [`$${Number(value).toFixed(2)}`, displayName];
                        }
                        return [value, displayName];
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="basis"
                      dataKey="Amount Spent ($)"
                      stroke="#8884d8"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, stroke: '#8884d8', strokeWidth: 2, fill: '#fff' }}
                      name="Amount Spent ($)"
                      connectNulls={true}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                    <Line
                      yAxisId="right"
                      type="basis"
                      dataKey="Orders Shipped"
                      stroke="#82ca9d"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, stroke: '#82ca9d', strokeWidth: 2, fill: '#fff' }}
                      name="Orders Shipped"
                      connectNulls={true}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="No data available for selected date range" />
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default Dashboard;
