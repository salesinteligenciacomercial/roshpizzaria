import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Phone, Video, Info, User, MessageSquare, Instagram, Facebook, FileText, DollarSign, RefreshCw, CheckCircle2, AlertCircle, Loader2, Check, Plus, Flag, MoreVertical, Edit, Save, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader as UIDialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditarInformacoesLeadDialog } from "@/components/conversas/EditarInformacoesLeadDialog";
import { toast } from "sonner";

 type SyncStatus = 'synced' | 'syncing' | 'error' | 'idle';

 interface ConversationHeaderProps {
   contactName: string;
   channel: "whatsapp" | "instagram" | "facebook";
   avatarUrl?: string;
   produto?: string;
   valor?: string;
   responsavel?: string;
   tags?: string[];
   funnelStage?: string;
   showInfoPanel: boolean;
   onToggleInfoPanel: () => void;
   syncStatus?: SyncStatus;
   leadVinculado?: any;
   verificandoLead?: boolean;
   mostrarBotaoCriarLead?: boolean;
   onCriarLead?: () => void;
   onFinalizeAtendimento?: (message: string) => void;
 }

 export function ConversationHeader({
   contactName,
   channel,
   avatarUrl,
   produto,
   valor,
   responsavel,
   tags = [],
   funnelStage,
   showInfoPanel,
   onToggleInfoPanel,
   syncStatus = 'idle',
   leadVinculado,
   verificandoLead = false,
   mostrarBotaoCriarLead = false,
   onCriarLead,
   onFinalizeAtendimento,
 }: ConversationHeaderProps) {
   const [finalizeOpen, setFinalizeOpen] = useState(false);
   const [finalizeMessage, setFinalizeMessage] = useState("");
  const [editLeadOpen, setEditLeadOpen] = useState(false);

   useEffect(() => {
     const saved = localStorage.getItem("continuum_finalize_template");
     if (saved) {
       setFinalizeMessage(saved);
     } else {
       setFinalizeMessage(`Olá ${contactName}, foi um prazer atendê-lo(a)!\n\nSeu atendimento foi finalizado com sucesso. Se precisar de algo, basta responder esta mensagem.\n\nPoderia nos avaliar no Google? Sua opinião é muito importante.\nLink: `);
     }
   }, [contactName]);

   const getChannelIcon = () => {
     switch (channel) {
       case "whatsapp":
         return <MessageSquare className="h-4 w-4 text-[#25D366]" />;
       case "instagram":
         return <Instagram className="h-4 w-4 text-pink-500" />;
       case "facebook":
         return <Facebook className="h-4 w-4 text-blue-600" />;
       default:
         return <MessageSquare className="h-4 w-4" />;
     }
   };

   const getInitials = (name: string) => {
     return name
       .split(" ")
       .map((n) => n[0])
       .join("")
       .toUpperCase()
       .slice(0, 2);
   };

   const getSyncStatusBadge = () => {
     switch (syncStatus) {
       case 'syncing':
         return (
           <Badge variant="outline" className="gap-1.5 bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse">
             <RefreshCw className="h-3 w-3 animate-spin" />
             <span className="text-xs font-medium">Sincronizando...</span>
           </Badge>
         );
       case 'synced':
         return (
           <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/20">
             <CheckCircle2 className="h-3 w-3" />
             <span className="text-xs font-medium">Sincronizado</span>
           </Badge>
         );
       case 'error':
         return (
           <Badge variant="outline" className="gap-1.5 bg-red-500/10 text-red-600 border-red-500/20">
             <AlertCircle className="h-3 w-3" />
             <span className="text-xs font-medium">Erro na sincronização</span>
           </Badge>
         );
       default:
         return null;
     }
   };

   return (
     <div className="sticky top-0 z-20 bg-background border-b border-border shadow-md backdrop-blur-sm">
       <div className="p-4 space-y-3">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             {/* Avatar do Lead com Indicador de Rede */}
             <div className="relative">
               <Avatar className="h-14 w-14 border-2 border-primary/20">
                 <AvatarImage src={avatarUrl} alt={contactName} />
                 <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-lg">
                   {getInitials(contactName)}
                 </AvatarFallback>
               </Avatar>
               {/* Badge da Rede Social */}
               <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border-2 border-background shadow-sm">
                 {getChannelIcon()}
               </div>
             </div>
             {/* Nome e Canal */}
             <div className="flex flex-col">
               <div className="flex items-center gap-2">
                 <h2 className="font-bold text-lg text-foreground">
                   {contactName}
                 </h2>
                 {getSyncStatusBadge()}
               </div>
               <div className="flex items-center gap-2 text-xs">
                 <div className="flex items-center gap-1.5 text-muted-foreground">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   <span className="capitalize font-medium">{channel}</span>
                 </div>
                 {/* Badge de Lead Vinculado */}
                 {verificandoLead && (
                   <Badge variant="outline" className="gap-1">
                     <Loader2 className="h-3 w-3 animate-spin" />
                     Verificando...
                   </Badge>
                 )}
                 {!verificandoLead && leadVinculado && (
                   <Badge className="gap-1 bg-green-600 hover:bg-green-700">
                     <Check className="h-3 w-3" />
                     Lead Cadastrado
                   </Badge>
                 )}
                 {!verificandoLead && mostrarBotaoCriarLead && onCriarLead && (
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={onCriarLead}
                     className="h-6 text-xs gap-1"
                   >
                     <Plus className="h-3 w-3" />
                     Criar Lead no CRM
                   </Button>
                 )}
               </div>
             </div>
           </div>
           {/* Ações */}
           <div className="flex items-center gap-1">
            {/* Menu de três pontos: editar, salvar, excluir */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Ações do lead">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {leadVinculado ? (
                  <>
                    <DropdownMenuItem onClick={() => setEditLeadOpen(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar lead
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        try {
                          const id = leadVinculado.id;
                          if (!id) return;
                          const { supabase } = await import("@/integrations/supabase/client");
                          const { error } = await supabase
                            .from('leads')
                            .delete()
                            .eq('id', id);
                          if (error) throw error;
                          toast.success('Lead excluído');
                        } catch (e) {
                          console.error('Erro ao excluir lead:', e);
                          toast.error('Erro ao excluir lead');
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir lead
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={onCriarLead}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar lead no CRM
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
             {onFinalizeAtendimento && (
               <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     variant="outline"
                     size="sm"
                     className="mr-2"
                     title="Finalizar atendimento"
                   >
                     Finalizar
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-lg">
                   <UIDialogHeader>
                     <DialogTitle>Mensagem de finalização</DialogTitle>
                   </UIDialogHeader>
                   <div className="space-y-3">
                     <Textarea
                       rows={6}
                       value={finalizeMessage}
                       onChange={(e) => setFinalizeMessage(e.target.value)}
                     />
                     <div className="flex justify-between">
                       <Button
                         variant="ghost"
                         onClick={() => {
                           localStorage.setItem("continuum_finalize_template", finalizeMessage);
                         }}
                       >
                         Salvar como padrão
                       </Button>
                       <div className="flex gap-2">
                         <Button variant="outline" onClick={() => setFinalizeOpen(false)}>Cancelar</Button>
                         <Button
                           onClick={() => {
                             onFinalizeAtendimento(finalizeMessage);
                             localStorage.setItem("continuum_finalize_template", finalizeMessage);
                             setFinalizeOpen(false);
                           }}
                         >
                           Enviar e finalizar
                         </Button>
                       </div>
                     </div>
                   </div>
                 </DialogContent>
               </Dialog>
             )}
             <Button 
               variant="ghost" 
               size="icon"
               className="hover:bg-primary/10"
               title="Ligar"
             >
               <Phone className="h-5 w-5" />
             </Button>
             <Button 
               variant="ghost" 
               size="icon"
               className="hover:bg-primary/10"
               title="Videochamada"
             >
               <Video className="h-5 w-5" />
             </Button>
             <Button 
               variant="ghost" 
               size="icon"
               onClick={onToggleInfoPanel}
               className={showInfoPanel ? "bg-primary/10 text-primary" : "hover:bg-primary/10"}
               title="Informações"
             >
               <Info className="h-5 w-5" />
             </Button>
           </div>
         </div>
         {/* Informações do Lead */}
         {(tags.length > 0 || funnelStage || produto || valor || responsavel) && (
           <div className="space-y-2 pt-2 border-t border-border/50">
             {/* Tags */}
             {tags.length > 0 && (
               <div className="flex flex-wrap gap-1.5">
                 {tags.map((tag, index) => (
                   <Badge 
                     key={index} 
                     variant="secondary" 
                     className="text-xs px-2 py-0.5"
                   >
                     {tag}
                   </Badge>
                 ))}
               </div>
             )}
             {/* Dados do Lead */}
             <div className="flex items-center gap-2 flex-wrap">
               {funnelStage && (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 rounded-md">
                   <span className="text-xs font-medium text-purple-700">📊 {funnelStage}</span>
                 </div>
               )}
               {produto && (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 rounded-md">
                   <FileText className="h-3.5 w-3.5 text-primary" />
                   <span className="text-xs font-medium text-foreground">{produto}</span>
                 </div>
               )}
               {valor && (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 rounded-md">
                   <DollarSign className="h-3.5 w-3.5 text-green-600" />
                   <span className="text-xs font-semibold text-green-700">{valor}</span>
                 </div>
               )}
               {responsavel && (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 rounded-md">
                   <User className="h-3.5 w-3.5 text-blue-600" />
                   <span className="text-xs font-medium text-blue-700">{responsavel}</span>
                 </div>
               )}
             </div>
           </div>
         )}
       </div>
      {/* Dialogo de edição de lead controlado pelo menu */}
      {leadVinculado && (
        <EditarInformacoesLeadDialog
          leadId={leadVinculado.id || null}
          telefone={leadVinculado.telefone || leadVinculado.phone || ''}
          nomeContato={contactName}
          onLeadUpdated={() => {
            toast.success('Lead atualizado');
          }}
        />
      )}
     </div>
   );
 }


