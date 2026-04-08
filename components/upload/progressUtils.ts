export type AnalysisProgress = {
  currentFile: number;
  totalFiles: number;
  currentFileName: string;
  isAnalyzing: boolean;
  currentFileProgress: number;
};

export const createIdleProgress = (): AnalysisProgress => ({
  currentFile: 0,
  totalFiles: 0,
  currentFileName: '',
  isAnalyzing: false,
  currentFileProgress: 0,
});

export const createProgressForTotal = (totalFiles: number): AnalysisProgress => ({
  currentFile: 0,
  totalFiles,
  currentFileName: '',
  isAnalyzing: false,
  currentFileProgress: 0,
});

export const createProgressForActiveFile = (
  fileIndex: number,
  totalFiles: number,
  fileName: string
): AnalysisProgress => ({
  currentFile: fileIndex,
  totalFiles,
  currentFileName: fileName,
  isAnalyzing: true,
  currentFileProgress: 0,
});

export const createProgressForCompletedFile = (
  fileIndex: number,
  totalFiles: number,
  fileName: string
): AnalysisProgress => ({
  currentFile: fileIndex + 1,
  totalFiles,
  currentFileName: fileName,
  isAnalyzing: true,
  currentFileProgress: 1,
});

export const computeProgressPercent = (progress: AnalysisProgress): number => {
  if (progress.totalFiles <= 0) return 0;

  return Math.min(
    99,
    Math.round(
      ((progress.currentFile + (progress.isAnalyzing ? progress.currentFileProgress : 0)) /
        progress.totalFiles) *
        100
    )
  );
};

export const computeDisplayedFileNumber = (progress: AnalysisProgress): number => {
  if (progress.isAnalyzing) {
    return Math.min(progress.currentFile + 1, progress.totalFiles);
  }

  return progress.currentFile;
};
