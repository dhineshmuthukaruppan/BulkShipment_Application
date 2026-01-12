"""
Structured logging service for shipping operations
"""
import structlog
import logging

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


class ShippingLogger:
    """Centralized logging service for shipping operations"""
    
    @staticmethod
    def log_csv_upload(file_name, row_count, issues, auto_fixes_applied=False):
        """Log CSV upload completion"""
        logger.info(
            "csv_upload_complete",
            file_name=file_name,
            rows_processed=row_count,
            validation_issues=len(issues),
            auto_fixes_applied=auto_fixes_applied,
            event_type="csv_upload"
        )
    
    @staticmethod
    def log_address_validation(address_dict, api_used, result, fallback_triggered=False):
        """Log address validation attempt"""
        logger.info(
            "address_validated",
            address_hash=hash(str(address_dict)),
            api_used=api_used,
            is_valid=result.get('valid', False),
            fallback_used=fallback_triggered,
            corrections=result.get('corrections', []),
            event_type="address_validation"
        )
    
    @staticmethod
    def log_bulk_action(action_type, rows_affected, changes_summary):
        """Log bulk action operations"""
        logger.info(
            "bulk_action_performed",
            action_type=action_type,
            rows_affected=rows_affected,
            changes_summary=changes_summary,
            event_type="bulk_action"
        )
    
    @staticmethod
    def log_shipping_calculation(shipment_id, service, cost, calculation_method):
        """Log shipping cost calculation"""
        logger.info(
            "shipping_calculated",
            shipment_id=shipment_id,
            service=service,
            cost=float(cost),
            calculation_method=calculation_method,
            event_type="shipping_calculation"
        )
    
    @staticmethod
    def log_purchase(transaction_id, total_cost, label_count, label_size):
        """Log purchase transaction"""
        logger.info(
            "purchase_completed",
            transaction_id=transaction_id,
            total_cost=float(total_cost),
            label_count=label_count,
            label_size=label_size,
            event_type="purchase"
        )
    
    @staticmethod
    def log_error(error_type, error_message, context=None, exc_info=None):
        """Log error conditions with enhanced context"""
        import traceback
        import uuid
        from datetime import datetime
        
        error_context = context or {}
        error_context.update({
            'error_id': str(uuid.uuid4()),
            'timestamp': datetime.utcnow().isoformat(),
        })
        
        # Add stack trace if exception info provided
        if exc_info:
            error_context['traceback'] = ''.join(traceback.format_exception(*exc_info))
        elif 'traceback' not in error_context:
            # Try to get current traceback if available
            try:
                import sys
                error_context['traceback'] = ''.join(traceback.format_exception(*sys.exc_info()))
            except:
                pass
        
        logger.error(
            "error_occurred",
            error_type=error_type,
            error_message=str(error_message),
            context=error_context,
            event_type="error",
            exc_info=exc_info
        )
    
    @staticmethod
    def log_shipment_update(shipment_id, changes, previous_values=None):
        """Log individual shipment update"""
        logger.info(
            "shipment_updated",
            shipment_id=shipment_id,
            changes=changes,
            previous_values=previous_values or {},
            event_type="shipment_update"
        )
    
    @staticmethod
    def log_shipment_create(shipment_id, order_number=None, status=None):
        """Log shipment creation"""
        logger.info(
            "shipment_created",
            shipment_id=shipment_id,
            order_number=order_number,
            status=status,
            event_type="shipment_create"
        )
    
    @staticmethod
    def log_shipment_delete(shipment_id, order_number=None, status=None):
        """Log shipment deletion"""
        logger.info(
            "shipment_deleted",
            shipment_id=shipment_id,
            order_number=order_number,
            status=status,
            event_type="shipment_delete"
        )
    
    @staticmethod
    def log_master_data_operation(operation, data_type, record_id, changes=None, previous_values=None):
        """Log master data operations (address/package CRUD)"""
        logger.info(
            "master_data_operation",
            operation=operation,  # 'create', 'update', 'delete', 'set_default'
            data_type=data_type,  # 'address', 'package'
            record_id=record_id,
            changes=changes or {},
            previous_values=previous_values or {},
            event_type="master_data"
        )
    
    @staticmethod
    def log_dashboard_access(date_range_start=None, date_range_end=None, filters=None):
        """Log dashboard data access"""
        logger.info(
            "dashboard_accessed",
            date_range_start=date_range_start.isoformat() if date_range_start else None,
            date_range_end=date_range_end.isoformat() if date_range_end else None,
            filters=filters or {},
            event_type="dashboard_access"
        )

