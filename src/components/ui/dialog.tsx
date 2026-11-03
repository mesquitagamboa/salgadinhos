import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
export function Dialog({open,onOpenChange,title,description,children}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description:string;children:ReactNode}) {
 return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"/><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"><DialogPrimitive.Title className="pr-8 text-2xl font-bold tracking-tight">{title}</DialogPrimitive.Title><DialogPrimitive.Description className="mt-2 mb-6 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>{children}<DialogPrimitive.Close aria-label="Fechar" className="absolute right-4 top-4 rounded-lg p-2 hover:bg-muted focus-visible:ring-2"><X size={20}/></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}
