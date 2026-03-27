# DocuCollab — Google Docs + DocuSign Mini App

A full-stack real-time collaborative document editing and signing application built with **Strapi v5**, **React + MUI**, and **Socket.IO**.

---

## Architecture

```
docusign-app/
├── backend/          # Strapi v5 REST API + Socket.IO server
│   ├── config/       # Server, DB, middleware, plugin config
│   ├── src/
│   │   ├── api/      # document, signature, collaborator, audit-log
│   │   ├── socket/   # Standalone Socket.IO server (server.js)
│   │   └── index.ts  # Bootstrap (auto-configure permissions)
│   └── .env.example
└── frontend/         # React 18 + Vite + MUI v7
    ├── src/
    │   ├── pages/    # Login, Register, Dashboard, Editor, Invite
    │   ├── components/
    │   ├── store/    # Zustand (auth + document state)
    │   └── services/ # Axios API + Socket.IO client
    └── .env.example
```

---

## Prerequisites

- **Node.js** 20–24 (required by Strapi v5)
- **npm** ≥ 6
- A free [Cloudinary](https://cloudinary.com) account
- (Optional) Gmail app password for email invites

---

## Step 1 — Clone & Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## Step 2 — Configure Environment Variables

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in:

| Variable              | Description                        | Where to get it                                                                           |
| --------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `APP_KEYS`            | Two comma-separated random strings | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (run twice) |
| `ADMIN_JWT_SECRET`    | 32+ char secret                    | Same command above                                                                        |
| `API_TOKEN_SALT`      | 16+ char salt                      | Same command above                                                                        |
| `TRANSFER_TOKEN_SALT` | Random string                      | Same command above                                                                        |
| `JWT_SECRET`          | 32+ char secret for user JWTs      | Same command above                                                                        |
| `CLOUDINARY_NAME`     | Your cloud name                    | [cloudinary.com/console](https://cloudinary.com/console)                                  |
| `CLOUDINARY_KEY`      | API key                            | Same page                                                                                 |
| `CLOUDINARY_SECRET`   | API secret                         | Same page                                                                                 |
| `SMTP_USER`           | Your email                         | Gmail or any SMTP provider                                                                |
| `SMTP_PASS`           | Gmail app password                 | [Google App Passwords](https://myaccount.google.com/apppasswords)                         |
| `EMAIL_FROM`          | Sender email                       | Same as SMTP_USER                                                                         |

**Quick secret generator:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Frontend

```bash
cd frontend
cp .env.example .env
```

The defaults work out-of-the-box for local development:

```
VITE_API_URL=http://localhost:1337
VITE_SOCKET_URL=http://localhost:3001
```

---

## Step 3 — Run the App

You need **3 terminal windows**:

### Terminal 1 — Strapi Backend

```bash
cd backend
npm run dev
```

- Strapi admin: http://localhost:1337/admin
- First run: Strapi will prompt you to create an admin account
- API: http://localhost:1337/api

### Terminal 2 — Socket.IO Server

```bash
cd backend
node src/socket/server.js
```

- Socket server runs on port **3001**

### Terminal 3 — React Frontend

```bash
cd frontend
npm run dev
```

- App: http://localhost:5173

---

## Step 4 — First-Time Strapi Setup

1. Open http://localhost:1337/admin
2. Create your admin account (first time only)
3. **Permissions are bootstrapped automatically** on startup via `src/index.ts`

If you ever need to manually set permissions:

- Go to **Settings → Users & Permissions → Roles → Authenticated**
- Enable all actions for: `document`, `signature`, `collaborator`, `audit-log`, `upload`

---

## Step 5 — Cloudinary Plugin Install

The backend needs the Cloudinary provider. Install it:

```bash
cd backend
npm install @strapi/provider-upload-cloudinary
```

Then add your Cloudinary credentials to `.env` and restart.

> **Without Cloudinary:** The app still works — file uploads will fail, but document creation, editing, signing, and collaboration all function normally.

---

## Features

| Feature                                                        | Status |
| -------------------------------------------------------------- | ------ |
| User auth (register/login/JWT)                                 | ✅     |
| Create / delete documents                                      | ✅     |
| Real-time collaborative editing (Quill + Socket.IO delta sync) | ✅     |
| Autosave with version history (last 20 versions)               | ✅     |
| Version rollback                                               | ✅     |
| Pen/draw signature with Fabric.js                              | ✅     |
| Signature locking + audit trail                                | ✅     |
| Invite by email with role-based access                         | ✅     |
| Live presence (who is online / typing)                         | ✅     |
| Real-time notifications                                        | ✅     |
| File upload (PDF, Word, images) to Cloudinary                  | ✅     |
| Audit log timeline                                             | ✅     |
| Role system: viewer / editor / signer / admin                  | ✅     |

---

## Testing the App

### 1. Register & Login

- Open http://localhost:5173
- Register two accounts (open two browser tabs or use incognito)

### 2. Create a Document

- Click **New doc**, give it a title
- You're taken to the editor

### 3. Real-Time Collaboration

- In the second tab (logged in as user 2), open the same document URL
- Both users should see each other in the **presence bar** (top right)
- Type in one tab — it syncs to the other in real time

### 4. Invite a Collaborator

- Click **Invite** in the top bar
- Enter user 2's email, set role to **editor**
- Or copy the invite link and open it in the second tab

### 5. Sign a Document

- Click the **✏ Draw** icon in the top bar (or **Sign** tab in the side panel)
- Draw a signature with your mouse/stylus
- Click **Apply signature**
- The signature appears in the panel and syncs to all collaborators

### 6. Version History

- Make several edits to the document
- Open the side panel → **Versions** tab
- Click **Restore** on any previous version

### 7. Upload a File

- On the dashboard, click **Upload**
- Drop a PDF or image
- The file is stored in Cloudinary and linked to the document

---

## Common Issues

### `Cannot find module '@strapi/provider-upload-cloudinary'`

```bash
cd backend && npm install @strapi/provider-upload-cloudinary
```

### Port 1337 or 3001 already in use

```bash
# Find and kill the process
lsof -ti:1337 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Socket not connecting

- Confirm terminal 2 shows "Socket.IO server listening on port 3001"
- Check `VITE_SOCKET_URL=http://localhost:3001` in `frontend/.env`

### Strapi permissions errors (403)

- Go to http://localhost:1337/admin → Settings → Users & Permissions → Roles → Authenticated
- Enable all permissions for the `document`, `signature`, `collaborator`, `audit-log` APIs

### Email invites not sending

- Email is **non-fatal** — the invite collaborator record is still created
- Check SMTP credentials in `.env`
- For Gmail: enable 2FA and use an [App Password](https://myaccount.google.com/apppasswords)

---

## Production Deployment Notes

1. Set all `*.env` secrets to strong, unique values
2. Replace SQLite with PostgreSQL (`DATABASE_CLIENT=postgres`)
3. Run Strapi with `npm run build && npm start`
4. Serve the Socket.IO server with PM2 or a process manager
5. Build the frontend: `npm run build` → serve the `dist/` folder
6. Set `FRONTEND_URL` in backend `.env` to your production domain
7. Configure CORS in `config/middlewares.ts` for your domain

---

## Tech Stack

| Layer        | Technology                       |
| ------------ | -------------------------------- |
| Backend API  | Strapi v5 (TypeScript)           |
| Database     | SQLite (dev) / PostgreSQL (prod) |
| File Storage | Cloudinary                       |
| Real-Time    | Socket.IO v4                     |
| Frontend     | React 18 + Vite                  |
| UI           | MUI v7 + Emotion                 |
| State        | Zustand                          |
| Rich Text    | Quill v2                         |
| Signature    | Fabric.js v6                     |
| HTTP Client  | Axios                            |
| Routing      | React Router v6                  |
