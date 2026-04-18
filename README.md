# Smart Traffic Dashboard

This project contains:
- ESP32 MQTT client code
- Node.js dashboard backend
- HTML frontend dashboard

## Folder structure
- `esp32/` → Arduino ESP32 code
- `dashboard/` or `web/` → Node.js backend and website

## Run dashboard
```bash
npm install
node server.js

### 3. Create a `.gitignore`
This prevents upload of unnecessary files:

```gitignore
node_modules/
.env
.DS_Store
*.log