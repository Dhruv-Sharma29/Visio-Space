import { useEffect, useCallback, useState } from 'react';
import { InfiniteCanvas } from './components/Canvas/InfiniteCanvas';
import { CanvasToolbar } from './components/Canvas/CanvasToolbar';
import { CardEditor } from './components/Card/CardEditor';
import { CardDetailModal } from './components/Card/CardDetailModal';
import { ShapeTextEditor } from './components/Shape/ShapeTextEditor';
import { ConnectorLabelEditor } from './components/Connector/ConnectorLabelEditor';
import { ClusterEditor } from './components/Cluster/ClusterEditor';
import { ConfirmDeleteModal } from './components/Cluster/ConfirmDeleteModal';
import { ExportModal } from './components/Export/ExportModal';
import { TemplateModal } from './components/Template/TemplateModal';
import { ContextMenu } from './components/ContextMenu/ContextMenu';
import { FloatingFormatBar } from './components/Card/FloatingFormatBar';
import { ShapeFormatBar } from './components/Shape/ShapeFormatBar';
import { ClusterFormatBar } from './components/Cluster/ClusterFormatBar';
import { Minimap } from './components/Minimap/Minimap';
import { TextEditor } from './components/Text/TextEditor';
import { ImportModal } from './components/Import/ImportModal';
import { ImageFormatBar } from './components/Image/ImageFormatBar';
import { useBoardStore } from './store/boardStore';
import type { Tool } from './types/board';
import './App.css';

// ─── Keyboard shortcut map ──────────────────────────────────────────
const TOOL_SHORTCUTS: Record<string, Tool> = {
  v: 'select',
  n: 'card',
  s: 'shape',
  c: 'connector',
  g: 'cluster',
  h: 'hand',
  t: 'text',
  d: 'vote',
};

