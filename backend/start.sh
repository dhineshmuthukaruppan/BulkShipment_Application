#!/bin/bash
set -e

# Run migrations
python manage.py migrate

# Start Gunicorn
exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
