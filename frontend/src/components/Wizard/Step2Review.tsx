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
  Alert,
  Spin,
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
  ReloadOutlined,
  StarFilled,
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
  const [savedToAddresses, setSavedToAddresses] = useState<SavedAddress[]>([]);
  const [savedPackages, setSavedPackages] = useState<SavedPackage[]>([]);
  const [bulkActionModal, setBulkActionModal] = useState<'address' | 'to_address' | 'package' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [animatingShipments, setAnimatingShipments] = useState<Set<number>>(new Set());
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [validatingAddresses, setValidatingAddresses] = useState<Set<number>>(new Set());
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

  const loadSavedData = async (showLoading = false) => {
    if (showLoading) {
      setLoadingAddresses(true);
    }
    try {
      const [fromAddresses, toAddresses, packages] = await Promise.all([
        savedAddressService.getAll('from'),
        savedAddressService.getAll('to'),
        savedPackageService.getAll(),
      ]);
      setSavedAddresses(fromAddresses);
      setSavedToAddresses(toAddresses);
      setSavedPackages(packages);
    } catch (error) {
      console.error('Failed to load saved data:', error);
      message.error('Failed to load saved addresses');
    } finally {
      if (showLoading) {
        setLoadingAddresses(false);
      }
    }
  };

  const navigateToMaster = (tab: 'ship-from' | 'ship-to') => {
    // Store the desired tab in localStorage
    localStorage.setItem('master_active_tab', tab);
    // Navigate to master page
    localStorage.setItem('shipping_pro_selected_page', 'master');
    // Open Master page in a new tab
    const newWindow = window.open(window.location.origin + window.location.pathname, '_blank');
    if (!newWindow) {
      // Fallback if popup is blocked
      message.warning('Please allow popups to open Master page in a new tab');
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
      const wasInvalid = oldStatus === 'invalid';
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
        // Ensure numeric values are properly formatted
        updateData.length = values.length != null ? Number(values.length) : editingShipment.length;
        updateData.width = values.width != null ? Number(values.width) : editingShipment.width;
        updateData.height = values.height != null ? Number(values.height) : editingShipment.height;
        updateData.weight_lbs = values.weight_lbs != null ? Number(values.weight_lbs) : editingShipment.weight_lbs;
        updateData.weight_oz = values.weight_oz != null ? Number(values.weight_oz) : editingShipment.weight_oz;
        if (values.item_sku !== undefined) {
          updateData.item_sku = values.item_sku;
        }
      }

      // Update shipment first
      const updatedShipment = await shipmentService.updateShipment(editingShipment.id, updateData);
      
      // Immediately update Redux with the new address values (before validation)
      dispatch(updateShipment(updatedShipment));
      
      // Always validate both addresses when from or to address is edited
      if (editModalType === 'from' || editModalType === 'to') {
        // Set loading state for validation
        setValidatingAddresses(prev => new Set(prev).add(editingShipment.id));
        
        // Close modal immediately so user sees updated values
        setEditModalType(null);
        setEditingShipment(null);
        
        // Run validation asynchronously without blocking
        (async () => {
          try {
            // Validate both addresses using the new endpoint
            const validationResult = await shipmentService.validateAllAddresses(updatedShipment.id);
            
            // Get updated shipment with validation results
            const refreshedShipment = await shipmentService.getShipment(updatedShipment.id);
            dispatch(updateShipment(refreshedShipment));
            
            if (validationResult.valid) {
              message.success('Addresses validated successfully');
            } else {
              const messages = validationResult.validation_messages || [];
              if (messages.length > 0) {
                message.warning(`Address validation issues: ${messages.join(', ')}`);
              }
            }
          } catch (error: any) {
            console.error('Address validation error:', error);
            message.error('Failed to validate addresses');
          } finally {
            setValidatingAddresses(prev => {
              const next = new Set(prev);
              next.delete(editingShipment.id);
              return next;
            });
          }
        })();
        
        // Return early - validation happens in background
        message.success('Address updated successfully. Validating addresses...');
        return;
        
        // Return early - validation happens in background
        message.success('Address updated successfully. Validating addresses...');
        return;
      } else {
        // Recalculate shipping if package changed
        if (editModalType === 'package') {
          try {
            const updated = await shipmentService.getShipment(editingShipment.id);
            if (updated.shipping_service) {
              await shipmentService.calculateShipping(updated.id, updated.shipping_service, updated.shipping_provider);
            }
            const refreshed = await shipmentService.getShipment(updated.id);
            dispatch(updateShipment(refreshed));
            
            // Check status change
            if (oldStatus !== 'ready' && refreshed.status === 'ready') {
              message.success('✓ Marked ready');
            } else {
              message.success('Shipment updated successfully');
            }
          } catch (calcError: any) {
            // If calculation fails, still update the shipment but log the error
            console.error('Error calculating shipping:', calcError);
            const refreshed = await shipmentService.getShipment(editingShipment.id);
            dispatch(updateShipment(refreshed));
            message.success('Shipment updated successfully (shipping cost calculation skipped)');
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
      }

      setEditModalType(null);
      setEditingShipment(null);
    } catch (error: any) {
      console.error('Error updating shipment:', error);
      const errorMessage = error?.response?.data?.error || 
                         error?.response?.data?.message || 
                         error?.message || 
                         'Failed to update shipment';
      message.error(errorMessage);
      // Remove loading state on error
      if (editingShipment) {
        setValidatingAddresses(prev => {
          const newSet = new Set(prev);
          newSet.delete(editingShipment.id);
          return newSet;
        });
      }
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

  const handleBulkAddressChange = async (addressId: number, addressType: 'from' | 'to' = 'from') => {
    try {
      // Track old statuses before update
      const oldStatuses = shipments
        .filter(s => selectedShipments.includes(s.id))
        .map(s => ({ id: s.id, status: s.status }));
      
      const updateData = addressType === 'from' 
        ? { saved_address_id: addressId }
        : { saved_to_address_id: addressId };
      
      await shipmentService.bulkUpdate(selectedShipments, updateData);
      
      // Trigger address validation for all updated shipments
      setValidatingAddresses(new Set(selectedShipments));
      try {
        const validationPromises = selectedShipments.map(async (id) => {
          try {
            const validationResult = await shipmentService.validateAllAddresses(id);
            console.log(`Validation result for shipment ${id}:`, validationResult);
            return validationResult;
          } catch (error) {
            console.error(`Failed to validate addresses for shipment ${id}:`, error);
            return null;
          }
        });
        await Promise.all(validationPromises);
      } catch (error) {
        console.error('Error during validation:', error);
      } finally {
        setValidatingAddresses(new Set());
      }
      
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
      setValidatingAddresses(new Set());
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

    // Don't allow approval if shipment is invalid
    if (isShipmentInvalid(shipment)) {
      message.warning('Cannot approve shipment with invalid address. Please fix the address first.');
      return;
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
      // Filter out already approved shipments and invalid shipments
      const toApprove = shipments.filter(
        s => selectedShipments.includes(s.id) && s.status !== 'ready' && !isShipmentInvalid(s)
      );

      const invalidShipments = shipments.filter(
        s => selectedShipments.includes(s.id) && isShipmentInvalid(s)
      );

      if (invalidShipments.length > 0) {
        message.warning(
          `${invalidShipments.length} selected shipment${invalidShipments.length > 1 ? 's have' : ' has'} invalid address${invalidShipments.length > 1 ? 'es' : ''}. Please fix the address${invalidShipments.length > 1 ? 'es' : ''} first.`
        );
      }

      if (toApprove.length === 0) {
        if (invalidShipments.length === 0) {
          message.info('All selected shipments are already approved');
        }
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
      margin: 0,
      wordBreak: 'break-word' as const,
      overflowWrap: 'break-word' as const,
      whiteSpace: 'normal' as const,
      maxWidth: '100%',
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

  // Helper function to check if shipment is invalid (has invalid status or invalid address flags)
  const isShipmentInvalid = (shipment: Shipment): boolean => {
    // Check if status is invalid
    if (shipment.status === 'invalid') {
      return true;
    }
    
    // Check if there are any invalid address flags
    const flags = shipment.validation_flags || [];
    const invalidAddressFlags = [
      'invalid_ship_from_address',
      'invalid_ship_to_address',
      'invalid_ship_from_city',
      'invalid_ship_to_city',
      'invalid_ship_from_pincode',
      'invalid_ship_to_pincode',
      'invalid_address', // General invalid address flag
    ];
    
    return invalidAddressFlags.some(flag => flags.includes(flag));
  };

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
      'invalid': ['invalid'], // Special case - will be handled separately
      'invalid_ship_from_address': ['invalid_ship_from_address'],
      'invalid_ship_to_address': ['invalid_ship_to_address'],
      'invalid_ship_from_city': ['invalid_ship_from_city'],
      'invalid_ship_to_city': ['invalid_ship_to_city'],
      'invalid_ship_from_pincode': ['invalid_ship_from_pincode'],
      'invalid_ship_to_pincode': ['invalid_ship_to_pincode'],
    };
    
    // Special handling for 'invalid' filter - check if shipment is invalid
    if (issue === 'invalid') {
      return isShipmentInvalid(shipment);
    }
    
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
      invalid: shipments.filter(s => {
        return isShipmentInvalid(s);
      }).length,
      invalidShipFromAddress: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('invalid_ship_from_address');
      }).length,
      invalidShipToAddress: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('invalid_ship_to_address');
      }).length,
      invalidShipFromCity: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('invalid_ship_from_city');
      }).length,
      invalidShipToCity: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('invalid_ship_to_city');
      }).length,
      invalidShipFromPincode: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('invalid_ship_from_pincode');
      }).length,
      invalidShipToPincode: shipments.filter(s => {
        const flags = s.validation_flags || [];
        return flags.includes('invalid_ship_to_pincode');
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
      render: (status: string, record: Shipment) => {
        const isValidating = validatingAddresses.has(record.id);
        const validationError = record.address_validation_error;
        const flags = record.validation_flags || [];
        
        // Check if addresses have validation errors
        const hasFromError = flags.some(f => f.startsWith('invalid_ship_from'));
        const hasToError = flags.some(f => f.startsWith('invalid_ship_to'));
        // Check if validationError exists and is not empty
        const hasValidationError = validationError && validationError.trim().length > 0;
        const hasValidationErrors = hasFromError || hasToError || hasValidationError;
        
        // Check if addresses are valid (no validation errors)
        // Show "Valid" if there are no address validation errors, regardless of status
        // Status might be 'invalid' for other reasons (missing package, etc.)
        const addressesValid = !hasValidationErrors;
        
        // Parse validation messages if they exist
        const validationMessages: string[] = [];
        if (hasValidationError) {
          // Split by newline to get separate messages
          const lines = validationError.split('\n').filter(p => p.trim());
          validationMessages.push(...lines.map(p => p.trim()));
        } else if (hasValidationErrors) {
          // If we have validation flags but no error message, create messages from flags
          if (hasFromError) {
            validationMessages.push('Ship From: Address validation failed');
          }
          if (hasToError) {
            validationMessages.push('Ship To: Address validation failed');
          }
        }
        
        return (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {addressesValid ? (
                <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: '11px', padding: '2px 8px', lineHeight: '18px', margin: 0 }}>
                  Valid
                </Tag>
              ) : (
                getStatusTag(status, record)
              )}
              {isValidating && (
                <Spin size="small" />
              )}
            </div>
            {validationMessages.length > 0 && (
              <div style={{ fontSize: '11px', color: '#ff4d4f', lineHeight: '1.4', marginTop: 4 }}>
                <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc' }}>
                  {validationMessages.map((msg, idx) => (
                    <li key={idx} style={{ marginBottom: 2 }}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      },
      onCell: () => ({
        style: {
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'normal',
        },
      }),
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
      render: (_, record) => {
        const isValidating = validatingAddresses.has(record.id);
        const flags = record.validation_flags || [];
        // Check specifically for invalid from address flags only
        // Only show tag if there are specific from address invalid flags
        const isFromAddressInvalid = flags.some(flag => 
          ['invalid_ship_from_address', 'invalid_ship_from_city', 'invalid_ship_from_pincode'].includes(flag)
        );
        
        return (
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '13px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {formatAddress(record, 'from')}
              </div>
              {isFromAddressInvalid && (
                <Tag color="error" style={{ fontSize: '10px', padding: '2px 6px', margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Invalid
                </Tag>
              )}
            </div>
            {isValidating && (
              <Spin size="small" style={{ position: 'absolute', top: 0, right: 0 }} />
            )}
          </div>
        );
      },
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
      render: (_, record) => {
        const isValidating = validatingAddresses.has(record.id);
        const flags = record.validation_flags || [];
        // Check specifically for invalid to address flags (not general invalid_address or status)
        // Only show tag if there are specific to address invalid flags
        const isToAddressInvalid = flags.some(flag => 
          ['invalid_ship_to_address', 'invalid_ship_to_city', 'invalid_ship_to_pincode'].includes(flag)
        );
        
        return (
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '13px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {formatAddress(record, 'to')}
              </div>
              {isToAddressInvalid && (
                <Tag color="error" style={{ fontSize: '10px', padding: '2px 6px', margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Invalid
                </Tag>
              )}
            </div>
            {isValidating && (
              <Spin size="small" style={{ position: 'absolute', top: 0, right: 0 }} />
            )}
          </div>
        );
      },
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
          {formatPackageDetails(record)}
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
      width: 200,
      fixed: 'right',
      align: 'center',
      render: (_, record) => {
        const isApproved = record.status === 'ready';
        const isInvalid = isShipmentInvalid(record);
        const isAnimating = animatingShipments.has(record.id);

        const handleApproveClick = async () => {
          if (isApproved || isInvalid) return;
          
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
            key: 'edit-from-address',
            label: 'Edit Ship From Address',
            icon: <EnvironmentOutlined />,
            onClick: () => handleEdit(record, 'from'),
          },
          {
            key: 'edit-to-address',
            label: 'Edit Ship To Address',
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
              type="default"
              size="small"
              onClick={handleApproveClick}
              disabled={isApproved || isInvalid}
              className={`approve-button ${isAnimating ? 'approve-button-animating' : ''} ${isApproved ? 'approve-button-approved' : ''}`}
              style={{
                backgroundColor: isApproved ? '#52c41a' : 'transparent',
                borderColor: isApproved ? '#52c41a' : (isInvalid ? '#ff4d4f' : '#d9d9d9'),
                color: isApproved ? '#fff' : (isInvalid ? '#ff4d4f' : (theme === 'dark' ? '#fff' : '#262626')),
                fontWeight: 500,
                minWidth: isApproved ? '95px' : '85px',
                height: '32px',
                
                opacity: isInvalid ? 0.6 : 1,
                cursor: isInvalid ? 'not-allowed' : 'pointer',
              }}
              title={isInvalid ? 'Cannot approve: Address is invalid. Please fix the address first.' : (isApproved ? 'Already approved' : 'Approve shipment')}
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
    preserveSelectedRowKeys: true
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
                Back
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

          {/* Validation Indicators - Show if any validation issues exist */}
          {Object.values(validationCounts).some(count => count > 0) && (
          <>
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
            {validationCounts.missingOrderNumber > 0 && (
              <Button
                size="small"
                className={`validation-issue-btn ${filters.validationIssue === 'missing_order_number' ? 'validation-issue-btn-active' : ''}`}
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
                className={`validation-issue-btn ${filters.validationIssue === 'missing_sender_address' ? 'validation-issue-btn-active' : ''}`}
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
                className={`validation-issue-btn ${filters.validationIssue === 'missing_recipient_address' ? 'validation-issue-btn-active' : ''}`}
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
                className={`validation-issue-btn ${filters.validationIssue === 'missing_package_details' ? 'validation-issue-btn-active' : ''}`}
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
                className={`validation-issue-btn ${filters.validationIssue === 'missing_pincode' ? 'validation-issue-btn-active' : ''}`}
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
                className={`validation-issue-btn ${filters.validationIssue === 'missing_weight' ? 'validation-issue-btn-active' : ''}`}
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
                className={`validation-issue-btn ${filters.validationIssue === 'missing_dimensions' ? 'validation-issue-btn-active' : ''}`}
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
            {validationCounts.invalid > 0 && (
              <Button
                size="small"
                className={`validation-issue-btn ${filters.validationIssue === 'invalid' ? 'validation-issue-btn-active' : ''}`}
                onClick={() => {
                  if (filters.validationIssue === 'invalid') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'invalid' });
                  }
                }}
              >
                Invalid ({validationCounts.invalid})
              </Button>
            )}
            {validationCounts.invalidShipFromAddress > 0 && (
              <Button
                size="small"
                className={`validation-issue-btn ${filters.validationIssue === 'invalid_ship_from_address' ? 'validation-issue-btn-active' : ''}`}
                onClick={() => {
                  if (filters.validationIssue === 'invalid_ship_from_address') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'invalid_ship_from_address' });
                  }
                }}
              >
                Invalid Ship From Address ({validationCounts.invalidShipFromAddress})
              </Button>
            )}
            {validationCounts.invalidShipToAddress > 0 && (
              <Button
                size="small"
                className={`validation-issue-btn ${filters.validationIssue === 'invalid_ship_to_address' ? 'validation-issue-btn-active' : ''}`}
                onClick={() => {
                  if (filters.validationIssue === 'invalid_ship_to_address') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'invalid_ship_to_address' });
                  }
                }}
              >
                Invalid Ship To Address ({validationCounts.invalidShipToAddress})
              </Button>
            )}
            {validationCounts.invalidShipFromCity > 0 && (
              <Button
                size="small"
                className={`validation-issue-btn ${filters.validationIssue === 'invalid_ship_from_city' ? 'validation-issue-btn-active' : ''}`}
                onClick={() => {
                  if (filters.validationIssue === 'invalid_ship_from_city') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'invalid_ship_from_city' });
                  }
                }}
              >
                Invalid Ship From City ({validationCounts.invalidShipFromCity})
              </Button>
            )}
            {validationCounts.invalidShipToCity > 0 && (
              <Button
                size="small"
                className={`validation-issue-btn ${filters.validationIssue === 'invalid_ship_to_city' ? 'validation-issue-btn-active' : ''}`}
                onClick={() => {
                  if (filters.validationIssue === 'invalid_ship_to_city') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'invalid_ship_to_city' });
                  }
                }}
              >
                Invalid Ship To City ({validationCounts.invalidShipToCity})
              </Button>
            )}
            {validationCounts.invalidShipFromPincode > 0 && (
              <Button
                size="small"
                className={`validation-issue-btn ${filters.validationIssue === 'invalid_ship_from_pincode' ? 'validation-issue-btn-active' : ''}`}
                onClick={() => {
                  if (filters.validationIssue === 'invalid_ship_from_pincode') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'invalid_ship_from_pincode' });
                  }
                }}
              >
                Invalid Ship From Pincode ({validationCounts.invalidShipFromPincode})
              </Button>
            )}
            {validationCounts.invalidShipToPincode > 0 && (
              <Button
                size="small"
                className={`validation-issue-btn ${filters.validationIssue === 'invalid_ship_to_pincode' ? 'validation-issue-btn-active' : ''}`}
                onClick={() => {
                  if (filters.validationIssue === 'invalid_ship_to_pincode') {
                    setFilters({ ...filters, validationIssue: undefined });
                  } else {
                    setFilters({ ...filters, validationIssue: 'invalid_ship_to_pincode' });
                  }
                }}
              >
                Invalid Ship To Pincode ({validationCounts.invalidShipToPincode})
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
          </>
          )}

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
                  icon={<CheckOutlined />}
                  onClick={handleApproveAll}
                  className={`bulk-action-btn approve-all-btn ${animatingShipments.size > 0 ? 'approve-all-button-animating' : ''}`}
                >
                  Approve All
                </Button>
                <Button
                  size="small"
                  onClick={() => setBulkActionModal('address')}
                  className="bulk-action-btn"
                >
                  Change Ship From Address
                </Button>
                <Button
                  size="small"
                  onClick={() => setBulkActionModal('to_address')}
                  className="bulk-action-btn"
                >
                  Change Ship To Address
                </Button>
                <Button 
                  size="small"
                  onClick={() => setBulkActionModal('package')}
                  className="bulk-action-btn"
                >
                  Change Package Details
                </Button>
                <Popconfirm
                  title={`Delete ${selectedShipments.length} selected shipments?`}
                  onConfirm={handleBulkDelete}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button size="small" className="bulk-action-btn delete-btn">
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
            pagination={false}
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
        centered
        mask={true}
        maskClosable={false}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setBulkActionModal(null)}>
            Cancel
          </Button>,
        ]}
      >
        {savedAddresses.length === 0 ? (
          <div>
            <Alert
              message="No Ship From Addresses Available"
              description={
                <div>
                  <p>Please add the address to change the address for selected shipments.</p>
                  <Space style={{ marginTop: 12 }}>
                    <Button 
                      type="primary" 
                      onClick={() => navigateToMaster('ship-from')}
                    >
                      Go to Master - Add Ship From Address
                    </Button>
                    <Button 
                      icon={<ReloadOutlined />}
                      onClick={() => loadSavedData(true)}
                      loading={loadingAddresses}
                    >
                      Reload
                    </Button>
                    {loadingAddresses && <Spin size="small" style={{ marginLeft: 8 }} />}
                  </Space>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0 }}>Select a saved address to apply to all selected shipments:</p>
              <Button 
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => loadSavedData(true)}
                loading={loadingAddresses}
              >
                Reload
              </Button>
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
                handleBulkAddressChange(value, 'from');
                setBulkActionModal(null);
              }}
              tagRender={(props) => {
                const { label, value, closable, onClose } = props;
                const addr = savedAddresses.find(a => a.id === value);
                if (!addr) return <span>{label}</span>;
                
                // Format selected value to match dropdown format
                return (
                  <span onMouseDown={(e) => e.preventDefault()}>
                    <span style={{ marginRight: 4 }}>
                      {addr.is_default && <StarFilled style={{ color: '#faad14', fontSize: '12px' }} />}
                    </span>
                    <strong>{`${addr.first_name} ${addr.last_name || ''}`.trim()}</strong>
                    {addr.phone && (
                      <span style={{ color: '#8c8c8c', fontSize: '12px', marginLeft: 4 }}>
                        {addr.phone}
                      </span>
                    )}
                    <span style={{ color: '#595959', marginLeft: 4 }}>
                      - {addr.city}, {addr.state}
                    </span>
                  </span>
                );
              }}
            >
              {savedAddresses.map(addr => {
                // Format address to match Master table display
                const formattedAddress = (
                  <div style={{ padding: '4px 0' }}>
                    <div style={{ marginBottom: 4 }}>
                      <Space>
                        {addr.is_default && <StarFilled style={{ color: '#faad14' }} />}
                      </Space>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <strong>{`${addr.first_name} ${addr.last_name || ''}`.trim()}</strong>
                      {addr.phone && (
                        <span style={{ color: '#8c8c8c', fontSize: '13px', marginLeft: 8 }}>
                          {addr.phone}
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#595959', lineHeight: '1.6' }}>
                      <div>{addr.address}</div>
                      {addr.address2 && <div>{addr.address2}</div>}
                      <div>{`${addr.city}, ${addr.state} ${addr.zip_code}`}</div>
                    </div>
                  </div>
                );
                
                // Create searchable label for filter
                const searchLabel = [
                  addr.name,
                  `${addr.first_name} ${addr.last_name || ''}`.trim(),
                  addr.phone,
                  addr.address,
                  addr.address2,
                  addr.city,
                  addr.state,
                  addr.zip_code
                ].filter(Boolean).join(' ').toLowerCase();
                
                return (
                  <Select.Option key={addr.id} value={addr.id} label={searchLabel}>
                    {formattedAddress}
                  </Select.Option>
                );
              })}
            </Select>
          </>
        )}
      </Modal>

      <Modal
        title="Change Ship To Address for Selected"
        open={bulkActionModal === 'to_address'}
        onCancel={() => setBulkActionModal(null)}
        centered
        mask={true}
        maskClosable={false}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setBulkActionModal(null)}>
            Cancel
          </Button>,
        ]}
      >
        {savedToAddresses.length === 0 ? (
          <div>
            <Alert
              message="No Ship To Addresses Available"
              description={
                <div>
                  <p>Please add the address to change the address for selected shipments.</p>
                  <Space style={{ marginTop: 12 }}>
                    <Button 
                      type="primary" 
                      onClick={() => navigateToMaster('ship-to')}
                    >
                      Go to Master - Add Ship To Address
                    </Button>
                    <Button 
                      icon={<ReloadOutlined />}
                      onClick={() => loadSavedData(true)}
                      loading={loadingAddresses}
                    >
                      Reload
                    </Button>
                    {loadingAddresses && <Spin size="small" style={{ marginLeft: 8 }} />}
                  </Space>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0 }}>Select a saved address to apply to all selected shipments:</p>
              <Button 
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => loadSavedData(true)}
                loading={loadingAddresses}
              >
                Reload
              </Button>
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
                handleBulkAddressChange(value, 'to');
                setBulkActionModal(null);
              }}
              tagRender={(props) => {
                const { label, value, closable, onClose } = props;
                const addr = savedToAddresses.find(a => a.id === value);
                if (!addr) return <span>{label}</span>;
                
                // Format selected value to match dropdown format
                return (
                  <span onMouseDown={(e) => e.preventDefault()}>
                    <span style={{ marginRight: 4 }}>
                      {addr.is_default && <StarFilled style={{ color: '#faad14', fontSize: '12px' }} />}
                    </span>
                    {addr.name && (
                      <strong style={{ fontSize: '13px', marginRight: 4 }}>{addr.name}</strong>
                    )}
                    <strong>{`${addr.first_name} ${addr.last_name || ''}`.trim()}</strong>
                    {addr.phone && (
                      <span style={{ color: '#8c8c8c', fontSize: '12px', marginLeft: 4 }}>
                        {addr.phone}
                      </span>
                    )}
                    <span style={{ color: '#595959', marginLeft: 4 }}>
                      - {addr.city}, {addr.state}
                    </span>
                  </span>
                );
              }}
            >
              {savedToAddresses.map(addr => {
                // Format address to match Master table display
                const formattedAddress = (
                  <div style={{ padding: '4px 0' }}>
                    <div style={{ marginBottom: 4 }}>
                      <Space>
                        {addr.is_default && <StarFilled style={{ color: '#faad14' }} />}
                        {addr.name && (
                          <strong style={{ fontSize: '15px' }}>{addr.name}</strong>
                        )}
                      </Space>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <strong>{`${addr.first_name} ${addr.last_name || ''}`.trim()}</strong>
                      {addr.phone && (
                        <span style={{ color: '#8c8c8c', fontSize: '13px', marginLeft: 8 }}>
                          {addr.phone}
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#595959', lineHeight: '1.6' }}>
                      <div>{addr.address}</div>
                      {addr.address2 && <div>{addr.address2}</div>}
                      <div>{`${addr.city}, ${addr.state} ${addr.zip_code}`}</div>
                    </div>
                  </div>
                );
                
                // Create searchable label for filter
                const searchLabel = [
                  addr.name,
                  `${addr.first_name} ${addr.last_name || ''}`.trim(),
                  addr.phone,
                  addr.address,
                  addr.address2,
                  addr.city,
                  addr.state,
                  addr.zip_code
                ].filter(Boolean).join(' ').toLowerCase();
                
                return (
                  <Select.Option key={addr.id} value={addr.id} label={searchLabel}>
                    {formattedAddress}
                  </Select.Option>
                );
              })}
            </Select>
          </>
        )}
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

      {/* Custom CSS for approve button hover effect */}
      <style>{`
        .approve-button:not(.approve-button-approved):not(:disabled):hover {
          border-color: #52c41a !important;
          color: #52c41a !important;
        }
        
        .approve-button:not(.approve-button-approved):not(:disabled):hover .anticon {
          color: #52c41a !important;
        }
      `}</style>
    </div>
  );
};

export default Step2Review;
