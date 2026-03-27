// src/api/signature/routes/signature.ts
export default {
  routes: [
    { method: 'POST', path: '/signatures',                        handler: 'signature.create',         config: { auth: { scope: ['create'] } } },
    { method: 'GET',  path: '/signatures/document/:documentId',   handler: 'signature.findByDocument',  config: { auth: { scope: ['findByDocument'] } } },
  ],
};
