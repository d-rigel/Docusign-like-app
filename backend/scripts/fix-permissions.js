/**
 * scripts/fix-permissions.js
 *
 * Run ONCE to force-enable all required permissions directly in SQLite.
 * Bypasses any Strapi admin UI / caching issues entirely.
 *
 * Usage (from the backend folder, with Strapi STOPPED):
 *   node scripts/fix-permissions.js
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const dbPath = path.join(__dirname, '..', '.tmp', 'data.db');

if (!fs.existsSync(dbPath)) {
  console.error('Database not found at:', dbPath);
  console.error('Run "npm run dev" at least once first to create it.');
  process.exit(1);
}

console.log('Opening database:', dbPath);
const db = new Database(dbPath);

function getAuthRoleId() {
  const row = db.prepare("SELECT id FROM up_roles WHERE type = 'authenticated' LIMIT 1").get();
  if (!row) throw new Error('No authenticated role found in up_roles table');
  return row.id;
}

function listPermissions(roleId) {
  return db.prepare('SELECT id, action, enabled FROM up_permissions WHERE role = ?').all(roleId);
}

function enablePermission(id) {
  db.prepare('UPDATE up_permissions SET enabled = 1 WHERE id = ?').run(id);
}

function createPermission(action, roleId) {
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO up_permissions (action, role, enabled, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
  ).run(action, roleId, now, now);
}

const REQUIRED = [
  'api::document.document.find',
  'api::document.document.findone',
  'api::document.document.create',
  'api::document.document.update',
  'api::document.document.delete',
  'api::document.document.invite',
  'api::document.document.acceptinvite',
  'api::document.document.versions',
  'api::document.document.rollback',
  'api::signature.signature.create',
  'api::signature.signature.findbydocument',
  'api::collaborator.collaborator.find',
  'api::collaborator.collaborator.update',
  'api::collaborator.collaborator.delete',
  'api::audit-log.audit-log.findbydocument',
  'plugin::upload.content-api.upload',
  'plugin::upload.content-api.find',
  'plugin::upload.content-api.findone',
  'plugin::upload.content-api.destroy',
];

try {
  const roleId = getAuthRoleId();
  console.log('Found authenticated role id=' + roleId);

  const existing   = listPermissions(roleId);
  const byAction   = new Map(existing.map(function(p) { return [p.action, p]; }));

  var created = 0, enabled = 0, ok = 0;

  for (var i = 0; i < REQUIRED.length; i++) {
    var action = REQUIRED[i];
    var perm   = byAction.get(action);

    if (!perm) {
      createPermission(action, roleId);
      console.log('  CREATED : ' + action);
      created++;
    } else if (!perm.enabled) {
      enablePermission(perm.id);
      console.log('  ENABLED : ' + action);
      enabled++;
    } else {
      console.log('  OK      : ' + action);
      ok++;
    }
  }

  console.log('\nDone — created:' + created + '  enabled:' + enabled + '  already-ok:' + ok);
  console.log('\nNow restart Strapi: npm run dev');
  db.close();
} catch(err) {
  console.error('Error:', err.message);
  db.close();
  process.exit(1);
}
