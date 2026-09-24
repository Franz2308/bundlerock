import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { DownloadItem } from './components/DownloadItem';
import { NewDownloadModal } from './components/NewDownloadModal';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { EmptyState } from './components/EmptyState';
import {
  DownloadTask,
  DownloadProgressPayload,
  FileCategory,
  StatusFilter,
} from './types/download';
import {
  listTasks,
  startDownload,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  openFile,
  openContainingFolder,
  onDownloadProgress,
  onDownloadFinished,
} from './services/downloadApi';
import { getFileCategory } from './utils/formatters';
import './App.css';

export function App() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [isNewDownloadOpen, setIsNewDownloadOpen] = useState(false);
  const [inspectingTask, setInspectingTask] = useState<DownloadTask | null>(null);

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
              };
            }
            return prev;
          });
        });

        unlistenFinished = await onDownloadFinished((finishedTask: DownloadTask) => {
          setTasks((prevTasks) =>
            prevTasks.map((t) => (t.id === finishedTask.id ? { ...t, ...finishedTask } : t))
          );
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
        const cat = getFileCategory(task.file_name);
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
      const cat = getFileCategory(t.file_name);
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

  const totalCompletedSize = useMemo(() => {
    return tasks
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + (t.downloaded_bytes || 0), 0);
  }, [tasks]);

  // Download Actions
  const handleStartDownload = async (params: {
    url: string;
    destinationPath?: string;
    fileName?: string;
    connections: number;
    formatId?: string;
  }) => {
    const newTask = await startDownload(params);
    setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
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
    try {
      await cancelDownload(id, deleteFile);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (selectedTaskId === id) {
        setSelectedTaskId(null);
      }
      if (inspectingTask?.id === id) {
        setInspectingTask(null);
      }
    } catch (err) {
      console.error('Failed to cancel download:', err);
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
    for (const t of doneTasks) {
      await cancelDownload(t.id, false).catch(() => {});
    }
    setTasks((prev) =>
      prev.filter(
        (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed'
      )
    );
  };

  const handleToolbarPause = async () => {
    if (selectedTask && selectedTask.status === 'downloading') {
      await handlePause(selectedTask.id);
    } else {
      await handlePauseAll();
    }
  };

  const handleToolbarResume = async () => {
    if (
      selectedTask &&
      (selectedTask.status === 'paused' || selectedTask.status === 'failed')
    ) {
      await handleResume(selectedTask.id);
    } else {
      await handleResumeAll();
    }
  };

  const handleToolbarCancelOrDelete = async () => {
    if (selectedTask) {
      await handleCancel(selectedTask.id, false);
      setSelectedTaskId(null);
    } else {
      await handleClearCompleted();
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Left Sidebar with Category & Status Filters */}
      <Sidebar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
        categoryCounts={categoryCounts}
        statusCounts={statusCounts}
        totalSpeedBps={totalSpeedBps}
        totalActiveDownloads={totalActiveDownloads}
        totalCompletedSize={totalCompletedSize}
        onOpenNewDownload={() => setIsNewDownloadOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950/90">
        {/* Top Header Toolbar */}
        <Toolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          selectedStatus={selectedStatus}
          selectedTask={selectedTask}
          onClearSelection={() => setSelectedTaskId(null)}
          activeDownloadsCount={totalActiveDownloads}
          pausedDownloadsCount={statusCounts.paused}
          completedDownloadsCount={statusCounts.completed}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenNewDownload={() => setIsNewDownloadOpen(true)}
          onPause={handleToolbarPause}
          onResume={handleToolbarResume}
          onCancelOrDelete={handleToolbarCancelOrDelete}
        />

        {/* Downloads Scrollable View */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {filteredTasks.length === 0 ? (
            <EmptyState
              selectedCategory={selectedCategory}
              selectedStatus={selectedStatus}
              searchQuery={searchQuery}
              onOpenNewDownload={() => setIsNewDownloadOpen(true)}
              onResetFilters={() => {
                setSelectedCategory('all');
                setSelectedStatus('all');
                setSearchQuery('');
              }}
            />
          ) : (
            <div
              className={
                viewMode === 'detailed'
                  ? 'space-y-3.5 max-w-5xl mx-auto'
                  : 'space-y-2 max-w-5xl mx-auto'
              }
            >
              {filteredTasks.map((task) => (
                <DownloadItem
                  key={task.id}
                  task={task}
                  viewMode={viewMode}
                  isSelected={task.id === selectedTaskId}
                  onSelect={(id) => setSelectedTaskId((prev) => (prev === id ? null : id))}
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                  onOpenFile={openFile}
                  onOpenFolder={openContainingFolder}
                  onInspect={setInspectingTask}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* New Download Modal */}
      <NewDownloadModal
        isOpen={isNewDownloadOpen}
        onClose={() => setIsNewDownloadOpen(false)}
        onStartDownload={handleStartDownload}
      />

      {/* Task Details / Segment Inspector Modal */}
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
