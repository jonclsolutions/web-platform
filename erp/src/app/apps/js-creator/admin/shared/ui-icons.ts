/**
 * @file ui-icons.ts
 * @path src/app/apps/js-creator/admin/shared/ui-icons.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Icons of the interface of the editor and the workspace pages (tools, layers,
 *   alignment, zoom, download, move …), drawn by
 *   CreatorIconComponent. They are Lucide icons (ISC licence - assets/icons/LICENSE.txt); the
 *   icons a user puts INTO a template are the separate set of assets/icons/icons.json.
 * @usage `<app-creator-icon [nodes]="uiIcon('undo')" [size]="16" />`
 * @dependencies IconNode (js-creator.models.ts).
 */

import { IconNode } from './js-creator.models';

/** Name of an interface icon. */
export type UiIconName = 'undo' | 'redo' | 'zoom-in' | 'zoom-out' | 'fit' | 'text' | 'image' | 'grid' | 'shape' | 'icon' | 'eye' | 'eye-off' | 'lock' | 'unlock' | 'copy' | 'trash' | 'up' | 'down' | 'front' | 'back' | 'align-left' | 'align-hcenter' | 'align-right' | 'align-top' | 'align-vcenter' | 'align-bottom' | 'distribute-h' | 'distribute-v' | 'snap' | 'save' | 'arrow-left' | 'arrow-right' | 'grip' | 'field' | 'highlight' | 'safe-zone' | 'plus' | 'x' | 'magnet' | 'layers' | 'sliders' | 'settings' | 'keyboard' | 'braces' | 'rect' | 'ellipse' | 'line' | 'hand' | 'ratio' | 'download' | 'folder-input' | 'block' | 'group' | 'ungroup';

