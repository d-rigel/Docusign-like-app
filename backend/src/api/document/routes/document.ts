// src/api/document/routes/document.ts
export default {
  routes: [
    { method: 'GET',    path: '/documents',                        handler: 'document.find',         config: { auth: { scope: ['find'] } } },
    { method: 'POST',   path: '/documents',                        handler: 'document.create',       config: { auth: { scope: ['create'] } } },
    { method: 'GET',    path: '/documents/:id',                    handler: 'document.findOne',      config: { auth: { scope: ['findOne'] } } },
    { method: 'PUT',    path: '/documents/:id',                    handler: 'document.update',       config: { auth: { scope: ['update'] } } },
    { method: 'DELETE', path: '/documents/:id',                    handler: 'document.delete',       config: { auth: { scope: ['delete'] } } },
    { method: 'POST',   path: '/documents/:id/invite',             handler: 'document.invite',       config: { auth: { scope: ['invite'] } } },
    { method: 'POST',   path: '/documents/accept-invite/:token',   handler: 'document.acceptInvite', config: { auth: { scope: ['acceptInvite'] } } },
    { method: 'GET',    path: '/documents/:id/versions',           handler: 'document.versions',     config: { auth: { scope: ['versions'] } } },
    { method: 'POST',   path: '/documents/:id/rollback',           handler: 'document.rollback',     config: { auth: { scope: ['rollback'] } } },
  ],
};
