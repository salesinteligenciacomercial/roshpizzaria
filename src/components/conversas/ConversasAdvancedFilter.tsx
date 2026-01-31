import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Filter, 
  Tag, 
  User, 
  DollarSign, 
  TrendingUp, 
  Package, 
  Calendar as CalendarIcon,
  Thermometer,
  CheckCircle2,
  X,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

export interface AdvancedFilters {
  tags: string[];
  responsaveis: string[];
  comValor: boolean | null; // true = com valor, false = sem valor, null = todos
  funilId: string | null;
  etapaId: string | null;
  produtos: string[];
  dataInicio: Date | null;
  dataFim: Date | null;
  temperatura: string | null; // 'quente' | 'morno' | 'frio' | null
  statusVenda: string | null; // 'em_negociacao' | 'ganho' | 'perdido' | null
}

interface ConversasAdvancedFilterProps {
  companyId: string | null;
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  allTags: string[];
}

const defaultFilters: AdvancedFilters = {
  tags: [],
  responsaveis: [],
  comValor: null,
  funilId: null,
  etapaId: null,
  produtos: [],
  dataInicio: null,
  dataFim: null,
  temperatura: null,
  statusVenda: null
};

export function ConversasAdvancedFilter({ 
  companyId, 
  filters, 
  onFiltersChange,
  allTags 
}: ConversasAdvancedFilterProps) {
  const [open, setOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<Array<{ id: string; name: string }>>([]);
  const [funis, setFunis] = useState<Array<{ id: string; nome: string }>>([]);
  const [etapas, setEtapas] = useState<Array<{ id: string; nome: string; funil_id: string }>>([]);
  const [produtos, setProdutos] = useState<Array<{ id: string; nome: string }>>([]);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom' | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Carregar dados
  useEffect(() => {
    if (!companyId) return;

    const loadData = async () => {
      // Carregar usuários
      const { data: usuariosData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      
      if (usuariosData) {
        setUsuarios(usuariosData.map(u => ({ id: u.id, name: u.full_name || 'Sem nome' })));
      }

      // Carregar funis
      const { data: funisData } = await supabase
        .from('funis')
        .select('id, nome')
        .eq('company_id', companyId)
        .order('nome');
      
      if (funisData) {
        setFunis(funisData);
      }

      // Carregar etapas
      const { data: etapasData } = await supabase
        .from('etapas')
        .select('id, nome, funil_id')
        .eq('company_id', companyId)
        .order('posicao');
      
      if (etapasData) {
        setEtapas(etapasData);
      }

      // Carregar produtos
      const { data: produtosData } = await supabase
        .from('produtos_servicos')
        .select('id, nome')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .order('nome');
      
      if (produtosData) {
        setProdutos(produtosData);
      }
    };

    loadData();
  }, [companyId]);

  // Calcular quantidade de filtros ativos
  const activeFiltersCount = [
    filters.tags.length > 0,
    filters.responsaveis.length > 0,
    filters.comValor !== null,
    filters.funilId !== null,
    filters.etapaId !== null,
    filters.produtos.length > 0,
    filters.dataInicio !== null,
    filters.temperatura !== null,
    filters.statusVenda !== null
  ].filter(Boolean).length;

  // Handler para alternar tag
  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  // Handler para alternar responsável
  const toggleResponsavel = (id: string) => {
    const newResp = filters.responsaveis.includes(id)
      ? filters.responsaveis.filter(r => r !== id)
      : [...filters.responsaveis, id];
    onFiltersChange({ ...filters, responsaveis: newResp });
  };

  // Handler para alternar produto
  const toggleProduto = (id: string) => {
    const newProds = filters.produtos.includes(id)
      ? filters.produtos.filter(p => p !== id)
      : [...filters.produtos, id];
    onFiltersChange({ ...filters, produtos: newProds });
  };

  // Handler para range de data
  const handleDateRange = (range: 'today' | 'week' | 'month' | 'custom') => {
    setDateRange(range);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (range === 'today') {
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      onFiltersChange({ ...filters, dataInicio: today, dataFim: endOfDay });
      setShowCalendar(false);
    } else if (range === 'week') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      onFiltersChange({ ...filters, dataInicio: startOfWeek, dataFim: new Date() });
      setShowCalendar(false);
    } else if (range === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      onFiltersChange({ ...filters, dataInicio: startOfMonth, dataFim: new Date() });
      setShowCalendar(false);
    } else {
      setShowCalendar(true);
    }
  };

  // Limpar todos os filtros
  const clearAllFilters = () => {
    onFiltersChange(defaultFilters);
    setDateRange(null);
    setShowCalendar(false);
  };

  // Etapas filtradas pelo funil selecionado
  const etapasFiltradas = filters.funilId 
    ? etapas.filter(e => e.funil_id === filters.funilId)
    : etapas;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant={activeFiltersCount > 0 ? "default" : "outline"} 
          size="sm" 
          className={cn(
            "gap-1 h-8",
            activeFiltersCount > 0 && "bg-primary"
          )}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-primary-foreground text-primary">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <div className="p-3 border-b flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros Avançados
          </h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs text-muted-foreground">
              <X className="h-3 w-3 mr-1" />
              Limpar ({activeFiltersCount})
            </Button>
          )}
        </div>

        <Tabs defaultValue="tags" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b h-auto p-0 bg-transparent">
            <TabsTrigger value="tags" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs">
              <Tag className="h-3 w-3 mr-1" />
              Tags
              {filters.tags.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.tags.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="responsavel" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs">
              <User className="h-3 w-3 mr-1" />
              Resp.
              {filters.responsaveis.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.responsaveis.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="funil" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Funil
              {filters.funilId && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">1</Badge>}
            </TabsTrigger>
            <TabsTrigger value="mais" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs">
              <ChevronDown className="h-3 w-3 mr-1" />
              Mais
            </TabsTrigger>
          </TabsList>

          {/* Tab: Tags */}
          <TabsContent value="tags" className="p-3 m-0">
            <ScrollArea className="h-[200px]">
              {allTags.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag cadastrada</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={filters.tags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                      {filters.tags.includes(tag) && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Tab: Responsável */}
          <TabsContent value="responsavel" className="p-3 m-0">
            <ScrollArea className="h-[200px]">
              {usuarios.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
              ) : (
                <div className="space-y-2">
                  {usuarios.map(user => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={filters.responsaveis.includes(user.id)}
                        onCheckedChange={() => toggleResponsavel(user.id)}
                      />
                      <Label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer">
                        {user.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Tab: Funil */}
          <TabsContent value="funil" className="p-3 m-0 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Funil de Vendas</Label>
              <Select 
                value={filters.funilId || ''} 
                onValueChange={(val) => onFiltersChange({ ...filters, funilId: val || null, etapaId: null })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todos os funis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os funis</SelectItem>
                  {funis.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Etapa</Label>
              <Select 
                value={filters.etapaId || ''} 
                onValueChange={(val) => onFiltersChange({ ...filters, etapaId: val || null })}
                disabled={!filters.funilId}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={filters.funilId ? "Todas as etapas" : "Selecione um funil"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as etapas</SelectItem>
                  {etapasFiltradas.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Tab: Mais Filtros */}
          <TabsContent value="mais" className="p-3 m-0">
            <ScrollArea className="h-[250px]">
              <div className="space-y-4">
                {/* Valor */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Valor
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant={filters.comValor === null ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => onFiltersChange({ ...filters, comValor: null })}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={filters.comValor === true ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => onFiltersChange({ ...filters, comValor: true })}
                    >
                      Com Valor
                    </Button>
                    <Button
                      variant={filters.comValor === false ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => onFiltersChange({ ...filters, comValor: false })}
                    >
                      Sem Valor
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Produtos */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Produtos ({filters.produtos.length})
                  </Label>
                  <div className="max-h-[100px] overflow-y-auto space-y-1">
                    {produtos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum produto</p>
                    ) : (
                      produtos.map(prod => (
                        <div key={prod.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`prod-${prod.id}`}
                            checked={filters.produtos.includes(prod.id)}
                            onCheckedChange={() => toggleProduto(prod.id)}
                          />
                          <Label htmlFor={`prod-${prod.id}`} className="text-xs cursor-pointer">
                            {prod.nome}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Separator />

                {/* Data de Criação */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    Data de Criação
                  </Label>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant={dateRange === 'today' ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleDateRange('today')}
                    >
                      Hoje
                    </Button>
                    <Button
                      variant={dateRange === 'week' ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleDateRange('week')}
                    >
                      Semana
                    </Button>
                    <Button
                      variant={dateRange === 'month' ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleDateRange('month')}
                    >
                      Mês
                    </Button>
                    <Button
                      variant={dateRange === 'custom' ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleDateRange('custom')}
                    >
                      Personalizado
                    </Button>
                  </div>
                  {showCalendar && (
                    <div className="border rounded-md p-2 mt-2">
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1">
                          <Label className="text-[10px]">De</Label>
                          <Input
                            type="date"
                            className="h-7 text-xs"
                            value={filters.dataInicio ? format(filters.dataInicio, 'yyyy-MM-dd') : ''}
                            onChange={(e) => onFiltersChange({ 
                              ...filters, 
                              dataInicio: e.target.value ? new Date(e.target.value) : null 
                            })}
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-[10px]">Até</Label>
                          <Input
                            type="date"
                            className="h-7 text-xs"
                            value={filters.dataFim ? format(filters.dataFim, 'yyyy-MM-dd') : ''}
                            onChange={(e) => onFiltersChange({ 
                              ...filters, 
                              dataFim: e.target.value ? new Date(e.target.value) : null 
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Temperatura */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Thermometer className="h-3 w-3" />
                    Temperatura
                  </Label>
                  <div className="flex gap-1">
                    <Button
                      variant={filters.temperatura === null ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => onFiltersChange({ ...filters, temperatura: null })}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={filters.temperatura === 'quente' ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs text-red-500 hover:text-red-600"
                      onClick={() => onFiltersChange({ ...filters, temperatura: 'quente' })}
                    >
                      🔥 Quente
                    </Button>
                    <Button
                      variant={filters.temperatura === 'morno' ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs text-yellow-500 hover:text-yellow-600"
                      onClick={() => onFiltersChange({ ...filters, temperatura: 'morno' })}
                    >
                      🌡️ Morno
                    </Button>
                    <Button
                      variant={filters.temperatura === 'frio' ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs text-blue-500 hover:text-blue-600"
                      onClick={() => onFiltersChange({ ...filters, temperatura: 'frio' })}
                    >
                      ❄️ Frio
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Status da Venda */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Status da Venda
                  </Label>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant={filters.statusVenda === null ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onFiltersChange({ ...filters, statusVenda: null })}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={filters.statusVenda === 'em_negociacao' ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onFiltersChange({ ...filters, statusVenda: 'em_negociacao' })}
                    >
                      Em Negociação
                    </Button>
                    <Button
                      variant={filters.statusVenda === 'ganho' ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs text-green-600"
                      onClick={() => onFiltersChange({ ...filters, statusVenda: 'ganho' })}
                    >
                      ✅ Ganho
                    </Button>
                    <Button
                      variant={filters.statusVenda === 'perdido' ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs text-red-600"
                      onClick={() => onFiltersChange({ ...filters, statusVenda: 'perdido' })}
                    >
                      ❌ Perdido
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Resumo dos filtros ativos */}
        {activeFiltersCount > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Filtros ativos:</p>
            <div className="flex flex-wrap gap-1">
              {filters.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] h-5">
                  <Tag className="h-2 w-2 mr-1" />{tag}
                  <X className="h-2 w-2 ml-1 cursor-pointer" onClick={() => toggleTag(tag)} />
                </Badge>
              ))}
              {filters.responsaveis.map(id => {
                const user = usuarios.find(u => u.id === id);
                return user ? (
                  <Badge key={id} variant="secondary" className="text-[10px] h-5">
                    <User className="h-2 w-2 mr-1" />{user.name}
                    <X className="h-2 w-2 ml-1 cursor-pointer" onClick={() => toggleResponsavel(id)} />
                  </Badge>
                ) : null;
              })}
              {filters.comValor !== null && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  <DollarSign className="h-2 w-2 mr-1" />{filters.comValor ? 'Com Valor' : 'Sem Valor'}
                  <X className="h-2 w-2 ml-1 cursor-pointer" onClick={() => onFiltersChange({ ...filters, comValor: null })} />
                </Badge>
              )}
              {filters.funilId && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  <TrendingUp className="h-2 w-2 mr-1" />
                  {funis.find(f => f.id === filters.funilId)?.nome || 'Funil'}
                  <X className="h-2 w-2 ml-1 cursor-pointer" onClick={() => onFiltersChange({ ...filters, funilId: null, etapaId: null })} />
                </Badge>
              )}
              {filters.temperatura && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  <Thermometer className="h-2 w-2 mr-1" />{filters.temperatura}
                  <X className="h-2 w-2 ml-1 cursor-pointer" onClick={() => onFiltersChange({ ...filters, temperatura: null })} />
                </Badge>
              )}
              {filters.statusVenda && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  <CheckCircle2 className="h-2 w-2 mr-1" />{filters.statusVenda.replace('_', ' ')}
                  <X className="h-2 w-2 ml-1 cursor-pointer" onClick={() => onFiltersChange({ ...filters, statusVenda: null })} />
                </Badge>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { defaultFilters };
