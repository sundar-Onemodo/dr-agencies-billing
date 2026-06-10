import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PrinterSettings {
  paperSize: '58mm' | '80mm' | 'A4';
  connectedPrinter: string | null;
  connectedPrinterAddress: string | null;
}

const initialState: PrinterSettings = {
  paperSize: '58mm',
  connectedPrinter: null,
  connectedPrinterAddress: null,
};

const printerSlice = createSlice({
  name: 'printer',
  initialState,
  reducers: {
    updatePrinterSettings: (state, action: PayloadAction<Partial<PrinterSettings>>) => {
      return {
        ...state,
        ...action.payload,
      };
    },
    disconnectPrinter: (state) => {
      state.connectedPrinter = null;
      state.connectedPrinterAddress = null;
    }
  },
});

export const { updatePrinterSettings, disconnectPrinter } = printerSlice.actions;
export default printerSlice.reducer;
