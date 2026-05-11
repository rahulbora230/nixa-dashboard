import Catalog from "../releases/Catalog";

const PendingReleases = () => (
  <Catalog initialStatus="submitted" heading="Pending Releases" mode="pending" />
);

export default PendingReleases;
