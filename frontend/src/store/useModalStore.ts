import { create } from 'zustand';

export type ModalType = 'alert' | 'confirm' | 'prompt' | null;

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  description: string;
  placeholder: string;
  inputValue: string;
  onConfirm: (val?: string) => void;
  onCancel: () => void;
  showAlert: (title: string, description: string, onConfirm?: () => void) => void;
  showConfirm: (title: string, description: string, onConfirm: () => void, onCancel?: () => void) => void;
  showPrompt: (
    title: string,
    description: string,
    onConfirm: (val: string) => void,
    placeholder?: string,
    defaultValue?: string,
    onCancel?: () => void
  ) => void;
  setInputValue: (val: string) => void;
  close: () => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  isOpen: false,
  type: null,
  title: '',
  description: '',
  placeholder: '',
  inputValue: '',
  onConfirm: () => {},
  onCancel: () => {},

  showAlert: (title, description, onConfirm) => {
    set({
      isOpen: true,
      type: 'alert',
      title,
      description,
      placeholder: '',
      inputValue: '',
      onConfirm: () => {
        onConfirm?.();
        get().close();
      },
      onCancel: () => {
        get().close();
      }
    });
  },

  showConfirm: (title, description, onConfirm, onCancel) => {
    set({
      isOpen: true,
      type: 'confirm',
      title,
      description,
      placeholder: '',
      inputValue: '',
      onConfirm: () => {
        onConfirm();
        get().close();
      },
      onCancel: () => {
        onCancel?.();
        get().close();
      }
    });
  },

  showPrompt: (title, description, onConfirm, placeholder = '', defaultValue = '', onCancel) => {
    set({
      isOpen: true,
      type: 'prompt',
      title,
      description,
      placeholder,
      inputValue: defaultValue,
      onConfirm: () => {
        onConfirm(get().inputValue);
        get().close();
      },
      onCancel: () => {
        onCancel?.();
        get().close();
      }
    });
  },

  setInputValue: (val) => set({ inputValue: val }),
  close: () => set({ isOpen: false, type: null, title: '', description: '', placeholder: '', inputValue: '' })
}));
