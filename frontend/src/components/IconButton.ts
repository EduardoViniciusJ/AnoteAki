import "./IconButton.css";

export type IconName = "plus" | "history" | "settings" | "close";

export interface IconButtonProps {
  icon: IconName;
  /** Rótulo acessível (aria-label) e dica do mouse. */
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

// Ícones de traço 16×16 desenhados com paths (sem innerHTML).
const PATHS: Record<IconName, string[]> = {
  plus: ["M8 3v10", "M3 8h10"],
  history: ["M7 2.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9", "M10.3 10.3L13.5 13.5"],
  settings: [
    "M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5",
    "M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
  ],
  close: ["M4 4l8 8", "M12 4l-8 8"],
};

function createIcon(icon: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon-button__icon");
  for (const d of PATHS[icon]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export function createIconButton(props: IconButtonProps) {
  let current = props;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "icon-button";

  const handleClick = () => {
    if (!current.disabled) current.onClick?.();
  };
  el.addEventListener("click", handleClick);

  function update(next: IconButtonProps) {
    if (next.icon !== current.icon || !el.firstChild) el.replaceChildren(createIcon(next.icon));
    current = next;
    el.setAttribute("aria-label", next.label);
    el.title = next.label;
    // aria-disabled (e não `disabled`) mantém o botão no Tab, com o motivo na dica.
    el.setAttribute("aria-disabled", String(Boolean(next.disabled)));
  }

  update(props);

  return {
    el,
    update,
    destroy() {
      el.removeEventListener("click", handleClick);
      el.remove();
    },
  };
}
