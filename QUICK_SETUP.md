# Quick Setup Guide
## For Developers Merging/Pulling This Code

**Time Required**: ~10-15 minutes

**⚠️ IMPORTANT**: This application requires **PostgreSQL**. SQLite is not supported.

---

## Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL 12+ (REQUIRED - no SQLite)
- Git (to clone/pull the code)

---

## Setup Steps

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download and install from: https://www.postgresql.org/download/windows/
Then create database using pgAdmin or command line.

---

### 2. Create Database

**macOS:**
```bash
/opt/homebrew/opt/postgresql@14/bin/createdb shipping_db
/opt/homebrew/opt/postgresql@14/bin/psql -d postgres -c "CREATE USER shipping_user WITH PASSWORD 'shipping_secure_pass_2026';"
/opt/homebrew/opt/postgresql@14/bin/psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;"
/opt/homebrew/opt/postgresql@14/bin/psql -d shipping_db -c "GRANT ALL ON SCHEMA public TO shipping_user;"
```

**Ubuntu/Debian:**
```bash
sudo -u postgres psql
```
Then:
```sql
CREATE DATABASE shipping_db;
CREATE USER shipping_user WITH PASSWORD 'shipping_secure_pass_2026';
GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;
ALTER ROLE shipping_user SET client_encoding TO 'utf8';
ALTER ROLE shipping_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE shipping_user SET timezone TO 'UTC';
\q
```

**Windows:**
Use pgAdmin or psql command line:
```sql
CREATE DATABASE shipping_db;
CREATE USER shipping_user WITH PASSWORD 'shipping_secure_pass_2026';
GRANT ALL PRIVILEGES ON DATABASE shipping_db TO shipping_user;
```

---

### 3. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

**Edit `.env` file** - The file is already created, just verify the password matches what you set in Step 2:
```env
DB_NAME=shipping_db
DB_USER=shipping_user
DB_PASSWORD=shipping_secure_pass_2026  # Must match password from Step 2
DB_HOST=localhost
DB_PORT=5432
```

**Note**: If you used a different password in Step 2, update `DB_PASSWORD` in `.env` to match.

```bash
python manage.py migrate
```

---

### 4. Frontend Setup

```bash
cd frontend
npm install
npm start
```

---

### 5. Start Backend

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

---

## Verify Setup

```bash
# Test database connection
cd backend
source venv/bin/activate
python manage.py dbshell
# Should show: shipping_db=>
# Type \q to exit
```

---

## That's It! ✅

Your application is now running with PostgreSQL.

**Access**: 
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

**Note**: Make sure both frontend and backend servers are running (Steps 4 and 5).

---

## Troubleshooting

**"PostgreSQL database configuration is required"**
→ Create `.env` file: `cp .env.example .env`

**"psycopg2 not found"**
→ `pip install -r requirements.txt`

**"Connection refused"**
→ Start PostgreSQL: `brew services start postgresql@14` (macOS)

**"role 'shipping_user' does not exist"**
→ Run Step 2 to create database and user

---

**For detailed instructions, see `SETUP_GUIDE_FOR_NEW_DEVELOPERS.md`**
