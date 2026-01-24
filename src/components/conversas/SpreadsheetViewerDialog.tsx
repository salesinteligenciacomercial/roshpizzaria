import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Loader2, FileSpreadsheet, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";

interface SpreadsheetViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  fileName?: string;
}

interface SheetData {
  name: string;
  data: (string | number | boolean | null)[][];
  headers: string[];
}

export function SpreadsheetViewerDialog({
  open,
  onOpenChange,
  url,
  fileName,
}: SpreadsheetViewerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 50;

  useEffect(() => {
    if (open && url) {
      loadSpreadsheet();
    }
  }, [open, url]);

  const loadSpreadsheet = async () => {
    setLoading(true);
    setError(null);
    setSheets([]);
    setCurrentPage(0);

    try {
      console.log("📊 [SPREADSHEET-VIEWER] Carregando planilha:", url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      console.log("📊 [SPREADSHEET-VIEWER] Planilha carregada, abas:", workbook.SheetNames);

      const loadedSheets: SheetData[] = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
          worksheet,
          { header: 1, defval: "" }
        );

        // Primeira linha como headers
        const headers = (jsonData[0] || []).map((h, i) => 
          h?.toString() || `Coluna ${i + 1}`
        );
        
        // Restante como dados
        const data = jsonData.slice(1).filter(row => 
          row.some(cell => cell !== null && cell !== undefined && cell !== "")
        );

        return {
          name: sheetName,
          headers,
          data,
        };
      });

      setSheets(loadedSheets);
      if (loadedSheets.length > 0) {
        setActiveSheet(loadedSheets[0].name);
      }

      console.log("📊 [SPREADSHEET-VIEWER] Planilha processada com sucesso");
    } catch (err) {
      console.error("❌ [SPREADSHEET-VIEWER] Erro ao carregar planilha:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar planilha");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "planilha.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const activeSheetData = sheets.find((s) => s.name === activeSheet);
  const totalPages = activeSheetData 
    ? Math.ceil(activeSheetData.data.length / rowsPerPage) 
    : 0;
  const paginatedData = activeSheetData
    ? activeSheetData.data.slice(
        currentPage * rowsPerPage,
        (currentPage + 1) * rowsPerPage
      )
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <DialogTitle className="text-lg">
                {fileName || "Planilha"}
              </DialogTitle>
              {sheets.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {sheets.length} {sheets.length === 1 ? "aba" : "abas"}
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="mr-8"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-3" />
              <span className="text-sm text-muted-foreground">
                Carregando planilha...
              </span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mb-3" />
              <span className="text-sm text-destructive font-medium">
                Erro ao carregar planilha
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                {error}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSpreadsheet}
                className="mt-4"
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {!loading && !error && sheets.length > 0 && (
            <Tabs
              value={activeSheet}
              onValueChange={(value) => {
                setActiveSheet(value);
                setCurrentPage(0);
              }}
              className="h-full flex flex-col"
            >
              {sheets.length > 1 && (
                <TabsList className="flex-shrink-0 w-full justify-start overflow-x-auto">
                  {sheets.map((sheet) => (
                    <TabsTrigger
                      key={sheet.name}
                      value={sheet.name}
                      className="text-xs"
                    >
                      {sheet.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}

              {sheets.map((sheet) => (
                <TabsContent
                  key={sheet.name}
                  value={sheet.name}
                  className="flex-1 overflow-hidden mt-2"
                >
                  <ScrollArea className="h-[calc(70vh-120px)] border rounded-md">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted z-10">
                        <TableRow>
                          <TableHead className="w-12 text-center font-bold text-xs bg-muted">
                            #
                          </TableHead>
                          {sheet.headers.map((header, i) => (
                            <TableHead
                              key={i}
                              className="font-bold text-xs bg-muted whitespace-nowrap"
                            >
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedData.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            <TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {currentPage * rowsPerPage + rowIndex + 1}
                            </TableCell>
                            {sheet.headers.map((_, colIndex) => (
                              <TableCell
                                key={colIndex}
                                className="text-xs whitespace-nowrap max-w-[300px] truncate"
                                title={row[colIndex]?.toString() || ""}
                              >
                                {row[colIndex]?.toString() || ""}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 px-2">
                      <span className="text-xs text-muted-foreground">
                        Mostrando {currentPage * rowsPerPage + 1} -{" "}
                        {Math.min(
                          (currentPage + 1) * rowsPerPage,
                          activeSheetData?.data.length || 0
                        )}{" "}
                        de {activeSheetData?.data.length || 0} linhas
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                          disabled={currentPage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs">
                          Página {currentPage + 1} de {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                          }
                          disabled={currentPage >= totalPages - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}

          {!loading && !error && sheets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
              <span className="text-sm text-muted-foreground">
                Planilha vazia ou formato não suportado
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
