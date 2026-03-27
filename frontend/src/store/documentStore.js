// src/store/documentStore.js
import { create } from 'zustand';
import { documentsAPI, signaturesAPI, collaboratorsAPI, auditAPI } from '../services/api';

const useDocumentStore = create((set, get) => ({
  documents:     [],
  currentDoc:    null,
  signatures:    [],
  collaborators: [],
  auditLogs:     [],
  versions:      [],
  isLoading:     false,
  error:         null,

  // ── Fetch all documents ─────────────────────────────────────────────────
  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await documentsAPI.list();
      set({ documents: res.data.data || [], isLoading: false });
    } catch (e) {
      set({ error: e.message, isLoading: false });
    }
  },

  // ── Fetch single document ───────────────────────────────────────────────
  fetchDocument: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const [docRes, sigRes, collabRes] = await Promise.all([
        documentsAPI.get(id),
        signaturesAPI.byDocument(id),
        collaboratorsAPI.byDocument(id),
      ]);
      set({
        currentDoc:    docRes.data.data,
        signatures:    sigRes.data.data   || [],
        collaborators: collabRes.data.data || [],
        isLoading:     false,
      });
      return docRes.data.data;
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  // ── Create document ─────────────────────────────────────────────────────
  createDocument: async (data) => {
    const res = await documentsAPI.create(data);
    const doc = res.data.data;
    set((s) => ({ documents: [doc, ...s.documents] }));
    return doc;
  },

  // ── Update document ─────────────────────────────────────────────────────
  updateDocument: async (id, data) => {
    const res = await documentsAPI.update(id, data);
    const doc = res.data.data;
    set((s) => ({
      currentDoc: s.currentDoc?.id === id ? doc : s.currentDoc,
      documents:  s.documents.map((d) => (d.id === id ? doc : d)),
    }));
    return doc;
  },

  // ── Set current doc content locally (for real-time) ────────────────────
  setCurrentDocContent: (content) =>
    set((s) => ({ currentDoc: s.currentDoc ? { ...s.currentDoc, content } : s.currentDoc })),

  // ── Delete document ─────────────────────────────────────────────────────
  deleteDocument: async (id) => {
    await documentsAPI.delete(id);
    set((s) => ({
      documents:  s.documents.filter((d) => d.id !== id),
      currentDoc: s.currentDoc?.id === id ? null : s.currentDoc,
    }));
  },

  // ── Add signature locally (from socket) ────────────────────────────────
  addSignatureLocally: (sig) =>
    set((s) => ({ signatures: [...s.signatures, sig] })),

  // ── Fetch versions ──────────────────────────────────────────────────────
  fetchVersions: async (id) => {
    const res = await documentsAPI.versions(id);
    set({ versions: res.data.data || [] });
  },

  // ── Rollback ────────────────────────────────────────────────────────────
  rollbackVersion: async (id, version) => {
    const res = await documentsAPI.rollback(id, version);
    set((s) => ({
      currentDoc: s.currentDoc?.id === id ? res.data.data : s.currentDoc,
    }));
    return res.data.data;
  },

  // ── Fetch audit logs ────────────────────────────────────────────────────
  fetchAuditLogs: async (id) => {
    const res = await auditAPI.byDocument(id);
    set({ auditLogs: res.data.data || [] });
  },

  clearCurrent: () => set({ currentDoc: null, signatures: [], collaborators: [], auditLogs: [], versions: [] }),
}));

export default useDocumentStore;
