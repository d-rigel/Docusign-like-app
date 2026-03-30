# DocuCollab — Collaborative Document Editing & Signing

A full-stack mini Google Docs + DocuSign application. Upload or create documents, edit them collaboratively in real time, draw and place signatures, and track every action with a full audit trail.

---

## Tech Stack

| Layer             | Technology                                     |
| ----------------- | ---------------------------------------------- |
| Backend API       | Strapi v5 (TypeScript, CommonJS)               |
| Database          | SQLite (development) / PostgreSQL (production) |
| File Storage      | Cloudinary                                     |
| Real-Time         | Socket.IO v4 (standalone server)               |
| Frontend          | React 18 + Vite                                |
| UI                | Material UI v7                                 |
| State             | Zustand                                        |
| Rich Text Editor  | Quill v2                                       |
| Signature Drawing | Native HTML5 Canvas                            |
| File Parsing      | pdf-parse, pdfjs-dist, mammoth, tesseract.js   |
| HTTP Client       | Axios                                          |

---

## Project Structure

```
docusign-app/
├── backend/                  # Strapi v5 API + Socket.IO server
│   ├── config/               # server, database, middlewares, plugins, admin
│   ├── src/
│   │   ├── api/
│   │   │   ├── document/     # CRUD, versioning, invite, file parsing
│   │   │   ├── signature/    # Create, position, delete signatures
│   │   │   ├── collaborator/ # Team management
│   │   │   └── audit-log/    # Activity trail
│   │   ├── socket/
│   │   │   └── server.js     # Standalone Socket.IO server (port 3001)
│   │   └── index.ts          # Bootstrap — auto-configures permissions
│   ├── public/
│   │   └── favicon.png
│   └── .env.example
└── frontend/                 # React + Vite app
    ├── src/
    │   ├── pages/            # Login, Register, Dashboard, Editor, Invite
    │   ├── components/
    │   │   ├── editor/       # Quill collaborative editor, presence bar
    │   │   ├── signature/    # Draw panel, draggable overlay
    │   │   └── documents/    # Panels for team, versions, audit, invite
    │   ├── store/            # Zustand stores (auth, documents)
    │   └── services/         # Axios API + Socket.IO client
    └── .env.example
```

---

## Prerequisites

