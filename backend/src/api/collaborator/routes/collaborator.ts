// src/api/collaborator/routes/collaborator.ts
export default {
  routes: [
    { method: 'GET',    path: '/collaborators',     handler: 'collaborator.find',     config: { auth: { scope: ['find'] } } },
    { method: 'DELETE', path: '/collaborators/:id', handler: 'collaborator.delete',   config: { auth: { scope: ['delete'] } } },
    { method: 'PUT',    path: '/collaborators/:id', handler: 'collaborator.update',   config: { auth: { scope: ['update'] } } },
  ],
};
