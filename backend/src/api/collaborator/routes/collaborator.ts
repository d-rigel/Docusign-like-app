// src/api/collaborator/routes/collaborator.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/collaborators',
      handler: 'collaborator.find',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PUT',
      path: '/collaborators/:id',
      handler: 'collaborator.update',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/collaborators/:id',
      handler: 'collaborator.delete',
      config: { policies: [], middlewares: [] },
    },
  ],
};

