# Changelog

All notable changes to Homeunity will be documented in this file.

## [1.0.0] - 2026-08-16

### Added
- Full English UI translation (63 files)
- Commercial license
- Student management with full CRUD operations
- Room and bed assignment system
- Property management (houses and apartments)
- Payment tracking with status badges
- Invoice generation with PDF export
- Deposit/insurance management with receipts
- Financial dashboard with real-time stats
- Monthly and yearly reports
- Calendar view for payments
- Summer course management
- Student transfer system
- Checkout with deposit deductions and refunds
- Real-time updates via Socket.IO
- PWA support (installable, offline-capable)
- Activity logging
- Admin management with role-based permissions
- Excel import/export
- Multi-database support (JSON, MongoDB, Supabase)
- Docker support
- Render deployment ready
- Auto-fill for student forms
- WhatsApp integration for payment reminders

### Fixed
- JWT secret persistence (no regeneration on restart)
- Student deletion cascades to payments/invoices
- Property deletion cleanup
- Invoice delete event emission
- Deposit status calculation for old months
- Permission checks on property editing
- Memory leaks in PWA update component
- Receipt number generation race condition
- Supabase write cache invalidation

### Performance
- Removed axios and dayjs dependencies (smaller bundle)
- React.lazy code splitting for all pages
- Vite manualChunks optimization
- Year revenue query optimized (single query)
- Supabase collections cached with 2s TTL
- Payment refresh throttled to 5-minute intervals
