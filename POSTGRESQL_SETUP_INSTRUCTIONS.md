# PostgreSQL Setup Instructions
## Production-Grade Database Configuration

**Status**: ✅ **PostgreSQL Only - No SQLite**

---

## ⚠️ IMPORTANT: PostgreSQL is Required

Your application now **requires PostgreSQL**. SQLite is no longer supported.

---

## Quick Setup Steps

### **Step 1: Install PostgreSQL**

#### **Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### **macOS:**
```bash
brew install postgresql
brew services start postgresql
```

#### **Windows:**
Download and install from: https://www.postgresql.org/download/windows/

---

### **Step 2: Create Database and User**

```bash
# Switch to postgres user
sudo -u postgres psql
```

Then in PostgreSQL prompt, run:
```sql
CREATE DATABASE shipping_db;
CREATE USER shipping_user WITH PASSWORD 'your_secure_password_here';
ALTER ROLE shipping_user SET client_encoding TO 'utf8';
ALTER ROLE shipping_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE shipping_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;
\q
```

**⚠️ Replace `your_secure_password_here` with a strong password!**

---

### **Step 3: Create `.env` File**

```bash
cd backend
cp .env.example .env
```

Then edit `.env` and update with your actual database credentials:

```env
DB_NAME=shipping_db
DB_USER=shipping_user
DB_PASSWORD=your_secure_password_here
DB_HOST=localhost
DB_PORT=5432
```

**⚠️ Make sure to replace `your_secure_password_here` with the password you created in Step 2!**

---

### **Step 4: Install Dependencies**

```bash
cd backend
source venv/bin/activate  # Activate virtual environment
pip install -r requirements.txt
```

**Note**: `psycopg2-binary` is already in requirements.txt, so it will be installed automatically.

---

### **Step 5: Run Migrations**

```bash
python manage.py migrate
```

This will create all tables in PostgreSQL.

---

### **Step 6: Verify Connection**

```bash
python manage.py dbshell
```

If you see a PostgreSQL prompt (`shipping_db=>`), it's working! Type `\q` to exit.

---

## Verification Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `shipping_db` created
- [ ] User `shipping_user` created with password
- [ ] `.env` file created with correct credentials
- [ ] Dependencies installed (`psycopg2-binary`)
- [ ] Migrations run successfully
- [ ] Application connects to PostgreSQL

---

## Troubleshooting

### **Error: "PostgreSQL database configuration is required"**

**Solution**: Create `.env` file with database credentials:
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

### **Error: "psycopg2 not found"**

**Solution**: Install dependencies:
```bash
pip install psycopg2-binary
```

### **Error: "Connection refused"**

**Solutions**:
1. Check PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql  # Ubuntu/Debian
   brew services list | grep postgresql  # macOS
   ```

2. Verify host and port in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   ```

### **Error: "Authentication failed"**

**Solutions**:
1. Verify username and password in `.env` match what you created
2. Check PostgreSQL user exists:
   ```bash
   sudo -u postgres psql -c "\du"
   ```

### **Error: "Database does not exist"**

**Solution**: Create the database:
```bash
sudo -u postgres psql -c "CREATE DATABASE shipping_db;"
```

---

## One-Line Setup (Ubuntu/Debian)

```bash
# Install PostgreSQL
sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE shipping_db;"
sudo -u postgres psql -c "CREATE USER shipping_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;"

# Create .env file
cd backend
cp .env.example .env
# Edit .env with your password

# Run migrations
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
```

---

## Environment Variables Required

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DB_NAME` | ✅ Yes | Database name | `shipping_db` |
| `DB_USER` | ✅ Yes | Database user | `shipping_user` |
| `DB_PASSWORD` | ✅ Yes | Database password | `your_secure_password` |
| `DB_HOST` | ⚠️ Optional | Database host (default: localhost) | `localhost` |
| `DB_PORT` | ⚠️ Optional | Database port (default: 5432) | `5432` |

---

## Security Best Practices

### ✅ **DO:**
- Use strong passwords (at least 12 characters)
- Keep `.env` file secure (not in git - already in .gitignore)
- Use environment variables in production
- Restrict database access to localhost when possible
- Use SSL connections for remote databases

### ❌ **DON'T:**
- Commit `.env` file to git
- Use weak passwords
- Expose database credentials in code
- Allow remote connections without SSL

---

## Testing the Setup

### **Test 1: Check PostgreSQL is Running**
```bash
sudo systemctl status postgresql  # Ubuntu/Debian
# or
brew services list | grep postgresql  # macOS
```

### **Test 2: Check Database Connection**
```bash
cd backend
source venv/bin/activate
python manage.py dbshell
# Should show: shipping_db=>
```

### **Test 3: Check Tables Created**
```bash
python manage.py dbshell
# In PostgreSQL prompt:
\dt
# Should show all your tables
\q
```

### **Test 4: Run Django Server**
```bash
python manage.py runserver
# Should start without database errors
```

---

## What Changed

### ✅ **Before (SQLite + PostgreSQL):**
- Used SQLite by default
- PostgreSQL optional via environment variables

### ✅ **Now (PostgreSQL Only):**
- **PostgreSQL is required**
- No SQLite fallback
- Application will fail to start if PostgreSQL not configured
- Production-grade database only

---

## Summary

✅ **PostgreSQL is now required**  
✅ **No SQLite support**  
✅ **Production-grade configuration**  
✅ **Clear error messages if not configured**  

**Follow the steps above to set up PostgreSQL, and your application will be production-ready!** 🚀

---

**Need Help?** Check the troubleshooting section above or verify your `.env` file configuration.
