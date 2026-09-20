import type { ReactNode } from "react";
import { PathDialog } from "../path/PathDialog.js";
import "./map-nodes.css";

export function MapNodeDialog({
  title,
  onClose,
  returnFocusTo,
  children,
}: {
  title: string;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <PathDialog
      open
      centered
      className="map-node-dialog"
      title={title}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
    >
      {children}
    </PathDialog>
  );
}
