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
    def log_error(error_type, error_message, context=None):
        """Log error conditions"""
        logger.error(
            "error_occurred",
            error_type=error_type,
            error_message=str(error_message),
            context=context or {},
            event_type="error"
        )

