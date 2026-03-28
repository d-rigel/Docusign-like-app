export default {
  routes: [
    { method: 'GET',    path: '/documents',                      handler: 'document.find',         config: { policies: [], middlewares: [] } },
    { method: 'POST',   path: '/documents',                      handler: 'document.create',       config: { policies: [], middlewares: [] } },
    { method: 'POST',   path: '/documents/accept-invite/:token', handler: 'document.acceptinvite', config: { policies: [], middlewares: [] } },
    { method: 'GET',    path: '/documents/:id',                  handler: 'document.findone',      config: { policies: [], middlewares: [] } },
    { method: 'PUT',    path: '/documents/:id',                  handler: 'document.update',       config: { policies: [], middlewares: [] } },
    { method: 'DELETE', path: '/documents/:id',                  handler: 'document.delete',       config: { policies: [], middlewares: [] } },
    { method: 'POST',   path: '/documents/:id/invite',           handler: 'document.invite',       config: { policies: [], middlewares: [] } },
    { method: 'GET',    path: '/documents/:id/versions',         handler: 'document.versions',     config: { policies: [], middlewares: [] } },
    { method: 'POST',   path: '/documents/:id/rollback',         handler: 'document.rollback',     config: { policies: [], middlewares: [] } },
  ],
};



