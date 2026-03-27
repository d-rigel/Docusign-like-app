// src/api/audit-log/routes/audit-log.ts
export default {
  routes: [
    { method: 'GET', path: '/audit-logs/document/:documentId', handler: 'audit-log.findByDocument', config: { auth: { scope: ['findByDocument'] } } },
  ],
};
