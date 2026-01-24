import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Package, Search, X, CheckCircle2, Loader2, 
  ChevronDown, Filter, FolderTree 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Produto {
  id: string;
  nome: string;
  preco_sugerido: number | null;
  categoria: string | null;
  subcategoria: string | null;
}

interface ProdutoSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  selectedProductId?: string | null;
  onSelectProduct: (produtoId: string, produto?: Produto) => void;
  saving?: boolean;
}

export function ProdutoSelectorDialog({
  open,
  onOpenChange,
  companyId,
  selectedProductId,
  onSelectProduct,
  saving = false,
}: ProdutoSelectorDialogProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("all");
  const [selectedSubcategoria, setSelectedSubcategoria] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Carregar produtos ao abrir
  useEffect(() => {
    if (open && companyId) {
      carregarProdutos();
    }
  }, [open, companyId]);

  // Reset filters when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSelectedCategoria("all");
      setSelectedSubcategoria("all");
    }
  }, [open]);

  const carregarProdutos = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("produtos_servicos")
        .select("id, nome, preco_sugerido, categoria, subcategoria")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .order("categoria")
        .order("subcategoria")
        .order("nome");

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  // Extrair categorias únicas
  const categorias = useMemo(() => {
    const cats = new Set<string>();
    produtos.forEach(p => {
      if (p.categoria) cats.add(p.categoria);
    });
    return Array.from(cats).sort();
  }, [produtos]);

  // Extrair subcategorias únicas baseadas na categoria selecionada
  const subcategorias = useMemo(() => {
    const subs = new Set<string>();
    produtos.forEach(p => {
      if (p.subcategoria) {
        if (selectedCategoria === "all" || p.categoria === selectedCategoria) {
          subs.add(p.subcategoria);
        }
      }
    });
    return Array.from(subs).sort();
  }, [produtos, selectedCategoria]);

  // Filtrar produtos
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      // Filtro de texto (nome, categoria, subcategoria)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        p.nome.toLowerCase().includes(searchLower) ||
        (p.categoria?.toLowerCase().includes(searchLower)) ||
        (p.subcategoria?.toLowerCase().includes(searchLower));
      
      // Filtro de categoria
      const matchesCategoria = selectedCategoria === "all" || 
        p.categoria === selectedCategoria;
      
      // Filtro de subcategoria
      const matchesSubcategoria = selectedSubcategoria === "all" || 
        p.subcategoria === selectedSubcategoria;
      
      return matchesSearch && matchesCategoria && matchesSubcategoria;
    });
  }, [produtos, searchTerm, selectedCategoria, selectedSubcategoria]);

  // Agrupar por categoria/subcategoria para exibição
  const produtosAgrupados = useMemo(() => {
    const grupos: Record<string, Record<string, Produto[]>> = {};
    
    produtosFiltrados.forEach(p => {
      const cat = p.categoria || "Sem categoria";
      const sub = p.subcategoria || "";
      
      if (!grupos[cat]) grupos[cat] = {};
      if (!grupos[cat][sub]) grupos[cat][sub] = [];
      grupos[cat][sub].push(p);
    });
    
    return grupos;
  }, [produtosFiltrados]);

  // Reset subcategoria quando categoria mudar
  useEffect(() => {
    setSelectedSubcategoria("all");
  }, [selectedCategoria]);

  const hasActiveFilters = selectedCategoria !== "all" || selectedSubcategoria !== "all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Produto / Serviço
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          {/* Barra de pesquisa */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, categoria ou subcategoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4"
            />
          </div>

          {/* Botão de filtros */}
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="text-xs">
                      Ativos
                    </Badge>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pt-3 space-y-3">
              {/* Filtro de categoria */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <Select 
                  value={selectedCategoria} 
                  onValueChange={setSelectedCategoria}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categorias.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de subcategoria */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Subcategoria</label>
                <Select 
                  value={selectedSubcategoria} 
                  onValueChange={setSelectedSubcategoria}
                  disabled={subcategorias.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as subcategorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as subcategorias</SelectItem>
                    {subcategorias.map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Botão limpar filtros */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setSelectedCategoria("all");
                    setSelectedSubcategoria("all");
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Lista de produtos */}
          {loading ? (
            <div className="flex items-center justify-center py-8 flex-1">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : produtos.length === 0 ? (
            <div className="text-center py-6 flex-1">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum produto cadastrado.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cadastre produtos em Analytics → Produtos
              </p>
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="text-center py-6 flex-1">
              <Search className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum produto encontrado com os filtros atuais.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategoria("all");
                  setSelectedSubcategoria("all");
                }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-2 px-2" style={{ maxHeight: '350px' }}>
              <div className="space-y-2">
                {/* Opção para remover produto */}
                <Button
                  variant={!selectedProductId ? "secondary" : "outline"}
                  className="w-full justify-start gap-2"
                  onClick={() => onSelectProduct("")}
                  disabled={saving}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                  <span>Sem produto definido</span>
                </Button>

                {/* Produtos organizados por categoria */}
                {Object.entries(produtosAgrupados).map(([categoria, subcategorias]) => (
                  <div key={categoria} className="space-y-1">
                    {/* Header da categoria */}
                    <div className="flex items-center gap-2 py-1 px-2 bg-muted rounded-md">
                      <FolderTree className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {categoria}
                      </span>
                    </div>
                    
                    {Object.entries(subcategorias).map(([subcategoria, prods]) => (
                      <div key={subcategoria} className="space-y-1">
                        {/* Header da subcategoria (se houver) */}
                        {subcategoria && (
                          <div className="flex items-center gap-2 py-0.5 px-4">
                            <span className="text-xs text-muted-foreground italic">
                              {subcategoria}
                            </span>
                          </div>
                        )}
                        
                        {/* Produtos */}
                        {prods.map((produto) => (
                          <Button
                            key={produto.id}
                            variant={selectedProductId === produto.id ? "secondary" : "outline"}
                            className="w-full justify-start gap-2 h-auto py-2"
                            onClick={() => onSelectProduct(produto.id, produto)}
                            disabled={saving}
                          >
                            <Package className="h-4 w-4 text-primary flex-shrink-0" />
                            <div className="flex-1 text-left min-w-0">
                              <div className="font-medium truncate">{produto.nome}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {produto.categoria && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    {produto.categoria}
                                  </Badge>
                                )}
                                {produto.subcategoria && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 bg-muted">
                                    {produto.subcategoria}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {produto.preco_sugerido && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                R$ {produto.preco_sugerido.toLocaleString("pt-BR")}
                              </span>
                            )}
                            {selectedProductId === produto.id && (
                              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </Button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Contador de resultados */}
          {!loading && produtosFiltrados.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''} encontrado{produtosFiltrados.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