- **Node.js** v20–v24 (required by Strapi v5)
- **npm** ≥ 6
- A free [Cloudinary](https://cloudinary.com) account
- (Optional) Gmail app password or SMTP credentials for email invites

---

## Step 1 — Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
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

Open `backend/.env` and fill in every value:

```env
# ── Server ───────────────────────────────────────────────────────────────
HOST=0.0.0.0
PORT=1337
SOCKET_PORT=3001
FRONTEND_URL=http://localhost:5173

# ── Strapi secrets (generate each with the command below) ────────────────
APP_KEYS=key1,key2
ADMIN_JWT_SECRET=
API_TOKEN_SALT=
TRANSFER_TOKEN_SALT=
JWT_SECRET=
ENCRYPTION_KEY=

# ── Cloudinary ────────────────────────────────────────────────────────────
CLOUDINARY_NAME=
CLOUDINARY_KEY=
CLOUDINARY_SECRET=

# ── Email / SMTP (optional — invites work without it) ────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_app_password
EMAIL_FROM=your@email.com
```

**Generate secrets** — run this once for each secret field:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Cloudinary credentials** → https://cloudinary.com/console (free account, no credit card)

**Gmail app password** → https://myaccount.google.com/apppasswords (requires 2FA enabled)

### Frontend

```bash
cd frontend
cp .env.example .env
```

The defaults work for local development:

```env
VITE_API_URL=http://localhost:1337
VITE_SOCKET_URL=http://localhost:3001
```

---

## Step 3 — Run the App

You need **three terminal windows running simultaneously**:

### Terminal 1 — Strapi Backend (port 1337)

```bash
cd backend
npm run dev
```

### To start all services (frontend, backend and socket server) at once

In the root of the app, use

```bash
 ./start.sh
```

Wait until you see:

```
✔ Strapi started successfully
┌──────────────────────────────────────┐
│ http://localhost:1337/admin          │
└──────────────────────────────────────┘
```

### Terminal 2 — Socket.IO Server (port 3001)

```bash
cd backend
node src/socket/server.js
```

You should see:

```
🔌 Socket.IO server listening on port 3001
```

### Terminal 3 — React Frontend (port 5173)

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Step 4 — First-Time Strapi Setup

1. Open **http://localhost:1337/admin**
2. Create your admin account (first run only)
3. Permissions are **auto-configured on startup** via `src/index.ts`

### If auto-configuration didn't work (you see 403 errors):

Go to **Admin → Settings → Users & Permissions Plugin → Roles → Authenticated**

Enable every checkbox under each of these sections, then click **Save**:

#### Document

| Permission     | Description                                  |
| -------------- | -------------------------------------------- |
| `find`         | List user's documents                        |
| `findone`      | Open a single document                       |
| `create`       | Create a new document                        |
| `update`       | Save / autosave edits                        |
| `delete`       | Delete a document                            |
| `invite`       | Invite a collaborator by email               |
| `acceptinvite` | Accept an invite link                        |
| `versions`     | View version history                         |
| `rollback`     | Restore a previous version                   |
| `parsefile`    | Extract content from uploaded PDF/Word/image |

#### Signature

| Permission        | Description                    |
| ----------------- | ------------------------------ |
| `create`          | Place a new signature          |
| `findbydocument`  | Load signatures for a document |
| `updateposition`  | Drag/resize a signature        |
| `deletesignature` | Remove a signature             |

#### Collaborator

| Permission | Description                  |
| ---------- | ---------------------------- |
| `find`     | List collaborators           |
| `update`   | Change a collaborator's role |
| `delete`   | Remove a collaborator        |

#### Audit-log

| Permission       | Description             |
| ---------------- | ----------------------- |
| `findbydocument` | View the activity trail |

#### Upload (under Plugins section)

| Permission | Description                |
| ---------- | -------------------------- |
| `upload`   | Upload files to Cloudinary |
| `find`     | Browse uploaded files      |
| `findone`  | Fetch a single file        |
| `destroy`  | Delete an uploaded file    |

---

## Features

### Authentication

- Register and log in with email/password
- JWT-based session stored in localStorage
- Auto-redirect to login on session expiry

### Document Management

- Create blank documents from the dashboard
- Upload PDF, Word (.doc/.docx), images (PNG/JPG/WebP), plain text — stored in Cloudinary
- Delete documents (owner only)
- Search documents by title on the dashboard

### Real-Time Collaborative Editing

- Multiple users can edit the same document simultaneously
- Edits sync instantly using Socket.IO delta broadcasting (Quill OT)
- Presence bar shows all online collaborators with colour-coded avatars
- Typing indicator shows when someone is actively writing
- Autosave triggers 3 seconds after the last keystroke
- Manual save with **Ctrl+S** / **Cmd+S**

### File-to-Editor Import

When a file is uploaded, click **"Load into editor"** in the attachment bar:

- **Digital PDF** → text extracted by `pdf-parse`, loaded as editable paragraphs
- **Scanned PDF** → pages rendered to images by `pdfjs-dist`, OCR via `tesseract.js`
- **Word .docx** → converted to formatted HTML by `mammoth`
- **Images** → OCR via `tesseract.js` + inline preview
- **Plain text** → loaded as paragraphs
- Extracted content is fully editable and autosaved immediately

### Signatures

- Draw a freehand signature using mouse or touchscreen
- Size slider (80–400px) to choose signature size before placing
- Click **Place on document** to add the signature to the document canvas
- **Drag** any placed signature to reposition it anywhere on the page
- **Resize** by dragging the square handle in the bottom-right corner
- **Delete** by clicking the signature to select it, then clicking the red ✕ button
- All signatures are locked with signer name, email, timestamp, and IP address
- Only the original signer can move, resize, or delete their own signature
- Signatures sync in real time to all collaborators via Socket.IO

### Access Control & Collaboration

- **Invite by email** — owner sends email invite with a role
- **Share link** — copy/paste the invite URL for instant access
- Four roles:
  - `viewer` — read-only access
  - `editor` — can edit text
  - `signer` — can sign but not edit text
  - `admin` — full access including inviting others
- Owner can change roles and remove collaborators from the Team panel

### Version History

- Every save creates a new version snapshot (last 20 kept)
- Versions panel shows timestamp and author for each version
- One-click **Restore** to roll back to any previous version

### Audit Trail

- Every action is logged: created, viewed, edited, signed, invited, joined, rolled back
- Timeline view in the Audit panel with actor, action, and timestamp

### Notifications

- Real-time slide-in toasts when a collaborator joins, leaves, or signs

---

## Testing the App

### 1. Register two accounts

Open **http://localhost:5173/register** in a normal window and an incognito window to create two separate users.

### 2. Create a document

Log in as User 1 → click **New doc** → enter a title → you're taken to the editor.

### 3. Test real-time collaboration

- Copy the document URL
- In the incognito window (User 2), open the same URL
- **User 1 must invite User 2 first**: click **Invite**, enter User 2's email, set role to `editor`
- User 2 accepts the invite link
- Both users should now see each other in the presence bar
- Type in one window — text appears live in the other

### 4. Test signatures

- Open the **Sign** tab (right panel) or click the ✏ icon in the top bar
- Draw a signature with your mouse
- Use the size slider to adjust size
- Click **Place on document**
- The signature appears on the document — drag it to reposition, resize with the corner handle
- Click the signature to select it → red ✕ button appears to delete it

### 5. Upload and parse a file

- On the dashboard, click **Upload**
- Drop a PDF or Word file
- In the editor, click **Load into editor** in the grey bar at the top
- The file content is extracted and loaded into Quill as editable text

### 6. Version history

- Make several edits (each autosave creates a version)
- Open the **Versions** tab → click **Restore** on an older version

---

## Common Issues

| Problem                           | Fix                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `403 Forbidden` on any API call   | Go to Strapi Admin → Settings → Users & Permissions → Authenticated → enable all listed permissions → Save |
| `ENOENT: favicon.png` in terminal | Copy `backend/public/favicon.png` — it's included in the project                                           |
| Socket not connecting             | Make sure Terminal 2 is running: `node src/socket/server.js`                                               |
| Upload fails with 401             | Check `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET` in `backend/.env`                           |
| "Load into editor" fails          | Install parsing dependencies: `cd backend && npm install pdf-parse pdfjs-dist mammoth tesseract.js`        |
| Autosave 500 error                | Restart Strapi — the `versions` JSON field may need a fresh migration                                      |
| Double toolbar in editor          | Make sure you replaced `main.jsx` — `React.StrictMode` must be removed                                     |
| Permissions lost after restart    | The bootstrap in `src/index.ts` re-applies them on every start                                             |

---

## Production Notes

1. Replace all secret values in `.env` with strong random strings
2. Switch `DATABASE_CLIENT` from `sqlite` to `postgres` and add database credentials
3. Build Strapi: `cd backend && npm run build && npm start`
4. Build the frontend: `cd frontend && npm run build` → serve the `dist/` folder
5. Run the Socket.IO server with a process manager (PM2, systemd)
6. Set `FRONTEND_URL` in `backend/.env` to your production domain
7. Update CORS origins in `backend/config/middlewares.ts`
