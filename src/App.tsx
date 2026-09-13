import { useEffect, useCallback, useState, useRef } from 'react';
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
import { GuestBadge } from './components/Auth/GuestBadge';
import { AuthScreen } from './auth/AuthScreen';
import { useAuth } from './auth/AuthContext';
import { useBoardStore } from './store/boardStore';
import { boardService } from './services/boardService';
import { SettingsModal } from './components/Settings/SettingsModal';
import { IconSettings, IconShare, IconBell, IconHistory, IconActivity, IconSearch } from './components/Icons/Icons';
import { realtimeService } from './services/realtimeService';
import { PresenceHeaderBar } from './components/Canvas/PresenceHeaderBar';
import { FollowBanner } from './components/Canvas/FollowBanner';
import { ShareModal } from './components/ShareModal/ShareModal';
import { sharingService } from './services/sharingService';
import { CommentPinsOverlay } from './components/Comments/CommentPinsOverlay';
import { CommentThreadPopover } from './components/Comments/CommentThreadPopover';
import { NotificationDrawer } from './components/Notifications/NotificationDrawer';
import { CanvasSearchBar } from './components/Canvas/CanvasSearchBar';
import { VersionHistoryDrawer } from './components/VersionHistory/VersionHistoryDrawer';
import { ActivityDrawer } from './components/ActivityLog/ActivityDrawer';
import { notificationService } from './services/notificationService';
import { commentService } from './services/commentService';
import type { Tool, InAppNotification, CommentItem, SearchMatch, BoardState } from './types/board';
import './App.css';

function getHashParams() {
  if (typeof window === 'undefined') return { token: null, role: null };
  const hash = window.location.hash;
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return { token: null, role: null };
  const params = new URLSearchParams(hash.slice(qIdx));
  return {
    token: params.get('token'),
    role: params.get('role'),
  };
}

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
  m: 'comment',
};

interface AppProps {
  boardId?: string | null;
  onBackToDashboard?: () => void;
}

