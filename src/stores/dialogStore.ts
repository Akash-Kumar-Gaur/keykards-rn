/**
 * App dialog queue — the single source for themed alerts/confirms.
 *
 * Lives in a store (not React context) so non-component code — mutation error
 * handlers, adapters, crypto callers — can raise a dialog the same way it used
 * to call Alert.alert(). `AppDialogHost` renders whatever is at the front.
 */

import { create } from 'zustand';

export type DialogTone = 'indigo' | 'amber' | 'green' | 'danger';

export type DialogAction = {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: 'primary' | 'ghost';
  /** Renders in the danger tone and, for confirms, marks the resolving action. */
  destructive?: boolean;
  /** Keep the dialog open after pressing (caller closes it). */
  keepOpen?: boolean;
};

export type DialogRequest = {
  title: string;
  message?: string;
  /** Ionicons glyph name; typed at the component boundary. */
  icon?: string;
  tone?: DialogTone;
  /** Defaults to a single "OK" ghost action when omitted. */
  actions?: DialogAction[];
  /** Whether tapping the scrim / back dismisses. Default true. */
  dismissable?: boolean;
};

type QueuedDialog = DialogRequest & { id: string };

type State = {
  queue: QueuedDialog[];
  show: (req: DialogRequest) => string;
  dismiss: (id?: string) => void;
  dismissAll: () => void;
};

let seq = 0;

export const useDialogStore = create<State>((set, get) => ({
  queue: [],

  show: (req) => {
    const id = `dlg-${++seq}`;
    set({ queue: [...get().queue, { ...req, id }] });
    return id;
  },

  dismiss: (id) => {
    const { queue } = get();
    if (queue.length === 0) return;
    const targetId = id ?? queue[0].id;
    set({ queue: queue.filter((d) => d.id !== targetId) });
  },

  dismissAll: () => set({ queue: [] }),
}));

/** Imperative entry point — the Alert.alert() replacement. */
export function showDialog(req: DialogRequest): string {
  return useDialogStore.getState().show(req);
}

export function dismissDialog(id?: string): void {
  useDialogStore.getState().dismiss(id);
}

/**
 * Promise-based confirm. Resolves true when the confirming action is pressed,
 * false on cancel or dismissal.
 */
export function confirmDialog(args: {
  title: string;
  message?: string;
  icon?: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const id = showDialog({
      title: args.title,
      message: args.message,
      icon: args.icon,
      tone: args.tone ?? (args.destructive ? 'danger' : 'indigo'),
      actions: [
        {
          label: args.cancelLabel ?? 'Cancel',
          variant: 'ghost',
          onPress: () => settle(false),
        },
        {
          label: args.confirmLabel ?? 'Confirm',
          variant: 'primary',
          destructive: args.destructive,
          onPress: () => settle(true),
        },
      ],
      dismissable: true,
    });

    // Scrim tap / back press removes the dialog without firing an action —
    // resolve false so awaiting callers are never left hanging.
    const unsub = useDialogStore.subscribe((state) => {
      if (state.queue.some((d) => d.id === id)) return;
      unsub();
      settle(false);
    });
  });
}
