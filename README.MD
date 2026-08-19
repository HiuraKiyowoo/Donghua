# Donghub Web

Web anime streaming berbasis donghub.vip

## Setup

```bash
npm install
```

## Development

Terminal 1 — jalankan backend:
```bash
node server.js
```

Terminal 2 — jalankan frontend dev:
```bash
npm run dev
```

Buka: http://localhost:5173

## Production

```bash
npm run build
node server.js
```

Buka: http://localhost:3000

## Deploy ke VPS

```bash
npm run build
PORT=80 node server.js
# atau pakai PM2:
pm2 start server.js --name donghub-web
```
