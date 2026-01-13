import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  DatePicker,
  Space,
  Skeleton,
  Empty,
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
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

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);

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
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : (
        <Card 
          title={
            <Space>
              <CalendarOutlined />
              <span>Daily Spending & Shipped Orders</span>
            </Space>
          }
          className="dashboard-card"
        >
          {dailyData.length > 0 ? (
            <div className="bar-chart-container">
              <div className="bar-chart-legend">
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#1890ff' }}></span>
                  <span>Amount Spent ($)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#52c41a' }}></span>
                  <span>Orders Shipped</span>
                </div>
              </div>
              
              <div className="bar-chart">
                {dailyData.map((item) => (
                  <div key={item.date} className="bar-chart-day">
                    <div className="bar-chart-date">
                      {dayjs(item.date).format('MMM DD')}
                    </div>
                    <div className="bar-chart-bars">
                      {/* Amount Spent Bar */}
                      <div className="bar-wrapper">
                        <div 
                          className="bar bar-amount"
                          style={{ 
                            height: `${(item.amountSpent / maxAmount) * 100}%`,
                            minHeight: item.amountSpent > 0 ? '4px' : '0'
                          }}
                          title={`$${item.amountSpent.toFixed(2)}`}
                        >
                          {item.amountSpent > 0 && (
                            <span className="bar-value">${item.amountSpent.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="bar-label">Spent</div>
                      </div>
                      
                      {/* Orders Shipped Bar */}
                      <div className="bar-wrapper">
                        <div 
                          className="bar bar-orders"
                          style={{ 
                            height: `${(item.ordersShipped / maxOrders) * 100}%`,
                            minHeight: item.ordersShipped > 0 ? '4px' : '0'
                          }}
                          title={`${item.ordersShipped} orders`}
                        >
                          {item.ordersShipped > 0 && (
                            <span className="bar-value">{item.ordersShipped}</span>
                          )}
                        </div>
                        <div className="bar-label">Shipped</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty description="No data available for selected date range" />
          )}
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
