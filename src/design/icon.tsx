import type {HTMLAttributes} from 'react';
export function Icon({name,...props}:HTMLAttributes<HTMLElement>&{name:string}){return <i {...props} aria-hidden="true" className={`e-uicon ${props.className||''}`}><span className={`fi fi-rr-${name}`}/></i>}
export const SearchIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="search"/>;
export const PlusIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="plus"/>;
export const ListIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="list"/>;
export const BoardIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="columns-3"/>;
export const FilterIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="settings-sliders"/>;
export const FolderIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="folder"/>;
export const EditIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="pencil"/>;
export const CheckIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="check"/>;
export const TrashIcon=(p:HTMLAttributes<HTMLElement>)=><Icon {...p} name="trash"/>;
