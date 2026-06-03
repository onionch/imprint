import { create } from 'zustand';
import type { BadgeTemplate, TemplateSchema, TemplateElement } from '@/types/template';
import { badgeApi } from '@/services/api';

interface TemplateState {
  templates: BadgeTemplate[];
  currentTemplate: BadgeTemplate | null;
  editingSchema: TemplateSchema | null;
  selectedElementId: string | null;
  loading: boolean;
  loadTemplates: () => Promise<void>;
  selectTemplate: (template: BadgeTemplate | null) => void;
  createTemplate: (req: Parameters<typeof badgeApi.createTemplate>[0]) => Promise<BadgeTemplate>;
  updateTemplate: (id: number, req: Parameters<typeof badgeApi.updateTemplate>[1]) => Promise<BadgeTemplate>;
  deleteTemplate: (id: number) => Promise<void>;
  saveSchemaToTemplate: () => Promise<void>;
  setEditingSchema: (schema: TemplateSchema | null) => void;
  setSelectedElementId: (id: string | null) => void;
  updateElement: (elementId: string, updates: Partial<TemplateElement>) => void;
  addElement: (element: TemplateElement) => void;
  removeElement: (elementId: string) => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  currentTemplate: null,
  editingSchema: null,
  selectedElementId: null,
  loading: false,

  loadTemplates: async () => {
    set({ loading: true });
    try {
      const templates = await badgeApi.listTemplates();
      set({ templates, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectTemplate: (template) => {
    set({ currentTemplate: template });
    if (template) {
      try {
        const schema = JSON.parse(template.template_json);
        set({ editingSchema: schema });
      } catch {
        set({ editingSchema: null });
      }
    } else {
      set({ editingSchema: null });
    }
  },

  createTemplate: async (req) => {
    const template = await badgeApi.createTemplate(req);
    set((s) => ({ templates: [...s.templates, template] }));
    return template;
  },

  updateTemplate: async (id, req) => {
    const template = await badgeApi.updateTemplate(id, req);
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? template : t)),
      currentTemplate: s.currentTemplate?.id === id ? template : s.currentTemplate,
    }));
    return template;
  },

  deleteTemplate: async (id) => {
    await badgeApi.deleteTemplate(id);
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id),
      currentTemplate: s.currentTemplate?.id === id ? null : s.currentTemplate,
    }));
  },

  saveSchemaToTemplate: async () => {
    const { currentTemplate, editingSchema } = get();
    if (!currentTemplate || !editingSchema) {
      throw new Error('当前没有可保存的模板');
    }

    const template = await badgeApi.updateTemplate(currentTemplate.id, {
      template_json: JSON.stringify(editingSchema),
      paper_size: currentTemplate.paper_size,
      width_mm: editingSchema.canvas.width_mm,
      height_mm: editingSchema.canvas.height_mm,
    });

    set((s) => ({
      templates: s.templates.map((t) => (t.id === template.id ? template : t)),
      currentTemplate: template,
    }));
  },

  setEditingSchema: (schema) => set({ editingSchema: schema }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  updateElement: (elementId, updates) => {
    const schema = get().editingSchema;
    if (!schema) return;
    const elements = schema.elements.map((el) =>
      el.id === elementId ? { ...el, ...updates } : el
    );
    set({ editingSchema: { ...schema, elements } });
  },

  addElement: (element) => {
    const schema = get().editingSchema;
    if (!schema) return;
    set({ editingSchema: { ...schema, elements: [...schema.elements, element] } });
  },

  removeElement: (elementId) => {
    const schema = get().editingSchema;
    if (!schema) return;
    set({
      editingSchema: { ...schema, elements: schema.elements.filter((el) => el.id !== elementId) },
      selectedElementId: get().selectedElementId === elementId ? null : get().selectedElementId,
    });
  },
}));
