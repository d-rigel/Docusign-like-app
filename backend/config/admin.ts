// config/admin.ts
export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'CHANGE_ME_ADMIN_JWT_SECRET_32CHARS'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'CHANGE_ME_API_TOKEN_SALT_16CH'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'CHANGE_ME_TRANSFER_TOKEN_SALT'),
    },
  },
  // FIX: add encryptionKey to remove the warning
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY', 'CHANGE_ME_ENCRYPTION_KEY_32CH'),
  },
  flags: {
    nps:       env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});


