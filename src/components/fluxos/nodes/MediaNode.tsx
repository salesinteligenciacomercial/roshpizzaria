import { Handle, Position } from 'reactflow';
import { Image, Video, Mic, FileText, Paperclip } from 'lucide-react';

export function MediaNode({ data }: any) {
  const getMediaIcon = () => {
    switch (data.mediaType) {
      case 'imagem':
        return <Image className="h-5 w-5" />;
      case 'video':
        return <Video className="h-5 w-5" />;
      case 'audio':
        return <Mic className="h-5 w-5" />;
      case 'documento':
        return <FileText className="h-5 w-5" />;
      default:
        return <Paperclip className="h-5 w-5" />;
    }
  };

  const getMediaLabel = () => {
    switch (data.mediaType) {
      case 'imagem': return 'Imagem';
      case 'video': return 'Vídeo';
      case 'audio': return 'Áudio';
      case 'documento': return 'Documento';
      default: return 'Mídia';
    }
  };

  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 border-2 border-pink-400 min-w-[220px] max-w-[260px] break-words">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-pink-300 !border-2 !border-white"
      />
      
      <div className="flex items-center gap-3 text-white">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          {getMediaIcon()}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Enviar {getMediaLabel()}
          </div>
          <div className="font-bold text-sm">
            {data.label || `Enviar ${getMediaLabel()}`}
          </div>
        </div>
      </div>
      
      {data.mediaUrl && (
        <div className="mt-2 text-xs text-white/80 bg-white/10 rounded p-2 truncate">
          📎 {data.fileName || data.mediaUrl}
        </div>
      )}
      
      {data.caption && (
        <div className="mt-2 text-xs text-white/70 italic">
          "{data.caption.substring(0, 40)}..."
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-pink-300 !border-2 !border-white"
      />
    </div>
  );
}
