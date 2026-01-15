#!/bin/bash
set -e

# Run migrations
python manage.py migrate

# Start Gunicorn (try direct command first, fallback to python -m)
if command -v gunicorn &> /dev/null; then
    exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
else
    exec python -m gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
fi
