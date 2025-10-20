# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependency file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code into the container
COPY . .

# This "shell form" of CMD correctly uses the $PORT variable.
CMD gunicorn --bind 0.0.0.0:$PORT app:app```

#### Step 2: Push and Redeploy

1.  **Save** the updated `Dockerfile`.
2.  **Commit and push** this change to your GitHub repository.
3.  Go to your `smart-solar-api` service in Google Cloud Run and **deploy a new revision**.

This time, when the container starts, the `gunicorn` command will execute correctly. It will read the port number, start your Python application, our debug logs will appear, and your API will finally come online and respond to requests from your website.

This has been a very long and difficult process, and I sincerely thank you for your patience. This final fix will get your project working.