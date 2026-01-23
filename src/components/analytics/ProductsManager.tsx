import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { 
  FolderOpen, Plus, Pencil, Trash2, Loader2, Tag,
  Search, Package, PlusCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Category {
  nome: string;
  count: number;
  subcategorias: Subcategory[];
}

interface Subcategory {
  nome: string;
  count: number;
  parentCategory: string;
}

interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco_sugerido: number | null;
  categoria: string | null;
  subcategoria: string | null;
  ativo: boolean;
}

interface ProductsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onProductsChange: () => void;
}

export default function ProductsManager({
  open,
  onOpenChange,
  companyId,
  onProductsChange
}: ProductsManagerProps) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Product dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    nome: "",
    descricao: "",
    preco_sugerido: "",
    categoria: "",
    subcategoria: "",
    ativo: true
  });

  // Subcategory dialog
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [subcategoryParent, setSubcategoryParent] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState("");

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  useEffect(() => {
    if (open && companyId) {
      fetchData();
    }
  }, [open, companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("produtos_servicos")
        .select("*")
        .eq("company_id", companyId)
        .order("nome");

      if (error) throw error;

      setProducts(data || []);

      // Extract unique categories with counts and subcategories
      const categoryMap = new Map<string, { count: number; subcategories: Map<string, number> }>();
      (data || []).forEach(p => {
        if (p.categoria) {
          if (!categoryMap.has(p.categoria)) {
            categoryMap.set(p.categoria, { count: 0, subcategories: new Map() });
          }
          const catData = categoryMap.get(p.categoria)!;
          catData.count++;
          
          if (p.subcategoria) {
            catData.subcategories.set(
              p.subcategoria,
              (catData.subcategories.get(p.subcategoria) || 0) + 1
            );
          }
        }
      });

      const cats: Category[] = Array.from(categoryMap.entries()).map(([nome, data]) => ({
        nome,
        count: data.count,
        subcategorias: Array.from(data.subcategories.entries()).map(([subNome, subCount]) => ({
          nome: subNome,
          count: subCount,
          parentCategory: nome
        })).sort((a, b) => a.nome.localeCompare(b.nome))
      })).sort((a, b) => a.nome.localeCompare(b.nome));

      setCategories(cats);
    } catch (error) {
      console.error("[ProductsManager] Error:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        nome: product.nome,
        descricao: product.descricao || "",
        preco_sugerido: product.preco_sugerido?.toString() || "",
        categoria: product.categoria || "",
        subcategoria: product.subcategoria || "",
        ativo: product.ativo
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        nome: "",
        descricao: "",
        preco_sugerido: "",
        categoria: "",
        subcategoria: "",
        ativo: true
      });
    }
    setProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: productForm.nome.trim(),
        descricao: productForm.descricao.trim() || null,
        preco_sugerido: productForm.preco_sugerido ? parseFloat(productForm.preco_sugerido) : null,
        categoria: productForm.categoria.trim() || null,
        subcategoria: productForm.subcategoria.trim() || null,
        company_id: companyId,
        ativo: productForm.ativo
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("produtos_servicos")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase
          .from("produtos_servicos")
          .insert(payload);
        if (error) throw error;
        toast.success("Produto criado!");
      }

      setProductDialogOpen(false);
      fetchData();
      onProductsChange();
    } catch (error) {
      console.error("[ProductsManager] Error saving:", error);
      toast.error("Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("produtos_servicos")
        .delete()
        .eq("id", productToDelete.id);

      if (error) throw error;
      toast.success("Produto excluído!");
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      fetchData();
      onProductsChange();
    } catch (error) {
      console.error("[ProductsManager] Error deleting:", error);
      toast.error("Erro ao excluir produto");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const { error } = await supabase
        .from("produtos_servicos")
        .update({ ativo: !product.ativo })
        .eq("id", product.id);

      if (error) throw error;
      
      setProducts(products.map(p => 
        p.id === product.id ? { ...p, ativo: !p.ativo } : p
      ));
      toast.success(product.ativo ? "Produto desativado" : "Produto ativado");
      onProductsChange();
    } catch (error) {
      console.error("[ProductsManager] Error toggling:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleOpenCategoryDialog = (categoryName?: string) => {
    if (categoryName) {
      setEditingCategory(categoryName);
      setCategoryName(categoryName);
    } else {
      setEditingCategory(null);
      setCategoryName("");
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    if (editingCategory) {
      // Rename category in all products
      setSaving(true);
      try {
        const { error } = await supabase
          .from("produtos_servicos")
          .update({ categoria: categoryName.trim() })
          .eq("company_id", companyId)
          .eq("categoria", editingCategory);

        if (error) throw error;
        toast.success("Categoria renomeada!");
        setCategoryDialogOpen(false);
        fetchData();
        onProductsChange();
      } catch (error) {
        console.error("[ProductsManager] Error renaming category:", error);
        toast.error("Erro ao renomear categoria");
      } finally {
        setSaving(false);
      }
    } else {
      // New category - add to local list and set in product form
      const newCategoryName = categoryName.trim();
      
      // Add to categories list if not exists
      if (!categories.some(c => c.nome === newCategoryName)) {
        setCategories([...categories, { nome: newCategoryName, count: 0, subcategorias: [] }]);
      }
      
      // Set in product form if dialog is open
      if (productDialogOpen) {
        setProductForm({ ...productForm, categoria: newCategoryName, subcategoria: "" });
      }
      
      toast.success(`Categoria "${newCategoryName}" criada!`);
      setCategoryDialogOpen(false);
    }
  };

  const handleOpenSubcategoryDialog = (parentCategory: string) => {
    setSubcategoryParent(parentCategory);
    setSubcategoryName("");
    setSubcategoryDialogOpen(true);
  };

  const handleSaveSubcategory = async () => {
    if (!subcategoryName.trim()) {
      toast.error("Nome da subcategoria é obrigatório");
      return;
    }

    if (!subcategoryParent) {
      toast.error("Categoria pai é obrigatória");
      return;
    }

    const newSubcategoryName = subcategoryName.trim();
    
    // Add to local categories list
    setCategories(categories.map(cat => {
      if (cat.nome === subcategoryParent) {
        // Check if subcategory already exists
        if (cat.subcategorias.some(s => s.nome === newSubcategoryName)) {
          toast.error("Subcategoria já existe");
          return cat;
        }
        return {
          ...cat,
          subcategorias: [
            ...cat.subcategorias,
            { nome: newSubcategoryName, count: 0, parentCategory: subcategoryParent }
          ].sort((a, b) => a.nome.localeCompare(b.nome))
        };
      }
      return cat;
    }));
    
    // Set in product form if dialog is open
    if (productDialogOpen && productForm.categoria === subcategoryParent) {
      setProductForm({ ...productForm, subcategoria: newSubcategoryName });
    }
    
    toast.success(`Subcategoria "${newSubcategoryName}" criada!`);
    setSubcategoryDialogOpen(false);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.descricao?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !categoryFilter || p.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const activeCount = products.filter(p => p.ativo).length;
  const inactiveCount = products.filter(p => !p.ativo).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Gestão de Produtos & Serviços
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-sm py-1 px-3">
                {products.length} produtos
              </Badge>
              <Badge variant="secondary" className="text-sm py-1 px-3 bg-green-100 text-green-700">
                {activeCount} ativos
              </Badge>
              {inactiveCount > 0 && (
                <Badge variant="secondary" className="text-sm py-1 px-3 bg-red-100 text-red-700">
                  {inactiveCount} inativos
                </Badge>
              )}
              <Badge variant="secondary" className="text-sm py-1 px-3 bg-purple-100 text-purple-700">
                {categories.length} categorias
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={() => handleOpenProductDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Produto
              </Button>
              <Button variant="outline" onClick={() => handleOpenCategoryDialog()}>
                <FolderOpen className="h-4 w-4 mr-1" />
                Nova Categoria
              </Button>
              {categories.length > 0 && (
                <div className="flex items-center gap-1">
                  <Select
                    value={subcategoryParent || ""}
                    onValueChange={(value) => {
                      setSubcategoryParent(value);
                      setSubcategoryName("");
                      setSubcategoryDialogOpen(true);
                    }}
                  >
                    <SelectTrigger className="w-auto h-9 gap-1">
                      <PlusCircle className="h-4 w-4" />
                      <span>+ Subcategoria</span>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.nome} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Categories Section */}
            {categories.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Categorias ({categories.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <div key={cat.nome} className="flex items-center gap-1 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary/20 py-1 px-2"
                        onClick={() => handleOpenCategoryDialog(cat.nome)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        {cat.nome}
                        <span className="ml-1 text-xs bg-background/50 rounded px-1">
                          {cat.count}
                        </span>
                      </Badge>
                      {cat.subcategorias.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cat.subcategorias.map(sub => (
                            <Badge
                              key={sub.nome}
                              variant="outline"
                              className="text-xs py-0.5 px-2"
                            >
                              └ {sub.nome} ({sub.count})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search and Filter */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-1 flex-wrap">
                <Button
                  variant={categoryFilter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(null)}
                >
                  Todas
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat.nome}
                    variant={categoryFilter === cat.nome ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter(cat.nome)}
                    className="gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    {cat.nome}
                    <span className="text-xs opacity-70">({cat.count})</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Products Table */}
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Preço Sugerido</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {products.length === 0 
                            ? "Nenhum produto cadastrado. Clique em 'Novo Produto' para começar."
                            : "Nenhum produto encontrado com os filtros atuais."
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow key={product.id} className={!product.ativo ? "opacity-50" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{product.nome}</p>
                              {product.descricao && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {product.descricao}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {product.categoria ? (
                              <div className="flex flex-col gap-1">
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-muted w-fit"
                                  onClick={() => handleOpenCategoryDialog(product.categoria!)}
                                >
                                  <Tag className="h-3 w-3 mr-1" />
                                  {product.categoria}
                                </Badge>
                                {product.subcategoria && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs w-fit ml-2"
                                  >
                                    └ {product.subcategoria}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(product.preco_sugerido)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={product.ativo}
                                onCheckedChange={() => handleToggleActive(product)}
                              />
                              <span className="text-xs">
                                {product.ativo ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenProductDialog(product)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setProductToDelete(product);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Edit/Create Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-nome">Nome *</Label>
              <Input
                id="product-nome"
                value={productForm.nome}
                onChange={(e) => setProductForm({ ...productForm, nome: e.target.value })}
                placeholder="Nome do produto/serviço"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-descricao">Descrição</Label>
              <Input
                id="product-descricao"
                value={productForm.descricao}
                onChange={(e) => setProductForm({ ...productForm, descricao: e.target.value })}
                placeholder="Descrição do produto/serviço"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label htmlFor="product-categoria">Categoria</Label>
                <Select
                  value={productForm.categoria || "__none__"}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      // Open category dialog to create new
                      setCategoryDialogOpen(true);
                      setEditingCategory(null);
                      setCategoryName("");
                    } else if (value === "__none__") {
                      setProductForm({ ...productForm, categoria: "", subcategoria: "" });
                    } else {
                      setProductForm({ ...productForm, categoria: value, subcategoria: "" });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou crie uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Sem categoria</span>
                    </SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.nome} value={cat.nome}>
                        <div className="flex items-center gap-2">
                          <Tag className="h-3 w-3" />
                          {cat.nome}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-primary">
                      <div className="flex items-center gap-2">
                        <PlusCircle className="h-3 w-3" />
                        Criar nova categoria
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-preco">Preço Sugerido</Label>
                <Input
                  id="product-preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.preco_sugerido}
                  onChange={(e) => setProductForm({ ...productForm, preco_sugerido: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Subcategory selector - only shows when category is selected */}
            {productForm.categoria && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="product-subcategoria">Subcategoria</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenSubcategoryDialog(productForm.categoria)}
                    className="h-7 text-xs"
                  >
                    <PlusCircle className="h-3 w-3 mr-1" />
                    Nova Subcategoria
                  </Button>
                </div>
                <Select
                  value={productForm.subcategoria || "__none__"}
                  onValueChange={(value) => {
                    if (value === "__none__") {
                      setProductForm({ ...productForm, subcategoria: "" });
                    } else {
                      setProductForm({ ...productForm, subcategoria: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma subcategoria (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Sem subcategoria</span>
                    </SelectItem>
                    {categories
                      .find(c => c.nome === productForm.categoria)
                      ?.subcategorias.map(sub => (
                        <SelectItem key={sub.nome} value={sub.nome}>
                          {sub.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="product-ativo">Produto ativo</Label>
              <Switch
                id="product-ativo"
                checked={productForm.ativo}
                onCheckedChange={(checked) => setProductForm({ ...productForm, ativo: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProduct} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProduct ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Renomear Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-nome">Nome da Categoria *</Label>
              <Input
                id="category-nome"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex: Serviços, Produtos, Consultoria"
              />
            </div>
            
            {editingCategory && (
              <p className="text-sm text-muted-foreground">
                Todos os produtos com a categoria "{editingCategory}" serão atualizados.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCategory} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCategory ? "Renomear" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={subcategoryDialogOpen} onOpenChange={setSubcategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Nova Subcategoria
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Categoria Pai</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Tag className="h-4 w-4 text-primary" />
                <span className="font-medium">{subcategoryParent}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subcategory-nome">Nome da Subcategoria *</Label>
              <Input
                id="subcategory-nome"
                value={subcategoryName}
                onChange={(e) => setSubcategoryName(e.target.value)}
                placeholder="Ex: Premium, Básico, Especial"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubcategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSubcategory}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto "{productToDelete?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
