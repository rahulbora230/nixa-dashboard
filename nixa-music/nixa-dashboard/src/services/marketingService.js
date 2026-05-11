import { smartLinkService } from "./smartLinkService";

export const marketingService = {
  getOverview: smartLinkService.getOverview,
  getPromoKit: smartLinkService.getPromoKit,
  createPreSave: smartLinkService.createPreSave,
  getPreSave: smartLinkService.getPreSave,
  subscribePreSave: smartLinkService.subscribePreSave,
};
