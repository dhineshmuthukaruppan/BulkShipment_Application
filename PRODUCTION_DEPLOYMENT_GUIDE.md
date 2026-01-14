# Production Deployment Guide
## PostgreSQL Database Setup

**Status**: ✅ **Configuration Updated for Production**

---

## What I Changed

### ✅ **1. Updated `backend/config/settings.py`**
- Now supports **PostgreSQL** via environment variables
- **Falls back to SQLite** if PostgreSQL not configured (for development)
- Production-ready database configuration

### ✅ **2. Created `backend/.env.example`**
- Template for environment variables
- Shows how to configure PostgreSQL
- Includes all API keys configuration

### ✅ **3. Updated `.gitignore`**
- Ensures `.env` file is not committed to git
- Protects your database credentials

---

## What You Need to Do Now

### **Step 1: Install PostgreSQL (On Your Server)**

#### **For Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### **For macOS:**
```bash
brew install postgresql
brew services start postgresql
```

#### **For Windows:**
Download and install from: https://www.postgresql.org/download/windows/

---

### **Step 2: Create Database and User**

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
CREATE DATABASE shipping_db;
CREATE USER shipping_user WITH PASSWORD 'your_secure_password_here';
ALTER ROLE shipping_user SET client_encoding TO 'utf8';
ALTER ROLE shipping_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE shipping_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;
\q
```

**Replace `your_secure_password_here` with a strong password!**

---

### **Step 3: Create `.env` File**

```bash
cd backend
cp .env.example .env
```

Then edit `.env` and add your PostgreSQL configuration:

```env
# Database Configuration (PostgreSQL)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=shipping_db
DB_USER=shipping_user
DB_PASSWORD=your_secure_password_here
DB_HOST=localhost
DB_PORT=5432
```

**Important**: Replace `your_secure_password_here` with the password you created in Step 2!

---

### **Step 4: Run Migrations**

```bash
cd backend
source venv/bin/activate  # Activate virtual environment
python manage.py migrate
```

This will create all tables in PostgreSQL.

---

### **Step 5: (Optional) Migrate Data from SQLite**

If you have existing data in SQLite and want to migrate it:

```bash
# Export data from SQLite
python manage.py dumpdata > data.json

# Update settings.py temporarily to use PostgreSQL (or set env vars)
# Then import to PostgreSQL
python manage.py loaddata data.json
```

---

### **Step 6: Test the Connection**

```bash
python manage.py dbshell
```

If you see a PostgreSQL prompt, it's working! Type `\q` to exit.

---

## Verification Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `shipping_db` created
- [ ] User `shipping_user` created with password
- [ ] `.env` file created with correct credentials
- [ ] Migrations run successfully
- [ ] Application connects to PostgreSQL

---

## How It Works

### **Development (No .env file or SQLite config):**
- Uses SQLite automatically
- No setup needed
- Works immediately

### **Production (With .env file and PostgreSQL config):**
- Uses PostgreSQL automatically
- Reads from environment variables
- Production-grade database

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_ENGINE` | Database engine | `django.db.backends.postgresql` |
| `DB_NAME` | Database name | `shipping_db` |
| `DB_USER` | Database user | `shipping_user` |
| `DB_PASSWORD` | Database password | `your_secure_password` |
| `DB_HOST` | Database host | `localhost` or `127.0.0.1` |
| `DB_PORT` | Database port | `5432` (PostgreSQL default) |

---

## Security Best Practices

### ✅ **DO:**
- Use strong passwords for database
- Keep `.env` file secure (not in git)
- Use environment variables in production
- Restrict database access to localhost
- Use SSL connections for remote databases

### ❌ **DON'T:**
- Commit `.env` file to git
- Use weak passwords
- Expose database credentials in code
- Allow remote connections without SSL

---

## Troubleshooting

### **Error: "psycopg2 not found"**
```bash
pip install psycopg2-binary
```
(Already in requirements.txt, but ensure it's installed)

### **Error: "Connection refused"**
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify host and port in `.env`
- Check firewall settings

### **Error: "Authentication failed"**
- Verify username and password in `.env`
- Check PostgreSQL user exists: `sudo -u postgres psql -c "\du"`

### **Error: "Database does not exist"**
- Create database: `sudo -u postgres createdb shipping_db`
- Or run the SQL commands from Step 2

---

## Quick Start Commands

```bash
# 1. Install PostgreSQL (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# 2. Create database
sudo -u postgres psql -c "CREATE DATABASE shipping_db;"
sudo -u postgres psql -c "CREATE USER shipping_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;"

# 3. Create .env file
cd backend
cp .env.example .env
# Edit .env with your database credentials

# 4. Run migrations
python manage.py migrate

# 5. Test
python manage.py dbshell
```

---

## Summary

✅ **Configuration Updated**: Settings now support PostgreSQL  
✅ **Environment Variables**: Use `.env` file for configuration  
✅ **Production Ready**: PostgreSQL is industry standard  
✅ **Backward Compatible**: Still works with SQLite for development  

**Your application is now production-ready!** 🚀

---

**Next Steps**: Follow the steps above to set up PostgreSQL on your deployment server.
