# Setup Guide for New Developers
## After Merging/Pulling the Code

**Status**: PostgreSQL is **REQUIRED** - No SQLite support

---

## Quick Setup Steps

### **Step 1: Install PostgreSQL**

#### **macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

#### **Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### **Windows:**
Download and install from: https://www.postgresql.org/download/windows/

---

### **Step 2: Create Database and User**

#### **macOS (Homebrew):**
```bash
# Create database
/opt/homebrew/opt/postgresql@14/bin/createdb shipping_db

# Create user
/opt/homebrew/opt/postgresql@14/bin/psql -d postgres -c "CREATE USER shipping_user WITH PASSWORD 'shipping_secure_pass_2026';"

# Grant permissions
/opt/homebrew/opt/postgresql@14/bin/psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;"
/opt/homebrew/opt/postgresql@14/bin/psql -d shipping_db -c "GRANT ALL ON SCHEMA public TO shipping_user;"
```

#### **Ubuntu/Debian:**
```bash
sudo -u postgres psql
```

Then in PostgreSQL prompt:
```sql
CREATE DATABASE shipping_db;
CREATE USER shipping_user WITH PASSWORD 'shipping_secure_pass_2026';
GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;
ALTER ROLE shipping_user SET client_encoding TO 'utf8';
ALTER ROLE shipping_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE shipping_user SET timezone TO 'UTC';
\q
```

**⚠️ Note**: You can change the password to your own secure password.

---

### **Step 3: Backend Setup**

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

### **Step 4: Create `.env` File**

```bash
cd backend
cp .env.example .env
```

Then edit `.env` and update with your database credentials:

```env
# Database Configuration (PostgreSQL - REQUIRED)
DB_NAME=shipping_db
DB_USER=shipping_user
DB_PASSWORD=shipping_secure_pass_2026
DB_HOST=localhost
DB_PORT=5432

# Address Validation API Keys (optional)
USPS_CLIENT_ID=
USPS_CLIENT_SECRET=
USPS_USE_TEM=False
USPS_API_KEY=
GOOGLE_MAPS_API_KEY=
SMARTY_AUTH_ID=
SMARTY_AUTH_TOKEN=
LOB_API_KEY=
```

**⚠️ Important**: 
- Replace `shipping_secure_pass_2026` with the password you created in Step 2
- Or use the default password if you used the commands above

---

### **Step 5: Run Migrations**

```bash
cd backend
source venv/bin/activate
python manage.py migrate
```

This will create all tables in PostgreSQL.

---

### **Step 6: (Optional) Load Sample Data**

```bash
python manage.py init_data
```

This will create sample saved addresses and packages.

---

### **Step 7: Frontend Setup**

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

---

### **Step 8: Start Backend Server**

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

---

## Verification

### **Test Database Connection:**
```bash
cd backend
source venv/bin/activate
python manage.py dbshell
```

If you see `shipping_db=>`, it's working! Type `\q` to exit.

### **Check Tables:**
```sql
\dt
```

Should show all your application tables.

---

## Troubleshooting

### **Error: "PostgreSQL database configuration is required"**

**Solution**: Create `.env` file:
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

### **Error: "psycopg2 not found"**

**Solution**: Install dependencies:
```bash
pip install -r requirements.txt
```

### **Error: "Connection refused"**

**Solutions**:
1. Check PostgreSQL is running:
   ```bash
   # macOS
   brew services list | grep postgresql
   
   # Ubuntu/Debian
   sudo systemctl status postgresql
   ```

2. Start PostgreSQL:
   ```bash
   # macOS
   brew services start postgresql@14
   
   # Ubuntu/Debian
   sudo systemctl start postgresql
   ```

### **Error: "role 'shipping_user' does not exist"**

**Solution**: Create the user (see Step 2)

### **Error: "database 'shipping_db' does not exist"**

**Solution**: Create the database (see Step 2)

---

## Environment Variables Required

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DB_NAME` | ✅ Yes | Database name | `shipping_db` |
| `DB_USER` | ✅ Yes | Database user | `shipping_user` |
| `DB_PASSWORD` | ✅ Yes | Database password | `your_password` |
| `DB_HOST` | ⚠️ Optional | Database host (default: localhost) | `localhost` |
| `DB_PORT` | ⚠️ Optional | Database port (default: 5432) | `5432` |

---

## Quick Setup Script (macOS)

```bash
#!/bin/bash

# Install PostgreSQL
brew install postgresql@14
brew services start postgresql@14

# Wait for PostgreSQL to start
sleep 5

# Create database and user
/opt/homebrew/opt/postgresql@14/bin/createdb shipping_db
/opt/homebrew/opt/postgresql@14/bin/psql -d postgres -c "CREATE USER shipping_user WITH PASSWORD 'shipping_secure_pass_2026';"
/opt/homebrew/opt/postgresql@14/bin/psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;"
/opt/homebrew/opt/postgresql@14/bin/psql -d shipping_db -c "GRANT ALL ON SCHEMA public TO shipping_user;"

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Run migrations
python manage.py migrate

echo "✅ Setup complete! Now start the servers:"
echo "  Backend: cd backend && source venv/bin/activate && python manage.py runserver"
echo "  Frontend: cd frontend && npm start"
```

---

## Summary

**After merging the code, your friend needs to:**

1. ✅ **Install PostgreSQL** (Step 1)
2. ✅ **Create database and user** (Step 2)
3. ✅ **Set up backend** (Step 3)
4. ✅ **Create `.env` file** (Step 4)
5. ✅ **Run migrations** (Step 5)
6. ✅ **Set up frontend** (Step 7)
7. ✅ **Start servers** (Step 8)

**Total Time**: ~10-15 minutes

---

## Important Notes

- ⚠️ **PostgreSQL is REQUIRED** - SQLite is not supported
- ⚠️ **`.env` file is required** - Application won't start without it
- ⚠️ **Database must be created** - Before running migrations
- ✅ **All credentials in `.env`** - Not committed to git (in .gitignore)

---

**Need Help?** Check the troubleshooting section or refer to `POSTGRESQL_SETUP_INSTRUCTIONS.md`
