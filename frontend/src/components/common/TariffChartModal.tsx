import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Table,
  Typography,
  Tag,
  Spin,
  Alert,
  Space,
} from 'antd';
import {
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TabsProps } from 'antd';
import { shipmentService } from '../../services/shipmentService';
import { TariffChartData, ZoneRate } from '../../types/shipment';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Text } = Typography;

interface TariffChartModalProps {
  visible: boolean;
  onClose: () => void;
}

interface RateTableRow {
  key: string;
  service: string;
  zone1?: ZoneRate;
  zone2?: ZoneRate;
  zone3?: ZoneRate;
  zone4?: ZoneRate;
  zone5?: ZoneRate;
  zone6?: ZoneRate;
  zone7?: ZoneRate;
  zone8?: ZoneRate;
}

const TariffChartModal: React.FC<TariffChartModalProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tariffData, setTariffData] = useState<TariffChartData | null>(null);

  useEffect(() => {
    if (visible && !tariffData) {
      loadTariffData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadTariffData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shipmentService.getTariffChart();
      setTariffData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tariff chart');
    } finally {
      setLoading(false);
    }
  };

  const formatRate = (rate: ZoneRate) => {
    const basePrice = parseFloat(rate.base_price).toFixed(2);
    const perOzRate = parseFloat(rate.per_oz_rate).toFixed(3);
    return `$${basePrice} + $${perOzRate}/oz`;
  };

  const createTableData = (providerRates: { [serviceName: string]: any }): RateTableRow[] => {
    const rows: RateTableRow[] = [];
    
    Object.keys(providerRates).forEach((serviceName) => {
      const serviceData = providerRates[serviceName];
      const zones = serviceData.zones || {};
      
      rows.push({
        key: serviceName,
        service: serviceName,
        zone1: zones[1],
        zone2: zones[2],
        zone3: zones[3],
        zone4: zones[4],
        zone5: zones[5],
        zone6: zones[6],
        zone7: zones[7],
        zone8: zones[8],
      });
    });
    
    return rows;
  };

  const createColumns = (intrastateZones: number[], interstateZones: number[]): ColumnsType<RateTableRow> => {
    const columns: ColumnsType<RateTableRow> = [
      {
        title: 'Service',
        dataIndex: 'service',
        key: 'service',
        fixed: 'left',
        width: 200,
        render: (text: string) => <Text strong>{text}</Text>,
      },
    ];

    // Add intrastate zone columns
    intrastateZones.forEach((zone) => {
      columns.push({
        title: (
          <div>
            <div>Zone {zone}</div>
            <Tag color="blue" style={{ marginTop: 4, fontSize: '10px' }}>Intrastate</Tag>
          </div>
        ),
        key: `zone${zone}`,
        dataIndex: `zone${zone}`,
        width: 150,
        align: 'center',
        render: (rate: ZoneRate | undefined) => {
          if (!rate) return '-';
          return (
            <div style={{ fontWeight: 500 }}>
              {formatRate(rate)}
            </div>
          );
        },
      });
    });

    // Add interstate zone columns
    interstateZones.forEach((zone) => {
      columns.push({
        title: (
          <div>
            <div>Zone {zone}</div>
            <Tag color="orange" style={{ marginTop: 4, fontSize: '10px' }}>Interstate</Tag>
          </div>
        ),
        key: `zone${zone}`,
        dataIndex: `zone${zone}`,
        width: 150,
        align: 'center',
        render: (rate: ZoneRate | undefined) => {
          if (!rate) return '-';
          return (
            <div style={{ fontWeight: 500 }}>
              {formatRate(rate)}
            </div>
          );
        },
      });
    });

    return columns;
  };

  const getZoneBackgroundColor = (zone: number, intrastateZones: number[]) => {
    if (intrastateZones.includes(zone)) {
      return theme === 'dark' ? 'rgba(24, 144, 255, 0.1)' : '#e6f7ff';
    }
    return theme === 'dark' ? 'rgba(255, 140, 0, 0.1)' : '#fff7e6';
  };

  if (!tariffData && !loading && !error) {
    return null;
  }

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>Shipping Tariff Chart</Title>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Zone-based pricing for all providers and services
          </Text>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ top: 20 }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading tariff chart...</div>
        </div>
      )}

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          action={
            <Space>
              <a href="javascript:void(0)" onClick={(e) => { e.preventDefault(); loadTariffData(); }}>Retry</a>
            </Space>
          }
        />
      )}

      {tariffData && !loading && (
        <div>
          <div style={{ marginBottom: 16, padding: '12px', background: theme === 'dark' ? '#1f1f1f' : '#f5f5f5', borderRadius: 4 }}>
            <Space>
              <InfoCircleOutlined />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>Zones 1-3:</strong> Intrastate (same state) - Lower rates
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>Zones 4-8:</strong> Interstate (different states) - Higher rates
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>Rate Format:</strong> Base Price + Per-Ounce Rate (varies by zone)
              </Text>
            </Space>
          </div>

          <Tabs
            defaultActiveKey="USPS"
            items={[
              tariffData.providers.USPS && {
                key: 'USPS',
                label: 'USPS',
                children: (
                  <Table
                    columns={createColumns(
                      tariffData.zone_info.intrastate_zones,
                      tariffData.zone_info.interstate_zones
                    )}
                    dataSource={createTableData(tariffData.providers.USPS)}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    size="small"
                    rowClassName={(record, index) => {
                      return index % 2 === 0
                        ? theme === 'dark' ? 'dark-row-even' : 'light-row-even'
                        : theme === 'dark' ? 'dark-row-odd' : 'light-row-odd';
                    }}
                  />
                ),
              },
              tariffData.providers.UPS && {
                key: 'UPS',
                label: 'UPS',
                children: (
                  <Table
                    columns={createColumns(
                      tariffData.zone_info.intrastate_zones,
                      tariffData.zone_info.interstate_zones
                    )}
                    dataSource={createTableData(tariffData.providers.UPS)}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    size="small"
                    rowClassName={(record, index) => {
                      return index % 2 === 0
                        ? theme === 'dark' ? 'dark-row-even' : 'light-row-even'
                        : theme === 'dark' ? 'dark-row-odd' : 'light-row-odd';
                    }}
                  />
                ),
              },
              tariffData.providers.FedEx && {
                key: 'FedEx',
                label: 'FedEx',
                children: (
                  <Table
                    columns={createColumns(
                      tariffData.zone_info.intrastate_zones,
                      tariffData.zone_info.interstate_zones
                    )}
                    dataSource={createTableData(tariffData.providers.FedEx)}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    size="small"
                    rowClassName={(record, index) => {
                      return index % 2 === 0
                        ? theme === 'dark' ? 'dark-row-even' : 'light-row-even'
                        : theme === 'dark' ? 'dark-row-odd' : 'light-row-odd';
                    }}
                  />
                ),
              },
            ].filter(Boolean) as TabsProps['items']}
          />

          <style>{`
            .ant-table-thead > tr > th {
              background: ${theme === 'dark' ? '#1f1f1f' : '#fafafa'} !important;
              color: ${theme === 'dark' ? '#fff' : '#262626'} !important;
              border-bottom: 1px solid ${theme === 'dark' ? '#303030' : '#f0f0f0'};
            }
            
            .ant-table-tbody > tr > td {
              color: ${theme === 'dark' ? '#fff' : '#262626'} !important;
              border-bottom: 1px solid ${theme === 'dark' ? '#303030' : '#f0f0f0'};
            }
            
            .ant-table-tbody > tr:hover > td {
              background-color: ${theme === 'dark' ? '#262626' : '#fafafa'} !important;
            }
            
            .light-row-even {
              background-color: #fafafa;
            }
            
            .light-row-odd {
              background-color: #ffffff;
            }
            
            .dark-row-even {
              background-color: #1f1f1f;
            }
            
            .dark-row-odd {
              background-color: #141414;
            }
            
            .ant-table-tbody > tr > td:nth-child(2),
            .ant-table-tbody > tr > td:nth-child(3),
            .ant-table-tbody > tr > td:nth-child(4) {
              background-color: ${getZoneBackgroundColor(1, tariffData.zone_info.intrastate_zones)} !important;
            }
            
            .ant-table-tbody > tr > td:nth-child(5),
            .ant-table-tbody > tr > td:nth-child(6),
            .ant-table-tbody > tr > td:nth-child(7),
            .ant-table-tbody > tr > td:nth-child(8),
            .ant-table-tbody > tr > td:nth-child(9) {
              background-color: ${getZoneBackgroundColor(4, tariffData.zone_info.intrastate_zones)} !important;
            }
          `}</style>
        </div>
      )}
    </Modal>
  );
};

export default TariffChartModal;
