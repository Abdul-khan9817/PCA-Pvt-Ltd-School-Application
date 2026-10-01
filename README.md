# PCA Pvt. Ltd — Pure MERN School Management System

PCA Pvt. Ltd is a MERN school management system with JWT authentication, role-based access, academic records, attendance, grades, fees, payroll, announcements, messaging, notifications and profile management.

## Stack

- Frontend: React 19 + Vite + Framer Motion + Recharts + Lucide
- Backend: Node.js + Express + MongoDB + Mongoose
- Authentication: JWT access token + HTTP-only refresh cookie + bcrypt
- Realtime: Socket.IO

## Requirements

- Node.js 18+
- MongoDB running locally on `127.0.0.1:27017`

## Install

From the project root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

## Run

Use one terminal from the project root:

```bash
npm run dev
```

This starts:

- Frontend: http://localhost:5173 (Vite may use 5174+ if 5173 is busy)
- Backend: http://localhost:5000
- Health check: http://localhost:5000/api/health

Do not start a second backend on port 5000. If port 5000 is already in use, stop the existing Node process before running the backend again.

In development, the backend accepts localhost frontend ports such as 5173 and 5174, so Vite changing ports will not cause a CORS failure.

## Admin login

- Email: `admin@edumanage.com`
- Password: `Password@123`

The backend automatically creates this admin account if it does not exist. If the older seeded account `admin@school.edu` exists, it is migrated to `admin@edumanage.com` without deleting the database.

To clear the database and leave only the admin account for entering real school data:

```bash
npm run clear-data
```

**Warning:** this command permanently deletes all PCA Pvt. Ltd records except user accounts with administrative roles, then creates or resets the default admin account. Use it only when you intentionally want a blank school database.

## Project structure

```text
PCA-Pvt-Ltd/
├── backend/
│   ├── .env
│   ├── package.json
│   └── src/
├── frontend/
│   ├── .env
│   ├── package.json
│   ├── public/
│   └── src/
├── .gitignore
├── package.json
└── README.md
```

## Notes

- Keep `.env` files local and do not commit real production secrets.
- The login page is centered, compact, responsive and uses the school-campus background.
- The login button text is simply **Sign in**.

## Button / Action Audit

The frontend action layer was audited so every rendered `<button>` has an explicit action or form submit handler. CRUD and workflow actions are wired to the MERN API or local UI state:

- Add / Create: students, staff, subjects, payroll, announcements, user accounts, leave applications
- Edit / Update / Save: students, staff, subjects, payroll, announcements, grades, profile
- Delete / Deactivate: students, staff, subjects, payroll, announcements, user accounts
- Approve / Reject / Pay: leave applications and payroll
- Attendance: Present / Absent / Late + Save Attendance
- Grade management: Records + Update
- Profile: Edit Profile, Change Password, Save Changes, Update Password, profile photo upload
- Authentication: Sign in, Forgot Password, Reset Password, Sign out
- Navigation: sidebar, profile menu, notifications, mobile navigation and modal close actions

Shared Save/Cancel buttons now explicitly use non-submit button types to prevent accidental form submission, and modals support Escape-to-close.
