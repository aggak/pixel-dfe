import type {HTMLAttributes, SVGProps} from 'react';
export const PawIcon=(p:SVGProps<SVGSVGElement>)=><svg {...p} aria-hidden="true" focusable="false" className={`e-paw ${p.className||''}`} width="8" height="8" viewBox="0 0 8 8" fill="currentColor" shapeRendering="crispEdges"><path d="M2 0h1v2H2zM5 0h1v2H5zM0 2h1v2H0zM7 2h1v2H7zM3 4h2v1H3zM2 5h4v1H2zM1 6h6v1H1zM1 7h2v1H1zM5 7h2v1H5z" /></svg>;
export function Icon({name,...props}:HTMLAttributes<HTMLElement>&{name:string}){return <i {...props} aria-hidden="true" className={`e-uicon ${props.className||''}`}><span className={`fi fi-rr-${name}`}/></i>}
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
