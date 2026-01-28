import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Plus, X, Users, CalendarIcon, MessageCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTagsManager } from "@/hooks/useTagsManager";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, isToday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TagStats {
  tag: string;
  count: number;
  leads: Array<{ id: string; name: string }>;
}

interface TagHistoryItem {
  id: string;
  tag_name: string;
  action: string;
  created_at: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
    telefone: string | null;
    profile_picture_url: string | null;
  } | null;
}

interface MessageItem {
  id: string;
  mensagem: string;
  created_at: string;
  nome_contato: string | null;
  telefone_formatado: string | null;
  lead: {
    id: string;
    name: string;
    tags: string[] | null;
  } | null;
}

interface TagsManagerProps {
  onTagSelected?: (tag: string | null) => void;
  selectedTag?: string | null;
}

type DateFilter = "today" | "week" | "custom" | null;

export function TagsManager({ onTagSelected, selectedTag }: TagsManagerProps) {
  const [open, setOpen] = useState(false);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);
  const { addStandaloneTag, removeStandaloneTag, allTags } = useTagsManager();

  // Date filtering state
  const [dateFilter, setDateFilter] = useState<DateFilter>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Tab data
  const [activeTab, setActiveTab] = useState("tags");
  const [tagHistory, setTagHistory] = useState<TagHistoryItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Stats for filtered period
  const [filteredTagsCount, setFilteredTagsCount] = useState(0);
  const [filteredMessagesCount, setFilteredMessagesCount] = useState(0);

  useEffect(() => {
    if (open) {
      loadTagStats();
    }
  }, [open]);

  // Load filtered data when date changes
  useEffect(() => {
    if (open && dateFilter) {
      const { start, end } = getDateRange();
      if (start && end) {
        loadTagHistory(start, end);
        loadMessages(start, end);
      }
    }
  }, [open, dateFilter, selectedDate]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (dateFilter) {
      case "today":
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case "week":
        start = startOfWeek(now, { weekStartsOn: 0 });
        end = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case "custom":
        if (selectedDate) {
          start = startOfDay(selectedDate);
          end = endOfDay(selectedDate);
        }
        break;
    }

    return { start, end };
  }, [dateFilter, selectedDate]);

  const loadTagStats = async () => {
    setLoading(true);
    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("id, name, tags")
        .not("tags", "is", null);

      if (error) throw error;

      const tagsMap = new Map<string, { count: number; leads: Array<{ id: string; name: string }> }>();

      leads?.forEach((lead) => {
        if (lead.tags && Array.isArray(lead.tags)) {
          lead.tags.forEach((tag) => {
            if (!tagsMap.has(tag)) {
              tagsMap.set(tag, { count: 0, leads: [] });
            }
            const tagData = tagsMap.get(tag)!;
            tagData.count++;
            tagData.leads.push({ id: lead.id, name: lead.name });
          });
        }
      });

      let stats: TagStats[] = Array.from(tagsMap.entries())
        .map(([tag, data]) => ({
          tag,
          count: data.count,
          leads: data.leads,
        }))
        .sort((a, b) => b.count - a.count);

      const known = new Set(stats.map(s => s.tag.toLowerCase()));
      allTags.forEach((t) => {
        if (!known.has(t.toLowerCase())) {
          stats.push({ tag: t, count: 0, leads: [] });
        }
      });
      stats = stats.sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));

      setTagStats(stats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas de tags:", error);
      toast.error("Erro ao carregar tags");
    } finally {
      setLoading(false);
    }
  };

  const loadTagHistory = async (start: Date, end: Date) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("lead_tag_history")
        .select(`
          id,
          tag_name,
          action,
          created_at,
          lead:leads(id, name, phone, telefone, profile_picture_url)
        `)
        .eq("action", "added")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTagHistory(data as TagHistoryItem[] || []);
      setFilteredTagsCount(data?.length || 0);
    } catch (error) {
      console.error("Erro ao carregar histórico de tags:", error);
      setTagHistory([]);
      setFilteredTagsCount(0);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadMessages = async (start: Date, end: Date) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("conversas")
        .select(`
          id,
          mensagem,
          created_at,
          nome_contato,
          telefone_formatado,
          lead:leads(id, name, tags)
        `)
        .eq("fromme", false)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get unique contacts
      const uniqueContacts = new Map<string, MessageItem>();
      (data || []).forEach((msg) => {
        const key = msg.telefone_formatado || msg.nome_contato || msg.id;
        if (!uniqueContacts.has(key)) {
          uniqueContacts.set(key, msg as MessageItem);
        }
      });

      setMessages(Array.from(uniqueContacts.values()));
      setFilteredMessagesCount(uniqueContacts.size);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      setMessages([]);
      setFilteredMessagesCount(0);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDateFilterChange = (filter: DateFilter) => {
    if (filter === dateFilter && filter !== "custom") {
      setDateFilter(null);
      setSelectedDate(undefined);
      setTagHistory([]);
      setMessages([]);
      setFilteredTagsCount(0);
      setFilteredMessagesCount(0);
    } else {
      setDateFilter(filter);
      if (filter === "today") {
        setSelectedDate(new Date());
      } else if (filter === "custom") {
        setCalendarOpen(true);
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setCalendarOpen(false);
    if (date) {
      setDateFilter("custom");
    }
  };

  const createAndAssignTag = async () => {
    if (!newTagName.trim()) {
      toast.error("Digite um nome para a tag");
      return;
    }

    const tagName = newTagName.trim();

    if (tagStats.some((stat) => stat.tag.toLowerCase() === tagName.toLowerCase())) {
      toast.error("Esta tag já existe");
      return;
    }

    try {
      await addStandaloneTag(tagName);

      setTagStats((prev) => {
        const exists = prev.some(s => s.tag.toLowerCase() === tagName.toLowerCase());
        if (exists) return prev;
        const next = [...prev, { tag: tagName, count: 0, leads: [] }];
        return next.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
      });

      setNewTagName("");
      toast.success(`Tag "${tagName}" criada com sucesso`);
    } catch (e) {
      console.error("Erro ao criar tag:", e);
      toast.error("Erro ao criar tag");
    }
  };

  const deleteTag = async (tagToDelete: string) => {
    try {
      const { data: leads, error: fetchError } = await supabase
        .from("leads")
        .select("id, tags")
        .contains("tags", [tagToDelete]);

      if (fetchError) throw fetchError;

      if (!leads || leads.length === 0) {
        await removeStandaloneTag(tagToDelete);
        setTagStats(prev => prev.filter(s => s.tag.toLowerCase() !== tagToDelete.toLowerCase()));
        toast.success("Tag removida com sucesso");
        return;
      }

      for (const lead of leads) {
        const newTags = lead.tags?.filter((tag) => tag !== tagToDelete) || [];
        
        const { error: updateError } = await supabase
          .from("leads")
          .update({ tags: newTags.length > 0 ? newTags : null })
          .eq("id", lead.id);

        if (updateError) throw updateError;
      }

      await removeStandaloneTag(tagToDelete);

      toast.success(`Tag "${tagToDelete}" removida de ${leads.length} lead(s)`);
      setTagStats(prev => prev.filter(s => s.tag.toLowerCase() !== tagToDelete.toLowerCase()));
      
      if (selectedTag === tagToDelete && onTagSelected) {
        onTagSelected(null);
      }
    } catch (error) {
      console.error("Erro ao deletar tag:", error);
      toast.error("Erro ao remover tag");
    }
  };

  const handleTagClick = (tag: string) => {
    if (onTagSelected) {
      onTagSelected(selectedTag === tag ? null : tag);
      setOpen(false);
    }
  };

  const totalLeadsWithTags = new Set(tagStats.flatMap((stat) => stat.leads.map((l) => l.id))).size;

  const getDateFilterLabel = () => {
    if (!dateFilter) return null;
    if (dateFilter === "today") return "Hoje";
    if (dateFilter === "week") return "Esta Semana";
    if (dateFilter === "custom" && selectedDate) {
      return format(selectedDate, "dd/MM/yyyy", { locale: ptBR });
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Tag className="h-4 w-4" />
          Gerenciar Tags
          {selectedTag && (
            <Badge variant="secondary" className="ml-1">
              {selectedTag}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Gerenciamento de Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new tag */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da nova tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      createAndAssignTag();
                    }
                  }}
                />
                <Button onClick={createAndAssignTag}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Tag
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Date filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtrar por data:</span>
            <Button
              variant={dateFilter === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => handleDateFilterChange("today")}
            >
              Hoje
            </Button>
            <Button
              variant={dateFilter === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => handleDateFilterChange("week")}
            >
              Esta Semana
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={dateFilter === "custom" ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                  onClick={() => handleDateFilterChange("custom")}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {dateFilter === "custom" && selectedDate
                    ? format(selectedDate, "dd/MM", { locale: ptBR })
                    : "Selecionar Data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleCalendarSelect}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {dateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFilter(null);
                  setSelectedDate(undefined);
                  setTagHistory([]);
                  setMessages([]);
                }}
              >
                <X className="h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{tagStats.length}</div>
                  <div className="text-sm text-muted-foreground">Tags Criadas</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {dateFilter ? filteredTagsCount : totalLeadsWithTags}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dateFilter ? "Tags Atribuídas" : "Leads com Tags"}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {dateFilter ? filteredMessagesCount : tagStats.reduce((sum, stat) => sum + stat.count, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dateFilter ? "Mensagens Recebidas" : "Total de Atribuições"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tags" className="gap-1">
                <Tag className="h-4 w-4" />
                Tags Cadastradas
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1" disabled={!dateFilter}>
                <Clock className="h-4 w-4" />
                Tags Atribuídas
                {dateFilter && filteredTagsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{filteredTagsCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1" disabled={!dateFilter}>
                <MessageCircle className="h-4 w-4" />
                Mensagens
                {dateFilter && filteredMessagesCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{filteredMessagesCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tags List */}
            <TabsContent value="tags" className="mt-4">
              <ScrollArea className="h-[280px]">
                <div className="space-y-2">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : tagStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma tag cadastrada ainda
                    </div>
                  ) : (
                    tagStats.map((stat) => (
                      <Card
                        key={stat.tag}
                        className={`transition-all hover:shadow-md cursor-pointer ${
                          selectedTag === stat.tag ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => handleTagClick(stat.tag)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Badge variant="secondary" className="gap-1">
                                <Tag className="h-3 w-3" />
                                {stat.tag}
                              </Badge>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span>{stat.count} lead(s)</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTag(stat.tag);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {stat.leads.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {stat.leads.slice(0, 3).map((lead) => (
                                <Badge key={lead.id} variant="outline" className="text-xs">
                                  {lead.name}
                                </Badge>
                              ))}
                              {stat.leads.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{stat.leads.length - 3} mais
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tag History */}
            <TabsContent value="history" className="mt-4">
              {!dateFilter ? (
                <div className="text-center py-8 text-muted-foreground">
                  Selecione uma data para ver as tags atribuídas
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {loadingHistory ? (
                      <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                    ) : tagHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma tag atribuída {getDateFilterLabel()?.toLowerCase()}
                      </div>
                    ) : (
                      tagHistory.map((item) => (
                        <Card key={item.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="gap-1">
                                  <Tag className="h-3 w-3" />
                                  {item.tag_name}
                                </Badge>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">
                                    {item.lead?.name || "Lead removido"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {item.lead?.phone || item.lead?.telefone || ""}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* Messages */}
            <TabsContent value="messages" className="mt-4">
              {!dateFilter ? (
                <div className="text-center py-8 text-muted-foreground">
                  Selecione uma data para ver as mensagens recebidas
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {loadingMessages ? (
                      <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma mensagem recebida {getDateFilterLabel()?.toLowerCase()}
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <Card key={msg.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">
                                  {msg.nome_contato || msg.lead?.name || msg.telefone_formatado || "Contato"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {msg.telefone_formatado || ""}
                                </span>
                                {msg.lead?.tags && msg.lead.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {msg.lead.tags.slice(0, 3).map((tag) => (
                                      <Badge key={tag} variant="outline" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                              {msg.mensagem}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
