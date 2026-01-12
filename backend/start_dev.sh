#!/bin/bash

# Start Django backend in background
echo "Starting Django backend..."
source venv/bin/activate
python manage.py runserver &
DJANGO_PID=$!

# Wait a moment for Django to start
sleep 3

# Start React frontend
echo "Starting React frontend..."
cd ../frontend
npm start &
REACT_PID=$!

echo "Both servers are starting..."
echo "Django backend: http://localhost:8000"
echo "React frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
trap "kill $DJANGO_PID $REACT_PID; exit" INT
wait

