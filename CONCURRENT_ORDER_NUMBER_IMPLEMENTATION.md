# Concurrent Order Number Generation Implementation

## Problem Statement

When multiple users purchase shipments simultaneously, we need to ensure:
1. **No duplicate order numbers** - Each shipment gets a unique order number
2. **Sequential numbering** - Order numbers are continuous (ORD-0001, ORD-0002, ORD-0003...)
3. **Atomic operations** - No race conditions where two users get the same number

## Solution Overview

The implementation uses **database-level locking** with Django's `SELECT FOR UPDATE` and `@transaction.atomic` to ensure thread-safe order number generation.

## Key Components

### 1. OrderNumberGenerator Service (`backend/shipping_app/services/order_number_generator.py`)

The core logic is in the `generate_order_numbers_for_shipments()` method:

```python
@staticmethod
@transaction.atomic
def generate_order_numbers_for_shipments(shipment_ids: List[int]) -> Dict[int, str]:
    """
    Generate order numbers for shipments that have empty order_number fields.
    Uses SELECT FOR UPDATE to ensure atomicity in concurrent scenarios.
    """
```

### 2. Critical Implementation Details

#### A. Database Transaction with Atomicity

```python
@transaction.atomic
def generate_order_numbers_for_shipments(...):
```

- The `@transaction.atomic` decorator ensures the entire operation is wrapped in a database transaction
- If any part fails, the entire operation rolls back
- This prevents partial updates that could cause duplicate numbers

#### B. SELECT FOR UPDATE Locking

```python
settings = OrderNumberSettings.objects.select_for_update().filter(is_active=True).first()
```

**What `SELECT FOR UPDATE` does:**
- Locks the `OrderNumberSettings` row in the database
- Other transactions trying to read this row will **wait** until the lock is released
- This ensures only one purchase operation can read settings at a time
- Prevents race conditions where two users read the same "last number" simultaneously

**How it works:**
1. User A starts purchase → Locks `OrderNumberSettings` row
2. User B starts purchase → **Waits** for User A's lock to release
3. User A generates numbers (ORD-0001, ORD-0002) → Commits transaction → Lock released
4. User B's transaction proceeds → Reads updated max number → Generates (ORD-0003, ORD-0004)

#### C. Finding the Maximum Existing Order Number

```python
# Find the highest existing order number in the database
existing_shipments = Shipment.objects.filter(
    Q(order_number__isnull=False) & ~Q(order_number='')
).exclude(id__in=shipment_ids)

max_suffix = starting_number - 1

# Extract numeric suffixes from all existing order numbers
for shipment in existing_shipments.only('order_number'):
    order_num = shipment.order_number
    # Extract number using regex pattern matching
    pattern = re.escape(prefix) + re.escape(separator) + r'(\d+)'
    match = re.search(pattern, order_num, re.IGNORECASE)
    if match:
        suffix = int(match.group(1))
        max_suffix = max(max_suffix, suffix)
```

**Why this is important:**
- Queries **ALL shipments** in the database (not just current purchase)
- Ensures continuous numbering across all users and purchases
- Example: If last order number is ORD-0015, next purchase starts from ORD-0016

#### D. Sequential Number Generation

```python
# Generate sequential order numbers starting from max_suffix + 1
current_counter = max_suffix + 1

for shipment in shipments:
    formatted_num = format_str.format(current_counter)
    order_number = f"{prefix}{separator}{formatted_num}"
    shipment.order_number = order_number
    current_counter += 1
```

#### E. Bulk Update (Atomic Write)

```python
# Bulk update shipments with generated order numbers
Shipment.objects.bulk_update(
    shipments_to_update,
    ['order_number', 'validation_flags'],
    batch_size=100
)
```

- Updates all shipments in a single database operation
- More efficient than individual updates
- Still within the transaction, so it's atomic

### 3. Integration in Purchase Endpoint (`backend/shipping_app/views.py`)

```python
@action(detail=False, methods=['post'])
def purchase(self, request):
    # ... validation code ...
    
    # Generate order numbers for shipments with empty order_number fields
    # This happens atomically using database transactions to prevent race conditions
    shipment_id_list = list(shipments.values_list('id', flat=True))
    try:
        order_generator = OrderNumberGenerator()
        order_number_mapping = order_generator.generate_order_numbers_for_shipments(shipment_id_list)
        
        # Refresh shipments from database to get updated order numbers
        shipments = Shipment.objects.filter(
            id__in=shipment_id_list,
            status='ready'
        ).exclude(shipping_service='')
    except Exception as e:
        ShippingLogger().log_error('order_number_generation_error', str(e))
        return Response({'error': f'Failed to generate order numbers: {str(e)}'}, ...)
```

## How It Prevents Race Conditions

### Scenario: Two Users Purchase Simultaneously

**Without locking (BAD):**
```
Time    User A                          User B
----    ------                         ------
T1      Read max number: ORD-0015       Read max number: ORD-0015
T2      Generate: ORD-0016             Generate: ORD-0016  ❌ DUPLICATE!
T3      Save ORD-0016                   Save ORD-0016
```

**With SELECT FOR UPDATE (GOOD):**
```
Time    User A                          User B
----    ------                         ------
T1      Lock settings                  (Waiting...)
T2      Read max number: ORD-0015      (Still waiting...)
T3      Generate: ORD-0016, ORD-0017   (Still waiting...)
T4      Save & commit                  (Still waiting...)
T5      Release lock                   Lock acquired!
T6      (Done)                         Read max number: ORD-0017
T7                                     Generate: ORD-0018, ORD-0019
T8                                     Save & commit
```

## Key Features

1. **Thread-Safe**: Uses database-level locking, works with multiple processes/servers
2. **No Duplicates**: SELECT FOR UPDATE ensures sequential access
3. **Continuous Sequence**: Numbers are continuous across all users (ORD-0001, ORD-0002, ORD-0003...)
4. **Atomic Operations**: Entire operation succeeds or fails together
5. **Handles Empty Order Numbers**: Only generates numbers for shipments with empty `order_number` field
6. **Configurable Format**: Supports custom prefix, separator, and number format via `OrderNumberSettings`

## Database Requirements

- **PostgreSQL** (recommended) - Full support for SELECT FOR UPDATE
- **MySQL** - Also supports SELECT FOR UPDATE
- **SQLite** - Limited support (not recommended for production with concurrent users)

## Testing Concurrent Scenarios

To test this implementation:

1. **Simulate concurrent requests:**
```python
import threading
import requests

def purchase_shipments(user_id):
    response = requests.post('http://localhost:8000/api/shipments/purchase/', 
                           json={'shipment_ids': [1, 2, 3]})
    print(f"User {user_id}: {response.json()}")

# Launch 5 concurrent purchases
threads = []
for i in range(5):
    t = threading.Thread(target=purchase_shipments, args=(i,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()
```

2. **Verify no duplicates:**
```python
from shipping_app.models import Shipment

order_numbers = Shipment.objects.values_list('order_number', flat=True)
duplicates = [num for num in order_numbers if order_numbers.count(num) > 1]
assert len(duplicates) == 0, f"Found duplicate order numbers: {duplicates}"
```

## Summary

The implementation uses:
- **`@transaction.atomic`** - Wraps operation in database transaction
- **`SELECT FOR UPDATE`** - Locks settings row to prevent concurrent reads
- **Sequential number generation** - Based on max existing number in database
- **Bulk update** - Efficient atomic write of all order numbers

This ensures that even when 100 users purchase simultaneously, each shipment gets a unique, sequential order number without duplicates or gaps.
