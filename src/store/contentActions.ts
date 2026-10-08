import type { StateCreator } from 'zustand';
import type { BoardStore } from './boardStoreTypes';
import type { Card, ImageItem } from '../types/board';
import { v4 as uuidv4 } from 'uuid';
import { SoundEffects } from '../utils/soundEffects';
import { getImportLayout } from '../utils/importLayout';
import { recalculateClusters, getMaxZIndex, randomRotation, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from './boardStoreHelpers';

type Actions = Pick<BoardStore, 'addCard' | 'importCards' | 'addImage' | 'updateImage' | 'deleteImage' | 'moveImage' | 'bringImageToFront' | 'addCardToCluster' | 'updateCard' | 'deleteCard' | 'moveCard' | 'addTextItem' | 'updateTextItem' | 'deleteTextItem' | 'moveTextItem' | 'addVoteDot' | 'deleteVoteDot' | 'moveVoteDot' | 'bringToFront'>;

export const createContentActions: StateCreator<BoardStore, [], [], Actions> = (set, get) => ({
  // ── Card Actions ────────────────────────────────────────────────
  addCard: (x, y, color = 'cream', clusterId) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const { clusters } = get();

    let assignedClusterId = clusterId;
    if (!assignedClusterId) {
      const containing = clusters.find(
        cl => x >= cl.x - 10 && x + DEFAULT_CARD_WIDTH <= cl.x + cl.width + 10 &&
          y >= cl.y - 10 && y + DEFAULT_CARD_HEIGHT <= cl.y + cl.height + 10
      );
      if (containing) {
        assignedClusterId = containing.id;
      }
    }

    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.paperPlace();
      SoundEffects.pin();
    }

    const newCard: Card = {
      id,
      x,
      y,
      width: DEFAULT_CARD_WIDTH,
      height: DEFAULT_CARD_HEIGHT,
      color,
      title: '',
      body: '',
      eyebrow: '',
      clusterId: assignedClusterId,
      zIndex: getMaxZIndex(get().cards, get().shapes) + 1,
      rotation: randomRotation(),
      createdAt: now,
      updatedAt: now,
    };

    set(state => {
      const nextCards = [...state.cards, newCard];
      const nextClusters = recalculateClusters(state.clusters, nextCards, state.shapes);
      return {
        cards: nextCards,
        clusters: nextClusters,
        editingCardId: id,
        editingShapeId: null,
        editingClusterId: null,
        selectedIds: [id],
      };
    });
    return id;
  },

  importCards: (cardsToImport) => {
    if (cardsToImport.length === 0) return [];

    const { cards, shapes, clusters, textItems, voteDots } = get();
    const occupied = [
      ...cards.map(card => ({ x: card.x, y: card.y, width: card.width, height: card.height })),
      ...shapes.map(shape => ({ x: shape.x, y: shape.y, width: shape.width, height: shape.height })),
      ...clusters.map(cluster => ({ x: cluster.x, y: cluster.y, width: cluster.width, height: cluster.height })),
      ...textItems.map(text => ({ x: text.x, y: text.y, width: text.width, height: text.fontSize * 2 })),
      ...voteDots.map(dot => ({ x: dot.x - 12, y: dot.y - 12, width: 24, height: 24 })),
    ];
    const layout = getImportLayout(cardsToImport.length, occupied);
    const firstZIndex = getMaxZIndex(cards, shapes, textItems, voteDots);
    const now = new Date().toISOString();
    const newCards = cardsToImport.map((card, index): Card => ({
      id: uuidv4(),
      ...layout[index],
      color: card.color,
      title: card.title,
      body: card.body,
      eyebrow: card.eyebrow,
      zIndex: firstZIndex + index + 1,
      rotation: randomRotation(),
      createdAt: now,
      updatedAt: now,
    }));

    get().pushHistory();
    if (get().soundEnabled) SoundEffects.paperPlace();
    set(state => ({
      cards: [...state.cards, ...newCards],
      clusters: recalculateClusters(state.clusters, [...state.cards, ...newCards], state.shapes),
      selectedIds: newCards.map(card => card.id),
      editingCardId: null,
      editingTextId: null,
      editingShapeId: null,
      editingClusterId: null,
    }));
    return newCards.map(card => card.id);
  },

  addImage: (src, name = 'Image', x = 100, y = 100, width = 320, height = 220, shape = 'rectangle') => {
    if (!src) return '';
    const id = uuidv4();
    const now = new Date().toISOString();
    get().pushHistory();
    const newImage: ImageItem = {
      id,
      x,
      y,
      width: Math.max(40, width),
      height: Math.max(40, height),
      src,
      name,
      shape,
      rotation: 0,
      zIndex: getMaxZIndex(get().cards, get().shapes, get().textItems, get().voteDots, get().images) + 1,
      createdAt: now,
      updatedAt: now,
    };
    set(state => ({
      images: [...state.images, newImage],
      selectedIds: [id],
      editingCardId: null,
      editingTextId: null,
      editingShapeId: null,
      editingClusterId: null,
    }));
    return id;
  },
  updateImage: (id, updates) => {
    get().pushHistory();
    set(state => ({ images: state.images.map(image => image.id === id ? { ...image, ...updates, updatedAt: new Date().toISOString() } : image) }));
  },
  deleteImage: (id) => {
    get().pushHistory();
    set(state => ({ images: state.images.filter(image => image.id !== id), selectedIds: state.selectedIds.filter(selectedId => selectedId !== id) }));
  },
  moveImage: (id, x, y) => set(state => ({ images: state.images.map(image => image.id === id ? { ...image, x, y, updatedAt: new Date().toISOString() } : image) })),
  bringImageToFront: (id) => set(state => ({ images: state.images.map(image => image.id === id ? { ...image, zIndex: getMaxZIndex(state.cards, state.shapes, state.textItems, state.voteDots, state.images) + 1 } : image) })),

  addCardToCluster: (clusterId: string, color = 'cream') => {
    const { clusters, cards } = get();
    const targetCluster = clusters.find(c => c.id === clusterId);
    if (!targetCluster) return '';

    const memberCards = cards.filter(c => c.clusterId === clusterId);
    let cardX = targetCluster.x + 28;
    let cardY = targetCluster.y + 46;

    if (memberCards.length > 0) {
      const lastCard = memberCards[memberCards.length - 1];
      cardX = lastCard.x;
      cardY = lastCard.y + lastCard.height + 16;
    }

    return get().addCard(cardX, cardY, color, clusterId);
  },

  updateCard: (id, updates) => {
    get().pushHistory();
    set(state => {
      const nextCards = state.cards.map(c =>
        c.id === id
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      );
      const nextClusters = recalculateClusters(state.clusters, nextCards, state.shapes);
      return {
        cards: nextCards,
        clusters: nextClusters,
      };
    });
  },

  deleteCard: (id) => {
    get().pushHistory();
    set(state => {
      const nextCards = state.cards.filter(c => c.id !== id);
      const nextClusters = recalculateClusters(state.clusters, nextCards, state.shapes);
      return {
        cards: nextCards,
        clusters: nextClusters,
        connectors: state.connectors.filter(
          c => c.fromCardId !== id && c.toCardId !== id
        ),
        selectedIds: state.selectedIds.filter(s => s !== id),
        editingCardId: state.editingCardId === id ? null : state.editingCardId,
      };
    });
  },

  moveCard: (id, x, y) => {
    set(state => {
      const targetCard = state.cards.find(c => c.id === id);
      if (!targetCard) return state;

      let updatedClusterId = targetCard.clusterId;
      const currentContainingCluster = state.clusters.find(
        cl => x >= cl.x - 20 && x + targetCard.width <= cl.x + cl.width + 20 &&
          y >= cl.y - 20 && y + targetCard.height <= cl.y + cl.height + 20
      );

      if (currentContainingCluster) {
        updatedClusterId = currentContainingCluster.id;
      } else if (targetCard.clusterId) {
        const oldCluster = state.clusters.find(cl => cl.id === targetCard.clusterId);
        if (oldCluster) {
          const farOutside =
            x < oldCluster.x - 120 || x > oldCluster.x + oldCluster.width + 120 ||
            y < oldCluster.y - 120 || y > oldCluster.y + oldCluster.height + 120;
          if (farOutside) {
            updatedClusterId = undefined;
          }
        }
      }

      const nextCards = state.cards.map(c =>
        c.id === id ? { ...c, x, y, clusterId: updatedClusterId, updatedAt: new Date().toISOString() } : c
      );

      const nextClusters = recalculateClusters(state.clusters, nextCards, state.shapes);
      return {
        cards: nextCards,
        clusters: nextClusters,
      };
    });
  },

  addTextItem: (x, y, text = '') => {
    const id = uuidv4(); const now = new Date().toISOString(); get().pushHistory();
    set(state => ({ textItems: [...state.textItems, { id, x, y, text, fontSize: 22, color: '#2b2420', width: 280, rotation: 0, zIndex: getMaxZIndex(state.cards, state.shapes) + 1, createdAt: now, updatedAt: now }], selectedIds: [id] }));
    return id;
  },
  updateTextItem: (id, updates) => { get().pushHistory(); set(state => ({ textItems: state.textItems.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t) })); },
  deleteTextItem: (id) => { get().pushHistory(); set(state => ({ textItems: state.textItems.filter(t => t.id !== id), selectedIds: state.selectedIds.filter(s => s !== id) })); },
  moveTextItem: (id, x, y) => set(state => ({ textItems: state.textItems.map(t => t.id === id ? { ...t, x, y } : t) })),
  addVoteDot: (x, y, color = 'red') => { const id = uuidv4(); get().pushHistory(); set(state => ({ voteDots: [...state.voteDots, { id, x, y, color, zIndex: getMaxZIndex(state.cards, state.shapes) + 1, createdAt: new Date().toISOString() }], selectedIds: [id] })); return id; },
  deleteVoteDot: (id) => { get().pushHistory(); set(state => ({ voteDots: state.voteDots.filter(d => d.id !== id), selectedIds: state.selectedIds.filter(s => s !== id) })); },
  moveVoteDot: (id, x, y) => set(state => ({ voteDots: state.voteDots.map(d => d.id === id ? { ...d, x, y } : d) })),

  bringToFront: (id) => {
    set(state => ({
      cards: state.cards.map(c =>
        c.id === id
          ? { ...c, zIndex: getMaxZIndex(state.cards, state.shapes) + 1 }
          : c
      ),
    }));
  },

});
