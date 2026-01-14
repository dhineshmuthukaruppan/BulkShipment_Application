# Database Explanation & Deployment Guide

## How the Database Works Now

### 1. **SQLite Database - Automatic Creation**

Your application uses **SQLite**, which is a file-based database. Here's how it works:

#### **Database Location**:
```
backend/db.sqlite3
```

#### **How It Was Created**:
Django **automatically creates** the SQLite database file when you run migrations:

```bash
python manage.py migrate
```

**What happens:**
1. Django reads your models (`models.py`)
2. Django checks migration files (`migrations/` folder)
3. Django creates/updates the `db.sqlite3` file automatically
4. All tables are created based on your models

**You didn't need to create it manually** - Django did it for you! ✅

---

## Current Database Setup

### **Configuration** (`backend/config/settings.py`):
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',  # File location
    }
}
```

### **Database File**:
- **Location**: `backend/db.sqlite3`
- **Type**: SQLite (file-based database)
- **Size**: Grows as you add data
- **Created**: Automatically by Django migrations

### **What's Inside**:
- `shipping_app_shipment` - All your shipment records
- `shipping_app_savedaddress` - Saved addresses from Master
- `shipping_app_savedpackage` - Saved packages from Master
- `shipping_app_shippinglabel` - Generated labels
- `shipping_app_ordernumbersettings` - Order number settings
- Plus Django system tables

---

## Will It Work When Deployed?

### ✅ **YES, but with considerations:**

### **Option 1: Keep SQLite (Simple Deployment)**
- ✅ **Works**: SQLite will work for small to medium deployments
- ✅ **No Setup**: No database server needed
- ⚠️ **Limitations**: 
  - Single file (can't scale across multiple servers)
  - File permissions need to be set correctly
  - Not ideal for high-traffic applications

**Best for**: Small deployments, single server, low traffic

### **Option 2: Switch to PostgreSQL (Production Recommended)**
- ✅ **Better**: Industry standard for production
- ✅ **Scalable**: Can handle high traffic
- ✅ **Reliable**: ACID compliant, robust
- ⚠️ **Requires**: Database server setup

**Best for**: Production deployments, high traffic, multiple servers

---

## Deployment Options

### **Option A: Deploy with SQLite (Quick Start)**

#### **Steps**:
1. **Deploy your code** (including `db.sqlite3` file)
2. **Run migrations** on server:
   ```bash
   python manage.py migrate
   ```
3. **Set file permissions**:
   ```bash
   chmod 664 db.sqlite3
   chmod 775 backend/
   ```
4. **Done!** ✅

#### **Pros**:
- ✅ Simple, no database server needed
- ✅ Works immediately

#### **Cons**:
- ⚠️ Not ideal for production
- ⚠️ Can't scale horizontally
- ⚠️ File-based (backup by copying file)

---

### **Option B: Deploy with PostgreSQL (Production)**

#### **Steps**:

1. **Install PostgreSQL** on server:
   ```bash
   sudo apt-get install postgresql postgresql-contrib
   ```

2. **Create database**:
   ```bash
   sudo -u postgres psql
   CREATE DATABASE shipping_db;
   CREATE USER shipping_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;
   ```

3. **Update settings.py**:
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'NAME': 'shipping_db',
           'USER': 'shipping_user',
           'PASSWORD': 'your_password',
           'HOST': 'localhost',
           'PORT': '5432',
       }
   }
   ```

4. **Install PostgreSQL adapter**:
   ```bash
   pip install psycopg2-binary
   ```
   (Already in your `requirements.txt` ✅)

5. **Run migrations**:
   ```bash
   python manage.py migrate
   ```

6. **Migrate data** (if needed):
   ```bash
   # Export from SQLite
   python manage.py dumpdata > data.json
   
   # Import to PostgreSQL
   python manage.py loaddata data.json
   ```

#### **Pros**:
- ✅ Production-ready
- ✅ Scalable
- ✅ Better performance
- ✅ Industry standard

