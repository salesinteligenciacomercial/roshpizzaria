import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bot, BotOff, Calendar, Workflow, Sparkles, ChevronDown } from "lucide-react";

export type AIMode = 'off' | 'atendimento' | 'agendamento' | 'fluxo' | 'all';

interface AIModeSelectorDropdownProps {
  currentMode: AIMode;
  onModeChange: (mode: AIMode) => void;
  compact?: boolean;
}

const AI_MODE_OPTIONS: { value: AIMode; label: string; shortLabel: string; icon: React.ReactNode; description: string }[] = [
  { value: 'off', label: 'Desativar IA', shortLabel: 'IA Off', icon: <BotOff className="h-4 w-4" />, description: 'Nenhuma IA responde' },
  { value: 'atendimento', label: 'IA Atendimento', shortLabel: 'Atendimento', icon: <Bot className="h-4 w-4" />, description: 'Só IA de atendimento responde' },
  { value: 'agendamento', label: 'IA Agendamento', shortLabel: 'Agendamento', icon: <Calendar className="h-4 w-4" />, description: 'Só IA de agendamento responde' },
  { value: 'fluxo', label: 'Fluxo/URA', shortLabel: 'URA', icon: <Workflow className="h-4 w-4" />, description: 'Ativa apenas fluxos de automação' },
  { value: 'all', label: 'Todas as IAs', shortLabel: 'Todas', icon: <Sparkles className="h-4 w-4" />, description: 'Orchestrator decide qual usar' },
];

function getModeConfig(mode: AIMode) {
  return AI_MODE_OPTIONS.find(o => o.value === mode) || AI_MODE_OPTIONS[0];
}

export function AIModeSelectorDropdown({ currentMode, onModeChange, compact = false }: AIModeSelectorDropdownProps) {
  const config = getModeConfig(currentMode);
  const isActive = currentMode !== 'off';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            variant={isActive ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            title={config.label}
          >
            {config.icon}
          </Button>
        ) : (
          <Button
            variant={isActive ? "default" : "outline"}
            size="sm"
            className="mr-1 gap-1.5"
          >
            {config.icon}
            <span>{config.shortLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 z-50 bg-popover">
        {AI_MODE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onModeChange(option.value)}
            className={`flex items-center gap-2 cursor-pointer ${currentMode === option.value ? 'bg-accent' : ''}`}
          >
            {option.icon}
            <div className="flex flex-col">
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
