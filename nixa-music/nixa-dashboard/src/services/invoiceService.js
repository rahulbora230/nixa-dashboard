import httpClient from "./httpClient";

const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined));

const downloadBlob = (response, fileName) => {
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const invoiceService = {
  async generateInvoice(payoutId, payload = {}) {
    const response = await httpClient.post(`/invoices/generate/${payoutId}`, payload);
    return response.data;
  },

  async getInvoices(params) {
    const response = await httpClient.get("/invoices/list", { params: cleanParams(params) });
    return response.data;
  },

  async getInvoice(id) {
    const response = await httpClient.get(`/invoices/${id}`);
    return response.data.invoice;
  },

  async downloadInvoice(id, invoiceNumber = "nixa-invoice") {
    const response = await httpClient.get(`/invoices/download/${id}`, {
      responseType: "blob",
      timeout: 120000,
    });
    downloadBlob(response, `${invoiceNumber}.pdf`);
  },

  async exportInvoices(format, params = {}) {
    const response = await httpClient.get("/invoices/export", {
      params: cleanParams({ ...params, format }),
      responseType: "blob",
      timeout: 120000,
    });
    downloadBlob(response, `nixa-invoices.${format}`);
  },
};
