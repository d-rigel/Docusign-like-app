// src/api/signature/routes/signature.ts
export default {
  routes: [
    {
      method:  'POST',
      path:    '/signatures',
      handler: 'signature.create',
      config:  { policies: [], middlewares: [] },
    },
    {
      method:  'GET',
      path:    '/signatures/document/:documentId',
      handler: 'signature.findbydocument',
      config:  { policies: [], middlewares: [] },
    },
  ],
};



