import type { BillDto } from '@billing/shared';
import { isOpenBillStatus } from '@/utils/canEditBill';

import { create } from 'zustand';

import { persist } from 'zustand/middleware';

import { clearBillingDraft, saveBillingDraft } from '@/lib/offline/billingDraft';



export interface BillingLineItem {

  id: string;

  productId: string;

  productName: string;

  batchId?: string;

  batchNumber?: string;

  barcode?: string;

  hsnCode?: string;

  qty: number;

  rate: number;

  discount: number;

  gstPercent: number;

  lineTotal: number;

  stockQty?: number;

  availableQty?: number;

  pendingQty?: number;

  reservedQty?: number;

  shortageQty?: number;

}



interface BillingState {

  billId: string | null;

  counterId: string | null;

  customerId: string | null;

  customerName: string;

  customerMobile: string | null;

  customerGst: string | null;

  customerPan: string | null;

  customerEmail: string | null;

  customerAddress: string | null;

  status: string | null;

  subtotal: number;

  lineDiscountTotal: number;

  billDiscount: number;

  cgstTotal: number;

  sgstTotal: number;

  igstTotal: number;

  rawGrandTotal: number;

  roundOff: number;

  grandTotal: number;

  invoiceNo: string | null;

  items: BillingLineItem[];

  focusField: string | null;

  isDirty: boolean;

  syncFromBill: (bill: BillDto) => void;

  patchLineLocally: (lineId: string, patch: Partial<BillingLineItem>) => void;

  clearBill: () => void;

  setFocusField: (field: string | null) => void;

  setCustomer: (

    id: string | null,

    name: string,

    mobile?: string | null,

    gst?: string | null,

    pan?: string | null,

    email?: string | null,

    address?: string | null,

  ) => void;

}



const financialDefaults = {

  subtotal: 0,

  lineDiscountTotal: 0,

  billDiscount: 0,

  cgstTotal: 0,

  sgstTotal: 0,

  igstTotal: 0,

  rawGrandTotal: 0,

  roundOff: 0,

  grandTotal: 0,

};



export const useBillingStore = create<BillingState>()(

  persist(

    (set) => ({

      billId: null,

      counterId: null,

      customerId: null,

      customerName: 'Walk-in Customer',

      customerMobile: null,

      customerGst: null,

      customerPan: null,

      customerEmail: null,

      customerAddress: null,

      status: null,

      ...financialDefaults,

      invoiceNo: null,

      items: [],

      focusField: 'barcode',

      isDirty: false,



      syncFromBill: (bill) => {
        if (!isOpenBillStatus(bill.status)) {
          const cid = bill.counterId ?? useBillingStore.getState().counterId;
          if (typeof window !== 'undefined' && cid) {
            void clearBillingDraft(cid);
          }
          set({
            billId: null,
            customerId: null,
            customerName: 'Walk-in Customer',
            customerMobile: null,
            customerGst: null,
            customerPan: null,
            customerEmail: null,
            customerAddress: null,
            status: null,
            ...financialDefaults,
            invoiceNo: null,
            items: [],
            isDirty: false,
            focusField: 'barcode',
          });
          return;
        }

        set({

          billId: bill.id,

          counterId: bill.counterId,

          customerId: bill.customerId,

          customerName: bill.customerName ?? 'Walk-in Customer',

          customerMobile: bill.customerMobile ?? null,

          customerGst: bill.customerGst ?? null,

          customerPan: bill.customerPan ?? null,

          customerEmail: bill.customerEmail ?? null,

          customerAddress: bill.customerAddress ?? null,

          status: bill.status,

          subtotal: Number(bill.subtotal) || 0,

          lineDiscountTotal: bill.lineDiscountTotal ?? 0,

          billDiscount: Number(bill.discountTotal) || 0,

          cgstTotal: Number(bill.cgstTotal) || 0,

          sgstTotal: Number(bill.sgstTotal) || 0,

          igstTotal: Number(bill.igstTotal) || 0,

          rawGrandTotal: Number(bill.rawGrandTotal ?? bill.grandTotal) || 0,

          roundOff: Number(bill.roundOff) || 0,

          grandTotal: Number(bill.grandTotal) || 0,

          invoiceNo: bill.invoiceNo ?? null,

          items: bill.items.map((i) => ({

            id: i.id,

            productId: i.productId,

            productName: i.productName,

            batchId: i.batchId ?? undefined,

            batchNumber: i.batchNumber ?? undefined,

            hsnCode: i.hsnCode ?? undefined,

            qty: Number(i.qty),

            rate: Number(i.rate),

            discount: Number(i.discount),

            gstPercent: Number(i.gstPercent),

            lineTotal: Number(i.lineTotal),

            stockQty: i.stockQty,

            availableQty: i.availableQty,

            pendingQty: i.pendingQty,

            reservedQty: i.reservedQty,

            shortageQty: i.shortageQty,

          })),

          isDirty: false,

        });

        if (typeof window !== 'undefined') {

          void saveBillingDraft(bill.counterId, bill, false);

        }

      },

      patchLineLocally: (lineId, patch) => {
        set((state) => ({
          items: state.items.map((line) =>
            line.id === lineId ? { ...line, ...patch } : line,
          ),
          isDirty: true,
        }));
      },

      clearBill: () => {

        const cid = useBillingStore.getState().counterId;

        if (typeof window !== 'undefined' && cid) {

          void clearBillingDraft(cid);

        }

        set({

          billId: null,

          customerId: null,

          customerName: 'Walk-in Customer',

          customerMobile: null,

          customerGst: null,

          customerPan: null,

          customerEmail: null,

          customerAddress: null,

          status: null,

          ...financialDefaults,

          invoiceNo: null,

          items: [],

          isDirty: false,

          focusField: 'barcode',

        });

      },



      setFocusField: (field) => set({ focusField: field }),

      setCustomer: (

        id: string | null,

        name: string,

        mobile?: string | null,

        gst?: string | null,

        pan?: string | null,

        email?: string | null,

        address?: string | null,

      ) =>

        set({

          customerId: id,

          customerName: name,

          customerMobile: mobile ?? null,

          customerGst: gst ?? null,

          customerPan: pan ?? null,

          customerEmail: email ?? null,

          customerAddress: address ?? null,

          isDirty: true,

        }),

    }),

    {

      name: 'billing-draft',

      partialize: (s) => ({

        billId: s.billId,

        counterId: s.counterId,

        customerId: s.customerId,

        customerName: s.customerName,

        status: s.status,

        subtotal: s.subtotal,

        lineDiscountTotal: s.lineDiscountTotal,

        billDiscount: s.billDiscount,

        cgstTotal: s.cgstTotal,

        sgstTotal: s.sgstTotal,

        igstTotal: s.igstTotal,

        rawGrandTotal: s.rawGrandTotal,

        roundOff: s.roundOff,

        grandTotal: s.grandTotal,

        items: s.items,

      }),

    },

  ),

);


