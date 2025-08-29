FROM python:3.10-slim

WORKDIR /app

# Install required packages
RUN pip install --no-cache-dir \
    bcsfe \
    flask \
    flask-socketio \
    python-socketio \
    eventlet

# Copy application files
COPY app.py .
COPY templates ./templates
COPY static ./static

# Expose port for web interface
EXPOSE 5000

# Run the Flask application
CMD ["python", "app.py"]