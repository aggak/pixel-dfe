import type {HTMLAttributes, SVGProps} from 'react';
export const PawIcon=(p:SVGProps<SVGSVGElement>)=><svg {...p} aria-hidden="true" focusable="false" className={`e-paw ${p.className||''}`} width="8" height="8" viewBox="0 0 8 8" fill="currentColor" shapeRendering="crispEdges"><path d="M2 0h1v2H2zM5 0h1v2H5zM0 2h1v2H0zM7 2h1v2H7zM3 4h2v1H3zM2 5h4v1H2zM1 6h6v1H1zM1 7h2v1H1zM5 7h2v1H5z" /></svg>;

const desenhos = {
  "arrow-down": "M3 1h1v1h-1zM3 2h1v1h-1zM1 3h1v1h-1zM3 3h1v1h-1zM5 3h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM3 5h1v1h-1z",
  "calendar": "M1 0h1v1h-1zM5 0h1v1h-1zM0 1h7v1h-7zM0 2h1v1h-1zM6 2h1v1h-1zM0 3h7v1h-7zM0 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM2 5h1v1h-1zM4 5h1v1h-1zM6 5h1v1h-1zM1 6h5v1h-5z",
  "check": "M6 1h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM4 3h1v1h-1zM1 4h1v1h-1zM3 4h1v1h-1zM2 5h1v1h-1z",
  "chevron-down": "M1 2h1v1h-1zM5 2h1v1h-1zM2 3h1v1h-1zM4 3h1v1h-1zM3 4h1v1h-1z",
  "chevron-right": "M2 1h1v1h-1zM3 2h1v1h-1zM4 3h1v1h-1zM3 4h1v1h-1zM2 5h1v1h-1z",
  "chevron-up": "M3 2h1v1h-1zM2 3h1v1h-1zM4 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1z",
  "chevrons-up": "M3 0h1v1h-1zM2 1h1v1h-1zM4 1h1v1h-1zM1 2h1v1h-1zM5 2h1v1h-1zM3 4h1v1h-1zM2 5h1v1h-1zM4 5h1v1h-1zM1 6h1v1h-1zM5 6h1v1h-1z",
  "circle": "M2 0h3v1h-3zM1 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1zM2 6h3v1h-3z",
  "circle-alert": "M2 0h3v1h-3zM1 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM3 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM2 6h3v1h-3z",
  "circle-question-mark": "M2 0h3v1h-3zM1 1h1v1h-1zM3 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM2 6h3v1h-3z",
  "cloud-off": "M0 0h1v1h-1zM1 1h1v1h-1zM3 1h2v1h-2zM2 2h1v1h-1zM5 2h1v1h-1zM0 3h2v1h-2zM3 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM1 5h3v1h-3zM5 5h1v1h-1zM6 6h1v1h-1z",
  "cloud-upload": "M2 0h2v1h-2zM1 1h1v1h-1zM4 1h1v1h-1zM1 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM3 6h1v1h-1z",
  "columns-3": "M1 0h5v1h-5zM0 1h1v1h-1zM2 1h1v1h-1zM4 1h1v1h-1zM6 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM2 5h1v1h-1zM4 5h1v1h-1zM6 5h1v1h-1zM1 6h5v1h-5z",
  "ellipsis-vertical": "M3 1h1v1h-1zM3 3h1v1h-1zM3 5h1v1h-1z",
  "eye": "M2 1h3v1h-3zM1 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1zM2 5h3v1h-3z",
  "eye-off": "M0 0h1v1h-1zM1 1h1v1h-1zM3 1h2v1h-2zM2 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM2 5h2v1h-2zM5 5h1v1h-1zM6 6h1v1h-1z",
  "file-plus": "M1 0h5v1h-5zM0 1h1v1h-1zM6 1h1v1h-1zM0 2h1v1h-1zM3 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM0 4h1v1h-1zM3 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM1 6h5v1h-5z",
  "file-text": "M1 0h3v1h-3zM0 1h1v1h-1zM4 1h1v1h-1zM0 2h1v1h-1zM3 2h3v1h-3zM0 3h1v1h-1zM5 3h1v1h-1zM0 4h1v1h-1zM2 4h2v1h-2zM5 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1zM1 6h4v1h-4z",
  "folder": "M1 1h2v1h-2zM0 2h1v1h-1zM3 2h3v1h-3zM0 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM1 6h5v1h-5z",
  "info": "M2 0h3v1h-3zM1 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM3 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM3 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM2 6h3v1h-3z",
  "list": "M0 1h1v1h-1zM2 1h5v1h-5zM0 3h1v1h-1zM2 3h5v1h-5zM0 5h1v1h-1zM2 5h5v1h-5z",
  "minus": "M1 3h5v1h-5z",
  "pencil": "M5 0h1v1h-1zM4 1h1v1h-1zM6 1h1v1h-1zM3 2h1v1h-1zM5 2h1v1h-1zM2 3h1v1h-1zM4 3h1v1h-1zM1 4h1v1h-1zM3 4h1v1h-1zM0 5h1v1h-1zM2 5h1v1h-1zM0 6h2v1h-2z",
  "play": "M1 0h2v1h-2zM1 1h1v1h-1zM3 1h1v1h-1zM1 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM1 6h2v1h-2z",
  "plus": "M3 1h1v1h-1zM3 2h1v1h-1zM1 3h5v1h-5zM3 4h1v1h-1zM3 5h1v1h-1z",
  "refresh-cw": "M2 0h3v1h-3zM1 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM5 4h1v1h-1zM1 5h1v1h-1zM2 6h3v1h-3z",
  "search": "M1 0h3v1h-3zM0 1h1v1h-1zM4 1h1v1h-1zM0 2h1v1h-1zM4 2h1v1h-1zM0 3h1v1h-1zM4 3h1v1h-1zM1 4h4v1h-4zM5 5h1v1h-1zM6 6h1v1h-1z",
  "sliders-horizontal": "M4 0h1v1h-1zM0 1h7v1h-7zM4 2h1v1h-1zM2 4h1v1h-1zM0 5h7v1h-7zM2 6h1v1h-1z",
  "trash-2": "M2 0h3v1h-3zM0 1h7v1h-7zM1 2h1v1h-1zM5 2h1v1h-1zM1 3h1v1h-1zM3 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM3 4h1v1h-1zM5 4h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1zM2 6h3v1h-3z",
  "user": "M2 0h3v1h-3zM2 1h1v1h-1zM4 1h1v1h-1zM2 2h3v1h-3zM2 4h3v1h-3zM1 5h1v1h-1zM5 5h1v1h-1zM0 6h1v1h-1zM6 6h1v1h-1z",
  "x": "M1 1h1v1h-1zM5 1h1v1h-1zM2 2h1v1h-1zM4 2h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1z",
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
  return <i {...props} aria-hidden="true" className={`e-uicon ${props.className||''}`}><svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" focusable="false"><path fill="currentColor" d={desenhos[desenho]} /></svg></i>;
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
