import { create } from 'zustand';

interface DateState {
  selectedYear: number;
  selectedMonth: number; // 1-12
}

interface DateActions {
  setMonth: (year: number, month: number) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  resetToCurrent: () => void;
}

type DateStore = DateState & DateActions;

export const useDateStore = create<DateStore>((set) => {
  const now = new Date();
  
  return {
    selectedYear: now.getFullYear(),
    selectedMonth: now.getMonth() + 1, // JS months are 0-11

    setMonth: (year, month) => set({ selectedYear: year, selectedMonth: month }),
    
    nextMonth: () => set((state) => {
      let nextM = state.selectedMonth + 1;
      let nextY = state.selectedYear;
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
      return { selectedYear: nextY, selectedMonth: nextM };
    }),

    prevMonth: () => set((state) => {
      let prevM = state.selectedMonth - 1;
      let prevY = state.selectedYear;
      if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
      }
      return { selectedYear: prevY, selectedMonth: prevM };
    }),

    resetToCurrent: () => {
      const current = new Date();
      set({
        selectedYear: current.getFullYear(),
        selectedMonth: current.getMonth() + 1,
      });
    }
  };
});
