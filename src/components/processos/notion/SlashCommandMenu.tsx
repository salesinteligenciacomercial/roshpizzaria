import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Image,
  Minus,
  AlertCircle,
  ToggleRight,
  Link as LinkIcon,
  File,
  Video,
  LayoutGrid,
  FileText,
  Workflow,
  GitBranch,
  CalendarDays,
  Table,
  Database,
  MessageSquare,
  Bookmark,
  Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SlashCommand {
  type: string;
  icon: React.ComponentType<any>;
  label: string;
  description: string;
  shortcut?: string;
  category: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  // Básico
  { type: 'paragraph', icon: Type, label: 'Texto', description: 'Parágrafo de texto simples', shortcut: '', category: 'Básico' },
  { type: 'heading1', icon: Heading1, label: 'Título 1', description: 'Título grande', shortcut: '#', category: 'Básico' },
  { type: 'heading2', icon: Heading2, label: 'Título 2', description: 'Título médio', shortcut: '##', category: 'Básico' },
  { type: 'heading3', icon: Heading3, label: 'Título 3', description: 'Título pequeno', shortcut: '###', category: 'Básico' },
  
  // Listas
  { type: 'bullet_list', icon: List, label: 'Lista com marcadores', description: 'Lista simples com pontos', shortcut: '-', category: 'Listas' },
  { type: 'numbered_list', icon: ListOrdered, label: 'Lista numerada', description: 'Lista com números sequenciais', shortcut: '1.', category: 'Listas' },
  { type: 'checklist', icon: CheckSquare, label: 'Lista de tarefas', description: 'Checklist com caixas de seleção', shortcut: '[]', category: 'Listas' },
  { type: 'toggle', icon: ToggleRight, label: 'Toggle', description: 'Conteúdo colapsável', shortcut: '>', category: 'Listas' },
  
  // Database & Views
  { type: 'kanban', icon: LayoutGrid, label: 'Kanban Board', description: 'Quadro com colunas e cards', category: 'Database' },
  { type: 'table', icon: Table, label: 'Tabela', description: 'Tabela inline editável', category: 'Database' },
  { type: 'database', icon: Database, label: 'Database', description: 'Mini database com filtros', category: 'Database' },
  
  // Processos
  { type: 'playbook', icon: FileText, label: 'Playbook', description: 'Guia de vendas e atendimento', category: 'Processos' },
  { type: 'cadence', icon: Workflow, label: 'Cadência', description: 'Sequência de follow-up', category: 'Processos' },
  { type: 'stage', icon: GitBranch, label: 'Etapa', description: 'Etapa do funil comercial', category: 'Processos' },
  { type: 'agenda', icon: CalendarDays, label: 'Agenda', description: 'Calendário de compromissos', category: 'Processos' },
  
  // Formatação
  { type: 'quote', icon: Quote, label: 'Citação', description: 'Bloco de citação destacado', shortcut: '>', category: 'Formatação' },
  { type: 'callout', icon: AlertCircle, label: 'Destaque', description: 'Caixa de informação colorida', shortcut: '!', category: 'Formatação' },
  { type: 'code', icon: Code, label: 'Código', description: 'Bloco de código com sintaxe', shortcut: '```', category: 'Formatação' },
  { type: 'divider', icon: Minus, label: 'Divisor', description: 'Linha horizontal separadora', shortcut: '---', category: 'Formatação' },
  
  // Mídia
  { type: 'image', icon: Image, label: 'Imagem', description: 'Upload ou URL de imagem', category: 'Mídia' },
  { type: 'file', icon: File, label: 'Arquivo', description: 'Upload de documento', category: 'Mídia' },
  { type: 'link', icon: LinkIcon, label: 'Link', description: 'Link com preview', category: 'Mídia' },
  { type: 'embed', icon: Video, label: 'Embed', description: 'YouTube, Vimeo, Figma...', category: 'Mídia' },
  { type: 'bookmark', icon: Bookmark, label: 'Bookmark', description: 'Link com preview rico', category: 'Mídia' },
];

interface SlashCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: SlashCommand) => void;
  position?: { top: number; left: number };
  searchTerm?: string;
}

export function SlashCommandMenu({ 
  isOpen, 
  onClose, 
  onSelect, 
  position,
  searchTerm = ''
}: SlashCommandMenuProps) {
  const [internalSearch, setInternalSearch] = useState(searchTerm);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInternalSearch(searchTerm);
  }, [searchTerm]);

  const filteredCommands = SLASH_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(internalSearch.toLowerCase()) ||
    cmd.description.toLowerCase().includes(internalSearch.toLowerCase()) ||
    cmd.type.toLowerCase().includes(internalSearch.toLowerCase())
  );

  const categories = [...new Set(filteredCommands.map(c => c.category))];

  const flatCommands = categories.flatMap(cat => 
    filteredCommands.filter(c => c.category === cat)
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [internalSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < flatCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : flatCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          onSelect(flatCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, flatCommands, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-80 max-h-[80vh] rounded-lg border border-border bg-popover shadow-lg flex flex-col"
      style={position ? { top: position.top, left: position.left } : undefined}
      onKeyDown={handleKeyDown}
    >
      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar blocos..."
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            autoFocus
          />
        </div>
      </div>

      {/* Commands */}
      <ScrollArea className="flex-1 max-h-[60vh]">
        <div className="p-1">
          {categories.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum bloco encontrado
            </div>
          ) : (
            categories.map((category, catIndex) => (
              <div key={category} className={cn(catIndex > 0 && "mt-2")}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                  {category}
                </div>
                {filteredCommands
                  .filter(c => c.category === category)
                  .map((cmd, cmdIndex) => {
                    const Icon = cmd.icon;
                    const globalIndex = flatCommands.indexOf(cmd);
                    const isSelected = selectedIndex === globalIndex;
                    
                    return (
                      <button
                        key={cmd.type}
                        className={cn(
                          "w-full flex items-start gap-3 px-2 py-2 rounded-md text-left transition-colors",
                          isSelected ? "bg-accent" : "hover:bg-muted/50"
                        )}
                        onClick={() => onSelect(cmd)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{cmd.label}</span>
                            {cmd.shortcut && (
                              <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                                {cmd.shortcut}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {cmd.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
        <span><kbd className="px-1 bg-muted rounded">↑↓</kbd> navegar</span>
        <span><kbd className="px-1 bg-muted rounded">Enter</kbd> selecionar</span>
        <span><kbd className="px-1 bg-muted rounded">Esc</kbd> fechar</span>
      </div>
    </div>
  );
}

export { SLASH_COMMANDS };
