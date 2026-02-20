/**
 * Утилита для корневого контейнера UI поверх глобуса/карты.
 * ID контейнера и функция создания/получения элемента в document.body.
 */
export const UI_ROOT_ID = "app-ui-root";

/** Контейнер для UI поверх глобуса и карты. Создаётся на клиенте и вешается в конец body. */
export function getOrCreateUiRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(UI_ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = UI_ROOT_ID;
    document.body.appendChild(el);
  }
  return el;
}
