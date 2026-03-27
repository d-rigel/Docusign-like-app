// config/admin.ts
export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'CHANGE_ME_ADMIN_JWT_SECRET_32_CHARS'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'CHANGE_ME_API_TOKEN_SALT_16_CHARS'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'CHANGE_ME_TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
