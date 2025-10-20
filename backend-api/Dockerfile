# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependency file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code into the container
COPY . .

# Google Cloud Run will set the PORT environment variable.
# Gunicorn will use this to listen for incoming requests.
CMD ["gunicorn", "--bind", "0.0.0.0:$PORT", "app:app"]