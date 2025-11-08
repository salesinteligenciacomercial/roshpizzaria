import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TagsManagerHook {
  allTags: string[];
  loading: boolean;
  refreshTags: () => Promise<void>;
  addTagToLead: (leadId: string, tag: string) => Promise<void>;
  removeTagFromLead: (leadId: string, tag: string) => Promise<void>;
  getLeadTags: (leadId: string) => Promise<string[]>;
  addStandaloneTag: (tag: string) => Promise<void>;
  removeStandaloneTag: (tag: string) => Promise<void>;
}

let globalTags: string[] = [];
let listeners: Set<() => void> = new Set();

export function useTagsManager(): TagsManagerHook {
  const [allTags, setAllTags] = useState<string[]>(globalTags);
  const [loading, setLoading] = useState(false);

  const notifyListeners = useCallback(() => {
    listeners.forEach(listener => listener());
  }, []);

  const getCompanyKey = (companyId: string) => `crm_custom_tags_${companyId}`;

  const loadCustomTags = (companyId: string): string[] => {
    try {
      if (typeof window === "undefined") return [];
      const raw = window.localStorage.getItem(getCompanyKey(companyId));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const saveCustomTags = (companyId: string, tags: string[]) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(getCompanyKey(companyId), JSON.stringify(tags));
    } catch {
      // ignore
    }
  };

  const refreshTags = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      const { data: leadsData } = await supabase
        .from("leads")
        .select("tags")
        .eq("company_id", userRole.company_id)
        .not("tags", "is", null);

      const tagsSet = new Set<string>();
      leadsData?.forEach(lead => {
        lead.tags?.forEach((tag: string) => tagsSet.add(tag));
      });

      // Merge standalone tags (created via Gerenciar Tags) from localStorage
      const standalone = loadCustomTags(userRole.company_id);
      standalone.forEach((t) => tagsSet.add(t));

      const sortedTags = Array.from(tagsSet).sort();
      globalTags = sortedTags;
      setAllTags(sortedTags);
      notifyListeners();
    } catch (error) {
      console.error("Erro ao carregar tags:", error);
    } finally {
      setLoading(false);
    }
  }, [notifyListeners]);

  const addStandaloneTag = useCallback(async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const companyId = userRole?.company_id;
      if (!companyId) return;

      const current = loadCustomTags(companyId);
      if (!current.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) {
        const next = [...current, trimmed].sort();
        saveCustomTags(companyId, next);
      }

      await refreshTags();
    } catch (error) {
      console.error("Erro ao criar tag independente:", error);
      throw error;
    }
  }, [refreshTags]);

  const removeStandaloneTag = useCallback(async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const companyId = userRole?.company_id;
      if (!companyId) return;

      const current = loadCustomTags(companyId);
      const next = current.filter(t => t.toLowerCase() !== trimmed.toLowerCase());
      saveCustomTags(companyId, next);

      await refreshTags();
    } catch (error) {
      console.error("Erro ao remover tag independente:", error);
      throw error;
    }
  }, [refreshTags]);

  const addTagToLead = useCallback(async (leadId: string, tag: string) => {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("tags, company_id") // 🔒 Incluir company_id na busca
        .eq("id", leadId)
        .single();

      if (!lead) return;

      const currentTags = lead.tags || [];
      if (currentTags.includes(tag)) return;

      const newTags = [...currentTags, tag];

      await supabase
        .from("leads")
        .update({ 
          tags: newTags,
          company_id: lead.company_id // 🔒 Preservar company_id
        })
        .eq("id", leadId);

      await refreshTags();
    } catch (error) {
      console.error("Erro ao adicionar tag:", error);
      throw error;
    }
  }, [refreshTags]);

  const removeTagFromLead = useCallback(async (leadId: string, tag: string) => {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("tags, company_id") // 🔒 Incluir company_id na busca
        .eq("id", leadId)
        .single();

      if (!lead) return;

      const currentTags = lead.tags || [];
      const newTags = currentTags.filter((t: string) => t !== tag);

      await supabase
        .from("leads")
        .update({ 
          tags: newTags.length > 0 ? newTags : null,
          company_id: lead.company_id // 🔒 Preservar company_id
        })
        .eq("id", leadId);

      await refreshTags();
    } catch (error) {
      console.error("Erro ao remover tag:", error);
      throw error;
    }
  }, [refreshTags]);

  const getLeadTags = useCallback(async (leadId: string): Promise<string[]> => {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("tags")
        .eq("id", leadId)
        .single();

      return lead?.tags || [];
    } catch (error) {
      console.error("Erro ao buscar tags do lead:", error);
      return [];
    }
  }, []);

  // Subscribe to changes
  useEffect(() => {
    refreshTags();

    const updateLocalTags = () => {
      setAllTags([...globalTags]);
    };

    listeners.add(updateLocalTags);

    // Listen to realtime changes on leads table
    const channel = supabase
      .channel('tags-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        () => {
          refreshTags();
        }
      )
      .subscribe();

    return () => {
      listeners.delete(updateLocalTags);
      supabase.removeChannel(channel);
    };
  }, [refreshTags]);

  return {
    allTags,
    loading,
    refreshTags,
    addTagToLead,
    removeTagFromLead,
    getLeadTags,
    addStandaloneTag,
    removeStandaloneTag
  };
}
