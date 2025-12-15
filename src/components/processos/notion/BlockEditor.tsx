import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Plus,
  GripVertical,
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
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Block {
  id: string;
  block_type: string;
  content: any;
  position: number;
}

interface BlockEditorProps {
  pageId: string;
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
}

const BLOCK_TYPES = [
  { type: 'paragraph', icon: Type, label: 'Texto', shortcut: '' },
  { type: 'heading1', icon: Heading1, label: 'Título 1', shortcut: '#' },
  { type: 'heading2', icon: Heading2, label: 'Título 2', shortcut: '##' },
  { type: 'heading3', icon: Heading3, label: 'Título 3', shortcut: '###' },
  { type: 'bullet_list', icon: List, label: 'Lista com marcadores', shortcut: '-' },
  { type: 'numbered_list', icon: ListOrdered, label: 'Lista numerada', shortcut: '1.' },
  { type: 'checklist', icon: CheckSquare, label: 'Lista de tarefas', shortcut: '[]' },
  { type: 'quote', icon: Quote, label: 'Citação', shortcut: '>' },
  { type: 'code', icon: Code, label: 'Código', shortcut: '```' },
  { type: 'callout', icon: AlertCircle, label: 'Destaque', shortcut: '!' },
  { type: 'divider', icon: Minus, label: 'Divisor', shortcut: '---' },
  { type: 'toggle', icon: ToggleRight, label: 'Toggle', shortcut: '>' },
];