function App({ boardId, onBackToDashboard }: AppProps = {}) {
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
    cards,
    shapes,
    connectors,
    textItems,
    voteDots,
    images,
    viewport,
    followingUserId,
    setFollowingUserId,
    currentRole,
    setCurrentRole,
    canEdit,
  } = useBoardStore();

  const [exportOpen, setExportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState<{ x: number; y: number; cardId?: string | null } | null>(null);
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'local'>('saved');
  const { user, profile } = useAuth();
  const isInitialLoad = useRef(true);

  const [guestId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    let gid = sessionStorage.getItem('visiospace_guest_id');
    if (!gid) {
      gid = `guest_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('visiospace_guest_id', gid);
    }
    return gid;
  });

  const effectiveUserId = user?.id || guestId;
  const currentUserName = profile?.username || (user?.email ? user.email.split('@')[0] : `Guest_${guestId.slice(-4)}`);
  const currentUserAvatar = profile?.avatar_url || null;

  // Poll / refresh unread notification count
  useEffect(() => {
    if (!effectiveUserId) return;
    notificationService.getUnreadCount(effectiveUserId).then(setUnreadNotifsCount);
  }, [effectiveUserId, notificationDrawerOpen]);

  // Resolve user role for the current board
  useEffect(() => {
    if (!boardId) return;
    const { token, role: queryRole } = getHashParams();
    sharingService.resolveUserRole(boardId, user?.id, token, queryRole).then(role => {
      setCurrentRole(role);
    });
  }, [boardId, user?.id, setCurrentRole]);

  // Load board if boardId is passed
  useEffect(() => {
    if (!boardId) return;
    let active = true;
    isInitialLoad.current = true;
    boardService.getBoard(boardId).then(({ summary, state }) => {
      if (!active) return;
      setBoardTitle(summary.title);
      useBoardStore.getState().importFromJSON(state);
      setSaveStatus(user ? 'saved' : 'local');
    });
    return () => {
      active = false;
    };
  }, [boardId, user]);

  // Load comments for pins and search indexing
  useEffect(() => {
    if (!boardId) return;
    let active = true;
    commentService.getBoardComments(boardId).then(items => {
      if (!active) return;
      setComments(items);
    });

    const unsubscribe = realtimeService.onCommentUpdate(() => {
      commentService.getBoardComments(boardId).then(items => {
        if (!active) return;
        setComments(items);
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [boardId]);

  // Debounced auto-save and realtime broadcast
  useEffect(() => {
    if (!boardId) return;
    if (!canEdit()) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    const currentState = {
      cards,
      shapes,
      connectors,
      clusters,
      textItems,
      voteDots,
      images,
    };

    // Broadcast immediate live update to active peers
    realtimeService.broadcastBoardUpdate(currentState);

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      await boardService.saveBoardState(boardId, currentState);
      setSaveStatus(user ? 'saved' : 'local');
    }, 1200);

    return () => clearTimeout(timer);
  }, [cards, shapes, connectors, clusters, textItems, voteDots, images, boardId, user]);

  // Join board realtime presence & multiplayer room
  useEffect(() => {
    if (!boardId) return;

    realtimeService.joinBoard(boardId, {
      userId: effectiveUserId,
      username: currentUserName,
      fullName: profile?.full_name || (user?.email ? user.email : 'Guest Explorer'),
      avatarUrl: currentUserAvatar || '',
    });

    return () => {
      realtimeService.leaveBoard();
    };
  }, [boardId, effectiveUserId, currentUserName, currentUserAvatar, profile, user]);

  // Listen for remote peer board updates
  useEffect(() => {
    if (!boardId) return;

    return realtimeService.onBoardUpdate(({ state }) => {
      useBoardStore.getState().applyRemoteBoardUpdate(state);
    });
  }, [boardId]);

  const handleTitleChange = async (newTitle: string) => {
    if (!canEdit()) return;
    setBoardTitle(newTitle);
    if (boardId) {
      await boardService.renameBoard(boardId, newTitle);
    }
  };

  const handleOpenDraftComment = useCallback((coords: { x: number; y: number; cardId?: string | null }) => {
    setActiveCommentId(null);
    setDraftComment(coords);
  }, []);

  const handleNotificationClick = useCallback((notif: InAppNotification) => {
    if (typeof notif.x === 'number' && typeof notif.y === 'number') {
      const scale = useBoardStore.getState().viewport.scale;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      useBoardStore.getState().setViewport({
        x: centerX - notif.x * scale,
        y: centerY - notif.y * scale,
        scale,
      });
    }
    if (notif.commentId) {
      setActiveCommentId(notif.commentId);
      setDraftComment(null);
    }
  }, []);

  const handleNavigateToSearchMatch = useCallback((match: SearchMatch) => {
    const scale = useBoardStore.getState().viewport.scale;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const targetWidth = match.width || 120;
    const targetHeight = match.height || 80;

    useBoardStore.getState().setViewport({
      x: centerX - (match.x + targetWidth / 2) * scale,
      y: centerY - (match.y + targetHeight / 2) * scale,
      scale,
    });

    if (match.category === 'card') {
      useBoardStore.getState().setSelectedIds([match.id]);
    } else if (match.category === 'comment' && match.commentId) {
      setActiveCommentId(match.commentId);
    }
  }, []);

  const handleRestoreState = useCallback((restoredState: BoardState) => {
    useBoardStore.getState().importFromJSON(restoredState);
    if (boardId) {
      boardService.saveBoardState(boardId, restoredState);
      realtimeService.broadcastBoardUpdate(restoredState);
    }
  }, [boardId]);

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
        importOpen ||
        authModalOpen ||
        shareOpen ||
        notificationDrawerOpen ||
        activeCommentId ||
        draftComment ||
        searchOpen ||
        historyOpen ||
        activityOpen
      ) {
        if (e.key === 'Escape') {
          if (authModalOpen) setAuthModalOpen(false);
          if (shareOpen) setShareOpen(false);
          if (notificationDrawerOpen) setNotificationDrawerOpen(false);
          if (searchOpen) setSearchOpen(false);
          if (historyOpen) setHistoryOpen(false);
          if (activityOpen) setActivityOpen(false);
          if (activeCommentId || draftComment) {
            setActiveCommentId(null);
            setDraftComment(null);
          }
        }
        return;
      }

      // Don't capture when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      // Navigation & Read-only friendly shortcuts:
      // Cmd/Ctrl + F → search in canvas
      if (key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Cmd/Ctrl + E → export
      if (key === 'e' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setExportOpen(true);
        return;
      }

      // Space → hand tool (while held)
      if (key === ' ' && !e.repeat) {
        e.preventDefault();
        setActiveTool('hand');
        return;
      }

      // Escape → cancel connecting / clear selection / cancel follow mode / close comment / close search
      if (key === 'escape') {
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        if (historyOpen) {
          setHistoryOpen(false);
          return;
        }
        if (activityOpen) {
          setActivityOpen(false);
          return;
        }
        if (notificationDrawerOpen) {
          setNotificationDrawerOpen(false);
          return;
        }
        if (activeCommentId || draftComment) {
          setActiveCommentId(null);
          setDraftComment(null);
          return;
        }
        if (followingUserId) {
          setFollowingUserId(null);
        }
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

      // M → toggle comment tool (allowed for both editors and viewers)
      if (key === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTool(activeTool === 'comment' ? 'select' : 'comment');
        return;
      }

      // If user is in read-only mode, block all remaining editing shortcuts
      if (!canEdit()) {
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
      authModalOpen,
      shareOpen,
      canEdit,
      followingUserId,
      setFollowingUserId,
      notificationDrawerOpen,
      activeCommentId,
      draftComment,
      searchOpen,
      historyOpen,
      activityOpen,
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

  // ─── Guest mode unsaved session warning on leave / refresh ──────────
  useEffect(() => {
    if (user) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useBoardStore.getState();
      const hasContent =
        state.cards.length > 0 ||
        state.shapes.length > 0 ||
        state.connectors.length > 0 ||
        state.clusters.length > 0 ||
        state.textItems.length > 0 ||
        state.voteDots.length > 0 ||
        state.images.length > 0;

      if (hasContent) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  return (
    <div className={`app app-toolbar-${toolbarDock}`}>
      {/* Top canvas bar with navigation and board title */}
      <header className="canvas-top-bar">
        <div className="canvas-top-left">
          {onBackToDashboard && (
            <button
              type="button"
              className="canvas-back-btn"
              onClick={onBackToDashboard}
              title="Return to My Boards"
            >
              ← All Boards
            </button>
          )}
          <input
            type="text"
            className={`canvas-title-input ${!canEdit() ? 'readonly' : ''}`}
            value={boardTitle}
            onChange={e => handleTitleChange(e.target.value)}
            readOnly={!canEdit()}
            title={!canEdit() ? 'Board title (View-only)' : 'Click to rename board'}
          />
        </div>

        <div className="canvas-top-right">
          <PresenceHeaderBar />
          {currentRole === 'viewer' ? (
            <span className="canvas-viewer-badge" title="You have read-only access to this board">
              👁 Viewer
            </span>
          ) : (
            <span className={`canvas-save-status ${saveStatus}`}>
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'saved' && 'Saved ✓'}
              {saveStatus === 'local' && 'Local saved ✓'}
            </span>
          )}
          <button
            type="button"
            className="canvas-notif-btn"
            onClick={() => setSearchOpen(prev => !prev)}
            title="Search canvas (⌘F)"
            aria-label="Search canvas"
          >
            <IconSearch size={16} />
          </button>
          <button
            type="button"
            className="canvas-notif-btn"
            onClick={() => setActivityOpen(prev => !prev)}
            title="Board Activity"
            aria-label="Board Activity"
          >
            <IconActivity size={16} />
          </button>
          <button
            type="button"
            className="canvas-notif-btn"
            onClick={() => setHistoryOpen(prev => !prev)}
            title="Version History"
            aria-label="Version History"
          >
            <IconHistory size={16} />
          </button>
          <button
            type="button"
            className="canvas-notif-btn"
            onClick={() => setNotificationDrawerOpen(prev => !prev)}
            title="Notifications"
            aria-label="Notifications"
          >
            <IconBell size={17} />
            {unreadNotifsCount > 0 && (
              <span className="notif-badge">{unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}</span>
            )}
          </button>
          <button
            type="button"
            className="canvas-share-btn"
            onClick={() => setShareOpen(true)}
            title="Share board"
          >
            <IconShare size={15} />
            <span>Share</span>
          </button>
          {user && (
            <button
              type="button"
              className="canvas-settings-btn"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <IconSettings size={18} />
            </button>
          )}
          {!user && <GuestBadge onSignIn={() => setAuthModalOpen(true)} />}
        </div>
      </header>

      {/* Follow mode banner */}
      <FollowBanner />

      {/* Hint bar (contextual) */}
      <div className="app-hint-bar">
        {currentRole === 'viewer' ? (
          <span>👁 <strong>View-only mode</strong> · Scroll or <kbd>+</kbd>/<kbd>-</kbd> to zoom · Drag canvas or hold <kbd>Space</kbd> to pan · <kbd>⌘F</kbd> search · <kbd>M</kbd> comment · <kbd>⌘E</kbd> export</span>
        ) : (
          <>
            {activeTool === 'select' && !selectedIds.length && (
              <span><kbd>Double-click</kbd> to add a card · Scroll to zoom · <kbd>⌘F</kbd> search · <kbd>N</kbd> new card · <kbd>S</kbd> shape · <kbd>G</kbd> group · <kbd>C</kbd> connect · <kbd>M</kbd> comment</span>
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
            {activeTool === 'comment' && <span>Click any card or canvas spot to leave a comment · <kbd>Esc</kbd> cancel</span>}
          </>
        )}
      </div>

      {/* Canvas */}
      <InfiniteCanvas onOpenDraftComment={handleOpenDraftComment} />

      {/* Comment Pins Overlay on Canvas */}
      {boardId && (
        <CommentPinsOverlay
          boardId={boardId}
          viewport={viewport}
          cards={cards}
          activeCommentId={activeCommentId}
          onSelectComment={(id) => {
            setActiveCommentId(id);
            setDraftComment(null);
          }}
        />
      )}

      {/* Active Comment Thread or Draft Popover */}
      {boardId && (activeCommentId || draftComment) && (
        <CommentThreadPopover
          boardId={boardId}
          commentId={activeCommentId}
          draftLocation={draftComment}
          viewport={viewport}
          cards={cards}
          onClose={() => {
            setActiveCommentId(null);
            setDraftComment(null);
          }}
          onCommentCreated={(c) => {
            setDraftComment(null);
            setActiveCommentId(c.id);
          }}
          currentUserId={effectiveUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          isOwner={currentRole === 'owner'}
        />
      )}

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        userId={effectiveUserId}
        onNotificationClick={handleNotificationClick}
        onUnreadCountChange={setUnreadNotifsCount}
      />

      {/* In-Board Canvas Search Overlay */}
      <CanvasSearchBar
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        cards={cards}
        shapes={shapes}
        clusters={clusters}
        textItems={textItems}
        comments={comments}
        viewport={viewport}
        onNavigateToMatch={handleNavigateToSearchMatch}
      />

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        boardId={boardId || ''}
        currentState={{
          cards,
          shapes,
          connectors,
          clusters,
          textItems,
          voteDots,
          images,
        }}
        currentUserId={effectiveUserId}
        currentUserName={currentUserName}
        onRestoreState={handleRestoreState}
      />

      {/* Activity Log Drawer */}
      <ActivityDrawer
        isOpen={activityOpen}
        onClose={() => setActivityOpen(false)}
        boardId={boardId || ''}
      />

      {/* Toolbar */}
      <CanvasToolbar
        onOpenExport={() => setExportOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenImport={() => setImportOpen(true)}
      />

      {/* Card Detail Modal (full content view on double-click) */}
      <CardDetailModal />

      {/* Card Editor */}
      {canEdit() && <CardEditor />}
      {canEdit() && <TextEditor />}

      {/* Shape Text Editor */}
      {canEdit() && <ShapeTextEditor />}

      {/* Connector Label Editor */}
      {canEdit() && <ConnectorLabelEditor />}

      {/* Cluster / Group Editor */}
      {canEdit() && <ClusterEditor />}

      {/* Floating Format Bar for selected card */}
      {canEdit() && <FloatingFormatBar />}

      {/* Floating Format Bar for selected shape */}
      {canEdit() && <ShapeFormatBar />}

      {/* Shape options for selected images */}
      {canEdit() && <ImageFormatBar />}

      {/* Floating Format Bar for selected cluster/group */}
      {canEdit() && <ClusterFormatBar />}

      {/* Confirm Delete Group Modal */}
      {canEdit() && <ConfirmDeleteModal />}

      {/* Context Menu */}
      <ContextMenu />

      {/* Minimap radar overview */}
      <Minimap />

      {/* Export Modal */}
      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />

      {/* Sensemaking Templates Modal */}
      <TemplateModal isOpen={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        boardId={boardId || ''}
        boardTitle={boardTitle}
      />

      {/* In-canvas Auth Modal for Guest sign-in/up */}
      {authModalOpen && (
        <AuthScreen isModal onClose={() => setAuthModalOpen(false)} />
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
