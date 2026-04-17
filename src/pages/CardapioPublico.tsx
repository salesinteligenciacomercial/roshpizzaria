import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShoppingCart, Plus, Minus, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  nome: string;
  descricao_curta?: string | null;
  descricao_completa?: string | null;
  preco_sugerido: number;
  categoria?: string | null;
  imagem_url?: string | null;
  destaque_cardapio?: boolean;
  permite_observacao?: boolean;
};

type StoreConfig = {
  nome_loja?: string | null;
  descricao_loja?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  telefone_loja?: string | null;
  endereco_loja?: string | null;
  pedido_minimo?: number | null;
  taxa_entrega?: number | null;
  aceita_retirada?: boolean;
  aceita_entrega?: boolean;
  mensagem_loja?: string | null;
  horario_funcionamento?: Record<string, string>;
};

type CartItem = {
  product: Product;
  quantity: number;
  observations: string;
};

export default function CardapioPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [config, setConfig] = useState<StoreConfig>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedObs, setSelectedObs] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);

  const [customer, setCustomer] = useState({
    nome: "",
    telefone: "",
    tipo_atendimento: "entrega",
    forma_pagamento: "pix",
    observacoes: "",
    endereco: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
          body: { action: "menu", slug },
        });
        if (error) throw error;
        if (!data?.success) {
          setNotFound(true);
          return;
        }
        setConfig(data.store || {});
        setProducts(data.products || []);
      } catch (error) {
        console.error(error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.categoria || "Geral"))), [products]);
  const primary = config.cor_primaria || "#ea580c";
  const secondary = config.cor_secundaria || "#111827";

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.product.preco_sugerido || 0) * item.quantity, 0),
    [cart]
  );
  const deliveryFee = customer.tipo_atendimento === "entrega" ? Number(config.taxa_entrega || 0) : 0;
  const total = subtotal + deliveryFee;

  const addToCart = () => {
    if (!selectedProduct) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === selectedProduct.id && item.observations === selectedObs);
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + selectedQty } : item
        );
      }
      return [...prev, { product: selectedProduct, quantity: selectedQty, observations: selectedObs.trim() }];
    });
    setSelectedProduct(null);
    setSelectedObs("");
    setSelectedQty(1);
    toast.success("Item adicionado ao carrinho");
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, i) => (i === index ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const submitOrder = async () => {
    if (!cart.length) {
      toast.error("Adicione itens ao carrinho");
      return;
    }
    if (!customer.nome.trim() || !customer.telefone.trim()) {
      toast.error("Informe nome e telefone");
      return;
    }
    if (customer.tipo_atendimento === "entrega" && !customer.endereco.trim()) {
      toast.error("Informe o endereço de entrega");
      return;
    }
    if (total < Number(config.pedido_minimo || 0)) {
      toast.error("Pedido abaixo do mínimo da loja");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
        body: {
          action: "create",
          slug,
          customer,
          items: cart.map((item) => ({
            produto_id: item.product.id,
            produto_nome: item.product.nome,
            quantidade: item.quantity,
            valor_unitario: item.product.preco_sugerido,
            observacoes: item.observations,
          })),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao criar pedido");
      toast.success(`Pedido enviado com sucesso! Código ${data.codigo_pedido}`);
      setCart([]);
      setCustomer({
        nome: "",
        telefone: "",
        tipo_atendimento: "entrega",
        forma_pagamento: "pix",
        observacoes: "",
        endereco: "",
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (notFound) {
    return <div className="min-h-screen flex items-center justify-center text-center p-6"><div><h1 className="text-2xl font-bold">Cardápio não encontrado</h1><p className="text-muted-foreground">Verifique o link da loja.</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: primary }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 text-white">
          {config.logo_url && <img src={config.logo_url} alt={config.nome_loja || "Loja"} className="h-10 w-10 rounded-md object-cover bg-white" />}
          <div>
            <div className="font-bold text-lg">{config.nome_loja || "Cardápio Digital"}</div>
            <div className="text-xs opacity-90">{config.descricao_loja || "Peça online e acompanhe seu pedido."}</div>
          </div>
          <div className="ml-auto">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Carrinho ({cart.length})
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg">
                <SheetHeader><SheetTitle>Seu pedido</SheetTitle></SheetHeader>
                <div className="mt-6 space-y-4">
                  {cart.length === 0 && <div className="text-sm text-muted-foreground">Seu carrinho está vazio.</div>}
                  {cart.map((item, index) => (
                    <Card key={`${item.product.id}-${index}`}>
                      <CardContent className="pt-4 flex gap-3">
                        <div className="flex-1">
                          <div className="font-medium">{item.product.nome}</div>
                          {item.observations && <div className="text-xs text-muted-foreground">{item.observations}</div>}
                          <div className="text-sm mt-1">
                            {Number(item.product.preco_sugerido || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => updateQuantity(index, -1)}><Minus className="h-4 w-4" /></Button>
                          <span className="w-6 text-center">{item.quantity}</span>
                          <Button variant="outline" size="icon" onClick={() => updateQuantity(index, 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <Card>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Nome</Label><Input value={customer.nome} onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Telefone</Label><Input value={customer.telefone} onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Atendimento</Label>
                          <Select value={customer.tipo_atendimento} onValueChange={(v) => setCustomer({ ...customer, tipo_atendimento: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {!!config.aceita_entrega && <SelectItem value="entrega">Entrega</SelectItem>}
                              {!!config.aceita_retirada && <SelectItem value="retirada">Retirada</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Pagamento</Label>
                          <Select value={customer.forma_pagamento} onValueChange={(v) => setCustomer({ ...customer, forma_pagamento: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pix">Pix</SelectItem>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {customer.tipo_atendimento === "entrega" && (
                        <div className="space-y-2"><Label>Endereço</Label><Textarea rows={3} value={customer.endereco} onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })} /></div>
                      )}
                      <div className="space-y-2"><Label>Observações do pedido</Label><Textarea rows={3} value={customer.observacoes} onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })} /></div>

                      <div className="text-sm space-y-1">
                        <div className="flex justify-between"><span>Subtotal</span><span>{subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                        <div className="flex justify-between"><span>Taxa de entrega</span><span>{deliveryFee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                        <div className="flex justify-between font-semibold"><span>Total</span><span>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                      </div>
                      <Button className="w-full" onClick={submitOrder} disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Enviar pedido
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {config.banner_url && <div className="w-full h-56 md:h-72 overflow-hidden"><img src={config.banner_url} alt="banner" className="w-full h-full object-cover" /></div>}

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6 flex items-center gap-3"><Clock className="h-5 w-5" style={{ color: primary }} /><div><div className="font-medium">Entrega e retirada</div><div className="text-sm text-muted-foreground">{config.aceita_entrega ? "Entrega" : ""}{config.aceita_entrega && config.aceita_retirada ? " • " : ""}{config.aceita_retirada ? "Retirada" : ""}</div></div></CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3"><MapPin className="h-5 w-5" style={{ color: primary }} /><div><div className="font-medium">Endereço</div><div className="text-sm text-muted-foreground">{config.endereco_loja || "Consulte a loja"}</div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="font-medium">Pedido mínimo</div><div className="text-sm text-muted-foreground">{Number(config.pedido_minimo || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div></CardContent></Card>
        </div>

        {config.mensagem_loja && (
          <Card style={{ borderColor: primary }}>
            <CardContent className="pt-6 text-sm">{config.mensagem_loja}</CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Badge key={cat} variant="outline" className="px-3 py-1">{cat}</Badge>
          ))}
        </div>

        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category} className="space-y-4">
              <h2 className="text-2xl font-bold" style={{ color: secondary }}>{category}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products.filter((p) => (p.categoria || "Geral") === category).map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <div className="h-44 bg-muted">
                      {product.imagem_url ? (
                        <img src={product.imagem_url} alt={product.nome} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{product.nome}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{product.descricao_curta || product.descricao_completa || "Sem descrição."}</p>
                        </div>
                        {product.destaque_cardapio && <Badge style={{ backgroundColor: primary }}>Destaque</Badge>}
                      </div>
                      <div className="text-lg font-bold" style={{ color: primary }}>
                        {Number(product.preco_sugerido || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                      <Button className="w-full" onClick={() => setSelectedProduct(product)}>Adicionar</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedProduct?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">{selectedProduct?.descricao_completa || selectedProduct?.descricao_curta || "Sem descrição."}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
              <span className="w-8 text-center">{selectedQty}</span>
              <Button variant="outline" size="icon" onClick={() => setSelectedQty((q) => q + 1)}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={selectedObs} onChange={(e) => setSelectedObs(e.target.value)} placeholder="Ex: sem cebola, bem assada..." />
            </div>
            <Button className="w-full" onClick={addToCart}>
              Adicionar por {Number((selectedProduct?.preco_sugerido || 0) * selectedQty).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
