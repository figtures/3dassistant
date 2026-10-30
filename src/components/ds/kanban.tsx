"use client";

import {
  type Announcements,
  closestCenter,
  closestCorners,
  type CollisionDetection,
  defaultDropAnimationSideEffects,
  DndContext,
  type DndContextProps,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  getFirstCollision,
  KeyboardCode,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  type SortableContextProps,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import { useComposedRefs } from "@/components/ds/kanban-utils/compose-refs";
import { useIsomorphicLayoutEffect } from "@/components/ds/kanban-utils/use-isomorphic-layout-effect";

const directions = new Set<string>([
  KeyboardCode.Down,
  KeyboardCode.Right,
  KeyboardCode.Up,
  KeyboardCode.Left,
]);

function getIsDirectionCode(code: string): code is KeyboardCode {
  return directions.has(code);
}

const coordinateGetter: KeyboardCoordinateGetter = (event, { context }) => {
  const { active, droppableRects, droppableContainers, collisionRect } =
    context;

  if (getIsDirectionCode(event.code)) {
    event.preventDefault();
    if (!active || !collisionRect) return;

    const filteredContainers = [];

    for (const entry of droppableContainers.getEnabled()) {
      if (!entry || entry.disabled) continue;
      const rect = droppableRects.get(entry.id);
      if (!rect) continue;

      switch (event.code) {
        case KeyboardCode.Down:
          if (collisionRect.top < rect.top) filteredContainers.push(entry);
          break;
        case KeyboardCode.Up:
          if (collisionRect.top > rect.top) filteredContainers.push(entry);
          break;
        case KeyboardCode.Left:
          if (collisionRect.left >= rect.left + rect.width) {
            filteredContainers.push(entry);
          }
          break;
        case KeyboardCode.Right:
          if (collisionRect.left + collisionRect.width <= rect.left) {
            filteredContainers.push(entry);
          }
          break;
      }
    }

    const collisions = closestCorners({
      active,
      collisionRect,
      droppableRects,
      droppableContainers: filteredContainers,
      pointerCoordinates: null,
    });
    const closestId = getFirstCollision(collisions, "id");

    if (closestId != null) {
      const newDroppable = droppableContainers.get(closestId);
      const newRect = newDroppable?.rect.current;
      if (newRect) {
        return { x: newRect.left, y: newRect.top };
      }
    }
  }

  return undefined;
};

const ROOT_NAME = "Kanban";
const BOARD_NAME = "KanbanBoard";
const COLUMN_NAME = "KanbanColumn";
const ITEM_NAME = "KanbanItem";
const OVERLAY_NAME = "KanbanOverlay";

interface KanbanContextValue<T> {
  id: string;
  items: Record<UniqueIdentifier, T[]>;
  modifiers: DndContextProps["modifiers"];
  strategy: SortableContextProps["strategy"];
  orientation: "horizontal" | "vertical";
  activeId: UniqueIdentifier | null;
  setActiveId: (id: UniqueIdentifier | null) => void;
  getItemValue: (item: T) => UniqueIdentifier;
  flatCursor: boolean;
}

const KanbanContext = React.createContext<KanbanContextValue<unknown> | null>(
  null
);

function useKanbanContext(consumerName: string) {
  const context = React.useContext(KanbanContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

interface GetItemValue<T> {
  getItemValue: (item: T) => UniqueIdentifier;
}

type KanbanProps<T> = Omit<DndContextProps, "collisionDetection"> &
  (T extends object ? GetItemValue<T> : Partial<GetItemValue<T>>) & {
    value: Record<UniqueIdentifier, T[]>;
    onValueChange?: (columns: Record<UniqueIdentifier, T[]>) => void;
    onMove?: (
      event: DragEndEvent & { activeIndex: number; overIndex: number }
    ) => void;
    strategy?: SortableContextProps["strategy"];
    orientation?: "horizontal" | "vertical";
    flatCursor?: boolean;
  };

function Kanban<T>(props: KanbanProps<T>) {
  const {
    value,
    onValueChange,
    modifiers,
    strategy = verticalListSortingStrategy,
    orientation = "horizontal",
    onMove,
    getItemValue: getItemValueProp,
    accessibility,
    flatCursor = false,
    ...kanbanProps
  } = props;

  const id = React.useId();
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const lastOverIdRef = React.useRef<UniqueIdentifier | null>(null);
  const hasMovedRef = React.useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter })
  );

  const getItemValue = React.useCallback(
    (item: T): UniqueIdentifier => {
      if (typeof item === "object" && !getItemValueProp) {
        throw new Error(
          "`getItemValue` is required when using array of objects"
        );
      }
      return getItemValueProp
        ? getItemValueProp(item)
        : (item as UniqueIdentifier);
    },
    [getItemValueProp]
  );

  const getColumn = React.useCallback(
    (targetId: UniqueIdentifier) => {
      if (targetId in value) return targetId;
      for (const [columnId, columnItems] of Object.entries(value)) {
        if (columnItems.some((item) => getItemValue(item) === targetId)) {
          return columnId;
        }
      }
      return null;
    },
    [value, getItemValue]
  );

  const collisionDetection: CollisionDetection = React.useCallback(
    (args) => {
      if (activeId && activeId in value) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.id in value
          ),
        });
      }

      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(args);
      let overId = getFirstCollision(intersections, "id");

      if (!overId) {
        if (hasMovedRef.current) {
          lastOverIdRef.current = activeId;
        }
        return lastOverIdRef.current ? [{ id: lastOverIdRef.current }] : [];
      }

      if (overId in value) {
        const containerItems = value[overId];
        if (containerItems && containerItems.length > 0) {
          const closestItem = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container) =>
                container.id !== overId &&
                containerItems.some(
                  (item) => getItemValue(item) === container.id
                )
            ),
          });
          if (closestItem.length > 0) {
            overId = closestItem[0]?.id ?? overId;
          }
        }
      }

      lastOverIdRef.current = overId;
      return [{ id: overId }];
    },
    [activeId, value, getItemValue]
  );

  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      kanbanProps.onDragStart?.(event);
      if (event.activatorEvent.defaultPrevented) return;
      setActiveId(event.active.id);
    },
    [kanbanProps]
  );

  const onDragOver = React.useCallback(
    (event: DragOverEvent) => {
      kanbanProps.onDragOver?.(event);
      if (event.activatorEvent.defaultPrevented) return;

      const { active, over } = event;
      if (!over) return;

      const activeColumn = getColumn(active.id);
      const overColumn = getColumn(over.id);
      if (!activeColumn || !overColumn) return;

      if (activeColumn === overColumn) {
        const items = value[activeColumn];
        if (!items) return;

        const activeIndex = items.findIndex(
          (item) => getItemValue(item) === active.id
        );
        const overIndex = items.findIndex(
          (item) => getItemValue(item) === over.id
        );

        if (activeIndex !== overIndex && overIndex !== -1) {
          const newColumns = { ...value };
          newColumns[activeColumn] = arrayMove(items, activeIndex, overIndex);
          onValueChange?.(newColumns);
        }
      } else {
        const activeItems = value[activeColumn];
        const overItems = value[overColumn];
        if (!activeItems || !overItems) return;

        const activeIndex = activeItems.findIndex(
          (item) => getItemValue(item) === active.id
        );
        if (activeIndex === -1) return;

        const activeItem = activeItems[activeIndex];
        if (!activeItem) return;

        onValueChange?.({
          ...value,
          [activeColumn]: activeItems.filter(
            (item) => getItemValue(item) !== active.id
          ),
          [overColumn]: [...overItems, activeItem],
        });
        hasMovedRef.current = true;
      }
    },
    [value, getColumn, getItemValue, onValueChange, kanbanProps]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      kanbanProps.onDragEnd?.(event);
      if (event.activatorEvent.defaultPrevented) return;

      const { active, over } = event;
      if (!over) {
        setActiveId(null);
        return;
      }

      if (!(active.id in value) && !(over.id in value)) {
        const activeColumn = getColumn(active.id);
        const overColumn = getColumn(over.id);

        if (activeColumn && overColumn && activeColumn === overColumn) {
          const items = value[activeColumn];
          if (items) {
            const activeIndex = items.findIndex(
              (item) => getItemValue(item) === active.id
            );
            const overIndex = items.findIndex(
              (item) => getItemValue(item) === over.id
            );
            if (activeIndex !== overIndex && overIndex !== -1) {
              const newColumns = { ...value };
              newColumns[activeColumn] = arrayMove(
                items,
                activeIndex,
                overIndex
              );
              if (onMove) {
                onMove({ ...event, activeIndex, overIndex });
              } else {
                onValueChange?.(newColumns);
              }
            }
          }
        }
      }

      setActiveId(null);
      hasMovedRef.current = false;
    },
    [value, getColumn, getItemValue, onValueChange, onMove, kanbanProps]
  );

  const onDragCancel = React.useCallback(
    (event: DragCancelEvent) => {
      kanbanProps.onDragCancel?.(event);
      if (event.activatorEvent.defaultPrevented) return;
      setActiveId(null);
      hasMovedRef.current = false;
    },
    [kanbanProps]
  );

  const defaultAnnouncements: Announcements = React.useMemo(
    () => ({
      onDragStart({ active }) {
        const column = getColumn(active.id);
        return column
          ? `Kart taşınıyor, sütun: ${String(column)}`
          : "Kart taşınıyor";
      },
      onDragOver({ over }) {
        if (!over) return;
        const column = getColumn(over.id);
        return column
          ? `Kart ${String(column)} sütununun üzerinde`
          : undefined;
      },
      onDragEnd({ over }) {
        if (!over) return;
        const column = getColumn(over.id);
        return column
          ? `Kart ${String(column)} sütununa bırakıldı`
          : "Kart bırakıldı";
      },
      onDragCancel() {
        return "Taşıma iptal edildi";
      },
    }),
    [getColumn]
  );

  const contextValue = React.useMemo<KanbanContextValue<T>>(
    () => ({
      id,
      items: value,
      modifiers,
      strategy,
      orientation,
      activeId,
      setActiveId,
      getItemValue,
      flatCursor,
    }),
    [
      id,
      value,
      activeId,
      modifiers,
      strategy,
      orientation,
      getItemValue,
      flatCursor,
    ]
  );

  return (
    <KanbanContext.Provider value={contextValue as KanbanContextValue<unknown>}>
      <DndContext
        collisionDetection={collisionDetection}
        modifiers={modifiers}
        sensors={sensors}
        {...kanbanProps}
        id={id}
        measuring={{
          droppable: { strategy: MeasuringStrategy.Always },
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{
          announcements: defaultAnnouncements,
          screenReaderInstructions: {
            draggable: `
            Bir kartı taşımak için boşluk veya enter tuşuna basın.
            Ok tuşlarıyla konumu değiştirin.
            Bırakmak için tekrar boşluk veya enter; iptal için escape.
          `,
          },
          ...accessibility,
        }}
      />
    </KanbanContext.Provider>
  );
}

