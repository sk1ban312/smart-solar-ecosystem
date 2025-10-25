# Smart Solar Ecosystem & Analytics Dashboard

### [View Live Demo](https://smart-solar-ecosystem-git-main-mykytas-projects-70aca375.vercel.app/)

A full-stack IoT application that monitors a real-world solar panel, predicts energy generation using AI, and calculates financial viability.

![Dashboard View](https://github.com/sk1ban312/smart-solar-ecosystem/blob/e135f84fc3bcd909af7f4ada522eef108615bdc6/documentation/project-assets/Home%20page.png) (https://github.com/sk1ban312/smart-solar-ecosystem/blob/e135f84fc3bcd909af7f4ada522eef108615bdc6/documentation/project-assets/Database%20page.png) (https://github.com/sk1ban312/smart-solar-ecosystem/blob/e135f84fc3bcd909af7f4ada522eef108615bdc6/documentation/project-assets/Financial%20page.png)

---

## About The Project

This project transforms a standard solar energy setup into an intelligent, connected platform. We installed sensors to measure current, voltage, temperature, and sunlight, feeding this data into an ESP32 microcontroller. The data is processed and sent via Wi-Fi to a cloud server, where it is displayed on a custom-built dashboard. The system also integrates an AI model that uses weather forecasts to predict future energy production and includes a financial module to calculate savings, payback time, and return on investment.

## Key Features

*   **Real-time Monitoring:** Live dashboard displaying panel power output, battery SOC, and sensor telemetry.
*   **AI-Powered Prediction:** Integrates weather forecasts with an OpenAI model to predict future energy generation.
*   **Historical Data Logging:** A database view showing the latest 100 measurements from the system.
*   **Interactive Financial Analysis:** A calculator to model annual savings, payback period, and ROI.
*   **Hardware Integration:** Utilizes an ESP32 microcontroller to capture and transmit sensor data.

## Technology Stack

*   **Frontend:** Next.js, React.js, CSS, Axios
*   **Backend:** Python, Flask
*   **Database:** Google Firebase (Realtime Database)
*   **Cloud & APIs:** Vercel (Deployment), OpenAI API, National Weather Service API
*   **Hardware:** ESP32 Microcontroller

## System Architecture

![System Architecture Diagram](URL_TO_YOUR_ARCHITECTURE_DIAGRAM.png)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js (v18 or later)
*   Python (v3.9 or later)
*   A Firebase project and an OpenAI API key.

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/your_username/your_repository.git
    ```
2.  **Setup the Frontend (`/frontend-dashboard`)**
    *   Navigate to the frontend directory: `cd frontend-dashboard`
    *   Install NPM packages: `npm install`
    *   Create a `.env.local` file and add your Firebase credentials:
      ```
      NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_KEY
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_DOMAIN
      NEXT_PUBLIC_FIREBASE_DATABASE_URL=YOUR_URL
      NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_ID
      NEXT_PUBLIC_FLASK_API_URL=http://127.0.0.1:5000
      ```
    *   Run the development server: `npm run dev`

3.  **Setup the Backend (`/backend-api`)**
    *   Navigate to the backend directory: `cd backend-api`
    *   Install Python packages: `pip install -r requirements.txt`
    *   Set your OpenAI API key as an environment variable:
      ```sh
      # For macOS/Linux
      export OPENAI_API_KEY='your_secret_key'
      # For Windows
      set OPENAI_API_KEY='your_secret_key'
      ```
    *   Run the Flask API: `flask run`

---
