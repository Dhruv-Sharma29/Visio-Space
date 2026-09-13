import React, { useEffect, useRef, useState } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { parseBoardImport, type ParsedImport } from '../../utils/importBoard';
import { normalizeBoardState } from '../../utils/boardValidation';
import { computeBoardBounds, DEFAULT_BOARD_VERTICAL_GAP } from '../../utils/multiBoardLayout';
import type { BoardState } from '../../types/board';
import { IconImport, IconJson, IconText } from '../Icons/Icons';
import './ImportModal.css';

type ImportFormat = 'json' | 'csv' | 'markdown';
interface Props { isOpen: boolean; onClose: () => void; }

interface BoardFilePreview {
  id: string;
  name: string;
  size: number;
  data?: BoardState;
  error?: string;
  itemCount: number;
  cardCount: number;
  shapeCount: number;
  clusterCount: number;
  connectorCount: number;
  textCount: number;
  voteCount: number;
  imageCount: number;
  width: number;
  height: number;
}

const OPTIONS: Array<{ id: ImportFormat; title: string; description: string; accept: string; icon: React.ReactNode }> = [
  { id: 'csv', title: 'CSV cards', description: 'Turn spreadsheet rows into sticky cards.', accept: '.csv', icon: <IconImport size={24} /> },
  { id: 'markdown', title: 'Markdown cards', description: 'Turn bullets and headings into sticky cards.', accept: '.md,.markdown,.txt', icon: <IconText size={24} /> },
  { id: 'json', title: 'JSON board', description: 'Restore VisioSpace board backups or import multiple boards.', accept: '.json', icon: <IconJson size={24} /> },
];

const GAP_PRESETS = [80, 120, 160, 200];