/** Elements of the interface icons (Lucide, 24 × 24 grid). */
const UI_ICONS: Record<UiIconName, IconNode[]> = {
  'block': [["path",{"d":"M15.536 11.293a1 1 0 0 0 0 1.414l2.376 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z"}],["path",{"d":"M2.297 11.293a1 1 0 0 0 0 1.414l2.377 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414L6.088 8.916a1 1 0 0 0-1.414 0z"}],["path",{"d":"M8.916 17.912a1 1 0 0 0 0 1.415l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.415l-2.377-2.376a1 1 0 0 0-1.414 0z"}],["path",{"d":"M8.916 4.674a1 1 0 0 0 0 1.414l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z"}]],
  'group': [["path",{"d":"M3 7V5c0-1.1.9-2 2-2h2"}],["path",{"d":"M17 3h2c1.1 0 2 .9 2 2v2"}],["path",{"d":"M21 17v2c0 1.1-.9 2-2 2h-2"}],["path",{"d":"M7 21H5c-1.1 0-2-.9-2-2v-2"}],["rect",{"width":"7","height":"5","x":"7","y":"7","rx":"1"}],["rect",{"width":"7","height":"5","x":"10","y":"12","rx":"1"}]],
  'ungroup': [["rect",{"width":"8","height":"6","x":"5","y":"4","rx":"1"}],["rect",{"width":"8","height":"6","x":"11","y":"14","rx":"1"}]],
  'download': [["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]],
  'folder-input': [["path",{"d":"M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"}],["path",{"d":"M2 13h10"}],["path",{"d":"m9 16 3-3-3-3"}]],
  'undo': [["path",{"d":"M9 14 4 9l5-5"}],["path",{"d":"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"}]],
  'redo': [["path",{"d":"m15 14 5-5-5-5"}],["path",{"d":"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"}]],
  'zoom-in': [["circle",{"cx":"11","cy":"11","r":"8"}],["line",{"x1":"21","x2":"16.65","y1":"21","y2":"16.65"}],["line",{"x1":"11","x2":"11","y1":"8","y2":"14"}],["line",{"x1":"8","x2":"14","y1":"11","y2":"11"}]],
  'zoom-out': [["circle",{"cx":"11","cy":"11","r":"8"}],["line",{"x1":"21","x2":"16.65","y1":"21","y2":"16.65"}],["line",{"x1":"8","x2":"14","y1":"11","y2":"11"}]],
  'fit': [["path",{"d":"M8 3H5a2 2 0 0 0-2 2v3"}],["path",{"d":"M21 8V5a2 2 0 0 0-2-2h-3"}],["path",{"d":"M3 16v3a2 2 0 0 0 2 2h3"}],["path",{"d":"M16 21h3a2 2 0 0 0 2-2v-3"}]],
  'text': [["path",{"d":"M12 4v16"}],["path",{"d":"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"}],["path",{"d":"M9 20h6"}]],
  'image': [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["circle",{"cx":"9","cy":"9","r":"2"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]],
  'grid': [["rect",{"width":"7","height":"7","x":"3","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"14","rx":"1"}],["rect",{"width":"7","height":"7","x":"3","y":"14","rx":"1"}]],
  'shape': [["path",{"d":"M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"}],["rect",{"x":"3","y":"14","width":"7","height":"7","rx":"1"}],["circle",{"cx":"17.5","cy":"17.5","r":"3.5"}]],
  'icon': [["path",{"d":"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"}]],
  'eye': [["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}],["circle",{"cx":"12","cy":"12","r":"3"}]],
  'eye-off': [["path",{"d":"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"}],["path",{"d":"M14.084 14.158a3 3 0 0 1-4.242-4.242"}],["path",{"d":"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"}],["path",{"d":"m2 2 20 20"}]],
  'lock': [["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]],
  'unlock': [["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 9.9-1"}]],
  'copy': [["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],
  'trash': [["path",{"d":"M10 11v6"}],["path",{"d":"M14 11v6"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{"d":"M3 6h18"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]],
  'up': [["path",{"d":"m5 12 7-7 7 7"}],["path",{"d":"M12 19V5"}]],
  'down': [["path",{"d":"M12 5v14"}],["path",{"d":"m19 12-7 7-7-7"}]],
  'front': [["path",{"d":"m17 11-5-5-5 5"}],["path",{"d":"m17 18-5-5-5 5"}]],
  'back': [["path",{"d":"m7 6 5 5 5-5"}],["path",{"d":"m7 13 5 5 5-5"}]],
  'align-left': [["rect",{"width":"9","height":"6","x":"6","y":"14","rx":"2"}],["rect",{"width":"16","height":"6","x":"6","y":"4","rx":"2"}],["path",{"d":"M2 2v20"}]],
  'align-hcenter': [["path",{"d":"M12 2v20"}],["path",{"d":"M8 10H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h4"}],["path",{"d":"M16 10h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-4"}],["path",{"d":"M8 20H7a2 2 0 0 1-2-2v-2c0-1.1.9-2 2-2h1"}],["path",{"d":"M16 14h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1"}]],
  'align-right': [["rect",{"width":"16","height":"6","x":"2","y":"4","rx":"2"}],["rect",{"width":"9","height":"6","x":"9","y":"14","rx":"2"}],["path",{"d":"M22 22V2"}]],
  'align-top': [["rect",{"width":"6","height":"16","x":"4","y":"6","rx":"2"}],["rect",{"width":"6","height":"9","x":"14","y":"6","rx":"2"}],["path",{"d":"M22 2H2"}]],
  'align-vcenter': [["path",{"d":"M2 12h20"}],["path",{"d":"M10 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"}],["path",{"d":"M10 8V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"}],["path",{"d":"M20 16v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1"}],["path",{"d":"M14 8V7c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v1"}]],
  'align-bottom': [["rect",{"width":"6","height":"16","x":"4","y":"2","rx":"2"}],["rect",{"width":"6","height":"9","x":"14","y":"9","rx":"2"}],["path",{"d":"M22 22H2"}]],
  'distribute-h': [["rect",{"width":"6","height":"14","x":"4","y":"5","rx":"2"}],["rect",{"width":"6","height":"10","x":"14","y":"7","rx":"2"}],["path",{"d":"M17 22v-5"}],["path",{"d":"M17 7V2"}],["path",{"d":"M7 22v-3"}],["path",{"d":"M7 5V2"}]],
  'distribute-v': [["path",{"d":"M22 17h-3"}],["path",{"d":"M22 7h-5"}],["path",{"d":"M5 17H2"}],["path",{"d":"M7 7H2"}],["rect",{"x":"5","y":"14","width":"14","height":"6","rx":"2"}],["rect",{"x":"7","y":"4","width":"10","height":"6","rx":"2"}]],
  'snap': [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M3 9h18"}],["path",{"d":"M3 15h18"}],["path",{"d":"M9 3v18"}],["path",{"d":"M15 3v18"}]],
  'save': [["path",{"d":"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"}],["path",{"d":"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"}],["path",{"d":"M7 3v4a1 1 0 0 0 1 1h7"}]],
  'arrow-left': [["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],
  'arrow-right': [["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]],
  'grip': [["circle",{"cx":"9","cy":"12","r":"1"}],["circle",{"cx":"9","cy":"5","r":"1"}],["circle",{"cx":"9","cy":"19","r":"1"}],["circle",{"cx":"15","cy":"12","r":"1"}],["circle",{"cx":"15","cy":"5","r":"1"}],["circle",{"cx":"15","cy":"19","r":"1"}]],
  'field': [["path",{"d":"M12 20h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2H6"}],["path",{"d":"M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"}],["path",{"d":"M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"}],["path",{"d":"M6 4h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1"}],["path",{"d":"M9 6v12"}]],
  'highlight': [["path",{"d":"m9 11-6 6v3h9l3-3"}],["path",{"d":"m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"}]],
  'safe-zone': [["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2"}],["path",{"d":"M12 18h.01"}]],
  'plus': [["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],
  'x': [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],
  'magnet': [["path",{"d":"m12 15 4 4"}],["path",{"d":"M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"}],["path",{"d":"m5 8 4 4"}]],
  'layers': [["path",{"d":"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"}],["path",{"d":"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"}],["path",{"d":"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"}]],
  'sliders': [["path",{"d":"M10 5H3"}],["path",{"d":"M12 19H3"}],["path",{"d":"M14 3v4"}],["path",{"d":"M16 17v4"}],["path",{"d":"M21 12h-9"}],["path",{"d":"M21 19h-5"}],["path",{"d":"M21 5h-7"}],["path",{"d":"M8 10v4"}],["path",{"d":"M8 12H3"}]],
  'settings': [["path",{"d":"M14 17H5"}],["path",{"d":"M19 7h-9"}],["circle",{"cx":"17","cy":"17","r":"3"}],["circle",{"cx":"7","cy":"7","r":"3"}]],
  'keyboard': [["path",{"d":"M10 8h.01"}],["path",{"d":"M12 12h.01"}],["path",{"d":"M14 8h.01"}],["path",{"d":"M16 12h.01"}],["path",{"d":"M18 8h.01"}],["path",{"d":"M6 8h.01"}],["path",{"d":"M7 16h10"}],["path",{"d":"M8 12h.01"}],["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}]],
  'braces': [["path",{"d":"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"}],["path",{"d":"M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"}]],
  'rect': [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}]],
  'ellipse': [["circle",{"cx":"12","cy":"12","r":"10"}]],
  'line': [["path",{"d":"M5 12h14"}]],
  'ratio': [["rect",{"width":"12","height":"20","x":"6","y":"2","rx":"2"}],["rect",{"width":"20","height":"12","x":"2","y":"6","rx":"2"}]],
  'hand': [["path",{"d":"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"}],["path",{"d":"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"}],["path",{"d":"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"}],["path",{"d":"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"}]],
};

/**
 * @description Elements of an interface icon.
 * @param name Name.
 */
export function uiIcon(name: UiIconName): IconNode[] {
  return UI_ICONS[name];
}
