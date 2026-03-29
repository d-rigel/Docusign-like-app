// src/api/signature/routes/signature.ts
export default {
  routes: [
    { method: 'POST', path: '/signatures',                       handler: 'signature.create',         config: { policies: [], middlewares: [] } },
    { method: 'GET',  path: '/signatures/document/:documentId',  handler: 'signature.findbydocument',  config: { policies: [], middlewares: [] } },
    { method: 'PUT',  path: '/signatures/:id/position',          handler: 'signature.updateposition',  config: { policies: [], middlewares: [] } },
  ],
};