const KanbanBoardContext = React.createContext(false);

type KanbanBoardProps = React.ComponentProps<"div">;

function KanbanBoard({ className, children, ref, ...boardProps }: KanbanBoardProps & { ref?: React.Ref<HTMLDivElement> }) {
  const context = useKanbanContext(BOARD_NAME);
  return (
    <KanbanBoardContext.Provider value={true}>
      <div
        ref={ref}
        aria-orientation={context.orientation}
        className={cn(
          "flex size-full gap-4",
          context.orientation === "horizontal" ? "flex-row" : "flex-col",
          className
        )}
        {...boardProps}
      >
        {children}
      </div>
    </KanbanBoardContext.Provider>
  );
}

interface KanbanColumnProps extends React.ComponentProps<"div"> {
  value: UniqueIdentifier;
  disabled?: boolean;
}

function KanbanColumn({
  value,
  disabled,
  className,
  style,
  children,
  ref,
  ...columnProps
}: KanbanColumnProps & { ref?: React.Ref<HTMLDivElement> }) {
  const context = useKanbanContext(COLUMN_NAME);
  const inBoard = React.useContext(KanbanBoardContext);
  const inOverlay = React.useContext(KanbanOverlayContext);

  if (!inBoard && !inOverlay) {
    throw new Error(
      `\`${COLUMN_NAME}\` must be used within \`${BOARD_NAME}\` or \`${OVERLAY_NAME}\``
    );
  }

  const { setNodeRef, isOver } = useDroppable({ id: value });

  const composedRef = useComposedRefs(ref, setNodeRef);

  const items = React.useMemo(() => {
    const columnItems = context.items[value] ?? [];
    return columnItems.map((item) => context.getItemValue(item));
  }, [context.items, value, context.getItemValue]);

  return (
    <SortableContext items={items} strategy={context.strategy}>
      <div
        ref={composedRef}
        style={style}
        className={cn(
          "flex min-h-[200px] min-w-[260px] flex-1 flex-col gap-2 rounded-xl border border-border bg-surface-inset p-2.5",
          isOver && "ring-2 ring-inset ring-primary/40",
          disabled && "pointer-events-none opacity-50",
          className
        )}
        {...columnProps}
      >
        {children}
      </div>
    </SortableContext>
  );
}

