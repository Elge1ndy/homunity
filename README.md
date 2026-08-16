# Homeunity - نظام إدارة السكن الجامعي 🏠

A complete, free, open-source full-stack web application for managing student dormitories and housing.

## Features

- **Student Management** - Register, track, archive, and manage students
- **Room & Bed Allocation** - Assign beds, track occupancy, prevent conflicts
- **Payment Tracking** - Auto-generate monthly payments, track status, receipts
- **Invoice Generation** - Create PDF invoices with Arabic support
- **Financial Dashboard** - Real-time statistics and reports
- **Real-time Updates** - Instant sync via Socket.IO
- **Arabic RTL Interface** - Full Arabic language support
- **PWA Support** - Works offline, installable on mobile
- **Desktop Version** - EXE build included
- **Multi-database** - JSON, MongoDB, or Supabase

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: JSON (default) / MongoDB / Supabase
- **Real-time**: Socket.IO
- **PDF**: PDFKit with Arabic fonts

## Installation

### 1. Clone or Extract

```bash
cd homeunity
```

### 2. Install Backend

```bash
cd backend
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Start Server

```bash
npm start
# Server runs on http://localhost:5000
```

### 5. Frontend (Development Only)

```bash
cd frontend
npm install
npm run dev
# Dev server on http://localhost:5173
```

## Default Login

- **Username**: admin
- **Password**: admin123

## Database Options

### JSON (Default)
No setup required. Data stored in `backend/data/`.

### MongoDB
```env
MONGO_URI=mongodb+srv://user:pass@cluster/dbname
DB_DRIVER=mongo
```

### Supabase
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-anon-key
DB_DRIVER=supabase
```

## Available On

- **Web** — Run locally or deploy to any server
- **Desktop** — Build EXE with `npm run build:exe` or `npm run build:desktop`
- **Mobile** — PWA support (installable from browser)

### Render
1. Push to GitHub
2. Create Web Service on Render
3. Set environment variables
4. Deploy!

### Docker
```bash
docker build -t homeunity .
docker run -p 5000:5000 homeunity
```

## Project Structure

```
backend/
  server.js              # Entry point + Socket.IO
  src/db/index.js        # Database layer (JSON/Mongo/Supabase)
  src/controllers/       # API controllers
  src/services/          # Business logic
  src/middleware/        # Auth, permissions, uploads
  src/routes/            # API routes
frontend/
  src/pages/             # React pages
  src/components/        # Reusable components
  src/context/           # React contexts
  src/hooks/             # Custom hooks
  src/socket.js          # Real-time connection
```

## License

MIT License - Free to use, modify, and distribute. See [LICENSE](LICENSE) file.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## Support

If you have questions or issues, open a [GitHub Issue](https://github.com/Elge1ndy/homunity/issues).