export const ImportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [format, setFormat] = useState<ImportFormat | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [boardFiles, setBoardFiles] = useState<BoardFilePreview[]>([]);
  const [gap, setGap] = useState<number>(DEFAULT_BOARD_VERTICAL_GAP);
  const [filename, setFilename] = useState('');
  const [fileError, setFileError] = useState('');

  const { importCards, importFromJSON, importMultipleBoards, zoomToFit } = useBoardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFormat(null);
    setParsed(null);
    setBoardFiles([]);
    setGap(DEFAULT_BOARD_VERTICAL_GAP);
    setFilename('');
    setFileError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const chooseFormat = (next: ImportFormat | null) => {
    setFormat(next);
    setParsed(null);
    setBoardFiles([]);
    setFilename('');
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (addFileInputRef.current) addFileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parseJsonFile = async (file: File): Promise<BoardFilePreview> => {
    try {
      const contents = await file.text();
      const data: unknown = JSON.parse(contents);
      if (!data || typeof data !== 'object' || !Array.isArray((data as { cards?: unknown }).cards)) {
        throw new Error('Invalid structure');
      }
      const safeState = normalizeBoardState(data);
      const bounds = computeBoardBounds(safeState);
      const cardCount = safeState.cards.length;
      const shapeCount = safeState.shapes.length;
      const clusterCount = safeState.clusters.length;
      const connectorCount = safeState.connectors.length;
      const textCount = safeState.textItems?.length || 0;
      const voteCount = safeState.voteDots?.length || 0;
      const imageCount = safeState.images?.length || 0;
      const itemCount = cardCount + shapeCount + clusterCount + connectorCount + textCount + voteCount + imageCount;

      return {
        id: `${file.name}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        size: file.size,
        data: safeState,
        itemCount,
        cardCount,
        shapeCount,
        clusterCount,
        connectorCount,
        textCount,
        voteCount,
        imageCount,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    } catch {
      return {
        id: `${file.name}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        size: file.size,
        error: 'Invalid board JSON format',
        itemCount: 0,
        cardCount: 0,
        shapeCount: 0,
        clusterCount: 0,
        connectorCount: 0,
        textCount: 0,
        voteCount: 0,
        imageCount: 0,
        width: 0,
        height: 0,
      };
    }
  };

  const handleFilesSelected = async (fileList?: FileList | null, append = false) => {
    if (!fileList || fileList.length === 0 || !format) return;
    setFileError('');

    if (format === 'json') {
      const files = Array.from(fileList);
      const parsedItems = await Promise.all(files.map(parseJsonFile));
      setBoardFiles(prev => append ? [...prev, ...parsedItems] : parsedItems);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (addFileInputRef.current) addFileInputRef.current.value = '';
    } else {
      const file = fileList[0];
      setFilename(file.name);
      try {
        const contents = await file.text();
        setParsed(parseBoardImport(contents, file.name));
      } catch {
        setParsed(null);
        setFileError('Invalid file. Please choose a valid import file.');
      }
    }
  };

  const removeBoard = (index: number) => {
    setBoardFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveBoard = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= boardFiles.length) return;
    setBoardFiles(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const validBoards = boardFiles.filter(bf => bf.data && !bf.error);
  const totalItemCount = validBoards.reduce((sum, b) => sum + b.itemCount, 0);

  const importFile = async () => {
    if (!format) return;

    if (format === 'json') {
      if (validBoards.length === 0) return;
      if (validBoards.length === 1) {
        importFromJSON(validBoards[0].data!);
      } else {
        const states = validBoards.map(b => b.data!);
        importMultipleBoards(states, gap);
      }
      zoomToFit();
      close();
      return;
    }

    if (!parsed) return;
    importCards(parsed.cards);
    zoomToFit();
    close();
  };

  const getPrimaryButtonText = () => {
    if (format === 'json') {
      if (validBoards.length === 1) return 'Import board';
      return 'Import boards';
    }
    return `Import ${parsed?.cards.length || ''} cards`;
  };

  const isPrimaryDisabled = () => {
    if (format === 'json') {
      return validBoards.length === 0;
    }
    return !parsed || !parsed.cards.length;
  };

  return (
    <div className="import-modal-overlay" onClick={close}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-modal-tape" />
        <div className="import-modal-header">
          <div className="import-modal-header-left">
            <span className="import-modal-header-icon"><IconImport size={22} /></span>
            <h2 className="import-modal-title">Import</h2>
          </div>
          <button className="import-modal-close" onClick={close}>✕</button>
        </div>

        {!format ? (
          <div className="import-modal-content">
            <p className="import-modal-subtitle">Choose what you want to bring into your VisioSpace board.</p>
            <div className="import-grid">
              {OPTIONS.map(option => (
                <button key={option.id} className="import-card" onClick={() => chooseFormat(option.id)}>
                  <span className="import-card-icon">{option.icon}</span>
                  <span className="import-card-title">{option.title}</span>
                  <span className="import-card-description">{option.description}</span>
                  <span className="import-card-action">Choose format →</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="import-modal-content">
            <button className="import-back" onClick={() => chooseFormat(null)}>← Back to formats</button>

            {format === 'json' ? (
              <>
                <p className="import-modal-subtitle">
                  Select one or more VisioSpace JSON board files. Multiple boards will be previewed and arranged vertically without overlapping.
                </p>

                {boardFiles.length === 0 ? (
                  <label className="import-file-picker">
                    <span>Choose JSON board file(s)</span>
                    <input
                      ref={fileInputRef}
                      className="import-file-input"
                      type="file"
                      accept=".json"
                      multiple
                      onChange={e => handleFilesSelected(e.target.files)}
                    />
                  </label>
                ) : (
                  <div className="import-multi-board-container">
                    {/* Top control bar: Summary + Gap selector + Add more */}
                    <div className="import-board-summary-bar">
                      <div className="import-board-summary-info">
                        <strong>{boardFiles.length} {boardFiles.length === 1 ? 'board' : 'boards'} selected</strong>
                        {validBoards.length > 0 && <span> • {totalItemCount} total items</span>}
                      </div>

                      {boardFiles.length > 1 && (
                        <div className="import-gap-control">
                          <span className="import-gap-label">Gap:</span>
                          <div className="import-gap-presets">
                            {GAP_PRESETS.map(preset => (
                              <button
                                key={preset}
                                type="button"
                                className={`import-gap-btn ${gap === preset ? 'active' : ''}`}
                                onClick={() => setGap(preset)}
                              >
                                {preset}px
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="import-board-actions-top">
                        <label className="import-add-more-label" title="Add additional board files">
                          <span>+ Add files</span>
                          <input
                            ref={addFileInputRef}
                            className="import-file-input-hidden"
                            type="file"
                            accept=".json"
                            multiple
                            onChange={e => handleFilesSelected(e.target.files, true)}
                          />
                        </label>
                        <button type="button" className="import-clear-btn" onClick={() => setBoardFiles([])}>
                          Clear all
                        </button>
                      </div>
                    </div>

                    {/* Single board view */}
                    {boardFiles.length === 1 && !boardFiles[0].error && (
                      <div className="import-single-board-preview">
                        <div className="import-ready">✓ JSON board is ready to restore.</div>
                        <div className="import-board-card single">
                          <div className="import-board-card-header">
                            <span className="import-board-name">{boardFiles[0].name}</span>
                            <span className="import-board-dimensions">
                              {boardFiles[0].width} × {boardFiles[0].height} px
                            </span>
                          </div>
                          <div className="import-board-chips">
                            <span className="import-chip">{boardFiles[0].cardCount} cards</span>
                            {boardFiles[0].shapeCount > 0 && <span className="import-chip">{boardFiles[0].shapeCount} shapes</span>}
                            {boardFiles[0].connectorCount > 0 && <span className="import-chip">{boardFiles[0].connectorCount} threads</span>}
                            {boardFiles[0].clusterCount > 0 && <span className="import-chip">{boardFiles[0].clusterCount} groups</span>}
                            {boardFiles[0].textCount > 0 && <span className="import-chip">{boardFiles[0].textCount} text</span>}
                            {boardFiles[0].imageCount > 0 && <span className="import-chip">{boardFiles[0].imageCount} images</span>}
                            {boardFiles[0].voteCount > 0 && <span className="import-chip">{boardFiles[0].voteCount} votes</span>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Multiple boards list with vertical layout previews and gap indicators */}
                    {(boardFiles.length > 1 || (boardFiles.length === 1 && boardFiles[0].error)) && (
                      <div className="import-board-list">
                        {boardFiles.map((bf, index) => (
                          <React.Fragment key={bf.id}>
                            {index > 0 && (
                              <div className="import-board-gap-indicator">
                                <span className="import-gap-line" />
                                <span className="import-gap-badge">↕ {gap}px gap</span>
                                <span className="import-gap-line" />
                              </div>
                            )}

                            <div className={`import-board-card ${bf.error ? 'error' : ''}`}>
                              <div className="import-board-card-header">
                                <div className="import-board-header-left">
                                  <span className="import-board-order-badge">
                                    #{index + 1} {index === 0 ? 'Top' : index === boardFiles.length - 1 ? 'Bottom' : ''}
                                  </span>
                                  <span className="import-board-name" title={bf.name}>{bf.name}</span>
                                  {!bf.error && (
                                    <span className="import-board-dimensions">
                                      ({bf.width} × {bf.height}px)
                                    </span>
                                  )}
                                </div>
                                <div className="import-board-controls">
                                  <button
                                    type="button"
                                    className="import-board-control-btn"
                                    disabled={index === 0}
                                    onClick={() => moveBoard(index, -1)}
                                    title="Move board up in stack"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="import-board-control-btn"
                                    disabled={index === boardFiles.length - 1}
                                    onClick={() => moveBoard(index, 1)}
                                    title="Move board down in stack"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    className="import-board-control-btn remove"
                                    onClick={() => removeBoard(index)}
                                    title="Remove this board"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              {bf.error ? (
                                <div className="import-error-tag">⚠️ {bf.error}</div>
                              ) : (
                                <div className="import-board-chips">
                                  <span className="import-chip">{bf.cardCount} cards</span>
                                  {bf.shapeCount > 0 && <span className="import-chip">{bf.shapeCount} shapes</span>}
                                  {bf.connectorCount > 0 && <span className="import-chip">{bf.connectorCount} threads</span>}
                                  {bf.clusterCount > 0 && <span className="import-chip">{bf.clusterCount} groups</span>}
                                  {bf.textCount > 0 && <span className="import-chip">{bf.textCount} text</span>}
                                  {bf.imageCount > 0 && <span className="import-chip">{bf.imageCount} images</span>}
                                  {bf.voteCount > 0 && <span className="import-chip">{bf.voteCount} votes</span>}
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="import-modal-subtitle">Select a file to preview before importing.</p>
                <label className="import-file-picker">
                  <span>Choose file</span>
                  <input
                    ref={fileInputRef}
                    className="import-file-input"
                    type="file"
                    accept={OPTIONS.find(o => o.id === format)?.accept}
                    onChange={e => handleFilesSelected(e.target.files)}
                  />
                </label>
                {filename && <p className="import-filename">{filename}</p>}
                {fileError && <p className="import-error">{fileError}</p>}
                {parsed && (
                  <>
                    <p className="import-count">{parsed.cards.length} cards ready to import.</p>
                    {parsed.warnings.map(w => <p key={w} className="import-warning">{w}</p>)}
                    <div className="import-preview">
                      {parsed.cards.slice(0, 8).map((card, i) => (
                        <div key={i} className="import-preview-row">
                          <strong>{card.title}</strong>
                          {card.body && <span> — {card.body}</span>}
                        </div>
                      ))}
                      {parsed.cards.length > 8 && <div className="import-preview-row">…and {parsed.cards.length - 8} more</div>}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="import-modal-actions">
          <button className="import-btn-cancel" onClick={close}>Cancel</button>
          {format && (
            <button
              className="import-btn-primary"
              disabled={isPrimaryDisabled()}
              onClick={importFile}
            >
              {getPrimaryButtonText()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
