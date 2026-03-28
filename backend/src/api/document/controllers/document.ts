// src/api/document/controllers/document.ts
// FIX: Strapi v5 "json" fields store native JS objects — never JSON.stringify/parse them.
// FIX: All method names lowercase to match Strapi v5 permission keys.
import { factories } from '@strapi/strapi';
import { v4 as uuidv4 } from 'uuid';

// Helper: safely get versions array from a document (handles both array and stringified cases)
function getVersions(doc: any): any[] {
  const v = doc?.versions;
  if (!v) return [];
  if (Array.isArray(v)) return v;
  // fallback if somehow stored as string
  try { return JSON.parse(v); } catch { return []; }
}

export default factories.createCoreController('api::document.document', ({ strapi }) => ({

  // ── List all documents accessible to this user ─────────────────────────
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const ownDocs = await strapi.entityService.findMany('api::document.document', {
      filters: { owner: { id: user.id } },
      populate: ['owner', 'collaborators', 'signatures', 'originalFile'],
      sort:    { updatedAt: 'desc' },
    });

    const collabs = await strapi.entityService.findMany('api::collaborator.collaborator', {
      filters: { user: { id: user.id } },
      populate: ['document.owner', 'document.collaborators', 'document.signatures', 'document.originalFile'],
    });

    const collabDocs = collabs
      .map((c: any) => c.document)
      .filter(Boolean)
      .filter((d: any) => d.owner?.id !== user.id);

    return ctx.send({ data: [...ownDocs, ...collabDocs] });
  },

  // ── Get single document ────────────────────────────────────────────────
  async findone(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const { id } = ctx.params;
    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner', 'collaborators.user', 'signatures.signer', 'originalFile', 'auditLogs.actor'],
    });

    if (!doc) return ctx.notFound('Document not found');

    const isOwner  = (doc as any).owner?.id === user.id;
    const isCollab = (doc as any).collaborators?.some((c: any) => c.user?.id === user.id);

    if (!isOwner && !isCollab && !(doc as any).isPublic) {
      return ctx.forbidden('You do not have access to this document');
    }

    // Non-fatal audit log
    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action:    'viewed',
        actorEmail: user.email,
        actorName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        document:  id,
        actor:     user.id,
        ipAddress: ctx.request.ip,
      },
    }).catch(() => {});

    return ctx.send({ data: doc });
  },

  // ── Create document ────────────────────────────────────────────────────
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const { title, content = '', plainContent = '', originalFile } = ctx.request.body as any;

    // FIX: versions is a json field — pass a real array, not a stringified string
    const initialVersions = [{
      version:  1,
      content:  content || '',
      savedAt:  new Date().toISOString(),
      savedBy:  user.email,
    }];

    const doc = await strapi.entityService.create('api::document.document', {
      data: {
        title,
        content:        content || '',
        plainContent:   plainContent || '',
        status:         'draft',
        owner:          user.id,
        inviteToken:    uuidv4(),
        versions:       initialVersions,   // ← native array, not JSON.stringify
        currentVersion: 1,
        ...(originalFile && { originalFile }),
      },
      populate: ['owner', 'collaborators', 'signatures'],
    });

    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action:    'created',
        actorEmail: user.email,
        actorName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        document:  doc.id,
        actor:     user.id,
        ipAddress: ctx.request.ip,
      },
    }).catch(() => {});

    return ctx.send({ data: doc });
  },

  // ── Update / autosave ─────────────────────────────────────────────────
  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const { id } = ctx.params;
    const existing = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner', 'collaborators.user'],
    });

    if (!existing) return ctx.notFound('Document not found');

    const isOwner = (existing as any).owner?.id === user.id;
    const collab  = (existing as any).collaborators?.find((c: any) => c.user?.id === user.id);
    const canEdit = isOwner || ['editor', 'admin'].includes(collab?.role);

    if (!canEdit) return ctx.forbidden('You do not have edit permission');

    const { title, content, plainContent, status } = ctx.request.body as any;

    // FIX: versions is a json field — work with native arrays
    const oldVersions  = getVersions(existing);
    const newVersion   = ((existing as any).currentVersion || 1) + 1;
    const newSnapshot  = {
      version:  newVersion,
      content:  content ?? (existing as any).content ?? '',
      savedAt:  new Date().toISOString(),
      savedBy:  user.email,
    };
    // Keep last 20 versions as a native array
    const versions = [...oldVersions.slice(-19), newSnapshot];

    const updated = await strapi.entityService.update('api::document.document', id, {
      data: {
        ...(title        !== undefined && { title }),
        ...(content      !== undefined && { content }),
        ...(plainContent !== undefined && { plainContent }),
        ...(status       !== undefined && { status }),
        versions,              // ← native array
        currentVersion: newVersion,
      },
      populate: ['owner', 'collaborators.user', 'signatures'],
    });

    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action:    'edited',
        actorEmail: user.email,
        actorName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username,
        document:  id,
        actor:     user.id,
        metadata:  { version: newVersion },
        ipAddress: ctx.request.ip,
      },
    }).catch(() => {});

    return ctx.send({ data: updated });
  },

  // ── Delete ────────────────────────────────────────────────────────────
  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    const { id } = ctx.params;
    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner'],
    });

    if (!doc) return ctx.notFound();
    if ((doc as any).owner?.id !== user.id) return ctx.forbidden('Only the owner can delete');

    await strapi.entityService.delete('api::document.document', id);
    return ctx.send({ data: { deleted: true } });
  },

  // ── Invite collaborator ────────────────────────────────────────────────
  async invite(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const { email, role = 'viewer' } = ctx.request.body as any;

    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner'],
    });

    if (!doc) return ctx.notFound();
    if ((doc as any).owner?.id !== user.id) return ctx.forbidden('Only the owner can invite');

    const existing = await strapi.entityService.findMany('api::collaborator.collaborator', {
      filters: { document: { id }, email },
    });
    if (existing.length > 0) return ctx.badRequest('Already invited');

    const collaborator = await strapi.entityService.create('api::collaborator.collaborator', {
      data: {
        email,
        role,
        status:    'pending',
        document:  id,
        invitedAt: new Date().toISOString(),
      },
    });

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${(doc as any).inviteToken}`;

    try {
      await (strapi as any).plugin('email')?.service('email')?.send({
        to:      email,
        from:    process.env.EMAIL_FROM || 'noreply@docucollab.app',
        subject: `${user.username || user.email} invited you to collaborate on "${(doc as any).title}"`,
        html:    `<h2>You're invited!</h2>
                  <p>${user.username} invited you as <strong>${role}</strong> on <em>${(doc as any).title}</em></p>
                  <p><a href="${inviteUrl}">Open Document</a></p>`,
      });
    } catch {
      strapi.log.warn(`Email invite to ${email} skipped (check SMTP config in .env)`);
    }

    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action:    'invited',
        actorEmail: user.email,
        actorName:  user.username,
        document:  id,
        actor:     user.id,
        metadata:  { invitedEmail: email, role },
        ipAddress: ctx.request.ip,
      },
    }).catch(() => {});

    return ctx.send({ data: collaborator });
  },

  // ── Accept invite via token ────────────────────────────────────────────
  async acceptinvite(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { token } = ctx.params;
    const docs = await strapi.entityService.findMany('api::document.document', {
      filters: { inviteToken: token },
      populate: ['owner'],
    });

    if (!docs || docs.length === 0) return ctx.notFound('Invalid invite link');
    const doc = docs[0] as any;

    const collabs = await strapi.entityService.findMany('api::collaborator.collaborator', {
      filters: { document: { id: doc.id }, email: user.email },
    });

    if (collabs.length === 0) {
      if (!doc.isPublic) return ctx.forbidden('You were not invited to this document');
      await strapi.entityService.create('api::collaborator.collaborator', {
        data: {
          email:      user.email,
          role:       'viewer',
          status:     'accepted',
          document:   doc.id,
          user:       user.id,
          acceptedAt: new Date().toISOString(),
        },
      });
    } else {
      await strapi.entityService.update('api::collaborator.collaborator', (collabs[0] as any).id, {
        data: { status: 'accepted', user: user.id, acceptedAt: new Date().toISOString() },
      });
    }

    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action:    'joined',
        actorEmail: user.email,
        actorName:  user.username,
        document:  doc.id,
        actor:     user.id,
        ipAddress: ctx.request.ip,
      },
    }).catch(() => {});

    return ctx.send({ data: { documentId: doc.id, title: doc.title } });
  },

  // ── Version history ────────────────────────────────────────────────────
  async versions(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const doc = await strapi.entityService.findOne('api::document.document', id, {
      populate: ['owner', 'collaborators.user'],
    });

    if (!doc) return ctx.notFound();
    const isOwner  = (doc as any).owner?.id === user.id;
    const isCollab = (doc as any).collaborators?.some((c: any) => c.user?.id === user.id);
    if (!isOwner && !isCollab) return ctx.forbidden();

    // FIX: versions is a native array from the json field
    const versions = getVersions(doc);
    return ctx.send({ data: [...versions].reverse() });
  },

  // ── Rollback to version ────────────────────────────────────────────────
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
    const collab  = (doc as any).collaborators?.find((c: any) => c.user?.id === user.id);
    const canEdit = isOwner || ['editor', 'admin'].includes(collab?.role);
    if (!canEdit) return ctx.forbidden();

    const versions = getVersions(doc);
    const target   = versions.find((v: any) => v.version === version);
    if (!target) return ctx.badRequest('Version not found');

    const updated = await strapi.entityService.update('api::document.document', id, {
      data: { content: target.content },
    });

    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        action:    'rolled_back',
        actorEmail: user.email,
        actorName:  user.username,
        document:  id,
        actor:     user.id,
        metadata:  { rolledBackTo: version },
        ipAddress: ctx.request.ip,
      },
    }).catch(() => {});

    return ctx.send({ data: updated });
  },
}));



