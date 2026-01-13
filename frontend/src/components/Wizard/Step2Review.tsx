import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Input,
  Modal,
  Select,
  message,
  Tag,
  Popconfirm,
  Dropdown,
  MenuProps,
} from 'antd';
import {
  DeleteOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  BoxPlotOutlined,
  SaveOutlined,
  FilterOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  setShipments, 
  updateShipment, 
  removeShipment,
  setSelectedShipments,
  clearSelectedShipments,
  setCurrentStep,
  saveDraft,
  calculateTotalCost,
} from '../../store/slices/wizardSlice';
import { shipmentService, savedAddressService, savedPackageService } from '../../services/shipmentService';
import { Shipment, SavedAddress, SavedPackage } from '../../types/shipment';
import AddressModal from '../common/AddressModal';
import PackageModal from '../common/PackageModal';
import { useTheme } from '../../contexts/ThemeContext';

const { Title } = Typography;
const { Search } = Input;

const Step2Review: React.FC = () => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const { shipments, selectedShipments } = useAppSelector((state) => state.wizard);
  const [searchText, setSearchText] = useState('');
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editModalType, setEditModalType] = useState<'from' | 'to' | 'package' | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [savedPackages, setSavedPackages] = useState<SavedPackage[]>([]);
  const [bulkActionModal, setBulkActionModal] = useState<'address' | 'package' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [animatingShipments, setAnimatingShipments] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<{
    status?: string;
    shipFromAddress?: string;
    shipToAddress?: string;
    packageDetails?: string;
    orderNumber?: string;
    validationIssue?: string; // New filter for validation issues
  }>({});

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const [addresses, packages] = await Promise.all([
        savedAddressService.getAll(),
        savedPackageService.getAll(),
      ]);
      setSavedAddresses(addresses);
      setSavedPackages(packages);
    } catch (error) {
      console.error('Failed to load saved data:', error);
    }
  };

  const handleEdit = (shipment: Shipment, type: 'from' | 'to' | 'package') => {
    setEditingShipment(shipment);
    setEditModalType(type);
  };

  const handleSaveEdit = async (values: any) => {
    if (!editingShipment) return;

    try {
      const oldStatus = editingShipment.status;
      const updateData: any = {};
      
      if (editModalType === 'from') {
        Object.keys(values).forEach(key => {
          updateData[`from_${key}`] = values[key];
        });
      } else if (editModalType === 'to') {
        Object.keys(values).forEach(key => {
          if (key === 'phone') {
            updateData['to_phone'] = values[key];
            updateData['phone_num1'] = values[key];
          } else {
            updateData[`to_${key}`] = values[key];
          }
        });
      } else if (editModalType === 'package') {
        Object.assign(updateData, values);
      }

      await shipmentService.updateShipment(editingShipment.id, updateData);
      
      // Recalculate shipping if package changed
      if (editModalType === 'package') {
        const updated = await shipmentService.getShipment(editingShipment.id);
        await shipmentService.calculateShipping(updated.id, updated.shipping_service);
        const refreshed = await shipmentService.getShipment(updated.id);
        dispatch(updateShipment(refreshed));
        
        // Check status change
        if (oldStatus !== 'ready' && refreshed.status === 'ready') {
          message.success('✓ Marked ready');
        } else {
          message.success('Shipment updated successfully');
        }
      } else {
        // Always refresh to get the latest status after update
        const refreshed = await shipmentService.getShipment(editingShipment.id);
        dispatch(updateShipment(refreshed));
        
        // Check status change
        if (oldStatus !== 'ready' && refreshed.status === 'ready') {
          message.success('✓ Marked ready');
        } else {
          message.success('Shipment updated successfully');
        }
      }

      setEditModalType(null);
      setEditingShipment(null);
    } catch (error) {
      message.error('Failed to update shipment');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await shipmentService.deleteShipment(id);
      dispatch(removeShipment(id));
      setDeleteConfirmId(null);
      message.success('Shipment deleted');
    } catch (error) {
      message.error('Failed to delete shipment');
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedShipments.map(id => shipmentService.deleteShipment(id)));
      selectedShipments.forEach(id => dispatch(removeShipment(id)));
      dispatch(clearSelectedShipments());
      message.success(`Deleted ${selectedShipments.length} shipments`);
    } catch (error) {
      message.error('Failed to delete shipments');
    }
  };

  const handleBulkAddressChange = async (addressId: number) => {
    try {
      // Track old statuses before update
      const oldStatuses = shipments
        .filter(s => selectedShipments.includes(s.id))
        .map(s => ({ id: s.id, status: s.status }));
      
      await shipmentService.bulkUpdate(selectedShipments, { saved_address_id: addressId });
      
      // Fetch only the updated shipments instead of all shipments
      const updatedShipments = await Promise.all(
        selectedShipments.map(id => shipmentService.getShipment(id))
      );
      
      // Update Redux state with refreshed shipments
      const updatedShipmentsMap = new Map(updatedShipments.map(s => [s.id, s]));
      const refreshedShipments = shipments.map(s => 
        updatedShipmentsMap.get(s.id) || s
      );
      dispatch(setShipments(refreshedShipments));
      
      // Check for status upgrades
      const upgradedCount = refreshedShipments
        .filter(s => selectedShipments.includes(s.id))
        .filter(s => {
          const oldStatus = oldStatuses.find(os => os.id === s.id)?.status;
          return oldStatus !== 'ready' && s.status === 'ready';
        }).length;
      
      setBulkActionModal(null);
      dispatch(clearSelectedShipments());
      
      if (upgradedCount > 0) {
        message.success(`✓ ${upgradedCount} shipment${upgradedCount > 1 ? 's' : ''} marked ready`);
      } else {
        message.success(`Updated ${selectedShipments.length} shipments`);
      }
    } catch (error) {
      message.error('Failed to update shipments');
    }
  };

  const handleBulkPackageChange = async (packageId: number) => {
    try {
      // Track old statuses before update
      const oldStatuses = shipments
        .filter(s => selectedShipments.includes(s.id))
        .map(s => ({ id: s.id, status: s.status }));
      
      await shipmentService.bulkUpdate(selectedShipments, { saved_package_id: packageId });
      
      // Fetch only the updated shipments instead of all shipments
      const updatedShipments = await Promise.all(
        selectedShipments.map(id => shipmentService.getShipment(id))
      );
      
      // Update Redux state with refreshed shipments
      const updatedShipmentsMap = new Map(updatedShipments.map(s => [s.id, s]));
      const refreshedShipments = shipments.map(s => 
        updatedShipmentsMap.get(s.id) || s
      );
      dispatch(setShipments(refreshedShipments));
      
      // Check for status upgrades
      const upgradedCount = refreshedShipments
        .filter(s => selectedShipments.includes(s.id))
        .filter(s => {
          const oldStatus = oldStatuses.find(os => os.id === s.id)?.status;
          return oldStatus !== 'ready' && s.status === 'ready';
        }).length;
      
      setBulkActionModal(null);
      dispatch(clearSelectedShipments());
      
      if (upgradedCount > 0) {
        message.success(`✓ ${upgradedCount} shipment${upgradedCount > 1 ? 's' : ''} marked ready`);
      } else {
        message.success(`Updated ${selectedShipments.length} shipments`);
      }
    } catch (error) {
      message.error('Failed to update shipments');
    }
  };

  // Format address for display
  const formatAddress = (shipment: Shipment, type: 'from' | 'to') => {
    if (type === 'from') {
      const parts = [];
      if (shipment.from_first_name || shipment.from_last_name) {
        parts.push(`${shipment.from_first_name || ''} ${shipment.from_last_name || ''}`.trim());
      }
      if (shipment.from_address) {
        parts.push(shipment.from_address);
      }
      if (shipment.from_address2) {
        parts.push(shipment.from_address2);
      }
      if (shipment.from_city || shipment.from_state || shipment.from_zip) {
        const cityState = [shipment.from_city, shipment.from_state, shipment.from_zip]
          .filter(Boolean)
          .join(', ');
        if (cityState) parts.push(cityState);
      }
      return parts.length > 0 ? parts.join('\n') : 'No sender address';
    } else {
      const parts = [];
      if (shipment.to_first_name || shipment.to_last_name) {
        parts.push(`${shipment.to_first_name || ''} ${shipment.to_last_name || ''}`.trim());
      }
      if (shipment.to_address) {
        parts.push(shipment.to_address);
      }
      if (shipment.to_address2) {
        parts.push(shipment.to_address2);
      }
      if (shipment.to_city || shipment.to_state || shipment.to_zip) {
        const cityState = [shipment.to_city, shipment.to_state, shipment.to_zip]
          .filter(Boolean)
          .join(', ');
        if (cityState) parts.push(cityState);
      }
      return parts.join('\n');
    }
  };

  // Format package details
  const formatPackageDetails = (shipment: Shipment) => {
    const dims = `${shipment.length}" × ${shipment.width}" × ${shipment.height}"`;
    const weight = `${shipment.weight_lbs} lb ${shipment.weight_oz} oz`;
    return `${dims}\n${weight}`;
  };

  // Handle approve action - change status to ready
  const handleApprove = async (shipment: Shipment) => {
    if (shipment.status === 'ready') {
      return; // Already approved
    }

    try {
      const updated = await shipmentService.updateShipment(shipment.id, { status: 'ready' });
      dispatch(updateShipment(updated));
      message.success('Shipment approved successfully');
    } catch (error) {
      message.error('Failed to approve shipment');
    }
  };

  // Handle approve all selected shipments
  const handleApproveAll = async () => {
    if (selectedShipments.length === 0) {
      message.warning('No shipments selected');
      return;
    }

    try {
      // Filter out already approved shipments
      const toApprove = shipments.filter(
        s => selectedShipments.includes(s.id) && s.status !== 'ready'
      );

      if (toApprove.length === 0) {
        message.info('All selected shipments are already approved');
        return;
      }

      // Start animation for all selected shipments
      setAnimatingShipments(new Set(selectedShipments));

      // Approve all selected shipments - update status to 'ready' explicitly
      const approvePromises = selectedShipments.map(async (id) => {
        try {
          // Explicitly set status to 'ready'
          const updated = await shipmentService.updateShipment(id, { status: 'ready' });
          return updated;
        } catch (error) {
          console.error(`Failed to approve shipment ${id}:`, error);
          throw error;
        }
      });

      const updatedShipments = await Promise.all(approvePromises);
      
      // Verify all shipments were updated correctly
      const failedUpdates = updatedShipments.filter(s => s.status !== 'ready');
      if (failedUpdates.length > 0) {
        console.warn('Some shipments were not updated to ready status:', failedUpdates);
      }
      
      // Fetch the latest data for all updated shipments to ensure we have the correct status
      const refreshedShipments = await Promise.all(
        selectedShipments.map(id => shipmentService.getShipment(id))
      );
      
      // Verify refreshed shipments have correct status
      refreshedShipments.forEach(s => {
        if (selectedShipments.includes(s.id) && s.status !== 'ready') {
          console.warn(`Shipment ${s.id} status is ${s.status}, expected 'ready'`);
        }
      });
      
      // Update Redux state with refreshed shipments
      const updatedShipmentsMap = new Map(refreshedShipments.map(s => [s.id, s]));
      const refreshedShipmentsList = shipments.map(s => 
        updatedShipmentsMap.get(s.id) || s
      );
      dispatch(setShipments(refreshedShipmentsList));

      // Clear animation after a moment
      setTimeout(() => {
        setAnimatingShipments(new Set());
      }, 600);

      const approvedCount = refreshedShipments.filter(s => s.status === 'ready').length;
      message.success(`Successfully approved ${approvedCount} shipment${approvedCount > 1 ? 's' : ''}`);
    } catch (error: any) {
      console.error('Error approving shipments:', error);
      message.error(error.response?.data?.error || 'Failed to approve some shipments');
      setAnimatingShipments(new Set());
    }
  };

  // Get status tag - Simple 3-status system using Ant Design colors (not clickable anymore)
  const getStatusTag = (status: string, shipment: Shipment) => {
    const smallTagStyle = { 
      fontSize: '11px', 
      padding: '2px 8px', 
      lineHeight: '18px',
      margin: 0 
    };
    
    const tagProps: any = {
      style: { 
        cursor: 'default', // No longer clickable
        ...smallTagStyle
      },
    };

    switch (status) {
      case 'ready':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />} style={smallTagStyle} {...tagProps}>
            Ready
          </Tag>
        );
      case 'needs_review':
        return (
          <Tag 
            color="warning" 
            icon={<ExclamationCircleOutlined style={{ color: '#000000', fontSize: '11px' }} />} 
            style={{ color: '#000000', ...smallTagStyle }}
            {...tagProps}
          >
            Needs Review
          </Tag>
        );
      case 'needs_review_address':
        return (
          <Tag 
            color="warning" 
            icon={<ExclamationCircleOutlined style={{ color: '#000000', fontSize: '11px' }} />} 
            style={{ color: '#000000', ...smallTagStyle }}
            {...tagProps}
          >
            Needs Review - Address
          </Tag>
        );
      case 'needs_review_package':
        return (
          <Tag 
            color="warning" 
            icon={<ExclamationCircleOutlined style={{ color: '#000000', fontSize: '11px' }} />} 
            style={{ color: '#000000', ...smallTagStyle }}
            {...tagProps}
          >
            Needs Review - Package
          </Tag>
        );
      case 'invalid':
        return (
          <Tag color="error" icon={<CloseCircleOutlined style={{ fontSize: '11px' }} />} style={smallTagStyle}>
            Invalid
          </Tag>
        );
      default:
        return (
          <Tag 
            color="warning" 
            icon={<ExclamationCircleOutlined style={{ color: '#000000', fontSize: '11px' }} />} 
            style={{ color: '#000000', ...smallTagStyle }}
            {...tagProps}
          >
            Needs Review
          </Tag>
        );
    }
  };

  // Extract unique values for filter dropdowns
  const getUniqueFromAddresses = () => {
    const addressMap = new Map<string, string>();
    shipments.forEach(shipment => {
      const address = formatAddress(shipment, 'from');
      if (address && address !== 'No sender address') {
        addressMap.set(address, address);
      }
    });
    return Array.from(addressMap.values()).sort();
  };

  const getUniqueToAddresses = () => {
    const addressMap = new Map<string, string>();
    shipments.forEach(shipment => {
      const address = formatAddress(shipment, 'to');
      if (address) {
        addressMap.set(address, address);
      }
    });
    return Array.from(addressMap.values()).sort();
  };

  const getUniquePackageDetails = () => {
    const packageMap = new Map<string, string>();
    shipments.forEach(shipment => {
      const packageDetail = formatPackageDetails(shipment);
      if (packageDetail) {
        packageMap.set(packageDetail, packageDetail);
      }
    });
    return Array.from(packageMap.values()).sort();
  };

  const statusOptions = [
    { value: 'ready', label: 'Ready' },
    { value: 'needs_review', label: 'Needs Review' },
    { value: 'needs_review_address', label: 'Needs Review - Address' },
    { value: 'needs_review_package', label: 'Needs Review - Package' },
    { value: 'invalid', label: 'Invalid' },
  ];

  // Helper function to check if shipment has a specific validation issue
  const hasValidationIssue = (shipment: Shipment, issue: string): boolean => {
    const flags = shipment.validation_flags || [];
    
    // Map filter issue names to actual validation flags
    const issueMap: Record<string, string[]> = {
      'order_number_auto_generated': ['order_number_auto_generated'],
      'missing_order_number': ['missing_order_number', 'order_number_auto_generated'],
      'missing_sender_address': ['missing_sender_address'],
      'missing_recipient_address': ['missing_recipient_address', 'missing_recipient_address_line'],
      'missing_package_details': ['missing_package_details', 'auto_assigned_package'],
      'missing_pincode': ['missing_pincode'],
      'missing_weight': ['missing_weight'],
      'missing_dimensions': ['missing_dimensions'],
    };
    
    const relatedFlags = issueMap[issue] || [issue];
    return relatedFlags.some(flag => flags.includes(flag));
  };

  // Calculate counts for each validation issue
  const getValidationCounts = () => {
    return {
      autoFilledOrderNumber: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('order_number_auto_generated');
      }).length,
      missingOrderNumber: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return !s.order_number || 
               flags.includes('missing_order_number') || 
               flags.includes('order_number_auto_generated');
      }).length,
      missingAddressFrom: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('missing_sender_address');
      }).length,
      missingAddressTo: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('missing_recipient_address') || 
               flags.includes('missing_recipient_address_line');
      }).length,
      missingPackageDetails: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('missing_package_details') || 
               flags.includes('auto_assigned_package');
      }).length,
      missingPincode: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('missing_pincode');
      }).length,
      missingWeight: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('missing_weight');
      }).length,
      missingDimensions: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('missing_dimensions');
      }).length,
    };
  };

  const validationCounts = getValidationCounts();

  const filteredShipments = shipments.filter(shipment => {
    // Search text filter
    const searchLower = searchText.toLowerCase();
    const matchesSearch = !searchText || (
      shipment.to_first_name?.toLowerCase().includes(searchLower) ||
      shipment.to_last_name?.toLowerCase().includes(searchLower) ||
      shipment.to_address?.toLowerCase().includes(searchLower) ||
      shipment.order_number?.toLowerCase().includes(searchLower) ||
      formatAddress(shipment, 'to').toLowerCase().includes(searchLower)
    );

    // Status filter
    const matchesStatus = !filters.status || shipment.status === filters.status;

    // Ship from address filter
    const fromAddress = formatAddress(shipment, 'from');
    const matchesFromAddress = !filters.shipFromAddress || fromAddress === filters.shipFromAddress;

    // Ship to address filter
    const toAddress = formatAddress(shipment, 'to');
    const matchesToAddress = !filters.shipToAddress || toAddress === filters.shipToAddress;

    // Package details filter
    const packageDetail = formatPackageDetails(shipment);
    const matchesPackage = !filters.packageDetails || packageDetail === filters.packageDetails;

    // Order number filter
    const matchesOrderNumber = !filters.orderNumber || 
      shipment.order_number?.toLowerCase().includes(filters.orderNumber.toLowerCase());

    // Validation issue filter
    let matchesValidationIssue = true;
    if (filters.validationIssue) {
      matchesValidationIssue = hasValidationIssue(shipment, filters.validationIssue);
    }

    return matchesSearch && matchesStatus && matchesFromAddress && matchesToAddress && matchesPackage && matchesOrderNumber && matchesValidationIssue;
  });

  const columns: ColumnsType<Shipment> = [
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      fixed: 'left',
      sorter: (a, b) => {
        const statusOrder = { 'ready': 1, 'needs_review': 2, 'needs_review_address': 3, 'needs_review_package': 4, 'invalid': 5 };
        return (statusOrder[a.status as keyof typeof statusOrder] || 99) - (statusOrder[b.status as keyof typeof statusOrder] || 99);
      },
      sortDirections: ['ascend', 'descend'],
      showSorterTooltip: false,
      render: (status: string, record: Shipment) => getStatusTag(status, record),
    },
    {
      title: 'Ship From Address',
      dataIndex: 'formatted_from_address',
      width: 250,
      sorter: (a, b) => {
        const addrA = formatAddress(a, 'from').toLowerCase();
        const addrB = formatAddress(b, 'from').toLowerCase();
        return addrA.localeCompare(addrB);
      },
      sortDirections: ['ascend', 'descend'],
      showSorterTooltip: false,
      render: (_, record) => (
        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '13px' }}>
          {formatAddress(record, 'from')}
        </div>
      ),
    },
    {
      title: 'Ship To Address',
      dataIndex: 'formatted_to_address',
      width: 250,
      sorter: (a, b) => {
        const addrA = formatAddress(a, 'to').toLowerCase();
        const addrB = formatAddress(b, 'to').toLowerCase();
        return addrA.localeCompare(addrB);
      },
      sortDirections: ['ascend', 'descend'],
      showSorterTooltip: false,
      render: (_, record) => (
        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '13px' }}>
          {formatAddress(record, 'to')}
        </div>
      ),
    },
    {
      title: 'Package Details',
      dataIndex: 'package_details',
      width: 200,
      sorter: (a, b) => {
        const weightA = (a.billable_weight || a.weight_lbs || 0) * 16 + (a.weight_oz || 0);
        const weightB = (b.billable_weight || b.weight_lbs || 0) * 16 + (b.weight_oz || 0);
        return weightA - weightB;
      },
      sortDirections: ['ascend', 'descend'],
      showSorterTooltip: false,
      render: (_, record) => (
        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '12px' }}>
          <div>{formatPackageDetails(record)}</div>
          {record.billable_weight != null && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: theme === 'dark' ? '#8c8c8c' : '#595959' }}>
              {record.dimensional_weight != null && (
                <div>
                  Dim: {Number(record.dimensional_weight).toFixed(2)} lbs | 
                  Billable: {Number(record.billable_weight).toFixed(2)} lbs
                  {record.weight_type && (
                    <Tag color={record.weight_type === 'dimensional' ? 'orange' : 'blue'} style={{ marginLeft: '4px', fontSize: '11px' }}>
                      {record.weight_type}
                    </Tag>
                  )}
                </div>
              )}
              {record.shipping_zone && (
                <div style={{ marginTop: '2px' }}>
                  <Tag color={record.zone_type === 'intrastate' ? 'blue' : 'orange'} style={{ fontSize: '11px' }}>
                    Zone {record.shipping_zone} ({record.zone_type || 'intrastate'})
                  </Tag>
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Order No',
      dataIndex: 'order_number',
      width: 120,
      sorter: (a, b) => {
        const orderA = (a.order_number || '').toLowerCase();
        const orderB = (b.order_number || '').toLowerCase();
        return orderA.localeCompare(orderB);
      },
      sortDirections: ['ascend', 'descend'],
      showSorterTooltip: false,
      render: (text, record) => {
        const flags = record.validation_flags || [];
        const isAutoGenerated = flags.includes('order_number_auto_generated');
        const isExtracted = flags.includes('order_number_extracted_from_address2');
        
        if (!text) return '-';
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{text}</span>
            {isAutoGenerated && (
              <Tag color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                Auto
              </Tag>
            )}
            {isExtracted && (
              <Tag color="green" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                Extracted
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Actions',
      width: 150,
      fixed: 'right',
      align: 'center',
      render: (_, record) => {
        const isApproved = record.status === 'ready';
        const isAnimating = animatingShipments.has(record.id);

        const handleApproveClick = async () => {
          if (isApproved) return;
          
          // Start animation
          setAnimatingShipments(prev => new Set(prev).add(record.id));
          
          await handleApprove(record);
          
          // Keep animation visible for a moment, then remove
          setTimeout(() => {
            setAnimatingShipments(prev => {
              const newSet = new Set(prev);
              newSet.delete(record.id);
              return newSet;
            });
          }, 600);
        };

        const menuItems: MenuProps['items'] = [
          {
            key: 'edit-address',
            label: 'Edit Address',
            icon: <EnvironmentOutlined />,
            onClick: () => handleEdit(record, 'to'),
          },
          {
            key: 'edit-package',
            label: 'Edit Package Details',
            icon: <BoxPlotOutlined />,
            onClick: () => handleEdit(record, 'package'),
          },
          {
            type: 'divider' as const,
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => handleDeleteClick(record.id),
          },
        ];

        // Horizontal three dots icon component
        const HorizontalDotsIcon = () => (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="currentColor"
            style={{ display: 'block' }}
          >
            <circle cx="4" cy="10" r="1.5" fill="currentColor" />
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
            <circle cx="16" cy="10" r="1.5" fill="currentColor" />
          </svg>
        );

        return (
          <Space size="small">
            {/* Approve/Approved Button */}
            <Button
              type={isApproved ? 'default' : 'default'}
              size="small"
              onClick={handleApproveClick}
              disabled={isApproved}
              className={isAnimating ? 'approve-button-animating' : isApproved ? 'approve-button-approved' : ''}
              style={{
                backgroundColor: isApproved ? '#52c41a' : 'transparent',
                borderColor: isApproved ? '#52c41a' : '#d9d9d9',
                color: isApproved ? '#fff' : (theme === 'dark' ? '#fff' : '#262626'),
                fontWeight: 500,
                minWidth: isApproved ? '95px' : '85px',
                height: '32px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isApproved ? '0 2px 4px rgba(82, 196, 26, 0.2)' : 'none',
              }}
            >
              {isApproved ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckOutlined style={{ fontSize: '14px' }} />
                  Approved
                </span>
              ) : (
                'Approve'
              )}
            </Button>

            {/* More Actions Dropdown */}
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              placement="bottomRight"
              overlayStyle={{ minWidth: '220px' }}
              overlayClassName="action-dropdown"
            >
              <Button
                type="text"
                icon={<HorizontalDotsIcon />}
                size="small"
                style={{
                  fontSize: '20px',
                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : '#595959',
                  padding: '6px 12px',
                  minWidth: '48px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#262626' : '#f5f5f5';
                  e.currentTarget.style.color = theme === 'dark' ? '#fff' : '#262626';
                  e.currentTarget.style.borderColor = '#d9d9d9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : '#595959';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label="More actions"
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedShipments,
    onChange: (selectedKeys: React.Key[], selectedRows: Shipment[]) => {
      // Update selection with the new keys
      dispatch(setSelectedShipments(selectedKeys as number[]));
    },
    onSelectAll: (selected: boolean, selectedRows: Shipment[], changeRows: Shipment[]) => {
      if (selected) {
        // Select all visible rows (filtered shipments)
        const allIds = filteredShipments.map(s => s.id);
        // Merge with existing selections to preserve selections from other pages
        const newSelection = Array.from(new Set([...selectedShipments, ...allIds]));
        dispatch(setSelectedShipments(newSelection));
      } else {
        // Deselect all visible rows (but keep selections from other pages)
        const visibleIds = filteredShipments.map(s => s.id);
        const newSelection = selectedShipments.filter(id => !visibleIds.includes(id));
        dispatch(setSelectedShipments(newSelection));
      }
    },
    getCheckboxProps: (record: Shipment) => ({
      name: `shipment-${record.id}`,
    }),
    preserveSelectedRowKeys: true, // Preserve selection across pagination
  };

  const hasSelected = selectedShipments.length > 0;

  // Check if all shipments are ready
  const allShipmentsReady = shipments.length > 0 && shipments.every(shipment => shipment.status === 'ready');
  const notReadyCount = shipments.filter(shipment => shipment.status !== 'ready').length;

  const handleContinueToStep3 = () => {
    if (!allShipmentsReady) {
      message.warning(
        `Cannot proceed to Step 3. ${notReadyCount} shipment${notReadyCount > 1 ? 's' : ''} still need${notReadyCount === 1 ? 's' : ''} to be reviewed and marked as ready.`,
        5
      );
      return;
    }
    dispatch(setCurrentStep(3));
  };

  return (
    <div>
      <Title level={2} style={{ background: 'transparent', margin: '0 0 24px 0' }}>Review and Edit File (Step 2 of 3)</Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card style={{ overflow: 'visible' }}>
          {/* Search Bar, Filter Button, and Action Buttons */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Search
                placeholder="Search by address, order number, or recipient name"
                prefix={<SearchOutlined />}
                allowClear
                style={{ width: 400 }}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilterModalVisible(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Filter
                {Object.keys(filters).filter(key => {
                  const value = filters[key as keyof typeof filters];
                  return value !== undefined && value !== null && value !== '';
                }).length > 0 && (
                  <span style={{ 
                    marginLeft: 4, 
                    backgroundColor: '#1890ff', 
                    color: 'white', 
                    borderRadius: '50%', 
                    width: 18, 
                    height: 18, 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {Object.keys(filters).filter(key => {
                      const value = filters[key as keyof typeof filters];
                      return value !== undefined && value !== null && value !== '';
                    }).length}
                  </span>
                )}
              </Button>
            </div>
            <Space>
              <Button
                icon={<SaveOutlined />}
                onClick={() => {
                  dispatch(calculateTotalCost());
                  dispatch(saveDraft({ step: 2 }));
                  message.success('Draft saved successfully!');
                  dispatch(setCurrentStep(1));
                }}
                disabled={shipments.length === 0}
              >
                Save as Draft
              </Button>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: 'Go back?',
                    content: 'Your current data will be lost. Are you sure?',
                    onOk: () => dispatch(setCurrentStep(1)),
                    okText: 'Yes, Go Back',
                    cancelText: 'Cancel',
                    centered: true,
                    mask: true,
                    maskClosable: false,
                  });
                }}
              >
                Step 1
              </Button>
              <Button
                type="primary"
                onClick={handleContinueToStep3}
                disabled={shipments.length === 0 || !allShipmentsReady}
              >
                Step 3 <ArrowRightOutlined />
              </Button>
            </Space>
          </div>

          {/* Validation Indicators */}
          <div style={{ 
            marginBottom: 16, 
            padding: '12px 16px', 
            background: theme === 'dark' ? '#1f1f1f' : '#fafafa',
            border: `1px solid ${theme === 'dark' ? '#303030' : '#f0f0f0'}`,
            borderRadius: '6px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8
          }}>
            <span style={{ 
              marginRight: 8, 
              fontWeight: 500, 
              color: theme === 'dark' ? '#fff' : '#262626',
              alignSelf: 'center'
            }}>
              Validation Issues:
            </span>
            {validationCounts.autoFilledOrderNumber > 0 && (
              <Button
                size="small"
                type={filters.validationIssue === 'order_number_auto_generated' ? 'primary' : 'default'}
                onClick={() => {
                  if (filters.validationIssue === 'order_number_auto_generated') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'order_number_auto_generated' });
                  }
                }}
                style={{
                  borderColor: filters.validationIssue === 'order_number_auto_generated' ? undefined : '#1890ff',
                  color: filters.validationIssue === 'order_number_auto_generated' ? undefined : '#1890ff',
                }}
              >
                Auto-Filled Order ID ({validationCounts.autoFilledOrderNumber})
              </Button>
            )}
            {validationCounts.missingOrderNumber > 0 && (
              <Button
                size="small"
                type={filters.validationIssue === 'missing_order_number' ? 'primary' : 'default'}
                onClick={() => {
                  if (filters.validationIssue === 'missing_order_number') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'missing_order_number' });
                  }
                }}
              >
                Missing Order ID ({validationCounts.missingOrderNumber})
              </Button>
            )}
            {validationCounts.missingAddressFrom > 0 && (
              <Button
                size="small"
                type={filters.validationIssue === 'missing_sender_address' ? 'primary' : 'default'}
                onClick={() => {
                  if (filters.validationIssue === 'missing_sender_address') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'missing_sender_address' });
                  }
                }}
              >
                Missing Address From ({validationCounts.missingAddressFrom})
              </Button>
            )}
            {validationCounts.missingAddressTo > 0 && (
              <Button
                size="small"
                type={filters.validationIssue === 'missing_recipient_address' ? 'primary' : 'default'}
                onClick={() => {
                  if (filters.validationIssue === 'missing_recipient_address') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'missing_recipient_address' });
                  }
                }}
              >
                Missing Address To ({validationCounts.missingAddressTo})
              </Button>
            )}
            {validationCounts.missingPackageDetails > 0 && (
              <Button
                size="small"
                type={filters.validationIssue === 'missing_package_details' ? 'primary' : 'default'}
                onClick={() => {
                  if (filters.validationIssue === 'missing_package_details') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'missing_package_details' });
                  }
                }}
              >
                Missing Package Details ({validationCounts.missingPackageDetails})
              </Button>
            )}
            {validationCounts.missingPincode > 0 && (
              <Button
                size="small"
                type={filters.validationIssue === 'missing_pincode' ? 'primary' : 'default'}
                onClick={() => {
                  if (filters.validationIssue === 'missing_pincode') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'missing_pincode' });
                  }
                }}
              >
                Missing Pincode ({validationCounts.missingPincode})
              </Button>
            )}
            {validationCounts.missingWeight > 0 && (
              <Button
                size="small"
                type={filters.validationIssue === 'missing_weight' ? 'primary' : 'default'}
                onClick={() => {
                  if (filters.validationIssue === 'missing_weight') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'missing_weight' });
                  }
                }}
              >
                Missing Weight ({validationCounts.missingWeight})
              </Button>
            )}
            {validationCounts.missingDimensions > 0 && (
              <Button
                size="small"
                type={filters.validationIssue === 'missing_dimensions' ? 'primary' : 'default'}
                onClick={() => {
                  if (filters.validationIssue === 'missing_dimensions') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'missing_dimensions' });
                  }
                }}
              >
                Missing Dimensions ({validationCounts.missingDimensions})
              </Button>
            )}
            {Object.values(validationCounts).every(count => count === 0) && (
              <span style={{ 
                color: theme === 'dark' ? '#8c8c8c' : '#8c8c8c',
                fontStyle: 'italic'
              }}>
                No validation issues found
              </span>
            )}
          </div>

          {/* Bulk Actions Toolbar */}
          {hasSelected && (
            <div style={{ 
              marginBottom: 16, 
              padding: '12px 16px', 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f',
              borderRadius: '6px'
            }}>
              <Space>
                <span style={{ marginRight: 8, fontWeight: 500 }}>
                  Selected {selectedShipments.length} item{selectedShipments.length > 1 ? 's' : ''}
                </span>
                <Button 
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleApproveAll}
                  className={`approve-all-button ${animatingShipments.size > 0 ? 'approve-all-button-animating' : ''}`}
                >
                  Approve All
                </Button>
                <Button 
                  size="small"
                  onClick={() => setBulkActionModal('address')}
                >
                  Change Ship From Address
                </Button>
                <Button 
                  size="small"
                  onClick={() => setBulkActionModal('package')}
                >
                  Change Package Details
                </Button>
                <Popconfirm
                  title={`Delete ${selectedShipments.length} selected shipments?`}
                  onConfirm={handleBulkDelete}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button size="small" danger>
                    Delete Selected
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          )}

          {/* Professional Data Table */}
          <Table
            columns={columns}
            dataSource={filteredShipments}
            rowKey="id"
            rowSelection={rowSelection}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} shipments`,
              pageSizeOptions: ['10', '20', '50', '100'],
              position: ['bottomRight'],
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize: pageSize || 10 });
              },
              onShowSizeChange: (current, size) => {
                setPagination({ current: 1, pageSize: size }); // Reset to page 1 when page size changes
              },
              responsive: true,
            }}
            scroll={{ 
              x: 1200,
              y: 'calc(100vh - 400px)' // Enable vertical scrolling with dynamic height
            }}
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
            rowClassName={(record, index) => {
              let className = '';
              // Alternating row backgrounds for readability
              if (index % 2 === 1) {
                className += 'table-row-even ';
              }
              // Clear visual distinction for selected rows
              if (selectedShipments.includes(record.id)) {
                className += 'selected-row ';
              }
              return className.trim();
            }}
          />
        </Card>
      </Space>

      {/* Edit Modals */}
      {editModalType && editingShipment && (
        <>
          {editModalType === 'from' && (
            <AddressModal
              visible={editModalType === 'from'}
              onCancel={() => {
                setEditModalType(null);
                setEditingShipment(null);
              }}
              onOk={handleSaveEdit}
              initialValues={editingShipment}
              title="Edit Ship From Address"
              addressType="from"
            />
          )}
          {editModalType === 'to' && (
            <AddressModal
              visible={editModalType === 'to'}
              onCancel={() => {
                setEditModalType(null);
                setEditingShipment(null);
              }}
              onOk={handleSaveEdit}
              initialValues={editingShipment}
              title="Edit Ship To Address"
              addressType="to"
            />
          )}
          {editModalType === 'package' && (
            <PackageModal
              visible={editModalType === 'package'}
              onCancel={() => {
                setEditModalType(null);
                setEditingShipment(null);
              }}
              onOk={handleSaveEdit}
              initialValues={editingShipment}
            />
          )}
        </>
      )}

      {/* Bulk Action Modals */}
      <Modal
        title="Change Ship From Address for Selected"
        open={bulkActionModal === 'address'}
        onCancel={() => setBulkActionModal(null)}
        onOk={() => setBulkActionModal(null)}
        centered
        mask={true}
        maskClosable={false}
        okText="Close"
        cancelText="Cancel"
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setBulkActionModal(null)}>
            Cancel
          </Button>,
          <Button key="close" type="primary" onClick={() => setBulkActionModal(null)}>
            Close
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <p>Select a saved address to apply to all selected shipments:</p>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="Search or select saved address"
          showSearch
          filterOption={(input, option) => {
            const searchText = input.toLowerCase();
            const optionText = String(option?.label || option?.children || '').toLowerCase();
            return optionText.includes(searchText);
          }}
          onChange={(value) => {
            handleBulkAddressChange(value);
            setBulkActionModal(null);
          }}
        >
          {savedAddresses.map(addr => {
            const fullAddress = [
              addr.name,
              addr.address,
              addr.address2,
              `${addr.city}, ${addr.state} ${addr.zip_code}`.trim()
            ].filter(Boolean).join(', ');
            return (
              <Select.Option key={addr.id} value={addr.id} label={fullAddress}>
                {fullAddress}
              </Select.Option>
            );
          })}
        </Select>
      </Modal>

      <Modal
        title="Change Package Details for Selected"
        open={bulkActionModal === 'package'}
        onCancel={() => setBulkActionModal(null)}
        onOk={() => setBulkActionModal(null)}
        centered
        mask={true}
        maskClosable={false}
        okText="Close"
        cancelText="Cancel"
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setBulkActionModal(null)}>
            Cancel
          </Button>,
          <Button key="close" type="primary" onClick={() => setBulkActionModal(null)}>
            Close
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <p>Select a saved package to apply to all selected shipments:</p>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="Search or select saved package"
          showSearch
          filterOption={(input, option) => {
            const searchText = input.toLowerCase();
            const optionText = String(option?.label || option?.children || '').toLowerCase();
            return optionText.includes(searchText);
          }}
          onChange={(value) => {
            handleBulkPackageChange(value);
            setBulkActionModal(null);
          }}
        >
          {savedPackages.map(pkg => {
            // Format weight as per PRD: "1 lb 0 oz" format
            const weightText = `${Math.floor(pkg.weight_lbs)} lb ${Math.floor(pkg.weight_oz)} oz`;
            const packageText = `${pkg.name} - ${pkg.length}x${pkg.width}x${pkg.height} in, ${weightText}`;
            return (
              <Select.Option key={pkg.id} value={pkg.id} label={packageText}>
                {packageText}
              </Select.Option>
            );
          })}
        </Select>
      </Modal>

      {/* Filter Modal */}
      <Modal
        title="Filter Shipments"
        open={filterModalVisible}
        onOk={() => {
          setFilterModalVisible(false);
        }}
        onCancel={() => {
          setFilterModalVisible(false);
        }}
        okText="OK"
        cancelText="Cancel"
        centered
        mask={true}
        maskClosable={false}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => {
            setFilterModalVisible(false);
          }}>
            Cancel
          </Button>,
          <Button
            key="clear"
            onClick={() => {
              setFilters({});
            }}
          >
            Clear All
          </Button>,
          <Button
            key="ok"
            type="primary"
            onClick={() => {
              setFilterModalVisible(false);
            }}
          >
            OK
          </Button>,
        ]}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 16 }}>
          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Status
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="Select status"
              allowClear
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {statusOptions.map(option => (
                <Select.Option key={option.value} value={option.value} label={option.label}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Ship From Address Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Ship From Address
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="Select ship from address"
              allowClear
              value={filters.shipFromAddress}
              onChange={(value) => setFilters({ ...filters, shipFromAddress: value })}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {getUniqueFromAddresses().map(address => (
                <Select.Option key={address} value={address} label={address}>
                  <div style={{ whiteSpace: 'pre-line' }}>{address}</div>
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Ship To Address Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Ship To Address
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="Select ship to address"
              allowClear
              value={filters.shipToAddress}
              onChange={(value) => setFilters({ ...filters, shipToAddress: value })}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {getUniqueToAddresses().map(address => (
                <Select.Option key={address} value={address} label={address}>
                  {address}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Package Details Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Package Details
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="Select package details"
              allowClear
              value={filters.packageDetails}
              onChange={(value) => setFilters({ ...filters, packageDetails: value })}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {getUniquePackageDetails().map(packageDetail => (
                <Select.Option key={packageDetail} value={packageDetail} label={packageDetail}>
                  <div style={{ whiteSpace: 'pre-line' }}>{packageDetail}</div>
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Order Number Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Order Number
            </label>
            <Input
              placeholder="Enter order number"
              allowClear
              value={filters.orderNumber || ''}
              onChange={(e) => setFilters({ ...filters, orderNumber: e.target.value })}
            />
          </div>
        </Space>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete Shipment"
        open={deleteConfirmId !== null}
        onOk={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
        okText="Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        centered
        mask={true}
        maskClosable={false}
      >
        <p>Are you sure you want to delete this shipment? This action cannot be undone.</p>
      </Modal>

      {/* Custom CSS for table styling - key forces re-render on theme change */}
      <style key={theme}>{`
        /* Checkbox styling for dark mode */
        .ant-checkbox-inner {
          border-color: ${theme === 'dark' ? '#434343' : '#d9d9d9'} !important;
          background-color: ${theme === 'dark' ? '#1f1f1f' : '#fff'} !important;
        }
        
        .ant-checkbox:hover .ant-checkbox-inner {
          border-color: #1890ff !important;
        }
        
        .ant-checkbox-checked .ant-checkbox-inner {
          border-color: #1890ff !important;
          background-color: #1890ff !important;
        }
        
        .ant-checkbox-checked .ant-checkbox-inner::after {
          border-color: #fff !important;
          opacity: 1 !important;
          display: block !important;
          visibility: visible !important;
        }
        
        .ant-table-selection-column .ant-checkbox-inner {
          border-color: ${theme === 'dark' ? '#434343' : '#d9d9d9'} !important;
          background-color: ${theme === 'dark' ? '#1f1f1f' : '#fff'} !important;
        }
        
        .ant-table-selection-column .ant-checkbox:hover .ant-checkbox-inner {
          border-color: #1890ff !important;
        }
        
        .ant-table-selection-column .ant-checkbox-checked .ant-checkbox-inner {
          border-color: #1890ff !important;
          background-color: #1890ff !important;
        }
        
        .ant-table-selection-column .ant-checkbox-checked .ant-checkbox-inner::after {
          border-color: #fff !important;
          opacity: 1 !important;
          display: block !important;
          visibility: visible !important;
        }
        
        /* Ensure checkbox tick mark is properly visible */
        .ant-checkbox-checked .ant-checkbox-inner::after,
        .ant-table-selection-column .ant-checkbox-checked .ant-checkbox-inner::after {
          width: 5.71428571px !important;
          height: 9.14285714px !important;
          top: 50% !important;
          left: 22% !important;
          border: 2px solid #fff !important;
          border-top: 0 !important;
          border-left: 0 !important;
          transform: rotate(45deg) scale(1) translate(-50%, -50%) !important;
        }
        
        /* Dropdown arrow visibility */
        .ant-select-arrow {
          color: ${theme === 'dark' ? '#fff' : '#00000073'} !important;
        }
        
        .ant-select:hover .ant-select-arrow {
          color: ${theme === 'dark' ? '#fff' : '#00000073'} !important;
        }
        
        /* Select component text color */
        .ant-select-selector {
          color: ${theme === 'dark' ? '#fff' : '#262626'} !important;
        }
        
        .ant-select-selection-item {
          color: ${theme === 'dark' ? '#fff' : '#262626'} !important;
        }
        
        .ant-table-thead > tr > th {
          background: ${theme === 'dark' ? '#1f1f1f' : '#fafafa'} !important;
          font-weight: 600;
          border-bottom: 2px solid ${theme === 'dark' ? '#303030' : '#f0f0f0'};
          color: ${theme === 'dark' ? '#fff' : '#262626'} !important;
        }
        
        /* Remove default sorted column background color - keep same as other headers */
        .ant-table-thead > tr > th.ant-table-column-sort {
          background: ${theme === 'dark' ? '#1f1f1f' : '#fafafa'} !important;
        }
        
        /* Better sorted column indicator - only border indicators, no color change */
        .ant-table-thead > tr > th.ant-table-column-sort {
          border-bottom: 3px solid #1890ff !important;
          position: relative;
          background: ${theme === 'dark' ? '#1f1f1f' : '#fafafa'} !important;
        }
        
        /* Add a subtle left border indicator for sorted columns */
        .ant-table-thead > tr > th.ant-table-column-sort::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background-color: #1890ff;
        }
        
        /* Enhance sort icons visibility - make them blue */
        .ant-table-thead > tr > th .ant-table-column-sorter {
          color: #8c8c8c;
        }
        
        .ant-table-thead > tr > th.ant-table-column-sort .ant-table-column-sorter {
          color: #1890ff;
        }
        
        /* Ensure no hover or click color change on column headers */
        .ant-table-thead > tr > th:hover {
          background: ${theme === 'dark' ? '#1f1f1f' : '#fafafa'} !important;
        }
        
        .ant-table-thead > tr > th.ant-table-column-sort:hover {
          background: ${theme === 'dark' ? '#1f1f1f' : '#fafafa'} !important;
        }
        
        /* Disable pointer cursor on column header text */
        .ant-table-thead > tr > th {
          cursor: default;
        }
        
        /* Only sort icons should be clickable and show pointer */
        .ant-table-thead > tr > th .ant-table-column-sorter {
          cursor: pointer;
          pointer-events: auto;
        }
        
        /* Prevent header click from triggering sort - disable clicks on header */
        .ant-table-thead > tr > th {
          pointer-events: none;
        }
        
        /* Re-enable pointer events only for sort icons */
        .ant-table-thead > tr > th .ant-table-column-sorter {
          pointer-events: auto;
        }
        
        /* Re-enable for checkbox column - both header and body */
        .ant-table-thead > tr > th.ant-table-selection-column,
        .ant-table-tbody > tr > td.ant-table-selection-column {
          pointer-events: auto !important;
        }
        
        /* Ensure checkboxes are clickable and visible */
        .ant-table-selection-column .ant-checkbox-wrapper,
        .ant-table-selection-column .ant-checkbox,
        .ant-table-selection-column .ant-checkbox-inner {
          pointer-events: auto !important;
          cursor: pointer !important;
          z-index: 1;
        }
        
        /* Ensure checkbox input is also clickable */
        .ant-table-selection-column .ant-checkbox-input {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${theme === 'dark' ? '#303030' : '#f0f0f0'};
          color: ${theme === 'dark' ? '#fff' : '#262626'} !important;
        }
        
        /* Alternating row backgrounds for readability */
        .ant-table-tbody > tr.table-row-even > td {
          background-color: ${theme === 'dark' ? '#1f1f1f' : '#fafafa'};
        }
        
        .ant-table-tbody > tr.table-row-even:hover > td {
          background-color: ${theme === 'dark' ? '#262626' : '#f0f0f0'};
        }
        
        /* Clear visual distinction for selected rows */
        .selected-row {
          background-color: ${theme === 'dark' ? '#111b26' : '#e6f7ff'} !important;
          border-left: 3px solid #1890ff !important;
        }
        
        .selected-row:hover {
          background-color: ${theme === 'dark' ? '#1a2f47' : '#bae7ff'} !important;
        }
        
        .ant-table-tbody > tr:hover > td {
          background-color: ${theme === 'dark' ? '#262626' : '#f5f5f5'};
        }
        
        /* Status indicators - ensure they're immediately recognizable */
        .ant-tag {
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
        }
        
        .ant-btn-text:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }

        /* Dropdown menu styling */
        .action-dropdown .ant-dropdown-menu {
          padding: 4px 0;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .action-dropdown .ant-dropdown-menu-item {
          padding: 10px 16px;
          margin: 2px 4px;
          border-radius: 4px;
          font-size: 14px;
          line-height: 1.5;
          transition: all 0.2s;
        }

        .action-dropdown .ant-dropdown-menu-item:hover {
          background-color: ${theme === 'dark' ? '#262626' : '#f5f5f5'};
        }
        
        .action-dropdown .ant-dropdown-menu-item-danger {
          color: #ff4d4f;
        }
        
        .action-dropdown .ant-dropdown-menu-item-danger:hover {
          background-color: ${theme === 'dark' ? '#2a1215' : '#fff1f0'};
          color: #ff4d4f;
        }
        
        /* Action button visibility in dark mode */
        .ant-btn-dangerous {
          color: ${theme === 'dark' ? '#ff4d4f' : '#ff4d4f'} !important;
        }
        
        .ant-btn-dangerous:hover {
          color: ${theme === 'dark' ? '#ff7875' : '#ff7875'} !important;
          border-color: ${theme === 'dark' ? '#ff7875' : '#ff7875'} !important;
        }

        .action-dropdown .ant-dropdown-menu-item-icon {
          margin-right: 12px;
          font-size: 16px;
        }

        .action-dropdown .ant-dropdown-menu-item-divider {
          margin: 4px 0;
        }
        
        /* Approve button animation */
        @keyframes approvePulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.7);
          }
          30% {
            transform: scale(1.08);
            box-shadow: 0 0 0 6px rgba(82, 196, 26, 0.4);
          }
          60% {
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(82, 196, 26, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 2px 4px rgba(82, 196, 26, 0.2);
          }
        }
        
        @keyframes approveSuccess {
          0% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          50% {
            transform: scale(1.15) rotate(5deg);
            opacity: 0.95;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        
        .approve-button-animating {
          animation: approvePulse 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        
        .approve-button-approved {
          position: relative;
        }
        
        .approve-button-approved::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(82, 196, 26, 0.3);
          transform: translate(-50%, -50%);
          animation: approveRipple 0.6s ease-out;
        }
        
        @keyframes approveRipple {
          0% {
            width: 0;
            height: 0;
            opacity: 1;
          }
          100% {
            width: 100px;
            height: 100px;
            opacity: 0;
          }
        }
        
        /* Hover effect for approve button */
        .ant-btn:not(:disabled):hover:not(.approve-button-approved) {
          border-color: #52c41a !important;
          color: #52c41a !important;
        }
        
        /* Approve All button styling */
        .approve-all-button {
          background-color: #52c41a !important;
          border-color: #52c41a !important;
          color: #fff !important;
        }
        
        .approve-all-button:hover,
        .approve-all-button:focus {
          background-color: #73d13d !important;
          border-color: #73d13d !important;
          color: #fff !important;
        }
        
        .approve-all-button:active {
          background-color: #389e0d !important;
          border-color: #389e0d !important;
          color: #fff !important;
        }
        
        .approve-all-button .anticon {
          color: #fff !important;
        }
        
        .approve-all-button:hover .anticon,
        .approve-all-button:focus .anticon {
          color: #fff !important;
        }
        
        /* Approve All button animation */
        .approve-all-button-animating {
          animation: approvePulse 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
      `}</style>
    </div>
  );
};

export default Step2Review;

// Add global styles for pagination dropdown to ensure it's visible
const style = document.createElement('style');
style.textContent = `
  .ant-pagination-options {
    z-index: 1050 !important;
  }
  .ant-pagination-options-size-changer.ant-select {
    z-index: 1051 !important;
  }
  .ant-select-dropdown {
    z-index: 1052 !important;
  }
`;
if (!document.head.querySelector('style[data-pagination-fix]')) {
  style.setAttribute('data-pagination-fix', 'true');
  document.head.appendChild(style);
}
