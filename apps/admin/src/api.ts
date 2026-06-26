import axios from "axios";

const BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "http://localhost:3000/api/v1";

const http = axios.create({ baseURL: BASE });
http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export interface DryRunCase {
  name: string;
  ok: boolean;
  error?: string;
}
export interface ImportResult {
  effectiveDate: string;
  company: string;
  drafts: number;
  report: { passed: boolean; cases: DryRunCase[] };
}
export interface ConfigVersion {
  id: number;
  productName: string;
  premiumTerm: string;
  investorStatus: string;
  effectiveDate: string;
  effectiveEndDate: string | null;
  status: "Draft" | "Active" | "Sunset";
}
export interface MatrixRow extends ConfigVersion {
  matrix: { year: number; basic: number; extra: number; smpa: number; ma: number }[];
}

export const api = {
  async login(phone: string): Promise<string> {
    const { data } = await http.post<{ token: string }>("/auth/login", { phone });
    localStorage.setItem("token", data.token);
    return data.token;
  },
  logout() {
    localStorage.removeItem("token");
  },
  hasToken: () => !!localStorage.getItem("token"),

  async importExcel(file: File): Promise<ImportResult> {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await http.post<ImportResult>("/admin/import", fd);
    return data;
  },
  async pending(): Promise<ConfigVersion[]> {
    const { data } = await http.get<ConfigVersion[]>("/admin/pending");
    return data;
  },
  async matrix(productName: string): Promise<MatrixRow[]> {
    const { data } = await http.get<MatrixRow[]>(
      `/admin/matrix/${encodeURIComponent(productName)}`,
    );
    return data;
  },
  async approve(effectiveDate: string): Promise<{ published: number }> {
    const { data } = await http.post("/admin/approve", { effectiveDate });
    return data;
  },
  async rollback(
    productName: string,
    premiumTerm: string,
    investorStatus: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const { data } = await http.post("/admin/rollback", {
      productName,
      premiumTerm,
      investorStatus,
    });
    return data;
  },
};
