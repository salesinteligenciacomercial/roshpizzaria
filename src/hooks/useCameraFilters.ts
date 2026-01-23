import { useState, useEffect, useCallback } from 'react';

export interface CameraFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  softFocus: number;
  mirrorCamera: boolean;
}

export interface CameraPreset {
  name: string;
  label: string;
  filters: Partial<CameraFilters>;
}

const DEFAULT_FILTERS: CameraFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  softFocus: 0,
  mirrorCamera: true,
};

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    name: 'normal',
    label: 'Normal',
    filters: { brightness: 0, contrast: 0, saturation: 0, softFocus: 0 },
  },
  {
    name: 'low-light',
    label: 'Luz Baixa',
    filters: { brightness: 25, contrast: 10, saturation: 0, softFocus: 0 },
  },
  {
    name: 'professional',
    label: 'Profissional',
    filters: { brightness: 5, contrast: 8, saturation: -10, softFocus: 0.3 },
  },
  {
    name: 'vibrant',
    label: 'Vibrante',
    filters: { brightness: 10, contrast: 5, saturation: 20, softFocus: 0 },
  },
  {
    name: 'soft',
    label: 'Suave',
    filters: { brightness: 5, contrast: -5, saturation: -5, softFocus: 0.5 },
  },
];

const STORAGE_KEY = 'camera-filters-preferences';

export function useCameraFilters() {
  const [filters, setFilters] = useState<CameraFilters>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading camera filters:', e);
    }
    return DEFAULT_FILTERS;
  });

  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Save to localStorage whenever filters change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.error('Error saving camera filters:', e);
    }
  }, [filters]);

  // Check if current filters match any preset
  useEffect(() => {
    const matchingPreset = CAMERA_PRESETS.find((preset) => {
      return (
        filters.brightness === (preset.filters.brightness ?? 0) &&
        filters.contrast === (preset.filters.contrast ?? 0) &&
        filters.saturation === (preset.filters.saturation ?? 0) &&
        filters.softFocus === (preset.filters.softFocus ?? 0)
      );
    });
    setActivePreset(matchingPreset?.name ?? null);
  }, [filters]);

  const updateFilter = useCallback((key: keyof CameraFilters, value: number | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyPreset = useCallback((presetName: string) => {
    const preset = CAMERA_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setFilters((prev) => ({
        ...prev,
        brightness: preset.filters.brightness ?? 0,
        contrast: preset.filters.contrast ?? 0,
        saturation: preset.filters.saturation ?? 0,
        softFocus: preset.filters.softFocus ?? 0,
      }));
    }
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const getFilterStyle = useCallback((): React.CSSProperties => {
    return {
      filter: `
        brightness(${1 + filters.brightness / 100}) 
        contrast(${1 + filters.contrast / 100}) 
        saturate(${1 + filters.saturation / 100})
        ${filters.softFocus > 0 ? `blur(${filters.softFocus}px)` : ''}
      `.trim(),
      transform: filters.mirrorCamera ? 'scaleX(-1)' : 'none',
    };
  }, [filters]);

  const getFilterStyleString = useCallback((): string => {
    return `
      brightness(${1 + filters.brightness / 100}) 
      contrast(${1 + filters.contrast / 100}) 
      saturate(${1 + filters.saturation / 100})
      ${filters.softFocus > 0 ? `blur(${filters.softFocus}px)` : ''}
    `.trim();
  }, [filters]);

  return {
    filters,
    activePreset,
    updateFilter,
    applyPreset,
    resetFilters,
    getFilterStyle,
    getFilterStyleString,
    presets: CAMERA_PRESETS,
  };
}
