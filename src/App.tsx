import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { DownloadGroupRow, DownloadGroupItem } from './components/DownloadGroupRow';
import { NewDownloadModal } from './components/NewDownloadModal';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { EmptyState } from './components/EmptyState';
import {
  DownloadTask,
  DownloadStatus,
  DownloadProgressPayload,
  FileCategory,
  StatusFilter,
} from './types/download';
import {
  listTasks,
  startDownload,
  pauseDownload,
  resumeDownload,
  removeTask,
  clearAllTasks,
  openFile,
  openContainingFolder,
  onDownloadProgress,
  onDownloadFinished,
  checkExtractorStatus,
  installExtractor,
} from './services/downloadApi';
import { TitleBar } from './components/TitleBar';
import { getFileCategory, formatSpeed } from './utils/formatters';
import './App.css';

export function App() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [isNewDownloadOpen, setIsNewDownloadOpen] = useState(false);
  const [inspectingTask, setInspectingTask] = useState<DownloadTask | null>(null);

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const [isInstallingExtractors, setIsInstallingExtractors] = useState(false);
  const [extractorInstallError, setExtractorInstallError] = useState<string | null>(null);

  // Auto-install extractors silently on mount
  useEffect(() => {
    const initExtractors = async () => {
      try {
        const status = await checkExtractorStatus();
        if (!status.ytdlp_installed || !status.ffmpeg_installed) {
          setIsInstallingExtractors(true);
          await installExtractor();
        }
      } catch (err) {
        setExtractorInstallError(String(err));
      } finally {
        setIsInstallingExtractors(false);
      }
    };
    initExtractors();
  }, []);

  // Active selected task reference
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  // Load tasks on mount
  const refreshTasks = useCallback(async () => {
    try {
      const data = await listTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }, []);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  // Listen for real-time progress and finished events
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenFinished: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unlistenProgress = await onDownloadProgress((payload: DownloadProgressPayload) => {
          const taskId = payload.id || payload.task_id;
          if (!taskId) return;

          setTasks((prevTasks) => {
            const index = prevTasks.findIndex((t) => t.id === taskId);
            if (index === -1) return prevTasks;

            const updated = [...prevTasks];
            const old = updated[index];
            updated[index] = {
              ...old,
              downloaded_bytes: payload.downloaded_bytes,
              total_bytes: payload.total_bytes ?? old.total_bytes,
              speed_bps: payload.speed_bps,
              progress_percentage: payload.progress_percentage ?? payload.progress_percent ?? old.progress_percentage,
              status: payload.status,
              segments: payload.segments && payload.segments.length > 0 ? payload.segments : old.segments,
              error_message: payload.error_message,
              stage_message: payload.stage_message !== undefined ? payload.stage_message : old.stage_message,
              is_media: payload.is_media !== undefined ? payload.is_media : old.is_media,
              thumbnail_url: payload.thumbnail_url !== undefined ? payload.thumbnail_url : old.thumbnail_url,
              media_thumbnail: payload.media_thumbnail !== undefined ? payload.media_thumbnail : old.media_thumbnail,
              duration_seconds: payload.duration_seconds !== undefined ? payload.duration_seconds : old.duration_seconds,
              media_duration: payload.media_duration !== undefined ? payload.media_duration : old.media_duration,
              resolution: payload.resolution !== undefined ? payload.resolution : old.resolution,
              is_animated_gif: payload.is_animated_gif !== undefined ? payload.is_animated_gif : old.is_animated_gif,
              group_id: payload.group_id !== undefined ? payload.group_id : old.group_id,
              updated_at: Date.now(),
            };
            return updated;
          });

          setInspectingTask((prev) => {
            if (prev && prev.id === taskId) {
              return {
                ...prev,
                downloaded_bytes: payload.downloaded_bytes,
                total_bytes: payload.total_bytes ?? prev.total_bytes,
                speed_bps: payload.speed_bps,
                progress_percentage: payload.progress_percentage ?? payload.progress_percent ?? prev.progress_percentage,
                status: payload.status,
                segments: payload.segments && payload.segments.length > 0 ? payload.segments : prev.segments,
                error_message: payload.error_message,
                stage_message: payload.stage_message !== undefined ? payload.stage_message : prev.stage_message,
                is_media: payload.is_media !== undefined ? payload.is_media : prev.is_media,
                thumbnail_url: payload.thumbnail_url !== undefined ? payload.thumbnail_url : prev.thumbnail_url,
                media_thumbnail: payload.media_thumbnail !== undefined ? payload.media_thumbnail : prev.media_thumbnail,
                duration_seconds: payload.duration_seconds !== undefined ? payload.duration_seconds : prev.duration_seconds,
                media_duration: payload.media_duration !== undefined ? payload.media_duration : prev.media_duration,
                resolution: payload.resolution !== undefined ? payload.resolution : prev.resolution,
                is_animated_gif: payload.is_animated_gif !== undefined ? payload.is_animated_gif : prev.is_animated_gif,
                group_id: payload.group_id !== undefined ? payload.group_id : prev.group_id,
              };
            }
            return prev;
          });
        });

        unlistenFinished = await onDownloadFinished((finishedTask: DownloadTask) => {
          setTasks((prevTasks) => {
            const exists = prevTasks.some((t) => t.id === finishedTask.id);
            if (!exists) return prevTasks;
            return prevTasks.map((t) => (t.id === finishedTask.id ? { ...t, ...finishedTask } : t));
          });
          setInspectingTask((prev) =>
            prev && prev.id === finishedTask.id ? { ...prev, ...finishedTask } : prev
          );
        });
      } catch (err) {
        console.error('Error setting up Tauri listeners:', err);
      }
    };

    setupListeners();

    // Periodic sync polling fallback (every 2.5 seconds)
    const interval = setInterval(() => {
      refreshTasks();
    }, 2500);

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenFinished) unlistenFinished();
      clearInterval(interval);
    };
  }, [refreshTasks]);

  // Filter tasks based on category, status, and search query
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Category Filter
      if (selectedCategory !== 'all') {
        const cat = getFileCategory(task.file_name, task.is_animated_gif);
        if (cat !== selectedCategory) return false;
      }

      // 2. Status Filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'downloading' && task.status !== 'downloading') return false;
        if (selectedStatus === 'paused' && task.status !== 'paused') return false;
        if (selectedStatus === 'completed' && task.status !== 'completed') return false;
        if (
          selectedStatus === 'failed' &&
          task.status !== 'failed' &&
          task.status !== 'cancelled'
        ) {
          return false;
        }
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = task.file_name.toLowerCase().includes(query);
        const matchesUrl = task.url.toLowerCase().includes(query);
        if (!matchesName && !matchesUrl) return false;
      }

      return true;
    });
  }, [tasks, selectedCategory, selectedStatus, searchQuery]);

  // Category counts computation
  const categoryCounts = useMemo(() => {
    const counts: Record<FileCategory, number> = {
      all: tasks.length,
      video: 0,
      audio: 0,
      image: 0,
      document: 0,
      program: 0,
      other: 0,
    };

    for (const t of tasks) {
      const cat = getFileCategory(t.file_name, t.is_animated_gif);
      counts[cat] = (counts[cat] || 0) + 1;
    }

    return counts;
  }, [tasks]);

  // Status counts computation
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: tasks.length,
      downloading: 0,
      paused: 0,
      completed: 0,
      failed: 0,
    };

    for (const t of tasks) {
      if (t.status === 'downloading') counts.downloading++;
      else if (t.status === 'paused') counts.paused++;
      else if (t.status === 'completed') counts.completed++;
      else if (t.status === 'failed' || t.status === 'cancelled') counts.failed++;
    }

    return counts;
  }, [tasks]);

  // Global aggregates
  const totalSpeedBps = useMemo(() => {
    return tasks
      .filter((t) => t.status === 'downloading')
      .reduce((sum, t) => sum + (t.speed_bps || 0), 0);
  }, [tasks]);

  const totalActiveDownloads = useMemo(() => {
    return tasks.filter((t) => t.status === 'downloading').length;
  }, [tasks]);

  // Group tasks for expandable tree view (Multi-Format)
  const taskGroups = useMemo<DownloadGroupItem[]>(() => {
    const groupMap = new Map<string, DownloadTask[]>();
    const groupOrder: string[] = [];

    for (const task of filteredTasks) {
      const key = task.group_id || task.id;

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        groupOrder.push(key);
      }
      groupMap.get(key)!.push(task);
    }

    return groupOrder.map((key) => {
      const gTasks = groupMap.get(key)!;
      const isMulti = Boolean(gTasks[0].group_id || gTasks.length > 1);

      let title = gTasks[0].file_name;
      if (isMulti) {
        const cleanBase = gTasks[0].file_name
          .replace(/\s*\[.*?\](\.[^.]*)?$/, '')
          .replace(/\.[^.]+$/, '');
        if (cleanBase.trim()) {
          title = cleanBase.trim();
        }
      }

      let totalBytes: number | null = 0;
      let allHaveTotal = true;
      let downloadedBytes = 0;
      let speedBps = 0;

      for (const t of gTasks) {
        downloadedBytes += t.downloaded_bytes;
        if (t.total_bytes && t.total_bytes > 0) {
          totalBytes = (totalBytes || 0) + t.total_bytes;
        } else {
          allHaveTotal = false;
        }
        if (t.status === 'downloading') {
          speedBps += t.speed_bps || 0;
        }
      }
      if (!allHaveTotal) {
        totalBytes = null;
      }

      let progressPercentage = 0;
      if (totalBytes && totalBytes > 0) {
        progressPercentage = Math.min(100, (downloadedBytes / totalBytes) * 100);
      } else {
        progressPercentage =
          gTasks.reduce((sum, t) => sum + (t.progress_percentage || 0), 0) /
          gTasks.length;
      }

      let status: DownloadStatus = 'completed';
      if (gTasks.some((t) => t.status === 'downloading')) {
        status = 'downloading';
      } else if (gTasks.some((t) => t.status === 'paused')) {
        status = 'paused';
      } else if (gTasks.some((t) => t.status === 'pending' || t.status === 'probing')) {
        status = 'pending';
      } else if (gTasks.some((t) => t.status === 'failed')) {
        status = 'failed';
      } else if (gTasks.some((t) => t.status === 'cancelled')) {
        status = 'cancelled';
      } else if (gTasks.every((t) => t.status === 'completed')) {
        status = 'completed';
      }

      const thumbnail =
        gTasks.find((t) => t.thumbnail_url || t.media_thumbnail)?.thumbnail_url ||
        gTasks[0].media_thumbnail;

      return {
        id: key,
        title,
        url: gTasks[0].url,
        thumbnail,
        tasks: gTasks,
        isMultiFormat: isMulti,
        totalBytes,
        downloadedBytes,
        speedBps,
        progressPercentage,
        status,
        createdAt: gTasks[0].created_at,
      };
    });
  }, [filteredTasks]);

  // Active selected group reference (if a multi-format group row is selected)
  const selectedGroup = useMemo(
    () => taskGroups.find((g) => g.id === selectedTaskId && g.isMultiFormat) || null,
    [taskGroups, selectedTaskId]
  );

  // Unified task representation for toolbar buttons
  const toolbarSelectedTask = useMemo(() => {
    if (selectedTask) return selectedTask;
    if (selectedGroup) {
      const hasDownloading = selectedGroup.tasks.some((t) => t.status === 'downloading');
      const hasPaused = selectedGroup.tasks.some(
        (t) => t.status === 'paused' || t.status === 'failed'
      );
      const isCompleted = selectedGroup.tasks.every((t) => t.status === 'completed');
      return {
        ...selectedGroup.tasks[0],
        id: selectedGroup.id,
        file_name: selectedGroup.title,
        status: hasDownloading
          ? 'downloading'
          : hasPaused
          ? 'paused'
          : isCompleted
          ? 'completed'
          : 'pending',
      } as DownloadTask;
    }
    return null;
  }, [selectedTask, selectedGroup]);

  // Download Actions
  const handleStartDownload = async (params: {
    url: string;
    destinationPath?: string;
    fileName?: string;
    connections: number;
    formatId?: string;
    resolution?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    groupId?: string;
  }) => {
    const newTask = await startDownload(params);
    setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
    if (params.groupId) {
      setExpandedGroupIds((prev) => new Set([...prev, params.groupId!]));
    }
    // Switch to all or downloading status
    setSelectedStatus('all');
  };

  const handlePause = async (id: string) => {
    try {
      await pauseDownload(id);
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'paused', speed_bps: 0 } : t))
      );
    } catch (err) {
      console.error('Failed to pause download:', err);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await resumeDownload(id);
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'downloading' } : t))
      );
    } catch (err) {
      console.error('Failed to resume download:', err);
    }
  };

  const handleCancel = async (id: string, deleteFile = false) => {
    // Optimistically remove from state immediately
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTaskId === id) {
      setSelectedTaskId(null);
    }
    if (inspectingTask?.id === id) {
      setInspectingTask(null);
    }
    try {
      await removeTask(id, deleteFile);
    } catch (err) {
      console.error('Failed to remove download task:', err);
    }
  };

  const handleClearAll = async (deleteFile = false) => {
    // Purge state immediately
    setTasks([]);
    setSelectedTaskId(null);
    setInspectingTask(null);
    try {
      await clearAllTasks(deleteFile);
    } catch (err) {
      console.error('Failed to clear all tasks:', err);
    }
  };

  const handlePauseAll = async () => {
    const activeTasks = tasks.filter((t) => t.status === 'downloading');
    for (const t of activeTasks) {
      await pauseDownload(t.id).catch(() => {});
    }
    refreshTasks();
  };

  const handleResumeAll = async () => {
    const pausedTasks = tasks.filter((t) => t.status === 'paused');
    for (const t of pausedTasks) {
      await resumeDownload(t.id).catch(() => {});
    }
    refreshTasks();
  };

  const handleClearCompleted = async () => {
    const doneTasks = tasks.filter(
      (t) => t.status === 'completed' || t.status === 'cancelled' || t.status === 'failed'
    );
    setTasks((prev) =>
      prev.filter(
        (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed'
      )
    );
    if (selectedTaskId && doneTasks.some((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
    if (inspectingTask && doneTasks.some((t) => t.id === inspectingTask.id)) {
      setInspectingTask(null);
    }
    for (const t of doneTasks) {
      await removeTask(t.id, false).catch(() => {});
    }
  };

  const handleToolbarPause = async () => {
    if (selectedGroup) {
      for (const t of selectedGroup.tasks) {
        if (t.status === 'downloading') {
          await handlePause(t.id);
        }
      }
    } else if (selectedTask && selectedTask.status === 'downloading') {
      await handlePause(selectedTask.id);
    } else {
      await handlePauseAll();
    }
  };

  const handleToolbarResume = async () => {
    if (selectedGroup) {
      for (const t of selectedGroup.tasks) {
        if (t.status === 'paused' || t.status === 'failed') {
          await handleResume(t.id);
        }
      }
    } else if (
      selectedTask &&
      (selectedTask.status === 'paused' || selectedTask.status === 'failed')
    ) {
      await handleResume(selectedTask.id);
    } else {
      await handleResumeAll();
    }
  };

  const handleToolbarCancelOrDelete = async () => {
    if (selectedGroup) {
      for (const t of selectedGroup.tasks) {
        await handleCancel(t.id, false);
      }
      setSelectedTaskId(null);
    } else if (selectedTask) {
      await handleCancel(selectedTask.id, false);
      setSelectedTaskId(null);
    } else {
      await handleClearAll(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 font-sans text-sm select-none">
      {/* Unified Custom Title Bar & Top Header (integrated Discord-like style) */}
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          selectedCategory={selectedCategory}
          selectedStatus={selectedStatus}
          onSelectCategory={setSelectedCategory}
          onSelectStatus={setSelectedStatus}
          categoryCounts={categoryCounts}
          statusCounts={statusCounts}
          onOpenNewDownload={() => setIsNewDownloadOpen(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
          <Toolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTask={toolbarSelectedTask}
            onClearSelection={() => setSelectedTaskId(null)}
            totalTasksCount={tasks.length}
            activeDownloadsCount={totalActiveDownloads}
            pausedDownloadsCount={statusCounts.paused}
            completedDownloadsCount={statusCounts.completed}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenNewDownload={() => setIsNewDownloadOpen(true)}
            onPause={handleToolbarPause}
            onResume={handleToolbarResume}
            onCancelOrDelete={handleToolbarCancelOrDelete}
            onClearCompleted={handleClearCompleted}
          />

          <main className="flex-1 overflow-auto p-2 bg-white m-1 border border-slate-300 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05)] custom-scrollbar">
            {filteredTasks.length === 0 ? (
              <EmptyState selectedCategory={selectedCategory} selectedStatus={selectedStatus}
                searchQuery={searchQuery}
                onOpenNewDownload={() => setIsNewDownloadOpen(true)}
                onResetFilters={() => {
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setSearchQuery('');
                }}
              />
            ) : (
              <div className="w-full h-full min-w-[690px]">
                {viewMode === 'detailed' && (
                  <div className="download-grid bg-slate-200 border-b border-slate-300 p-1 text-xs font-semibold text-slate-700 sticky top-0 z-10 mb-1 select-none">
                    <div className="text-center font-bold">#</div>
                    <div className="min-w-0">Nombre de Archivo / Origen</div>
                    <div className="min-w-0">Tamaño / Progreso</div>
                    <div className="min-w-0 text-center">Velocidad / ETA</div>
                    <div className="min-w-0 text-center">Estado</div>
                    <div className="min-w-0 text-center">Acción</div>
                  </div>
                )}
                <div className="space-y-0.5">
                  {taskGroups.map((group, index) => (
                    <DownloadGroupRow
                      key={group.id}
                      group={group}
                      groupIndex={index + 1}
                      viewMode={viewMode}
                      isExpanded={expandedGroupIds.has(group.id)}
                      onToggleExpand={toggleGroupExpand}
                      selectedId={selectedTaskId}
                      onSelect={(id) => setSelectedTaskId((prev) => (prev === id ? null : id))}
                      onPauseTask={handlePause}
                      onResumeTask={handleResume}
                      onCancelTask={handleCancel}
                      onOpenFile={openFile}
                      onOpenFolder={openContainingFolder}
                      onInspectTask={setInspectingTask}
                    />
                  ))}
                </div>
              </div>
            )}
          </main>
          
          {/* Status Bar */}
          <div className="h-6 bg-slate-200 border-t border-slate-300 flex items-center justify-between px-3 text-[11px] text-slate-700 shrink-0 gap-2 min-w-0">
            <span className="shrink-0">
              Velocidad Global:{' '}
              <b className="text-red-600 font-mono font-bold">
                {formatSpeed(totalSpeedBps)}
              </b>
            </span>
            {isInstallingExtractors && (
              <span className="flex items-center gap-1.5 text-blue-700 font-medium truncate min-w-0">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span className="truncate">Descargando motor multimedia y dependencias... (1ra vez)</span>
              </span>
            )}
            {extractorInstallError && (
              <span className="flex items-center gap-1.5 text-red-600 font-medium truncate min-w-0" title={extractorInstallError}>
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">Error descargando motor multimedia</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <NewDownloadModal
        isOpen={isNewDownloadOpen}
        onClose={() => setIsNewDownloadOpen(false)}
        onStartDownload={handleStartDownload}
      />
      <TaskDetailsModal
        task={inspectingTask}
        onClose={() => setInspectingTask(null)}
        onOpenFile={openFile}
        onOpenFolder={openContainingFolder}
      />
    </div>
  );
}

export default App;
