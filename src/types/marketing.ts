export interface Discount {
  id: string;
  name: string;
  code: string;
  type: "percentage" | "flat";
  value: number;
  maxDiscount?: number;
  minFee?: number;
  expiryDate?: string;
  usageLimit?: number;
  usedCount: number;
  active: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type DiscountInput = Omit<Discount, "id" | "createdAt" | "updatedAt" | "usedCount">;

export interface Notice {
  id: string;
  title: string;
  description: string;
  type: "offer" | "notice" | "popup" | "admission";
  color: string;
  priority: number;
  startDate?: string;
  endDate?: string;
  active: boolean;
  showInMarquee: boolean;
  showAsPopup: boolean;
  showOnHomepage: boolean;
  link?: string;
  createdAt: string;
  updatedAt: string;
}

export type NoticeInput = Omit<Notice, "id" | "createdAt" | "updatedAt">;

export interface Banner {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BannerInput = Omit<Banner, "id" | "createdAt" | "updatedAt">;
