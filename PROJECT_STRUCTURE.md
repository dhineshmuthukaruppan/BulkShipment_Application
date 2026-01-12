# Project Structure

This project has been reorganized into a clean backend/frontend structure.

## Directory Layout

```
BulkShipment_Application/
├── backend/                    # All Django backend code
│   ├── config/                # Django project configuration
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── shipping_app/          # Django app
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── services/
│   │   └── serializers/
│   ├── manage.py              # Django management script
│   ├── requirements.txt
│   ├── venv/                  # Python virtual environment
│   └── start_dev.sh           # Backend startup script
│
├── frontend/                  # React frontend
│   ├── src/
│   ├── package.json
│   └── .env
│
├── Template.csv               # Sample CSV file
├── PRD.md                     # Product requirements
├── README.md                  # Main documentation
└── start_dev.sh               # Start both servers (from root)
```

## Running the Application

### Option 1: Start Both Servers (Recommended)
From project root:
```bash
./start_dev.sh
```

### Option 2: Start Separately

**Backend:**
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

**Frontend:**
```bash
cd frontend
npm start
```

## Notes

- All Django code is now in `backend/`
- All React code is in `frontend/`
- The structure is cleaner and more maintainable
- Paths have been updated to work with the new structure
