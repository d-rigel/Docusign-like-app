// src/api/collaborator/controllers/collaborator.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::collaborator.collaborator', ({ strapi }) => ({

  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { documentId } = ctx.query as any;

    const doc = await strapi.entityService.findOne('api::document.document', documentId, {
      populate: ['owner', 'collaborators.user'],
    });

    if (!doc) return ctx.notFound();
    const isOwner = (doc as any).owner?.id === user.id;
    const isCollab = (doc as any).collaborators?.some((c: any) => c.user?.id === user.id);
    if (!isOwner && !isCollab) return ctx.forbidden();

    const collabs = await strapi.entityService.findMany('api::collaborator.collaborator', {
      filters: { document: { id: documentId } },
      populate: ['user'],
    });

    return ctx.send({ data: collabs });
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const { role } = ctx.request.body as any;

    const collab = await strapi.entityService.findOne('api::collaborator.collaborator', id, {
      populate: ['document.owner'],
    });

    if (!collab) return ctx.notFound();
    if ((collab as any).document?.owner?.id !== user.id) return ctx.forbidden('Only owner can change roles');

    const updated = await strapi.entityService.update('api::collaborator.collaborator', id, {
      data: { role },
      populate: ['user'],
    });

    return ctx.send({ data: updated });
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const collab = await strapi.entityService.findOne('api::collaborator.collaborator', id, {
      populate: ['document.owner', 'user'],
    });

    if (!collab) return ctx.notFound();

    const isOwner = (collab as any).document?.owner?.id === user.id;
    const isSelf  = (collab as any).user?.id === user.id;
    if (!isOwner && !isSelf) return ctx.forbidden();

    await strapi.entityService.delete('api::collaborator.collaborator', id);
    return ctx.send({ data: { deleted: true } });
  },
}));
