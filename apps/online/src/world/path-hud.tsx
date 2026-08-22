/**
 * Kind icons and unit names, projected out of the scene the same way
 * LabelProbe writes course names: a world point, a DOM node, a transform.
 *
 * This lives next to the canvas rather than in App.tsx because the path is
 * the world's job. Readable text stays DOM — never a TextGeometry.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import "./path-hud.css";

export interface PathSprite {
  readonly id: string;
  readonly position: THREE.Vector3;
  readonly text: string;
  readonly label?: string;
  readonly role: "icon" | "unit";
  readonly locked?: boolean;
}

export function PathHud({ sprites }: { readonly sprites: readonly PathSprite[] }) {
  const { camera, size, gl } = useThree();
  const host = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const scratch = useRef(new THREE.Vector3());

  useEffect(() => {
    // Fixed on `document.body`, sized to the canvas rect. Must not live
    // inside `.stagewrap`: on a phone that column is height:auto, and any
    // in-flow child feeds a loop that stretches the drawing buffer until
    // the sea renders black.
    const element = document.createElement("div");
    element.className = "path-hud";
    element.style.position = "fixed";
    element.style.overflow = "hidden";
    element.style.pointerEvents = "none";
    element.style.zIndex = "2";
    document.body.appendChild(element);
    host.current = element;
    return () => {
      element.remove();
      host.current = null;
      nodes.current.clear();
    };
  }, [gl]);

  useEffect(() => {
    const layer = host.current;
    if (!layer) return;
    const seen = new Set<string>();
    for (const sprite of sprites) {
      seen.add(sprite.id);
      let element = nodes.current.get(sprite.id);
      if (!element) {
        element = document.createElement("span");
        element.dataset.id = sprite.id;
        element.style.position = "absolute";
        element.style.top = "0";
        element.style.left = "0";
        layer.appendChild(element);
        nodes.current.set(sprite.id, element);
      }
      element.className = `path-hud__item path-hud__item--${sprite.role}${
        sprite.locked ? " is-locked" : ""
      }`;
      element.textContent = sprite.text;
      if (sprite.role === "icon") {
        element.setAttribute("aria-label", sprite.label ?? sprite.text);
        element.setAttribute("role", "img");
      } else {
        element.removeAttribute("role");
        element.removeAttribute("aria-label");
      }
    }
    for (const [id, element] of nodes.current) {
      if (seen.has(id)) continue;
      element.remove();
      nodes.current.delete(id);
    }
  }, [sprites]);

  useFrame(() => {
    if (host.current) {
      const rect = gl.domElement.getBoundingClientRect();
      host.current.style.left = `${rect.left}px`;
      host.current.style.top = `${rect.top}px`;
      host.current.style.width = `${rect.width}px`;
      host.current.style.height = `${rect.height}px`;
    }
    const projectedIds = new Set<string>();
    for (const sprite of sprites) {
      const element = nodes.current.get(sprite.id);
      if (!element) continue;
      const projected = scratch.current.copy(sprite.position).project(camera);
      if (projected.z >= 1 || Math.abs(projected.x) > 1.05 || Math.abs(projected.y) > 1.05) {
        element.style.setProperty("--placed", "0");
        continue;
      }
      const x = ((projected.x + 1) / 2) * size.width;
      const y = ((1 - projected.y) / 2) * size.height;
      // Icons sit on the stone (centred). Unit names are left-aligned so a
      // long title grows toward the path instead of off the canvas edge.
      const origin = sprite.role === "unit" ? "translate(0, -50%)" : "translate(-50%, -50%)";
      element.style.transform = `translate(${x}px, ${y}px) ${origin}`;
      element.style.setProperty("--placed", "1");
      projectedIds.add(sprite.id);
    }
    for (const [id, element] of nodes.current) {
      if (!projectedIds.has(id)) element.style.setProperty("--placed", "0");
    }
  }, 2);

  return null;
}