export function BlockEditor({ pageId, blocks, onBlocksChange }: BlockEditorProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const blockRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const createBlock = async (type: string, position: number, parentBlockId?: string) => {
    try {
      const { data, error } = await supabase
        .from('process_blocks')
        .insert({
          page_id: pageId,
          block_type: type,
          content: { text: '' },
          position,
          parent_block_id: parentBlockId || null
        })
        .select()
        .single();

      if (error) throw error;

      const newBlocks = [...blocks];
      newBlocks.splice(position, 0, data);
      // Update positions
      newBlocks.forEach((block, idx) => {
        block.position = idx;
      });
      onBlocksChange(newBlocks);
      
      // Focus the new block
      setTimeout(() => {
        const ref = blockRefs.current.get(data.id);
        if (ref) ref.focus();
      }, 50);

      return data;
    } catch (error) {
      console.error('Error creating block:', error);
      toast.error('Erro ao criar bloco');
    }
  };

  const updateBlock = async (blockId: string, content: Block['content']) => {
    try {
      await supabase
        .from('process_blocks')
        .update({ content })
        .eq('id', blockId);

      const updatedBlocks = blocks.map(b => 
        b.id === blockId ? { ...b, content } : b
      );
      onBlocksChange(updatedBlocks);
    } catch (error) {
      console.error('Error updating block:', error);
    }
  };

  const deleteBlock = async (blockId: string) => {
    try {
      await supabase
        .from('process_blocks')
        .delete()
        .eq('id', blockId);

      const newBlocks = blocks.filter(b => b.id !== blockId);
      onBlocksChange(newBlocks);
    } catch (error) {
      toast.error('Erro ao excluir bloco');
    }
  };

  const changeBlockType = async (blockId: string, newType: string) => {
    try {
      await supabase
        .from('process_blocks')
        .update({ block_type: newType })
        .eq('id', blockId);

      const updatedBlocks = blocks.map(b => 
        b.id === blockId ? { ...b, block_type: newType } : b
      );
      onBlocksChange(updatedBlocks);
      setShowBlockMenu(null);
    } catch (error) {
      toast.error('Erro ao alterar tipo do bloco');
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent, block: Block, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await createBlock('paragraph', index + 1);
    }
    
    if (e.key === 'Backspace' && block.content.text === '' && blocks.length > 1) {
      e.preventDefault();
      await deleteBlock(block.id);
      // Focus previous block
      if (index > 0) {
        const prevBlock = blocks[index - 1];
        const ref = blockRefs.current.get(prevBlock.id);
        if (ref) ref.focus();
      }
    }

    // Shortcut detection
    if (e.key === ' ') {
      const text = block.content.text || '';
      const shortcuts: Record<string, string> = {
        '#': 'heading1',
        '##': 'heading2',
        '###': 'heading3',
        '-': 'bullet_list',
        '*': 'bullet_list',
        '1.': 'numbered_list',
        '[]': 'checklist',
        '>': 'quote',
        '---': 'divider',
        '!': 'callout',
      };

      for (const [shortcut, type] of Object.entries(shortcuts)) {
        if (text === shortcut) {
          e.preventDefault();
          await updateBlock(block.id, { text: '' });
          await changeBlockType(block.id, type);
          return;
        }
      }
    }

    // Arrow navigation
    if (e.key === 'ArrowUp' && index > 0) {
      const ref = blockRefs.current.get(blocks[index - 1].id);
      if (ref) {
        e.preventDefault();
        ref.focus();
      }
    }
    if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      const ref = blockRefs.current.get(blocks[index + 1].id);
      if (ref) {
        e.preventDefault();
        ref.focus();
      }
    }
  };

  const renderBlockContent = (block: Block, index: number) => {
    const commonProps = {
      ref: (el: HTMLTextAreaElement) => el && blockRefs.current.set(block.id, el),
      value: block.content.text || '',
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => 
        updateBlock(block.id, { ...block.content, text: e.target.value }),
      onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => handleKeyDown(e, block, index),
      onFocus: () => setFocusedBlockId(block.id),
      className: cn(
        "w-full resize-none border-0 bg-transparent focus:ring-0 focus-visible:ring-0 p-0",
        "placeholder:text-muted-foreground/50 overflow-hidden"
      ),
      placeholder: block.block_type === 'paragraph' ? "Digite '/' para comandos..." : '',
      rows: 1,
    };

    switch (block.block_type) {
      case 'heading1':
        return (
          <textarea
            {...commonProps}
            className={cn(commonProps.className, "text-3xl font-bold")}
            placeholder="Título 1"
          />
        );
      case 'heading2':
        return (
          <textarea
            {...commonProps}
            className={cn(commonProps.className, "text-2xl font-semibold")}
            placeholder="Título 2"
          />
        );
      case 'heading3':
        return (
          <textarea
            {...commonProps}
            className={cn(commonProps.className, "text-xl font-medium")}
            placeholder="Título 3"
          />
        );
      case 'bullet_list':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <textarea {...commonProps} placeholder="Item da lista" />
          </div>
        );
      case 'numbered_list':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1 text-muted-foreground">{index + 1}.</span>
            <textarea {...commonProps} placeholder="Item da lista" />
          </div>
        );
      case 'checklist':
        return (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={block.content.checked || false}
              onChange={(e) => updateBlock(block.id, { ...block.content, checked: e.target.checked })}
              className="mt-1.5 h-4 w-4 rounded border-muted-foreground/50"
            />
            <textarea
              {...commonProps}
              className={cn(commonProps.className, block.content.checked && "line-through text-muted-foreground")}
              placeholder="Tarefa"
            />
          </div>
        );
      case 'quote':
        return (
          <div className="border-l-4 border-primary/50 pl-4 italic">
            <textarea {...commonProps} placeholder="Citação..." />
          </div>
        );
      case 'code':
        return (
          <div className="bg-muted rounded-lg p-3 font-mono text-sm">
            <textarea {...commonProps} className={cn(commonProps.className, "font-mono")} placeholder="// Código..." />
          </div>
        );
      case 'callout':
        return (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
            <span>💡</span>
            <textarea {...commonProps} placeholder="Destaque..." />
          </div>
        );
      case 'divider':
        return <hr className="border-border my-2" />;
      case 'toggle':
        return (
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2">
              <ToggleRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
              <textarea {...commonProps} className={cn(commonProps.className, "font-medium")} placeholder="Toggle..." />
            </summary>
            <div className="ml-6 mt-2 text-muted-foreground">
              Conteúdo colapsável...
            </div>
          </details>
        );
      default:
        return <textarea {...commonProps} />;
    }
  };

  return (
    <div className="space-y-1 py-4">
      {blocks.length === 0 && (
        <div
          className="flex items-center gap-2 py-2 px-2 text-muted-foreground cursor-pointer hover:bg-muted/50 rounded"
          onClick={() => createBlock('paragraph', 0)}
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">Clique para começar a escrever...</span>
        </div>
      )}
      
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={cn(
            "group relative flex items-start gap-1 py-1 px-2 rounded transition-colors",
            focusedBlockId === block.id && "bg-muted/30"
          )}
        >
          {/* Block Controls */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute -left-14 top-1">
            <Popover open={showBlockMenu === block.id} onOpenChange={(open) => setShowBlockMenu(open ? block.id : null)}>
              <PopoverTrigger asChild>
                <button className="p-1 hover:bg-muted rounded">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">BLOCOS BÁSICOS</p>
                  {BLOCK_TYPES.map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                      onClick={() => changeBlockType(block.id, type)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <button className="p-1 hover:bg-muted rounded cursor-grab">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Block Content */}
          <div className="flex-1 min-w-0">
            {renderBlockContent(block, index)}
          </div>

          {/* Delete Button */}
          <button
            className="p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => deleteBlock(block.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
}
