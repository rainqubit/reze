# Reze Sensor Dashboard

Reze is a lightweight Node.js application that collects sensor data and displays it on a real-time dashboard. It's built with Hono for the backend API and uses Alpine.js and Chart.js for the frontend.

## Features
- **Data Collection:** REST API to receive and store sensor data.
- **Data Storage:** Simple flat-file storage for readings (defaults to `data/sensors.txt`).
- **Dashboard:** Interactive web interface displaying real-time and historical data using charts.
- **Time Range Filtering:** Filter data by 6h, 12h, 24h, 72h, 7 days, or all time.
- **Pagination:** View older readings in the dashboard.
- **Configuration:** Easy configuration of labels and field mappings via `config.json`.

## Tech Stack
- **Backend:** Node.js, [Hono](https://hono.dev/)
- **Frontend:** HTML/CSS, [Alpine.js](https://alpinejs.dev/), [Chart.js](https://www.chartjs.org/)

## Installation & Usage

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the server:**
   ```bash
   npm run dev
   # or
   npm start
   ```

3. **Access the Dashboard:**
   Open your browser and navigate to `http://localhost:3000`.

## Configuration

You can configure the application by modifying `src/public/config.json`.

- `dataFile`: The name of the file in the `data/` directory where readings will be stored.
- `fieldMapping`: Maps the raw sensor field names to user-friendly labels.
- `labels`: Customize dashboard text labels (e.g., page title, chart title).

Example `config.json`:
```json
{
  "dataFile": "sensors.txt",
  "fieldMapping": {
    "temp1": "Living Room",
    "temp2": "Bedroom",
    "temp3": "Outside"
  },
  "labels": {
    "pageTitle": "My Home Sensors",
    "title": "Temperature Dashboard"
  }
}
```

## API Reference

### 1. Write Data
**POST** `/api/write`

Writes sensor data to the configured data file. The server automatically appends the current Unix timestamp.

**Query Parameters:**
- `mode` (optional): File writing mode. Can be `append` or `overwrite`. Defaults to `overwrite`.

**Request Body (JSON):**
```json
{
  "data": "temp1 22.5|temp2 18.3|temp3 25.1"
}
```
*Note: Exactly 3 pipe-separated name-value pairs are expected.*

**Example Response:**
```json
{
  "status": "ok",
  "path": "sensors.txt",
  "mode": "overwrite",
  "bytesWritten": 51,
  "fields": [
    {"name": "temp1", "value": "22.5"},
    {"name": "temp2", "value": "18.3"},
    {"name": "temp3", "value": "25.1"}
  ],
  "time": "1739265111",
  "timeIsServer": true
}
```

### 2. Read Data
**GET** `/api/readings`

Retrieves parsed sensor readings.

**Query Parameters:**
- `path` (optional): The data file name. Defaults to the configured `dataFile`.
- `range` (optional): Time range to filter (`6h`, `12h`, `24h`, `72h`, `168h`, `all`). Defaults to `24h`.
- `limit` (optional): Number of readings to return per page. Defaults to `50`.
- `offset` (optional): Pagination offset. Defaults to `0`.

**Example Response:**
```json
{
  "file": "sensors.txt",
  "total": 120,
  "hasMore": true,
  "readings": [
    {
      "fields": [
        {"name": "temp1", "value": "22.5"},
        {"name": "temp2", "value": "18.3"},
        {"name": "temp3", "value": "25.1"}
      ],
      "time": "1739265111"
    }
  ]
}
```

### 3. Health Check
**GET** `/api/upload`

Returns a basic health check response.

## Project Structure
- `src/index.js`: Main server entry point.
- `src/routes/`: API route handlers (`readings.js`, `write.js`, `upload.js`).
- `src/public/`: Static frontend files (`index.html`, `dashboard.css`, `config.json`).
- `data/`: Directory where sensor data files are stored.
