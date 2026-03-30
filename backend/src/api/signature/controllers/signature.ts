// src/api/signature/controllers/signature.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::signature.signature', ({ strapi }) => ({

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { documentId, signatureData, positionX, positionY, width, height, pageNumber = 1 } = ctx.request.body as any;

    const doc = await strapi.entityService.findOne('api::document.document', documentId, {
      populate: ['owner', 'collaborators.user'],
    });
    if (!doc) return ctx.notFound('Document not found');

    const isOwner = (doc as any).owner?.id === user.id;
    const collab  = (doc as any).collaborators?.find((c: any) => c.user?.id === user.id);
    const canSign = isOwner || ['signer', 'editor', 'admin'].includes(collab?.role);
    if (!canSign) return ctx.forbidden('You do not have signing permission');

    const signature = await strapi.entityService.create('api::signature.signature', {
      data: {
        signatureData,
        signerName:  `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        signerEmail: user.email,
        positionX:   positionX ?? 50,
        positionY:   positionY ?? 80,
        width:       width     ?? 200,
        height:      height    ?? 80,
        pageNumber,
        isLocked:   true,
        document:   documentId,
        signer:     user.id,
        ipAddress:  ctx.request.ip,
        userAgent:  ctx.request.headers['user-agent'],
      },
      populate: ['signer', 'document'],
    });

    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action:    'signed',
        actorEmail: user.email,
        actorName:  `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        document:  documentId,
        actor:     user.id,
        metadata:  { signatureId: signature.id, pageNumber },
        ipAddress: ctx.request.ip,
      },
    }).catch(() => {});

    return ctx.send({ data: signature });
  },

  // Update position/size — only the original signer can move their own signature
  async updateposition(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const { positionX, positionY, width, height } = ctx.request.body as any;

    const sig = await strapi.entityService.findOne('api::signature.signature', id, {
      populate: ['signer'],
    });
    if (!sig) return ctx.notFound();
    if ((sig as any).signer?.id !== user.id) {
      return ctx.forbidden('Only the signer can reposition their signature');
    }

    const updated = await strapi.entityService.update('api::signature.signature', id, {
      data: {
        ...(positionX !== undefined && { positionX }),
        ...(positionY !== undefined && { positionY }),
        ...(width     !== undefined && { width }),
        ...(height    !== undefined && { height }),
      },
    });

    return ctx.send({ data: updated });
  },

  // Delete — only the original signer can remove their own signature
  async deletesignature(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;

    const sig = await strapi.entityService.findOne('api::signature.signature', id, {
      populate: ['signer', 'document'],
    });
    if (!sig) return ctx.notFound();

    // Only the signer themselves (or document owner) can delete a signature
    const isOwnSig    = (sig as any).signer?.id === user.id;
    const docOwnerId  = (sig as any).document?.owner?.id;

    // Fetch doc owner if not populated
    let isDocOwner = false;
    if (!docOwnerId && (sig as any).document?.id) {
      const doc = await strapi.entityService.findOne('api::document.document', (sig as any).document.id, {
        populate: ['owner'],
      });
      isDocOwner = (doc as any)?.owner?.id === user.id;
    } else {
      isDocOwner = docOwnerId === user.id;
    }

    if (!isOwnSig && !isDocOwner) {
      return ctx.forbidden('Only the signer or document owner can remove a signature');
    }

    await strapi.entityService.delete('api::signature.signature', id);

    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action:    'edited',
        actorEmail: user.email,
        actorName:  user.username,
        document:  (sig as any).document?.id,
        actor:     user.id,
        metadata:  { deletedSignatureId: id },
        ipAddress: ctx.request.ip,
      },
    }).catch(() => {});

    return ctx.send({ data: { deleted: true, id } });
  },

  async findbydocument(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    const { documentId } = ctx.params;

    const signatures = await strapi.entityService.findMany('api::signature.signature', {
      filters: { document: { id: documentId } },
      populate: ['signer'],
      sort:     { createdAt: 'asc' },
    });

    return ctx.send({ data: signatures });
  },
}));

