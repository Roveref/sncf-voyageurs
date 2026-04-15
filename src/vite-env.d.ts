/// <reference types="vite/client" />

interface FilePickerOptions {
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
  multiple?: boolean;
}

interface Window {
  showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>;
  __ganttPerf?: () => void;
}
