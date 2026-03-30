// src/index.ts
export default {
  register(/*{ strapi }*/) {},

  /**
   * Bootstrap: enable API permissions for the Authenticated role.
   *
   * Strapi v5 stores permissions differently from v4.
   * This version fetches ALL existing permissions first, then enables
   * the ones we need — avoiding create/update mismatches.
   */
  async bootstrap({ strapi }) {
    try {
      // ── 1. Find the Authenticated role ──────────────────────────────────
      const authRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'authenticated' }, populate: ['permissions'] });

      if (!authRole) {
        strapi.log.warn('[bootstrap] Could not find authenticated role – skipping.');
        return;
      }

      strapi.log.info(`[bootstrap] Found authenticated role id=${authRole.id}`);

      // ── 2. Fetch ALL permissions that belong to this role ────────────────
      const existingPerms = await strapi
        .query('plugin::users-permissions.permission')
        .findMany({ where: { role: { id: authRole.id } } });

      const enabledSet = new Set(
        existingPerms.filter((p: any) => p.enabled).map((p: any) => p.action)
      );
      const allSet = new Set(existingPerms.map((p: any) => p.action));

      strapi.log.info(`[bootstrap] Role has ${existingPerms.length} permissions (${enabledSet.size} enabled)`);

      // ── 3. Actions we want enabled ───────────────────────────────────────
      const wantEnabled = [
        // Documents
        'api::document.document.find',
        'api::document.document.findone',
        'api::document.document.create',
        'api::document.document.update',
        'api::document.document.delete',
        'api::document.document.invite',
        'api::document.document.acceptinvite',
        'api::document.document.versions',
        'api::document.document.rollback',
        // Signatures
        'api::signature.signature.create',
        'api::signature.signature.findbydocument',
        'api::signature.signature.updateposition',
        'api::signature.signature.deletesignature',
        // Collaborators
        'api::collaborator.collaborator.find',
        'api::collaborator.collaborator.update',
        'api::collaborator.collaborator.delete',
        // Audit logs
        'api::audit-log.audit-log.findbydocument',
        // Upload
        'plugin::upload.content-api.upload',
        'plugin::upload.content-api.find',
        'plugin::upload.content-api.findone',
        'plugin::upload.content-api.destroy',
      ];

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const action of wantEnabled) {
        if (enabledSet.has(action)) {
          // Already enabled — nothing to do
          skipped++;
          continue;
        }

        if (allSet.has(action)) {
          // Exists but disabled — enable it
          const perm = existingPerms.find((p: any) => p.action === action);
          await strapi
            .query('plugin::users-permissions.permission')
            .update({ where: { id: perm.id }, data: { enabled: true } });
          updated++;
          strapi.log.info(`[bootstrap] Enabled: ${action}`);
        } else {
          // Doesn't exist — create it
          await strapi
            .query('plugin::users-permissions.permission')
            .create({ data: { action, role: authRole.id, enabled: true } });
          created++;
          strapi.log.info(`[bootstrap] Created: ${action}`);
        }
      }

      strapi.log.info(
        `[bootstrap] Done — created: ${created}, enabled: ${updated}, already-ok: ${skipped}`
      );

    } catch (err: any) {
      strapi.log.warn(
        `[bootstrap] Failed (non-fatal): ${err.message}\n` +
        '  → Fix manually: Admin → Settings → Users & Permissions → Roles → Authenticated'
      );
    }
  },
};



