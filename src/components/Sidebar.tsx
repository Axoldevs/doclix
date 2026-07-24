import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Menu, X, FileText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project, Section } from '@/types/database';
import { Button } from '@/components/ui/Button';

interface SidebarProps {
  project: Project;
  sections: Section[];
  activeSlug: string | undefined;
  isOwner: boolean;
  onReorder: (orderedIds: string[]) => void;
  onAddSection: () => void;
  onOpenSettings: () => void;
}

function SortableItem({
  section,
  projectSlug,
  isActive,
  isOwner,
  onNavigate,
}: {
  section: Section;
  projectSlug: string;
  isActive: boolean;
  isOwner: boolean;
  onNavigate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center">
      {isOwner && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none px-1 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-60 hover:!opacity-100 active:cursor-grabbing"
          aria-label="Reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <Link
        to={`/docs/${projectSlug}/${section.slug}`}
        onClick={onNavigate}
        className={cn(
          'flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors duration-200',
          isActive
            ? 'bg-primary/15 font-medium text-primary'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        )}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{section.title}</span>
      </Link>
    </div>
  );
}

export function Sidebar({
  project,
  sections,
  activeSlug,
  isOwner,
  onReorder,
  onAddSection,
  onOpenSettings,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex);
    onReorder(reordered.map((s) => s.id));
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate(`/docs/${project.slug}`)}
            className="truncate text-left text-sm font-semibold text-foreground hover:text-primary"
          >
            {project.title}
          </button>
        </div>
        {isOwner && (
          <button
            onClick={onOpenSettings}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
            title="Project settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5">
              {sections.map((section) => (
                <SortableItem
                  key={section.id}
                  section={section}
                  projectSlug={project.slug}
                  isActive={section.slug === activeSlug}
                  isOwner={isOwner}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {sections.length === 0 && (
          <p className="px-2.5 py-4 text-xs text-muted-foreground">No sections yet.</p>
        )}
      </nav>

      {isOwner && (
        <div className="border-t border-border p-3">
          <Button variant="outline" size="sm" className="w-full" onClick={onAddSection}>
            <Plus className="h-3.5 w-3.5" />
            Add section
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-card shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
