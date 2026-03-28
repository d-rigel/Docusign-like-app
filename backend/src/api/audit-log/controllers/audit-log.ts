// src/api/audit-log/controllers/audit-log.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::audit-log.audit-log', ({ strapi }) => ({

  // lowercase: findbydocument
  async findbydocument(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    const { documentId } = ctx.params;

    const doc = await strapi.entityService.findOne('api::document.document', documentId, {
      populate: ['owner', 'collaborators.user'],
    });

    if (!doc) return ctx.notFound();
    const isOwner  = (doc as any).owner?.id === user.id;
    const isCollab = (doc as any).collaborators?.some((c: any) => c.user?.id === user.id);
    if (!isOwner && !isCollab) return ctx.forbidden();

    const logs = await strapi.entityService.findMany('api::audit-log.audit-log', {
      filters: { document: { id: documentId } },
      populate: ['actor'],
      sort:     { createdAt: 'desc' },
    });

    return ctx.send({ data: logs });
  },
}));


