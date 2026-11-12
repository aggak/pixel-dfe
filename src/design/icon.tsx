import type {HTMLAttributes, SVGProps} from 'react';
export const PawIcon=(p:SVGProps<SVGSVGElement>)=><svg {...p} aria-hidden="true" focusable="false" className={`e-paw ${p.className||''}`} width="8" height="8" viewBox="0 0 8 8" fill="currentColor" shapeRendering="crispEdges"><path d="M2 0h1v2H2zM5 0h1v2H5zM0 2h1v2H0zM7 2h1v2H7zM3 4h2v1H3zM2 5h4v1H2zM1 6h6v1H1zM1 7h2v1H1zM5 7h2v1H5z" /></svg>;

const desenhos = {
  "arrow-down": <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
  "calendar": <><path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></>,
  "check": <><path d="M20 6 9 17l-5-5" /></>,
  "chevron-down": <><path d="m6 9 6 6 6-6" /></>,
  "chevron-right": <><path d="m9 18 6-6-6-6" /></>,
  "chevron-up": <><path d="m18 15-6-6-6 6" /></>,
  "chevrons-up": <><path d="m17 11-5-5-5 5" /><path d="m17 18-5-5-5 5" /></>,
  "circle": <><circle cx="12" cy="12" r="10" /></>,
  "circle-alert": <><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></>,
  "circle-question-mark": <><circle cx="12" cy="12" r="10" /><path d="M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5" /><path d="M12 17h.01" /></>,
  "cloud-off": <><path d="M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057" /><path d="M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78" /><path d="m2 2 20 20" /></>,
  "cloud-upload": <><path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" /></>,
  "columns-3": <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" /></>,
  "ellipsis-vertical": <><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></>,
  "eye": <><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" /></>,
  "file-plus": <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M9 15h6" /><path d="M12 18v-6" /></>,
  "file-text": <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
  "folder": <><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></>,
  "info": <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  "list": <><path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" /></>,
  "minus": <><path d="M5 12h14" /></>,
  "pencil": <><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></>,
  "play": <><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" /></>,
  "plus": <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  "refresh-cw": <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></>,
  "search": <><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>,
  "sliders-horizontal": <><path d="M10 5H3" /><path d="M12 19H3" /><path d="M14 3v4" /><path d="M16 17v4" /><path d="M21 12h-9" /><path d="M21 19h-5" /><path d="M21 5h-7" /><path d="M8 10v4" /><path d="M8 12H3" /></>,
  "trash-2": <><path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  "user": <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  "x": <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
};

const nomes: Record<string, keyof typeof desenhos> = {
  "add-document": "file-plus",
  "angle-double-small-up": "chevrons-up",
  "angle-down": "chevron-down",
  "angle-right": "chevron-right",
  "angle-small-down": "chevron-down",
  "angle-small-up": "chevron-up",
  "arrow-small-down": "arrow-down",
  "calendar": "calendar",
  "check": "check",
  "circle": "circle",
  "cloud-disabled": "cloud-off",
  "cloud-upload-alt": "cloud-upload",
  "columns-3": "columns-3",
  "cross-small": "x",
  "document": "file-text",
  "exclamation": "circle-alert",
  "eye": "eye",
  "eye-crossed": "eye-off",
  "folder": "folder",
  "info": "info",
  "interrogation": "circle-question-mark",
  "list": "list",
  "menu-dots-vertical": "ellipsis-vertical",
  "minus-small": "minus",
  "pencil": "pencil",
  "play": "play",
  "plus": "plus",
  "plus-small": "plus",
  "refresh": "refresh-cw",
  "search": "search",
  "settings-sliders": "sliders-horizontal",
  "trash": "trash-2",
  "user": "user",
};

export function Icon({name,...props}:HTMLAttributes<HTMLElement>&{name:string}){
  const desenho = Object.hasOwn(nomes, name) ? nomes[name] : "circle-question-mark";
  return <i {...props} aria-hidden="true" className={`e-uicon ${props.className||''}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{desenhos[desenho]}</svg></i>;
}
export const SearchIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="search"/>;
export const PlusIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="plus"/>;
export const ListIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="list"/>;
export const BoardIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="columns-3"/>;
export const FilterIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="settings-sliders"/>;
export const FolderIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="folder"/>;
export const EditIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="pencil"/>;
export const CheckIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="check"/>;
export const RefreshIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="refresh"/>;
export const TrashIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="trash"/>;