interface KanbanItemProps extends React.ComponentProps<"div"> {
  value: UniqueIdentifier;
  asHandle?: boolean;
  disabled?: boolean;
}

function KanbanItem({
  value,
  style,
  asHandle,
  disabled,
  className,
  children,
  ref,
  ...itemProps
}: KanbanItemProps & { ref?: React.Ref<HTMLDivElement> }) {
  const context = useKanbanContext(ITEM_NAME);
  const inBoard = React.useContext(KanbanBoardContext);
  const inOverlay = React.useContext(KanbanOverlayContext);

  if (!inBoard && !inOverlay) {
    throw new Error(`\`${ITEM_NAME}\` must be used within \`${BOARD_NAME}\``);
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: value, disabled });

  const composedRef = useComposedRefs(ref, setNodeRef);

  const handleProps =
    asHandle && !disabled ? { ...attributes, ...listeners } : undefined;

  return (
    <div
      ref={composedRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...style,
      }}
      className={cn(
        "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
        {
          "touch-none select-none": asHandle,
          "cursor-default": context.flatCursor,
          "cursor-grab data-[dragging=true]:cursor-grabbing":
            !context.flatCursor && asHandle,
          "opacity-50": isDragging,
          "pointer-events-none opacity-50": disabled,
        },
        className
      )}
      data-dragging={isDragging ? true : undefined}
      {...itemProps}
      {...handleProps}
    >
      {children}
    </div>
  );
}

const KanbanOverlayContext = React.createContext(false);

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

interface KanbanOverlayProps
  extends Omit<React.ComponentProps<typeof DragOverlay>, "children"> {
  container?: Element | DocumentFragment | null;
  children?: React.ReactNode;
}

function KanbanOverlay({
  container: containerProp,
  children,
  ...overlayProps
}: KanbanOverlayProps) {
  const context = useKanbanContext(OVERLAY_NAME);
  const [mounted, setMounted] = React.useState(false);

  useIsomorphicLayoutEffect(() => setMounted(true), []);

  const container =
    containerProp ?? (mounted ? globalThis.document?.body : null);

  if (!container) return null;

  return ReactDOM.createPortal(
    <DragOverlay
      dropAnimation={dropAnimation}
      modifiers={context.modifiers}
      className={cn(!context.flatCursor && "cursor-grabbing")}
      {...overlayProps}
    >
      <KanbanOverlayContext.Provider value={true}>
        {context.activeId && children ? children : null}
      </KanbanOverlayContext.Provider>
    </DragOverlay>,
    container
  );
}

export {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanOverlay,
  type KanbanProps,
};
