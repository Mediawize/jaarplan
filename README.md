# JaarPlan

Docentenplatform voor jaarplanning, klassen en opdrachten.

## Installatie

```bash
npm install
npm start
```

## Vereisten

- Node.js 18+
- `python3`, `make`, `g++`, `gcc` (voor better-sqlite3 compilatie)

## Omgevingsvariabelen

Maak een `.env` bestand aan met:
```
SESSION_SECRET=jouw-geheime-sleutel
PORT=3001
```

## Deployment (VPS)

```bash
git pull
npm install
pm2 restart jaarplan
```
