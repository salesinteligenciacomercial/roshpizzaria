import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, FileText } from 'lucide-react';
import { useState } from 'react';

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'pdf' | 'document';
  fileName?: string;
}

export const MediaPreviewDialog = ({
  open,
  onOpenChange,
  mediaUrl,
  mediaType,
  fileName
}: MediaPreviewDialogProps) => {
  const [pdfError, setPdfError] = useState(false);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = fileName || 'download';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderContent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <img
            src={mediaUrl}
            alt={fileName || 'Imagem'}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        );

      case 'video':
        return (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-w-full max-h-[70vh] rounded-lg"
          />
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center gap-4 p-8">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
              <FileText className="w-12 h-12 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{fileName || 'Áudio'}</p>
            <audio
              src={mediaUrl}
              controls
              autoPlay
              className="w-full max-w-md"
            />
          </div>
        );

      case 'pdf':
      case 'document':
        return (
          <div className="w-full h-[70vh] flex flex-col">
            {!pdfError ? (
              <iframe
                src={`${mediaUrl}#toolbar=1`}
                className="w-full h-full rounded-lg border-0"
                title={fileName || 'Documento'}
                onError={() => setPdfError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <FileText className="w-16 h-16 text-muted-foreground" />
                <p className="text-muted-foreground">Não foi possível visualizar o documento</p>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar documento
                </Button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <span className="text-sm font-medium truncate max-w-[70%]">
              {fileName || 'Arquivo'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                title="Baixar"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-4 bg-background/50 overflow-auto">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