#### **Cons**:
- ⚠️ Requires database server setup
- ⚠️ More complex initial setup

---

## Migration Process Explained

### **What are Migrations?**

Migrations are Django's way of tracking database schema changes:

1. **You define models** in `models.py`
2. **Django creates migration files** when you run:
   ```bash
   python manage.py makemigrations
   ```
3. **Django applies migrations** when you run:
   ```bash
   python manage.py migrate
   ```

### **Your Migration Files**:
```
backend/shipping_app/migrations/
├── 0001_initial.py          # Creates initial tables
├── 0002_shipment_shipping_provider.py
├── 0003_update_status_choices.py
├── 0004_add_batch_id.py
├── 0005_add_granular_status_choices.py
├── 0006_add_process_date.py
├── 0007_add_volumetric_weight_and_zone_fields.py
├── 0008_merge_20260113_0758.py
├── 0009_savedaddress_address_type.py
└── 0010_shipment_address_validation_error.py
```

**These files define your database structure!** ✅

---

## Database File Location

### **Current Location**:
```
/Users/ganeshmuthukaruppan/Documents/web_development/BulkShipment_Application/backend/db.sqlite3
```

### **How to Find It**:
```bash
cd backend
ls -lh db.sqlite3
```

### **File Properties**:
- **Type**: SQLite Database
- **Format**: Binary file
- **Size**: Grows with data
- **Backup**: Just copy the file!

---

## Deployment Checklist

### **For SQLite Deployment**:
- [ ] Include `db.sqlite3` in deployment (or let it be created)
- [ ] Set proper file permissions (664 for file, 775 for directory)
- [ ] Run `python manage.py migrate` on server
- [ ] Ensure write permissions for Django process

### **For PostgreSQL Deployment**:
- [ ] Install PostgreSQL on server
- [ ] Create database and user
- [ ] Update `settings.py` with PostgreSQL config
- [ ] Install `psycopg2-binary` (already in requirements.txt)
- [ ] Run `python manage.py migrate`
- [ ] Migrate data from SQLite if needed

---

## Environment Variables (Recommended)

### **For Production, use environment variables**:

#### **Update `settings.py`**:
```python
import os

DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.sqlite3'),
        'NAME': os.getenv('DB_NAME', BASE_DIR / 'db.sqlite3'),
        'USER': os.getenv('DB_USER', ''),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', ''),
        'PORT': os.getenv('DB_PORT', ''),
    }
}
```

#### **Create `.env` file** (for PostgreSQL):
```env
DB_ENGINE=django.db.backends.postgresql
DB_NAME=shipping_db
DB_USER=shipping_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
```

---

## Summary

### **Current Setup**:
- ✅ **Database**: SQLite (`backend/db.sqlite3`)
- ✅ **Created**: Automatically by Django migrations
- ✅ **Location**: `backend/db.sqlite3`
- ✅ **Working**: Yes, fully functional

### **For Deployment**:
- ✅ **SQLite**: Will work for simple deployments
- ✅ **PostgreSQL**: Recommended for production (already configured in requirements.txt)

### **Key Points**:
1. **Django creates the database automatically** - you don't need to create it manually
2. **Migrations define the structure** - all your tables are created from migration files
3. **SQLite works for development** - file-based, no server needed
4. **PostgreSQL recommended for production** - more robust and scalable
5. **Your data is in `db.sqlite3`** - all shipments, addresses, packages are stored there

---

## Quick Commands

### **Check Database Status**:
```bash
python manage.py showmigrations
```

### **Create New Migration** (if you change models):
```bash
python manage.py makemigrations
```

### **Apply Migrations**:
```bash
python manage.py migrate
```

### **View Database** (using SQLite browser):
```bash
# Install sqlitebrowser
brew install --cask db-browser-for-sqlite  # macOS
# Or download from: https://sqlitebrowser.org/
```

---

**Your database is working perfectly!** ✅  
**It will work when deployed** - just choose SQLite (simple) or PostgreSQL (production). ✅