function App() {
  const {
    setActiveTool,
    deleteSelected,
    undo,
    redo,
    groupSelected,
    ungroup,
    editingCardId,
    viewingCardId,
    editingShapeId,
    editingConnectorId,
    editingClusterId,
    editingTextId,
    confirmDeleteCluster,
    selectedIds,
    clusters,
    activeTool,
    connectingFromId,
    setConnectingFromId,
    toolbarDock,
  } = useBoardStore();

  const [exportOpen, setExportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // ─── Keyboard shortcuts ────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture shortcuts when editing or modals are open
      if (
        editingCardId ||
        viewingCardId ||
        editingShapeId ||
        editingConnectorId ||
        editingClusterId ||
        editingTextId ||
        confirmDeleteCluster?.isOpen ||
        exportOpen ||
        templatesOpen ||
        importOpen
      ) {
        return;
      }

      // Don't capture when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      // Cmd/Ctrl + E → export
      if (key === 'e' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setExportOpen(true);
        return;
      }

      // Cmd/Ctrl + Shift + G → ungroup
      if (key === 'g' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        const selectedCluster = clusters.find(c => selectedIds.includes(c.id));
        if (selectedCluster) {
          ungroup(selectedCluster.id);
        }
        return;
      }

      // Cmd/Ctrl + G → group selected
      if (key === 'g' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          groupSelected();
        }
        return;
      }

      // Single G key: if items selected, group them; otherwise toggle cluster tool
      if (key === 'g' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          groupSelected();
        } else {
          setActiveTool(activeTool === 'cluster' ? 'select' : 'cluster');
        }
        return;
      }

      // Tool shortcuts
      if (TOOL_SHORTCUTS[key] && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTool(TOOL_SHORTCUTS[key]);
        return;
      }

      // Space → hand tool (while held)
      if (key === ' ' && !e.repeat) {
        e.preventDefault();
        setActiveTool('hand');
        return;
      }

      // Delete / Backspace → delete selected (opens confirmation for groups)
      if ((key === 'delete' || key === 'backspace') && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Ctrl/Cmd + Z → undo
      if (key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y → redo
      if (
        (key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
        (key === 'y' && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Escape → cancel connecting / clear selection
      if (key === 'escape') {
        if (connectingFromId) {
          setConnectingFromId(null);
        }
        setActiveTool('select');
        return;
      }

      // F → zoom to fit
      if (key === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        useBoardStore.getState().zoomToFit();
        return;
      }

      // + / = → zoom in
      if ((key === '+' || key === '=') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        useBoardStore.getState().zoomIn();
        return;
      }

      // - → zoom out
      if (key === '-' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        useBoardStore.getState().zoomOut();
        return;
      }
    },
    [
      editingCardId,
      viewingCardId,
      editingShapeId,
      editingConnectorId,
      editingClusterId,
      editingTextId,
      confirmDeleteCluster,
      selectedIds,
      clusters,
      groupSelected,
      ungroup,
      deleteSelected,
      undo,
      redo,
      activeTool,
      setActiveTool,
      connectingFromId,
      setConnectingFromId,
      exportOpen,
      templatesOpen,
      importOpen,
    ]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (editingCardId || editingTextId || editingShapeId || editingClusterId) return;
      // Release space → back to select
      if (e.key === ' ' && activeTool === 'hand') {
        setActiveTool('select');
      }
    },
    [activeTool, setActiveTool, editingCardId, editingTextId, editingShapeId, editingClusterId]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div className={`app app-toolbar-${toolbarDock}`}>

      {/* Hint bar (contextual) */}
      <div className="app-hint-bar">
        {activeTool === 'select' && !selectedIds.length && (
          <span><kbd>Double-click</kbd> to add a card · Scroll to zoom · <kbd>N</kbd> new card · <kbd>S</kbd> shape · <kbd>G</kbd> group · <kbd>C</kbd> connect</span>
        )}
        {activeTool === 'select' && selectedIds.length > 0 && (
          <span>
            {selectedIds.length} selected · <kbd>G</kbd> / <kbd>⌘G</kbd> group · <kbd>Delete</kbd> remove · <kbd>Shift</kbd>+click multi-select · Drag handles to resize · Right-click for options
          </span>
        )}
        {activeTool === 'card' && (
          <span>Click to place a card · <kbd>Esc</kbd> cancel</span>
        )}
        {activeTool === 'shape' && (
          <span>Click to place or drag to size shape · <kbd>Esc</kbd> cancel</span>
        )}
        {activeTool === 'connector' && !connectingFromId && (
          <span>Click a card or shape to start connection · <kbd>Esc</kbd> cancel</span>
        )}
        {activeTool === 'connector' && connectingFromId && (
          <span>Click another card or shape to connect · <kbd>Esc</kbd> cancel</span>
        )}
        {activeTool === 'cluster' && (
          <span>Click or drag to create a group container · <kbd>Esc</kbd> cancel</span>
        )}
        {activeTool === 'hand' && (
          <span>Drag to pan · Release <kbd>Space</kbd> to return</span>
        )}
        {activeTool === 'text' && <span>Click to place text · <kbd>Esc</kbd> cancel</span>}
        {activeTool === 'vote' && <span>Click to place a voting dot · <kbd>D</kbd> vote tool</span>}
      </div>

      {/* Canvas */}
      <InfiniteCanvas />

      {/* Toolbar */}
      <CanvasToolbar
        onOpenExport={() => setExportOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenImport={() => setImportOpen(true)}
      />

      {/* Card Detail Modal (full content view on double-click) */}
      <CardDetailModal />

      {/* Card Editor */}
      <CardEditor />
      <TextEditor />

      {/* Shape Text Editor */}
      <ShapeTextEditor />

      {/* Connector Label Editor */}
      <ConnectorLabelEditor />

      {/* Cluster / Group Editor */}
      <ClusterEditor />

      {/* Floating Format Bar for selected card */}
      <FloatingFormatBar />

      {/* Floating Format Bar for selected shape */}
      <ShapeFormatBar />

      {/* Shape options for selected images */}
      <ImageFormatBar />

      {/* Floating Format Bar for selected cluster/group */}
      <ClusterFormatBar />

      {/* Confirm Delete Group Modal */}
      <ConfirmDeleteModal />

      {/* Context Menu */}
      <ContextMenu />

      {/* Minimap radar overview */}
      <Minimap />

      {/* Export Modal */}
      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />

      {/* Sensemaking Templates Modal */}
      <TemplateModal isOpen={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

export default App;
