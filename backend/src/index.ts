// src/index.ts
export default {
  /**
   * An asynchronous register function that runs before
   * your application gets registered.
   */
  register(/*{ strapi }*/) {},

  /**
   * Bootstrap: automatically enable API permissions for the Authenticated role.
   * Wrapped in try/catch so a failure here NEVER prevents Strapi from starting.
   * If permissions are missing after startup, enable them manually in:
   *   Admin Panel -> Settings -> Users & Permissions -> Roles -> Authenticated
   */
  async bootstrap({ strapi }) {
    try {
      const authRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'authenticated' } });

      if (!authRole) {
        strapi.log.warn('Could not find authenticated role - skipping permission bootstrap');
        return;
      }

      const authenticatedPermissions = [
        { action: 'api::document.document.find'          },
        { action: 'api::document.document.findone'       },
        { action: 'api::document.document.create'        },
        { action: 'api::document.document.update'        },
        { action: 'api::document.document.delete'        },
        { action: 'api::document.document.invite'        },
        { action: 'api::document.document.acceptinvite'  },
        { action: 'api::document.document.versions'      },
        { action: 'api::document.document.rollback'      },
        { action: 'api::signature.signature.create'          },
        { action: 'api::signature.signature.findbydocument'  },
        { action: 'api::collaborator.collaborator.find'   },
        { action: 'api::collaborator.collaborator.update' },
        { action: 'api::collaborator.collaborator.delete' },
        { action: 'api::audit-log.audit-log.findbydocument' },
        { action: 'plugin::upload.content-api.upload'  },
        { action: 'plugin::upload.content-api.find'    },
        { action: 'plugin::upload.content-api.findone' },
        { action: 'plugin::upload.content-api.destroy' },
      ];

      let created = 0;
      let enabled = 0;

      for (const perm of authenticatedPermissions) {
        try {
          const existing = await strapi
            .query('plugin::users-permissions.permission')
            .findOne({ where: { action: perm.action, role: authRole.id } });

          if (!existing) {
            await strapi
              .query('plugin::users-permissions.permission')
              .create({ data: { ...perm, role: authRole.id, enabled: true } });
            created++;
          } else if (!existing.enabled) {
            await strapi
              .query('plugin::users-permissions.permission')
              .update({ where: { id: existing.id }, data: { enabled: true } });
            enabled++;
          }
        } catch (permErr) {
          strapi.log.warn('Could not set permission for ' + perm.action + ': ' + permErr.message);
        }
      }

      strapi.log.info('Permission bootstrap complete - created: ' + created + ', enabled: ' + enabled);
    } catch (err) {
      strapi.log.warn(
        'Permission bootstrap failed (non-fatal): ' + err.message +
        ' -> Manually enable permissions in Admin -> Settings -> Users & Permissions -> Authenticated'
      );
    }
  },
};
