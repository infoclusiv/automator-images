import { centerOf } from "./domUtils.js";

export function pointerClick(element) {
  const { x, y } = centerOf(element);
  const eventInit = {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    clientX: x,
    clientY: y,
  };

  element.dispatchEvent(new PointerEvent("pointerdown", eventInit));
  element.dispatchEvent(new PointerEvent("pointerup", eventInit));
}

export function mouseClick(element) {
  const { x, y } = centerOf(element);
  const eventInit = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  };

  element.dispatchEvent(new MouseEvent("mousedown", eventInit));
  element.dispatchEvent(new MouseEvent("mouseup", eventInit));
  element.dispatchEvent(new MouseEvent("click", eventInit));
}

export function toggleTab(element) {
  if (element.getAttribute("data-state") === "active") {
    return false;
  }

  mouseClick(element);
  return true;
}

export function stealthClick(element) {
  const rect = element.getBoundingClientRect();
  const offsetX = (Math.random() - 0.5) * rect.width * 0.6;
  const offsetY = (Math.random() - 0.5) * rect.height * 0.6;
  const clientX = rect.left + rect.width / 2 + offsetX;
  const clientY = rect.top + rect.height / 2 + offsetY;

  console.log(
    `🎯 Stealth click at (${Math.round(clientX)}, ${Math.round(clientY)}) — offset (${Math.round(offsetX)}px, ${Math.round(offsetY)}px)`,
  );

  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    screenX: window.screenX + clientX,
    screenY: window.screenY + clientY,
    button: 0,
  };

  element.dispatchEvent(
    new PointerEvent("pointerdown", { ...eventInit, isPrimary: true, buttons: 1 }),
  );
  element.dispatchEvent(new MouseEvent("mousedown", { ...eventInit, buttons: 1 }));
  element.dispatchEvent(
    new PointerEvent("pointerup", { ...eventInit, isPrimary: true, buttons: 0 }),
  );
  element.dispatchEvent(new MouseEvent("mouseup", { ...eventInit, buttons: 0 }));
  element.dispatchEvent(new PointerEvent("click", { ...eventInit, isPrimary: true }));
  element.dispatchEvent(new MouseEvent("click", eventInit));
}
