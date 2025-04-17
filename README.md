# Combine Stats Tracker App

This repository contains the code for the Combine Stats Tracker application, designed for youth sports combine events.

## Project Structure

- `/frontend`: Contains the React (Vite) web application.
- `/backend`: Contains the FastAPI backend application.

## Prerequisites

- Node.js (v18+ recommended) and npm
- Python (v3.9+ recommended) and pip
- PostgreSQL database running

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd combine-stats-tracker
    ```

2.  **Set up Backend:**
    - Navigate to the backend directory:
      ```bash
      cd backend
      ```
    - Create and activate a virtual environment (optional but recommended):
      ```bash
      python -m venv venv
      source venv/bin/activate # On Windows use `venv\Scripts\activate`
      ```
    - Install Python dependencies:
      ```bash
      pip install -r requirements.txt
      ```
    - Configure the database:
        - Copy the example environment file:
          ```bash
          cp .env.example .env
          ```
        - Edit the `.env` file and set your correct `DATABASE_URL` for your PostgreSQL instance.
        - Ensure the database specified in the URL exists.

3.  **Set up Frontend:**
    - Navigate to the frontend directory:
      ```bash
      cd ../frontend
      ```
    - Install Node.js dependencies:
      ```bash
      npm install
      ```

## Running the Application

1.  **Start the Backend:**
    - Ensure you are in the `backend` directory and your virtual environment is activated.
    - Run the FastAPI server:
      ```bash
      uvicorn main:app --reload
      ```
    - The backend API will be available at `http://localhost:8000`.

2.  **Start the Frontend:**
    - Ensure you are in the `frontend` directory.
    - Run the React development server:
      ```bash
      npm run dev
      ```
    - The frontend application will be available at `http://localhost:5173` (or another port if 5173 is busy).

3.  **Access the App:**
    - Open your web browser and navigate to the frontend URL (e.g., `http://localhost:5173`).
    - You should see the Player Profile Creation form.

## Current Features (Minimal Prototype)

- **Player Profile Creation:**
    - Form to enter Name, Number, Age.
    - Option to take a photo using the device camera or upload an image file.
    - Submits data to the backend `/players/` endpoint.
    - Player data (excluding the actual photo file) is stored in the PostgreSQL database. 