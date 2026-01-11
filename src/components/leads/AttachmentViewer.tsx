import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  X, 
  ZoomIn, 
  ZoomOut,
  Calendar,
  FileText,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { downloadFile } from '@/utils/downloadFile';
import type { LeadAttachment } from './LeadAttachments';

interface AttachmentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: LeadAttachment;
  allAttachments: LeadAttachment[];
  onNavigate: (attachment: LeadAttachment) => void;
}

// Helper function to determine file type from file_type or mime_type
const getFileCategory = (attachment: LeadAttachment): 'image' | 'video' | 'audio' | 'pdf' | 'document' => {
  const fileType = attachment.file_type?.toLowerCase() || '';
  const mimeType = attachment.mime_type?.toLowerCase() || '';
  const fileName = attachment.file_name?.toLowerCase() || '';
  
  // Check simplified type first
  if (fileType === 'image' || mimeType.startsWith('image/')) return 'image';
  if (fileType === 'video' || mimeType.startsWith('video/')) return 'video';
  if (fileType === 'audio' || mimeType.startsWith('audio/')) return 'audio';
  if (fileType === 'pdf' || mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf';
  
  return 'document';
};

export function AttachmentViewer({
  open,
  onOpenChange,
  attachment,
  allAttachments,
  onNavigate
}: AttachmentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [pdfError, setPdfError] = useState(false);
  const currentIndex = allAttachments.findIndex(a => a.id === attachment.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allAttachments.length - 1;
  
  const fileCategory = getFileCategory(attachment);

  const handlePrev = () => {
    if (hasPrev) {
      onNavigate(allAttachments[currentIndex - 1]);
      setZoom(1);
      setPdfError(false);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onNavigate(allAttachments[currentIndex + 1]);
      setZoom(1);
      setPdfError(false);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'antes': return 'bg-orange-500/10 text-orange-500';
      case 'depois': return 'bg-green-500/10 text-green-500';
      case 'durante': return 'bg-blue-500/10 text-blue-500';
      case 'exame': return 'bg-purple-500/10 text-purple-500';
      case 'laudo': return 'bg-red-500/10 text-red-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleDownload = () => {
    downloadFile(attachment.file_url, attachment.file_name);
  };

  const handleOpenInNewTab = () => {
    window.open(attachment.file_url, '_blank');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onOpenChange(false);
  };

  const renderContent = () => {
    switch (fileCategory) {
      case 'image':
        return (
          <img
            src={attachment.file_url}
            alt={attachment.file_name}
            className="max-w-full max-h-[80vh] object-contain transition-transform"
            style={{ transform: `scale(${zoom})` }}
            onError={(e) => {
              console.error('Error loading image:', attachment.file_url);
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      
      case 'video':
        return (
          <video
            src={attachment.file_url}
            controls
            autoPlay
            className="max-w-full max-h-[80vh]"
          />
        );
      
      case 'audio':
        return (
          <div className="p-8">
            <audio src={attachment.file_url} controls autoPlay className="w-80" />
          </div>
        );
      
      case 'pdf':
        if (pdfError) {
          return (
            <div className="p-8 text-center text-white">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="mb-4">{attachment.file_name}</p>
              <p className="text-sm text-white/70 mb-4">
                Não foi possível exibir o PDF no navegador
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleOpenInNewTab} variant="secondary">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em Nova Aba
                </Button>
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </div>
          );
        }
        
        return (
          <div className="w-full h-[80vh] bg-white">
            <object
              data={attachment.file_url}
              type="application/pdf"
              className="w-full h-full"
              onError={() => setPdfError(true)}
            >
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(attachment.file_url)}&embedded=true`}
                className="w-full h-full border-0"
                title={attachment.file_name}
                onError={() => setPdfError(true)}
              />
            </object>
          </div>
        );
      
      default:
        return (
          <div className="p-8 text-center text-white">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="mb-4">{attachment.file_name}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleOpenInNewTab} variant="secondary">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em Nova Aba
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Arquivo
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-5xl max-h-[95vh] p-0 overflow-hidden" 
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              {attachment.category && (
                <Badge className={getCategoryColor(attachment.category)}>
                  {attachment.category.charAt(0).toUpperCase() + attachment.category.slice(1)}
                </Badge>
              )}
              <span className="font-medium">{attachment.file_name}</span>
            </div>
            <div className="flex items-center gap-2">
              {fileCategory === 'image' && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={handleZoomOut}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs">{Math.round(zoom * 100)}%</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={handleZoomIn}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleOpenInNewTab}
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        {hasPrev && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {hasNext && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={handleNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {/* Content */}
        <div className="flex items-center justify-center min-h-[500px] bg-black/90 overflow-auto">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="flex items-center justify-between text-white text-sm">
            <div className="flex items-center gap-4">
              {attachment.treatment_name && (
                <span>Tratamento: {attachment.treatment_name}</span>
              )}
              {attachment.treatment_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(attachment.treatment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
            <span className="opacity-70">
              {currentIndex + 1} de {allAttachments.length}
            </span>
          </div>
          {attachment.description && (
            <p className="text-white/70 text-xs mt-2">{attachment.description}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
