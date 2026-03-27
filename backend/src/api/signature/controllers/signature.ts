// src/api/signature/controllers/signature.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::signature.signature', ({ strapi }) => ({

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { documentId, signatureData, positionX, positionY, pageNumber = 1 } = ctx.request.body as any;

    const doc = await strapi.entityService.findOne('api::document.document', documentId, {
      populate: ['owner', 'collaborators.user'],
    });

    if (!doc) return ctx.notFound('Document not found');

    const isOwner = (doc as any).owner?.id === user.id;
    const collab = (doc as any).collaborators?.find((c: any) => c.user?.id === user.id);
    const canSign = isOwner || ['signer', 'editor', 'admin'].includes(collab?.role);

    if (!canSign) return ctx.forbidden('You do not have signing permission');

    const signature = await strapi.entityService.create('api::signature.signature', {
      data: {
        signatureData,
        signerName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        signerEmail: user.email,
        positionX,
        positionY,
        pageNumber,
        isLocked: true,
        document: documentId,
        signer: user.id,
        ipAddress: ctx.request.ip,
        userAgent: ctx.request.headers['user-agent'],
      },
      populate: ['signer', 'document'],
    });

    await strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action: 'signed',
        actorEmail: user.email,
        actorName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        document: documentId,
        actor: user.id,
        metadata: { signatureId: signature.id, pageNumber, ipAddress: ctx.request.ip },
        ipAddress: ctx.request.ip,
      },
    });

    return ctx.send({ data: signature });
  },

  async findByDocument(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { documentId } = ctx.params;

    const signatures = await strapi.entityService.findMany('api::signature.signature', {
      filters: { document: { id: documentId } },
      populate: ['signer'],
      sort: { createdAt: 'asc' },
    });

    return ctx.send({ data: signatures });
  },
}));
