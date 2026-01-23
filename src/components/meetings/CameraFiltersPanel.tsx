import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { 
  SlidersHorizontal, 
  Sun, 
  Contrast, 
  Palette, 
  Sparkles,
  FlipHorizontal2,
  RotateCcw,
  User,
  Loader2
} from 'lucide-react';
import { CameraFilters, CAMERA_PRESETS } from '@/hooks/useCameraFilters';
import { BackgroundBlurOptions } from '@/hooks/useBackgroundBlur';

interface CameraFiltersPanelProps {
  filters: CameraFilters;
  activePreset: string | null;
  onUpdateFilter: (key: keyof CameraFilters, value: number | boolean) => void;
  onApplyPreset: (presetName: string) => void;
  onReset: () => void;
  // Background blur props
  isBlurEnabled?: boolean;
  isBlurLoading?: boolean;
  blurOptions?: BackgroundBlurOptions;
  onToggleBlur?: () => void;
  onUpdateBlurOptions?: (options: Partial<BackgroundBlurOptions>) => void;
}

export function CameraFiltersPanel({
  filters,
  activePreset,
  onUpdateFilter,
  onApplyPreset,
  onReset,
  isBlurEnabled = false,
  isBlurLoading = false,
  blurOptions,
  onToggleBlur,
  onUpdateBlurOptions,
}: CameraFiltersPanelProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="lg"
          className="rounded-full h-14 w-14"
          title="Configurações de câmera"
        >
          <SlidersHorizontal className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-4 max-h-[70vh] overflow-y-auto" 
        side="top" 
        align="center"
        sideOffset={16}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Configurações de Câmera</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Resetar
            </Button>
          </div>

          {/* Background Blur - Featured at top */}
          {onToggleBlur && (
            <>
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2 font-medium">
                    <User className="h-4 w-4" />
                    Desfoque de Fundo
                    {isBlurLoading && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </Label>
                  <Switch
                    checked={isBlurEnabled}
                    onCheckedChange={onToggleBlur}
                    disabled={isBlurLoading}
                  />
                </div>
                
                {isBlurEnabled && blurOptions && onUpdateBlurOptions && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Intensidade do desfoque
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {blurOptions.blurAmount}px
                        </span>
                      </div>
                      <Slider
                        value={[blurOptions.blurAmount]}
                        onValueChange={([value]) => onUpdateBlurOptions({ blurAmount: value })}
                        min={3}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Suavização de bordas
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {blurOptions.edgeBlurAmount}px
                        </span>
                      </div>
                      <Slider
                        value={[blurOptions.edgeBlurAmount]}
                        onValueChange={([value]) => onUpdateBlurOptions({ edgeBlurAmount: value })}
                        min={0}
                        max={10}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
                
                <p className="text-[10px] text-muted-foreground">
                  Usa IA para desfocar o fundo e destacar você
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Presets */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Presets Rápidos</Label>
            <div className="flex flex-wrap gap-1.5">
              {CAMERA_PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant={activePreset === preset.name ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => onApplyPreset(preset.name)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Brightness */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5" />
                Brilho
              </Label>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {filters.brightness > 0 ? '+' : ''}{filters.brightness}%
              </span>
            </div>
            <Slider
              value={[filters.brightness]}
              onValueChange={([value]) => onUpdateFilter('brightness', value)}
              min={-50}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          {/* Contrast */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Contrast className="h-3.5 w-3.5" />
                Contraste
              </Label>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {filters.contrast > 0 ? '+' : ''}{filters.contrast}%
              </span>
            </div>
            <Slider
              value={[filters.contrast]}
              onValueChange={([value]) => onUpdateFilter('contrast', value)}
              min={-50}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          {/* Saturation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Saturação
              </Label>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {filters.saturation > 0 ? '+' : ''}{filters.saturation}%
              </span>
            </div>
            <Slider
              value={[filters.saturation]}
              onValueChange={([value]) => onUpdateFilter('saturation', value)}
              min={-50}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          {/* Soft Focus */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Suavização
              </Label>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {filters.softFocus.toFixed(1)}px
              </span>
            </div>
            <Slider
              value={[filters.softFocus]}
              onValueChange={([value]) => onUpdateFilter('softFocus', value)}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Mirror Camera */}
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5">
              <FlipHorizontal2 className="h-3.5 w-3.5" />
              Espelhar câmera
            </Label>
            <Switch
              checked={filters.mirrorCamera}
              onCheckedChange={(checked) => onUpdateFilter('mirrorCamera', checked)}
            />
          </div>

          <p className="text-[10px] text-muted-foreground mt-2">
            Os filtros são aplicados apenas na sua visualização local
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
