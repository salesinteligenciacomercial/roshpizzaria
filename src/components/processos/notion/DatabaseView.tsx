import { useState, useEffect } from "react";
import { 
  Plus, 
  Filter, 
  SortAsc, 
  SortDesc,
  MoreHorizontal,
  Trash2,
  GripVertical,
  ChevronDown,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Column {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'multi-select' | 'date' | 'checkbox' | 'person' | 'url';
  options?: string[];
  width?: number;
  visible?: boolean;
}

interface Row {
  id: string;
  values: Record<string, any>;
}

interface DatabaseViewProps {
  data?: {
    columns: Column[];
    rows: Row[];
  };
  onUpdate?: (data: { columns: Column[]; rows: Row[] }) => void;
  readOnly?: boolean;
}

const DEFAULT_COLUMNS: Column[] = [
  { id: 'name', name: 'Nome', type: 'text', width: 200, visible: true },
  { id: 'status', name: 'Status', type: 'select', options: ['Pendente', 'Em Progresso', 'Concluído'], width: 150, visible: true },
  { id: 'priority', name: 'Prioridade', type: 'select', options: ['Alta', 'Média', 'Baixa'], width: 120, visible: true },
  { id: 'date', name: 'Data', type: 'date', width: 140, visible: true },
];

export function DatabaseView({ data, onUpdate, readOnly = false }: DatabaseViewProps) {
  const [columns, setColumns] = useState<Column[]>(data?.columns || DEFAULT_COLUMNS);
  const [rows, setRows] = useState<Row[]>(data?.rows || []);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');

  useEffect(() => {
    if (data) {
      setColumns(data.columns || DEFAULT_COLUMNS);
      setRows(data.rows || []);
    }
  }, [data]);

  const saveChanges = (newColumns: Column[], newRows: Row[]) => {
    if (onUpdate) {
      onUpdate({ columns: newColumns, rows: newRows });
    }
  };

  const addColumn = () => {
    const newCol: Column = {
      id: `col_${Date.now()}`,
      name: 'Nova Coluna',
      type: 'text',
      width: 150,
      visible: true
    };
    const newColumns = [...columns, newCol];
    setColumns(newColumns);
    saveChanges(newColumns, rows);
  };

  const updateColumn = (colId: string, updates: Partial<Column>) => {
    const newColumns = columns.map(col => 
      col.id === colId ? { ...col, ...updates } : col
    );
    setColumns(newColumns);
    saveChanges(newColumns, rows);
  };

  const deleteColumn = (colId: string) => {
    const newColumns = columns.filter(col => col.id !== colId);
    const newRows = rows.map(row => {
      const { [colId]: _, ...rest } = row.values;
      return { ...row, values: rest };
    });
    setColumns(newColumns);
    setRows(newRows);
    saveChanges(newColumns, newRows);
  };

  const addRow = () => {
    const newRow: Row = {
      id: `row_${Date.now()}`,
      values: {}
    };
    const newRows = [...rows, newRow];
    setRows(newRows);
    saveChanges(columns, newRows);
  };

  const updateCell = (rowId: string, colId: string, value: any) => {
    const newRows = rows.map(row => 
      row.id === rowId 
        ? { ...row, values: { ...row.values, [colId]: value } }
        : row
    );
    setRows(newRows);
    saveChanges(columns, newRows);
  };

  const deleteRow = (rowId: string) => {
    const newRows = rows.filter(row => row.id !== rowId);
    setRows(newRows);
    saveChanges(columns, newRows);
  };

  const handleSort = (colId: string) => {
    if (sortColumn === colId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  };

  // Apply sorting and filtering
  let displayRows = [...rows];
  
  if (filterColumn && filterValue) {
    displayRows = displayRows.filter(row => {
      const val = String(row.values[filterColumn] || '').toLowerCase();
      return val.includes(filterValue.toLowerCase());
    });
  }
  
  if (sortColumn) {
    displayRows.sort((a, b) => {
      const valA = a.values[sortColumn] || '';
      const valB = b.values[sortColumn] || '';
      const cmp = String(valA).localeCompare(String(valB));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  const visibleColumns = columns.filter(col => col.visible !== false);

  const renderCell = (row: Row, col: Column) => {
    const value = row.values[col.id];

    if (readOnly) {
      switch (col.type) {
        case 'select':
        case 'multi-select':
          return value ? (
            <Badge variant="secondary" className="font-normal">
              {value}
            </Badge>
          ) : null;
        case 'checkbox':
          return value ? '✓' : '✗';
        case 'date':
          return value ? new Date(value).toLocaleDateString('pt-BR') : '';
        default:
          return value;
      }
    }

    switch (col.type) {
      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => updateCell(row.id, col.id, val)}
          >
            <SelectTrigger className="h-7 border-0 shadow-none">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {(col.options || []).map(opt => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => updateCell(row.id, col.id, e.target.checked)}
            className="h-4 w-4 rounded"
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
            className="h-7 border-0 shadow-none"
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
            className="h-7 border-0 shadow-none"
          />
        );
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
            className="h-7 border-0 shadow-none"
          />
        );
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1">
                <Filter className="h-3.5 w-3.5" />
                <span className="text-xs">Filtrar</span>
                {filterValue && <Badge variant="secondary" className="h-4 px-1 text-[10px]">1</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-3">
              <div className="space-y-2">
                <Select value={filterColumn || ''} onValueChange={setFilterColumn}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Coluna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Valor..."
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="h-8"
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setFilterColumn(null); setFilterValue(''); }}
                  className="w-full h-7"
                >
                  Limpar filtro
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort indicator */}
          {sortColumn && (
            <Badge variant="outline" className="gap-1">
              {sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
              {columns.find(c => c.id === sortColumn)?.name}
            </Badge>
          )}
        </div>

        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={addColumn} className="h-7 gap-1">
            <Plus className="h-3.5 w-3.5" />
            <span className="text-xs">Coluna</span>
          </Button>
        )}
      </div>

      {/* Table */}
      <ScrollArea className="w-full">
        <div className="min-w-max">
          {/* Header */}
          <div className="flex border-b border-border bg-muted/50">
            <div className="w-8 flex-shrink-0" /> {/* Drag handle space */}
            {visibleColumns.map(col => (
              <div
                key={col.id}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground border-r border-border last:border-r-0"
                style={{ width: col.width || 150 }}
              >
                <button
                  onClick={() => handleSort(col.id)}
                  className="flex-1 text-left hover:text-foreground transition-colors"
                >
                  {col.name}
                </button>
                {sortColumn === col.id && (
                  sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                )}
                {!readOnly && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateColumn(col.id, { visible: false })}>
                        <EyeOff className="h-4 w-4 mr-2" /> Ocultar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => deleteColumn(col.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
            <div className="w-10 flex-shrink-0" /> {/* Actions space */}
          </div>

          {/* Rows */}
          {displayRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              {filterValue ? 'Nenhum resultado encontrado' : 'Nenhum registro. Clique em + para adicionar.'}
            </div>
          ) : (
            displayRows.map(row => (
              <div key={row.id} className="flex group border-b border-border last:border-b-0 hover:bg-muted/30">
                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                  {!readOnly && (
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                  )}
                </div>
                {visibleColumns.map(col => (
                  <div
                    key={col.id}
                    className="px-2 py-1 border-r border-border last:border-r-0"
                    style={{ width: col.width || 150 }}
                  >
                    {renderCell(row, col)}
                  </div>
                ))}
                <div className="w-10 flex-shrink-0 flex items-center justify-center">
                  {!readOnly && (
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Add row */}
          {!readOnly && (
            <button
              onClick={addRow}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar linha
            </button>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
