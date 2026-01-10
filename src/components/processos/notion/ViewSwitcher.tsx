import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  LayoutGrid,
  Table,
  Image,
  Calendar,
  GanttChart,
  ChevronDown,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewType = 'document' | 'kanban' | 'table' | 'gallery' | 'calendar' | 'timeline';

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  className?: string;
}

const views: { type: ViewType; label: string; icon: React.ComponentType<any>; description: string }[] = [
  { type: 'document', label: 'Documento', icon: FileText, description: 'Visualização padrão de documento' },
  { type: 'kanban', label: 'Kanban', icon: LayoutGrid, description: 'Quadro com colunas arrastáveis' },
  { type: 'table', label: 'Tabela', icon: Table, description: 'Dados em formato de tabela' },
  { type: 'gallery', label: 'Galeria', icon: Image, description: 'Cards visuais em grid' },
  { type: 'calendar', label: 'Calendário', icon: Calendar, description: 'Visualização por datas' },
  { type: 'timeline', label: 'Timeline', icon: GanttChart, description: 'Linha do tempo Gantt' },
];

export function ViewSwitcher({ currentView, onViewChange, className }: ViewSwitcherProps) {
  const currentViewData = views.find(v => v.type === currentView) || views[0];
  const CurrentIcon = currentViewData.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("gap-2", className)}
        >
          <CurrentIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{currentViewData.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          VISUALIZAÇÃO
        </div>
        {views.map((view) => {
          const Icon = view.icon;
          return (
            <DropdownMenuItem
              key={view.type}
              onClick={() => onViewChange(view.type)}
              className="flex items-start gap-3 py-2"
            >
              <Icon className="h-4 w-4 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{view.label}</span>
                  {currentView === view.type && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{view.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Dica: Cada página pode ter sua própria visualização padrão
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
