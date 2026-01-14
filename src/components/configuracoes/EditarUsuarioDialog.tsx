import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff, Camera, X, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Colaborador {
  id: string;
  userId?: string;
  nome: string;
  email: string;
  setor?: string;
  funcao?: string;
  avatar_url?: string;
}

interface EditarUsuarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaborador: Colaborador | null;
  companyId: string;
  onSuccess: () => void;
}

export function EditarUsuarioDialog({
  open,
  onOpenChange,
  colaborador,
  companyId,
  onSuccess,
}: EditarUsuarioDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    funcao: "",
    password: "",
    avatar_url: "",
  });

  useEffect(() => {
    const loadUserData = async () => {
      if (colaborador) {
        // Buscar avatar_url do profile
        let avatarUrl = "";
        if (colaborador.userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", colaborador.userId)
            .maybeSingle();
          avatarUrl = profile?.avatar_url || "";
        }
        
        setFormData({
          nome: colaborador.nome || "",
          email: colaborador.email || "",
          telefone: "",
          funcao: colaborador.funcao || "vendedor",
          password: "",
          avatar_url: avatarUrl,
        });
      }
    };
    
    if (open && colaborador) {
      loadUserData();
    }
  }, [colaborador, open]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !colaborador?.userId) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione uma imagem válida",
      });
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A imagem deve ter no máximo 2MB",
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${colaborador.userId}/avatar.${fileExt}`;
      
      // Fazer upload para o bucket user-avatars
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(fileName);

      // Adicionar timestamp para evitar cache
      const avatarUrlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      // Atualizar profile com a nova URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrlWithTimestamp })
        .eq('id', colaborador.userId);

      if (updateError) throw updateError;

      setFormData(prev => ({ ...prev, avatar_url: avatarUrlWithTimestamp }));

      toast({
        title: "Sucesso",
        description: "Foto de perfil atualizada",
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar foto",
        description: error.message || "Ocorreu um erro ao fazer upload da imagem",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!colaborador?.userId) return;

    setUploadingAvatar(true);

    try {
      // Remover arquivo do storage
      const { error: deleteError } = await supabase.storage
        .from('user-avatars')
        .remove([`${colaborador.userId}/avatar.jpg`, `${colaborador.userId}/avatar.png`, `${colaborador.userId}/avatar.webp`]);

      // Ignorar erro se arquivo não existir
      if (deleteError && !deleteError.message.includes('Not found')) {
        throw deleteError;
      }

      // Atualizar profile removendo avatar_url
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', colaborador.userId);

      if (updateError) throw updateError;

      setFormData(prev => ({ ...prev, avatar_url: "" }));

      toast({
        title: "Foto removida",
        description: "Foto de perfil removida com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao remover foto:', error);
      toast({
        variant: "destructive",
        title: "Erro ao remover foto",
        description: error.message || "Ocorreu um erro ao remover a foto",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!colaborador?.userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "ID do usuário não encontrado",
      });
      return;
    }

    if (!formData.nome.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O nome é obrigatório",
      });
      return;
    }

    if (!formData.email.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O email é obrigatório",
      });
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Email inválido",
      });
      return;
    }

    // Validar senha se fornecida
    if (formData.password && formData.password.length < 6) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
      });
      return;
    }

    setLoading(true);

    try {
      const requestBody: any = {
        userId: colaborador.userId,
        companyId: companyId,
      };

      // Apenas incluir campos que foram alterados
      if (formData.nome !== colaborador.nome) {
        requestBody.full_name = formData.nome;
      }
      if (formData.email !== colaborador.email) {
        requestBody.email = formData.email;
      }
      if (formData.funcao !== colaborador.funcao) {
        requestBody.role = formData.funcao;
      }
      if (formData.password) {
        requestBody.password = formData.password;
      }

      const { data, error } = await supabase.functions.invoke('editar-usuario', {
        body: requestBody,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao editar usuário:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar usuário",
        description: error.message || "Ocorreu um erro ao atualizar o usuário",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize os dados do usuário. Deixe a senha em branco para mantê-la inalterada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Upload de Foto de Perfil */}
          <div className="flex flex-col items-center gap-3">
            <Label>Foto de Perfil</Label>
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={formData.avatar_url} alt={formData.nome} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {formData.nome ? getInitials(formData.nome) : <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                {formData.avatar_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <p className="text-xs text-muted-foreground">
              Clique na foto para alterar (max 2MB)
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-nome">Nome Completo *</Label>
            <Input
              id="edit-nome"
              placeholder="Nome do usuário"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-email">Email *</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="email@exemplo.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-funcao">Perfil</Label>
            <Select
              value={formData.funcao}
              onValueChange={(value) => setFormData(prev => ({ ...prev, funcao: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company_admin">Administrador</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="vendedor">Vendedor/Atendente</SelectItem>
                <SelectItem value="suporte">Suporte</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-password">Nova Senha (opcional)</Label>
            <div className="relative">
              <Input
                id="edit-password"
                type={showPassword ? "text" : "password"}
                placeholder="Deixe em branco para manter a atual"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo de 6 caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}