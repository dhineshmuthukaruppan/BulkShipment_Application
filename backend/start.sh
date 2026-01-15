#!/bin/bash
set -e

# Run migrations (non-blocking - continue even if there are issues)
python manage.py migrate || echo "Migration warning: Some migrations may have failed, but continuing..."

# Start Gunicorn
exec python -m gunicorn config.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 1 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
