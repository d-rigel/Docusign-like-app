// src/api/document/controllers/document.ts
import { factories } from '@strapi/strapi';
import { v4 as uuidv4 } from 'uuid';

export default factories.createCoreController('api::document.document', ({ strapi }) => ({

  // ── List documents accessible to the user ──────────────────────────────────
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    // Own documents
    const ownDocs = await strapi.entityService.findMany('api::document.document', {
      filters: { owner: { id: user.id } },
      populate: ['owner', 'collaborators', 'signatures', 'originalFile'],
      sort: { updatedAt: 'desc' },
    });

    // Collaborator documents
    const collabs = await strapi.entityService.findMany('api::collaborator.collaborator', {
      filters: { user: { id: user.id } },
      populate: ['document.owner', 'document.collaborators', 'document.signatures', 'document.originalFile'],
    });

    const collabDocs = collabs
      .map((c: any) => c.document)
      .filter(Boolean)
      .filter((d: any) => d.owner?.id !== user.id);

    const allDocs = [...ownDocs, ...collabDocs];
    return ctx.send({ data: allDocs });
  },

  // ── Create document ────────────────────────────────────────────────────────
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const { title, content = '', plainContent = '' } = ctx.request.body as any;

    const doc = await strapi.entityService.create('api::document.document', {
      data: {
        title,
        content,
        plainContent,
        status: 'draft',
        owner: user.id,
        inviteToken: uuidv4(),
        versions: JSON.stringify([{
          version: 1,
          content,
          savedAt: new Date().toISOString(),
          savedBy: user.email,
        }]),
        currentVersion: 1,
      },
      populate: ['owner', 'collaborators', 'signatures'],
    });

    // Audit log
    await strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action: 'created',
        actorEmail: user.email,
        actorName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        document: doc.id,
        actor: user.id,
        ipAddress: ctx.request.ip,
      },
    });

    return ctx.send({ data: doc });
  },

  // ── Get single document ────────────────────────────────────────────────────
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const { id } = ctx.params;
    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner', 'collaborators.user', 'signatures.signer', 'originalFile', 'auditLogs.actor'],
    });

    if (!doc) return ctx.notFound('Document not found');

    // Check access
    const isOwner = (doc as any).owner?.id === user.id;
    const isCollaborator = (doc as any).collaborators?.some((c: any) => c.user?.id === user.id);

    if (!isOwner && !isCollaborator && !(doc as any).isPublic) {
      return ctx.forbidden('You do not have access to this document');
    }

    // Audit log view
    await strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action: 'viewed',
        actorEmail: user.email,
        actorName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        document: id,
        actor: user.id,
        ipAddress: ctx.request.ip,
      },
    });

    return ctx.send({ data: doc });
  },

  // ── Update document content (autosave) ────────────────────────────────────
  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const { id } = ctx.params;
    const existing = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner', 'collaborators.user'],
    });

    if (!existing) return ctx.notFound('Document not found');

    const isOwner = (existing as any).owner?.id === user.id;
    const collab = (existing as any).collaborators?.find((c: any) => c.user?.id === user.id);
    const canEdit = isOwner || ['editor', 'admin'].includes(collab?.role);

    if (!canEdit) return ctx.forbidden('You do not have edit permission');

    const { title, content, plainContent, status } = ctx.request.body as any;

    // Build new version snapshot
    const oldVersions = JSON.parse((existing as any).versions || '[]');
    const newVersion = (existing as any).currentVersion + 1;
    const snapshot = {
      version: newVersion,
      content: content || (existing as any).content,
      savedAt: new Date().toISOString(),
      savedBy: user.email,
    };
    // Keep last 20 versions
    const versions = [...oldVersions.slice(-19), snapshot];

    const updated = await strapi.entityService.update('api::document.document', id, {
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(plainContent !== undefined && { plainContent }),
        ...(status !== undefined && { status }),
        versions: JSON.stringify(versions),
        currentVersion: newVersion,
      },
      populate: ['owner', 'collaborators.user', 'signatures'],
    });

    await strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action: 'edited',
        actorEmail: user.email,
        actorName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        document: id,
        actor: user.id,
        metadata: { version: newVersion },
        ipAddress: ctx.request.ip,
      },
    });

    return ctx.send({ data: updated });
  },

  // ── Rollback to a previous version ────────────────────────────────────────
  async rollback(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const { version } = ctx.request.body as any;

    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner', 'collaborators.user'],
    });

    if (!doc) return ctx.notFound();
    const isOwner = (doc as any).owner?.id === user.id;
    const collab = (doc as any).collaborators?.find((c: any) => c.user?.id === user.id);
    const canEdit = isOwner || ['editor', 'admin'].includes(collab?.role);
    if (!canEdit) return ctx.forbidden();

    const versions = JSON.parse((doc as any).versions || '[]');
    const target = versions.find((v: any) => v.version === version);
    if (!target) return ctx.badRequest('Version not found');

    const updated = await strapi.entityService.update('api::document.document', id, {
      data: { content: target.content },
    });

    await strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action: 'rolled_back',
        actorEmail: user.email,
        actorName: user.username,
        document: id,
        actor: user.id,
        metadata: { rolledBackTo: version },
        ipAddress: ctx.request.ip,
      },
    });

    return ctx.send({ data: updated });
  },

  // ── Invite collaborator by email ───────────────────────────────────────────
  async invite(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const { email, role = 'viewer' } = ctx.request.body as any;

    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner', 'collaborators'],
    });

    if (!doc) return ctx.notFound();
    if ((doc as any).owner?.id !== user.id) return ctx.forbidden('Only the owner can invite');

    // Check if already invited
    const existing = await strapi.entityService.findMany('api::collaborator.collaborator', {
      filters: { document: { id }, email },
    });
    if (existing.length > 0) return ctx.badRequest('Already invited');

    const collaborator = await strapi.entityService.create('api::collaborator.collaborator', {
      data: {
        email,
        role,
        status: 'pending',
        document: id,
        invitedAt: new Date().toISOString(),
      },
    });

    // Send email
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${(doc as any).inviteToken}`;
    await (strapi as any).plugin('email')?.service('email')?.send({
      to: email,
      from: process.env.EMAIL_FROM || 'noreply@docucollab.app',
      subject: `${user.username || user.email} invited you to collaborate on "${(doc as any).title}"`,
      html: `
        <h2>You're invited to collaborate!</h2>
        <p><strong>${user.username || user.email}</strong> has invited you to 
        <strong>${role}</strong> the document: <em>${(doc as any).title}</em></p>
        <p><a href="${inviteUrl}" style="background:#1976d2;color:white;padding:12px 24px;border-radius:4px;text-decoration:none;">
          Open Document
        </a></p>
        <p>Or copy this link: ${inviteUrl}</p>
      `,
    }).catch(() => {
      // Email sending failure is non-fatal - log but continue
      strapi.log.warn(`Failed to send invite email to ${email}`);
    });

    await strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action: 'invited',
        actorEmail: user.email,
        actorName: user.username,
        document: id,
        actor: user.id,
        metadata: { invitedEmail: email, role },
        ipAddress: ctx.request.ip,
      },
    });

    return ctx.send({ data: collaborator });
  },

  // ── Accept invite via token ────────────────────────────────────────────────
  async acceptInvite(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { token } = ctx.params;

    const docs = await strapi.entityService.findMany('api::document.document', {
      filters: { inviteToken: token },
      populate: ['owner', 'collaborators'],
    });

    if (!docs || docs.length === 0) return ctx.notFound('Invalid invite link');
    const doc = docs[0] as any;

    // Find pending collab for this email
    const collabs = await strapi.entityService.findMany('api::collaborator.collaborator', {
      filters: { document: { id: doc.id }, email: user.email },
    });

    if (collabs.length === 0) {
      // Auto-add as viewer if public invite
      if (!doc.isPublic) return ctx.forbidden('You were not invited to this document');
      await strapi.entityService.create('api::collaborator.collaborator', {
        data: {
          email: user.email,
          role: 'viewer',
          status: 'accepted',
          document: doc.id,
          user: user.id,
          acceptedAt: new Date().toISOString(),
        },
      });
    } else {
      await strapi.entityService.update('api::collaborator.collaborator', (collabs[0] as any).id, {
        data: { status: 'accepted', user: user.id, acceptedAt: new Date().toISOString() },
      });
    }

    await strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action: 'joined',
        actorEmail: user.email,
        actorName: user.username,
        document: doc.id,
        actor: user.id,
        ipAddress: ctx.request.ip,
      },
    });

    return ctx.send({ data: { documentId: doc.id, title: doc.title } });
  },

  // ── Get version history ────────────────────────────────────────────────────
  async versions(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    const { id } = ctx.params;

    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner', 'collaborators.user'],
    });

    if (!doc) return ctx.notFound();
    const isOwner = (doc as any).owner?.id === user.id;
    const isCollab = (doc as any).collaborators?.some((c: any) => c.user?.id === user.id);
    if (!isOwner && !isCollab) return ctx.forbidden();

    const versions = JSON.parse((doc as any).versions || '[]');
    return ctx.send({ data: versions.reverse() });
  },

  // ── Delete document ────────────────────────────────────────────────────────
  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner'],
    });

    if (!doc) return ctx.notFound();
    if ((doc as any).owner?.id !== user.id) return ctx.forbidden('Only the owner can delete');

    await strapi.entityService.delete('api::document.document', id);
    return ctx.send({ data: { deleted: true } });
  },
}));
