"use client";

import dynamic from "next/dynamic";

const CommandPalette = dynamic(
  () =>
    import("@/components/v2/command/command-palette").then(
      (m) => m.CommandPalette
    ),
  { ssr: false }
);

export type CommandPaletteHostProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  everOpened: boolean;
  isAdmin?: boolean;
};

export function CommandPaletteHost({
  open,
  onOpenChange,
  everOpened,
  isAdmin,
}: CommandPaletteHostProps) {
  if (!everOpened) return null;

  return (
    <CommandPalette open={open} onOpenChange={onOpenChange} isAdmin={isAdmin} />
  );
}

export {
  getCommandShortcutLabel,
  useCommandShortcut,
} from "@/components/v2/command/use-command-shortcut";
